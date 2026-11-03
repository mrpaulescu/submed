import assert from 'node:assert/strict';
import {
  normalizeChemicalStructureImport,
  normalizeExamTopicImport,
  normalizeFlashcardImport,
  normalizeQuestionImport,
  slugify,
} from '../assets/js/learning-import.js';

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('slugifies Romanian and punctuation safely', () => {
  assert.equal(slugify('Chimie organica - Alcani si cicloalcani'), 'chimie-organica-alcani-si-cicloalcani');
});

test('normalizes question imports for grile', () => {
  const rows = normalizeQuestionImport([{
    id: 'bio-celula-001',
    subject: 'bio',
    chapter: 'Celula',
    question: 'Membrana celulara contine:',
    options: ['lipide', 'proteine', 'celuloza', 'colesterol'],
    correct: 'a d',
    difficulty: 'medium',
    tags: 'membrana,celula',
  }]);

  assert.deepEqual(rows[0], {
    source_key: 'bio-celula-001',
    subject: 'biologie',
    chapter: 'Celula',
    text: 'Membrana celulara contine:',
    options: [
      { key: 'a', text: 'lipide' },
      { key: 'b', text: 'proteine' },
      { key: 'c', text: 'celuloza' },
      { key: 'd', text: 'colesterol' },
    ],
    correct: ['a', 'd'],
    multiple: true,
    explanation: null,
    difficulty: 'mediu',
    source: null,
    tags: ['membrana', 'celula'],
  });
});

test('normalizes exam topic mapping imports', () => {
  const rows = normalizeExamTopicImport({
    topics: [
      { nr: 12, materie: 'chimie', capitol: 'Hidrocarburi', tags: ['alcani'] },
    ],
  });

  assert.deepEqual(rows[0], {
    question_no: 12,
    subject: 'chimie',
    chapter: 'Hidrocarburi',
    chapter_id: null,
    source_question_id: null,
    explanation: null,
    tags: ['alcani'],
  });
});

test('normalizes chemical structures', () => {
  const rows = normalizeChemicalStructureImport([{
    iupac: 'methane',
    name: 'Metan',
    smiles: 'C',
    formula: 'CH4',
    aliases: ['gaz metan'],
    functional_groups: 'alkan',
  }]);

  assert.equal(rows[0].slug, 'methane');
  assert.equal(rows[0].subject, 'chimie');
  assert.deepEqual(rows[0].functional_groups, ['alkan']);
});

test('normalizes flashcards with deck defaults and chemical structures', () => {
  const rows = normalizeFlashcardImport({
    decks: [{
      subject: 'chim',
      chapter: 'Alcani',
      title: 'Alcani baza',
      cards: [{
        id: 'ch-alcani-metan',
        front: 'Care este formula metanului?',
        back: 'CH4',
        smiles: 'C',
        iupac: 'methane',
        name: 'Metan',
      }],
    }],
  });

  assert.equal(rows[0].source_key, 'ch-alcani-metan');
  assert.equal(rows[0].subject, 'chimie');
  assert.equal(rows[0].chapter, 'Alcani');
  assert.equal(rows[0].deck, 'Alcani baza');
  assert.equal(rows[0].card_type, 'chemical_structure');
  assert.equal(rows[0].chemical_structure.slug, 'methane');
});

test('rejects invalid imports', () => {
  assert.throws(() => normalizeQuestionImport([{ chapter: 'Celula', options: ['a', 'b'], correct: 'a' }]), /lipseste textul/);
  assert.throws(() => normalizeExamTopicImport([{ q: 0, subject: 'bio', chapter: 'Celula' }]), /Numar intrebare invalid/);
  assert.throws(() => normalizeChemicalStructureImport([{ name: 'Metan' }]), /SMILES/);
});

test('rejects duplicate keys inside one import payload', () => {
  assert.throws(
    () => normalizeQuestionImport([
      { id: 'q1', subject: 'bio', chapter: 'Celula', question: 'Q1', options: ['a', 'b'], correct: 'a' },
      { id: 'q1', subject: 'bio', chapter: 'Celula', question: 'Q2', options: ['a', 'b'], correct: 'b' },
    ]),
    /source_key/,
  );
  assert.throws(
    () => normalizeExamTopicImport([
      { q: 1, subject: 'bio', chapter: 'Celula' },
      { q: 1, subject: 'chimie', chapter: 'Alcani' },
    ]),
    /question_no/,
  );
});
