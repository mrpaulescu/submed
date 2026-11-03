import assert from 'node:assert/strict';
import { chooseRecommendedChapter, chooseRecommendedDeck, combineChapterAttempts } from '../assets/js/coach-ranking.js';

function chapter(id, subject = 'biologie', question_count = 20, sort_order = 0) {
  return { id, subject, name: id, question_count, sort_order };
}

const chapters = [
  chapter('most-wrong'),
  chapter('highest-error-rate', 'chimie'),
  chapter('clean'),
  chapter('unstarted', 'chimie', 20, 1),
  chapter('empty', 'biologie', 0),
];

const performance = combineChapterAttempts(
  {
    'most-wrong': { attempts: 30, correct: 12 },
    'highest-error-rate': { attempts: 10, correct: 1 },
    clean: { attempts: 8, correct: 8 },
  },
  [
    { chapter_id: 'most-wrong', attempts: 5, correct: 2, wrong: 3 },
    { chapter_id: 'highest-error-rate', attempts: 4, correct: 1, wrong: 3 },
  ],
);

assert.equal(performance['most-wrong'].wrong, 21);
assert.equal(performance['highest-error-rate'].wrong, 12);
assert.equal(chooseRecommendedChapter(chapters, performance, ['biologie', 'chimie']).id, 'most-wrong');
assert.equal(chooseRecommendedChapter(chapters, {
  clean: { attempts: 8, correct: 8 },
  'most-wrong': { attempts: 4, correct: 4 },
  'highest-error-rate': { attempts: 5, correct: 5 },
}, ['biologie', 'chimie']).id, 'unstarted');
assert.equal(chooseRecommendedChapter(chapters, {}, ['chimie']).id, 'highest-error-rate');
assert.equal(chooseRecommendedChapter([chapters[4]], {}, ['biologie']), null);
const selectedChapter = { id: 'weak' };
const decks = [
  { id: 'chapter-no-due', chapter_id: 'weak', subject: 'biologie', card_count: 20, due_count: 0 },
  { id: 'other-due', chapter_id: 'other', subject: 'biologie', card_count: 30, due_count: 8 },
  { id: 'unselected-due', chapter_id: 'chem', subject: 'chimie', card_count: 30, due_count: 50 },
];
assert.equal(chooseRecommendedDeck(decks, selectedChapter, ['biologie']).id, 'other-due');
assert.equal(chooseRecommendedDeck([
  { ...decks[0], due_count: 2 }, decks[1],
], selectedChapter, ['biologie']).id, 'chapter-no-due');

console.log('ok - coach recommends the chapter with the most wrong answers');
console.log('ok - scanned exam mistakes are combined with practice attempts');
console.log('ok - unstarted and subject-filtered chapters are selected when no mistakes exist');
console.log('ok - coach chooses a due deck while respecting subject and chapter preference');
