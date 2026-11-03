import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../assets/js/api.js', import.meta.url), 'utf8');
const score = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('score function enriches scanned answers with topic metadata', () => {
  assert.match(score, /\.from\('exam_questions'\)/);
  assert.match(score, /question_no, subject, chapter_id, explanation, chapters\(name\)/);
  assert.match(score, /chapter_name: chapter\?\.name/);
  assert.match(score, /questions\.push\(\{ q: i \+ 1, student, correct, status: ok \? 'correct' : 'wrong', \.\.\.topic \}\)/);
});

test('score function returns mapping coverage and wrong chapter summary', () => {
  assert.match(score, /topic_coverage/);
  assert.match(score, /unmapped_wrong_questions/);
  assert.match(score, /wrong_chapters/);
});

test('API exposes topic analytics views', () => {
  assert.match(api, /async weakQuestions\(examIdOrOptions = null, limit = 8\)/);
  assert.match(api, /async weakChapters\(examIdOrOptions = null, limit = 8\)/);
  assert.match(api, /async wrongAnswers\(/);
  assert.match(api, /\.from\('wrong_answers'\)/);
  assert.match(api, /async submissionChapterResults\(submissionId\)/);
  assert.match(api, /\.from\('submission_chapter_results'\)/);
});
