import { addDays, daysBetween } from './dates.js';

// テストと入試に合わせて出題を早める（設計書 6.9）。記憶の計算（FSRS）の値は変えず、出題を選ぶときだけ使う。
export const PREP_DAYS = 14;
// 入試の総復習：入試の40日前から、全カードを最初の20日間へ単元の順に均等に割り振る（固定の仕様。設定では変えない）
export const EXAM_PREP_DAYS = 40;
export const EXAM_SPREAD_DAYS = 20;

function spreadOffsets(cards) {
  const ids = [...cards.values()].filter((c) => !c.retired)
    .sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0) || (a.order ?? 0) - (b.order ?? 0))
    .map((c) => c.card_id);
  return new Map(ids.map((id, i) => [id, Math.floor((i * EXAM_SPREAD_DAYS) / ids.length)]));
}

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

// 総復習の窓：初日より前に最後に答えたカードは、割り振った日（offsetOf：初日からの日数）に期日が来た扱いにする
export function prepWindows(settings, today, cards = new Map()) {
  const out = [];
  if (settings.examDate) {
    const offsets = spreadOffsets(cards);
    out.push({ startDay: addDays(settings.examDate, -EXAM_PREP_DAYS), match: () => true, offsetOf: (c) => offsets.get(c.card_id) ?? 0 });
  }
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
    const at = w.offsetOf ? dayStart(addDays(w.startDay, w.offsetOf(card)), dayStartHour) : start;
    if (now >= at && w.match(card) && (!last || last < start) && at < due) due = at;
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
