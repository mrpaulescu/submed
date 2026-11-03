import assert from 'node:assert/strict';
import { analyzeMatrix, classifyBubbleIntensity } from '../assets/js/omr.js';

const OPTS = 'abcde';

function blankMatrix() {
  return Array.from({ length: 150 }, () => [0, 0, 0, 0, 0]);
}

function mark(matrix, questionNo, answers) {
  for (const answer of answers) {
    matrix[questionNo - 1][OPTS.indexOf(answer)] = 1;
  }
  return matrix;
}

function warningCodes(report) {
  return report.warnings.map(w => w.code);
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('valid matrix passes without review', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['b']);
  mark(matrix, 2, ['a', 'c', 'e']);
  mark(matrix, 150, ['d']);

  const report = analyzeMatrix(matrix, { minAnsweredQuestions: 3 });

  assert.equal(report.ok, true);
  assert.equal(report.needsReview, false);
  assert.equal(report.filledBubbles, 5);
  assert.equal(report.answeredQuestions, 3);
  assert.deepEqual(report.multiMarkQuestions, [2]);
  assert.deepEqual(report.warnings, []);
});

test('clear filled bubble has high confidence', () => {
  const result = classifyBubbleIntensity(60, 120);

  assert.equal(result.filled, true);
  assert.equal(result.ambiguous, false);
  assert.equal(result.state, 'filled');
  assert.equal(result.confidence, 1);
  assert.equal(result.delta, 60);
});

test('clear empty bubble has high confidence', () => {
  const result = classifyBubbleIntensity(180, 120);

  assert.equal(result.filled, false);
  assert.equal(result.ambiguous, false);
  assert.equal(result.state, 'empty');
  assert.equal(result.confidence, 1);
  assert.equal(result.delta, -60);
});

test('near-threshold bubble is ambiguous while preserving binary decision', () => {
  const filled = classifyBubbleIntensity(115, 120);
  const empty = classifyBubbleIntensity(125, 120);

  assert.equal(filled.filled, true);
  assert.equal(filled.ambiguous, true);
  assert.equal(filled.state, 'ambiguous');
  assert.ok(filled.confidence > 0 && filled.confidence < 1);

  assert.equal(empty.filled, false);
  assert.equal(empty.ambiguous, true);
  assert.equal(empty.state, 'ambiguous');
  assert.ok(empty.confidence > 0 && empty.confidence < 1);
});

test('bubble classifier rejects invalid inputs', () => {
  assert.throws(
    () => classifyBubbleIntensity(100, 0),
    /Intensitate\/prag invalid/,
  );
  assert.throws(
    () => classifyBubbleIntensity(100, 120, { relativeMargin: 0 }),
    /confidence trebuie sa fie pozitiva/,
  );
});

test('empty matrix is blocking', () => {
  const report = analyzeMatrix(blankMatrix());

  assert.equal(report.ok, false);
  assert.equal(report.needsReview, true);
  assert.deepEqual(warningCodes(report), ['empty-sheet']);
});

test('too few answers is blocking when threshold is configured', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['a']);

  const report = analyzeMatrix(matrix, { minAnsweredQuestions: 3 });

  assert.equal(report.ok, false);
  assert.equal(report.needsReview, true);
  assert.deepEqual(warningCodes(report), ['too-few-answers']);
});

test('overfilled questions require review but do not block by themselves', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['a']);
  mark(matrix, 4, ['a', 'b', 'c', 'd']);

  const report = analyzeMatrix(matrix);

  assert.equal(report.ok, true);
  assert.equal(report.needsReview, true);
  assert.deepEqual(report.overfilledQuestions, [4]);
  assert.deepEqual(warningCodes(report), ['overfilled-questions']);
});

test('low-confidence diagnostics require review but do not block by themselves', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['a']);

  const report = analyzeMatrix(matrix, {
    diagnostics: {
      lowConfidenceBubbles: [
        { q: 1, option: 'a', confidence: 0.32, intensity: 116, threshold: 120, filled: true },
      ],
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.needsReview, true);
  assert.deepEqual(warningCodes(report), ['low-confidence-bubbles']);
  assert.equal(report.lowConfidenceBubbles.length, 1);
});

test('ambiguous contest code requires review', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['a']);

  const report = analyzeMatrix(matrix, {
    contest: { code: '12?45', ambiguous: true },
  });

  assert.equal(report.ok, true);
  assert.equal(report.needsReview, true);
  assert.deepEqual(warningCodes(report), ['ambiguous-contest-code']);
});

test('contest code mismatch is blocking', () => {
  const matrix = blankMatrix();
  mark(matrix, 1, ['a']);

  const report = analyzeMatrix(matrix, {
    contest: { code: '54321', ambiguous: false },
    expectedContestCode: '12345',
  });

  assert.equal(report.ok, false);
  assert.equal(report.needsReview, true);
  assert.deepEqual(warningCodes(report), ['contest-code-mismatch']);
});

test('malformed matrix throws a clear error', () => {
  assert.throws(
    () => analyzeMatrix([[1, 0, 0, 0, 0]]),
    /150 de intrebari/,
  );

  const matrix = blankMatrix();
  matrix[9] = [1, 0, 0];
  assert.throws(
    () => analyzeMatrix(matrix),
    /intrebarea 10 nu are 5 optiuni/,
  );

  matrix[9] = [1, 0, 2, 0, 0];
  assert.throws(
    () => analyzeMatrix(matrix),
    /valoare nebinara la intrebarea 10/,
  );
});
