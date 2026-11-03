// ============================================================================
// Edge Function: score
// ============================================================================
// Primește { exam_id, matrix(150×5), variant? } de la browser (după OMR local).
// Citește baremul din `answer_keys` cu service_role (server-side) și scorează.
// Cheia NU este expusă clientului — se întorc doar răspunsurile corecte per
// întrebare, ca feedback POST-scanare.
//
// Deploy:  supabase functions deploy score
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPTS = ['a', 'b', 'c', 'd', 'e'];
type TopicMeta = {
  subject: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  explanation: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Neautentificat' }, 401);

    // 1. validează userul (cu cheia anon + JWT-ul lui)
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: 'Sesiune invalidă' }, 401);

    // 2. input
    const { exam_id, matrix, variant } = await req.json();
    if (!exam_id || !Array.isArray(matrix) || matrix.length !== 150) {
      return json({ error: 'Date invalide (exam_id + matrix 150×5).' }, 400);
    }

    // 3. citește baremul cu service_role (ocolește RLS, server-side)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    let q = admin.from('answer_keys').select('id, key, variant').eq('exam_id', exam_id);
    q = variant ? q.eq('variant', variant) : q.order('variant').limit(1);
    const { data: keys, error } = await q;
    if (error) return json({ error: error.message }, 500);
    if (!keys || !keys.length) return json({ error: 'Barem inexistent pentru acest examen.' }, 404);

    const answerKey = keys[0];
    const key: Record<string, string[]> = answerKey.key ?? {};

    // 4. mapare intrebare -> materie/capitol pentru feedback post-scanare
    const { data: topicRows, error: topicError } = await admin
      .from('exam_questions')
      .select('question_no, subject, chapter_id, explanation, chapters(name)')
      .eq('exam_id', exam_id);
    if (topicError) return json({ error: topicError.message }, 500);

    const topicByQuestion = new Map<string, TopicMeta>();
    for (const row of topicRows ?? []) {
      const chapter = Array.isArray(row.chapters) ? row.chapters[0] : row.chapters;
      topicByQuestion.set(String(row.question_no), {
        subject: row.subject ?? null,
        chapter_id: row.chapter_id ?? null,
        chapter_name: chapter?.name ?? null,
        explanation: row.explanation ?? null,
      });
    }
    const topicFor = (questionNo: string): TopicMeta =>
      topicByQuestion.get(questionNo) ?? {
        subject: null,
        chapter_id: null,
        chapter_name: null,
        explanation: null,
      };

    // 5. scorare
    const questions = [];
    let correctN = 0, gradedN = 0;
    for (let i = 0; i < 150; i++) {
      const qk = String(i + 1);
      const student = OPTS.filter((_, oi) => matrix[i]?.[oi] === 1);
      const correct = key[qk] ?? [];
      const topic = topicFor(qk);
      if (!correct.length) {
        questions.push({ q: i + 1, student, correct: [], status: 'ungraded', ...topic });
        continue;
      }
      gradedN++;
      const ok = student.length === correct.length &&
                 [...student].sort().join('') === [...correct].sort().join('');
      if (ok) correctN++;
      questions.push({ q: i + 1, student, correct, status: ok ? 'correct' : 'wrong', ...topic });
    }
    const percentage = gradedN ? Math.round((correctN / gradedN) * 1000) / 10 : 0;
    const mappedN = questions.filter((q) => q.status !== 'ungraded' && (q.subject || q.chapter_id)).length;
    const unmappedWrongQuestions = questions
      .filter((q) => q.status === 'wrong' && !q.subject && !q.chapter_id)
      .map((q) => q.q);
    const wrongChapterMap = new Map<string, {
      subject: string | null;
      chapter_id: string | null;
      chapter_name: string | null;
      wrong: number;
      questions: number[];
    }>();
    for (const q of questions) {
      if (q.status !== 'wrong' || (!q.subject && !q.chapter_id)) continue;
      const key = `${q.subject ?? ''}|${q.chapter_id ?? ''}|${q.chapter_name ?? ''}`;
      const row = wrongChapterMap.get(key) ?? {
        subject: q.subject,
        chapter_id: q.chapter_id,
        chapter_name: q.chapter_name,
        wrong: 0,
        questions: [],
      };
      row.wrong++;
      row.questions.push(q.q);
      wrongChapterMap.set(key, row);
    }
    const wrong_chapters = [...wrongChapterMap.values()]
      .sort((a, b) => b.wrong - a.wrong || (a.chapter_name ?? '').localeCompare(b.chapter_name ?? ''));

    return json({
      score: correctN,
      total: gradedN,
      percentage,
      answer_key_id: answerKey.id,
      questions,
      topic_coverage: {
        mapped: mappedN,
        total: gradedN,
        unmapped: Math.max(gradedN - mappedN, 0),
        unmapped_wrong_questions: unmappedWrongQuestions,
      },
      wrong_chapters,
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
