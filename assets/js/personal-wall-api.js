import { supabase } from './supabase-client.js';

export const WALL_TYPES = {
  note: 'Notiță',
  postit: 'Post-it',
  question: 'Grilă',
  flashcard: 'Flashcard',
  exam: 'Examen',
  chemical_structure: 'Structură chimică',
  lesson: 'Lecție',
  submission: 'Rezultat examen',
  calendar_event: 'Eveniment din calendar',
};

export const WALL_CATEGORIES = {
  biologie: 'Biologie',
  chimie: 'Chimie',
  altele: 'Altele',
};

export const WALL_COLORS = ['#FFF3C4', '#DCE9FF', '#D9F3E6', '#FBE0E0'];

const MAX_ITEMS = 500;
const MAX_TITLE = 120;
const MAX_BODY = 4000;
const MAX_TAGS = 12;

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Autentifică-te pentru a folosi Peretele personal.');
  return data.user;
}

function cleanTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map(tag => String(tag).trim().replace(/^#/, '').slice(0, 32)).filter(Boolean))].slice(0, MAX_TAGS);
}

function cleanText(value, max) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new Error(`Textul poate avea maximum ${max} de caractere.`);
  return text;
}

function validateTextItem(payload = {}, type = 'note') {
  if (type !== 'note' && type !== 'postit') throw new Error('Tipul de notiță nu este valid.');
  const title = cleanText(payload.title || '', MAX_TITLE);
  const body = cleanText(payload.body || '', MAX_BODY);
  if (!body) throw new Error('Scrie un conținut înainte de a salva.');
  const category = Object.prototype.hasOwnProperty.call(WALL_CATEGORIES, payload.category)
    ? payload.category
    : 'altele';
  const postitColor = WALL_COLORS.includes(payload.postit_color) ? payload.postit_color : WALL_COLORS[0];
  return {
    item_type: type,
    title,
    body,
    category,
    tags: cleanTags(payload.tags),
    is_important: Boolean(payload.is_important),
    on_board: type === 'postit' ? true : Boolean(payload.on_board),
    in_mindmap: Boolean(payload.in_mindmap),
    postit_color: postitColor,
  };
}

function mapIndex(rows = []) {
  return new Map((rows || []).map(row => [row.id, row]));
}

async function fetchRows(table, select, ids, extra = query => query) {
  if (!ids.length) return [];
  let query = supabase.from(table).select(select).in('id', ids);
  query = extra(query);
  const { data, error } = await query;
  if (error) {
    console.warn(`[PersonalWall] Nu am putut încărca ${table}:`, error.message);
    return [];
  }
  return data || [];
}

