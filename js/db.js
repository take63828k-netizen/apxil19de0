let dbName = 'genkai-anki';
let dbp = null;

export function setDbName(name) { dbName = name; dbp = null; }

export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('cards', { keyPath: 'card_id' });
      d.createObjectStore('states', { keyPath: 'card_id' });
      d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true }).createIndex('day', 'day');
      d.createObjectStore('stickers', { keyPath: 'day' });
      d.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const finish = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
const result = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function getAll(store) { const d = await open(); return result(d.transaction(store).objectStore(store).getAll()); }
async function put(store, value) { const d = await open(); const tx = d.transaction(store, 'readwrite'); tx.objectStore(store).put(value); return finish(tx); }

export const getAllCards = () => getAll('cards');
export const getAllStates = () => getAll('states');
export const getAllLogs = () => getAll('logs');
export const getAllStickers = () => getAll('stickers');
export const putState = (s) => put('states', s);

export async function addLog(log) {
  const d = await open(); const tx = d.transaction('logs', 'readwrite');
  tx.objectStore('logs').add({ ...log }); return finish(tx);
}

export async function replaceCards(cards) {
  const d = await open(); const tx = d.transaction('cards', 'readwrite'); const s = tx.objectStore('cards');
  s.clear(); for (const c of cards) s.put(c); return finish(tx);
}

export async function addSticker(day, emoji) {
  const d = await open(); const tx = d.transaction('stickers', 'readwrite'); const s = tx.objectStore('stickers');
  const r = s.get(day);
  r.onsuccess = () => { const row = r.result ?? { day, emojis: [] }; row.emojis.push(emoji); s.put(row); };
  return finish(tx);
}

export async function getKV(key) {
  const d = await open(); const row = await result(d.transaction('kv').objectStore('kv').get(key));
  return row?.value;
}
export const setKV = (key, value) => put('kv', { key, value });

export async function replaceAllProgress({ states, logs, stickers, settings }) {
  const d = await open();
  const tx = d.transaction(['states', 'logs', 'stickers', 'kv'], 'readwrite');
  const st = tx.objectStore('states'), lg = tx.objectStore('logs'), sk = tx.objectStore('stickers'), kv = tx.objectStore('kv');
  st.clear(); lg.clear(); sk.clear();
  for (const s of states) st.put(s);
  for (const l of logs) { const { id, ...rest } = l; lg.add(rest); }
  for (const k of stickers) sk.put(k);
  kv.put({ key: 'settings', value: settings });
  kv.delete('dailyPlan');
  return finish(tx);
}
