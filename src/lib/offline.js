import { api } from './api';

/*
 * Working a gate with no signal.
 *
 * WHAT THE PHONE KEEPS. Every time today's list of passes arrives it is saved on
 * the phone. When the signal goes, the gate screen carries on from that saved
 * list: search still finds a plate, a pass still opens, and the phone itself
 * says whether it is valid — right day, inside its slot, not already used.
 *
 * WHAT IT CANNOT KNOW. A pass bought after the list was saved is not on it, and
 * a pass used at the other gate in the meantime still looks unused. So an entry
 * recorded without signal is a promise to tell the server, not a verdict the
 * server has agreed to: it is kept in a queue on the phone, shown as "waiting to
 * send", and sent the moment the signal is back. Whatever the server could not
 * accept — used elsewhere, cancelled — comes back as a problem the staff member
 * is shown and the office can see, because the vehicle has already gone in.
 *
 * EACH ENTRY IS SENT ONCE, EVEN IF SENT TWICE. Every queued entry carries an id
 * made on the phone; a reply lost to a dropping signal means the same entry is
 * sent again, and the server records it only the first time.
 *
 * SELLING A PASS STILL NEEDS SIGNAL. A sale takes the next pass and invoice
 * number and a place in the slot; two offline phones could each sell the last
 * place. That waits for signal.
 */

const KEYS = { arrivals: 'pv_gate_arrivals', queue: 'pv_gate_queue', problems: 'pv_gate_problems' };
const LAST_ENTRY_BUFFER_MIN = 60;

const read = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or private mode */ }
};

const listeners = new Set();
const snapshot = () => ({ queued: queue().length, problems: problems(), sending });
const notify = () => listeners.forEach((fn) => fn(snapshot()));

/** Screens that show the queue subscribe; the first subscriber starts the sender. */
export function subscribe(fn) {
  listeners.add(fn);
  startSender();
  fn(snapshot());
  return () => listeners.delete(fn);
}

/* ───────────────────────────────────────────── today's list, on the phone */

export function saveArrivals(data) {
  if (data && Array.isArray(data.passes)) write(KEYS.arrivals, { savedAt: new Date().toISOString(), data });
}

/**
 * A list of passes, with anything recorded offline and not sent yet shown as
 * entered. Applied to the server's fresh answer directly — not to a copy read
 * back out of storage, which is the old list whenever that write failed.
 */
export function withQueue(data) {
  if (!data || !Array.isArray(data.passes)) return data;
  const waiting = new Map(queue().map((q) => [q.ticketNo, q]));
  if (!waiting.size) return data;
  const passes = data.passes.map((p) => (waiting.has(p.ticketNo) && p.status !== 'used'
    ? { ...p, status: 'used', usedAt: waiting.get(p.ticketNo).recordedAt, savedOffline: true }
    : p));
  const entered = passes.filter((p) => p.status === 'used').length;
  return { ...data, passes, totals: { ...(data.totals || {}), expected: passes.length, entered, pending: passes.length - entered } };
}

/** The saved list, with anything recorded offline already shown as entered. */
export function savedArrivals() {
  const saved = read(KEYS.arrivals, null);
  if (!saved || !saved.data) return null;
  return { ...withQueue(saved.data), savedAt: saved.savedAt, fromPhone: true };
}

/**
 * One pass shown as entered straight away, before any reload confirms it. The
 * vehicle is already through the barrier; the list should say so at once.
 */
export function markEntered(data, ticketNo, usedAt) {
  if (!data || !Array.isArray(data.passes) || !ticketNo) return data;
  let changed = false;
  const passes = data.passes.map((p) => {
    if (p.ticketNo !== ticketNo || p.status === 'used') return p;
    changed = true;
    return { ...p, status: 'used', usedAt: usedAt || new Date().toISOString() };
  });
  if (!changed) return data;
  const entered = passes.filter((p) => p.status === 'used').length;
  return { ...data, passes, totals: { ...(data.totals || {}), entered, pending: passes.length - entered } };
}

/* ─────────────────────────────────────────────────── a verdict, offline */

