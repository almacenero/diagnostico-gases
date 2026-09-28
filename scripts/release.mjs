// Actualiza CACHE en sw.js con un hash del contenido de los archivos de la app.
// Ejecutar antes de publicar: npm run release
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

const root = (p) => new URL(`../${p}`, import.meta.url).pathname;

export function computeCacheName() {
  const sw = fs.readFileSync(root('sw.js'), 'utf8');
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*]/, ']'));
  const hash = crypto.createHash('sha256');
  for (const a of assets) hash.update(fs.readFileSync(root(a === './' ? 'index.html' : a)));
  return `diagnostico-gases-${hash.digest('hex').slice(0, 10)}`;
}

export function currentCacheName() {
  return fs.readFileSync(root('sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = computeCacheName();
  const sw = fs.readFileSync(root('sw.js'), 'utf8');
  fs.writeFileSync(root('sw.js'), sw.replace(/const CACHE = '[^']+'/, `const CACHE = '${name}'`));
  console.log(`sw.js -> ${name}`);
}
