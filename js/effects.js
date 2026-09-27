let ctx = null;
let enabled = true;
export function setSoundEnabled(v) { enabled = !!v; }

function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (navigator.audioSession) navigator.audioSession.type = 'ambient'; // マナーモードに従う
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const TONES = {
  tap: [[660, 0.06]], ok: [[784, 0.08], [1047, 0.1]], miss: [[330, 0.14]],
  sticker: [[880, 0.05], [1320, 0.08]], fanfare: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22]],
};

export function playSound(kind) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  let t = a.currentTime;
  for (const [f, d] of TONES[kind] ?? []) {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
    t += d;
  }
}

function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
export const pop = (el) => replay(el, 'poyon');
export const stamp = (el) => replay(el, 'stamp');
