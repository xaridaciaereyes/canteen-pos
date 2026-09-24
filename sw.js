// Offline support: keeps the app itself available when the internet drops.
// Firebase data traffic is NOT touched here — Firebase has its own offline queue.
const CACHE = 'canteen-pos-v3';
const SHELL = ['./', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = url.hostname === 'www.gstatic.com' || url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !cdn) return;

  if (sameOrigin) {
    // Network first, so updates you upload to GitHub show up right away.
    e.respondWith(
      fetch(req).then(res => saveCopy(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
  } else {
    // Libraries (Firebase, charts) never change for a fixed version: cache first.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => saveCopy(req, res))));
  }
});
