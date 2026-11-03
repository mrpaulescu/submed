import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const plan = readFileSync(new URL('../plan.html', import.meta.url), 'utf8');
const grile = readFileSync(new URL('../grile.html', import.meta.url), 'utf8');
const flashcards = readFileSync(new URL('../flashcards.html', import.meta.url), 'utf8');
const recommendations = readFileSync(new URL('../assets/js/coach-recommendations.js', import.meta.url), 'utf8');
const account = readFileSync(new URL('../user.html', import.meta.url), 'utf8');

assert.match(plan, /id="dailySessionCard"/);
assert.match(plan, /id="coachSessionStart"/);
assert.match(plan, /beginStudySession/);
assert.match(plan, /finishStudySession/);
assert.match(plan, /id="weeklyPlanList"/);
assert.match(plan, /id="recommendationWhy"/);

const weeklyCalls = [...plan.matchAll(/buildWeeklyStudyPlan\(\{([\s\S]*?)\n\s*\}\)/g)];
assert.equal(weeklyCalls.length, 2);
weeklyCalls.forEach(([, args]) => assert.match(args, /subjects:\s*plan\.subjects/));
assert.match(plan, /if \(!plan\.questionReviewAvailable\)[^\n]+/);

assert.match(grile, /coachParams\.get\('mode'\) === 'mistakes'/);
assert.match(grile, /Grile\.listDueReviews/);
assert.match(flashcards, /dueOnlyMode = params\.get\('due'\) === '1'/);
assert.match(flashcards, /if \(!Number\.isFinite\(reviewTime\) \|\| reviewTime > now\) return/);
assert.match(recommendations, /localPreferences\(user\?\.id\)/);
assert.match(recommendations, /submed_prefs_\$\{userId\}/);
assert.doesNotMatch(recommendations, /submed_onboarding|localStorage\.getItem\('submed_prefs'\)/);
assert.match(account, /\$\{PREF_KEY\}_\$\{accountUser\.id\}/);
assert.doesNotMatch(account, /localStorage\.getItem\('submed_onboarding'\)|localStorage\.setItem\(PREF_KEY/);

console.log('ok - dashboard wires personalized sessions, subject-scoped weekly plans and due-review routes');
