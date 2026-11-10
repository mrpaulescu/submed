import { Auth } from './auth.js?v=supabase-singleton-20261028';
import { PersonalWall, WALL_TYPES, WALL_COLORS } from './personal-wall-api.js?v=wall-second-brain-20261110';

const ROOT_ID = 'submedWallCaptureRoot';
const MAX_BODY = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function markup() {
  return `
    <style id="submedWallCaptureStyles">
      #${ROOT_ID}{--sw-panel:var(--surface,#fff);--sw-line:var(--line,#dbe3f0);--sw-ink:var(--ink,#111b33);--sw-muted:var(--ink-3,#64708a);--sw-blue:var(--blue,#407bff);--sw-blue-soft:var(--blue-tint-2,#edf4ff);font-family:var(--font,"Plus Jakarta Sans",system-ui,sans-serif)}
      #submedWallFab{position:fixed;right:22px;bottom:22px;z-index:1120;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:10px 17px;border:1px solid rgba(255,255,255,.14);border-radius:100px;background:linear-gradient(135deg,var(--navy,#10234b),var(--navy-2,#1d3d79));color:#fff;font:700 .84rem var(--font,"Plus Jakarta Sans",sans-serif);box-shadow:0 9px 25px rgba(14,38,85,.25);cursor:pointer;transition:transform .18s,box-shadow .18s,background .18s}
      #submedWallFab:hover{transform:translateY(-2px);box-shadow:0 13px 30px rgba(14,38,85,.3)}
      #submedWallFab:focus-visible{outline:3px solid rgba(64,123,255,.35);outline-offset:3px}
      #submedWallFab .sw-fab-icon{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:rgba(255,255,255,.14);font-size:1.16rem;line-height:1;transition:transform .2s}
      #submedWallFab[aria-expanded="true"] .sw-fab-icon{transform:rotate(45deg)}
      #submedWallPopup[hidden],#submedWallPopup [hidden]{display:none!important}
      #submedWallPopup{position:fixed;right:22px;bottom:82px;z-index:1119;width:min(420px,calc(100vw - 28px));max-height:min(680px,calc(100vh - 118px));overflow:auto;overscroll-behavior:contain;background:var(--sw-panel);border:1px solid var(--sw-line);border-radius:19px;box-shadow:0 20px 55px rgba(15,35,75,.2),0 3px 12px rgba(15,35,75,.07);transform-origin:bottom right;animation:sw-pop-in .18s ease-out}
      @keyframes sw-pop-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      #submedWallPopup .sw-popup-head{padding:17px 18px 13px;background:linear-gradient(135deg,var(--surface-2,#f5f8fd),var(--surface,#fff));border-bottom:1px solid var(--sw-line)}
      #submedWallPopup .sw-head-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #submedWallPopup .sw-heading{display:flex;align-items:center;gap:10px;min-width:0}
      #submedWallPopup .sw-heading-icon{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:11px;background:var(--blue-tint,#eaf1ff);border:1px solid #d7e4ff;color:var(--blue-deep,#105aff);font-size:1.05rem}
      #submedWallPopup h2{margin:0;color:var(--sw-ink);font:800 1rem var(--font-display,"Sora",sans-serif);letter-spacing:-.02em}
      #submedWallPopup .sw-subtitle{margin:2px 0 0;color:var(--sw-muted);font-size:.72rem}
      #submedWallPopup .sw-mode-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:15px;padding:4px;background:var(--surface-2,#f4f7fc);border:1px solid var(--sw-line);border-radius:12px}
      #submedWallPopup .sw-mode-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;padding:8px 5px;border:0;border-radius:9px;background:transparent;color:var(--ink-2,#535f79);font:700 .74rem var(--font,"Plus Jakarta Sans",sans-serif);cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
      #submedWallPopup .sw-mode-tabs button[aria-selected="true"]{background:#fff;color:var(--blue-deep,#105aff);box-shadow:0 1px 5px rgba(16,45,100,.1)}
      #submedWallPopup .sw-mode-tabs button:focus-visible{outline:2px solid var(--sw-blue);outline-offset:2px}
      #submedWallPopup .sw-popup-body{padding:16px 18px 17px}
      #submedWallPopup .sw-pane[hidden]{display:none!important}
      #submedWallPopup .sw-field{margin:0 0 12px}
      #submedWallPopup .sw-field label{display:block;margin:0 0 6px;color:var(--sw-muted);font:700 .63rem var(--mono,"JetBrains Mono",monospace);letter-spacing:.08em;text-transform:uppercase}
      #submedWallPopup .sw-field input,#submedWallPopup .sw-field textarea,#submedWallPopup .sw-field select{display:block;width:100%;min-width:0;border:1.5px solid var(--sw-line);border-radius:10px;background:var(--surface-2,#f5f8fd);padding:10px 11px;color:var(--sw-ink);font:500 .84rem var(--font,"Plus Jakarta Sans",sans-serif);outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
      #submedWallPopup .sw-field textarea{min-height:116px;max-height:220px;resize:vertical;line-height:1.55}
      #submedWallPopup .sw-field input:focus,#submedWallPopup .sw-field textarea:focus,#submedWallPopup .sw-field select:focus{border-color:var(--sw-blue);background:#fff;box-shadow:0 0 0 3px rgba(45,110,255,.12)}
      #submedWallPopup .sw-title-input{font-weight:700!important}
      #submedWallPopup .sw-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;color:var(--sw-muted);font:500 .62rem var(--mono,"JetBrains Mono",monospace)}
      #submedWallPopup .sw-extra-toggle{display:inline-flex;align-items:center;gap:6px;padding:4px 0;border:0;background:transparent;color:var(--blue-deep,#105aff);font:700 .74rem var(--font,"Plus Jakarta Sans",sans-serif);cursor:pointer}
      #submedWallPopup .sw-extra-toggle .chevron{display:inline-block;transition:transform .16s}
      #submedWallPopup .sw-extra-toggle[aria-expanded="true"] .chevron{transform:rotate(180deg)}
      #submedWallPopup .sw-extra{padding-top:11px}
      #submedWallPopup .sw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #submedWallPopup .sw-checks{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin:3px 0 12px}
      #submedWallPopup .sw-checks label{display:inline-flex;align-items:center;gap:6px;margin:0;color:var(--ink-2,#535f79);font-size:.73rem;font-weight:600}
      #submedWallPopup .sw-checks input{accent-color:var(--sw-blue)}
      #submedWallPopup .sw-primary{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:39px;padding:9px 14px;border:0;border-radius:10px;background:var(--blue,#407bff);color:#fff;font:700 .78rem var(--font,"Plus Jakarta Sans",sans-serif);cursor:pointer;box-shadow:0 3px 9px rgba(45,110,255,.16);transition:transform .15s,background .15s}
      #submedWallPopup .sw-primary:hover{background:var(--blue-deep,#105aff);transform:translateY(-1px)}
      #submedWallPopup .sw-primary:disabled{opacity:.6;cursor:wait;transform:none}
      #submedWallPopup .sw-save-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--sw-line)}
      #submedWallPopup .sw-status{min-height:1.2em;color:var(--blue-deep,#105aff);font-size:.72rem;line-height:1.4}
      #submedWallPopup .sw-context{width:100%;display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;border:1px solid #d5e3ff;border-radius:11px;background:var(--blue-tint-2,#edf4ff);color:var(--blue-deep,#105aff);text-align:left;cursor:pointer}
      #submedWallPopup .sw-context[hidden]{display:none!important}
      #submedWallPopup .sw-context b{display:block;font-size:.77rem}
      #submedWallPopup .sw-context small{display:block;margin-top:2px;color:var(--ink-3,#64708a);font-size:.66rem}
      #submedWallPopup .sw-results{display:grid;gap:6px;max-height:215px;overflow:auto;margin-top:10px}
      #submedWallPopup .sw-result{width:100%;padding:9px 11px;border:1px solid var(--sw-line);border-radius:10px;background:var(--surface,#fff);text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
      #submedWallPopup .sw-result:hover{border-color:var(--sw-blue);background:var(--sw-blue-soft)}
      #submedWallPopup .sw-result:disabled{opacity:.6;cursor:wait}
      #submedWallPopup .sw-result b{display:block;color:var(--sw-ink);font-size:.77rem;line-height:1.4}
      #submedWallPopup .sw-result small{display:block;margin-top:3px;color:var(--sw-muted);font-size:.67rem;line-height:1.35}
      #submedWallPopup .sw-empty{padding:16px 10px;color:var(--sw-muted);font-size:.75rem;text-align:center}
      #submedWallPopup .sw-popup-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 18px 12px;border-top:1px solid var(--sw-line);color:var(--sw-muted);font:500 .6rem var(--mono,"JetBrains Mono",monospace)}
      @media(max-width:768px){
        #submedWallFab{right:14px;bottom:calc(88px + env(safe-area-inset-bottom));min-height:44px;padding:8px 13px}
        #submedWallPopup{right:14px;bottom:calc(143px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 28px));max-height:calc(100dvh - 165px - env(safe-area-inset-bottom));border-radius:16px}
      }
      @media(max-width:400px){#submedWallPopup .sw-popup-head{padding:14px 14px 11px}#submedWallPopup .sw-popup-body{padding:13px 14px}#submedWallPopup .sw-popup-foot{padding-inline:14px}#submedWallPopup .sw-mode-tabs button{font-size:.68rem}}
      @media(prefers-reduced-motion:reduce){#submedWallFab,#submedWallPopup *{transition:none!important;animation:none!important}}
    </style>

    <button id="submedWallFab" type="button" aria-expanded="false" aria-controls="submedWallPopup" aria-label="Deschide captura rapidă">
      <span class="sw-fab-icon" aria-hidden="true">＋</span><span class="sw-fab-label">Adaugă rapid</span>
    </button>

    <section id="submedWallPopup" role="dialog" aria-label="Captură rapidă" hidden>
      <div class="sw-popup-head">
        <div class="sw-head-top">
          <div class="sw-heading">
            <span class="sw-heading-icon" aria-hidden="true">✎</span>
            <div><h2>Adaugă pe peretele tău</h2><p class="sw-subtitle">Păstrează aici ce vrei să găsești ușor mai târziu.</p></div>
          </div>
        </div>
        <div class="sw-mode-tabs" role="tablist" aria-label="Tipul elementului">
          <button type="button" data-wall-mode="note" role="tab" aria-selected="true">✎ Notiță</button>
          <button type="button" data-wall-mode="postit" role="tab" aria-selected="false">▤ Post-it</button>
          <button type="button" data-wall-mode="resource" role="tab" aria-selected="false">⌕ Material</button>
        </div>
      </div>

      <div class="sw-popup-body">
        <form id="submedWallTextForm" class="sw-pane" data-wall-pane="text">
          <div class="sw-field"><label for="submedWallTitle">Titlu (opțional)</label><input class="sw-title-input" id="submedWallTitle" maxlength="120" placeholder="De exemplu: De repetat înainte de simulare"></div>
          <div class="sw-field">
            <label for="submedWallBody">Conținut</label>
            <textarea id="submedWallBody" maxlength="4000" required placeholder="Scrie aici ideea, explicația sau lucrul pe care vrei să-l reții…"></textarea>
            <div class="sw-meta"><span>Text simplu · maximum 4.000 caractere</span><span id="submedWallCounter">0/4000</span></div>
          </div>
          <button class="sw-extra-toggle" id="submedWallMoreToggle" type="button" aria-expanded="false" aria-controls="submedWallMore">Mai multe opțiuni <span class="chevron" aria-hidden="true">⌄</span></button>
          <div class="sw-extra" id="submedWallMore" hidden>
            <div class="sw-grid2">
              <div class="sw-field"><label for="submedWallCategory">Categorie</label><select id="submedWallCategory"><option value="biologie">Biologie</option><option value="chimie">Chimie</option><option value="altele" selected>Altele</option></select></div>
              <div class="sw-field"><label for="submedWallColor">Culoare Post-it</label><select id="submedWallColor">${WALL_COLORS.map((color,index) => '<option value="' + color + '">Culoare ' + (index + 1) + '</option>').join('')}</select></div>
            </div>
            <div class="sw-field"><label for="submedWallTags">Taguri</label><input id="submedWallTags" maxlength="400" placeholder="genetică, recapitulare"></div>
            <div class="sw-checks">
              <label><input type="checkbox" id="submedWallImportant"> Importantă</label>
              <label><input type="checkbox" id="submedWallMap"> În mindmap</label>
              <label id="submedWallBoardLabel"><input type="checkbox" id="submedWallBoard"> Pe tablă</label>
            </div>
          </div>
          <div class="sw-save-row"><span class="sw-status" id="submedWallTextStatus" role="status" aria-live="polite"></span><button class="sw-primary" id="submedWallSaveText" type="submit">Salvează notița ↗</button></div>
        </form>

        <div class="sw-pane" data-wall-pane="resource" hidden>
          <button class="sw-context" type="button" id="submedWallSaveContext" hidden><span aria-hidden="true">＋</span><span><b id="submedWallContextTitle">Salvează materialul deschis</b><small>Adaugă referința în peretele personal</small></span></button>
          <div class="sw-field"><label for="submedWallMaterialType">Tip material</label><select id="submedWallMaterialType">
            <option value="question">Grilă</option><option value="flashcard">Flashcard</option><option value="exam">Examen publicat</option><option value="chemical_structure">Structură chimică</option><option value="lesson">Lecție</option><option value="submission">Rezultat examen</option><option value="calendar_event">Eveniment din calendar</option>
          </select></div>
          <div class="sw-field"><label for="submedWallMaterialSearch">Caută materialul</label><input id="submedWallMaterialSearch" type="search" placeholder="Scrie câteva cuvinte din titlu sau enunț…"></div>
          <div class="sw-field"><label for="submedWallMaterialCategory">Categorie</label><select id="submedWallMaterialCategory"><option value="biologie">Biologie</option><option value="chimie">Chimie</option><option value="altele" selected>Altele</option></select></div>
          <div class="sw-status" id="submedWallPickerStatus" role="status" aria-live="polite"></div>
          <div class="sw-results" id="submedWallResults" aria-live="polite"></div>
        </div>
      </div>
      <div class="sw-popup-foot"><span>Salvare privată · contul tău SubMed</span><span>Esc pentru a închide</span></div>
    </section>`;
}

