import { Auth } from './auth.js?v=supabase-singleton-20261028';

const WIDGET_ID = 'submedQuickNote';
const WIDGET_CSS_ID = 'submedQuickNoteStyles';

function widgetMarkup() {
  return `
    <style id="${WIDGET_CSS_ID}">
      #submedQuickNoteFab{position:fixed;right:22px;bottom:22px;z-index:1100;display:flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 18px;background:var(--blue);color:#fff;font:700 .88rem var(--font);box-shadow:0 9px 24px rgba(16,70,170,.28);cursor:pointer;transition:transform .15s,box-shadow .15s}
      #submedQuickNoteFab:hover{transform:translateY(-2px);box-shadow:0 13px 28px rgba(16,70,170,.34)}
      #submedQuickNoteFab .qnf-plus{width:23px;height:23px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.18);font-size:1.1rem;line-height:1}
      #${WIDGET_ID}[hidden]{display:none}
      #${WIDGET_ID}{position:fixed;inset:0;z-index:2400;background:rgba(7,20,49,.48);display:grid;place-items:center;padding:18px}
      #${WIDGET_ID} .qnm-card{width:min(520px,100%);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:var(--shadow-lg)}
      #${WIDGET_ID} .qnm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}
      #${WIDGET_ID} .qnm-head h2{margin:0;font:700 1.12rem var(--font-display);color:var(--ink)}
      #${WIDGET_ID} .qnm-close{width:34px;height:34px;border:0;border-radius:10px;background:var(--surface-2);font-size:1.2rem;color:var(--ink)}
      #${WIDGET_ID} label{display:block;margin:0 0 6px;color:var(--ink-3);font:700 .67rem var(--mono);letter-spacing:.08em;text-transform:uppercase}
      #${WIDGET_ID} input,#${WIDGET_ID} select,#${WIDGET_ID} textarea{width:100%;border:1.5px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--surface-2);color:var(--ink);font:500 .9rem var(--font);margin-bottom:13px}
      #${WIDGET_ID} textarea{min-height:140px;resize:vertical;line-height:1.55}
      #${WIDGET_ID} input:focus,#${WIDGET_ID} select:focus,#${WIDGET_ID} textarea:focus{outline:0;border-color:var(--blue);box-shadow:0 0 0 3px rgba(45,110,255,.12)}
      #${WIDGET_ID} .qnm-meta{display:flex;justify-content:space-between;gap:10px;margin-top:-8px;color:var(--ink-3);font:500 .66rem var(--mono)}
      #${WIDGET_ID} .qnm-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      #${WIDGET_ID} .qnm-save{border:0;border-radius:11px;padding:10px 16px;background:var(--blue);color:#fff;font:700 .84rem var(--font);cursor:pointer}
      #${WIDGET_ID} .qnm-status{min-height:1.25em;margin-top:10px;font-size:.8rem;color:var(--blue-deep)}
      body.note-modal-open{overflow:hidden}
      @media(max-width:768px){#submedQuickNoteFab{right:14px;bottom:calc(88px + env(safe-area-inset-bottom));padding:11px 15px}#${WIDGET_ID}{align-items:end;padding:10px}#${WIDGET_ID} .qnm-card{padding:18px}}
    </style>
    <button id="submedQuickNoteFab" type="button" aria-haspopup="dialog" aria-controls="${WIDGET_ID}">
      <span class="qnf-plus">＋</span><span>Notiță rapidă</span>
    </button>
    <div id="${WIDGET_ID}" hidden>
      <section class="qnm-card" role="dialog" aria-modal="true" aria-labelledby="submedQuickNoteTitle">
        <div class="qnm-head"><h2 id="submedQuickNoteTitle">Adaugă o notiță</h2><button class="qnm-close" type="button" data-note-close aria-label="Închide">×</button></div>
        <form>
          <label for="submedQuickNoteTitleField">Titlu (opțional)</label>
          <input name="title" id="submedQuickNoteTitleField" maxlength="80" placeholder="Un titlu scurt">
          <label for="submedQuickNoteCategory">Categorie</label>
          <select name="category" id="submedQuickNoteCategory">
            <option value="general">General</option><option value="study">Studiu</option><option value="idea">Idee</option><option value="todo">De făcut</option><option value="important">Important</option>
          </select>
          <label for="submedQuickNoteBody">Notiță</label>
          <textarea name="body" id="submedQuickNoteBody" maxlength="2000" required placeholder="Scrie un gând înainte să-l uiți…"></textarea>
          <div class="qnm-meta"><span>Text simplu · maximum 2.000 caractere</span><span data-note-counter>0/2000</span></div>
          <div class="qnm-status" data-note-status role="status" aria-live="polite"></div>
          <div class="qnm-actions">
            <button class="btn-secondary" type="button" data-note-close>Renunță</button>
            <button class="qnm-save" type="submit">Salvează pe perete</button>
          </div>
        </form>
      </section>
    </div>`;
}

export async function initPersonalWallQuickNote() {
  if (document.getElementById('submedQuickNoteFab')) return;
  const user = await Auth.getUser().catch(() => null);
  if (!user || !document.body) return;

  document.body.insertAdjacentHTML('beforeend', widgetMarkup());
  const modal = document.getElementById(WIDGET_ID);
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('note-modal-open');
  };
  modal.querySelectorAll('[data-note-close]').forEach(button => button.addEventListener('click', close));
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });

  document.getElementById('submedQuickNoteFab').addEventListener('click', async () => {
    try {
      const module = await import('./personal-wall-api.js?v=20261110');
      await module.openQuickNote({ sourcePage: location.pathname });
    } catch (error) {
      const status = modal.querySelector('[data-note-status]');
      if (status) status.textContent = error?.message || 'Notița nu a putut fi deschisă.';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initPersonalWallQuickNote());
} else {
  initPersonalWallQuickNote();
}
