import { addDays, daysBetween } from './dates.js';
import { rangeQuota, EXAM_PREP_DAYS } from './prep.js';

// 新しいカードの期限は、入試の総復習の初日（入試の40日前）で固定
export function newCardQuota({ unseenCount, today, examDate, dueCount, backlogLimit }) {
  if (!examDate || unseenCount <= 0) return 0;
  if (dueCount > backlogLimit) return 0;
  const deadline = addDays(examDate, -EXAM_PREP_DAYS);
  const daysLeft = Math.max(1, daysBetween(today, deadline));
  return Math.ceil(unseenCount / daysLeft);
}

// 今日すでに出した枚数を未出題へ足し戻して計算するので、途中で計算し直しても1日分が上乗せされない
export function dailyNewQuota({ unseenCount, rangeUnseen, introduced, introducedRange, today, examDate, dueCount, backlogLimit, test }) {
  const normal = newCardQuota({ unseenCount: unseenCount + introduced, today, examDate, dueCount, backlogLimit });
  const range = dueCount > backlogLimit ? 0 : rangeQuota({ rangeUnseen: rangeUnseen + introducedRange, today, test });
  return Math.max(introduced, normal, range);
}

export function startLabel(remain, sessionSize) {
  return remain > 0 ? `${Math.min(remain, sessionSize)}問スタート` : '今日の分はクリア！';
}

export function remainLabel(remain) {
  return remain > 0 ? `のこり ${remain} 問` : '今日の学習は完了！🎉';
}

// 記憶の計算が「10分後にもう一度」としていても、今日の最後の答えが正解なら今日はもう出さない
export function clearedToday(logs, day) {
  const last = new Map();
  for (const l of logs) if (l.day === day && (!last.has(l.card_id) || l.at >= last.get(l.card_id).at)) last.set(l.card_id, l);
  return new Set([...last.values()].filter((l) => l.rating !== 'again').map((l) => l.card_id));
}

// dueOf：出題を選ぶときの期日（テスト・入試の総復習で早めるとき。prep.js の effectiveDue）
// until：この時刻までに期日が来るカードを選ぶ（今日の終わりを渡すと、今日のうちに期日が来るものを数える）。skip：今日は済みのカード
export function dueCardIds({ cards, states, now, dueOf = (s) => s.due, until = now, skip = new Set() }) {
  const out = [];
  for (const s of states.values()) {
    const c = cards.get(s.card_id);
    if (!c || c.retired || !s.due || skip.has(s.card_id)) continue;
    const due = dueOf(s, c);
    if (due <= until) out.push({ id: s.card_id, due });
  }
  out.sort((a, b) => a.due - b.due);
  return out.map((x) => x.id);
}

// first：先に出すカード（テストの範囲）
export function unseenCardIds({ cards, states, first = () => false }) {
  return [...cards.values()]
    .filter((c) => !c.retired && !states.has(c.card_id))
    .sort((a, b) => Number(first(b)) - Number(first(a)) || (a.unit_order ?? 0) - (b.unit_order ?? 0) || a.priority - b.priority || a.order - b.order)
    .map((c) => c.card_id);
}

export function createSession(ids, { reinsertGap = 5, maxReinserts = 2 } = {}) {
  const queue = ids.map((id) => ({ id, repeat: false }));
  const reinserts = new Map();
  let pos = 0;
  let done = 0;
  return {
    current() { return queue[pos] ?? null; },
    answer(rating) {
      const item = queue[pos];
      if (!item) throw new Error('セッションは終わっています');
      if (!item.repeat) done++;
      if (rating === 'again') {
        const n = reinserts.get(item.id) ?? 0;
        if (n < maxReinserts) {
          reinserts.set(item.id, n + 1);
          const at = Math.min(pos + 1 + reinsertGap, queue.length);
          queue.splice(at, 0, { id: item.id, repeat: true });
        }
      }
      pos++;
      return item;
    },
    isDone() { return pos >= queue.length; },
    progress() { return { done, total: ids.length }; },
  };
}

export function pickWeakIds({ cards, states, logs, now, count = 10, lapseDays = 7 }) {
  const since = now.getTime() - lapseDays * 86400000;
  const usable = (id) => { const c = cards.get(id); const s = states.get(id); return c && !c.retired && s && s.reps > 0; };
  const recent = logs.filter((l) => l.rating === 'again' && l.at >= since).sort((a, b) => b.at - a.at).map((l) => l.card_id);
  const hard = [...states.values()].sort((a, b) => b.difficulty - a.difficulty).map((s) => s.card_id);
  const out = [];
  for (const id of [...recent, ...hard]) {
    if (out.length >= count) break;
    if (usable(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
