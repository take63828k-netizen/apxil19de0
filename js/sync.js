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

export async function syncCards(db, fetchImpl = fetch) {
  let data;
  try {
    const res = await fetchImpl('./data/cards.json', { cache: 'no-cache' });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    data = await res.json();
    validateRemote(data);
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  if ((await db.getKV('cardsVersion')) === data.version) return { ok: true, changed: false };
  await db.replaceCards(mergeCards(await db.getAllCards(), data));
  await db.setKV('cardsVersion', data.version);
  return { ok: true, changed: true, count: data.cards.length };
}
