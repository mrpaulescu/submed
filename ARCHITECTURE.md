# SubMed v2 — Arhitectură & Plan de dezvoltare

> Document unic de referință. Orice decizie de structură se ia de aici.
> Scop: **o platformă coerentă, terminată cap-coadă**, nu multe direcții pe jumătate.

---

## Decizii blocate (nu se mai renegociază fără motiv serios)

| Domeniu | Decizie | De ce |
|---|---|---|
| **Frontend** | HTML/CSS/JS static (fără framework), găzduit pe cPanel | Deja merge, e ieftin, e ușor de întreținut de un dev solo |
| **Backend / DB** | **Supabase** (Postgres + Auth + Storage + RLS) | Fără backend propriu de scris. Auth, DB, fișiere și securitate gata făcute. Tier gratuit generos, regiune EU |
| **OCR** | **Python Flask pe Render** (deja existent) | OpenCV nu rulează pe cPanel shared. Microserviciul există și funcționează |
| **Plăți** | Schema pregătită în DB, implementare **după V1.0** (Netopia preferat) | Nu blochează drumul critic spre V1 |
| **Stil** | Un singur `assets/css/app.css` + un singur set de tokens | Eliminăm duplicarea CSS din ~20 pagini |
| **Cod partajat** | `assets/js/` cu module: supabase, auth, api, components | Eliminăm JS-ul copiat inline în fiecare pagină |

---

## Diagrama sistemului

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND static (cPanel public_html)                     │
│  pagini .html  +  assets/css/app.css  +  assets/js/*.js   │
│  (navbar, auth-guard, API client — o singură sursă)       │
└──────────┬───────────────────────────────┬───────────────┘
           │ Supabase JS SDK               │ fetch (multipart)
┌──────────▼───────────────────┐  ┌────────▼─────────────────┐
│  SUPABASE                     │  │  OCR MICROSERVICE         │
│  • Auth (email + Google)      │  │  Python Flask @ Render    │
│  • Postgres (8 tabele)        │  │  • /scan  (grila user)    │
│  • Storage (imagini grile)    │  │  • /admin/scan-key (barem)│
│  • Row-Level Security         │  │  OpenCV — matrice 150×5   │
└───────────────────────────────┘  └──────────────────────────┘
```

**Flux scanare (felia principală):**
1. User logat alege examen → upload foaie pe `scan.html`
2. Frontend trimite imaginea la Render `/scan` (+ `exam_id`)
3. Render rulează OMR → întoarce matrice + scor + imagine adnotată
4. Frontend salvează rezultatul în Supabase (`submissions`) + imaginea în Storage
5. Dashboard citește din Supabase: istoric, statistici, întrebări slabe

---

## Structura de foldere (țintă v2)

```
submed v2/
├── ARCHITECTURE.md            ← acest fișier
├── db/
│   └── schema.sql             ← schema Supabase (rulează în SQL Editor)
├── config.js                  ← chei publice Supabase + URL Render
├── assets/
│   ├── css/
│   │   └── app.css            ← tokens + componente partajate (UNIC)
│   ├── js/
│   │   ├── supabase-client.js ← inițializare client
│   │   ├── auth.js            ← register/login/logout/guard/OAuth
│   │   ├── api.js             ← examene, baremuri, submissions, OCR
│   │   └── components.js      ← injectare navbar + bottom-nav
│   ├── images/                ← (din v1)
│   └── files/                 ← PDF-uri subiecte/bareme (din v1)
├── pages publice:
│   ├── index.html             ← landing
│   ├── login.html / register.html / reset-password.html
│   ├── facultati.html         ← exam browser
│   ├── scan.html              ← upload + processing + results
│   ├── dashboard.html         ← istoric + statistici
│   ├── user.html              ← profil, preferințe și cod de concurs
│   └── student_card.html      ← redirecționare compatibilă către codul din profil
├── admin/
│   └── exams.html             ← CRUD examene + OCR barem + corectare manuală
└── render_api/                ← microserviciul OCR (deploy separat pe Render)
    ├── api.py
    ├── omr_engine.py
    ├── requirements.txt
    └── exams/
```

---

## Plan pe faze (fiecare se termină înainte de următoarea)

### Faza 0 — Fundație ✅ TERMINATĂ
- [x] Copiere v1 → v2, curățare duplicat `render_api/render_api`
- [x] `db/schema.sql` — schema completă (8 tabele + view + RLS)
- [x] `assets/css/app.css` — deduplicare stiluri
- [x] `assets/js/supabase-client.js`, `auth.js`, `api.js`
- [x] `config.js` cu placeholder-e Supabase
- [x] `assets/js/components.js` — navbar + bottom-nav + footer injectate dintr-o singură sursă

### Consistență vizuală (navbar / footer / identitate dashboard) ✅
Convertite pe `app.css` + `components.js` (12 pagini):
`index` · `dashboard` · `login` · `register` · `reset-password` · `scan` ·
`user` · `facultati` · `cluj` · `iasi` · `desprecontact` · `flashcards`

Rămase (instrumente chimie, în afara scope V1.0): `chimie` · `elemente` ·
`formule` · `iupac-quiz` · `lewis-structure` · `resurse`

### Faza 1 — Auth + Date
- [ ] Tabele Supabase create din schema
- [ ] register / login / logout reale (email+parolă)
- [ ] Google OAuth
- [ ] reset parolă + verificare email (din Supabase)
- [ ] profil user (`profiles`) + rol admin

### Faza 2 — Felia OCR (cap-coadă)
- [ ] Admin: import barem din PDF/imagine → `/admin/scan-key` → **corectare manuală** → salvare `answer_keys`
- [ ] User: scanare → Render `/scan` → validare → salvare `submissions` + imagine în Storage
- [ ] Engine de validare + feedback per întrebare

### Faza 3 — Frontend pe backend real
- [ ] Landing, exam browser, upload, processing, results, dashboard — toate pe Supabase
- [ ] Statistici: evoluție scor, întrebări slabe (agregare din `submissions`)
- [ ] Responsive + mobile-friendly verificat

### Faza 4 — Monetizare (post-V1.0)
- [ ] Abonamente (free/premium) — schema deja există
- [ ] Plată Netopia + gating premium

### Faza 5 — Test & Release V1.0
- [ ] Testare integrare end-to-end
- [ ] Bug fixing + optimizare
- [ ] Deploy cPanel + Render

---

## Ce NU facem până la V1.0 (evităm dispersia)
- Instrumentele de chimie (flashcards, Lewis builder, IUPAC quiz, formule, elemente)
  rămân ca pagini existente, dar **nu le dezvoltăm** până când felia principală e gata.
- Leaderboards, study groups, AI explanations, rank prediction — toate post-V1.0.
