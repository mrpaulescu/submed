# Runbook rapid: migrare si import continut

## 0. Config local

Aplicatia foloseste implicit `config.public.js`, care este comis in repo ca un config public de browser. Un clone proaspat poate porni fara sa creeze manual `config.js`.

Daca rulezi proiectul pe alt Supabase/Render, modifica valorile din `config.public.js` in branch-ul/deploy-ul tau sau injecteaza `globalThis.SUBMED_CONFIG` inainte de incarcarea modulelor aplicatiei.

Cheia Supabase anon/publishable ajunge in browser la runtime; siguranta vine din politicile RLS. Nu pune niciodata `service_role` sau secrete admin in frontend.

## 1. Ruleaza migrarea

In Supabase Dashboard deschide SQL Editor si ruleaza continutul din:

```text
db/migration-learning-modules.sql
```

Migrarea este gandita sa fie re-rulabila: foloseste `create table if not exists`, `add column if not exists`, recreeaza view-urile si repune politicile RLS.

Daca pornesti o baza complet noua, poti rula direct:

```text
db/schema.sql
```

## 2. Pregateste continutul

Pentru grile, flashcarduri si mapping examen -> capitole pregateste fisiere JSON dupa exemplele din:

```text
CONTENT-IMPORT.md
```

Pentru structuri chimice, seed-ul pregatit este:

```text
assets/files/chemical-structures-import.json
```

Il poti regenera din `compounds.js` cu:

```bash
node tools/compounds-to-structures.mjs assets/files/chemical-structures-import.json
```

## 3. Importa prin admin tool

Deschide:

```text
admin-content.html
```

Trebuie sa fii logat cu un user care are `role = 'admin'` in tabela `profiles`.

Flux recomandat pentru fiecare sectiune:

1. Lipeste JSON-ul in textarea.
2. Apasa `Verifica JSON`.
3. Daca validarea trece, apasa butonul de import.

Pagina poate importa:

- grile;
- mapping examen -> materie/capitol;
- flashcarduri pe deck-uri;
- structuri chimice.

Importul creeaza automat capitolele lipsa si deck-urile lipsa.

## 4. Verificari locale

Ruleaza testele de import si admin:

```bash
node tests/test_learning_import.mjs
node tests/test_content_import_service.mjs
node tests/test_admin_content_page.mjs
node tests/test_compounds_to_structures.mjs
```

Ruleaza syntax check JS:

```bash
node tests/test_js_syntax.mjs
```

Verifica schema/migrarea:

```bash
node tests/test_learning_schema.mjs
```
