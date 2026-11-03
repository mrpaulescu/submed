// ============================================================================
// Learning content import helpers
// Pure validation/normalization utilities used by admin tools and tests.
// ============================================================================

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'];
const SUBJECT_ALIASES = {
  bio: 'biologie',
  biologie: 'biologie',
  biology: 'biologie',
  chim: 'chimie',
  chimie: 'chimie',
  chemistry: 'chimie',
};

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function normalizeSubject(value, fallback = 'biologie') {
  const key = String(value || fallback).trim().toLowerCase();
  const subject = SUBJECT_ALIASES[key];
  if (!subject) throw new Error(`Materie invalida: ${value}`);
  return subject;
}

export function normalizeChapterName(subject, value) {
  const chapter = String(value || '').trim().replace(/\s+/g, ' ');
  const key = chapter.toLowerCase();
  if (String(subject || '').trim().toLowerCase() === 'biologie'
      && key === 'organizarea corpului uman. celula') {
    return 'Celula';
  }
  return chapter;
}

export function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.map(v => String(v).trim()).filter(Boolean))];
  return [...new Set(String(value).split(/[;,#]/).map(v => v.trim()).filter(Boolean))];
}

export function normalizeDifficulty(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const map = {
    easy: 'usor',
    medium: 'mediu',
    hard: 'greu',
    'ușor': 'usor',
    usor: 'usor',
    mediu: 'mediu',
    greu: 'greu',
  };
  const out = map[raw];
  if (!out) throw new Error(`Dificultate invalida: ${value}`);
  return out;
}

function firstDefined(...values) {
  const found = values.find(v => v !== undefined && v !== null && v !== '');
  return found === undefined ? values[values.length - 1] : found;
}

function expectRows(input, keys = ['items', 'data', 'rows']) {
  if (Array.isArray(input)) return input;
  for (const key of keys) {
    if (Array.isArray(input?.[key])) return input[key];
  }
  throw new Error('Importul trebuie sa fie un array sau un obiect cu array de date.');
}

function normalizeQuestionNo(value) {
  const no = Number(value);
  if (!Number.isInteger(no) || no <= 0) throw new Error(`Numar intrebare invalid: ${value}`);
  return no;
}

function normalizeAnswerLetters(value) {
  const letters = (Array.isArray(value) ? value : [value])
    .flatMap(v => String(v || '').toLowerCase().match(/[a-e]/g) || [])
    .filter(Boolean);
  const unique = [...new Set(letters)];
  for (const letter of unique) {
    if (!OPTION_KEYS.includes(letter)) throw new Error(`Raspuns invalid: ${letter}`);
  }
  if (!unique.length) throw new Error('Lipseste raspunsul corect.');
  return unique;
}

function normalizeOptions(value) {
  if (Array.isArray(value)) {
    const options = value.map((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        return {
          key: String(item.key || OPTION_KEYS[idx]).toLowerCase(),
          text: String(firstDefined(item.text, item.label, item.value, '')).trim(),
        };
      }
      return { key: OPTION_KEYS[idx], text: String(item).trim() };
    }).filter(o => o.text);
    if (options.length < 2) throw new Error('O grila are nevoie de cel putin 2 variante.');
    return options;
  }

  if (value && typeof value === 'object') {
    const options = OPTION_KEYS
      .map(key => value[key] || value[key.toUpperCase()]
        ? { key, text: String(value[key] || value[key.toUpperCase()]).trim() }
        : null)
      .filter(Boolean);
    if (options.length < 2) throw new Error('O grila are nevoie de cel putin 2 variante.');
    return options;
  }

  throw new Error('Variante lipsa pentru grila.');
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    if (seen.has(value)) throw new Error(`Valoare duplicata pentru ${label}: ${value}`);
    seen.add(value);
  }
}

export function normalizeQuestionImport(input, defaults = {}) {
  const rows = expectRows(input, ['questions', 'items', 'data', 'rows']).map((row, idx) => {
    const subject = normalizeSubject(firstDefined(row.subject, row.materie, defaults.subject));
    const chapter = normalizeChapterName(subject, firstDefined(row.chapter, row.capitol, defaults.chapter, ''));
    const text = String(firstDefined(row.text, row.question, row.q, '')).trim();
    if (!chapter) throw new Error(`Rand ${idx + 1}: lipseste capitolul.`);
    if (!text) throw new Error(`Rand ${idx + 1}: lipseste textul intrebarii.`);
    const correct = normalizeAnswerLetters(firstDefined(row.correct, row.answers, row.answer, row.raspunsuri));
    return {
      source_key: firstDefined(row.source_key, row.external_id, row.id, null),
      subject,
      chapter,
      text,
      options: normalizeOptions(firstDefined(row.options, row.variante)),
      correct,
      multiple: correct.length > 1,
      explanation: firstDefined(row.explanation, row.explicatie, null),
      difficulty: normalizeDifficulty(firstDefined(row.difficulty, row.dificultate, null)),
      source: firstDefined(row.source, row.sursa, defaults.source, null),
      tags: normalizeTags(firstDefined(row.tags, row.taguri, null)),
    };
  });
  assertUnique(rows, 'source_key', 'source_key');
  return rows;
}

export function normalizeExamTopicImport(input, defaults = {}) {
  const rows = expectRows(input, ['topics', 'questions', 'items', 'data', 'rows']).map((row, idx) => {
    const questionNo = normalizeQuestionNo(firstDefined(row.question_no, row.q, row.nr, row.numar, row.no));
    const subject = normalizeSubject(firstDefined(row.subject, row.materie, defaults.subject));
    const chapter = String(firstDefined(row.chapter, row.capitol, defaults.chapter, '')).trim();
    if (!chapter && !row.chapter_id) throw new Error(`Rand ${idx + 1}: lipseste capitolul.`);
    return {
      question_no: questionNo,
      subject,
      chapter,
      chapter_id: firstDefined(row.chapter_id, null),
      source_question_id: firstDefined(row.source_question_id, row.question_id, null),
      explanation: firstDefined(row.explanation, row.explicatie, null),
      tags: normalizeTags(firstDefined(row.tags, row.taguri, null)),
    };
  });
  assertUnique(rows, 'question_no', 'question_no');
  return rows;
}

export function normalizeChemicalStructureImport(input, defaults = {}) {
  return expectRows(input, ['structures', 'compounds', 'items', 'data', 'rows']).map((row, idx) => {
    const smiles = String(firstDefined(row.smiles, row.SMILES, '')).trim();
    const name = String(firstDefined(row.name, row.common_name, row.iupac, row.iupac_name, '')).trim();
    if (!smiles) throw new Error(`Rand ${idx + 1}: lipseste SMILES.`);
    if (!name) throw new Error(`Rand ${idx + 1}: lipseste numele structurii.`);
    const iupacName = firstDefined(row.iupac_name, row.iupac, null);
    return {
      slug: slugify(firstDefined(row.slug, row.source_key, iupacName, name, smiles)),
      name,
      iupac_name: iupacName,
      smiles,
      formula: firstDefined(row.formula, row.molecular_formula, null),
      molfile: firstDefined(row.molfile, row.mol, null),
      aliases: normalizeTags(firstDefined(row.aliases, row.alias, null)),
      functional_groups: normalizeTags(firstDefined(row.functional_groups, row.groups, row.grupe, null)),
      subject: normalizeSubject(firstDefined(row.subject, defaults.subject, 'chimie')),
      chapter: String(firstDefined(row.chapter, row.capitol, defaults.chapter, '')).trim(),
      chapter_id: firstDefined(row.chapter_id, null),
      metadata: row.metadata || {},
    };
  });
}

function flashcardRows(input, defaults) {
  if (Array.isArray(input?.decks)) {
    return input.decks.flatMap(deck => {
      const cards = expectRows(deck, ['cards', 'flashcards', 'items', 'data']);
      return cards.map(card => ({ ...card, __deckDefaults: deck }));
    });
  }
  return expectRows(input, ['flashcards', 'cards', 'items', 'data', 'rows'])
    .map(card => ({ ...card, __deckDefaults: defaults }));
}

export function normalizeFlashcardImport(input, defaults = {}) {
  const rows = flashcardRows(input, input || defaults).map((row, idx) => {
    const deckDefaults = row.__deckDefaults || {};
    const subject = normalizeSubject(firstDefined(row.subject, deckDefaults.subject, defaults.subject));
    const chapter = String(firstDefined(row.chapter, row.capitol, deckDefaults.chapter, deckDefaults.capitol, defaults.chapter, '')).trim();
    const deck = String(firstDefined(row.deck, row.deck_title, deckDefaults.deck, deckDefaults.title, chapter, defaults.deck, 'Flashcards')).trim();
    const front = String(firstDefined(row.front, row.question, row.q, '')).trim();
    const back = String(firstDefined(row.back, row.answer, row.a, '')).trim();
    if (!front) throw new Error(`Rand ${idx + 1}: lipseste fata cardului.`);
    if (!back) throw new Error(`Rand ${idx + 1}: lipseste spatele cardului.`);

    const structureInput = firstDefined(row.chemical_structure, row.structure, null)
      || (row.smiles ? row : null);
    const chemicalStructure = structureInput
      ? normalizeChemicalStructureImport([{
          ...structureInput,
          subject,
          chapter,
        }])[0]
      : null;

    const cardType = firstDefined(row.card_type, row.type, chemicalStructure ? 'chemical_structure' : 'basic');
    if (!['basic', 'cloze', 'chemical_structure'].includes(cardType)) {
      throw new Error(`Tip flashcard invalid: ${cardType}`);
    }

    return {
      source_key: firstDefined(row.source_key, row.external_id, row.id, null),
      subject,
      chapter,
      deck,
      deck_slug: slugify(firstDefined(row.deck_slug, deckDefaults.slug, `${subject}-${chapter || deck}-${deck}`)),
      front,
      back,
      card_type: cardType,
      tags: normalizeTags(firstDefined(row.tags, row.taguri, deckDefaults.tags, null)),
      difficulty: normalizeDifficulty(firstDefined(row.difficulty, row.dificultate, null)),
      source: firstDefined(row.source, row.sursa, deckDefaults.source, defaults.source, null),
      chemical_structure: chemicalStructure,
    };
  });
  assertUnique(rows, 'source_key', 'source_key');
  return rows;
}
