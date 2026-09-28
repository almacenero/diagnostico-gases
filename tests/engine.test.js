import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { DEFAULT_RULES } from '../js/rules.js';
import { diagnose, normalizeRules, toNumber } from '../js/engine.js';

const ids = (r) => r.found.map((x) => x.id);

test('motor en buen estado -> combustión correcta', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 0.2, HC: 40, CO2: 14.8, O2: 0.4, Lambda: 1.0 }, '');
  assert.deepEqual(ids(r), ['R01']);
});

test('mezcla rica', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 3.2, HC: 250, CO2: 12, O2: 0.3, Lambda: 0.88 }, '');
  assert.deepEqual(ids(r), ['R02']);
});

test('falla de encendido y mezcla pobre, ordenadas por severidad', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 0.3, HC: 800, CO2: 11, O2: 3.5, Lambda: 1.12 }, '');
  assert.deepEqual(ids(r), ['R04', 'R03']);
});

test('una regla con rango de un gas no medido no aplica', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 3.2 }, '');
  assert.deepEqual(ids(r), []);
});

test('códigos: coincidencia sin distinguir mayúsculas y códigos desconocidos', () => {
  const r = diagnose(DEFAULT_RULES, {}, 'e01, X99');
  assert.deepEqual(ids(r), ['R09']);
  assert.deepEqual(r.unknownCodes, ['X99']);
});

test('toNumber acepta coma decimal y vacíos', () => {
  assert.equal(toNumber('1,5'), 1.5);
  assert.equal(toNumber(''), null);
  assert.equal(toNumber('abc'), null);
  assert.equal(toNumber(0), 0);
});

test('normalizeRules: encabezados flexibles, severidad por defecto y errores', () => {
  const { rules, errors } = normalizeRules([
    { 'CO min': '2', 'Diagnóstico': 'Rica', Severidad: 'alta' },
    { HC_max: 50, diagnostico: 'Sin severidad' },
    { diagnostico: 'Sin condiciones' },
    { CO_min: 1 },
    {},
  ]);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].CO_min, 2);
  assert.equal(rules[0].severidad, 'Alta');
  assert.equal(rules[1].severidad, 'Media');
  assert.equal(errors.length, 2);
});

test('la plantilla Excel generada se vuelve a leer igual a las reglas por defecto', () => {
  XLSX.set_fs(fs);
  const wb = XLSX.readFile(new URL('../plantilla/reglas_ejemplo.xlsx', import.meta.url).pathname);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Reglas, { defval: null });
  const { rules, errors } = normalizeRules(rows);
  assert.deepEqual(errors, []);
  assert.equal(rules.length, DEFAULT_RULES.length);
  for (const [i, def] of DEFAULT_RULES.entries()) {
    for (const [k, v] of Object.entries(def)) assert.equal(rules[i][k], v, `${def.id}.${k}`);
  }
});

test('un Excel que no es la plantilla de reglas da un error claro', () => {
  // Misma estructura que el archivo de cálculo de lambda compartido por el cliente.
  const ws = XLSX.utils.aoa_to_sheet([
    ['VALORES ENTREGADOS POR EL EQUIPO', null, null, null],
    ['CO2 %', 7, 'O2%', 5],
    ['CO PPM', 250, 'HC PPM', 500],
  ]);
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  assert.throws(() => normalizeRules(rows, 'Hoja1'), /Hoja1.*no tiene el formato.*diagnostico/);
});

test('plantilla vacía (solo encabezados) no es un error de formato', () => {
  assert.deepEqual(normalizeRules([]), { rules: [], errors: [] });
});
