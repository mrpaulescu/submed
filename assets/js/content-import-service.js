// ============================================================================
// SubMed content import service
// Orchestrates validation, auto-creation of chapters/decks, and Supabase writes.
// ============================================================================
import {
  normalizeChemicalStructureImport,
  normalizeChapterName,
  normalizeExamTopicImport,
  normalizeFlashcardImport,
  normalizeQuestionImport,
} from './learning-import.js';

export function parseImportJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch (error) { throw new Error(`JSON invalid: ${error.message}`); }
}

function chapterKey(subject, name) {
  return `${subject}|${normalizeChapterName(subject, name).toLowerCase()}`;
}

function countUnique(rows, key) {
  return new Set(rows.map(row => row[key]).filter(Boolean)).size;
}

function summarize(kind, rows) {
  const subjects = countUnique(rows, 'subject');
  const chapters = countUnique(rows, 'chapter');
  return {
    kind,
    inputCount: rows.length,
    subjects,
    chapters,
  };
}

export class ContentImporter {
  constructor({ admin = null, grile = null } = {}) {
    this.Admin = admin;
    this.Grile = grile;
    this.chapters = [];
    this.decks = [];
    this.exams = [];
    this.loaded = false;
    this.createdChapters = [];
    this.createdDecks = [];
  }

  async ensureDeps() {
    if (this.Admin && this.Grile) return;
    const api = await import('./api.js');
    this.Admin = this.Admin || api.Admin;
    this.Grile = this.Grile || api.Grile;
  }

  resetRunStats() {
    this.createdChapters = [];
    this.createdDecks = [];
  }

  async refreshCaches() {
    await this.ensureDeps();
    const [bio, chim, deckRows, exams] = await Promise.all([
      this.Grile.listChapters('biologie'),
      this.Grile.listChapters('chimie'),
      this.Admin.listFlashcardDecks(),
      this.Admin.listExams(),
    ]);
    this.chapters = [...bio, ...chim];
    this.decks = deckRows;
    this.exams = exams;
    this.loaded = true;
    return { chapters: this.chapters, decks: this.decks, exams: this.exams };
  }

  async ensureCaches() {
    if (!this.loaded) await this.refreshCaches();
  }

  validateQuestions(input) {
    const rows = normalizeQuestionImport(parseImportJson(input));
    return { ...summarize('questions', rows), rows };
  }

  validateExamTopics(input) {
    const rows = normalizeExamTopicImport(parseImportJson(input));
    return { ...summarize('exam_topics', rows), rows };
  }

  validateStructures(input) {
    const rows = normalizeChemicalStructureImport(parseImportJson(input));
    return {
      ...summarize('chemical_structures', rows),
      structures: rows.length,
      rows,
    };
  }

  validateFlashcards(input) {
    const rows = normalizeFlashcardImport(parseImportJson(input));
    return {
      ...summarize('flashcards', rows),
      decks: countUnique(rows, 'deck_slug'),
      structures: rows.filter(row => row.chemical_structure).length,
      rows,
    };
  }

  async getOrCreateChapter(subject, name) {
    const cleanName = normalizeChapterName(subject, name);
    if (!cleanName) return null;
    const key = chapterKey(subject, cleanName);
    const matches = this.chapters.filter(chapter => chapterKey(chapter.subject, chapter.name) === key);
    const existing = matches.find(chapter => String(chapter.name || '').trim().toLowerCase() === cleanName.toLowerCase())
      || matches[0];
    if (existing) return existing.id;

    try {
      const created = await this.Admin.createChapter({
        subject,
        name: cleanName,
        sort_order: this.chapters.length + 1,
      });
      this.chapters.push({ ...created, question_count: 0 });
      this.createdChapters.push(created);
      return created.id;
    } catch (error) {
      // If a concurrent import created it first, refresh once and resolve from cache.
      if (error?.code !== '23505') throw error;
      await this.refreshCaches();
      const retryMatches = this.chapters.filter(chapter => chapterKey(chapter.subject, chapter.name) === key);
      const retry = retryMatches.find(chapter => String(chapter.name || '').trim().toLowerCase() === cleanName.toLowerCase())
        || retryMatches[0];
      if (!retry) throw error;
      return retry.id;
    }
  }

