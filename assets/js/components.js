// ============================================================================
// SubMed v2 — Componente partajate (navbar + bottom-nav + footer)
// ============================================================================
// Sursă UNICĂ pentru navbar și footer. Injectează automat la încărcare, ca
// toate paginile să fie identice ca identitate vizuală (referință: dashboard).
//
// Folosire în orice pagină:
//   <link rel="stylesheet" href="assets/css/app.css">
//   <script type="module" src="assets/js/components.js"></script>
//
// Variante (opțional, pe tag-ul <body data-nav="...">):
//   data-nav="full"    → navbar complet + bottom-nav + footer (implicit)
//   data-nav="minimal" → doar brand + Contact (pentru login/register/reset)
//   data-nav="none"    → nu injectează nimic
// ============================================================================

import { Auth } from './auth.js?v=supabase-singleton-20261028';

const RAW_PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const PAGE = RAW_PAGE.includes('.') ? RAW_PAGE : `${RAW_PAGE}.html`;
const MODE = document.body?.dataset.nav
          || (['login.html', 'register.html', 'reset-password.html'].includes(PAGE) ? 'minimal' : 'full');

// ── Paywall: pagini publice (restul necesită cont) ─────────────
const PUBLIC_PAGES = new Set([
  '', 'index.html',
  'login.html', 'register.html', 'reset-password.html', 'wizard.html', 'grile.html',
  'desprecontact.html', 'termeni.html', 'confidentialitate.html', 'cookies.html',
]);
// Gate conținutul: dacă pagina nu e publică și nu ești autentificat → login.
// Dacă backendul nu e disponibil, requireLogin nu redirecționează (preview).
if (!PUBLIC_PAGES.has(PAGE)) {
  Auth.requireLogin().catch(() => { /* backend indisponibil → preview */ });
}

// ── Definiția meniului (sursă unică) ────────────────────────────
const NAV_LINKS = [
  { label: 'Acasă',      href: 'dashboard.html' },
  { label: 'Subiecte',   children: [
      { label: 'Toate examenele', href: 'facultati.html' },
      { label: 'UMF Cluj',        href: 'cluj.html' },
      { label: 'UMF Iași',        href: 'iasi.html' },
  ]},
  { label: 'Grile',      href: 'grile.html' },
  { label: 'Scanare',    href: 'scan.html' },
  { label: 'Flashcards', href: 'flashcards.html' },
  { label: 'Contact',    href: 'desprecontact.html' },
];

