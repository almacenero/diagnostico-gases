// Funcionamiento sin conexión con actualizaciones atómicas: cada versión se
// guarda completa en su propia caché y reemplaza a la anterior solo cuando
// terminó de descargarse, así nunca se mezclan archivos de versiones distintas.
//
// CACHE lleva un hash del contenido de ASSETS y lo actualiza
// `npm run release` (npm test falla si quedó desactualizado). Al publicar un
// sw.js distinto, el navegador instala la versión nueva; se usa desde la
// siguiente apertura de la app.
const CACHE = 'diagnostico-gases-585a8a866e';
const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/engine.js',
  'js/rules.js',
  'js/template.js',
  'js/license.js',
  'js/license-key.js',
  'vendor/xlsx.full.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'plantilla/reglas_ejemplo.xlsx',
];

// Cada archivo se descarga con ?v=<CACHE>: la CDN de GitHub Pages (que guarda
// copias hasta 10 min tras publicar) no tiene esa URL y la pide al origen, así
// todos los archivos llegan de la misma versión. Se guardan sin el ?v=.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(`${url}?v=${CACHE}`, { cache: 'reload' });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      await c.put(url, res);
    })))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // El estado de licencias siempre va a la red: nunca se sirve desde caché.
  if (new URL(e.request.url).pathname.includes('/licencias/')) return;
  e.respondWith(caches.open(CACHE)
    .then((c) => c.match(e.request, { ignoreSearch: true }))
    .then((hit) => hit || fetch(e.request)));
});
