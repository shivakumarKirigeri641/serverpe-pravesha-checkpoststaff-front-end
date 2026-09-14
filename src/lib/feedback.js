/*
 * What a result sounds and feels like.
 *
 * A staff member at a barrier is looking at the vehicle, not the phone. So a
 * result is also a sound and a buzz, and the three are different enough to tell
 * apart without looking: a bright rising pair for "let them through", a low
 * double buzz for "stop", a quick double tap for "your decision".
 *
 * The sound is made on the phone (Web Audio), not downloaded, so it works with
 * one bar of signal. Browsers only allow sound after the person has touched the
 * page, so the audio is woken on the first tap anywhere. Sound can be switched
 * off per phone; vibration follows the phone's own settings.
 */

const KEY = 'pv_gate_sound';
let ctx = null;

export const soundOn = () => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};
export const setSoundOn = (on) => {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};

function audio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

/* Wake the audio on the first touch, so the first result can be heard. */
if (typeof document !== 'undefined') {
  const wake = () => { audio(); };
  document.addEventListener('pointerdown', wake, { once: true, capture: true });
  document.addEventListener('keydown', wake, { once: true, capture: true });
}

function beep(ac, freq, start, dur, type = 'sine', level = 0.28) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const PATTERNS = {
  go: { vibrate: [90, 60, 140], sound: (ac) => { beep(ac, 880, 0, 0.12); beep(ac, 1320, 0.13, 0.2); } },
  stop: { vibrate: [320, 120, 320], sound: (ac) => { beep(ac, 196, 0, 0.28, 'square', 0.18); beep(ac, 196, 0.36, 0.28, 'square', 0.18); } },
  ask: { vibrate: [70, 70, 70], sound: (ac) => { beep(ac, 660, 0, 0.1, 'triangle'); beep(ac, 660, 0.16, 0.1, 'triangle'); } },
};

/** 'go' | 'stop' | 'ask' */
export function signal(kind) {
  const p = PATTERNS[kind];
  if (!p) return;
  try { if (navigator.vibrate) navigator.vibrate(p.vibrate); } catch { /* not supported */ }
  if (!soundOn()) return;
  const ac = audio();
  if (ac) {
    try { p.sound(ac); } catch { /* a failed beep never stops a check */ }
  }
}
