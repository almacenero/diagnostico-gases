// Licencias firmadas (ECDSA P-256). El código de licencia es
// base64url(payload JSON) + "." + base64url(firma), emitido con
// `npm run licencia -- emitir`. La app solo tiene la clave pública: puede
// verificar licencias pero no fabricarlas.
//
// Payload: { id, c: cliente, t: 'demo' | 'full', exp: 'AAAA-MM-DD' | null,
//            g: días máximos sin validar en línea, iat }
//
// Bloqueo remoto: licencias/estado.json lista los id revocados. La app lo
// consulta al abrir; si pasan más de `g` días sin poder consultarlo, se bloquea
// hasta que haya conexión.
import { PUBLIC_KEY } from './license-key.js';

const DAY = 86400000;
const STORE = 'dg.license';
const STATUS_URL = 'licencias/estado.json';

const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function verifyToken(token, jwk = PUBLIC_KEY) {
  const [payload, sig] = String(token || '').trim().split('.');
  if (!payload || !sig) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, key, fromB64url(sig), new TextEncoder().encode(payload));
    return ok ? JSON.parse(new TextDecoder().decode(fromB64url(payload))) : null;
  } catch {
    return null;
  }
}

// Fin del día de vencimiento, en hora local.
export const expiresAt = (lic) => (lic.exp ? Date.parse(`${lic.exp}T23:59:59`) : null);

// Decide si la app puede usarse. `now` ya debe venir corregido contra
// retrocesos de reloj (ver effectiveNow).
export function evaluateLicense({ lic, now, lastCheck, revoked = [] }) {
  if (!lic) return { ok: false, reason: 'sin-licencia' };
  if (revoked.includes(lic.id)) return { ok: false, reason: 'revocada', lic };
  const exp = expiresAt(lic);
  if (exp && now > exp) return { ok: false, reason: 'vencida', lic };
  const graceMs = (lic.g ?? 3) * DAY;
  if (!lastCheck || lastCheck > now + DAY || now - lastCheck > graceMs) {
    return { ok: false, reason: 'sin-conexion', lic };
  }
  const daysLeft = exp ? Math.ceil((exp - now) / DAY) : null;
  return { ok: true, lic, daysLeft };
}

// Nunca retrocede: si alguien atrasa el reloj del celular, se usa la hora más
// alta vista antes (o la del servidor si hay conexión).
export const effectiveNow = (deviceNow, maxSeen = 0, serverNow = 0) => Math.max(deviceNow, maxSeen, serverNow);

// ---- Estado guardado en el dispositivo ----

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function saveState(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* modo privado */ }
}

async function fetchStatus() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      revoked: Array.isArray(data.revocadas) ? data.revocadas : [],
      serverNow: Date.parse(res.headers.get('date')) || 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Guarda un código nuevo si es válido. Devuelve la licencia o null.
export async function activate(token) {
  const lic = await verifyToken(token);
  if (!lic) return null;
  const state = loadState();
  saveState({ ...state, token: String(token).trim() });
  return lic;
}

// Verifica la licencia guardada, consultando el estado en línea si se puede.
export async function checkLicense() {
  const state = loadState();
  const lic = state.token ? await verifyToken(state.token) : null;
  const status = lic ? await fetchStatus() : null;
  if (status) {
    state.revoked = status.revoked;
    state.lastCheck = status.serverNow || Date.now();
  }
  const now = effectiveNow(Date.now(), state.maxSeen, status?.serverNow);
  state.maxSeen = now;
  saveState(state);
  return evaluateLicense({ lic, now, lastCheck: state.lastCheck, revoked: state.revoked });
}
