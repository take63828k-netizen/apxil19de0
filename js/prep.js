import { addDays, daysBetween } from './dates.js';

// テストと入試に合わせて出題を早める（設計書 6.9）。記憶の計算（FSRS）の値は変えず、出題を選ぶときだけ使う。
export const PREP_DAYS = 14;

// テストの日の前日まで有効。当日からは使わない
export function activeTest(settings, today) {
  const { testDate, testSubject, testFrom, testTo } = settings;
  if (!testDate || !testSubject || testFrom == null || testTo == null) return null;
  if (today >= testDate) return null;
  return { date: testDate, subject: testSubject, lo: Math.min(testFrom, testTo), hi: Math.max(testFrom, testTo) };
}

export function inTestRange(card, test) {
  return !!test && card.subject === test.subject && typeof card.unit_no === 'number' && card.unit_no >= test.lo && card.unit_no <= test.hi;
}

// 総復習の窓：初日より前に最後に答えたカードは、初日に期日が来た扱いにする
export function prepWindows(settings, today) {
  const out = [];
  if (settings.examDate) out.push({ startDay: addDays(settings.examDate, -settings.bufferDays), match: () => true });
  const test = activeTest(settings, today);
  if (test) out.push({ startDay: addDays(test.date, -PREP_DAYS), match: (c) => inTestRange(c, test) });
  return out;
}

function dayStart(day, hour) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

export function effectiveDue(state, card, windows, dayStartHour, now) {
  let due = new Date(state.due);
  const last = state.last_review ? new Date(state.last_review) : null;
  for (const w of windows) {
    const start = dayStart(w.startDay, dayStartHour);
    if (now >= start && w.match(card) && (!last || last < start) && start < due) due = start;
  }
  return due;
}

// 設定画面の単元の選択肢（その分野の小単元を、単元一覧の No の順に）
export function unitOptions(cards, subject) {
  const byNo = new Map();
  for (const c of cards.values()) {
    if (!c.retired && c.subject === subject && typeof c.unit_no === 'number' && !byNo.has(c.unit_no)) byNo.set(c.unit_no, c.category_small);
  }
  return [...byNo].sort((a, b) => a[0] - b[0]).map(([no, name]) => ({ no, name }));
}

// テストの日になったら、テストの設定を消す（消さないときは同じ物を返す）
export function clearExpiredTest(settings, today) {
  if (!settings.testDate || today < settings.testDate) return settings;
  return { ...settings, testDate: null, testSubject: null, testFrom: null, testTo: null };
}

// 範囲の新しいカードを、準備期間の初日までに出し終える1日の枚数
export function rangeQuota({ rangeUnseen, today, test }) {
  if (!test || rangeUnseen <= 0) return 0;
  const days = Math.max(1, daysBetween(today, addDays(test.date, -PREP_DAYS)));
  return Math.ceil(rangeUnseen / days);
}
