import { DEFAULT_SETTINGS, SETTING_FIELDS, STICKERS, PRAISES, RATING_LABEL } from './config.js';
import * as db from './db.js';
import { studyDay, dayEnd } from './dates.js';
import { rateCard } from './fsrs.js';
import { dailyNewQuota, startLabel, remainLabel, clearedToday, dueCardIds, unseenCardIds, createSession, pickWeakIds } from './queue.js';
import { activeTest, inTestRange, prepWindows, effectiveDue, unitOptions, clearExpiredTest } from './prep.js';
import { gradeChoice, displayOptions } from './grading.js';
import { computeStreak } from './streak.js';
import { syncCards, imageUrl, imageUrls, prefetchImages, creditLabel } from './sync.js';
import { serializeBackup, parseBackup } from './backup.js';
import { pop, stamp, playSound, setSoundEnabled } from './effects.js';

const $ = (id) => document.getElementById(id);
const S = { settings: { ...DEFAULT_SETTINGS }, cards: new Map(), states: new Map(), logs: [], session: null, mode: 'normal', busy: false, syncError: null, flash: null };

async function loadAll() {
  S.settings = { ...DEFAULT_SETTINGS, ...((await db.getKV('settings')) ?? {}) };
  setSoundEnabled(S.settings.sound);
  S.cards = new Map((await db.getAllCards()).map((c) => [c.card_id, c]));
  S.states = new Map((await db.getAllStates()).map((s) => [s.card_id, s]));
  S.logs = await db.getAllLogs();
}
const today = () => studyDay(new Date(), S.settings.dayStartHour);
// テスト・入試の総復習（設計書 6.9）：期日を早めて選び、テストの範囲の新しいカードを先に出す
// 今日の問題（設計書 6.3）：今日の終わりまでに期日が来る復習から、今日の最後の答えが正解のカードを除いたもの
const lists = (now = new Date()) => {
  const day = studyDay(now, S.settings.dayStartHour);
  const windows = prepWindows(S.settings, day, S.cards);
  const test = activeTest(S.settings, day);
  return {
    due: dueCardIds({
      cards: S.cards, states: S.states, now, until: dayEnd(day, S.settings.dayStartHour), skip: clearedToday(S.logs, day),
      dueOf: (s, c) => effectiveDue(s, c, windows, S.settings.dayStartHour, now),
    }),
    unseen: unseenCardIds({ cards: S.cards, states: S.states, first: (c) => inTestRange(c, test) }),
    test,
  };
};

async function getPlan(recalc = false) {
  const day = today();
  let plan = await db.getKV('dailyPlan');
  if (!plan || plan.day !== day) { plan = { day, introduced: 0, introducedRange: 0, quota: 0 }; recalc = true; }
  if (recalc) {
    const { due, unseen, test } = lists();
    // 復習が上限を超えたかは、その日のはじめの枚数で決める（復習を片付けた後に計算し直しても新しいカードを出さない）
    plan.dueStart ??= due.length;
    const rangeUnseen = unseen.filter((id) => inTestRange(S.cards.get(id), test)).length;
    plan.quota = dailyNewQuota({
      unseenCount: unseen.length, rangeUnseen, introduced: plan.introduced, introducedRange: plan.introducedRange ?? 0,
      today: day, examDate: S.settings.examDate, dueCount: plan.dueStart, backlogLimit: S.settings.backlogLimit, test,
    });
    await db.setKV('dailyPlan', plan);
  }
  return plan;
}

