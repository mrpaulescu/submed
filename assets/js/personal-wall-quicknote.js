import { Auth } from './auth.js?v=supabase-singleton-20261028';
import { PersonalWall, WALL_TYPES, WALL_CATEGORIES, WALL_COLORS } from './personal-wall-api.js?v=wall-second-brain-20261110';

const WIDGET_ID = 'submedWallCaptureRoot';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[ch]));
const uuidLike = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

function markup() {
  return `
    <style id="submedWallCaptureStyles">
      #submedWallFab{position:fixed;right:22px;bottom:22px;z-index:1100;display:flex;align-items:center;gap:9px;padding:13px 18px;border:0;border-radius:100px;background:var(--navy,#10234b);color:#fff;font:700 .86rem var(--font,'Plus Jakarta Sans',system-ui,sans-serif);box-shadow:var(--shadow-lg,0 10px 28px rgba(15,35,75,.24));cursor:pointer;transition:transform .15s,background .15s}
      #submedWallFab:hover{background:var(--navy-2,#1a376f);transform:translateY(-2px)}
      #submedWallFab .sw-plus{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.15);font-size:1.1rem;line-height:1}
      #submedWallMenu[hidden],#submedWallTextDialog[hidden],#submedWallPickerDialog[hidden]{display:none!important}
      #submedWallMenu{position:fixed;right:22px;bottom:78px;z-index:1110;width:min(300px,calc(100vw - 28px));padding:7px;background:var(--surface,#fff);border:1px solid var(--line,#dbe3f0);border-radius:15px;box-shadow:var(--shadow-lg,0 12px 34px rgba(15,35,75,.2))}
      #submedWallMenu .sw-menu-label{padding:8px 10px 7px;color:var(--ink-3,#64708a);font:700 .63rem var(--mono,'JetBrains Mono',monospace);letter-spacing:.1em;text-transform:uppercase}
      #submedWallMenu button{display:flex;width:100%;align-items:center;gap:11px;border:0;border-radius:10px;background:transparent;padding:11px 10px;color:var(--ink,#111b33);text-align:left;font:600 .84rem var(--font,'Plus Jakarta Sans',sans-serif);cursor:pointer}
      #submedWallMenu button:hover{background:var(--blue-tint-2,#edf4ff);color:var(--blue-deep,#105aff)}
      #submedWallMenu button[hidden]{display:none!important}
      #submedWallMenu .sw-menu-icon{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line,#dbe3f0);border-radius:9px;background:var(--surface-2,#f5f8fd);color:var(--blue-deep,#105aff);font-size:.95rem;flex:none}
      #submedWallMenu .sw-menu-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
      #submedWallMenu small{color:var(--ink-3,#64708a);font-size:.7rem;font-weight:500}
      #submedWallCaptureRoot .sw-dialog-overlay{position:fixed;inset:0;z-index:2400;background:rgba(11,30,77,.42);backdrop-filter:blur(2px);display:grid;place-items:center;padding:18px}
      #submedWallCaptureRoot .sw-dialog{width:min(540px,100%);max-height:calc(100vh - 36px);overflow:auto;background:var(--surface,#fff);border:1px solid var(--line,#dbe3f0);border-radius:18px;box-shadow:var(--shadow-lg,0 20px 48px rgba(11,30,77,.2))}
      #submedWallCaptureRoot .sw-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px;border-bottom:1px solid var(--line,#dbe3f0);background:var(--surface-2,#f5f8fd)}
      #submedWallCaptureRoot .sw-dialog-head h3{margin:0;font:700 1rem var(--font-display,'Sora',sans-serif);color:var(--ink,#111b33)}
      #submedWallCaptureRoot .sw-dialog-body{padding:18px 20px 20px}
      #submedWallCaptureRoot .sw-field{margin-bottom:13px}
      #submedWallCaptureRoot .sw-field label{display:block;margin:0 0 6px;color:var(--ink-3,#64708a);font:700 .65rem var(--mono,'JetBrains Mono',monospace);letter-spacing:.08em;text-transform:uppercase}
      #submedWallCaptureRoot .sw-field input,#submedWallCaptureRoot .sw-field textarea,#submedWallCaptureRoot .sw-field select{width:100%;border:1.5px solid var(--line,#dbe3f0);border-radius:10px;background:var(--surface-2,#f5f8fd);padding:10px 12px;color:var(--ink,#111b33);font:500 .86rem var(--font,'Plus Jakarta Sans',sans-serif);outline:none}
      #submedWallCaptureRoot .sw-field textarea{min-height:125px;resize:vertical;line-height:1.55}
      #submedWallCaptureRoot .sw-field input:focus,#submedWallCaptureRoot .sw-field textarea:focus,#submedWallCaptureRoot .sw-field select:focus{border-color:var(--blue,#2d6eff);background:#fff;box-shadow:0 0 0 3px rgba(45,110,255,.13)}
      #submedWallCaptureRoot .sw-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #submedWallCaptureRoot .sw-checks{display:flex;gap:16px;flex-wrap:wrap;margin:5px 0 14px}
      #submedWallCaptureRoot .sw-checks label{display:flex;align-items:center;gap:7px;color:var(--ink-2,#535f79);font-size:.78rem;font-weight:600}
      #submedWallCaptureRoot .sw-dialog-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}
      #submedWallCaptureRoot .sw-status{min-height:1.25em;color:var(--blue-deep,#105aff);font-size:.78rem}
      #submedWallCaptureRoot .sw-results{display:grid;gap:7px;max-height:280px;overflow:auto;margin-top:12px}
      #submedWallCaptureRoot .sw-result{width:100%;border:1px solid var(--line,#dbe3f0);border-radius:10px;background:var(--surface);padding:10px 12px;text-align:left;cursor:pointer}
      #submedWallCaptureRoot .sw-result:hover{border-color:var(--blue,#2d6eff);background:var(--blue-tint-2,#edf4ff)}
      #submedWallCaptureRoot .sw-result b{display:block;color:var(--ink,#111b33);font-size:.82rem}
      #submedWallCaptureRoot .sw-result small{display:block;margin-top:3px;color:var(--ink-3,#64708a);font-size:.7rem}
      #submedWallCaptureRoot .sw-note-meta{display:flex;justify-content:space-between;gap:10px;color:var(--ink-3,#64708a);font:.65rem var(--mono,'JetBrains Mono',monospace);margin-top:-7px}
      body.note-modal-open{overflow:hidden}
      @media(max-width:768px){#submedWallFab{right:14px;bottom:calc(88px + env(safe-area-inset-bottom));padding:11px 15px}#submedWallMenu{right:14px;bottom:calc(144px + env(safe-area-inset-bottom))}#submedWallCaptureRoot .sw-dialog-overlay{align-items:end;padding:9px}#submedWallCaptureRoot .sw-dialog{max-height:calc(100vh - 18px);border-radius:16px}#submedWallCaptureRoot .sw-two{grid-template-columns:1fr}}
    </style>
    <button id="submedWallFab" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="submedWallMenu">
      <span class="sw-plus">＋</span><span>Salvează pe perete</span>
    </button>
    <div id="submedWallMenu" role="menu" hidden>
      <div class="sw-menu-label">Captură rapidă</div>
      <button type="button" data-wall-menu="note" role="menuitem"><span class="sw-menu-icon">✎</span><span class="sw-menu-copy">Notiță text<small>Idee, explicație sau observație</small></span></button>
      <button type="button" data-wall-menu="postit" role="menuitem"><span class="sw-menu-icon">▤</span><span class="sw-menu-copy">Post-it<small>Un mesaj scurt pe tabla ta</small></span></button>
      <button type="button" data-wall-menu="context" id="submedWallContextAction" role="menuitem" hidden><span class="sw-menu-icon">✓</span><span class="sw-menu-copy"><span id="submedWallContextTitle">Salvează elementul curent</span><small>Doar referința către materialul deschis</small></span></button>
      <button type="button" data-wall-menu="picker" role="menuitem"><span class="sw-menu-icon">⌕</span><span class="sw-menu-copy">Alt material SubMed<small>Caută grile, flashcards, examene și lecții</small></span></button>
    </div>

    <div class="sw-dialog-overlay" id="submedWallTextDialog" hidden>
      <section class="sw-dialog" role="dialog" aria-modal="true" aria-labelledby="submedWallTextTitle">
        <div class="sw-dialog-head"><h3 id="submedWallTextTitle">Notiță nouă</h3><button class="icon-btn" type="button" data-wall-close aria-label="Închide">×</button></div>
        <div class="sw-dialog-body">
          <form id="submedWallTextForm">
            <div class="sw-field"><label for="submedWallTitle">Titlu</label><input id="submedWallTitle" maxlength="120" placeholder="Un titlu scurt"></div>
            <div class="sw-field" data-wall-text-field><label for="submedWallBody">Conținut</label><textarea id="submedWallBody" maxlength="4000" required placeholder="Scrie aici ce vrei să păstrezi…"></textarea><div class="sw-note-meta"><span>Text simplu · fără atașamente</span><span id="submedWallCounter">0/4000</span></div></div>
            <div class="sw-two">
              <div class="sw-field"><label for="submedWallCategory">Categorie</label><select id="submedWallCategory"><option value="biologie">Biologie</option><option value="chimie">Chimie</option><option value="altele" selected>Altele</option></select></div>
              <div class="sw-field"><label for="submedWallTags">Taguri</label><input id="submedWallTags" maxlength="400" placeholder="genetică, recapitulare"></div>
            </div>
            <div class="sw-two" id="submedWallPostitSettings" hidden>
              <div class="sw-field"><label for="submedWallColor">Culoare Post-it</label><select id="submedWallColor">${WALL_COLORS.map((color,index)=>`<option value="${color}">Culoare ${index+1}</option>`).join('')}</select></div>
              <div class="sw-field"><label>Post-it</label><div class="sw-note-meta" style="margin:0">Va apărea automat pe tabla Post-it.</div></div>
            </div>
            <div class="sw-checks"><label><input type="checkbox" id="submedWallImportant"> Importantă</label><label><input type="checkbox" id="submedWallMap"> Include în mindmap</label><label id="submedWallBoardLabel"><input type="checkbox" id="submedWallBoard"> Include pe tabla Post-it</label></div>
            <div class="sw-status" id="submedWallTextStatus" role="status" aria-live="polite"></div>
            <div class="sw-dialog-actions"><button class="btn-secondary btn-sm" type="button" data-wall-close>Anulează</button><button class="btn-primary btn-sm" type="submit">Salvează pe perete</button></div>
          </form>
        </div>
      </section>
    </div>

    <div class="sw-dialog-overlay" id="submedWallPickerDialog" hidden>
      <section class="sw-dialog" role="dialog" aria-modal="true" aria-labelledby="submedWallPickerTitle">
        <div class="sw-dialog-head"><h3 id="submedWallPickerTitle">Salvează un material SubMed</h3><button class="icon-btn" type="button" data-wall-close aria-label="Închide">×</button></div>
        <div class="sw-dialog-body">
          <div class="sw-field"><label for="submedWallMaterialType">Tip material</label><select id="submedWallMaterialType">
            <option value="question">Grilă</option><option value="flashcard">Flashcard</option><option value="exam">Examen publicat</option><option value="chemical_structure">Structură chimică</option><option value="lesson">Lecție</option><option value="submission">Rezultat examen</option><option value="calendar_event">Eveniment din calendar</option>
          </select></div>
          <div class="sw-field"><label for="submedWallMaterialSearch">Caută materialul</label><input id="submedWallMaterialSearch" type="search" placeholder="Scrie câteva cuvinte…"></div>
          <div class="sw-field"><label for="submedWallMaterialCategory">Categorie</label><select id="submedWallMaterialCategory"><option value="biologie">Biologie</option><option value="chimie">Chimie</option><option value="altele" selected>Altele</option></select></div>
          <div class="sw-status" id="submedWallPickerStatus" role="status" aria-live="polite"></div>
          <div class="sw-results" id="submedWallResults"></div>
          <div class="sw-dialog-actions"><button class="btn-secondary btn-sm" type="button" data-wall-close>Închide</button></div>
        </div>
      </section>
    </div>`;
}