function notify(message) {
  let host = document.getElementById('submedWallCaptureToast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'submedWallCaptureToast';
    host.setAttribute('role', 'status');
    host.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translate(-50%,15px);z-index:2500;background:var(--navy,#10234b);color:#fff;border-radius:12px;padding:11px 15px;font:600 .82rem var(--font,"Plus Jakarta Sans",sans-serif);opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:calc(100vw - 30px);box-shadow:0 8px 24px rgba(11,30,77,.2);';
    document.body.append(host);
  }
  host.textContent = message;
  host.style.opacity = '1';
  host.style.transform = 'translate(-50%,0)';
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    host.style.opacity = '0';
    host.style.transform = 'translate(-50%,15px)';
  }, 2600);
}

function isValidContext(context = window.SubMedWallContext) {
  return Boolean(context && UUID_RE.test(String(context.id || '')) && ['question','flashcard'].includes(context.type));
}

function refreshContextOption() {
  const button = document.getElementById('submedWallSaveContext');
  if (!button) return;
  const context = window.SubMedWallContext;
  const valid = isValidContext(context);
  button.hidden = !valid;
  if (valid) {
    document.getElementById('submedWallContextTitle').textContent =
      context.type === 'question' ? 'Salvează grila curentă' : 'Salvează flashcard-ul curent';
  }
}

