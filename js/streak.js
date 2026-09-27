import { addDays, daysBetween } from './dates.js';

export function computeStreak(studiedDays, today, { graceWindow = 7 } = {}) {
  let d = studiedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  let lastGrace = null;
  for (;;) {
    if (studiedDays.has(d)) { streak++; d = addDays(d, -1); continue; }
    const prev = addDays(d, -1);
    const graceOk = lastGrace === null || daysBetween(d, lastGrace) >= graceWindow;
    if (studiedDays.has(prev) && graceOk) { lastGrace = d; d = prev; continue; }
    return streak;
  }
}
