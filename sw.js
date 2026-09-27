const SHELL_CACHE = 'shell-v1'; // アプリ本体を直したら数字を上げる
const DATA_CACHE = 'data-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/config.js', './js/dates.js', './js/fsrs.js', './js/queue.js', './js/grading.js',
  './js/streak.js', './js/sync.js', './js/backup.js', './js/db.js', './js/effects.js',
  './vendor/ts-fsrs.js', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/data/cards.json')) e.respondWith(networkFirst(e.request));
  else if (url.pathname.includes('/data/img/')) e.respondWith(cacheFirst(e.request, DATA_CACHE));
  else e.respondWith(cacheFirst(e.request, SHELL_CACHE));
});
