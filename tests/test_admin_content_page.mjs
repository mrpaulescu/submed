import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin-content.html', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('admin content page loads the content import service', () => {
  assert.match(html, /from '\.\/assets\/js\/content-import-service\.js'/);
  assert.match(html, /new ContentImporter\(\)/);
});

test('admin content page exposes all import panels', () => {
  for (const id of [
    'questionsJson',
    'topicsJson',
    'flashcardsJson',
    'structuresJson',
    'validateQuestions',
    'validateTopics',
    'validateFlashcards',
    'validateStructures',
    'importQuestions',
    'importTopics',
    'importFlashcards',
    'importStructures',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('admin content page auto-creates chapters and decks', () => {
  assert.match(html, /importer\.importQuestions/);
  assert.match(html, /importer\.importExamTopics/);
  assert.match(html, /importer\.importFlashcards/);
  assert.match(html, /importer\.importStructures/);
});

test('admin content page validates json before save', () => {
  assert.match(html, /importer\.validateQuestions/);
  assert.match(html, /importer\.validateExamTopics/);
  assert.match(html, /importer\.validateFlashcards/);
  assert.match(html, /importer\.validateStructures/);
  assert.match(html, /JSON valid:/);
});
