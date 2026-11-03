import assert from 'node:assert/strict';
import { ContentImporter, parseImportJson } from '../assets/js/content-import-service.js';

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function fakeDeps() {
  const state = {
    chapters: [],
    decks: [],
    exams: [{ id: 'exam-1', name: 'Simulare', faculties: { name: 'UMF' } }],
    questions: [],
    topics: [],
    structures: [],
    flashcards: [],
  };

  const grile = {
    async listChapters(subject) {
      return state.chapters.filter(chapter => chapter.subject === subject);
    },
  };

  const admin = {
    async listFlashcardDecks() {
      return state.decks;
    },
    async listExams() {
      return state.exams;
    },
    async createChapter(fields) {
      const row = { id: `chapter-${state.chapters.length + 1}`, ...fields };
      state.chapters.push(row);
      return row;
    },
    async importQuestions(rows) {
      state.questions.push(...rows);
      return rows.length;
    },
    async saveExamQuestionTopics(examId, rows) {
      state.topics.push(...rows.map(row => ({ ...row, exam_id: examId })));
      return rows.length;
    },
    async upsertFlashcardDeck(fields) {
      const existing = state.decks.find(deck => deck.slug === fields.slug);
      if (existing) return existing;
      const row = { id: `deck-${state.decks.length + 1}`, ...fields };
      state.decks.push(row);
      return row;
    },
    async upsertChemicalStructures(rows) {
      const out = rows.map(row => {
        const existing = state.structures.find(structure => structure.slug === row.slug);
        if (existing) return existing;
        const saved = { id: `structure-${state.structures.length + 1}`, ...row };
        state.structures.push(saved);
        return saved;
      });
      return out;
    },
    async importFlashcards(rows) {
      state.flashcards.push(...rows);
      return rows.length;
    },
  };

  return { admin, grile, state };
}

await test('parseImportJson parses strings and passes objects through', () => {
  assert.deepEqual(parseImportJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseImportJson({ a: 1 }), { a: 1 });
  assert.throws(() => parseImportJson('{'), /JSON invalid/);
});

await test('imports questions after validation and auto-creates chapters', async () => {
  const { admin, grile, state } = fakeDeps();
  const importer = new ContentImporter({ admin, grile });
  const result = await importer.importQuestions([{
    id: 'q-1',
    subject: 'bio',
    chapter: 'Celula',
    question: 'Text?',
    options: ['A', 'B'],
    correct: 'a',
  }]);

  assert.equal(result.savedCount, 1);
  assert.equal(result.createdChapters, 1);
  assert.equal(state.questions[0].chapter_id, 'chapter-1');
});

await test('imports exam topic mapping with duplicate question guard', async () => {
  const { admin, grile, state } = fakeDeps();
  const importer = new ContentImporter({ admin, grile });

  await assert.rejects(
    () => importer.importExamTopics('exam-1', [
      { question_no: 1, subject: 'bio', chapter: 'Celula' },
      { question_no: 1, subject: 'chimie', chapter: 'Alcani' },
    ]),
    /question_no/,
  );

  const result = await importer.importExamTopics('exam-1', [
    { question_no: 1, subject: 'bio', chapter: 'Celula' },
  ]);
  assert.equal(result.savedCount, 1);
  assert.equal(state.topics[0].chapter_id, 'chapter-1');
});

await test('imports flashcards with deck and chemical structure creation', async () => {
  const { admin, grile, state } = fakeDeps();
  const importer = new ContentImporter({ admin, grile });
  const result = await importer.importFlashcards({
    decks: [{
      subject: 'chimie',
      chapter: 'Alcani',
      title: 'Alcani baza',
      cards: [{
        id: 'fc-1',
        front: 'Formula metanului?',
        back: 'CH4',
        name: 'Metan',
        iupac: 'methane',
        smiles: 'C',
      }],
    }],
  });

  assert.equal(result.savedCount, 1);
  assert.equal(result.createdDecks, 1);
  assert.equal(result.savedStructures, 1);
  assert.equal(state.flashcards[0].deck_id, 'deck-1');
  assert.equal(state.flashcards[0].chemical_structure_id, 'structure-1');
});

await test('imports structures and auto-creates missing chapters', async () => {
  const { admin, grile, state } = fakeDeps();
  const importer = new ContentImporter({ admin, grile });
  const result = await importer.importStructures([{
    name: 'Metan',
    iupac: 'methane',
    smiles: 'C',
    chapter: 'Alcani',
  }]);

  assert.equal(result.savedCount, 1);
  assert.equal(result.createdChapters, 1);
  assert.equal(state.structures[0].chapter_id, 'chapter-1');
});
