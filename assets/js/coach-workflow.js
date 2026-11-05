const DAY_MS = 24 * 60 * 60 * 1000;

function boundedMinutes(value, fallback = 60) {
  const minutes = Number(value) || fallback;
  return Math.max(30, Math.min(240, Math.round(minutes)));
}

export function buildDailyStudySession({
  chapter,
  chapterHref = 'grile.html',
  deck = null,
  deckHref = 'flashcards.html',
  dueQuestionCount = 0,
  dailyMinutes = 60,
  subjectLabel = null,
  subjects = [],
} = {}) {
  if (!chapter) return [];
  const totalMinutes = boundedMinutes(dailyMinutes);
  const dueQuestions = Math.max(0, Number(dueQuestionCount) || 0);
  const dueCards = deck ? Math.max(0, Number(deck.due_count) || 0) : 0;
  const reviewMinutes = dueQuestions ? Math.min(15, Math.max(5, Math.round(totalMinutes * 0.2))) : 0;
  const cardMinutes = dueCards ? Math.min(15, Math.max(5, Math.round(totalMinutes * 0.2))) : 0;
  const questionMinutes = Math.max(10, totalMinutes - reviewMinutes - cardMinutes);
  const chapterName = `${subjectLabel ? `${subjectLabel} · ` : ''}${chapter.name}`;
  const steps = [];

  if (dueQuestions) {
    const count = Math.min(10, dueQuestions);
    const reviewSubject = subjects.length === 1 ? `&subject=${encodeURIComponent(subjects[0])}` : '';
    steps.push({
      id: 'mistakes',
      title: `Reia ${count} ${count === 1 ? 'întrebare greșită' : 'întrebări greșite'}`,
      detail: 'Întrebările ajunse la termen, din toate capitolele tale.',
      href: `grile.html?mode=mistakes&count=${count}${reviewSubject}`,
      minutes: reviewMinutes,
      count,
    });
  }

  if (dueCards) {
    const count = Math.min(20, dueCards);
    steps.push({
      id: 'flashcards',
      title: `Repetă ${count} ${count === 1 ? 'flashcard' : 'flashcarduri'}`,
      detail: deck.chapter_name ? `Setul pentru ${deck.chapter_name}.` : `Setul de repetare potrivit materiei tale.`,
      href: `${deckHref}${deckHref.includes('?') ? '&' : '?'}due=1&count=${count}`,
      minutes: cardMinutes,
      count,
    });
  }

  const questionCount = Math.min(20, Math.max(5, Math.floor(questionMinutes / 2)));
  steps.push({
    id: 'practice',
    title: `Rezolvă ${questionCount} grile din ${chapter.name}`,
    detail: 'Lucrează țintit pe capitolul prioritar din progresul tău.',
    href: `${chapterHref}${chapterHref.includes('?') ? '&' : '?'}count=${questionCount}`,
    minutes: questionMinutes,
    count: questionCount,
  });
  return steps;
}