function setPopup(open, { focus = false } = {}) {
  const popup = document.getElementById('submedWallPopup');
  const fab = document.getElementById('submedWallFab');
  if (!popup || !fab) return;
  popup.hidden = !open;
  fab.setAttribute('aria-expanded', String(open));
  fab.setAttribute('aria-label', open ? 'Închide captura rapidă' : 'Deschide captura rapidă');
  fab.querySelector('.sw-fab-label').textContent = open ? 'Închide' : 'Adaugă rapid';
  if (open) {
    refreshContextOption();
    if (focus) {
      const activePane = popup.querySelector('[data-wall-pane="text"]:not([hidden])');
      (activePane?.querySelector('#submedWallBody') || popup.querySelector('#submedWallMaterialSearch'))?.focus();
    }
  }
}

function setMode(mode) {
  const popup = document.getElementById('submedWallPopup');
  if (!['note','postit','resource'].includes(mode)) return;
  popup.querySelectorAll('[data-wall-mode]').forEach(button => {
    button.setAttribute('aria-selected', String(button.dataset.wallMode === mode));
  });
  popup.querySelector('[data-wall-pane="text"]').hidden = mode === 'resource';
  popup.querySelector('[data-wall-pane="resource"]').hidden = mode !== 'resource';
  const save = document.getElementById('submedWallSaveText');
  save.textContent = mode === 'postit' ? 'Salvează Post-it ↗' : 'Salvează notița ↗';
  document.getElementById('submedWallBoardLabel').hidden = mode === 'postit';
  if (mode === 'postit') document.getElementById('submedWallBoard').checked = true;
  if (mode !== 'resource') document.getElementById('submedWallBody').focus();
  if (mode === 'resource') {
    refreshContextOption();
    loadPickerResults();
  }
  document.getElementById('submedWallTextForm').dataset.itemType = mode;
}