  async getOrCreateDeck(row, chapterId) {
    const existing = this.decks.find(deck => deck.slug && deck.slug === row.deck_slug)
      || this.decks.find(deck =>
        deck.subject === row.subject
        && deck.chapter_id === chapterId
        && String(deck.title).toLowerCase() === String(row.deck).toLowerCase());
    if (existing) return existing.id;

    const created = await this.Admin.upsertFlashcardDeck({
      subject: row.subject,
      chapter_id: chapterId,
      slug: row.deck_slug,
      title: row.deck,
      source: row.source,
      active: true,
    });
    this.decks.push(created);
    this.createdDecks.push(created);
    return created.id;
  }

  async importQuestions(input) {
    this.resetRunStats();
    const validation = this.validateQuestions(input);
    await this.ensureCaches();

    const payload = [];
    for (const row of validation.rows) {
      const chapterId = await this.getOrCreateChapter(row.subject, row.chapter);
      payload.push({
        source_key: row.source_key,
        chapter_id: chapterId,
        text: row.text,
        options: row.options,
        correct: row.correct,
        multiple: row.multiple,
        explanation: row.explanation,
        difficulty: row.difficulty,
        source: row.source,
        tags: row.tags,
      });
    }

    const savedCount = await this.Admin.importQuestions(payload);
    return {
      ...validation,
      savedCount,
      createdChapters: this.createdChapters.length,
    };
  }

  async importExamTopics(examId, input) {
    if (!examId) throw new Error('Alege examenul.');
    this.resetRunStats();
    const validation = this.validateExamTopics(input);
    await this.ensureCaches();

    const payload = [];
    for (const row of validation.rows) {
      const chapterId = row.chapter_id || await this.getOrCreateChapter(row.subject, row.chapter);
      payload.push({ ...row, chapter_id: chapterId });
    }

    const savedCount = await this.Admin.saveExamQuestionTopics(examId, payload);
    return {
      ...validation,
      savedCount,
      createdChapters: this.createdChapters.length,
    };
  }

  async importStructures(input) {
    this.resetRunStats();
    const validation = this.validateStructures(input);
    await this.ensureCaches();

    const payload = [];
    for (const row of validation.rows) {
      const chapterId = row.chapter_id || await this.getOrCreateChapter(row.subject, row.chapter);
      payload.push({ ...row, chapter_id: chapterId });
    }

    const saved = await this.Admin.upsertChemicalStructures(payload);
    return {
      ...validation,
      savedCount: saved.length,
      createdChapters: this.createdChapters.length,
    };
  }

  async importFlashcards(input) {
    this.resetRunStats();
    const validation = this.validateFlashcards(input);
    await this.ensureCaches();

    const prepared = [];
    const structures = [];
    for (const row of validation.rows) {
      const chapterId = await this.getOrCreateChapter(row.subject, row.chapter);
      const deckId = await this.getOrCreateDeck(row, chapterId);
      let structureSlug = null;
      if (row.chemical_structure) {
        const structureChapterId = row.chemical_structure.chapter_id
          || await this.getOrCreateChapter(row.chemical_structure.subject, row.chemical_structure.chapter)
          || chapterId;
        structures.push({ ...row.chemical_structure, chapter_id: structureChapterId });
        structureSlug = row.chemical_structure.slug;
      }
      prepared.push({ row, chapterId, deckId, structureSlug });
    }

    const uniqueStructures = [...new Map(structures.map(structure => [structure.slug, structure])).values()];
    const upserted = uniqueStructures.length
      ? await this.Admin.upsertChemicalStructures(uniqueStructures)
      : [];
    const structureMap = new Map(upserted.map(structure => [structure.slug, structure.id]));

    const cards = prepared.map(({ row, chapterId, deckId, structureSlug }) => ({
      source_key: row.source_key,
      deck_id: deckId,
      chapter_id: chapterId,
      chemical_structure_id: structureSlug ? structureMap.get(structureSlug) || null : null,
      front: row.front,
      back: row.back,
      card_type: row.card_type,
      tags: row.tags,
      difficulty: row.difficulty,
      source: row.source,
      active: true,
    }));

    const savedCount = await this.Admin.importFlashcards(cards);
    return {
      ...validation,
      savedCount,
      createdChapters: this.createdChapters.length,
      createdDecks: this.createdDecks.length,
      savedStructures: upserted.length,
    };
  }
}
