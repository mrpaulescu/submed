# SubMed v2 - Setup autentificare Supabase

Ghid rapid pentru `register -> confirmare email -> login -> dashboard`.

## 1. Proiect Supabase

1. Intra pe <https://supabase.com> si creeaza un proiect nou.
2. Alege o parola puternica pentru baza de date si salveaz-o.
3. Region recomandat pentru Romania: Central EU / Frankfurt.

## 2. Schema bazei de date

In Supabase Dashboard, deschide SQL Editor si ruleaza continutul din:

```text
db/schema.sql
```

Pentru o baza deja existenta poti rula si migrarea completa:

```text
db/migration-learning-modules.sql
```

## 3. Config aplicatie

Repo-ul contine deja `config.public.js`, cu valorile publice necesare pentru browser:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RENDER_API`

Un prieten care cloneaza repo-ul nu trebuie sa creeze manual `config.js`. Cheia Supabase anon/publishable este publica in aplicatiile frontend; protectia reala vine din RLS. Nu pune niciodata `service_role` sau secrete admin in fisiere incarcate de browser.

## 4. URL-uri de auth

In Supabase Dashboard -> Authentication -> URL Configuration:

Seteaza Site URL la:

```text
http://127.0.0.1:5173
```

Adauga la Redirect URLs:

```text
http://127.0.0.1:5173
http://127.0.0.1:5173/login.html
http://127.0.0.1:5173/dashboard.html
http://127.0.0.1:5173/reset-password.html
http://localhost:5173
http://localhost:5173/login.html
http://localhost:5173/dashboard.html
http://localhost:5173/reset-password.html
https://www.submed.ro
https://www.submed.ro/login.html
https://www.submed.ro/dashboard.html
https://www.submed.ro/reset-password.html
```

Pentru testare rapida, poti dezactiva temporar confirmarea emailului din Authentication -> Providers -> Email. Pentru productie, las-o activata.

## 5. Pornire locala

Nu deschide paginile cu `file:///...`. Porneste un server local din folderul proiectului:

```powershell
npx serve . -l 5173
```

Apoi deschide:

```text
http://127.0.0.1:5173/register.html
```

## 6. Probleme frecvente

- `Failed to fetch` sau erori CORS: rulezi din `file:///...`; foloseste server local.
- `Invalid login credentials`: parola este gresita sau emailul nu este confirmat.
- Linkul de confirmare/reset duce in gol: URL-ul local lipseste din Redirect URLs.
- Login reusit, dar dashboard gol: baza nu are inca examene/scanari pentru acel user.
