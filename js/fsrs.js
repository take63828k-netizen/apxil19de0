import { fsrs, generatorParameters, createEmptyCard, Rating } from '../vendor/ts-fsrs.js';

export const RETENTION = 0.9;
// 当日中の出し直しはアプリが受け持つので、記憶の計算の学習ステップ（1分後・10分後）は使わない
export const SCHEDULER_PARAMS = generatorParameters({ request_retention: RETENTION, enable_fuzz: true, learning_steps: [], relearning_steps: [] });
const scheduler = fsrs(SCHEDULER_PARAMS);
const RATING = { again: Rating.Again, good: Rating.Good };

export function rateCard(cardId, prevState, rating, now) {
  const grade = RATING[rating];
  if (grade === undefined) throw new Error(`知らない評価: ${rating}`);
  let base;
  if (prevState) {
    const { card_id, ...rest } = prevState;
    base = rest;
  } else {
    base = createEmptyCard(now);
  }
  const { card } = scheduler.next(base, now, grade);
  return { ...card, card_id: cardId };
}

// todayRatings：このカードの今日のこれまでの答え。記憶の計算に入れるのは今日の最初の答えだけ。
// 今日一度でも不正解だったカードは、正解した時点で次の出題を翌日の初めにする
export function applyAnswer({ cardId, prev, rating, now, todayRatings, nextDayStart }) {
  if (RATING[rating] === undefined) throw new Error(`知らない評価: ${rating}`);
  const next = todayRatings.length === 0 ? rateCard(cardId, prev, rating, now) : { ...prev };
  if (rating === 'good' && todayRatings.includes('again')) next.due = new Date(nextDayStart);
  return next;
}
