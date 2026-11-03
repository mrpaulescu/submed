# SubMed - baza pentru continut propriu

Acest proiect are acum o baza pentru continut editabil de tine:

- grile pe capitole
- mapping intrebare examen -> materie/capitol
- flashcarduri pe deck-uri
- structuri chimice reutilizabile pentru flashcarduri

## 1. Ruleaza migrarea

In Supabase SQL Editor ruleaza:

```sql
-- db/migration-learning-modules.sql
```

Daca ai deja date in baza, migrarea este gandita sa fie re-rulabila. Constrangerile noi sunt adaugate ca `NOT VALID`, deci nu blocheaza randuri vechi imperfecte, dar se aplica pentru importurile noi.

Daca pornesti o baza noua, poti rula direct `db/schema.sql`.

## 2. Deschide pagina admin

Pagina utilitara este:

```text
admin-content.html
```

Trebuie sa fii logat cu rol `admin` in tabela `profiles`.

Importurile din pagina trec prin `assets/js/content-import-service.js`, care:

- parseaza JSON-ul;
- normalizeaza campurile acceptate;
- valideaza duplicatele din acelasi import (`source_key`, `question_no`);
- creeaza automat capitolele lipsa;
- creeaza automat deck-urile lipsa pentru flashcarduri;
- salveaza continutul prin API-ul admin.

## 3. Import grile

Format minim:

```json
[
  {
    "id": "bio-celula-001",
    "subject": "biologie",
    "chapter": "Celula",
    "question": "Membrana celulara contine:",
    "options": ["lipide", "proteine", "celuloza", "colesterol"],
    "correct": ["a", "b", "d"],
    "explanation": "Modelul mozaicului fluid.",
    "difficulty": "mediu",
    "tags": ["membrana", "celula"]
  }
]
```

`id` devine `source_key`, util cand reimporti continutul.
Nu folosi acelasi `id` de doua ori in acelasi fisier JSON.

## 4. Mapping pentru greseli scanate

Format:

```json
[
  {
    "question_no": 1,
    "subject": "biologie",
    "chapter": "Celula",
    "tags": ["membrana"]
  },
  {
    "question_no": 2,
    "subject": "chimie",
    "chapter": "Hidrocarburi",
    "tags": ["alcani"]
  }
]
```

Acest mapping face ca rezultatele scanate sa poata spune din ce materie/capitol vine fiecare greseala.
Nu folosi acelasi `question_no` de doua ori in acelasi import pentru acelasi examen.

Dupa scanare, analiza pe capitole se citeste din view-uri:

- `scored_answers`: toate raspunsurile scanate expandate pe randuri, cu `subject`, `chapter_id`, `chapter_name`;
- `wrong_answers`: doar raspunsurile gresite, gata de afisat in pagina de rezultat;
- `weak_questions`: agregare pe intrebare;
- `weak_chapters`: agregare pe materie/capitol;
- `submission_chapter_results`: agregare pe capitole pentru o scanare concreta.

## 5. Import flashcarduri

Format recomandat:

```json
{
  "decks": [
    {
      "subject": "chimie",
      "chapter": "Alcani",
      "title": "Alcani baza",
      "cards": [
        {
          "id": "ch-alcani-metan",
          "front": "Care este formula metanului?",
          "back": "CH4",
          "name": "Metan",
          "iupac": "methane",
          "smiles": "C",
          "formula": "CH4"
        }
      ]
    }
  ]
}
```

Daca un card contine `smiles`, importul creeaza/actualizeaza automat structura chimica si o leaga de card.

## 6. Import structuri chimice

Format:

```json
[
  {
    "name": "Metan",
    "iupac": "methane",
    "smiles": "C",
    "formula": "CH4",
    "aliases": ["gaz metan"],
    "functional_groups": ["alkan"],
    "chapter": "Alcani"
  }
]
```

Campul `slug` este generat automat daca lipseste.

Pentru lista existenta din `compounds.js`, poti genera un JSON importabil:

```bash
node tools/compounds-to-structures.mjs assets/files/chemical-structures-import.json
```

Fisierul pregatit este `assets/files/chemical-structures-import.json`. Scriptul:

- citeste `ORGANIC_COMPOUNDS` din `compounds.js`;
- pastreaza nume romanesti si aliasuri cand exista in `RO_META`;
- adauga `chapter`, `functional_groups`, `subject: "chimie"` si metadata de sursa;
- elimina duplicatele dupa `slug`, ca reimportul sa fie stabil.

Poti genera si un raport cu metadata:

```bash
node tools/compounds-to-structures.mjs --wrap --out assets/files/chemical-structures-import-with-meta.json
```

Apoi lipesti continutul JSON in sectiunea "Import structuri chimice" din `admin-content.html`.

## 7. Aliasuri acceptate

Pentru flexibilitate, importatorul accepta mai multe nume:

- `subject`, `materie`, `bio`, `chim`
- `chapter`, `capitol`
- `question`, `q`, `text`
- `answer`, `a`, `back`
- `front`, `question`, `q`
- `correct`, `answers`, `raspunsuri`
- `tags`, `taguri`
- `difficulty`, `dificultate`
