export const DEFAULT_SETTINGS = {
  examDate: '2027-02-24', backlogLimit: 100, dayStartHour: 4, sessionSize: 20,
  reinsertGap: 5, graceWindow: 7, backupRemindDays: 7, sound: true,
  testDate: '2026-11-11', testSubject: null, testFrom: null, testTo: null,
};
// basic：設定画面にいつも出す。それ以外は「くわしい設定」を開いたときに出す（次のテストの欄は app.js が別に作る）
export const SETTING_FIELDS = [
  { key: 'examDate', label: '入試日', type: 'date', basic: true },
  { key: 'sound', label: '効果音', type: 'checkbox', basic: true },
  { key: 'backlogLimit', label: '復習がこの枚数を超えたら新しいカードを休む', type: 'number', min: 10, max: 1000 },
  { key: 'dayStartHour', label: '日付が変わる時刻（時）', type: 'number', min: 0, max: 12 },
  { key: 'sessionSize', label: '1セッションの問題数', type: 'number', min: 5, max: 50 },
  { key: 'reinsertGap', label: '不正解のカードを何問後に出し直すか', type: 'number', min: 1, max: 10 },
  { key: 'graceWindow', label: 'ゆるガードの間隔（日）', type: 'number', min: 1, max: 30 },
  { key: 'backupRemindDays', label: 'バックアップのお知らせ（日）', type: 'number', min: 1, max: 30 },
];
export const STICKERS = ['👑', '🎀', '🍓', '🐻', '🌸', '💎'];
export const PRAISES = ['社会にLOVE DIVE！', '11点満点中11点！', '完璧なマスター！', '記憶力、限界突破！', 'きょうも天才的！', 'このまま合格ルート！'];
export const RATING_LABEL = { again: '不正解', good: '正解' };
