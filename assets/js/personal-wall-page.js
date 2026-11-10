import { Auth } from './auth.js?v=supabase-singleton-20261028';
import { PersonalWall, WALL_TYPES, WALL_CATEGORIES, WALL_COLORS } from './personal-wall-api.js?v=wall-second-brain-20261110';

const $ = id => document.getElementById(id);
const state = {
  items: [],
  view: 'db',
  category: 'all',
  importantOnly: false,
  sort: 'recent',
  activeItem: null,
  comments: [],
  dragging: null,
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[char]));
const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
const formatDate = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ro-RO', { day:'numeric', month:'short', year:'numeric' });
};
const safePage = value => {
  const page = String(value || '').replace(/^\//, '');
  return /^[a-z0-9_./-]+\.html(?:#[a-z0-9_-]+)?$/i.test(page) && !page.includes('..') ? page : '';
};
const itemCategory = item => WALL_CATEGORIES[item.category] || 'Altele';
const itemTitle = item => item.display_title || item.title || WALL_TYPES[item.item_type] || 'Element salvat';
const itemPreview = item => item.preview || item.body || '';
const isText = item => item.item_type === 'note' || item.item_type === 'postit';
const filteredItems = () => {
  const needle = $('wallSearch')?.value.trim().toLocaleLowerCase('ro') || '';
  let rows = state.items.filter(item =>
    (state.category === 'all' || item.category === state.category)
    && (!state.importantOnly || item.is_important)
    && (!needle || [itemTitle(item),itemPreview(item),item.body,(item.tags||[]).join(' '),WALL_TYPES[item.item_type]].join(' ').toLocaleLowerCase('ro').includes(needle))
  );
  if (state.sort === 'recent') rows.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
  if (state.sort === 'important') rows.sort((a,b) => Number(b.is_important) - Number(a.is_important) || new Date(b.updated_at) - new Date(a.updated_at));
  if (state.sort === 'az') rows.sort((a,b) => itemTitle(a).localeCompare(itemTitle(b), 'ro'));
  return rows;
};

function toast(message) {
  const el = $('wallToast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}

function renderStats() {
  const items = state.items;
  const important = items.filter(item => item.is_important).length;
  const refs = items.filter(item => !isText(item)).length;
  const comments = items.reduce((sum,item) => sum + (item.comment_count || 0), 0);
  const bytes = new Blob([JSON.stringify(items.map(item => ({
    item_type:item.item_type, title:item.title, body:item.body, category:item.category,
    tags:item.tags, content_id:item.content_id, source_page:item.source_page,
  }))) ]).size;
  $('wallStats').innerHTML = `
    <div class="stat-pill"><span class="stat-pill-label">Elemente salvate</span><div class="stat-pill-val">${items.length}</div><div class="stat-pill-sub">în peretele tău</div></div>
    <div class="stat-pill"><span class="stat-pill-label">Importante</span><div class="stat-pill-val">${important}</div><div class="stat-pill-sub">marcate cu stea</div></div>
    <div class="stat-pill"><span class="stat-pill-label">Comentarii</span><div class="stat-pill-val">${comments}</div><div class="stat-pill-sub">pe elementele salvate</div></div>
    <div class="stat-pill"><span class="stat-pill-label">Stocare estimată</span><div class="stat-pill-val">${formatBytes(bytes)}</div><div class="stat-pill-sub">${refs} referințe · fără fișiere atașate</div></div>`;
  $('countDb').textContent = items.length;
  $('countMap').textContent = items.filter(item => item.in_mindmap).length;
  $('countBoard').textContent = items.filter(item => item.on_board || item.item_type === 'postit').length;
  $('wallStorageLabel').textContent = `${formatBytes(bytes)} text și metadate`;
  $('wallStorageBar').style.width = `${Math.min(100, bytes / 400000 * 100)}%`;
  $('wallTextBytes').textContent = formatBytes(bytes);
  $('wallReferenceCount').textContent = String(refs);
  $('wallLimitInfo').textContent = `${items.length}/500 elemente`;
}

function renderFilters() {
  $('wallFilters').querySelectorAll('[data-category]').forEach(button => {
    button.classList.toggle('on', button.dataset.category === state.category);
  });
  $('wallImportant').classList.toggle('on', state.importantOnly);
  $('wallSort').value = state.sort;
}

function makeNode(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function renderDatabase() {
  const host = $('wallDatabase');
  const rows = filteredItems();
  host.replaceChildren();
  const header = document.createElement('div');
  header.className = 'db-head';
  ['','Element','Tip','Taguri','Com.','Origine'].forEach((label,index) => {
    const cell = makeNode('span', index === 5 ? 'h-origin' : index === 3 ? 'h-tags' : '', label);
    header.append(cell);
  });
  host.append(header);

  if (!rows.length) {
    const empty = makeNode('div','wall-empty-panel');
    const title = makeNode('h3','',state.items.length ? 'Nu există rezultate pentru filtrele alese' : 'Peretele tău începe aici');
    const desc = makeNode('p','',state.items.length
      ? 'Schimbă categoria, căutarea sau filtrul Important.'
      : 'Păstrează aici idei, post-it-uri și materiale din grile, flashcards și alte instrumente SubMed.');
    empty.append(title,desc);
    if (!state.items.length) {
      const button = makeNode('button','btn-primary','Adaugă primul element');
      button.type = 'button';
      button.dataset.wallCapture = '';
      empty.append(button);
    }
    host.append(empty);
    return;
  }

  rows.forEach(item => {
    const row = makeNode('div',`db-row${item.is_important ? ' important' : ''}`);
    row.dataset.action = 'open';
    row.dataset.id = item.id;

    const star = makeNode('button',`star-btn${item.is_important ? ' on' : ''}`,item.is_important ? '★' : '☆');
    star.type = 'button';
    star.title = item.is_important ? 'Scoate din importante' : 'Marchează ca importantă';
    star.dataset.action = 'star';
    star.dataset.id = item.id;

    const titleWrap = makeNode('div','wall-item-title');
    titleWrap.append(makeNode('b','',itemTitle(item)));
    titleWrap.append(makeNode('span','snip',itemPreview(item).slice(0,220)));
    const type = makeNode('span',`wall-type${isText(item) ? '' : ' reference'}`,WALL_TYPES[item.item_type] || 'Element');
    const tags = makeNode('div','wall-tags');
    (item.tags || []).slice(0,3).forEach(tag => tags.append(makeNode('span','wall-tag',`#${tag}`)));
    const comments = makeNode('span','wall-count',String(item.comment_count || 0));
    const origin = makeNode('span','wall-origin',item.source_page ? item.source_page.replace(/^\//,'').replace('.html','') : itemCategory(item));
    row.append(star,titleWrap,type,tags,comments,origin);
    host.append(row);
  });
}

function renderMindmap() {
  const host = $('wallMindmap');
  host.replaceChildren();
  const rows = state.items.filter(item => item.in_mindmap);
  const groups = Object.keys(WALL_CATEGORIES);
  if (!rows.length) {
    const empty = makeNode('div','wall-empty-panel');
    empty.append(
      makeNode('h3','','Mindmap-ul este gol'),
      makeNode('p','','Deschide un element și activează „Pe mindmap” ca să-l adaugi aici.')
    );
    host.append(empty);
    return;
  }
  const wrapper = makeNode('div','mindmap-groups');
  groups.forEach(category => {
    const groupItems = rows.filter(item => item.category === category);
    if (!groupItems.length) return;
    const branch = makeNode('div','mindmap-branch');
    const root = makeNode('div','mindmap-root',WALL_CATEGORIES[category]);
    branch.append(root);
    groupItems.forEach(item => {
      branch.append(makeNode('div','mindmap-line'));
      const button = makeNode('button',`mindmap-node${item.is_important ? ' important' : ''}`);
      button.type = 'button';
      button.dataset.action = 'open';
      button.dataset.id = item.id;
      button.append(makeNode('b','',itemTitle(item)));
      button.append(makeNode('small','',`${WALL_TYPES[item.item_type]} · ${item.comment_count || 0} comentarii`));
      branch.append(button);
    });
    wrapper.append(branch);
  });
  host.append(wrapper);
}

function renderBoard() {
  const board = $('wallBoard');
  board.replaceChildren();
  const rows = state.items.filter(item => item.on_board || item.item_type === 'postit');
  if (!rows.length) {
    const empty = makeNode('div','wall-empty-panel');
    empty.append(makeNode('h3','','Tabla ta este goală'),makeNode('p','','Creează un Post-it sau activează „Pe tabla Post-it” din detaliile unei notițe.'));
    board.append(empty);
    return;
  }
  const maxY = Math.max(0,...rows.map(item => Number(item.board_y) || 0));
  board.style.height = `${Math.max(620,maxY+220)}px`;
  rows.forEach(item => {
    const sticky = makeNode('article','wall-sticky');
    sticky.dataset.id = item.id;
    sticky.style.left = `${Number(item.board_x)||24}px`;
    sticky.style.top = `${Number(item.board_y)||24}px`;
    sticky.style.setProperty('--sticky-color', item.postit_color || WALL_COLORS[0]);

    const head = makeNode('div','wall-sticky-head');
    head.append(makeNode('span','wall-sticky-grip',''));
    const colors = makeNode('div','wall-sticky-colors');
    WALL_COLORS.forEach(color => {
      const button = makeNode('button');
      button.type = 'button';
      button.style.background = color;
      button.title = 'Schimbă culoarea';
      button.dataset.action = 'color';
      button.dataset.id = item.id;
      button.dataset.color = color;
      colors.append(button);
    });
    head.append(colors);
    const title = makeNode('button','wall-sticky-open',itemTitle(item));
    title.type = 'button';
    title.dataset.action = 'open';
    title.dataset.id = item.id;
    const body = makeNode('div','wall-sticky-text',item.body || itemPreview(item));
    const foot = makeNode('div','wall-sticky-foot',`${WALL_TYPES[item.item_type]} · ${itemCategory(item)}`);
    sticky.append(head,title,body,foot);
    board.append(sticky);
  });
  bindBoardDrag();
}

function bindBoardDrag() {
  const board = $('wallBoard');
  let drag = null;
  board.querySelectorAll('.wall-sticky-head').forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      const card = handle.closest('.wall-sticky');
      const item = state.items.find(row => row.id === card.dataset.id);
      if (!item) return;
      drag = {
        card,item,pointerId:event.pointerId,
        startX:event.clientX,startY:event.clientY,
        x:Number(item.board_x)||24,y:Number(item.board_y)||24,
      };
      card.classList.add('dragging');
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = board.getBoundingClientRect();
      const x = Math.max(0,Math.min(board.scrollWidth-216,drag.x + event.clientX-drag.startX));
      const y = Math.max(0,drag.y + event.clientY-drag.startY);
      drag.card.style.left = `${x}px`;
      drag.card.style.top = `${y}px`;
      drag.nextX = x; drag.nextY = y;
    });
    const finish = async event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const current = drag;
      drag = null;
      current.card.classList.remove('dragging');
      if (Number.isFinite(current.nextX) && Number.isFinite(current.nextY)) {
        current.item.board_x = Math.round(current.nextX);
        current.item.board_y = Math.round(current.nextY);
        try { await PersonalWall.updateLayout(current.item.id,{board_x:current.item.board_x,board_y:current.item.board_y}); }
        catch(error){ toast(error.message || 'Poziția nu a putut fi salvată.'); }
      }
    };
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
  });
}

function renderViews() {
  $('viewDb').hidden = state.view !== 'db';
  $('viewMap').hidden = state.view !== 'map';
  $('viewBoard').hidden = state.view !== 'board';
  $('wallViews').querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('on',active);
    button.setAttribute('aria-selected',String(active));
  });
  $('wallFilters').hidden = state.view !== 'db';
  document.querySelector('.wall-search').hidden = state.view !== 'db';
  if (state.view === 'db') renderDatabase();
  if (state.view === 'map') renderMindmap();
  if (state.view === 'board') renderBoard();
}

