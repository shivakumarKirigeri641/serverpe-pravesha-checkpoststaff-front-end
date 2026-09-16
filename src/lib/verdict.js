/*
 * How each verdict looks and what the staff member should do about it.
 *
 * `action` is the sentence a person acts on — the API's message explains the
 * fact ("this pass was for 9 September"), this says what to do about it. Tones
 * are only five, deliberately: act (valid, still to record), go (recorded),
 * stop, ask, and done for a vehicle that is already in. Anything subtler is unreadable from a metre away in the rain.
 *
 * Both languages live here, so a verdict can never be translated in one place
 * and forgotten in another.
 */

export const VERDICTS = {
  /* Blue, not green: nothing has happened yet. Green used to read as "done",
     and a staff member would wave the vehicle through without tapping, so the
     entry was never recorded (user, 2026-09-16). */
  valid: { tone: 'act', title: 'Valid pass', action: 'Tap RECORD ENTRY below, then let them through.' },
  /* After the tap: this is the green one. */
  recorded: { tone: 'go', title: 'Entry recorded', action: 'Let them through.' },
  valid_override: { tone: 'go', title: 'Entry recorded', action: 'Recorded outside the slot, with your name on it.' },
  /* Checked in (user, 2026-09-16). Opening an entered vehicle from the list is
     the ordinary thing a staff member does all day, and it used to answer in the
     red of a refused pass. It is not a refusal: the vehicle is in, and the
     screen says so calmly. It is still not an entry to make again — there is no
     record button, and the sentence says why. */
  already_used: { tone: 'done', title: 'Checked in', action: 'Already entered. One pass is one entry — do not record it again.' },
  wrong_day: { tone: 'stop', title: 'Wrong date', action: 'They need a pass booked for today.' },
  wrong_place: { tone: 'stop', title: 'Wrong destination', action: 'This pass belongs to another checkpost.' },
  not_paid: { tone: 'stop', title: 'Not paid', action: 'Payment never completed. Ask them to book again on WhatsApp.' },
  cancelled: { tone: 'stop', title: 'Cancelled', action: 'This pass was cancelled and is not valid.' },
  unknown_ticket: { tone: 'stop', title: 'No such pass', action: 'Check the number, or search by the vehicle number.' },
  wrong_slot: { tone: 'ask', title: 'Outside their slot', action: 'Your decision. Recording it will note that you allowed it.' },
  /* The visitor ticked "I am already at the checkpost" when paying, and their
     phone agreed they were standing here. Nobody has seen the vehicle yet, so
     this is not an entry to refuse — it is one to check. */
  self_declared: { tone: 'ask', title: 'They checked themselves in',
    action: 'Recorded by the visitor when paying. Check the vehicle, then confirm.' },
  /* The office put this plate on the watchlist as blocked. The pass does not
     matter; the staff member does not argue it, they call. */
  watch_blocked: { tone: 'stop', title: 'Blocked vehicle', action: 'Do not allow entry. Call the office.' },
};

