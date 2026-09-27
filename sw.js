const SHELL_CACHE = 'shell-f210724beea4'; // アプリ本体を直したら `python tools/stamp_sw.py` で付け直す（試験が確かめる）
const DATA_CACHE = 'data-v1';
const NETWORK_TIMEOUT_MS = 8000; // 電波が弱いときは、これを過ぎたら保存済みのカードを使う
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/config.js', './js/dates.js', './js/fsrs.js', './js/queue.js', './js/grading.js',
  './js/streak.js', './js/sync.js', './js/backup.js', './js/db.js', './js/effects.js',
  './vendor/ts-fsrs.js', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' で HTTP キャッシュを通さず、公開したばかりのファイルを取る
  e.waitUntil(caches.open(SHELL_CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, { cache: 'no-cache', signal: ctrl.signal });
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(req, cacheName, ignoreSearch) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/data/cards.json')) e.respondWith(networkFirst(e.request));
  // 画像は URL の ?v=<中身の指紋> まで含めて探す（差し替えた画像を取り直すため）
  else if (url.pathname.includes('/data/img/')) e.respondWith(cacheFirst(e.request, DATA_CACHE, false));
  else e.respondWith(cacheFirst(e.request, SHELL_CACHE, true));
});
