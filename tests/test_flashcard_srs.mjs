import assert from 'node:assert/strict';
import { indexLatestReviews, normalizeReviewRating, scheduleFlashcardReview } from '../assets/js/flashcard-srs.js';

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('normalizes review ratings', () => {
  assert.equal(normalizeReviewRating('GOOD'), 'good');
  assert.throws(() => normalizeReviewRating('maybe'), /Rating flashcard invalid/);
});

test('schedules first review by rating', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const again = scheduleFlashcardReview({}, 'again', now);
  const good = scheduleFlashcardReview({}, 'good', now);
  const easy = scheduleFlashcardReview({}, 'easy', now);

  assert.equal(again.isKnown, false);
  assert.equal(again.intervalDays, 0);
  assert.equal(good.isKnown, true);
  assert.equal(good.intervalDays, 1);
  assert.equal(easy.intervalDays, 4);
  assert.equal(easy.nextReviewAt, '2026-01-05T00:00:00.000Z');
});

test('schedules later reviews from previous interval and ease', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const scheduled = scheduleFlashcardReview({ interval_days: 4, ease: 2.5 }, 'good', now);
  const hard = scheduleFlashcardReview({ interval_days: 4, ease: 2.5 }, 'hard', now);

  assert.equal(scheduled.intervalDays, 10);
  assert.equal(scheduled.ease, 2.5);
  assert.equal(hard.intervalDays, 5);
  assert.equal(hard.ease, 2.35);
});

test('indexes latest reviews from ordered rows', () => {
  const indexed = indexLatestReviews([
    { flashcard_id: 'a', rating: 'good' },
    { flashcard_id: 'a', rating: 'again' },
    { flashcard_id: 'b', rating: 'easy' },
  ]);

  assert.equal(indexed.a.rating, 'good');
  assert.equal(indexed.b.rating, 'easy');
});
