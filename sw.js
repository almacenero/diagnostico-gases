// Precache de todo el sitio: la app funciona 100% sin conexión.
// Estrategia stale-while-revalidate: responde desde caché al instante y, si hay
// internet, actualiza la caché en segundo plano (la próxima apertura ya trae la
// versión nueva). Cambiar CACHE solo si se agregan o quitan archivos de ASSETS.
// Las descargas usan cache: 'no-cache' para saltarse la caché HTTP del
// navegador; si no, podría mezclar archivos de versiones distintas.
const CACHE = 'diagnostico-gases-v1.1.0';
const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/engine.js',
  'js/rules.js',
  'js/template.js',
  'vendor/xlsx.full.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'plantilla/reglas_ejemplo.xlsx',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const sameOrigin = new URL(e.request.url).origin === self.location.origin;
    const update = fetch(e.request, sameOrigin ? { cache: 'no-cache' } : undefined)
      .then((res) => {
        if (res.ok && sameOrigin) {
          cache.put(e.request, res.clone());
        }
        return res;
      })
      .catch(() => hit || Response.error());
    if (hit) {
      e.waitUntil(update);
      return hit;
    }
    return update;
  }));
});
