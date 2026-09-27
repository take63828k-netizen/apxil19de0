export function validateRemote(data) {
  if (!data || typeof data.version !== 'string' || !Array.isArray(data.cards)) throw new Error('cards.json の形が正しくありません');
  if (data.cards.length === 0) throw new Error('cards.json にカードがありません');
  const seen = new Set();
  for (const c of data.cards) {
    if (!c || typeof c.card_id !== 'string' || typeof c.question !== 'string' || typeof c.answer !== 'string') throw new Error('項目の欠けたカードがあります');
    if (seen.has(c.card_id)) throw new Error(`card_id が重複しています: ${c.card_id}`);
    seen.add(c.card_id);
  }
}

export function mergeCards(localCards, remote) {
  const ids = new Set(remote.cards.map((c) => c.card_id));
  const fresh = remote.cards.map((c, i) => ({ ...c, order: i, retired: false }));
  const retired = localCards.filter((c) => !ids.has(c.card_id)).map((c) => ({ ...c, retired: true }));
  return [...fresh, ...retired];
}

// 電波が弱いと fetch が返ってこないことがあるので、待ち時間を区切って手元のカードで続ける
export async function syncCards(db, fetchImpl = fetch, { timeoutMs = 8000 } = {}) {
  let data;
  const ctrl = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { ctrl.abort(); reject(new Error('通信の待ち時間を過ぎました')); }, timeoutMs);
  });
  try {
    const res = await Promise.race([fetchImpl('./data/cards.json', { cache: 'no-cache', signal: ctrl.signal }), timeout]);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    data = await Promise.race([res.json(), timeout]);
    validateRemote(data);
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    clearTimeout(timer);
  }
  if ((await db.getKV('cardsVersion')) === data.version) return { ok: true, changed: false };
  await db.replaceCards(mergeCards(await db.getAllCards(), data));
  await db.setKV('cardsVersion', data.version);
  return { ok: true, changed: true, count: data.cards.length };
}

// 画像の URL。中身の指紋（image_hash）を付けるので、同じ名前で差し替えると別の URL になる
export function imageUrl(card) {
  return `./data/img/${card.image}?v=${card.image_hash ?? ''}`;
}

// 図の下に出す出典。作図の道具名（◯◯.py）は利用者に要らないので、括弧ごと・文ごと消す
export function creditLabel(credit) {
  const text = String(credit ?? '').replace(/（[^（）]*\.py[^（）]*）/g, '');
  const kept = text.split('。').map((s) => s.trim()).filter((s) => s && !s.includes('.py'));
  return kept.length ? '出典：' + kept.join('。') : '';
}

export function imageUrls(cards) {
  return [...new Set(cards.filter((c) => !c.retired && c.image).map(imageUrl))].sort();
}

// 電波のあるうちに画像を端末へ保存し、使わなくなった画像を消す（オフラインでも画像を出すため）
export async function prefetchImages(urls, { fetchImpl = fetch, cacheStorage = caches, cacheName = 'data-v1', base = location.href } = {}) {
  const cache = await cacheStorage.open(cacheName);
  const wanted = new Set(urls.map((u) => new URL(u, base).href));
  let fetched = 0, failed = 0, removed = 0;
  for (const u of urls) {
    if (await cache.match(u)) continue;
    try {
      const res = await fetchImpl(u);
      if (res.ok) { await cache.put(u, res.clone()); fetched++; } else failed++;
    } catch { failed++; }
  }
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname.includes('/data/img/') && !wanted.has(req.url)) { await cache.delete(req); removed++; }
  }
  return { fetched, failed, removed };
}
