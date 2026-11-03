import { API, Coach, Flashcards, Grile, Profiles } from './api.js';
import { Auth } from './auth.js';
import { chooseRecommendedChapter, chooseRecommendedDeck, combineChapterAttempts } from './coach-ranking.js';
import { buildDailyStudySession, buildWeeklyStudyPlan } from './coach-workflow.js';

const SUBJECT_NAMES = { biologie: 'Biologie', chimie: 'Chimie' };
const CENTER_NAMES = {
  cluj: 'UMF Cluj-Napoca',
  iasi: 'UMF Iași',
  mures: 'Târgu Mureș',
};

function localPreferences(userId) {
  if (!userId) return {};
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (error) { return {}; }
  };
  return read(`submed_prefs_${userId}`);
}

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function getCoachRecommendations() {
  const results = await Promise.allSettled([
    Auth.getUser(),
    Profiles.getPreferences(),
    Grile.listChapters(),
    Grile.myPerformance(),
    API.weakChapters(null, 1000),
    Flashcards.listDecks(),
    Coach.listExams(),
    API.myStats(),
    API.listExams(),
    Grile.listDueReviews(1000),
  ]);
  const value = (index, fallback) => results[index].status === 'fulfilled' ? results[index].value : fallback;
  const user = value(0, null);
  const savedPreferences = value(1, null);
  const preferences = savedPreferences || localPreferences(user?.id);
  let subjects = [...new Set((preferences.subjects || [])
    .map(subject => subject === 'chimie-anorg' ? 'chimie' : subject)
    .filter(subject => subject in SUBJECT_NAMES))];
  const chapters = value(2, []);
  if (!subjects.length) subjects = [...new Set(chapters.map(chapter => chapter.subject))];
  const performance = combineChapterAttempts(value(3, {}), value(4, []));
  const chapter = chooseRecommendedChapter(chapters, performance, subjects);
  const decks = value(5, []);
  const deck = chooseRecommendedDeck(decks, chapter, subjects);
  const today = todayAtMidnight();
  const exams = value(6, []).map(exam => ({
    ...exam,
    localDate: exam.date ? new Date(`${exam.date}T00:00:00`) : null,
  }));
  const nextExam = exams
    .filter(exam => exam.localDate && exam.localDate >= today)
    .sort((a, b) => a.localDate - b.localDate)[0] || null;
  const papers = value(8, []);
  const paper = papers
    .filter(exam => !preferences.center || (exam.faculty_slug || exam.sheet_type) === preferences.center)
    .sort((a, b) => (b.year || 0) - (a.year || 0))[0] || null;
  const minutesByGoal = { admis: 60, top: 90, max: 120 };
  const dailyMinutes = Math.max(30, Math.min(240,
    Number(preferences.settings?.coach_daily_minutes) || minutesByGoal[preferences.goal] || 60));
  const chapterHref = chapter
    ? `grile.html?chapter=${encodeURIComponent(chapter.id)}&subject=${encodeURIComponent(chapter.subject)}&mode=practice`
    : 'grile.html';
  const deckBaseHref = deck
    ? `flashcards.html?subject=${encodeURIComponent(deck.subject)}${deck.chapter_id ? `&chapter=${encodeURIComponent(deck.chapter_id)}` : ''}`
    : 'flashcards.html';
  const deckHref = deck && deck.due_count > 0 ? `${deckBaseHref}&due=1` : deckBaseHref;
  const dueQuestions = value(9, []).filter(question => !subjects.length || subjects.includes(question.subject));
  const sessionHistory = Array.isArray(preferences.settings?.coach_sessions)
    ? [...preferences.settings.coach_sessions]
    : [];
  sessionHistory.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));
  const peerChapters = chapters
    .filter(item => item.question_count > 0 && (!subjects.length || subjects.includes(item.subject)))
    .map(item => ({ ...item, ...(performance[item.id] || { attempts: 0, correct: 0, wrong: 0 }) }))
    .sort((a, b) => (Number(b.wrong) || 0) - (Number(a.wrong) || 0)
      || ((Number(a.attempts) ? Number(a.correct) / Number(a.attempts) : 1)
        - (Number(b.attempts) ? Number(b.correct) / Number(b.attempts) : 1))
      || (a.sort_order || 0) - (b.sort_order || 0));
  const chapterRank = chapter ? peerChapters.findIndex(item => item.id === chapter.id) + 1 : null;
  const reason = !chapter
    ? 'Nu este încă disponibil un capitol cu set de întrebări pentru preferințele curente.'
    : chapter.wrong > 0
      ? `Ai greșit ${chapter.wrong} din ${chapter.attempts} răspunsuri la acest capitol (${chapter.accuracy}% corecte). Este capitolul cu cele mai multe greșeli dintre ${peerChapters.length} capitole disponibile pentru materiile tale.`
      : chapter.attempts
        ? `${chapter.attempts} răspunsuri înregistrate. Continuă cu acest capitol și consolidează ce ai lucrat.`
        : 'Capitol disponibil în materiile tale, încă fără răspunsuri înregistrate.';
  const dailySession = buildDailyStudySession({
    chapter,
    chapterHref,
    deck,
    deckHref: deckBaseHref,
    dueQuestionCount: dueQuestions.length,
    dailyMinutes,
    subjectLabel: chapter ? SUBJECT_NAMES[chapter.subject] : null,
    subjects,
  });
  const weeklyPlan = buildWeeklyStudyPlan({
    chapters: peerChapters,
    performance,
    dailyMinutes,
    nextExam,
    completedSessions: sessionHistory,
    today,
  });

  return {
    preferences,
    subjects,
    chapters,
    performance,
    decks,
    exams,
    dueQuestions,
    questionReviewAvailable: results[9].status === 'fulfilled',
    sessionHistory,
    activeStudySession: sessionHistory.find(session => !session.completed_at) || null,
    latestStudySession: sessionHistory[0] || null,
    dailySession,
    weeklyPlan,
    stats: value(7, null),
    chapter,
    chapterRank,
    eligibleChapterCount: peerChapters.length,
    deck,
    nextExam,
    paper,
    dailyMinutes,
    chapterHref,
    deckHref,
    reason,
    centerLabel: CENTER_NAMES[preferences.center] || null,
    subjectLabel: chapter ? SUBJECT_NAMES[chapter.subject] : null,
    chapterCount: chapters.filter(item => !subjects.length || subjects.includes(item.subject)).length,
    studiedChapterCount: chapters.filter(item => (!subjects.length || subjects.includes(item.subject)) && performance[item.id]?.attempts > 0).length,
  };
}

export const CoachLabels = { SUBJECT_NAMES, CENTER_NAMES };