const VERDICTS_KN = {
  valid: { title: 'ಮಾನ್ಯ ಪಾಸ್', action: 'ಕೆಳಗಿನ "ಪ್ರವೇಶ ದಾಖಲಿಸಿ" ಒತ್ತಿ, ನಂತರ ಒಳಗೆ ಬಿಡಿ.' },
  recorded: { title: 'ಪ್ರವೇಶ ದಾಖಲಾಗಿದೆ', action: 'ಒಳಗೆ ಬಿಡಿ.' },
  valid_override: { title: 'ಪ್ರವೇಶ ದಾಖಲಾಗಿದೆ', action: 'ಸ್ಲಾಟ್ ಹೊರಗೆ, ನಿಮ್ಮ ಹೆಸರಿನಲ್ಲಿ ದಾಖಲಾಗಿದೆ.' },
  already_used: { title: 'ಚೆಕ್-ಇನ್ ಆಗಿದೆ', action: 'ಈಗಾಗಲೇ ಪ್ರವೇಶಿಸಿದೆ. ಒಂದು ಪಾಸ್ ಒಂದೇ ಪ್ರವೇಶ — ಮತ್ತೆ ದಾಖಲಿಸಬೇಡಿ.' },
  wrong_day: { title: 'ತಪ್ಪು ದಿನಾಂಕ', action: 'ಇಂದಿಗೆ ಬುಕ್ ಮಾಡಿದ ಪಾಸ್ ಬೇಕು.' },
  wrong_place: { title: 'ತಪ್ಪು ತಾಣ', action: 'ಈ ಪಾಸ್ ಬೇರೆ ಚೆಕ್‌ಪೋಸ್ಟ್‌ಗೆ ಸೇರಿದೆ.' },
  not_paid: { title: 'ಪಾವತಿಯಾಗಿಲ್ಲ', action: 'ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ವಾಟ್ಸ್‌ಆ್ಯಪ್‌ನಲ್ಲಿ ಮತ್ತೆ ಬುಕ್ ಮಾಡಲು ಹೇಳಿ.' },
  cancelled: { title: 'ರದ್ದಾಗಿದೆ', action: 'ಈ ಪಾಸ್ ರದ್ದಾಗಿದ್ದು ಮಾನ್ಯವಲ್ಲ.' },
  unknown_ticket: { title: 'ಅಂತಹ ಪಾಸ್ ಇಲ್ಲ', action: 'ಸಂಖ್ಯೆ ಪರಿಶೀಲಿಸಿ, ಅಥವಾ ವಾಹನ ಸಂಖ್ಯೆಯಿಂದ ಹುಡುಕಿ.' },
  wrong_slot: { title: 'ಸ್ಲಾಟ್ ಹೊರಗೆ', action: 'ನಿಮ್ಮ ನಿರ್ಧಾರ. ದಾಖಲಿಸಿದರೆ ನೀವು ಅನುಮತಿಸಿದ್ದೀರಿ ಎಂದು ನಮೂದಾಗುತ್ತದೆ.' },
  self_declared: { title: 'ಅವರೇ ಚೆಕ್-ಇನ್ ಮಾಡಿದ್ದಾರೆ', action: 'ಪಾವತಿಸುವಾಗ ಪ್ರವಾಸಿಗರು ದಾಖಲಿಸಿದ್ದಾರೆ. ವಾಹನ ಪರಿಶೀಲಿಸಿ, ನಂತರ ದೃಢೀಕರಿಸಿ.' },
  watch_blocked: { title: 'ನಿರ್ಬಂಧಿತ ವಾಹನ', action: 'ಪ್ರವೇಶ ಅನುಮತಿಸಬೇಡಿ. ಕಚೇರಿಗೆ ಕರೆ ಮಾಡಿ.' },
};

const FALLBACK = { tone: 'stop', title: 'Not valid', action: 'Ask them to check their pass.' };
const FALLBACK_KN = { title: 'ಮಾನ್ಯವಲ್ಲ', action: 'ಪಾಸ್ ಪರಿಶೀಲಿಸಲು ಹೇಳಿ.' };

export const verdictOf = (v, lang = 'en') => {
  const base = VERDICTS[v] || FALLBACK;
  if (lang !== 'kn') return base;
  return { ...base, ...(VERDICTS_KN[v] || FALLBACK_KN) };
};

export const TONE = {
  act: { bar: 'bg-act-500', soft: 'bg-act-50 border-act-500/30', solid: 'bg-act-500 text-white', text: 'text-act-700', chip: 'bg-act-500 text-white', icon: '↓' },
  go: { bar: 'bg-pass-500', soft: 'bg-pass-50 border-pass-500/25', solid: 'bg-pass-500 text-white', text: 'text-pass-700', chip: 'bg-pass-500 text-white', icon: '✓' },
  stop: { bar: 'bg-stop-600', soft: 'bg-stop-50 border-stop-500/25', solid: 'bg-stop-600 text-white', text: 'text-stop-700', chip: 'bg-stop-600 text-white', icon: '✕' },
  ask: { bar: 'bg-ask-500', soft: 'bg-ask-50 border-ask-500/30', solid: 'bg-ask-500 text-white', text: 'text-ask-700', chip: 'bg-ask-500 text-white', icon: '!' },
  /*
   * Done: a fact, not an instruction. Not green, because green at a barrier
   * means let them through, and a checked-in pass must not be let through a
   * second time. Not red, because nothing is wrong. The brand teal, and a word
   * rather than a tick, so it cannot be mistaken for "go" from a metre away.
   */
  done: { bar: 'bg-brand', soft: 'bg-brand/5 border-brand/25', solid: 'bg-brand text-white', text: 'text-brand', chip: 'bg-brand text-white', icon: 'IN' },
};

export const toneOf = (v) => TONE[verdictOf(v).tone];

/** 'HH:MM' in the phone's locale, for a log read at a glance. */
export const clock = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
};

/*
 * A number plate as it is written on the vehicle: no spaces.
 *
 * It used to be grouped — KA 31 N 8147 — which reads nicely in print and badly
 * at a barrier: staff compare what is on screen with the metal in front of them
 * character by character, and inserted spaces are one more difference to
 * discount while a queue waits. The plate is shown the way it was typed and the
 * way it is stored.
 */
export const plateText = (reg) => String(reg || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