function closePopup() {
  setPopup(false);
}

async function saveContext() {
  const context = window.SubMedWallContext;
  if (!isValidContext(context)) {
    notify('Nu există un material compatibil deschis în această pagină.');
    return;
  }
  const button = document.getElementById('submedWallSaveContext');
  button.disabled = true;
  try {
    const result = await PersonalWall.saveReference(context.type, context.id, context.sourcePage || location.pathname, context.category || 'altele');
    notify(result.alreadySaved ? 'Materialul este deja salvat pe peretele tău.' : (WALL_TYPES[context.type] || 'Material') + ' salvat pe perete.');
    document.dispatchEvent(new CustomEvent('submed:wall-item-created', { detail: { item: result } }));
    closePopup();
  } catch (error) {
    notify(error.message || 'Materialul nu a putut fi salvat.');
  } finally {
    button.disabled = false;
  }
}

async function loadPickerResults() {
  const type = document.getElementById('submedWallMaterialType').value;
  const search = document.getElementById('submedWallMaterialSearch').value;
  const host = document.getElementById('submedWallResults');
  const status = document.getElementById('submedWallPickerStatus');
  const sequence = ++loadPickerResults.sequence;
  host.replaceChildren();
  if (!search.trim() && !['submission','calendar_event'].includes(type)) {
    status.textContent = 'Începe să scrii pentru a căuta materiale.';
    return;
  }
  status.textContent = 'Se caută…';
  try {
    const results = await PersonalWall.searchAvailable(type, search);
    if (sequence !== loadPickerResults.sequence) return;
    if (!results.length) {
      status.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'sw-empty';
      empty.textContent = 'Nu am găsit materiale pentru căutarea aceasta.';
      host.append(empty);
      return;
    }
    status.textContent = results.length + ' rezultate · selectează ce vrei să păstrezi';
    results.forEach(result => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sw-result';
      const title = document.createElement('b');
      title.textContent = result.title;
      const detail = document.createElement('small');
      detail.textContent = result.preview || WALL_TYPES[type] || '';
      button.append(title, detail);
      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Se salvează referința…';
        try {
          const category = document.getElementById('submedWallMaterialCategory').value;
          const saved = await PersonalWall.saveReference(type, result.id, location.pathname, category);
          notify(saved.alreadySaved ? 'Materialul este deja salvat.' : 'Material salvat pe perete.');
          document.dispatchEvent(new CustomEvent('submed:wall-item-created', { detail: { item: saved } }));
          closePopup();
        } catch (error) {
          status.textContent = error.message || 'Materialul nu a putut fi salvat.';
          button.disabled = false;
        }
      });
      host.append(button);
    });
  } catch (error) {
    if (sequence !== loadPickerResults.sequence) return;
    status.textContent = error.message || 'Nu am putut căuta materialele.';
  }
}
loadPickerResults.sequence = 0;