async function hydrateReferences(items) {
  const idsFor = type => items.filter(item => item.item_type === type).map(item => item.content_id).filter(Boolean);
  const groups = await Promise.all([
    fetchRows('questions', 'id, text, difficulty, source, chapter_id', idsFor('question'), q => q.eq('active', true)),
    fetchRows('flashcards', 'id, front, back, card_type, difficulty, source, deck_id, chapter_id', idsFor('flashcard'), q => q.eq('active', true)),
    fetchRows('exams', 'id, name, year, session, category, exam_date, faculty_id', idsFor('exam'), q => q.eq('is_published', true)),
    fetchRows('chemical_structures', 'id, name, iupac_name, formula, subject, chapter_id', idsFor('chemical_structure'), q => q.eq('active', true)),
    fetchRows('learning_lessons', 'id, title, description, module_id, estimated_minutes', idsFor('lesson'), q => q.eq('active', true)),
    fetchRows('submissions', 'id, exam_id, score, total, percentage, created_at', idsFor('submission')),
    fetchRows('user_day_events', 'id, day, name, event_type, notes, start_min, duration_min', idsFor('calendar_event')),
  ]);

  const typeMaps = {
    question: mapIndex(groups[0]),
    flashcard: mapIndex(groups[1]),
    exam: mapIndex(groups[2]),
    chemical_structure: mapIndex(groups[3]),
    lesson: mapIndex(groups[4]),
    submission: mapIndex(groups[5]),
    calendar_event: mapIndex(groups[6]),
  };

  const examIds = [
    ...groups[5].map(row => row.exam_id).filter(Boolean),
  ];
  const [faculties, sourceExams, chapters] = await Promise.all([
    fetchRows('faculties', 'id, name, city', [...new Set([...groups[2], ...groups[5]].map(row => row.faculty_id).filter(Boolean))]),
    fetchRows('exams', 'id, name, year, session, faculty_id', examIds),
    fetchRows('chapters', 'id, name, subject', [...new Set([...groups[0], ...groups[1], ...groups[3]].map(row => row.chapter_id).filter(Boolean))]),
  ]);
  const facultyMap = mapIndex(faculties);
  const examMap = mapIndex(sourceExams);
  const chapterMap = mapIndex(chapters);

  return items.map(item => {
    if (item.item_type === 'note' || item.item_type === 'postit') {
      return { ...item, display_title: item.title || (item.item_type === 'postit' ? 'Post-it fără titlu' : 'Notiță fără titlu'), preview: item.body };
    }
    const row = typeMaps[item.item_type]?.get(item.content_id);
    if (!row) return { ...item, display_title: 'Conținut indisponibil', preview: 'Materialul original nu mai este disponibil sau nu ai acces la el.', unavailable: true };

    const chapter = chapterMap.get(row.chapter_id);
    let displayTitle = '';
    let preview = '';

    switch (item.item_type) {
      case 'question':
        displayTitle = String(row.text || 'Grilă salvată').slice(0, 120);
        preview = [chapter?.name, row.source, row.difficulty].filter(Boolean).join(' · ');
        break;
      case 'flashcard':
        displayTitle = String(row.front || 'Flashcard salvat').slice(0, 120);
        preview = [chapter?.name, row.card_type, row.source].filter(Boolean).join(' · ');
        break;
      case 'exam': {
        const faculty = facultyMap.get(row.faculty_id);
        displayTitle = row.name || 'Examen salvat';
        preview = [faculty?.name, faculty?.city, row.year, row.session].filter(Boolean).join(' · ');
        break;
      }
      case 'chemical_structure':
        displayTitle = row.name || row.iupac_name || 'Structură chimică';
        preview = [row.formula, row.iupac_name, chapter?.name].filter(Boolean).join(' · ');
        break;
      case 'lesson':
        displayTitle = row.title || 'Lecție salvată';
        preview = [row.description, row.estimated_minutes ? `${row.estimated_minutes} min` : ''].filter(Boolean).join(' · ');
        break;
      case 'submission': {
        const exam = examMap.get(row.exam_id);
        const faculty = exam ? facultyMap.get(exam.faculty_id) : null;
        displayTitle = exam?.name || 'Rezultat de examen';
        preview = [`${row.score}/${row.total}`, `${Number(row.percentage || 0).toFixed(1)}%`, faculty?.name, row.created_at ? new Date(row.created_at).toLocaleDateString('ro-RO') : ''].filter(Boolean).join(' · ');
        break;
      }
      case 'calendar_event':
        displayTitle = row.name || 'Eveniment din calendar';
        preview = [row.day, row.event_type, row.notes].filter(Boolean).join(' · ');
        break;
      default:
        displayTitle = WALL_TYPES[item.item_type] || 'Material salvat';
        preview = '';
    }
    return { ...item, display_title: displayTitle, preview, content: row };
  });
}