function show(name) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${name}`;
  window.scrollTo(0, 0);
}

// iPhone ではホーム画面のアプリと Safari のタブとで保存場所が別々のため、どちらで開いたかを見分ける
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

function addNotice(text) {
  const p = document.createElement('p'); p.className = 'notice'; p.textContent = text; $('notices').append(p);
}

async function renderHome() {
  const plan = await getPlan();
  const day = plan.day;
  $('today-count').textContent = clearedToday(S.logs, day).size;
  const studied = new Set(S.logs.map((l) => l.day));
  $('streak').textContent = `🔥 ${computeStreak(studied, day, { graceWindow: S.settings.graceWindow })} 日連続学習中！`;
  const { due, unseen } = lists();
  const fresh = Math.min(Math.max(0, plan.quota - plan.introduced), unseen.length);
  $('remain').textContent = remainLabel(due.length + fresh);
  $('btn-start').textContent = startLabel(due.length + fresh, S.settings.sessionSize);
  $('btn-weak').textContent = `苦手特訓（${S.settings.weakCount}問）`;
  $('notices').replaceChildren();
  if (!isStandalone()) addNotice('📱 ホーム画面のアイコンから開いてね。Safari で開くと、学習記録がアプリとは別の場所に保存されます。');
  if (S.flash) { addNotice(S.flash); S.flash = null; }
  if (S.cards.size === 0) addNotice('カードがまだありません。電波のある所でアプリを開いてね。');
  if (!S.settings.examDate) addNotice('「せってい」で入試日を入れると、新しいカードが出るようになります。');
  if (S.syncError) addNotice(`カードの更新を確認できませんでした（${S.syncError}）。いまのカードで続けられます。`);
  const last = await db.getKV('lastBackup');
  const remind = S.settings.backupRemindDays * 86400000;
  if (S.logs.length > 0 && (!last || Date.now() - last > remind)) addNotice(`学習記録のバックアップから${S.settings.backupRemindDays}日以上たちました。「せってい」から書き出してね。`);
  await renderCalendar(day);
}

async function renderCalendar(day) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const count = new Date(y, m, 0).getDate();
  const stickers = new Map((await db.getAllStickers()).map((s) => [s.day, s.emojis]));
  const cal = $('calendar'); cal.replaceChildren();
  for (const w of ['日', '月', '火', '水', '木', '金', '土']) { const h = document.createElement('div'); h.className = 'head'; h.textContent = w; cal.append(h); }
  for (let i = 0; i < first.getDay(); i++) cal.append(document.createElement('div'));
  for (let d = 1; d <= count; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div'); cell.className = 'cell' + (key === day ? ' today' : ''); cell.dataset.day = key;
    const em = stickers.get(key);
    const st = document.createElement('span'); st.className = 'st'; st.textContent = em ? em[em.length - 1] : '';
    const num = document.createElement('span'); num.textContent = d;
    cell.append(st, num); cal.append(cell);
  }
}

async function startSession(mode) {
  const now = new Date();
  let ids;
  if (mode === 'weak') {
    ids = pickWeakIds({ cards: S.cards, states: S.states, logs: S.logs, now, count: S.settings.weakCount, lapseDays: S.settings.lapseDays });
  } else {
    const plan = await getPlan();
    const { due, unseen } = lists(now);
    ids = [...due, ...unseen.slice(0, Math.max(0, plan.quota - plan.introduced))].slice(0, S.settings.sessionSize);
  }
  if (ids.length === 0) {
    S.flash = mode === 'weak' ? 'まだ苦手カードはありません。まずは通常の問題をやってみよう！' : '今日の分はぜんぶクリア！🎉 苦手特訓もできるよ。';
    await renderHome(); return;
  }
  S.mode = mode;
  S.session = createSession(ids, { reinsertGap: S.settings.reinsertGap });
  show('study'); renderCard();
}

function renderCard() {
  const t0 = performance.now();
  const item = S.session.current();
  const card = S.cards.get(item.id);
  const { done, total } = S.session.progress();
  $('progress-bar').style.width = `${(done / total) * 100}%`;
  $('progress-text').textContent = `${done} / ${total}${item.repeat ? '（もう一度）' : ''}`;
  $('card-type').textContent = `${card.subject}・${card.card_type}`;
  $('question').textContent = card.question;
  const img = $('card-image');
  if (card.image) { img.src = imageUrl(card); img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  const credit = card.image ? creditLabel(card.image_credit) : '';
  $('image-credit').textContent = credit; $('image-credit').hidden = !credit;
  $('hint').textContent = card.hint ?? ''; $('hint').hidden = true; $('btn-hint').hidden = !card.hint;
  $('options').replaceChildren(); $('options').hidden = true;
  $('btn-options').hidden = !card.options;
  $('btn-reveal').hidden = !!card.options;
  $('back').hidden = true; $('ratings').hidden = true;
  S.busy = false;
  S.lastRenderMs = performance.now() - t0;
}

function showOptions() {
  const card = S.cards.get(S.session.current().id);
  $('options').replaceChildren(...displayOptions(card).map((o) => {
    const b = document.createElement('button'); b.className = 'option'; b.textContent = o;
    b.addEventListener('click', () => onChoice(card, o, b)); return b;
  }));
  $('options').hidden = false; $('btn-options').hidden = true;
}

function onChoice(card, selected, btn) {
  for (const b of $('options').children) { b.disabled = true; if (b.textContent === card.answer) b.classList.add('correct'); }
  if (gradeChoice(selected, card.answer) === 'again') {
    btn.classList.add('wrong'); playSound('miss'); showBack(card); renderRatings(['again'], { again: 'つぎへ（もう一度）' });
  } else {
    pop(btn); playSound('ok'); showBack(card); renderRatings(['hard', 'good', 'easy']);
  }
}

function showBack(card) {
  $('answer').textContent = card.answer;
  const tl = $('timeline');
  if (card.subject === '歴史' && (card.era_time || card.prev_event || card.next_event)) {
    const part = (text, cls) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    tl.replaceChildren(part(card.prev_event ?? '—', 'side'), part('→', ''), part(`${card.era_time ?? ''} ${card.answer}`.trim(), 'now'), part('→', ''), part(card.next_event ?? '—', 'side'));
    tl.hidden = false;
  } else tl.hidden = true;
  $('mnemonic').textContent = card.mnemonic ? `🎵 ${card.mnemonic}` : ''; $('mnemonic').hidden = !card.mnemonic;
  $('explanation').textContent = card.explanation;
  $('back').hidden = false; $('btn-reveal').hidden = true;
}

function renderRatings(keys, labels = {}) {
  $('ratings').replaceChildren(...keys.map((k) => {
    const b = document.createElement('button'); b.className = `rate rate-${k}`; b.textContent = labels[k] ?? RATING_LABEL[k];
    b.addEventListener('click', () => onRate(k)); return b;
  }));
  $('ratings').hidden = false;
}

async function onRate(rating) {
  if (S.busy) return;
  S.busy = true;
  const item = S.session.current();
  const now = new Date();
  const prev = S.states.get(item.id);
  const next = rateCard(item.id, prev, rating, now);
  S.states.set(item.id, next);
  await db.putState(next);
  const log = { card_id: item.id, rating, at: now.getTime(), day: today(), repeat: item.repeat, mode: S.mode };
  S.logs.push(log);
  await db.addLog(log);
  if (!prev && S.mode === 'normal' && !item.repeat) {
    const plan = await getPlan();
    plan.introduced++;
    if (inTestRange(S.cards.get(item.id), activeTest(S.settings, plan.day))) plan.introducedRange = (plan.introducedRange ?? 0) + 1;
    await db.setKV('dailyPlan', plan);
  }
  playSound(rating === 'again' ? 'miss' : 'tap');
  S.session.answer(rating);
  if (S.session.isDone()) showDone(); else renderCard();
}

function showDone() {
  $('praise').textContent = PRAISES[Math.floor(Math.random() * PRAISES.length)];
  $('done-count').textContent = `${S.session.progress().total} 問クリア！`;
  $('stickers').replaceChildren(...STICKERS.map((e) => {
    const b = document.createElement('button'); b.textContent = e;
    b.addEventListener('click', async () => {
      const day = today();
      await db.addSticker(day, e); playSound('sticker');
      show('home'); await renderHome();
      stamp(document.querySelector(`.cell[data-day="${day}"] .st`));
    }, { once: true });
    return b;
  }));
  show('done'); playSound('fanfare');
}

function fieldLabel(f) {
  const label = document.createElement('label'); label.textContent = f.label;
  const input = document.createElement('input'); input.type = f.type; input.name = f.key;
  if (f.type === 'checkbox') input.checked = !!S.settings[f.key];
  else { input.value = S.settings[f.key] ?? ''; if (f.min !== undefined) { input.min = f.min; input.max = f.max; } }
  input.addEventListener('change', saveSettings);
  label.append(input); return label;
}

function selectLabel(text, name, options, value) {
  const label = document.createElement('label'); label.textContent = text;
  const sel = document.createElement('select'); sel.name = name;
  sel.append(new Option('（えらぶ）', ''), ...options.map((o) => new Option(o.text, String(o.value))));
  sel.value = value == null ? '' : String(value);
  sel.addEventListener('change', saveSettings);
  label.append(sel); return label;
}

// 次のテスト（設計書 6.9）：日・分野・はじめ・おわり。単元は選んだ分野のものを単元一覧の順に出す
function testFieldset() {
  const box = document.createElement('fieldset'); box.className = 'test-box';
  const legend = document.createElement('legend'); legend.textContent = '次のテスト（14日前から範囲をまとめて復習）';
  const date = fieldLabel({ key: 'testDate', label: 'テストの日', type: 'date' });
  const subjects = [...new Set([...S.cards.values()].filter((c) => !c.retired && typeof c.unit_no === 'number').map((c) => c.subject))]
    .sort((a, b) => ['歴史', '地理', '公民'].indexOf(a) - ['歴史', '地理', '公民'].indexOf(b));
  const units = unitOptions(S.cards, S.settings.testSubject).map((u) => ({ value: u.no, text: u.name }));
  box.append(legend, date,
    selectLabel('分野', 'testSubject', subjects.map((s) => ({ value: s, text: s })), S.settings.testSubject),
    selectLabel('はじめの単元', 'testFrom', units, S.settings.testFrom),
    selectLabel('おわりの単元', 'testTo', units, S.settings.testTo));
  return box;
}

function renderSettings() {
  const form = $('settings-form'); form.replaceChildren();
  const basic = SETTING_FIELDS.filter((f) => f.basic);
  form.append(fieldLabel(basic[0]), testFieldset(), ...basic.slice(1).map(fieldLabel));
  const more = document.createElement('details'); more.className = 'more';
  const sum = document.createElement('summary'); sum.textContent = 'くわしい設定';
  more.append(sum, ...SETTING_FIELDS.filter((f) => !f.basic).map(fieldLabel));
  form.append(more);
  $('card-info').textContent = `カード ${[...S.cards.values()].filter((c) => !c.retired).length} 枚`;
}

async function saveSettings(e) {
  const form = $('settings-form');
  const next = { ...S.settings };
  for (const f of SETTING_FIELDS) {
    const input = form.elements[f.key];
    if (f.type === 'checkbox') next[f.key] = input.checked;
    else if (f.type === 'date') next[f.key] = input.value || null;
    else {
      const n = Number(input.value);
      next[f.key] = Number.isFinite(n) && input.value !== '' ? Math.min(f.max, Math.max(f.min, Math.round(n))) : S.settings[f.key];
      input.value = next[f.key];
    }
  }
  const num = (v) => (v === '' ? null : Number(v));
  next.testDate = form.elements.testDate.value || null;
  next.testSubject = form.elements.testSubject.value || null;
  next.testFrom = num(form.elements.testFrom.value);
  next.testTo = num(form.elements.testTo.value);
  const subjectChanged = next.testSubject !== S.settings.testSubject;
  if (subjectChanged) { next.testFrom = null; next.testTo = null; }
  S.settings = next; setSoundEnabled(next.sound);
  await db.setKV('settings', next);
  await getPlan(true);
  if (subjectChanged) { const open = form.querySelector('details.more')?.open; renderSettings(); if (open) form.querySelector('details.more').open = true; }
}

async function exportBackup() {
  const text = serializeBackup({ states: [...S.states.values()], logs: S.logs, stickers: await db.getAllStickers(), settings: S.settings, exportedAt: new Date() });
  const name = `shakai-anki-backup-${today()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); }
    await db.setKV('lastBackup', Date.now());
    alert('書き出しました。「ファイル」アプリに保存してね。');
  } catch (e) {
    if (e.name !== 'AbortError') alert(`書き出せませんでした：${e.message}`);
  }
}

