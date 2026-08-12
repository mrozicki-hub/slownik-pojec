/* sw.js — obsługa trybu offline.
 * Powłoka aplikacji z pamięci podręcznej, dane najpierw z sieci.
 * Po zmianie któregokolwiek pliku podnieś numer wersji.
 */
var VERSION = 'v2';
var SHELL = 'shell-' + VERSION;
var DATA = 'data-' + VERSION;

var SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './fsrs.js',
  './config.js',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

var DATA_FILES = ['cards.js', 'progress.js', 'reviews.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== DATA) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Wywołania API GitHuba nigdy nie idą przez pamięć podręczną.
  if (url.hostname === 'api.github.com') return;

  var isData = DATA_FILES.some(function (f) { return url.pathname.endsWith('/' + f); });

  if (isData) {
    // Dane: najpierw sieć, przy braku łączności ostatnia znana wersja.
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(DATA).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || new Response('/* offline */', { headers: { 'Content-Type': 'application/javascript' } });
        });
      })
    );
    return;
  }

  // Powłoka: najpierw pamięć podręczna, w tle odświeżenie.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