function refreshContextOption() {
  const button = document.getElementById('submedWallContextAction');
  const label = document.getElementById('submedWallContextTitle');
  const context = window.SubMedWallContext;
  const valid = context && uuidLike(context.id) && ['question','flashcard'].includes(context.type);
  button.hidden = !valid;
  if (valid) label.textContent = context.type === 'question' ? 'Salvează grila curentă' : 'Salvează flashcard-ul curent';
}

function notify(message) {
  let host = document.getElementById('submedWallCaptureToast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'submedWallCaptureToast';
    host.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translate(-50%,15px);z-index:2500;background:var(--navy,#10234b);color:#fff;border-radius:12px;padding:11px 15px;font:600 .82rem var(--font,\'Plus Jakarta Sans\',sans-serif);opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:calc(100vw - 30px);';
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

function setMenu(open) {
  const menu = document.getElementById('submedWallMenu');
  const button = document.getElementById('submedWallFab');
  menu.hidden = !open;
  button.setAttribute('aria-expanded',String(open));
}

function closeDialogs() {
  document.querySelectorAll('#submedWallCaptureRoot .sw-dialog-overlay').forEach(dialog => { dialog.hidden = true; });
  setMenu(false);
  document.body.classList.remove('note-modal-open');
}

function openTextDialog(type = 'note') {
  const dialog = document.getElementById('submedWallTextDialog');
  const form = document.getElementById('submedWallTextForm');
  form.reset();
  form.dataset.itemType = type;
  const isPostit = type === 'postit';
  document.getElementById('submedWallTextTitle').textContent = isPostit ? 'Post-it nou' : 'Notiță nouă';
  document.getElementById('submedWallPostitSettings').hidden = !isPostit;
  document.getElementById('submedWallBoardLabel').hidden = isPostit;
  document.getElementById('submedWallBoard').checked = isPostit;
  document.getElementById('submedWallTextStatus').textContent = '';
  document.getElementById('submedWallCounter').textContent = '0/4000';
  dialog.hidden = false;
  document.body.classList.add('note-modal-open');
  document.getElementById('submedWallBody').focus();
}

async function saveCurrentContext() {
  const context = window.SubMedWallContext;
  if (!context || !uuidLike(context.id)) {
    notify('Nu există un material SubMed compatibil deschis în această pagină.');
    return;
  }
  const statusType = context.type;
  try {
    const result = await PersonalWall.saveReference(statusType,context.id,context.sourcePage || location.pathname,context.category || 'altele');
    closeDialogs();
    notify(result.alreadySaved ? 'Materialul este deja pe peretele tău.' : `${WALL_TYPES[statusType] || 'Material'} salvat pe perete.`);
  } catch(error) {
    toast(error.message || 'Materialul nu a putut fi salvat.');
  }
}

async function loadPickerResults() {
  const type = document.getElementById('submedWallMaterialType').value;
  const search = document.getElementById('submedWallMaterialSearch').value;
  const host = document.getElementById('submedWallResults');
  const status = document.getElementById('submedWallPickerStatus');
  const seq = ++loadPickerResults.seq;
  host.replaceChildren();
  status.textContent = 'Se caută…';
  try {
    const results = await PersonalWall.searchAvailable(type,search);
    if(seq !== loadPickerResults.seq) return;
    status.textContent = results.length ? `${results.length} rezultate · selectează ce vrei să salvezi` : 'Nu am găsit materiale pentru căutarea aceasta.';
    results.forEach(result => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sw-result';
      const title = document.createElement('b');
      title.textContent = result.title;
      const preview = document.createElement('small');
      preview.textContent = result.preview || WALL_TYPES[type];
      button.append(title,preview);
      button.addEventListener('click',async()=>{
        button.disabled=true;
        status.textContent='Se salvează referința…';
        try{
          const category=document.getElementById('submedWallMaterialCategory').value;
          const saved=await PersonalWall.saveReference(type,result.id,location.pathname,category);
          closeDialogs();
          notify(saved.alreadySaved?'Materialul este deja salvat.':'Material salvat pe perete.');
        }catch(error){
          status.textContent=error.message||'Nu am putut salva materialul.';
          button.disabled=false;
        }
      });
      host.append(button);
    });
  } catch(error) {
    if(seq !== loadPickerResults.seq) return;
    status.textContent=error.message || 'Nu am putut căuta materialele.';
  }
}
loadPickerResults.seq=0;

function initCaptureEvents() {
  const root = document.getElementById(WIDGET_ID);
  const fab = document.getElementById('submedWallFab');
  fab.addEventListener('click',()=>{
    refreshContextOption();
    setMenu(document.getElementById('submedWallMenu').hidden);
  });

  document.addEventListener('click',event=>{
    const capture = event.target.closest('[data-wall-capture]');
    if(capture){
      event.preventDefault();
      setMenu(false);
      const type = capture.dataset.wallType;
      if(type === 'note' || type === 'postit') openTextDialog(type);
      else setMenu(true);
      return;
    }
    if(!event.target.closest('#submedWallMenu') && !event.target.closest('#submedWallFab')){
      setMenu(false);
    }

    const menuAction = event.target.closest('[data-wall-menu]');
    if(menuAction){
      const action=menuAction.dataset.wallMenu;
      setMenu(false);
      if(action==='note'||action==='postit') openTextDialog(action);
      if(action==='context') saveCurrentContext();
      if(action==='picker'){
        document.getElementById('submedWallPickerDialog').hidden=false;
        document.body.classList.add('note-modal-open');
        loadPickerResults();
      }
    }
  });

  root.querySelectorAll('[data-wall-close]').forEach(button=>button.addEventListener('click',closeDialogs));
  root.querySelectorAll('.sw-dialog-overlay').forEach(overlay=>overlay.addEventListener('click',event=>{
    if(event.target===overlay)closeDialogs();
  }));

  document.getElementById('submedWallTextForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const type=form.dataset.itemType || 'note';
    const status=document.getElementById('submedWallTextStatus');
    const submit=form.querySelector('[type="submit"]');
    submit.disabled=true;
    status.textContent='Se salvează…';
    try{
      const saved=await PersonalWall.createText({
        title:document.getElementById('submedWallTitle').value,
        body:document.getElementById('submedWallBody').value,
        category:document.getElementById('submedWallCategory').value,
        tags:document.getElementById('submedWallTags').value,
        is_important:document.getElementById('submedWallImportant').checked,
        in_mindmap:document.getElementById('submedWallMap').checked,
        on_board:document.getElementById('submedWallBoard').checked,
        postit_color:document.getElementById('submedWallColor').value,
      },type,location.pathname);
      closeDialogs();
      toast(type==='postit'?'Post-it salvat pe tablă.':'Notiță salvată pe perete.');
      document.dispatchEvent(new CustomEvent('submed:wall-item-created',{detail:{item:saved}}));
    }catch(error){
      status.textContent=error.message||'Elementul nu a putut fi salvat.';
    }finally{
      submit.disabled=false;
    }
  });

  document.getElementById('submedWallBody').addEventListener('input',event=>{
    document.getElementById('submedWallCounter').textContent=`${event.target.value.length}/4000`;
  });
  document.getElementById('submedWallMaterialType').addEventListener('change',loadPickerResults);
  document.getElementById('submedWallMaterialSearch').addEventListener('input',()=>{
    clearTimeout(loadPickerResults.timer);
    loadPickerResults.timer=setTimeout(loadPickerResults,240);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeDialogs();
  });
}

export async function initPersonalWallQuickNote() {
  if(document.getElementById('submedWallFab'))return;
  const user=await Auth.getUser().catch(()=>null);
  if(!user||!document.body)return;
  document.body.insertAdjacentHTML('beforeend',markup());
  initCaptureEvents();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>initPersonalWallQuickNote());
}else{
  initPersonalWallQuickNote();
}