async function saveText(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.dataset.itemType === 'postit' ? 'postit' : 'note';
  const submit = document.getElementById('submedWallSaveText');
  const status = document.getElementById('submedWallTextStatus');
  if (submit.disabled) return;
  submit.disabled = true;
  status.textContent = 'Se salvează…';
  try {
    const item = await PersonalWall.createText({
      title: document.getElementById('submedWallTitle').value,
      body: document.getElementById('submedWallBody').value,
      category: document.getElementById('submedWallCategory').value,
      tags: document.getElementById('submedWallTags').value,
      postit_color: document.getElementById('submedWallColor').value,
      is_important: document.getElementById('submedWallImportant').checked,
      in_mindmap: document.getElementById('submedWallMap').checked,
      on_board: type === 'postit' || document.getElementById('submedWallBoard').checked,
    }, type, location.pathname);
    notify(type === 'postit' ? 'Post-it salvat pe tablă.' : 'Notiță salvată pe perete.');
    document.dispatchEvent(new CustomEvent('submed:wall-item-created', { detail: { item } }));
    form.reset();
    document.getElementById('submedWallCounter').textContent = '0/' + MAX_BODY;
    document.getElementById('submedWallMore').hidden = true;
    document.getElementById('submedWallMoreToggle').setAttribute('aria-expanded', 'false');
    setMode('note');
    closePopup();
  } catch (error) {
    status.textContent = error.message || 'Elementul nu a putut fi salvat.';
  } finally {
    submit.disabled = false;
  }
}

