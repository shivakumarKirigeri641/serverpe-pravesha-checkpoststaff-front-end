/*
 * The gate app, without signal.
 *
 * WHAT THIS KEEPS. The app itself — the page, its script and styles, the icons —
 * so that opening it on a hill with no signal still shows the gate screen
 * instead of the browser's "no internet" page. Nothing from the API is kept
 * here: today's passes and the entries waiting to be sent are kept by the app
 * (src/lib/offline.js), which knows what they mean. A service worker that cached
 * API answers would happily show a pass as unused an hour after it was used.
 *
 * HOW. The page is fetched from the network first and the saved copy is used
 * only when that fails, so a new version reaches the gate the next time it has
 * signal. The hashed script and style files never change once built, so they are
 * served from the saved copy first.
 */

const CACHE = 'pravesha-gate-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon-32.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* The API is never answered from here, nor is the build id the app compares
     itself against (lib/pwa.js) — a saved copy would hide every new version. */
  if (url.pathname.startsWith('/staff/') || url.pathname === '/version.json') return;

  /* The page: network first, the saved page when there is no signal. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  /* Built files and icons from this site: saved copy first, then the network. */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })),
    );
  }
});
