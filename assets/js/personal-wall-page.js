import { Auth } from './auth.js?v=supabase-singleton-20261028';
import { PersonalWall, NOTE_CATEGORIES } from './personal-wall-api.js';

const $ = id => document.getElementById(id);
const grid = $('wallGrid');
const editor = $('wallEditor');
const form = $('wallForm');
const search = $('wallSearch');
let notes = [];
let activeCategory = 'all';
let editingId = null;

function setStatus(message, error = false) {
  $('wallStatus').textContent = message;
  $('wallStatus').style.color = error ? 'var(--red)' : 'var(--blue-deep)';
}

function openEditor(note = null) {
  editingId = note?.id || null;
  $('wallEditorTitle').textContent = note ? 'Editează notița' : 'Notiță nouă';
  $('wallSave').textContent = note ? 'Salvează modificările' : 'Salvează notița';
  $('wallTitle').value = note?.title || '';
  $('wallBody').value = note?.body || '';
  $('wallCategory').value = note?.category || 'general';
  $('wallChars').textContent = `${$('wallBody').value.length}/2000`;
  setStatus('');
  editor.hidden = false;
  document.body.classList.add('note-modal-open');
  $('wallBody').focus();
}

function closeEditor() {
  editor.hidden = true;
  document.body.classList.remove('note-modal-open');
  editingId = null;
}

function makeAction(label, callback) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-action';
  button.textContent = label;
  button.addEventListener('click', callback);
  return button;
}

function makeNoteCard(note) {
  const card = document.createElement('article');
  card.className = `note-card cat-${note.category}`;

  const top = document.createElement('div');
  top.className = 'note-top';
  const cat = document.createElement('span');
  cat.className = 'note-cat';
  cat.textContent = NOTE_CATEGORIES[note.category] || NOTE_CATEGORIES.general;
  const date = document.createElement('time');
  date.className = 'note-date';
  const stamp = new Date(note.updated_at || note.created_at);
  date.dateTime = stamp.toISOString();
  date.textContent = stamp.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  top.append(cat, date);

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.textContent = note.title || 'Notiță fără titlu';

  const body = document.createElement('p');
  body.className = 'note-body';
  body.textContent = note.body;

  const footer = document.createElement('div');
  footer.className = 'note-foot';
  let sourceNode = document.createElement('span');
  sourceNode.className = 'note-source';
  const safeSource = String(note.source_page || '');
  if (safeSource && /^\\/?[a-z0-9_./-]+\\.html$/i.test(safeSource.replace(/^\\//, ''))) {
    const link = document.createElement('a');
    link.href = safeSource;
    link.className = 'note-source';
    link.textContent = safeSource.replace(/^\\//, '').replace('.html', '');
    sourceNode = link;
  } else {
    sourceNode.textContent = 'Notiță personală';
  }
  const actions = document.createElement('div');
  actions.className = 'note-actions';
  actions.append(
    makeAction('Editează', () => openEditor(note)),
    makeAction('Șterge', async () => {
      if (!confirm('Ștergi definitiv această notiță?')) return;
      try {
        await PersonalWall.remove(note.id);
        notes = notes.filter(item => item.id !== note.id);
        render();
      } catch (error) {
        alert(error.message || 'Notița nu a putut fi ștearsă.');
      }
    }),
  );
  footer.append(sourceNode, actions);
  card.append(top);
  if (note.title) card.append(title);
  card.append(body, footer);
  return card;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('ro');
  const filtered = notes.filter(note => {
    const matchesCategory = activeCategory === 'all' || note.category === activeCategory;
    const text = `${note.title || ''} ${note.body || ''} ${NOTE_CATEGORIES[note.category] || ''}`.toLocaleLowerCase('ro');
    return matchesCategory && (!query || text.includes(query));
  });
  $('wallCount').textContent = `${filtered.length} din ${notes.length} notițe · maximum 200 pentru fiecare cont`;
  grid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'wall-empty';
    const icon = document.createElement('div');
    icon.className = 'empty-ic';
    icon.textContent = notes.length ? '⌕' : '✎';
    const title = document.createElement('h3');
    title.textContent = notes.length ? 'Nu am găsit notițe' : 'Peretele tău începe aici';
    const desc = document.createElement('p');
    desc.textContent = notes.length
      ? 'Încearcă alt termen sau schimbă filtrul de categorie.'
      : 'Adaugă o idee, o observație dintr-o lecție sau un lucru pe care vrei să-l reții.';
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'btn-primary';
    cta.textContent = '＋ Creează prima notiță';
    cta.addEventListener('click', () => openEditor());
    empty.append(icon, title, desc);
    if (!notes.length) empty.append(cta);
    grid.append(empty);
    return;
  }
  filtered.forEach(note => grid.append(makeNoteCard(note)));
}

async function loadNotes() {
  grid.innerHTML = '<div class="wall-empty">Se încarcă notițele…</div>';
  try {
    notes = await PersonalWall.list();
    render();
  } catch (error) {
    grid.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'wall-empty';
    const title = document.createElement('h3');
    title.textContent = 'Nu am putut încărca peretele';
    const desc = document.createElement('p');
    desc.textContent = error.message || 'Verifică autentificarea și încearcă din nou.';
    empty.append(title, desc);
    grid.append(empty);
    $('wallCount').textContent = 'Eroare la încărcare';
  }
}

async function init() {
  const user = await Auth.getUser().catch(() => null);
  if (!user) {
    location.href = `login.html?next=${encodeURIComponent('personal-wall.html')}`;
    return;
  }

  $('wallCreate').addEventListener('click', () => openEditor());
  $('wallClose').addEventListener('click', closeEditor);
  $('wallCancel').addEventListener('click', closeEditor);
  editor.addEventListener('click', event => { if (event.target === editor) closeEditor(); });
  search.addEventListener('input', render);
  $('wallBody').addEventListener('input', () => {
    $('wallChars').textContent = `${$('wallBody').value.length}/2000`;
  });
  $('wallFilters').addEventListener('click', event => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    $('wallFilters').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    render();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !editor.hidden) closeEditor();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const save = $('wallSave');
    if (save.disabled) return;
    save.disabled = true;
    setStatus('Se salvează…');
    const payload = {
      title: $('wallTitle').value,
      body: $('wallBody').value,
      category: $('wallCategory').value,
    };
    try {
      const saved = editingId
        ? await PersonalWall.update(editingId, payload)
        : await PersonalWall.create(payload, location.pathname);
      const index = notes.findIndex(note => note.id === saved.id);
      if (index >= 0) notes[index] = saved;
      else notes.unshift(saved);
      closeEditor();
      render();
    } catch (error) {
      setStatus(error.message || 'Notița nu a putut fi salvată.', true);
    } finally {
      save.disabled = false;
    }
  });

  await loadNotes();
}

init();
