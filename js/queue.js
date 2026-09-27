import { addDays, daysBetween } from './dates.js';

export function newCardQuota({ unseenCount, today, examDate, bufferDays, dueCount, backlogLimit }) {
  if (!examDate || unseenCount <= 0) return 0;
  if (dueCount > backlogLimit) return 0;
  const deadline = addDays(examDate, -bufferDays);
  const daysLeft = Math.max(1, daysBetween(today, deadline));
  return Math.ceil(unseenCount / daysLeft);
}

export function dueCardIds({ cards, states, now }) {
  const out = [];
  for (const s of states.values()) {
    const c = cards.get(s.card_id);
    if (c && !c.retired && s.due && s.due <= now) out.push(s);
  }
  out.sort((a, b) => a.due - b.due);
  return out.map((s) => s.card_id);
}

export function unseenCardIds({ cards, states }) {
  return [...cards.values()]
    .filter((c) => !c.retired && !states.has(c.card_id))
    .sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0) || a.priority - b.priority || a.order - b.order)
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
