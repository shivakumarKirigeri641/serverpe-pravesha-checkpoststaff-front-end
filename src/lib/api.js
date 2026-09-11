/**
 * api.js — every call the gate app makes.
 *
 * THE TOKEN IS THE SHIFT. Sign-in returns it, it lives in localStorage so the
 * app survives the phone locking or the browser being killed mid-queue, and it
 * is sent on every request. When the back-end says the shift has ended — signed
 * out, taken over by the next shift, or idle too long — every screen must return
 * to sign-in at once, so a 401 clears the token and notifies the app rather than
 * being handled in each screen.
 *
 * NETWORK FAILURE IS NOT A VERDICT. A gate on a hill loses signal. A request
 * that never reached the server is reported as an offline error, never as
 * "no such pass" — the difference decides whether a visitor is waved through or
 * turned away.
 */

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const P = `${BASE}/staff/api`;
const KEY = 'pravesha.gate.token';

export const getToken = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

/** Screens subscribe to this to bounce back to sign-in when a shift ends. */
const listeners = new Set();
export const onSignedOut = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const signedOut = () => { setToken(null); listeners.forEach((fn) => fn()); };

export class ApiError extends Error {
  constructor(message, { code = 'error', status = 0, body = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
    this.offline = code === 'offline';
  }
}

async function call(path, { method = 'GET', body, auth = true, timeoutMs = 12000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${P}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new ApiError(
      e.name === 'TimeoutError'
        ? 'The network is slow here. Try again in a moment.'
        : 'No connection. Check the signal and try again.',
      { code: 'offline' });
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && auth) {
    signedOut();
    throw new ApiError(data.message || 'Your shift has ended. Please sign in again.',
      { code: 'signed_out', status: 401, body: data });
  }
  /* A refusal the screens must show (wrong PIN, locked, unknown pass) still
     carries its body: the caller decides how to render it. */
  if (!res.ok && res.status !== 423) {
    throw new ApiError(data.message || 'Something went wrong. Please try again.',
      { code: data.error || 'error', status: res.status, body: data });
  }
  return data;
}

export const api = {
  signIn: (mobile, pin, checkpostId) =>
    call('/session', { method: 'POST', auth: false, body: { mobile, pin, checkpostId } })
      .catch((e) => {
        /* Wrong PIN and locked are answers, not failures: hand the body back. */
        if (e.body && (e.code === 'bad_credentials' || e.code === 'locked' || e.code === 'no_posting')) return e.body;
        throw e;
      }),
  session: () => call('/session'),
  signOut: () => call('/session', { method: 'DELETE' }),
  arrivals: (date) => call(`/arrivals${date ? `?date=${date}` : ''}`),
  search: (q) => call(`/search?q=${encodeURIComponent(q)}`),
  pass: (ticketNo) => call(`/pass/${encodeURIComponent(ticketNo)}`),
  entry: (ticketNo, { override = false, typed = null } = {}) =>
    call('/entry', { method: 'POST', body: { ticketNo, override, typed } }),
  recent: () => call('/recent'),
};
