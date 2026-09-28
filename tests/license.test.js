import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { effectiveNow, evaluateLicense, verifyToken } from '../js/license.js';

// Par de claves de prueba (no es la clave real de producción).
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });

function sign(payload, key = privateKey) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
  return `${body}.${sig.toString('base64url')}`;
}

const DAY = 86400000;
const demo = { id: 'L-00000001', c: 'Santiago Pérez', t: 'demo', exp: '2026-10-13', g: 3, iat: '2026-09-28' };
const now = Date.parse('2026-10-01T10:00:00');

test('un código firmado se verifica y conserva tildes', async () => {
  assert.deepEqual(await verifyToken(sign(demo), jwk), demo);
});

test('un código alterado (fecha cambiada) se rechaza', async () => {
  const [, sig] = sign(demo).split('.');
  const forged = Buffer.from(JSON.stringify({ ...demo, exp: '2030-01-01' })).toString('base64url');
  assert.equal(await verifyToken(`${forged}.${sig}`, jwk), null);
});

test('un código firmado con otra clave se rechaza', async () => {
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  assert.equal(await verifyToken(sign(demo, other), jwk), null);
});

test('basura o vacío -> null', async () => {
  assert.equal(await verifyToken('', jwk), null);
  assert.equal(await verifyToken('abc', jwk), null);
  assert.equal(await verifyToken('abc.def', jwk), null);
});

test('licencia vigente y validada hace poco -> ok con días restantes', () => {
  const r = evaluateLicense({ lic: demo, now, lastCheck: now - DAY });
  assert.equal(r.ok, true);
  assert.equal(r.daysLeft, 13);
});

test('vence al final del día indicado', () => {
  const last = Date.parse('2026-10-13T23:00:00');
  assert.equal(evaluateLicense({ lic: demo, now: last, lastCheck: last }).ok, true);
  const after = Date.parse('2026-10-14T00:00:01');
  assert.equal(evaluateLicense({ lic: demo, now: after, lastCheck: after }).reason, 'vencida');
});

test('revocada -> bloqueada aunque no haya vencido', () => {
  const r = evaluateLicense({ lic: demo, now, lastCheck: now, revoked: ['L-00000001'] });
  assert.equal(r.reason, 'revocada');
});

test('más días sin validar en línea que la gracia -> pide conexión', () => {
  assert.equal(evaluateLicense({ lic: demo, now, lastCheck: now - 4 * DAY }).reason, 'sin-conexion');
  assert.equal(evaluateLicense({ lic: demo, now, lastCheck: null }).reason, 'sin-conexion');
  // Una fecha de validación "del futuro" es manipulación.
  assert.equal(evaluateLicense({ lic: demo, now, lastCheck: now + 5 * DAY }).reason, 'sin-conexion');
});

test('licencia completa sin vencimiento', () => {
  const full = { ...demo, t: 'full', exp: null, g: 30 };
  const r = evaluateLicense({ lic: full, now, lastCheck: now - 20 * DAY });
  assert.deepEqual([r.ok, r.daysLeft], [true, null]);
});

test('sin licencia', () => {
  assert.equal(evaluateLicense({ lic: null, now }).reason, 'sin-licencia');
});

test('atrasar el reloj del dispositivo no revive una demo vencida', () => {
  const maxSeen = Date.parse('2026-10-20T09:00:00'); // ya se vio esta fecha antes
  const relojAtrasado = Date.parse('2026-10-05T09:00:00');
  const t = effectiveNow(relojAtrasado, maxSeen);
  assert.equal(evaluateLicense({ lic: demo, now: t, lastCheck: t }).reason, 'vencida');
});
