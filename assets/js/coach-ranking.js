export function combineChapterAttempts(questionAttempts = {}, scannedAttempts = []) {
  const combined = {};
  Object.entries(questionAttempts || {}).forEach(([chapterId, value]) => {
    const attempts = Number(value.attempts) || 0;
    const correct = Number(value.correct) || 0;
    combined[chapterId] = { attempts, correct, wrong: Math.max(0, attempts - correct) };
  });
  (scannedAttempts || []).forEach(row => {
    if (!row.chapter_id) return;
    const stats = combined[row.chapter_id] || { attempts: 0, correct: 0, wrong: 0 };
    const attempts = Number(row.attempts) || 0;
    const correct = Number(row.correct) || 0;
    stats.attempts += attempts;
    stats.correct += correct;
    stats.wrong += row.wrong != null && Number.isFinite(Number(row.wrong))
      ? Math.max(0, Number(row.wrong))
      : Math.max(0, attempts - correct);
    combined[row.chapter_id] = stats;
  });
  return combined;
}

export function chooseRecommendedChapter(chapters, stats, subjects = []) {
  const subjectOrder = new Map(subjects.map((subject, index) => [subject, index]));
  return chapters
    .filter(chapter => chapter.question_count > 0 && (!subjects.length || subjectOrder.has(chapter.subject)))
    .map(chapter => {
      const progress = stats[chapter.id] || { attempts: 0, correct: 0, wrong: 0 };
      const attempts = Number(progress.attempts) || 0;
      const correct = Number(progress.correct) || 0;
      const wrong = Math.max(Number(progress.wrong) || 0, attempts - correct);
      const accuracy = attempts ? Math.round(correct / attempts * 100) : null;
      const urgency = wrong > 0 ? 0 : attempts === 0 ? 1 : 2;
      return {
        ...chapter,
        attempts,
        correct,
        wrong,
        accuracy,
        urgency,
        subjectRank: subjectOrder.get(chapter.subject) ?? 99,
      };
    })
    .sort((a, b) => a.urgency - b.urgency
      || (a.urgency === 0 ? (b.wrong - a.wrong) || (a.accuracy - b.accuracy) : 0)
      || a.subjectRank - b.subjectRank
      || (a.attempts || 0) - (b.attempts || 0)
      || (a.sort_order || 0) - (b.sort_order || 0))[0] || null;
}

export function chooseRecommendedDeck(decks, chapter, subjects = []) {
  const eligible = (decks || []).filter(deck => Number(deck.card_count) > 0
    && (!subjects.length || subjects.includes(deck.subject)));
  const matching = eligible.find(deck => chapter && deck.chapter_id === chapter.id) || null;
  if (matching && Number(matching.due_count) > 0) return matching;

  const due = eligible.filter(deck => Number(deck.due_count) > 0)
    .sort((a, b) => Number(b.due_count) - Number(a.due_count)
      || Number(b.card_count) - Number(a.card_count)
      || (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  if (due.length) return due[0];
  if (matching) return matching;
  return eligible.sort((a, b) => Number(b.card_count) - Number(a.card_count)
    || (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))[0] || null;
}
