import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migration-learning-modules.sql', import.meta.url), 'utf8');
const coachMigration = readFileSync(new URL('../db/migration-coach-workflow.sql', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('schema defines learning content tables', () => {
  for (const table of [
    'chapters',
    'questions',
    'question_attempts',
    'exam_questions',
    'chemical_structures',
    'flashcard_decks',
    'flashcards',
    'flashcard_reviews',
  ]) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(schema, /create table if not exists public\.question_review_schedule/);
});

test('question review scheduling is private to each student and indexed by due date', () => {
  assert.match(schema, /primary key \(user_id, question_id\)/);
  assert.match(schema, /idx_question_review_schedule_due/);
  assert.match(schema, /question_review_schedule enable row level security/);
  assert.match(schema, /question_review_schedule_all on public\.question_review_schedule for all[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(coachMigration, /create table if not exists public\.question_review_schedule/);
  assert.match(coachMigration, /distinct on \(user_id, question_id\)/);
  assert.match(coachMigration, /jsonb_array_length\(selected\) > 0/);
  assert.match(coachMigration, /where latest\.is_correct = false[\s\S]*on conflict \(user_id, question_id\) do nothing/);
});

test('schema hardens content rows with checks and reimport keys', () => {
  assert.match(schema, /source_key\s+text unique/);
  assert.match(schema, /slug\s+text unique not null check/);
  assert.match(schema, /jsonb_typeof\(options\) = 'array'/);
  assert.match(schema, /jsonb_array_length\(correct\) >= 1/);
  assert.match(schema, /deck_id\s+uuid not null references public\.flashcard_decks/);
});

test('schema includes production indexes for common reads', () => {
  for (const index of [
    'idx_questions_chapter_active',
    'idx_questions_tags',
    'idx_exam_questions_exam_chapter',
    'idx_flashcard_decks_active',
    'idx_flashcards_deck_active',
    'idx_flashcard_reviews_user_card_reviewed',
  ]) {
    assert.match(schema, new RegExp(`create index if not exists ${index}`));
  }
});

test('analytics views run as security invoker', () => {
  assert.match(schema, /create or replace view public\.flashcard_latest_reviews\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.flashcard_deck_progress\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.scored_answers\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.wrong_answers\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.weak_questions\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.weak_chapters\s+with \(security_invoker=on\) as/);
  assert.match(schema, /create or replace view public\.submission_chapter_results\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.flashcard_latest_reviews\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.flashcard_deck_progress\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.scored_answers\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.wrong_answers\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.weak_questions\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.weak_chapters\s+with \(security_invoker=on\) as/);
  assert.match(migration, /create or replace view public\.submission_chapter_results\s+with \(security_invoker=on\) as/);
});

test('analytics views expose user-scoped topic fields', () => {
  assert.match(schema, /s\.id as submission_id/);
  assert.match(schema, /s\.user_id/);
  assert.match(schema, /coalesce\(nullif\(a->>'subject',''\), eq\.subject\) as subject/);
  assert.match(schema, /coalesce\(nullif\(a->>'chapter_id',''\)::uuid, eq\.chapter_id\) as chapter_id/);
  assert.match(schema, /from public\.scored_answers/);
});

test('flashcard progress views expose latest user review by deck', () => {
  assert.match(schema, /select distinct on \(fr\.user_id, fr\.flashcard_id\)/);
  assert.match(schema, /from public\.flashcard_reviews fr/);
  assert.match(schema, /from public\.flashcard_latest_reviews lr/);
  assert.match(schema, /known_count/);
  assert.match(schema, /due_reviewed_count/);
});

test('migration is rerunnable for added constraints and timestamps', () => {
  assert.match(migration, /if not exists \(select 1 from pg_constraint where conname = 'questions_options_array'/);
  assert.match(migration, /alter table public\.questions add column if not exists updated_at/);
  assert.match(migration, /create or replace function public\.set_updated_at\(\)/);
  assert.match(migration, /drop trigger if exists set_flashcards_updated_at/);
});
