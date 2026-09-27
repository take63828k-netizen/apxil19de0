export const DEFAULT_SETTINGS = {
  examDate: null, bufferDays: 30, backlogLimit: 100, dayStartHour: 4, sessionSize: 20,
  reinsertGap: 5, weakCount: 10, lapseDays: 7, graceWindow: 7, backupRemindDays: 7, sound: true,
};
export const SETTING_FIELDS = [
  { key: 'examDate', label: '入試日', type: 'date' },
  { key: 'bufferDays', label: '全カードを出し終える日（入試の何日前）', type: 'number', min: 0, max: 120 },
  { key: 'backlogLimit', label: '復習がこの枚数を超えたら新しいカードを休む', type: 'number', min: 10, max: 1000 },
  { key: 'dayStartHour', label: '日付が変わる時刻（時）', type: 'number', min: 0, max: 12 },
  { key: 'sessionSize', label: '1セッションの問題数', type: 'number', min: 5, max: 50 },
  { key: 'reinsertGap', label: '「もう一度」を何問後に出すか', type: 'number', min: 1, max: 10 },
  { key: 'weakCount', label: '苦手特訓の問題数', type: 'number', min: 5, max: 30 },
  { key: 'lapseDays', label: '苦手に入れる「もう一度」の日数', type: 'number', min: 1, max: 30 },
  { key: 'graceWindow', label: 'ゆるガードの間隔（日）', type: 'number', min: 1, max: 30 },
  { key: 'backupRemindDays', label: 'バックアップのお知らせ（日）', type: 'number', min: 1, max: 30 },
  { key: 'sound', label: '効果音', type: 'checkbox' },
];
export const STICKERS = ['👑', '🎀', '🍓', '🐻', '🌸', '💎'];
export const PRAISES = ['社会にLOVE DIVE！', '11点満点中11点！', '完璧なマスター！', '記憶力、限界突破！', 'きょうも天才的！', 'このまま合格ルート！'];
export const RATING_LABEL = { again: 'もう一度', hard: 'むずかしい', good: '正解', easy: 'かんたん' };
