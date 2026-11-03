// ============================================================================
// Flashcard spaced repetition helpers
// Pure utilities used by API and tests.
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function normalizeReviewRating(value) {
  const rating = String(value || 'good').toLowerCase();
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
    throw new Error(`Rating flashcard invalid: ${value}`);
  }
  return rating;
}

function clampEase(value) {
  return Math.max(MIN_EASE, Number(value || DEFAULT_EASE));
}

export function scheduleFlashcardReview(previous = {}, ratingInput = 'good', nowInput = new Date()) {
  const rating = normalizeReviewRating(ratingInput);
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const prevInterval = Math.max(0, Number(previous.interval_days || 0));
  const prevEase = clampEase(previous.ease);

  let intervalDays = 1;
  let ease = prevEase;

  if (rating === 'again') {
    intervalDays = 0;
    ease = clampEase(prevEase - 0.2);
  } else if (rating === 'hard') {
    intervalDays = prevInterval ? Math.max(1, Math.round(prevInterval * 1.2)) : 1;
    ease = clampEase(prevEase - 0.15);
  } else if (rating === 'good') {
    intervalDays = prevInterval ? Math.max(1, Math.round(prevInterval * prevEase)) : 1;
  } else if (rating === 'easy') {
    intervalDays = prevInterval ? Math.max(4, Math.round(prevInterval * prevEase * 1.3)) : 4;
    ease = clampEase(prevEase + 0.15);
  }

  const nextDelayMs = intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * DAY_MS;
  const nextReviewAt = new Date(now.getTime() + nextDelayMs).toISOString();

  return {
    rating,
    isKnown: rating !== 'again',
    intervalDays,
    ease: Number(ease.toFixed(2)),
    nextReviewAt,
  };
}

export function indexLatestReviews(rows = []) {
  const latest = {};
  for (const row of rows || []) {
    if (!row?.flashcard_id || latest[row.flashcard_id]) continue;
    latest[row.flashcard_id] = row;
  }
  return latest;
}
