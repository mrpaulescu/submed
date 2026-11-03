import assert from 'node:assert/strict';
import { buildDailyStudySession, buildWeeklyStudyPlan, compareSessionProgress } from '../assets/js/coach-workflow.js';
import { scheduleQuestionReview, shouldScheduleQuestionReview } from '../assets/js/question-review-srs.js';

const chapter = { id: 'weak', name: 'Celula', subject: 'biologie', question_count: 80, sort_order: 1 };
const steps = buildDailyStudySession({
  chapter,
  chapterHref: 'grile.html?chapter=weak',
  deck: { due_count: 7 },
  deckHref: 'flashcards.html?subject=biologie&chapter=weak',
  dueQuestionCount: 4,
  dailyMinutes: 60,
  subjectLabel: 'Biologie',
});
assert.deepEqual(steps.map(step => step.id), ['mistakes', 'flashcards', 'practice']);
assert.equal(steps.reduce((sum, step) => sum + step.minutes, 0), 60);
assert.match(steps[0].href, /mode=mistakes/);
assert.match(steps[1].href, /due=1/);
assert.match(steps[2].href, /count=/);
assert.deepEqual(buildDailyStudySession({ chapter: null }), []);

const weekly = buildWeeklyStudyPlan({
  chapters: [chapter, { ...chapter, id: 'middle', name: 'Genetică', sort_order: 2 }, { ...chapter, id: 'steady', name: 'Sânge', sort_order: 3 }, { ...chapter, id: 'chem', name: 'Chimie', subject: 'chimie', sort_order: 4 }],
  subjects: ['biologie'],
  performance: {
    weak: { attempts: 10, correct: 3, wrong: 7 },
    middle: { attempts: 10, correct: 8, wrong: 2 },
    steady: { attempts: 10, correct: 10, wrong: 0 },
  },
  dailyMinutes: 60,
  nextExam: { name: 'Simulare', date: '2027-02-04' },
  today: new Date('2027-02-01T12:00:00'),
});
assert.equal(weekly.days.length, 3);
assert.equal(weekly.daysToExam, 3);
assert.deepEqual(weekly.days.map(day => day.chapter.id), ['weak', 'middle', 'steady']);
assert.equal(buildWeeklyStudyPlan({ chapters: [], today: new Date('2027-02-01T00:00:00') }).days.length, 0);

assert.deepEqual(compareSessionProgress({
  baselineAttempts: 10,
  baselineCorrect: 6,
  finalAttempts: 15,
  finalCorrect: 10,
  baselineDueCards: 8,
  finalDueCards: 3,
  baselineKnownCards: 12,
  finalKnownCards: 15,
}), {
  addedAttempts: 5,
  addedCorrect: 4,
  addedWrong: 1,
  beforeAccuracy: 60,
  afterAccuracy: 67,
  sessionAccuracy: 80,
  accuracyChange: 7,
  reviewedFlashcards: 5,
  newlyKnownFlashcards: 3,
});

const firstMiss = scheduleQuestionReview({}, false, new Date('2027-01-01T10:00:00Z'));
assert.equal(firstMiss.repetition_count, 0);
assert.equal(firstMiss.interval_days, 1);
assert.equal(firstMiss.next_review_at, '2027-01-02T10:00:00.000Z');
const firstRecall = scheduleQuestionReview(firstMiss, true, new Date('2027-01-02T10:00:00Z'));
assert.equal(firstRecall.repetition_count, 1);
assert.equal(firstRecall.interval_days, 1);
const secondRecall = scheduleQuestionReview(firstRecall, true, new Date('2027-01-03T10:00:00Z'));
assert.equal(secondRecall.repetition_count, 2);
assert.equal(secondRecall.interval_days, 3);
assert.equal(scheduleQuestionReview(secondRecall, false, new Date('2027-01-06T10:00:00Z')).interval_days, 1);
assert.equal(shouldScheduleQuestionReview(null, false), true);
assert.equal(shouldScheduleQuestionReview(null, true), false);
assert.equal(shouldScheduleQuestionReview(firstMiss, true), true);

console.log('ok - daily study sessions combine due mistakes, flashcards and focused questions');
console.log('ok - exam plans prioritize weak chapters and avoid repeating the same chapter back to back');
console.log('ok - session outcome compares recorded accuracy before and after studying');
console.log('ok - wrong questions return sooner and correct recalls space out over time');
console.log('ok - correct answers enter spaced review only after a prior mistake');