function bindEvents() {
  const root = document.getElementById(ROOT_ID);
  const fab = document.getElementById('submedWallFab');
  const popup = document.getElementById('submedWallPopup');

  fab.addEventListener('click', () => {
    const open = fab.getAttribute('aria-expanded') === 'true';
    setPopup(!open, { focus: !open });
  });

  popup.querySelectorAll('[data-wall-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.wallMode));
  });

  document.getElementById('submedWallTextForm').addEventListener('submit', saveText);
  document.getElementById('submedWallBody').addEventListener('input', event => {
    document.getElementById('submedWallCounter').textContent = event.target.value.length + '/' + MAX_BODY;
  });

  document.getElementById('submedWallMoreToggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    document.getElementById('submedWallMore').hidden = expanded;
  });

  document.getElementById('submedWallSaveContext').addEventListener('click', saveContext);
  document.getElementById('submedWallMaterialType').addEventListener('change', loadPickerResults);
  document.getElementById('submedWallMaterialSearch').addEventListener('input', () => {
    clearTimeout(loadPickerResults.timer);
    loadPickerResults.timer = setTimeout(loadPickerResults, 240);
  });

  document.addEventListener('click', event => {
    const captureTrigger = event.target.closest('[data-wall-capture]');
    if (captureTrigger) {
      event.preventDefault();
      setPopup(true);
      const requestedMode = captureTrigger.dataset.wallType === 'postit' ? 'postit' : 'note';
      setMode(requestedMode);
      return;
    }
    if (!root.contains(event.target) && fab.getAttribute('aria-expanded') === 'true') closePopup();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fab.getAttribute('aria-expanded') === 'true') {
      closePopup();
      fab.focus();
    }
  });
}

export async function initPersonalWallQuickNote() {
  if (document.getElementById('submedWallFab') || !document.body) return;
  const user = await Auth.getUser().catch(() => null);
  if (!user) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="' + ROOT_ID + '">' + markup() + '</div>');
  bindEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initPersonalWallQuickNote(), { once: true });
} else {
  initPersonalWallQuickNote();
}
