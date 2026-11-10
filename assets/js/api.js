// ============================================================================
// SubMed v2 — Stratul de date (Supabase + OCR Render)
// ============================================================================
import { supabase } from './supabase-client.js';
import { CONFIG } from './runtime-config.js';
import { indexLatestReviews, scheduleFlashcardReview } from './flashcard-srs.js';
import { scheduleQuestionReview, shouldScheduleQuestionReview } from './question-review-srs.js';

// ARHITECTURĂ Faza 2 (OMR în browser + Edge Function):
//   1. OMR-ul rulează în browser (assets/js/omr.js) → matrice 150×5. Fără server
//      de procesare, deci fără cold-start.
//   2. SCORARE prin Edge Function `score`: primește matricea, citește answer_keys
//      cu service_role (server-side) și scorează. Cheia nu ajunge la client.
//   3. Supabase stochează rezultatul (submissions) + imaginile (Storage).

export const API = {

  // ── EXAMENE (metadate pentru browsing) ──────────────────────────
  async listExams() {
    const { data, error } = await supabase
      .from('exams')
      .select('id, name, year, session, exam_date, sheet_type, category, is_premium, faculty_id, faculties(name, slug)')
      .order('exam_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(e => ({
      ...e,
      faculty_name: e.faculties?.name || null,
      faculty_slug: e.faculties?.slug || null,
    }));
  },

  async listFaculties() {
    const { data, error } = await supabase
      .from('faculties').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  // ── SCORARE (Edge Function; OMR-ul rulează în browser — vezi omr.js) ──
  // matrix: 150×5 produs de processSheet(). Întoarce
  //   { score, total, percentage, answer_key_id, questions[] }.
  // Cheia corectă nu e expusă clientului (scoring server-side).
  async scoreMatrix(examId, matrix, variant = null) {
    const { data, error } = await supabase.functions.invoke('score', {
      body: { exam_id: examId, matrix, variant },
    });
    if (error) throw new Error(error.message || 'Eroare la scoring');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  // ── PERSISTARE rezultat în Supabase ─────────────────────────────
  async saveSubmission(result, { examId, answerKeyId, sheetFile, annotatedDataUrl } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');

    // 1. urcă imaginile în Storage (bucket „sheets", folder per user)
    let sheetUrl = null, annotatedUrl = null;
    try {
      if (sheetFile) sheetUrl = await this._uploadToStorage(user.id, sheetFile, 'original');
      if (annotatedDataUrl) {
        const blob = _dataUrlToBlob(annotatedDataUrl);
        annotatedUrl = await this._uploadToStorage(user.id, blob, 'annotated', 'jpg');
      }
    } catch (e) {
      console.warn('Upload Storage eșuat (continuăm fără imagini):', e.message);
    }

    // 2. inserează submission
    const { data, error } = await supabase.from('submissions').insert({
      user_id:       user.id,
      exam_id:       examId || null,
      answer_key_id: answerKeyId || null,
      score:         result.score ?? 0,
      total:         result.total ?? 0,
      percentage:    result.percentage ?? 0,
      answers:       result.questions ?? null,
      sheet_image_url:     sheetUrl,
      annotated_image_url: annotatedUrl,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async _uploadToStorage(userId, fileOrBlob, label, ext) {
    const extension = ext || (fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'jpg');
    const path = `${userId}/${Date.now()}_${label}.${extension}`;
    const { error } = await supabase.storage.from('sheets').upload(path, fileOrBlob, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('sheets').getPublicUrl(path);
    return data.publicUrl;
  },

  // ── ISTORIC + STATISTICI (din Supabase) ─────────────────────────
  async myHistory(limit = 50) {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, score, total, percentage, created_at, exams(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      exam_name: r.exams?.name || 'Examen',
      submitted_at: r.created_at,
      score: r.score, total: r.total, percentage: r.percentage,
    }));
  },

  async myStats() {
    const rows = await this.myHistory(1000);
    if (!rows.length) return { total_exams: 0, avg_pct: 0, best_pct: 0, total_correct: 0, total_graded: 0, trend: [] };
    const total_exams   = rows.length;
    const avg_pct       = Math.round(rows.reduce((s, r) => s + Number(r.percentage), 0) / total_exams);
    const best_pct      = Math.max(...rows.map(r => Number(r.percentage)));
    const total_correct = rows.reduce((s, r) => s + r.score, 0);
    const total_graded  = rows.reduce((s, r) => s + r.total, 0);
    const trend = rows.slice(0, 10).reverse()
      .map(r => ({ exam_name: r.exam_name, percentage: r.percentage }));
    return { total_exams, avg_pct, best_pct, total_correct, total_graded, trend };
  },

  async weakQuestions(examIdOrOptions = null, limit = 8) {
    const opts = typeof examIdOrOptions === 'object' && examIdOrOptions !== null
      ? examIdOrOptions
      : { examId: examIdOrOptions, limit };
    let q = supabase
      .from('weak_questions').select('*')
      .order('success_rate', { ascending: true })
      .limit(opts.limit ?? limit);
    if (opts.examId) q = q.eq('exam_id', opts.examId);
    if (opts.subject) q = q.eq('subject', opts.subject);
    if (opts.chapterId) q = q.eq('chapter_id', opts.chapterId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async weakChapters(examIdOrOptions = null, limit = 8) {
    const opts = typeof examIdOrOptions === 'object' && examIdOrOptions !== null
      ? examIdOrOptions
      : { examId: examIdOrOptions, limit };
    let q = supabase
      .from('weak_chapters').select('*')
      .order('success_rate', { ascending: true })
      .limit(opts.limit ?? limit);
    if (opts.examId) q = q.eq('exam_id', opts.examId);
    if (opts.subject) q = q.eq('subject', opts.subject);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async wrongAnswers({ submissionId = null, examId = null, subject = null, chapterId = null, limit = 50 } = {}) {
    let q = supabase
      .from('wrong_answers').select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (submissionId) q = q.eq('submission_id', submissionId);
    if (examId) q = q.eq('exam_id', examId);
    if (subject) q = q.eq('subject', subject);
    if (chapterId) q = q.eq('chapter_id', chapterId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async submissionChapterResults(submissionId) {
    const { data, error } = await supabase
      .from('submission_chapter_results').select('*')
      .eq('submission_id', submissionId)
      .order('success_rate', { ascending: true });
    if (error) throw error;
    return data || [];
  },
};

// ============================================================================
// ADMIN — gestionare examene + bareme (scrierile cer rol admin prin RLS)
// ============================================================================
export const Admin = {
  async listFaculties() {
    const { data, error } = await supabase.from('faculties').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async createFaculty({ name, city, slug }) {
    const { data, error } = await supabase.from('faculties')
      .insert({ name, city, slug }).select().single();
    if (error) throw error;
    return data;
  },

  // examene + baremele lor (pentru lista din admin)
  async listExams() {
    const { data, error } = await supabase.from('exams')
      .select('id, name, year, session, category, sheet_type, exam_date, faculty_id, faculties(name), answer_keys(id, variant, verified)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createExam(fields) {
    const { data, error } = await supabase.from('exams').insert(fields).select().single();
    if (error) throw error;
    return data;
  },

  async deleteExam(id) {
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
  },

  // citește baremul existent (admin poate, prin RLS) — null dacă nu există
  async getAnswerKey(examId, variant = '1') {
    const { data, error } = await supabase.from('answer_keys')
      .select('key, variant, verified')
      .eq('exam_id', examId).eq('variant', variant).maybeSingle();
    if (error) throw error;
    return data;
  },

  // salvează/actualizează baremul unui examen (unic pe exam_id + variant)
  async saveAnswerKey(examId, variant, key, verified = true) {
    const { data, error } = await supabase.from('answer_keys')
      .upsert({ exam_id: examId, variant, key, verified }, { onConflict: 'exam_id,variant' })
      .select().single();
    if (error) throw error;
    return data;
  },

  // mapare intrebare examen -> materie/capitol pentru rezultatele scanate
  async listExamQuestionTopics(examId) {
    const { data, error } = await supabase.from('exam_questions')
      .select('id, exam_id, question_no, subject, chapter_id, source_question_id, explanation, tags, chapters(name)')
      .eq('exam_id', examId)
      .order('question_no');
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      chapter_name: r.chapters?.name || null,
    }));
  },

  async saveExamQuestionTopics(examId, rows) {
    const payload = rows.map(r => ({
      exam_id: examId,
      question_no: Number(r.question_no),
      subject: r.subject,
      chapter_id: r.chapter_id || null,
      source_question_id: r.source_question_id || null,
      explanation: r.explanation || null,
      tags: r.tags || [],
    }));
    if (!payload.length) return 0;
    const { data, error } = await supabase.from('exam_questions')
      .upsert(payload, { onConflict: 'exam_id,question_no' })
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },

  async createFlashcardDeck(fields) {
    const { data, error } = await supabase.from('flashcard_decks')
      .insert(fields)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listFlashcardDecks(subject = null) {
    let q = supabase.from('flashcard_decks')
      .select('id, subject, chapter_id, slug, title, description, source, sort_order, is_premium, active, chapters(name)')
      .order('subject')
      .order('sort_order');
    if (subject) q = q.eq('subject', subject);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      chapter_name: d.chapters?.name || null,
    }));
  },

  async upsertFlashcardDeck(fields) {
    const hasSlug = Boolean(fields.slug);
    const query = hasSlug
      ? supabase.from('flashcard_decks').upsert(fields, { onConflict: 'slug' })
      : supabase.from('flashcard_decks').insert(fields);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async importFlashcards(rows, { upsert = true } = {}) {
    if (!rows.length) return 0;
    const hasSourceKeys = rows.some(r => r.source_key);
    const query = upsert && hasSourceKeys
      ? supabase.from('flashcards').upsert(rows, { onConflict: 'source_key' })
      : supabase.from('flashcards').insert(rows);
    const { data, error } = await query.select('id');
    if (error) throw error;
    return data.length;
  },

  async upsertChemicalStructures(rows) {
    if (!rows.length) return 0;
    const cleaned = rows.map(({ chapter, ...row }) => row);
    const payload = [...new Map(cleaned.map(row => [row.slug, row])).values()];
    const { data, error } = await supabase.from('chemical_structures')
      .upsert(payload, { onConflict: 'slug' })
      .select('id, slug, name, iupac_name, smiles, formula');
    if (error) throw error;
    return data || [];
  },

  async getChemicalStructuresBySlugs(slugs) {
    const uniq = [...new Set((slugs || []).filter(Boolean))];
    if (!uniq.length) return [];
    const { data, error } = await supabase.from('chemical_structures')
      .select('id, slug, name, iupac_name, smiles, formula')
      .in('slug', uniq);
    if (error) throw error;
    return data || [];
  },

  // ── GRILE: capitole ──────────────────────────────────────────
  async createChapter({ subject, name, sort_order = 0 }) {
    const { data, error } = await supabase.from('chapters')
      .insert({ subject, name, sort_order }).select().single();
    if (error) throw error;
    return data;
  },
  async deleteChapter(id) {
    const { data, error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error('Capitolul nu a fost șters. Verifică rolul de admin și politica RLS chapters_write.');
    }
    return data[0];
  },

  // ── GRILE: întrebări ─────────────────────────────────────────
  async createQuestion(q) {
    const { data, error } = await supabase.from('questions').insert(q).select().single();
    if (error) throw error;
    return data;
  },
  async updateQuestion(id, fields) {
    const { data, error } = await supabase.from('questions')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      throw new Error('Întrebarea nu a fost actualizată. Verifică rolul de admin și politica RLS questions_write.');
    }
    return data;
  },
  // import în masă: array de întrebări [{chapter_id, text, options, correct, ...}]
  async importQuestions(rows, { upsert = true } = {}) {
    if (!rows.length) return 0;
    const hasSourceKeys = rows.some(r => r.source_key);
    const query = upsert && hasSourceKeys
      ? supabase.from('questions').upsert(rows, { onConflict: 'source_key' })
      : supabase.from('questions').insert(rows);
    const { data, error } = await query.select('id');
    if (error) throw error;
    return data.length;
  },
  async listQuestions(chapterId) {
    const { data, error } = await supabase.from('questions')
      .select('*').eq('chapter_id', chapterId).order('created_at');
    if (error) throw error;
    return data || [];
  },
  async deleteQuestion(id) {
    const { data, error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error('Întrebarea nu a fost ștearsă. Verifică rolul de admin și politica RLS questions_write.');
    }
    return data[0];
  },
};

// ============================================================================
// GRILE — capitole, întrebări, încercări (user)
// ============================================================================
export const Grile = {
  async listDueReviews(limit = 100, { subject = null } = {}) {
    const now = new Date().toISOString();
    let q = supabase.from('question_review_schedule')
      .select('question_id, repetition_count, interval_days, next_review_at, questions!inner(id, text, options, correct, explanation, multiple, difficulty, source, active, chapter_id, chapters!inner(subject, name))')
      .eq('questions.active', true)
      .lte('next_review_at', now)
      .order('next_review_at', { ascending: true })
      .limit(limit);
    if (subject === 'biologie' || subject === 'chimie') q = q.eq('questions.chapters.subject', subject);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(row => ({
      ...row.questions,
      subject: row.questions?.chapters?.subject || null,
      chapter_name: row.questions?.chapters?.name || null,
      review: {
        repetition_count: row.repetition_count,
        interval_days: row.interval_days,
        next_review_at: row.next_review_at,
      },
    }));
  },

  async _saveReviewSchedules(userId, attempts) {
    const rows = [...new Map((attempts || [])
      .filter(row => row.questionId && Array.isArray(row.selected) && row.selected.length)
      .map(row => [row.questionId, row])).values()];
    if (!rows.length) return;
    const questionIds = rows.map(row => row.questionId);
    const { data: existing, error: readError } = await supabase.from('question_review_schedule')
      .select('question_id, repetition_count, interval_days, ease')
      .in('question_id', questionIds);
    if (readError) throw readError;
    const byQuestion = Object.fromEntries((existing || []).map(row => [row.question_id, row]));
    const scheduledRows = rows.filter(row => shouldScheduleQuestionReview(byQuestion[row.questionId], !!row.isCorrect));
    if (!scheduledRows.length) return;
    const now = new Date();
    const payload = scheduledRows.map(row => ({
      user_id: userId,
      question_id: row.questionId,
      ...scheduleQuestionReview(byQuestion[row.questionId] || {}, !!row.isCorrect, now),
    }));
    const { error } = await supabase.from('question_review_schedule')
      .upsert(payload, { onConflict: 'user_id,question_id' });
    if (error) throw error;
  },

  // capitole cu numărul de întrebări
  async listChapters(subject = null) {
    let q = supabase.from('chapters')
      .select('id, subject, name, sort_order, questions(count)')
      .eq('questions.active', true)
      .order('subject').order('sort_order');
    if (subject) q = q.eq('subject', subject);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(c => ({ ...c, question_count: c.questions?.[0]?.count ?? 0 }));
  },

  // întrebările active dintr-un capitol (cu răspunsuri — notare pe client)
  async listQuestions(chapterId, { shuffle = true, limit = null } = {}) {
    const chapterIds = (Array.isArray(chapterId) ? chapterId : [chapterId]).filter(Boolean);
    if (!chapterIds.length) return [];
    let query = supabase.from('questions')
      .select('id, text, options, correct, explanation, multiple, difficulty, source')
      .eq('active', true);
    query = chapterIds.length === 1
      ? query.eq('chapter_id', chapterIds[0])
      : query.in('chapter_id', chapterIds);
    const { data, error } = await query;
    if (error) throw error;
    let qs = data || [];
    if (shuffle) qs = qs.sort(() => Math.random() - 0.5);
    if (limit) qs = qs.slice(0, limit);
    return qs;
  },

  // sesiune personalizată: întrebări dintr-o materie întreagă, opțional filtrate
  // pe centru universitar (după textul din `source`, ex. "Admitere Cluj 2024").
  // `center` poate fi un string sau un array de variante (['iași','iasi']).
  async listQuestionsBySubject(subject, { center = null, shuffle = true, limit = null } = {}) {
    let q = supabase.from('questions')
      .select('id, text, options, correct, explanation, multiple, difficulty, source, chapter_id, chapters!inner(subject, name)')
      .eq('active', true)
      .eq('chapters.subject', subject);
    const pats = center ? (Array.isArray(center) ? center : [center]) : [];
    if (pats.length) q = q.or(pats.map(p => `source.ilike.%${p}%`).join(','));
    const { data, error } = await q;
    if (error) throw error;
    let qs = (data || []).map(r => ({ ...r, chapter_name: r.chapters?.name || null }));
    if (shuffle) qs = qs.sort(() => Math.random() - 0.5);
    if (limit) qs = qs.slice(0, limit);
    return qs;
  },

  // câte întrebări sunt disponibile pentru o materie (+ centru) — pentru configurator
  async countQuestionsBySubject(subject, { center = null } = {}) {
    let q = supabase.from('questions')
      .select('id, source, chapters!inner(subject)', { count: 'exact', head: false })
      .eq('active', true)
      .eq('chapters.subject', subject);
    const pats = center ? (Array.isArray(center) ? center : [center]) : [];
    if (pats.length) q = q.or(pats.map(p => `source.ilike.%${p}%`).join(','));
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  },

  
  // Structured exam catalog: filters from exams/faculties metadata, not question.source text.
  async listExamCatalog({ subject = null } = {}) {
    let q = supabase.from('exams')
      .select('id, name, year, session, exam_date, sheet_type, category, is_premium, faculty_id, num_questions, faculties(id, name, city, slug)')
      .eq('is_published', true)
      .order('exam_date', { ascending: false, nullsFirst: false })
      .order('year', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;

    let exams = data || [];
    if (subject === 'biologie' || subject === 'chimie') {
      const { data: mappedRows, error: mappingError } = await supabase
        .from('exam_questions')
        .select('exam_id')
        .eq('subject', subject);
      if (mappingError) throw mappingError;
      const examIds = new Set((mappedRows || []).map(row => row.exam_id).filter(Boolean));
      exams = exams.filter(exam => examIds.has(exam.id));
    }

    return exams.map(exam => ({
      ...exam,
      faculty_name: exam.faculties?.name || 'Facultate nespecificată',
      faculty_city: exam.faculties?.city || '',
    }));
  },

  async listQuestionsForExam(examId, { subject = null, shuffle = true, limit = null } = {}) {
    if (!examId) throw new Error('Alege un examen.');
    const { data: mapRows, error: mapError } = await supabase.from('exam_questions')
      .select('question_no, subject, chapter_id, source_question_id, chapters(name)')
      .eq('exam_id', examId)
      .order('question_no');
    if (mapError) throw mapError;
    let mapping = mapRows || [];
    if (subject) mapping = mapping.filter(row => row.subject === subject);
    const ids = [...new Set(mapping.map(row => row.source_question_id).filter(Boolean))];
    if (!ids.length) return [];
    let query = supabase.from('questions')
      .select('id, text, options, correct, explanation, multiple, difficulty, source, chapter_id')
      .eq('active', true)
      .in('id', ids);
    const { data, error } = await query;
    if (error) throw error;
    const byId = new Map((data || []).map(row => [row.id, row]));
    let questions = mapping.map(row => {
      const question = byId.get(row.source_question_id);
      return question ? {
        ...question,
        exam_question_no: row.question_no,
        subject: row.subject,
        chapter_name: row.chapters?.name || null,
      } : null;
    }).filter(Boolean);
    if (shuffle) questions = questions.sort(() => Math.random() - 0.5);
    if (limit) questions = questions.slice(0, limit);
    return questions;
  },

async recordAttempt(questionId, selected, isCorrect) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { error } = await supabase.from('question_attempts')
      .insert({ user_id: user.id, question_id: questionId, selected, is_correct: isCorrect });
    if (error) throw error;
    try { await this._saveReviewSchedules(user.id, [{ questionId, selected, isCorrect }]); }
    catch (scheduleError) { console.warn('Programarea repetării greșelilor nu a fost salvată:', scheduleError.message); }
  },

  // salvare în masă (mod examen — la final)
  async recordAttempts(rows) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const payload = rows.map(r => ({
      user_id: user.id, question_id: r.questionId, selected: r.selected, is_correct: r.isCorrect,
    }));
    const { error } = await supabase.from('question_attempts').insert(payload);
    if (error) throw error;
    try { await this._saveReviewSchedules(user.id, rows); }
    catch (scheduleError) { console.warn('Programarea repetării greșelilor nu a fost salvată:', scheduleError.message); }
  },

  // progres per capitol: {chapterId: {attempted, correct}} (întrebări distincte)
  async myProgress() {
    const { data, error } = await supabase.from('question_attempts')
      .select('question_id, is_correct, questions(chapter_id)');
    if (error) throw error;
    const by = {};
    (data || []).forEach(a => {
      const ch = a.questions?.chapter_id; if (!ch) return;
      by[ch] = by[ch] || { att: new Set(), cor: new Set() };
      by[ch].att.add(a.question_id);
      if (a.is_correct) by[ch].cor.add(a.question_id);
    });
    const out = {};
    for (const ch in by) out[ch] = { attempted: by[ch].att.size, correct: by[ch].cor.size };
    return out;
  },

  // Rezultate per capitol bazate pe toate răspunsurile studentului,
  // pentru recomandări care reflectă progresul recent, nu doar întrebările distincte.
  async myPerformance() {
    const by = {};
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('question_attempts')
        .select('id, created_at, selected, is_correct, questions!inner(chapter_id)')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      (data || []).forEach(row => {
        if (!Array.isArray(row.selected) || !row.selected.length) return;
        const chapterId = row.questions?.chapter_id;
        if (!chapterId) return;
        by[chapterId] = by[chapterId] || { attempts: 0, correct: 0 };
        by[chapterId].attempts++;
        if (row.is_correct) by[chapterId].correct++;
      });
      if (!data || data.length < pageSize) break;
    }
    return by;
  },
};

// ============================================================================
// FLASHCARDS + STRUCTURI CHIMICE
// ============================================================================
export const Flashcards = {
  async listDecks(subject = null, { includeProgress = true } = {}) {
    let q = supabase.from('flashcard_decks')
      .select('id, subject, chapter_id, slug, title, description, source, sort_order, is_premium, flashcards(count), chapters(name)')
      .eq('active', true)
      .order('subject')
      .order('sort_order');
    if (subject) q = q.eq('subject', subject);
    const { data, error } = await q;
    if (error) throw error;
    const progress = includeProgress ? await this.myProgress() : {};
    return (data || []).map(d => ({
      ...d,
      chapter_name: d.chapters?.name || null,
      card_count: d.flashcards?.[0]?.count ?? 0,
      reviewed_count: progress[d.id]?.reviewed || 0,
      known_count: progress[d.id]?.known || 0,
      due_count: Math.max(0, (d.flashcards?.[0]?.count ?? 0) - (progress[d.id]?.reviewed || 0))
        + (progress[d.id]?.due || 0),
      mastery_pct: d.flashcards?.[0]?.count
        ? Math.round(((progress[d.id]?.known || 0) / (d.flashcards?.[0]?.count ?? 1)) * 100)
        : 0,
    }));
  },

  async listCards(deckIds, { shuffle = true, includeInactive = false, withReviews = true, dueOnly = false } = {}) {
    const ids = Array.isArray(deckIds) ? deckIds : [deckIds];
    if (!ids.length || !ids[0]) return [];
    let q = supabase.from('flashcards')
      .select('id, source_key, deck_id, chapter_id, chemical_structure_id, front, back, card_type, tags, difficulty, source, chemical_structures(slug, name, iupac_name, smiles, formula, aliases, functional_groups)')
      .in('deck_id', ids);
    if (!includeInactive) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    let cards = data || [];
    if (withReviews && cards.length) {
      const reviews = await this.latestReviews(cards.map(card => card.id));
      const now = new Date();
      cards = cards.map(card => ({
        ...card,
        latest_review: reviews[card.id] || null,
      }));
      if (dueOnly) {
        cards = cards.filter(card => {
          const review = card.latest_review;
          return !review?.next_review_at || new Date(review.next_review_at) <= now;
        });
      }
    }
    if (shuffle) cards = cards.sort(() => Math.random() - 0.5);
    return cards;
  },

  async latestReviews(flashcardIds = null) {
    const ids = Array.isArray(flashcardIds) ? flashcardIds.filter(Boolean) : (flashcardIds ? [flashcardIds] : []);
    if (Array.isArray(flashcardIds) && !ids.length) return {};
    let q = supabase.from('flashcard_reviews')
      .select('flashcard_id, is_known, rating, interval_days, ease, reviewed_at, next_review_at')
      .order('reviewed_at', { ascending: false });
    if (ids.length) q = q.in('flashcard_id', ids);
    const { data, error } = await q;
    if (error) throw error;
    return indexLatestReviews(data || []);
  },

  async recordReview(flashcardId, {
    rating = 'good',
    isKnown = null,
    intervalDays = null,
    ease = null,
    nextReviewAt = null,
  } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const previous = (await this.latestReviews([flashcardId]))[flashcardId] || {};
    const scheduled = scheduleFlashcardReview(previous, rating);
    const { data, error } = await supabase.from('flashcard_reviews')
      .insert({
        user_id: user.id,
        flashcard_id: flashcardId,
        rating: scheduled.rating,
        is_known: isKnown ?? scheduled.isKnown,
        interval_days: intervalDays ?? scheduled.intervalDays,
        ease: ease ?? scheduled.ease,
        next_review_at: nextReviewAt ?? scheduled.nextReviewAt,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async myProgress() {
    const { data, error } = await supabase.from('flashcard_reviews')
      .select('flashcard_id, is_known, rating, reviewed_at, next_review_at, flashcards(deck_id, chapter_id)')
      .order('reviewed_at', { ascending: false });
    if (error) throw error;
    const latest = new Set();
    const byDeck = {};
    const now = new Date();
    for (const row of data || []) {
      if (latest.has(row.flashcard_id)) continue;
      latest.add(row.flashcard_id);
      const deckId = row.flashcards?.deck_id;
      if (!deckId) continue;
      byDeck[deckId] = byDeck[deckId] || { reviewed: 0, known: 0, due: 0 };
      byDeck[deckId].reviewed++;
      if (row.is_known) byDeck[deckId].known++;
      if (!row.next_review_at || new Date(row.next_review_at) <= now) byDeck[deckId].due++;
    }
    return byDeck;
  },
};

// ============================================================================
// PROFIL & PREFERINȚE (personalizare panou / onboarding)
// ============================================================================
export const Profiles = {
  // profilul complet al userului curent
  async get() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return data;
  },

  // doar câmpurile de preferințe (pentru dashboard/coach)
  async getPreferences() {
    const p = await this.get();
    return {
      name: p.name || null,
      center: p.center || null,
      subjects: p.subjects || [],
      preferred_tool: p.preferred_tool || null,
      goal: p.goal || null,
      target_score: p.target_score ?? null,
      settings: p.settings || {},
    };
  },

  // salvează preferințele (doar câmpurile prezente)
  async savePreferences(prefs = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const patch = {};
    for (const k of ['name', 'center', 'preferred_tool', 'goal']) if (prefs[k] !== undefined) patch[k] = prefs[k];
    if (prefs.subjects !== undefined)     patch.subjects = prefs.subjects;
    if (prefs.target_score !== undefined) patch.target_score = prefs.target_score;
    if (prefs.settings !== undefined)     patch.settings = prefs.settings;
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw error;
    return true;
  },
};

// ============================================================================
// COACH — simulările & examenele utilizatorului
// ============================================================================
export const Coach = {
  async listExams() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { data, error } = await supabase.from('user_exams')
      .select('id, name, exam_date, type, center')
      .order('exam_date', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => ({ id: r.id, name: r.name, date: r.exam_date, type: r.type, center: r.center }));
  },

  async addExam({ name, date, type = 'sim', center = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { data, error } = await supabase.from('user_exams')
      .insert({ user_id: user.id, name, exam_date: date, type, center })
      .select('id, name, exam_date, type, center').single();
    if (error) throw error;
    return { id: data.id, name: data.name, date: data.exam_date, type: data.type, center: data.center };
  },

  async deleteExam(id) {
    const { error } = await supabase.from('user_exams').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // ── obiceiuri zilnice (user_habits) ───────────────────────────
  // rânduri: { habit_id, day ('YYYY-MM-DD'), done, note }
  async listHabits(fromDay = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    let q = supabase.from('user_habits').select('habit_id, day, done, note');
    if (fromDay) q = q.gte('day', fromDay);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async setHabit({ habitId, day, done, note = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { error } = await supabase.from('user_habits')
      .upsert({ user_id: user.id, habit_id: habitId, day, done, note },
              { onConflict: 'user_id,habit_id,day' });
    if (error) throw error;
    return true;
  },

  // ── evenimentele personale din program (user_day_events)
  // Coloanele event_type și notes sunt adăugate de migrarea calendarului.
  async listDayEvents(day) {
    return this.listDayEventsBetween(day, day);
  },

  async listDayEventsBetween(fromDay, toDay) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { data, error } = await supabase.from('user_day_events')
      .select('id, day, name, start_min, duration_min, event_type, notes, created_at')
      .eq('user_id', user.id)
      .gte('day', fromDay)
      .lte('day', toDay)
      .order('day')
      .order('start_min');
    if (error) throw error;
    return data || [];
  },

  async addDayEvent({ day, name, startMin, durationMin, eventType = 'personal', notes = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const payload = normaliseDayEvent({ day, name, startMin, durationMin, eventType, notes });
    const { data, error } = await supabase.from('user_day_events')
      .insert({ user_id: user.id, ...payload })
      .select('id, day, name, start_min, duration_min, event_type, notes, created_at').single();
    if (error) throw error;
    return data;
  },

  async updateDayEvent({ id, day, name, startMin, durationMin, eventType = 'personal', notes = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    if (!id) throw new Error('Eveniment lipsă');
    const payload = normaliseDayEvent({ day, name, startMin, durationMin, eventType, notes });
    const { data, error } = await supabase.from('user_day_events')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, day, name, start_min, duration_min, event_type, notes, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Evenimentul nu mai există sau nu îți aparține');
    return data;
  },

  async deleteDayEvent(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Neautentificat');
    const { data, error } = await supabase.from('user_day_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Evenimentul nu mai există sau nu îți aparține');
    return true;
  },
};

function normaliseDayEvent({ day, name, startMin, durationMin, eventType, notes }) {
  const trimmedName = String(name || '').trim();
  const start = Number(startMin);
  const duration = Number(durationMin);
  const type = String(eventType || 'personal').trim().toLowerCase();
  const allowedTypes = new Set(['study', 'personal', 'exam', 'appointment', 'work', 'other']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('Data evenimentului nu este validă');
  if (!trimmedName || trimmedName.length > 100) throw new Error('Titlul evenimentului trebuie să aibă între 1 și 100 de caractere');
  if (!Number.isInteger(start) || start < 0 || start > 1435) throw new Error('Ora de început nu este validă');
  if (!Number.isInteger(duration) || duration < 5 || duration > 720 || start + duration > 1440) throw new Error('Durata evenimentului nu este validă');
  if (!allowedTypes.has(type)) throw new Error('Tipul evenimentului nu este valid');
  const trimmedNotes = String(notes || '').trim();
  if (trimmedNotes.length > 500) throw new Error('Notițele pot avea cel mult 500 de caractere');
  return {
    day,
    name: trimmedName,
    start_min: start,
    duration_min: duration,
    event_type: type,
    notes: trimmedNotes || null,
  };
}

export const Chemistry = {
  async listStructures({ chapterId = null, search = '', limit = 100 } = {}) {
    let q = supabase.from('chemical_structures')
      .select('id, slug, name, iupac_name, smiles, formula, aliases, functional_groups, chapter_id')
      .eq('active', true)
      .order('name')
      .limit(limit);
    if (chapterId) q = q.eq('chapter_id', chapterId);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
};

// notare: setul de răspunsuri selectate == setul corect (single sau multiplu)
export function gradeAnswer(selected, correct) {
  const a = [...selected].sort().join(''), b = [...correct].sort().join('');
  return a === b && a.length > 0;
}

// ── helpers ─────────────────────────────────────────────────────
function _dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:(.*?);base64/) || [, 'image/jpeg'])[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
