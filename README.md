# SubMed

## Pornire rapida

Aplicatia este statica si are deja inclus config-ul public necesar pentru Supabase si Render OCR. Dupa clone:

```powershell
cd D:\SubMed\submed-v2-main
npx serve . -l 5173
```

Deschide:

```text
http://127.0.0.1:5173/index.html
```

Autentificarea, dashboard-ul, grilele, flashcardurile si scanarea folosesc `config.public.js`. Cheia Supabase din acel fisier este cheia anon/public pentru frontend, nu cheia `service_role`.

Pentru recapitularea programată a întrebărilor greșite, rulează `db/migration-coach-workflow.sql` în Supabase SQL Editor după `db/schema.sql` și `db/migration-learning-modules.sql`. Migrarea protejează programarea cu RLS per utilizator și importă greșelile istorice care au rămas greșite la ultima încercare.

## Daca auth-ul nu redirectioneaza corect

In Supabase Dashboard, la Authentication -> URL Configuration, adauga URL-urile locale folosite de prietenul tau:

```text
http://127.0.0.1:5173
http://127.0.0.1:5173/login.html
http://127.0.0.1:5173/dashboard.html
http://127.0.0.1:5173/reset-password.html
http://localhost:5173
http://localhost:5173/login.html
http://localhost:5173/dashboard.html
http://localhost:5173/reset-password.html
```

Nu deschide paginile direct cu `file:///...`; modulele JavaScript si Supabase au nevoie de server local.
