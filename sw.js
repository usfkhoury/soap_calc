/*
 * sw.js — service worker for offline use.
 *
 * Precaches the app shell (calculator, scale-by-bars, steps, Learn — the "dumb"
 * tool) so it works with no internet. API calls (/api/*) are never cached; the
 * app keeps its own localStorage mirror for offline reads and queues writes.
 */
var VERSION = 'soap-v1';
var SHELL = [
  '/',
  '/index.html',
  '/calc.js',
  '/app.js',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  // Only handle GETs from our own origin; let API + writes go straight to network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/.netlify/') === 0) return;

  // Cache-first for the shell; fall back to network, then to cached index for navigations.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
