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
  const states = d.states.map((s) => ({
    ...s,
    due: toDate(s.due, `${s.card_id} の期日`),
    ...(s.last_review ? { last_review: toDate(s.last_review, `${s.card_id} の最終学習日`) } : {}),
  }));
  return { states, logs: d.logs, stickers: Array.isArray(d.stickers) ? d.stickers : [], settings: d.settings ?? {}, exportedAt: toDate(d.exportedAt, '書き出し日時') };
}