export function buildWeeklyStudyPlan({
  chapters = [],
  subjects = [],
  performance = {},
  dailyMinutes = 60,
  nextExam = null,
  completedSessions = [],
  today = new Date(),
} = {}) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const examDate = nextExam?.localDate instanceof Date && Number.isFinite(nextExam.localDate.getTime())
    ? new Date(nextExam.localDate)
    : nextExam?.date
      ? new Date(`${nextExam.date}T00:00:00`)
      : null;
  const daysToExam = examDate ? Math.max(0, Math.ceil((examDate - start) / DAY_MS)) : null;
  const horizon = daysToExam == null ? 7 : Math.max(1, Math.min(7, daysToExam || 1));
  const weeklySessions = completedSessions.filter(session => {
    if (!session.completed_at) return false;
    const completed = new Date(session.completed_at);
    return Number.isFinite(completed.getTime()) && completed >= start;
  });
  // Use measured session duration (not just the configured target) to keep
  // future plans realistic. Older sessions without duration remain valid.
  const measuredSessions = completedSessions
    .filter(session => session.completed_at && Number(session.actual_minutes) > 0)
    .slice(0, 7);
  const averageActualMinutes = measuredSessions.length
    ? measuredSessions.reduce((sum, session) => sum + Number(session.actual_minutes), 0) / measuredSessions.length
    : null;
  const effectiveDailyMinutes = averageActualMinutes == null
    ? boundedMinutes(dailyMinutes)
    : averageActualMinutes < boundedMinutes(dailyMinutes) * 0.75
      ? Math.max(30, Math.min(boundedMinutes(dailyMinutes), Math.round(averageActualMinutes * 1.1 / 5) * 5))
      : boundedMinutes(dailyMinutes);
  const recencyByChapter = new Map();
  weeklySessions.forEach((session, index) => {
    if (!session.chapter_id) return;
    recencyByChapter.set(session.chapter_id, Math.max(recencyByChapter.get(session.chapter_id) || 0, weeklySessions.length - index));
  });

  const candidates = chapters.filter(chapter => Number(chapter.question_count) > 0
    && (!subjects.length || subjects.includes(chapter.subject))).map(chapter => {
    const stats = performance[chapter.id] || {};
    const attempts = Number(stats.attempts) || 0;
    const correct = Number(stats.correct) || 0;
    const wrong = Math.max(Number(stats.wrong) || 0, attempts - correct);
    return { ...chapter, attempts, correct, wrong, accuracy: attempts ? correct / attempts : null };
  });
  if (!candidates.length) return { days: [], daysToExam, exam: nextExam };

  const days = [];
  const lastChapterIds = [];
  for (let offset = 0; offset < horizon; offset++) {
    const date = new Date(start.getTime() + offset * DAY_MS);
    const ranked = [...candidates].sort((a, b) => {
      const aRecent = recencyByChapter.get(a.id) || 0;
      const bRecent = recencyByChapter.get(b.id) || 0;
      const aRepeatPenalty = lastChapterIds.includes(a.id) ? 1 : 0;
      const bRepeatPenalty = lastChapterIds.includes(b.id) ? 1 : 0;
      return aRepeatPenalty - bRepeatPenalty
        || b.wrong - a.wrong
        || (a.accuracy ?? 1) - (b.accuracy ?? 1)
        || aRecent - bRecent
        || (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    });
    const chapter = ranked[0];
    lastChapterIds.push(chapter.id);
    if (lastChapterIds.length > 2) lastChapterIds.shift();
    const isExamEve = daysToExam != null && daysToExam > 0 && offset === daysToExam - 1;
    days.push({
      date,
      chapter,
      minutes: effectiveDailyMinutes,
      focus: isExamEve ? 'Recapitulare ușoară înainte de examen' : chapter.wrong
        ? `Consolidează ${chapter.name} · ${chapter.wrong} răspunsuri greșite`
        : chapter.attempts ? `Continuă cu ${chapter.name}` : `Începe ${chapter.name}`,
      href: `grile.html?chapter=${encodeURIComponent(chapter.id)}&subject=${encodeURIComponent(chapter.subject)}&mode=practice&count=10`,
    });
  }
  return { days, daysToExam, exam: nextExam, averageActualMinutes, effectiveDailyMinutes };
}

export function compareSessionProgress({
  baselineAttempts = 0,
  baselineCorrect = 0,
  finalAttempts = 0,
  finalCorrect = 0,
  baselineDueCards = 0,
  finalDueCards = 0,
  baselineKnownCards = 0,
  finalKnownCards = 0,
} = {}) {
  const beforeAttempts = Math.max(0, Number(baselineAttempts) || 0);
  const beforeCorrect = Math.max(0, Number(baselineCorrect) || 0);
  const afterAttempts = Math.max(beforeAttempts, Number(finalAttempts) || 0);
  const afterCorrect = Math.max(beforeCorrect, Number(finalCorrect) || 0);
  const addedAttempts = afterAttempts - beforeAttempts;
  const addedCorrect = afterCorrect - beforeCorrect;
  const beforeAccuracy = beforeAttempts ? Math.round(beforeCorrect / beforeAttempts * 100) : null;
  const afterAccuracy = afterAttempts ? Math.round(afterCorrect / afterAttempts * 100) : null;
  const sessionAccuracy = addedAttempts ? Math.round(addedCorrect / addedAttempts * 100) : null;
  const beforeDueCards = Math.max(0, Number(baselineDueCards) || 0);
  const afterDueCards = Math.max(0, Number(finalDueCards) || 0);
  const beforeKnownCards = Math.max(0, Number(baselineKnownCards) || 0);
  const afterKnownCards = Math.max(0, Number(finalKnownCards) || 0);
  return {
    addedAttempts,
    addedCorrect,
    addedWrong: Math.max(0, addedAttempts - addedCorrect),
    beforeAccuracy,
    afterAccuracy,
    sessionAccuracy,
    accuracyChange: beforeAccuracy == null || afterAccuracy == null ? null : afterAccuracy - beforeAccuracy,
    reviewedFlashcards: Math.max(0, beforeDueCards - afterDueCards),
    newlyKnownFlashcards: Math.max(0, afterKnownCards - beforeKnownCards),
  };
}
