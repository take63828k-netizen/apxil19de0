export const BACKUP_SCHEMA = 1;
const APP = 'genkai-anki';

export function serializeBackup({ states, logs, stickers, settings, exportedAt }) {
  return JSON.stringify({ app: APP, schema: BACKUP_SCHEMA, exportedAt: exportedAt.toISOString(), states, logs, stickers, settings });
}

function toDate(v, what) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`日付が読めません（${what}）`);
  return d;
}

export function parseBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('バックアップファイルを読めません'); }
  if (!d || d.app !== APP) throw new Error('このアプリのバックアップではありません');
  if (d.schema !== BACKUP_SCHEMA) throw new Error(`形式の版が違います（${d.schema}）`);
  if (!Array.isArray(d.states) || !Array.isArray(d.logs)) throw new Error('記録の形が正しくありません');
  // 端末へ書き込む前に1件ずつ形を確かめる（途中で失敗して、いまの記録だけが消えるのを防ぐ）
  const bad = (what) => { throw new Error(`記録の形が正しくありません（${what}）`); };
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  for (const s of d.states) if (!isObj(s) || typeof s.card_id !== 'string') bad('カードの学習状態');
  for (const l of d.logs) {
    if (!isObj(l) || typeof l.card_id !== 'string' || typeof l.day !== 'string' || typeof l.at !== 'number'
      || !['again', 'hard', 'good', 'easy'].includes(l.rating)) bad('解いた記録');
  }
  if (d.stickers !== undefined && !Array.isArray(d.stickers)) bad('シール');
  for (const k of d.stickers ?? []) {
    if (!isObj(k) || typeof k.day !== 'string' || !Array.isArray(k.emojis)) bad('シール');
  }
  if (d.settings !== undefined && d.settings !== null && !isObj(d.settings)) bad('設定');
  const states = d.states.map((s) => ({
    ...s,
    due: toDate(s.due, `${s.card_id} の期日`),
    ...(s.last_review ? { last_review: toDate(s.last_review, `${s.card_id} の最終学習日`) } : {}),
  }));
  return { states, logs: d.logs, stickers: Array.isArray(d.stickers) ? d.stickers : [], settings: d.settings ?? {}, exportedAt: toDate(d.exportedAt, '書き出し日時') };
}
