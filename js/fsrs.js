import { fsrs, generatorParameters, createEmptyCard, Rating } from '../vendor/ts-fsrs.js';

export const RETENTION = 0.9;
export const SCHEDULER_PARAMS = generatorParameters({ request_retention: RETENTION, enable_fuzz: true });
const scheduler = fsrs(SCHEDULER_PARAMS);
const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };

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