export const PersonalWall = {
  async list({ type = 'all', category = 'all', search = '' } = {}) {
    const user = await currentUser();
    let query = supabase.from('personal_wall_items')
      .select('id, user_id, item_type, title, body, category, tags, is_important, content_id, source_page, in_mindmap, on_board, board_x, board_y, postit_color, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(MAX_ITEMS);
    if (type !== 'all' && Object.prototype.hasOwnProperty.call(WALL_TYPES, type)) query = query.eq('item_type', type);
    if (category !== 'all' && Object.prototype.hasOwnProperty.call(WALL_CATEGORIES, category)) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    let items = await hydrateReferences(data || []);
    const commentCounts = await this.commentCounts(items.map(item => item.id));
    items = items.map(item => ({ ...item, comment_count: commentCounts[item.id] || 0 }));
    const needle = String(search || '').trim().toLocaleLowerCase('ro');
    if (needle) {
      items = items.filter(item => [
        item.display_title, item.preview, item.body, item.tags?.join(' '),
        WALL_TYPES[item.item_type], WALL_CATEGORIES[item.category],
      ].join(' ').toLocaleLowerCase('ro').includes(needle));
    }
    return items;
  },

  async createText(payload, type = 'note', sourcePage = location.pathname) {
    const user = await currentUser();
    const item = validateTextItem(payload, type);
    const source = String(sourcePage || '').split('?')[0].slice(0, 120);
    let board_x = 24;
    let board_y = 24;
    if (item.on_board || type === 'postit') {
      const { count, error: countError } = await supabase.from('personal_wall_items')
        .select('id', { count:'exact', head:true })
        .eq('user_id', user.id)
        .eq('on_board', true);
      if (countError) throw countError;
      const columns = typeof window !== 'undefined' && window.innerWidth < 620 ? 1 : 2;
      const position = Number(count || 0);
      board_x = 20 + (position % columns) * 238;
      board_y = 20 + Math.floor(position / columns) * 182;
    }
    const { data, error } = await supabase.from('personal_wall_items')
      .insert({ user_id: user.id, ...item, board_x, board_y, source_page: source })
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, display_title: data.title || WALL_TYPES[type], preview: data.body };
  },

  async update(id, payload) {
    await currentUser();
    const title = cleanText(payload.title || '', MAX_TITLE);
    const body = cleanText(payload.body || '', MAX_BODY);
    if (!body) throw new Error('Conținutul nu poate fi gol.');
    const category = Object.prototype.hasOwnProperty.call(WALL_CATEGORIES, payload.category)
      ? payload.category
      : 'altele';
    const color = WALL_COLORS.includes(payload.postit_color) ? payload.postit_color : WALL_COLORS[0];
    const { data, error } = await supabase.from('personal_wall_items')
      .update({
        title, body, category, tags: cleanTags(payload.tags),
        is_important: Boolean(payload.is_important),
        in_mindmap: Boolean(payload.in_mindmap),
        on_board: Boolean(payload.on_board),
        postit_color: color,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, display_title: data.title || WALL_TYPES[data.item_type], preview: data.body };
  },

  async updateLayout(id, { board_x, board_y, postit_color, on_board, in_mindmap } = {}) {
    await currentUser();
    const update = {};
    if (Number.isFinite(board_x)) update.board_x = Math.max(0, Math.min(10000, Math.round(board_x)));
    if (Number.isFinite(board_y)) update.board_y = Math.max(0, Math.min(10000, Math.round(board_y)));
    if (on_board === true && !Number.isFinite(board_x) && !Number.isFinite(board_y)) {
      const user = await currentUser();
      const { count, error: countError } = await supabase.from('personal_wall_items')
        .select('id', { count:'exact', head:true })
        .eq('user_id', user.id)
        .eq('on_board', true);
      if (countError) throw countError;
      const columns = typeof window !== 'undefined' && window.innerWidth < 620 ? 1 : 2;
      const position = Number(count || 0);
      update.board_x = 20 + (position % columns) * 238;
      update.board_y = 20 + Math.floor(position / columns) * 182;
    }
    if (WALL_COLORS.includes(postit_color)) update.postit_color = postit_color;
    if (typeof on_board === 'boolean') update.on_board = on_board;
    if (typeof in_mindmap === 'boolean') update.in_mindmap = in_mindmap;
    const { data, error } = await supabase.from('personal_wall_items')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async toggleImportant(id, important) {
    await currentUser();
    const { data, error } = await supabase.from('personal_wall_items')
      .update({ is_important: Boolean(important) })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    await currentUser();
    const { error } = await supabase.from('personal_wall_items').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async saveReference(type, contentId, sourcePage = location.pathname, category = 'altele') {
    const user = await currentUser();
    if (!Object.prototype.hasOwnProperty.call(WALL_TYPES, type) || ['note', 'postit'].includes(type)) {
      throw new Error('Tipul de material nu este acceptat.');
    }
    if (!contentId) throw new Error('Nu am găsit identificatorul materialului.');
    const { data: existing, error: lookupError } = await supabase.from('personal_wall_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_type', type)
      .eq('content_id', contentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return { ...existing, alreadySaved: true };

    const safeCategory = Object.prototype.hasOwnProperty.call(WALL_CATEGORIES, category) ? category : 'altele';
    const { data, error } = await supabase.from('personal_wall_items')
      .insert({
        user_id: user.id,
        item_type: type,
        content_id: contentId,
        category: safeCategory,
        source_page: String(sourcePage || '').split('?')[0].slice(0, 120),
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        const { data: duplicate } = await supabase.from('personal_wall_items')
          .select('*').eq('user_id', user.id).eq('item_type', type).eq('content_id', contentId).maybeSingle();
        if (duplicate) return { ...duplicate, alreadySaved: true };
      }
      throw error;
    }
    return { ...data, alreadySaved: false };
  },

  async searchAvailable(type, search = '') {
    const user = await currentUser();
    const term = String(search || '').trim();
    const pattern = `%${term.replace(/[%_]/g, '\\$&')}%`;
    let query;
    let select;
    switch (type) {
      case 'question':
        query = supabase.from('questions').select('id, text, source, difficulty, chapter_id').eq('active', true).ilike('text', pattern).limit(30);
        break;
      case 'flashcard':
        query = supabase.from('flashcards').select('id, front, card_type, source, chapter_id').eq('active', true).ilike('front', pattern).limit(30);
        break;
      case 'exam':
        query = supabase.from('exams').select('id, name, year, session, category').eq('is_published', true).ilike('name', pattern).limit(30);
        break;
      case 'chemical_structure':
        query = supabase.from('chemical_structures').select('id, name, formula, iupac_name, subject').eq('active', true).ilike('name', pattern).limit(30);
        break;
      case 'lesson':
        query = supabase.from('learning_lessons').select('id, title, description, estimated_minutes').eq('active', true).ilike('title', pattern).limit(30);
        break;
      case 'submission':
        query = supabase.from('submissions').select('id, exam_id, score, total, percentage, created_at').eq('user_id', user.id).order('created_at', { ascending:false }).limit(30);
        break;
      case 'calendar_event':
        query = supabase.from('user_day_events').select('id, name, day, event_type, notes').eq('user_id', user.id).ilike('name', pattern).order('day', { ascending:false }).limit(30);
        break;
      default:
        throw new Error('Selectează un tip de material valid.');
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => {
      const title = row.text || row.front || row.name || row.title || 'Material salvat';
      const detail = row.source || row.formula || row.description || [
        row.year, row.session, row.day, row.percentage != null ? `${Number(row.percentage).toFixed(1)}%` : ''
      ].filter(Boolean).join(' · ');
      return { id: row.id, title: String(title).slice(0, 140), preview: detail || '' };
    });
  },

  async commentCounts(itemIds = []) {
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (!ids.length) return {};
    const counts = {};
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('personal_wall_comments')
        .select('id, item_id')
        .in('item_id', ids)
        .order('id', { ascending:true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      (data || []).forEach(row => { counts[row.item_id] = (counts[row.item_id] || 0) + 1; });
      if (!data || data.length < pageSize) break;
    }
    return counts;
  },

  async listComments(itemId) {
    await currentUser();
    const { data, error } = await supabase.from('personal_wall_comments')
      .select('id, item_id, user_id, body, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending:true })
      .limit(30);
    if (error) throw error;
    return data || [];
  },

  async addComment(itemId, body) {
    const user = await currentUser();
    const text = cleanText(body, 1000);
    if (!text) throw new Error('Comentariul nu poate fi gol.');
    const { data, error } = await supabase.from('personal_wall_comments')
      .insert({ item_id: itemId, user_id: user.id, body: text })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateComment(id, body) {
    await currentUser();
    const text = cleanText(body, 1000);
    if (!text) throw new Error('Comentariul nu poate fi gol.');
    const { data, error } = await supabase.from('personal_wall_comments')
      .update({ body: text })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async removeComment(id) {
    await currentUser();
    const { error } = await supabase.from('personal_wall_comments').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

