/*
 * The gate app as an installed app on the phone (user, 2026-09-19).
 *
 * INSTALL. Chrome on Android offers installing once, early, through an event it
 * fires before the page has drawn anything; it is caught here, at load, and kept
 * until a staff member taps "Install". iPhones fire no such event — installing
 * there is Share → Add to Home Screen, so the banner shows those two steps
 * instead. Nothing is offered once the app is already running installed.
 *
 * A NEW VERSION. A gate phone can stay on the same page for a whole season, so
 * a deploy must be able to say so. Every build writes /version.json with its
 * own id (vite.config.js) and knows that id itself; the app asks for the file
 * when it comes back to the screen and every half hour, and when the ids differ
 * it offers a refresh. Never a refresh on its own: somebody may be halfway
 * through an entry. Entries waiting to be sent are kept by lib/offline.js and
 * survive the refresh.
 */

const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const DISMISS_KEY = 'pv_gate_install_dismissed';
const DISMISS_DAYS = 7;
const CHECK_EVERY_MS = 30 * 60 * 1000;

const state = { canInstall: false, iosGuide: false, updateReady: false };
const listeners = new Set();
let deferred = null;

const emit = () => listeners.forEach((fn) => fn({ ...state }));

export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

export function dismissInstall() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* shown again next time */ }
  state.canInstall = false;
  state.iosGuide = false;
  emit();
}

export async function install() {
  if (!deferred) return;
  deferred.prompt();
  const choice = await deferred.userChoice.catch(() => null);
  deferred = null;
  state.canInstall = false;
  if (choice && choice.outcome === 'dismissed') dismissInstall();
  emit();
}

export const refresh = () => window.location.reload();

async function checkVersion() {
  if (BUILD === 'dev' || state.updateReady || !navigator.onLine) return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== BUILD) {
      state.updateReady = true;
      emit();
    }
  } catch { /* no signal: asked again later */ }
}

export function startPwa() {
  if (!installed() && !dismissedRecently()) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      state.canInstall = true;
      emit();
    });
    if (isIos()) state.iosGuide = true;
  }
  window.addEventListener('appinstalled', () => {
    deferred = null;
    state.canInstall = false;
    state.iosGuide = false;
    emit();
  });

  /* Keep the app itself on the phone, so it opens with no signal (public/sw.js).
     Only in a built app: during development a saved copy would hide every change. */
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* the app still works online */ });
    });
  }

  if (import.meta.env.PROD) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
    window.addEventListener('online', checkVersion);
    setInterval(checkVersion, CHECK_EVERY_MS);
    setTimeout(checkVersion, 10 * 1000);
  }
}
