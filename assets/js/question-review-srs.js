const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldScheduleQuestionReview(previous, isCorrect) {
  // A correct answer starts spacing only after the question entered the queue
  // through a previous mistake. New correct answers are not "mistakes to review".
  return !isCorrect || !!previous;
}

export function scheduleQuestionReview(previous = {}, isCorrect, reviewedAt = new Date()) {
  const oldRepetitions = Math.max(0, Number(previous.repetition_count) || 0);
  const oldInterval = Math.max(0, Number(previous.interval_days) || 0);
  const oldEase = Math.max(1.3, Number(previous.ease) || 2.5);
  const repetitions = isCorrect ? oldRepetitions + 1 : 0;
  const ease = isCorrect ? Math.min(3.0, oldEase + 0.05) : Math.max(1.3, oldEase - 0.2);
  const intervalDays = isCorrect
    ? repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(oldInterval * ease))
    : 1;
  const reviewed = reviewedAt instanceof Date ? new Date(reviewedAt) : new Date(reviewedAt);
  const nextReviewAt = new Date(reviewed.getTime() + intervalDays * DAY_MS);
  return {
    repetition_count: repetitions,
    interval_days: intervalDays,
    ease: Number(ease.toFixed(2)),
    next_review_at: nextReviewAt.toISOString(),
    last_reviewed_at: reviewed.toISOString(),
  };
}