const ist = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};
const toMinutes = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * The same rules the server applies, for a pass on the saved list. The order is
 * the server's: already used before wrong day before outside the slot.
 */
export function localVerdict(pass, at = new Date()) {
  if (!pass) return { verdict: 'unknown_ticket', blocking: true };
  /* Blocked on the watchlist outranks everything, as it does on the server. */
  if (pass.watch && pass.watch.level === 'block') {
    return { verdict: 'watch_blocked', blocking: true, message: `On the watchlist — do not allow entry.${pass.watch.reason ? ` Reason: ${pass.watch.reason}` : ''}` };
  }
  const waiting = queue().find((q) => q.ticketNo === pass.ticketNo);
  if (waiting) return { verdict: 'already_used', blocking: true, usedAt: waiting.recordedAt };
  if (pass.status === 'used') {
    if (pass.entrySource === 'self') return { verdict: 'self_declared', blocking: false, usedAt: pass.usedAt };
    return { verdict: 'already_used', blocking: true, usedAt: pass.usedAt };
  }
  const now = ist(at);
  if (pass.travelDate !== now.date) {
    return { verdict: 'wrong_day', blocking: true, message: `This pass is for ${pass.travelDate}.` };
  }
  const startsAt = toMinutes(String(pass.slot?.startsAt || '').slice(0, 5));
  const lastEntry = toMinutes(String(pass.slot?.endsAt || '').slice(0, 5)) - LAST_ENTRY_BUFFER_MIN;
  if (pass.slot?.startsAt && now.minutes < startsAt) {
    return { verdict: 'wrong_slot', blocking: false, overridable: true, message: `Their slot starts at ${hhmm(startsAt)}. They are early.` };
  }
  if (pass.slot?.endsAt && now.minutes > lastEntry) {
    return { verdict: 'wrong_slot', blocking: false, overridable: true, message: `Last entry for this slot was ${hhmm(lastEntry)}. They are late.` };
  }
  return { verdict: 'valid', blocking: false };
}

/* ─────────────────────────────────────────────── entries waiting to send */

export const queue = () => read(KEYS.queue, []);
export const problems = () => read(KEYS.problems, []);

const newId = () => {
  try { return crypto.randomUUID().replace(/-/g, ''); } catch { /* older browser */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

/** Keep an entry on the phone, to be sent when the signal is back. */
export function enqueue({ pass, override = false, typed = null, elapsedMs = null }) {
  const item = {
    clientId: newId(),
    ticketNo: pass.ticketNo,
    regNo: pass.regNo,
    type: pass.category?.label || null,
    override: override === true,
    typed,
    elapsedMs,
    recordedAt: new Date().toISOString(),
  };
  write(KEYS.queue, [...queue(), item]);
  notify();
  setTimeout(sendNow, 0);
  return item;
}

export function dismissProblem(clientId) {
  write(KEYS.problems, problems().filter((p) => p.clientId !== clientId));
  notify();
}

let sending = false;

/**
 * Send whatever is waiting, oldest first. Stops at the first request that does
 * not reach the server — the rest wait for the next attempt, in order.
 */
export async function sendNow() {
  if (sending || !queue().length) return;
  sending = true;
  notify();
  try {
    for (const item of queue()) {
      let out;
      try {
        out = await api.entryOffline(item);
      } catch (e) {
        /* No signal, or the shift ended: keep it, try again later. */
        if (e.offline || e.status === 401 || e.status >= 500) break;
        out = { ok: false, message: e.message };
      }
      write(KEYS.queue, queue().filter((q) => q.clientId !== item.clientId));
      if (!out.ok) {
        write(KEYS.problems, [...problems(), {
          clientId: item.clientId, ticketNo: item.ticketNo, regNo: item.regNo, recordedAt: item.recordedAt,
          verdict: out.verdict || null, message: out.message || null, usedAt: out.usedAt || null,
        }]);
      }
      notify();
    }
  } finally {
    sending = false;
    notify();
  }
}

let started = false;
function startSender() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { sendNow(); });
  setInterval(() => { if (queue().length && document.visibilityState === 'visible') sendNow(); }, 15000);
  sendNow();
}
