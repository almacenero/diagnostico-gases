import { GASES, SEVERIDADES } from './rules.js';

const RANGE_KEYS = GASES.flatMap((g) => [`${g.key}_min`, `${g.key}_max`]);
const TEXT_KEYS = ['id', 'codigo', 'diagnostico', 'causas', 'recomendacion', 'severidad'];

// "CO min", "co_MIN", "Diagnóstico" -> clave canónica de COLUMNAS.
const canonical = (() => {
  const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const map = new Map([...RANGE_KEYS, ...TEXT_KEYS].map((k) => [strip(k), k]));
  map.set('co2min', 'CO2_min');
  map.set('co2max', 'CO2_max');
  map.set('recomendaciones', 'recomendacion');
  map.set('codigos', 'codigo');
  return (header) => map.get(strip(header));
})();

// Acepta 1.5, "1,5" y celdas vacías.
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const normCode = (c) => String(c ?? '').trim().toUpperCase();

// Convierte filas crudas (del Excel) en reglas válidas. Devuelve también los
// errores por fila para mostrárselos al usuario.
export function normalizeRules(rows) {
  const rules = [];
  const errors = [];
  rows.forEach((raw, i) => {
    const fila = i + 2; // fila 1 = encabezados
    const rule = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = canonical(header);
      if (!key) continue;
      rule[key] = RANGE_KEYS.includes(key) ? toNumber(value) : String(value ?? '').trim();
    }
    if (!rule.diagnostico) {
      if (Object.values(rule).some((v) => v !== null && v !== '')) {
        errors.push(`Fila ${fila}: falta el diagnóstico.`);
      }
      return;
    }
    const hasRange = RANGE_KEYS.some((k) => rule[k] !== null && rule[k] !== undefined);
    if (!hasRange && !rule.codigo) {
      errors.push(`Fila ${fila}: la regla "${rule.diagnostico}" no tiene código ni rangos.`);
      return;
    }
    const sev = SEVERIDADES.find((s) => s.toLowerCase() === String(rule.severidad || '').toLowerCase());
    rule.severidad = sev || 'Media';
    rule.id = rule.id || `F${fila}`;
    rules.push(rule);
  });
  return { rules, errors };
}

// Una regla aplica si TODAS sus condiciones se cumplen. Si la regla pide un
// rango de un gas que no se midió, no aplica.
function matches(rule, values, codes) {
  if (rule.codigo) {
    const ruleCodes = String(rule.codigo).split(/[,;\s]+/).map(normCode).filter(Boolean);
    if (!ruleCodes.some((c) => codes.has(c))) return false;
  }
  for (const g of GASES) {
    const min = rule[`${g.key}_min`];
    const max = rule[`${g.key}_max`];
    if (min == null && max == null) continue;
    const v = values[g.key];
    if (v == null) return false;
    if (min != null && v < min) return false;
    if (max != null && v > max) return false;
  }
  return true;
}

export function diagnose(rules, values, codesText) {
  const codes = new Set(String(codesText || '').split(/[,;\s]+/).map(normCode).filter(Boolean));
  const order = (r) => SEVERIDADES.indexOf(r.severidad);
  const found = rules.filter((r) => matches(r, values, codes)).sort((a, b) => order(a) - order(b));
  const matchedCodes = new Set(found.flatMap((r) => String(r.codigo || '').split(/[,;\s]+/).map(normCode)));
  const unknownCodes = [...codes].filter((c) => !matchedCodes.has(c));
  return { found, unknownCodes };
}

// ---- Excel (SheetJS cargado como global XLSX) ----

export async function readRulesFile(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  const name = wb.SheetNames.find((n) => n.toLowerCase() === 'reglas') || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
  return normalizeRules(rows);
}
