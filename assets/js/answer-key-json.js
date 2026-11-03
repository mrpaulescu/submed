const LETTERS = ['a', 'b', 'c', 'd', 'e'];
const LETTER_SET = new Set(LETTERS);

function normalizeLetter(value) {
  const letter = String(value ?? '').trim().toLowerCase();
  if (!LETTER_SET.has(letter)) {
    throw new Error(`Raspuns invalid: "${value}". Foloseste doar a, b, c, d, e.`);
  }
  return letter;
}

function normalizeAnswers(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeLetter))].sort();
  }
  if (typeof value === 'string') {
    const compact = value.trim().toLowerCase();
    const parts = compact.includes(',') || compact.includes(' ')
      ? compact.split(/[\s,;|/+]+/).filter(Boolean)
      : compact.split('');
    return [...new Set(parts.map(normalizeLetter))].sort();
  }
  throw new Error(`Raspuns invalid: ${JSON.stringify(value)}.`);
}

function normalizeQuestionNo(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 150) {
    throw new Error(`Numar intrebare invalid: "${value}".`);
  }
  return String(n);
}

function looksLikeKeyMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (!entries.length) return false;
  return entries.every(([questionNo, answers]) => {
    const n = Number(questionNo);
    return Number.isInteger(n) && n >= 1 && n <= 150 &&
      (Array.isArray(answers) || typeof answers === 'string');
  });
}

function unwrap(raw) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  if (!raw || typeof raw !== 'object') throw new Error('JSON-ul trebuie sa contina un obiect sau o lista.');

  for (const key of ['key', 'answer_key', 'answerKey', 'answers', 'barem', 'correct']) {
    if (looksLikeKeyMap(raw[key]) || Array.isArray(raw[key])) return raw[key];
  }

  for (const key of ['questions', 'items', 'rows', 'data']) {
    if (Array.isArray(raw[key])) return raw[key];
  }

  return raw;
}

function normalizeFromKeyMap(map) {
  const out = {};
  for (const [questionNo, answers] of Object.entries(map)) {
    const q = normalizeQuestionNo(questionNo);
    const normalized = normalizeAnswers(answers);
    if (normalized.length) out[q] = normalized;
  }
  return out;
}

function rowQuestionNo(row, fallbackIndex) {
  return row.q ?? row.question ?? row.question_no ?? row.questionNo ??
    row.nr ?? row.numar ?? row.index ?? row.no ?? (fallbackIndex + 1);
}

function rowAnswers(row) {
  for (const key of ['correct', 'answers', 'answer', 'key', 'raspuns', 'raspunsuri', 'value']) {
    if (row[key] !== undefined) return row[key];
  }
  throw new Error(`Rand fara raspuns: ${JSON.stringify(row)}.`);
}

function normalizeFromRows(rows) {
  const out = {};
  rows.forEach((row, idx) => {
    if (row === null || row === undefined || row === '') return;
    if (Array.isArray(row) || typeof row === 'string') {
      const answers = normalizeAnswers(row);
      if (answers.length) out[String(idx + 1)] = answers;
      return;
    }
    if (typeof row !== 'object') {
      throw new Error(`Rand invalid la pozitia ${idx + 1}.`);
    }
    const q = normalizeQuestionNo(rowQuestionNo(row, idx));
    const answers = normalizeAnswers(rowAnswers(row));
    if (answers.length) out[q] = answers;
  });
  return out;
}

export function normalizeAnswerKeyJson(raw, {
  expectedQuestions = null,
} = {}) {
  const unwrapped = unwrap(raw);
  const key = Array.isArray(unwrapped)
    ? normalizeFromRows(unwrapped)
    : normalizeFromKeyMap(unwrapped);

  const count = Object.keys(key).length;
  if (!count) throw new Error('Baremul JSON nu contine niciun raspuns.');
  if (expectedQuestions !== null && count !== expectedQuestions) {
    throw new Error(`Baremul are ${count} intrebari, dar erau asteptate ${expectedQuestions}.`);
  }
  return key;
}

export function answerKeyToMatrix(key) {
  const matrix = Array.from({ length: 150 }, () => [0, 0, 0, 0, 0]);
  const normalized = normalizeAnswerKeyJson(key);
  for (const [questionNo, answers] of Object.entries(normalized)) {
    const qIdx = Number(questionNo) - 1;
    for (const letter of answers) {
      matrix[qIdx][LETTERS.indexOf(letter)] = 1;
    }
  }
  return matrix;
}
