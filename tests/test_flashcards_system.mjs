import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../flashcards.html', import.meta.url), 'utf8');
const api = readFileSync(new URL('../assets/js/api.js', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('flashcards api exposes deck/card/progress operations', () => {
  assert.match(api, /export const Flashcards =/);
  assert.match(api, /async listDecks/);
  assert.match(api, /async listCards/);
  assert.match(api, /async latestReviews/);
  assert.match(api, /async recordReview/);
  assert.match(api, /async myProgress/);
});

test('flashcards api calculates review schedule before insert', () => {
  assert.match(api, /scheduleFlashcardReview/);
  assert.match(api, /next_review_at: nextReviewAt \?\? scheduled\.nextReviewAt/);
  assert.match(api, /interval_days: intervalDays \?\? scheduled\.intervalDays/);
  assert.match(api, /ease: ease \?\? scheduled\.ease/);
});

test('flashcards page loads decks and cards from api with local fallback', () => {
  assert.match(html, /import\('\.\/assets\/js\/api\.js'\)/);
  assert.match(html, /loadDbFlashcards/);
  assert.match(html, /api\.listDecks/);
  assert.match(html, /api\.listCards/);
  assert.match(html, /LOCAL_DATA/);
});

test('flashcards page records per-user review on mark', () => {
  assert.match(html, /persistCardReview/);
  assert.match(html, /api\.recordReview/);
  assert.match(html, /known \? 'good' : 'again'/);
});

test('flashcards page can launch a due-only coach review session', () => {
  assert.match(html, /dueOnlyMode = params\.get\('due'\) === '1'/);
  assert.match(html, /!Number\.isFinite\(reviewTime\) \|\| reviewTime > now/);
  assert.match(html, /else if \(dueOnlyMode\) \{/);
  assert.match(html, /requestedCardCount/);
});
