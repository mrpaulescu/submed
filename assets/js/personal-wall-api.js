import { supabase } from './supabase-client.js';

export const NOTE_CATEGORIES = {
  general: 'General',
  study: 'Studiu',
  idea: 'Idee',
  todo: 'De făcut',
  important: 'Important',
};

const MAX_TITLE = 80;
const MAX_BODY = 2000;

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Autentifică-te pentru a folosi peretele personal.');
  return data.user;
}

function validateNote({ title = '', body = '', category = 'general' } = {}) {
  const cleanTitle = String(title).trim();
  const cleanBody = String(body).trim();
  if (cleanTitle.length > MAX_TITLE) throw new Error(`Titlul poate avea maximum ${MAX_TITLE} de caractere.`);
  if (!cleanBody) throw new Error('Scrie un conținut pentru notiță.');
  if (cleanBody.length > MAX_BODY) throw new Error(`Notița poate avea maximum ${MAX_BODY} de caractere.`);
  if (!Object.prototype.hasOwnProperty.call(NOTE_CATEGORIES, category)) throw new Error('Categoria selectată nu este validă.');
  return { title: cleanTitle, body: cleanBody, category };
}

export const PersonalWall = {
  async list({ category = 'all' } = {}) {
    const user = await currentUser();
    let query = supabase.from('personal_notes')
      .select('id, title, body, category, source_page, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (category !== 'all' && Object.prototype.hasOwnProperty.call(NOTE_CATEGORIES, category)) {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload, sourcePage = '') {
    const user = await currentUser();
    const note = validateNote(payload);
    const source = String(sourcePage || '').split('?')[0].slice(0, 120);
    const { data, error } = await supabase.from('personal_notes')
      .insert({ user_id: user.id, ...note, source_page: source })
      .select('id, title, body, category, source_page, created_at, updated_at')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    await currentUser();
    const note = validateNote(payload);
    const { data, error } = await supabase.from('personal_notes')
      .update(note)
      .eq('id', id)
      .select('id, title, body, category, source_page, created_at, updated_at')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    await currentUser();
    const { error } = await supabase.from('personal_notes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

export async function openQuickNote({ sourcePage = location.pathname } = {}) {
  const existing = document.getElementById('submedQuickNote');
  if (!existing) return;
  const user = await currentUser().catch(() => null);
  if (!user) {
    const next = encodeURIComponent(location.pathname);
    location.href = `login.html?next=${next}`;
    return;
  }

  const form = existing.querySelector('form');
  const title = existing.querySelector('[name="title"]');
  const body = existing.querySelector('[name="body"]');
  const category = existing.querySelector('[name="category"]');
  const status = existing.querySelector('[data-note-status]');
  const counter = existing.querySelector('[data-note-counter]');
  const save = existing.querySelector('[type="submit"]');
  const close = () => { existing.hidden = true; document.body.classList.remove('note-modal-open'); };
  const updateCounter = () => { counter.textContent = `${body.value.length}/${MAX_BODY}`; };
  form.reset();
  category.value = 'general';
  status.textContent = '';
  updateCounter();
  existing.hidden = false;
  document.body.classList.add('note-modal-open');
  body.focus();

  existing.querySelectorAll('[data-note-close]').forEach(button => {
    button.onclick = close;
  });
  body.oninput = updateCounter;
  form.onsubmit = async event => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    status.textContent = 'Se salvează…';
    try {
      await PersonalWall.create({
        title: title.value,
        body: body.value,
        category: category.value,
      }, sourcePage);
      status.textContent = 'Notița a fost salvată pe peretele tău.';
      form.reset();
      category.value = 'general';
      updateCounter();
      setTimeout(close, 650);
    } catch (error) {
      status.textContent = error.message || 'Notița nu a putut fi salvată.';
    } finally {
      save.disabled = false;
    }
  };
};
