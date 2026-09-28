// Herramienta de licencias. La clave privada vive en .licencias/ y NUNCA se
// sube a git: quien la tenga puede emitir licencias. Haga respaldo de ella.
//
//   npm run licencia -- init
//   npm run licencia -- emitir --cliente "Santiago" [--tipo demo|full] [--dias 15] [--gracia 3]
//   npm run licencia -- revocar L-XXXXXXXX
//   npm run licencia -- restaurar L-XXXXXXXX
//   npm run licencia -- listar
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { parseArgs } from 'node:util';

const root = (p) => new URL(`../${p}`, import.meta.url).pathname;
const PRIV = root('.licencias/privada.pem');
const LOG = root('.licencias/emitidas.jsonl');
const PUB_JS = root('js/license-key.js');
const ESTADO = root('licencias/estado.json');
const APP_URL = 'https://almacenero.github.io/diagnostico-gases/';

const DEFAULTS = { demo: { dias: 15, gracia: 3 }, full: { dias: 0, gracia: 30 } };

const localDate = (ms) => new Date(ms).toLocaleDateString('sv'); // AAAA-MM-DD
const readEstado = () => JSON.parse(fs.readFileSync(ESTADO, 'utf8'));
const writeEstado = (e) => fs.writeFileSync(ESTADO, `${JSON.stringify(e, null, 2)}\n`);
const fail = (msg) => { console.error(msg); process.exit(1); };

function init() {
  if (fs.existsSync(PRIV)) fail(`Ya existe una clave privada en ${PRIV}. No se sobrescribe.`);
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.mkdirSync(root('.licencias'), { recursive: true });
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const { kty, crv, x, y } = publicKey.export({ format: 'jwk' });
  fs.writeFileSync(PUB_JS, '// Clave pública para verificar licencias. Generada con `npm run licencia -- init`.\n'
    + `export const PUBLIC_KEY = ${JSON.stringify({ kty, crv, x, y })};\n`);
  if (!fs.existsSync(ESTADO)) {
    fs.mkdirSync(root('licencias'), { recursive: true });
    writeEstado({ revocadas: [] });
  }
  console.log(`Clave privada: ${PRIV}\nClave pública: ${PUB_JS}\nHaga un respaldo de la clave privada.`);
}

function emitir(opts) {
  if (!fs.existsSync(PRIV)) fail('No hay clave privada. Ejecute primero: npm run licencia -- init');
  if (!opts.cliente) fail('Falta --cliente "Nombre"');
  const tipo = opts.tipo || 'demo';
  if (!DEFAULTS[tipo]) fail('--tipo debe ser demo o full');
  const dias = Number(opts.dias ?? DEFAULTS[tipo].dias);
  const gracia = Number(opts.gracia ?? DEFAULTS[tipo].gracia);
  const payload = {
    id: `L-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    c: opts.cliente,
    t: tipo,
    exp: dias > 0 ? localDate(Date.now() + dias * 86400000) : null,
    g: gracia,
    iat: localDate(Date.now()),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = crypto.createPrivateKey(fs.readFileSync(PRIV));
  const sig = crypto.sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
  const token = `${body}.${sig.toString('base64url')}`;
  fs.appendFileSync(LOG, `${JSON.stringify({ ...payload, token })}\n`);
  console.log(`Licencia ${payload.id} — ${payload.c} (${tipo}, ${payload.exp ? `vence ${payload.exp}` : 'sin vencimiento'}, `
    + `validar en línea cada ${gracia} días)\n\nEnlace de activación:\n${APP_URL}#lic=${token}\n\nCódigo:\n${token}`);
}

function setRevocada(id, revocar) {
  if (!/^L-[0-9A-F]{8}$/.test(id || '')) fail('Indique el id de la licencia, ej. L-1A2B3C4D (ver: npm run licencia -- listar)');
  const estado = readEstado();
  const set = new Set(estado.revocadas);
  if (revocar) set.add(id); else set.delete(id);
  estado.revocadas = [...set];
  writeEstado(estado);
  console.log(`${id} ${revocar ? 'REVOCADA' : 'restaurada'}. Para aplicarlo publique el cambio:\n`
    + `  git commit -am "${revocar ? 'Revocar' : 'Restaurar'} licencia ${id}" && git push\n`
    + 'La app lo aplica la próxima vez que el dispositivo se conecte.');
}

function listar() {
  if (!fs.existsSync(LOG)) fail('No hay licencias emitidas.');
  const revocadas = new Set(readEstado().revocadas);
  const rows = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  for (const l of rows) {
    console.log(`${l.id}  ${revocadas.has(l.id) ? 'REVOCADA' : 'activa  '}  ${l.t.padEnd(4)}  `
      + `vence: ${(l.exp || 'sin vencimiento').padEnd(16)}emitida: ${l.iat}  ${l.c}`);
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { cliente: { type: 'string' }, tipo: { type: 'string' }, dias: { type: 'string' }, gracia: { type: 'string' } },
});
const [cmd, arg] = positionals;
({ init, emitir: () => emitir(values), revocar: () => setRevocada(arg, true),
  restaurar: () => setRevocada(arg, false), listar }[cmd] || (() => fail('Comandos: init | emitir | revocar | restaurar | listar')))();
