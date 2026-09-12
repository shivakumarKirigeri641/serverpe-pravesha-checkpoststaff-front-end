/*
 * How each verdict looks and what the staff member should do about it.
 *
 * `action` is the sentence a person acts on — the API's message explains the
 * fact ("this pass was for 9 September"), this says what to do about it. Tones
 * are only three, deliberately: go, stop, ask. Anything subtler is unreadable
 * from a metre away in the rain.
 */

export const VERDICTS = {
  valid: { tone: 'go', title: 'Valid pass', action: 'Record the entry and let them through.' },
  valid_override: { tone: 'go', title: 'Entry recorded', action: 'Recorded outside the slot, with your name on it.' },
  already_used: { tone: 'stop', title: 'Already used', action: 'This pass was used once. One pass is one entry.' },
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
};

export const verdictOf = (v) => VERDICTS[v] || { tone: 'stop', title: 'Not valid', action: 'Ask them to check their pass.' };

export const TONE = {
  go: { bar: 'bg-pass-500', soft: 'bg-pass-50 border-pass-500/25', text: 'text-pass-700', chip: 'bg-pass-500 text-white', icon: '✓' },
  stop: { bar: 'bg-stop-600', soft: 'bg-stop-50 border-stop-500/25', text: 'text-stop-700', chip: 'bg-stop-600 text-white', icon: '✕' },
  ask: { bar: 'bg-ask-500', soft: 'bg-ask-50 border-ask-500/30', text: 'text-ask-700', chip: 'bg-ask-500 text-white', icon: '!' },
};

export const toneOf = (v) => TONE[verdictOf(v).tone];

/** 'HH:MM' in the phone's locale, for a log read at a glance. */
export const clock = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
};

/** 'KA31N8147' → 'KA 31 N 8147', which is how a plate is read aloud. */
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
