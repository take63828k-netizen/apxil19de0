export function gradeChoice(selected, answer) {
  return selected === answer ? 'good' : 'again';
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 正誤は「正・誤」の順に固定する（押し間違いを防ぐため）
export function displayOptions(card, rng = Math.random) {
  return card.card_type === '正誤' ? [...card.options] : shuffle(card.options, rng);
}