async function importBackup(file) {
  try {
    const data = parseBackup(await file.text());
    if (!confirm(`${data.exportedAt.toLocaleString('ja-JP')} に書き出した記録で置きかえます。いまの記録は消えます。よいですか？`)) return;
    await db.replaceAllProgress(data);
    await loadAll(); await getPlan(true);
    S.flash = '学習記録を読み戻しました。';
    show('home'); await renderHome();
  } catch (e) {
    alert(`読み戻せませんでした：${e.message}`);
  }
}

function bind() {
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest('button, .btn'); if (b) pop(b); });
  $('btn-start').addEventListener('click', () => startSession('normal'));
  $('btn-weak').addEventListener('click', () => startSession('weak'));
  $('btn-settings').addEventListener('click', () => { renderSettings(); show('settings'); });
  $('btn-back').addEventListener('click', async () => { show('home'); await renderHome(); });
  $('btn-quit').addEventListener('click', async () => { show('home'); await renderHome(); });
  $('btn-hint').addEventListener('click', () => { $('hint').hidden = false; $('btn-hint').hidden = true; });
  $('btn-options').addEventListener('click', showOptions);
  $('btn-reveal').addEventListener('click', () => { const card = S.cards.get(S.session.current().id); showBack(card); renderRatings(['again', 'hard', 'good', 'easy']); });
  $('btn-export').addEventListener('click', exportBackup);
  $('file-import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });
}

async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  await db.open();
  navigator.storage?.persist?.().catch(() => {});
  await loadAll();
  const cleared = clearExpiredTest(S.settings, today());
  if (cleared !== S.settings) { S.settings = cleared; await db.setKV('settings', cleared); }
  bind();
  // 先に手元のカードでホームを出し、カードの更新はその後に確かめる（電波が弱くても待たせない）
  show('home'); await renderHome();
  const r = await syncCards(db);
  if (r.ok && r.changed) { S.cards = new Map((await db.getAllCards()).map((c) => [c.card_id, c])); await getPlan(true); }
  S.syncError = r.ok ? null : r.reason;
  if (r.ok) prefetchImages(imageUrls([...S.cards.values()])).catch(() => {});
  if (!$('screen-home').hidden && (r.changed || !r.ok)) await renderHome();
}

init();