function render() {
  renderStats();
  renderFilters();
  renderViews();
}

function openDrawer(itemId) {
  const item = state.items.find(row => row.id === itemId);
  if (!item) return;
  state.activeItem = item;
  const drawer = $('wallDrawer');
  const editable = isText(item);
  const origin = safePage(item.source_page);
  drawer.innerHTML = `
    <div class="wd-top">
      <div><div class="wall-type ${editable ? '' : 'reference'}">${esc(WALL_TYPES[item.item_type])}</div><h3 style="margin-top:7px">${esc(itemCategory(item))}</h3></div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn danger" type="button" data-action="delete" title="Șterge">×</button>
        <button class="icon-btn" type="button" data-action="close" title="Închide">✕</button>
      </div>
    </div>
    <div class="wd-body">
      ${editable ? `
        <div class="wd-field"><label for="drawerTitle">Titlu</label><input class="wd-title" id="drawerTitle" maxlength="120" value="${esc(item.title)}" placeholder="Titlu"></div>
        <div class="wd-field"><label for="drawerBody">Conținut</label><textarea class="wd-body-text" id="drawerBody" maxlength="4000">${esc(item.body)}</textarea></div>
        <div class="wd-field"><label for="drawerTags">Taguri</label><input id="drawerTags" value="${esc((item.tags||[]).join(', '))}" placeholder="biologie, recapitulare"></div>
        <div class="wd-field"><label for="drawerCategory">Categorie</label><select id="drawerCategory">${Object.entries(WALL_CATEGORIES).map(([key,label])=>`<option value="${key}" ${item.category===key?'selected':''}>${label}</option>`).join('')}</select></div>
      ` : `
        <h2 class="wd-title">${esc(itemTitle(item))}</h2>
        <p class="wall-info">Materialul original rămâne în SubMed. Peretele păstrează doar referința către el.</p>
        <div class="wd-preview">${esc(itemPreview(item))}</div>
        ${origin ? `<p class="wall-info" style="margin-top:12px">Salvat din <a href="${esc(origin)}">${esc(origin.replace(/\.html.*/,''))}</a></p>` : ''}
      `}
      <div class="wd-row">
        <button type="button" class="wd-toggle star ${item.is_important?'on':''}" data-action="important">★ Importantă</button>
        <button type="button" class="wd-toggle ${item.in_mindmap?'on':''}" data-action="mindmap">Pe mindmap</button>
        <button type="button" class="wd-toggle ${item.on_board?'on':''}" data-action="board">Pe post-it</button>
      </div>
      <div class="wd-field"><label for="drawerColor">Culoare Post-it</label><select id="drawerColor">${WALL_COLORS.map((color,index)=>`<option value="${color}" ${item.postit_color===color?'selected':''}>Culoare ${index+1}</option>`).join('')}</select></div>
      <div class="wd-section">Comentarii <span>${item.comment_count||0}</span></div>
      <div class="wd-comments" id="drawerComments"><div class="db-empty">Se încarcă…</div></div>
      <div class="wd-comment-add"><textarea id="newWallComment" maxlength="1000" placeholder="Adaugă un comentariu…"></textarea><button class="btn-primary btn-sm" type="button" data-action="comment">Adaugă</button></div>
      <div class="wd-actions">
        <span class="wall-count">Creat ${formatDate(item.created_at)}</span>
        ${editable ? '<button class="btn-primary btn-sm" type="button" data-action="save">Salvează</button>' : '<button class="btn-secondary btn-sm" type="button" data-action="close">Închide</button>'}
      </div>
    </div>`;
  $('wallOverlay').classList.add('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  document.body.classList.add('note-modal-open');
  loadComments(item.id);
}

async function loadComments(itemId) {
  try {
    state.comments = await PersonalWall.listComments(itemId);
    if (state.activeItem?.id !== itemId) return;
    const host = $('drawerComments');
    host.replaceChildren();
    if (!state.comments.length) {
      host.append(makeNode('div','db-empty','Niciun comentariu încă.'));
      return;
    }
    state.comments.forEach(comment => {
      const card = makeNode('div','wd-comment');
      card.append(makeNode('p','',comment.body),makeNode('small','',formatDate(comment.created_at)));
      const del = makeNode('button','mini danger','Șterge');
      del.type='button'; del.dataset.action='delete-comment'; del.dataset.id=comment.id;
      card.append(del);host.append(card);
    });
  } catch(error) {
    $('drawerComments').textContent = error.message || 'Comentariile nu au putut fi încărcate.';
  }
}

function closeDrawer() {
  state.activeItem = null;
  state.comments = [];
  $('wallOverlay').classList.remove('open');
  $('wallDrawer').classList.remove('open');
  $('wallDrawer').setAttribute('aria-hidden','true');
  document.body.classList.remove('note-modal-open');
}

async function saveDrawer() {
  const item = state.activeItem;
  if (!item || !isText(item)) return;
  const payload = {
    title:$('drawerTitle').value,
    body:$('drawerBody').value,
    tags:$('drawerTags').value,
    category:$('drawerCategory').value,
    is_important:item.is_important,
    in_mindmap:item.in_mindmap,
    on_board:item.on_board,
    postit_color:$('drawerColor').value,
  };
  try {
    const saved = await PersonalWall.update(item.id,payload);
    Object.assign(item,saved,{display_title:saved.title || WALL_TYPES[saved.item_type],preview:saved.body});
    toast('Element actualizat.');
    closeDrawer();render();
  } catch(error) {
    toast(error.message || 'Modificările nu au putut fi salvate.');
  }
}

async function setItemFlag(item, field, value) {
  try {
    if (field === 'is_important') {
      await PersonalWall.toggleImportant(item.id,value);
      item.is_important = value;
    } else {
      await PersonalWall.updateLayout(item.id,{[field]:value});
      item[field] = value;
    }
    render();
    if (state.activeItem?.id === item.id) openDrawer(item.id);
  } catch(error) {
    toast(error.message || 'Modificarea nu a putut fi salvată.');
  }
}

function exportWall() {
  const payload = {
    exported_at:new Date().toISOString(),
    note:'Materialele SubMed sunt exportate ca referințe ID; conținutul original nu este duplicat.',
    items:state.items,
  };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url;link.download='submed-personal-wall.json';link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  const user = await Auth.getUser().catch(()=>null);
  if (!user) {
    location.href = `login.html?next=${encodeURIComponent('personal-wall.html')}`;
    return;
  }
  $('wallSearch').addEventListener('input',renderDatabase);
  $('wallSort').addEventListener('change',()=>{state.sort=$('wallSort').value;renderDatabase();});
  $('wallFilters').addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');
    if(button){state.category=button.dataset.category;renderFilters();renderDatabase();}
  });
  $('wallImportant').addEventListener('click',()=>{state.importantOnly=!state.importantOnly;renderFilters();renderDatabase();});
  $('wallViews').addEventListener('click',event=>{
    const button=event.target.closest('[data-view]');
    if(!button)return;
    state.view=button.dataset.view;renderViews();
  });
  $('wallExport').addEventListener('click',exportWall);
  $('wallExportSecondary').addEventListener('click',exportWall);
  $('wallOverlay').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');
    if(!button)return;
    const action=button.dataset.action;
    const id=button.dataset.id;
    if(action==='open'){openDrawer(id);return;}
    if(action==='close'){closeDrawer();return;}
    const item=state.items.find(row=>row.id===id) || state.activeItem;
    if(action==='star' && item){event.stopPropagation();await setItemFlag(item,'is_important',!item.is_important);return;}
    if(action==='color' && item){event.stopPropagation();await PersonalWall.updateLayout(item.id,{postit_color:button.dataset.color});item.postit_color=button.dataset.color;renderBoard();return;}
    if(action==='delete' && state.activeItem){
      if(!confirm('Ștergi definitiv acest element de pe peretele tău?'))return;
      try{await PersonalWall.remove(state.activeItem.id);state.items=state.items.filter(row=>row.id!==state.activeItem.id);closeDrawer();render();toast('Element șters.');}
      catch(error){toast(error.message||'Elementul nu a putut fi șters.');}
      return;
    }
    if(action==='important' && item){await setItemFlag(item,'is_important',!item.is_important);return;}
    if(action==='mindmap' && item){await setItemFlag(item,'in_mindmap',!item.in_mindmap);return;}
    if(action==='board' && item){await setItemFlag(item,'on_board',!item.on_board);return;}
    if(action==='save' ){await saveDrawer();return;}
    if(action==='comment' && state.activeItem){
      const field=$('newWallComment');
      try{
        const comment=await PersonalWall.addComment(state.activeItem.id,field.value);
        state.comments.push(comment);field.value='';
        state.activeItem.comment_count=(state.activeItem.comment_count||0)+1;
        $('drawerComments').append(makeCommentNode(comment));
        renderStats();
      }catch(error){toast(error.message||'Comentariul nu a putut fi salvat.');}
      return;
    }
    if(action==='delete-comment'){
      try{
        await PersonalWall.removeComment(id);
        state.comments=state.comments.filter(comment=>comment.id!==id);
        state.activeItem.comment_count=Math.max(0,(state.activeItem.comment_count||1)-1);
        loadComments(state.activeItem.id);renderStats();
      }catch(error){toast(error.message||'Comentariul nu a putut fi șters.');}
    }
  });
  try {
    state.items=await PersonalWall.list();
    render();
  } catch(error) {
    $('wallDatabase').innerHTML=`<div class="db-empty">${esc(error.message||'Peretele personal nu a putut fi încărcat. Verifică migrarea bazei de date.')}</div>`;
  }
}

function makeCommentNode(comment) {
  const card=makeNode('div','wd-comment');
  card.append(makeNode('p','',comment.body),makeNode('small','',formatDate(comment.created_at)));
  const del=makeNode('button','mini danger','Șterge');
  del.type='button';del.dataset.action='delete-comment';del.dataset.id=comment.id;
  card.append(del);return card;
}

init();
