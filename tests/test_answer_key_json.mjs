import assert from 'node:assert/strict';
import { answerKeyToMatrix, normalizeAnswerKeyJson } from '../assets/js/answer-key-json.js';

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('normalizes direct internal key map', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson({ 1: ['A', 'c', 'a'], 2: 'de', 150: ['b'] }),
    { 1: ['a', 'c'], 2: ['d', 'e'], 150: ['b'] },
  );
});

test('normalizes wrapped key map', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson({ key: { 1: ['a'], 2: ['b', 'e'] } }),
    { 1: ['a'], 2: ['b', 'e'] },
  );
});

test('normalizes row objects', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson([
      { q: 1, correct: ['a', 'd'] },
      { question: '2', answer: 'b e' },
      { question_no: 3, raspunsuri: 'c,d' },
    ]),
    { 1: ['a', 'd'], 2: ['b', 'e'], 3: ['c', 'd'] },
  );
});

test('normalizes wrapped rows', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson({
      questions: [
        { nr: 1, answers: ['a'] },
        { nr: 2, answers: ['c', 'e'] },
      ],
    }),
    { 1: ['a'], 2: ['c', 'e'] },
  );
});

test('normalizes compact array format by position', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson(['a', 'bd', ['c', 'e']]),
    { 1: ['a'], 2: ['b', 'd'], 3: ['c', 'e'] },
  );
});

test('can require an expected question count', () => {
  assert.deepEqual(
    normalizeAnswerKeyJson({ 1: 'a', 2: 'b' }, { expectedQuestions: 2 }),
    { 1: ['a'], 2: ['b'] },
  );
  assert.throws(
    () => normalizeAnswerKeyJson({ 1: 'a' }, { expectedQuestions: 2 }),
    /Baremul are 1 intrebari/,
  );
});

test('rejects invalid questions and answers', () => {
  assert.throws(() => normalizeAnswerKeyJson({ 0: 'a' }), /Numar intrebare invalid/);
  assert.throws(() => normalizeAnswerKeyJson({ 1: 'z' }), /Raspuns invalid/);
  assert.throws(() => normalizeAnswerKeyJson({}), /niciun raspuns/);
});

test('converts answer key to 150x5 matrix', () => {
  const matrix = answerKeyToMatrix({ 1: ['a', 'e'], 2: ['c'] });

  assert.equal(matrix.length, 150);
  assert.deepEqual(matrix[0], [1, 0, 0, 0, 1]);
  assert.deepEqual(matrix[1], [0, 0, 1, 0, 0]);
  assert.equal(matrix.slice(2).flat().reduce((sum, value) => sum + value, 0), 0);
});