const BOTTOM_NAV = [
  { label: 'acasă',     href: 'dashboard.html', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { label: 'subiecte',  href: 'facultati.html', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { label: 'scan',      href: 'scan.html', center: true, icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
  { label: 'grile',     href: 'grile.html', icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
  { label: 'profil',    href: 'user.html', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
];

// ── Marca (asteriscul din logo) — definită o singură dată ──────
const AST_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="astGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#407BFF"/><stop offset="1" stop-color="#105AFF"/>
    </linearGradient>
    <symbol id="ast" viewBox="0 0 120 120">
      <g fill="url(#astGrad)">
        <rect x="51" y="14" width="18" height="92" rx="9"/>
        <rect x="14" y="51" width="92" height="18" rx="9"/>
        <rect x="49" y="6" width="22" height="108" rx="11" transform="rotate(45 60 60)"/>
        <rect x="49" y="6" width="22" height="108" rx="11" transform="rotate(-45 60 60)"/>
      </g>
    </symbol>
    <symbol id="ast-solid" viewBox="0 0 120 120">
      <g fill="currentColor">
        <rect x="51" y="14" width="18" height="92" rx="9"/>
        <rect x="14" y="51" width="92" height="18" rx="9"/>
        <rect x="49" y="6" width="22" height="108" rx="11" transform="rotate(45 60 60)"/>
        <rect x="49" y="6" width="22" height="108" rx="11" transform="rotate(-45 60 60)"/>
      </g>
    </symbol>
    <!-- Set de iconuri line-style (folosite prin .i cu <use>) -->
    <symbol id="i-wave" viewBox="0 0 24 24"><path d="M7.5 11.5V6.6a1.5 1.5 0 0 1 3 0V10m0-.4V5a1.5 1.5 0 0 1 3 0v4.6m0-1.1V6.8a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6 5.5 5.5 0 0 1-4.7-2.6l-1.9-3a1.5 1.5 0 0 1 2.5-1.7l1.3 1.8"/><path d="M14 3.2c1.2.2 2 .8 2.6 1.6M6.8 6.4C6 6.9 5.4 7.7 5.2 8.7"/></symbol>
    <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></symbol>
    <symbol id="i-rocket" viewBox="0 0 24 24"><path d="M12 3c3 1.4 4.8 4.4 4.8 8.2L14.4 14H9.6L7.2 11.2C7.2 7.4 9 4.4 12 3z"/><path d="M9.6 14 7 16.6M14.4 14 17 16.6M10 17.5c-1 2-4 2.3-4 2.3s.3-3 2.3-4"/><circle cx="12" cy="9.2" r="1.3"/></symbol>
    <symbol id="i-fire" viewBox="0 0 24 24"><path d="M12 3c1.2 3 4.2 4.2 4.2 8.2a4.2 4.2 0 0 1-8.4 0c0-1.1.4-2.1 1.1-3 .3 1 1.1 1.5 1.7 1.6C9.8 8.2 10.9 5.4 12 3z"/></symbol>
    <symbol id="i-salad" viewBox="0 0 24 24"><path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 11.5c-1-2 0-4.2 2.2-5.2M13.5 11.5c2.2-1 3.2-3.2 2.3-5.4M9.5 21l.8 1.4M14 21l-.8 1.4"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.2A8 8 0 0 1 9.8 4a7 7 0 1 0 10.2 10.2z"/></symbol>
    <symbol id="i-water" viewBox="0 0 24 24"><path d="M12 2.7s6 6.3 6 10.3a6 6 0 0 1-12 0c0-4 6-10.3 6-10.3z"/></symbol>
    <symbol id="i-timer" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/></symbol>
    <symbol id="i-lotus" viewBox="0 0 24 24"><path d="M12 20c-2-1.3-3.2-3.4-3.2-6 0-2.2 1.1-4.3 3.2-6 2.1 1.7 3.2 3.8 3.2 6 0 2.6-1.2 4.7-3.2 6z"/><path d="M12 20c-4 0-7-2.2-7-5 2 0 3.3.5 4.5 1.6M12 20c4 0 7-2.2 7-5-2 0-3.3.5-4.5 1.6"/></symbol>
    <symbol id="i-flex" viewBox="0 0 24 24"><path d="M6 9v6M4 8v8M18 9v6M20 8v8M8 12h8"/></symbol>
    <symbol id="i-dna" viewBox="0 0 24 24"><path d="M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9"/><path d="M9.2 6h5.6M9.2 18h5.6M10.4 9h3.2M10.4 15h3.2"/></symbol>
    <symbol id="i-flask" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.4 14h9.2"/></symbol>
    <symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M16 3h5v5M21 3l-7 7M4 20l6-6M16 21h5v-5M15 15l6 6M4 4l5 5"/></symbol>
    <symbol id="i-reset" viewBox="0 0 24 24"><path d="M3.5 9a9 9 0 1 1-1 4"/><path d="M3 3.5V9h5.5"/></symbol>
    <symbol id="i-party" viewBox="0 0 24 24"><path d="M3 21l5.2-12.2 7 7L3 21z"/><path d="M13.5 3.2c1.4.6 1.4 2 .6 3M16.8 6.5c1.7-.4 2.8.7 2.4 2.4M13 8l3 3"/></symbol>
    <symbol id="i-warning" viewBox="0 0 24 24"><path d="M12 4 3 19h18L12 4z"/><path d="M12 10v4M12 17h.01"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></symbol>
    <symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></symbol>
    <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></symbol>
    <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0z"/><path d="M6 6H3.5v1.5A3.5 3.5 0 0 0 6 11M18 6h2.5v1.5A3.5 3.5 0 0 1 18 11"/></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></symbol>
  </defs>
</svg>`;

// ── helpers ─────────────────────────────────────────────────────
const isActive = (href) => href === PAGE;

function navLinkHtml(link) {
  if (link.children) {
    const active = link.children.some(c => isActive(c.href)) ? ' active' : '';
    const items  = link.children.map(c =>
      `<li><a class="dropdown-item" href="${c.href}">${c.label}</a></li>`).join('');
    return `<li class="nav-item dropdown">
      <a class="nav-link dropdown-toggle${active}" href="#" data-bs-toggle="dropdown">${link.label}</a>
      <ul class="dropdown-menu">${items}</ul></li>`;
  }
  return `<li class="nav-item"><a class="nav-link${isActive(link.href) ? ' active' : ''}" href="${link.href}">${link.label}</a></li>`;
}

// ── Navbar ──────────────────────────────────────────────────────
function buildNavbar() {
  const links = MODE === 'minimal'
    ? `<li class="nav-item"><a class="nav-link" href="desprecontact.html">Contact</a></li>`
    : NAV_LINKS.map(navLinkHtml).join('');

 const userPill = MODE === 'minimal' ? '' : `
      <div class="nav-user-pill d-none d-lg-flex align-items-center ms-lg-3" id="navUserPill" style="display:none">
        <a href="user.html" class="d-flex align-items-center text-decoration-none" style="color: inherit;">
            <div class="nav-avatar me-2" id="navAvatar"></div>
            <span class="me-2 fw-semibold" id="navName" style="font-size:.95rem"></span>
        </a>
        <button class="btn-logout ms-2" id="navLogout">Ieșire</button>
      </div>`;

  return `
  <nav class="navbar navbar-expand-lg px-lg-5 px-md-4 px-3 fixed-top container-fluid">
    <div class="container-fluid fw-medium">
      <a class="navbar-brand-2 text-decoration-none" href="dashboard.html" aria-label="Submed"><img class="brand-logo" src="assets/images/logo-submed.svg" alt="Submed"></a>
      <button class="navbar-toggler ms-auto me-2" type="button" data-bs-toggle="collapse"
              data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Meniu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="mainNav">
        <ul class="navbar-nav align-items-lg-center gap-lg-1 ms-auto">${links}</ul>
        ${userPill}
      </div>
    </div>
  </nav>`;
}

// ── Bottom nav (mobil) ──────────────────────────────────────────
function buildBottomNav() {
  if (MODE !== 'full') return '';
  const items = BOTTOM_NAV.map(it => `
    <a class="bn-item${it.center ? ' bn-scan' : ''}${isActive(it.href) ? ' active' : ''}" href="${it.href}">
      <svg viewBox="0 0 24 24">${it.icon}</svg>${it.label}
    </a>`).join('');
  return `<div class="bottom-nav"><div class="bn-items">${items}</div></div>`;
}

function buildFooter() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
    <div class="fwrap">
      <div class="ftop">
        <div style="max-width:300px">
          <a class="fbrand" href="index.html" aria-label="Submed"><img class="flogo" src="assets/images/logo-submed-white.svg" alt="Submed"></a>
          <p class="fabout">Platforma de pregătire pentru admiterea la medicină. Subiecte oficiale, grile, simulări și corectare automată.</p>
        </div>
        <div class="fcol"><h5>Exersare</h5>
          <a href="facultati.html">Subiecte anteriori</a>
          <a href="grile.html">Grile pe capitole</a>
          <a href="scan.html">Scanare grilă</a>
          <a href="dashboard.html">Dashboard</a>
        </div>
        <div class="fcol"><h5>Instrumente</h5>
          <a href="flashcards.html">Flashcards</a>
          <a href="lewis-structure.html">Lewis Builder</a>
          <a href="iupac-quiz.html">Quiz IUPAC</a>
        </div>
        <div class="fcol"><h5>Centre</h5>
          <a href="cluj.html">UMF Cluj</a>
          <a href="iasi.html">UMF Iași</a>
          <a href="desprecontact.html">Despre &amp; contact</a>
        </div>
        <div class="fcol"><h5>Legal</h5>
          <a href="termeni.html">Termeni și condiții</a>
          <a href="confidentialitate.html">Politica de confidențialitate</a>
          <a href="cookies.html">Politica de cookie-uri</a>
        </div>
      </div>
      <div class="flegal">
        <a href="https://anpc.ro/" target="_blank" rel="noopener nofollow">ANPC</a>
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener nofollow">Soluționarea online a litigiilor (SOL)</a>
        <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener nofollow">Soluționarea alternativă a litigiilor (SAL)</a>
      </div>
      <div class="fbot">
        <span>© ${year} SubMed &nbsp;·&nbsp; Operat de PFA Grosu Paul-Ștefan · CUI 55324292 · București, România.<br>Subiectele oficiale aparțin universităților respective.</span>
        <span class="mono">ADMITERE · 10.07.2027</span>
      </div>
    </div>
  </footer>`;
}

// ── Bannerul de cookie-uri (GDPR) ───────────────────────────────
function buildCookieBanner() {
  return `<div class="cookie-banner" id="cookieBanner" role="dialog" aria-label="Preferințe cookie-uri" aria-live="polite">
    <div class="ck-wrap">
      <div class="ck-txt">
        <strong>Folosim cookie-uri</strong>
        <p>Folosim cookie-uri esențiale pentru funcționarea platformei și, cu acordul tău, cookie-uri de analiză pentru a o îmbunătăți. Detalii în <a href="cookies.html">Politica de cookie-uri</a>.</p>
      </div>
      <div class="ck-actions">
        <button class="ck-btn ck-decline" id="ckDecline" type="button">Doar esențiale</button>
        <button class="ck-btn ck-accept" id="ckAccept" type="button">Accept toate</button>
      </div>
    </div>
  </div>`;
}

const COOKIE_KEY = 'submed_cookie_consent';
function initCookieBanner() {
  let consent = null;
  try { consent = localStorage.getItem(COOKIE_KEY); } catch (e) {}
  if (consent) return;                       // deja a ales
  document.body.insertAdjacentHTML('beforeend', buildCookieBanner());
  const banner = document.getElementById('cookieBanner');
  requestAnimationFrame(() => banner.classList.add('show'));
  const close = choice => {
    try { localStorage.setItem(COOKIE_KEY, choice); } catch (e) {}
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  };
  document.getElementById('ckAccept').addEventListener('click', () => close('all'));
  document.getElementById('ckDecline').addEventListener('click', () => close('essential'));
}

// ── Injectare ───────────────────────────────────────────────────
function inject() {
  if (MODE === 'none') return;

  // simbolurile SVG ale mărcii + navbar la începutul body
  document.body.insertAdjacentHTML('afterbegin', AST_DEFS + buildNavbar());

  // bottom-nav + footer la final
  document.body.insertAdjacentHTML('beforeend', buildBottomNav());
  document.body.insertAdjacentHTML('beforeend', buildFooter());

  // banner cookie-uri (GDPR) — pe toate paginile, până la alegere
  initCookieBanner();

  // efect scroll navbar
  const nav = document.querySelector('nav.navbar');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // logout
  const logoutBtn = document.getElementById('navLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

  if (MODE === 'full') populateUser();
}

// ── Umple pill-ul de user (sau ascunde dacă neautentificat) ─────
async function populateUser() {
  const pill = document.getElementById('navUserPill');
  if (!pill) return;
  try {
    const user = await Auth.getUser();
    if (!user) return;                       // neautentificat → pill rămâne ascuns
    pill.style.display = 'flex';
    document.getElementById('navName').textContent = (user.name || 'Student').split(' ')[0];
    const av = document.getElementById('navAvatar');
    if (user.avatar_url) av.innerHTML = `<img src="${user.avatar_url}" alt="">`;
    else av.textContent = (user.name || '?')[0].toUpperCase();
  } catch (e) {
    /* config Supabase lipsă sau eroare rețea → lăsăm pill-ul ascuns */
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inject);
} else {
  inject();
}
