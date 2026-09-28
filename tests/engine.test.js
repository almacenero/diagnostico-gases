import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { COMBUSTIBLES, DEFAULT_RULES, GASES } from '../js/rules.js';
import { calcLambda, diagnose, normalizeRules, toNumber, toRuleUnit } from '../js/engine.js';

const ids = (r) => r.found.map((x) => x.id);

// Casos típicos de ralentí (gasolina). Lambda se calcula con Brettschneider.
const CASOS = [
  ['motor sano', { CO: 0.2, HC: 40, CO2: 14.8, O2: 0.4 }, ['R01']],
  ['catalizador (CO alto con λ≈1)', { CO: 0.8, HC: 120, CO2: 13.8, O2: 0.6 }, ['R02']],
  ['catalizador (HC alto con λ≈1)', { CO: 0.3, HC: 180, CO2: 14.2, O2: 0.4 }, ['R03']],
  ['mezcla rica', { CO: 2.0, HC: 200, CO2: 13.0, O2: 0.3 }, ['R04']],
  ['mezcla muy rica', { CO: 4.5, HC: 400, CO2: 11.5, O2: 0.3 }, ['R05']],
  ['mezcla pobre', { CO: 0.1, HC: 150, CO2: 12.5, O2: 3.0 }, ['R06']],
  ['falla de encendido', { CO: 1.2, HC: 1500, CO2: 11.0, O2: 4.0 }, ['R07']],
  ['falla por mezcla muy pobre (ejemplo del Excel del cliente)', { CO: 0.025, HC: 500, CO2: 7, O2: 5 }, ['R08']],
  ['HC alto con mezcla normal', { CO: 0.4, HC: 450, CO2: 14.0, O2: 0.8 }, ['R09']],
  ['CO y O2 altos a la vez', { CO: 1.5, HC: 200, CO2: 12.0, O2: 3.0 }, ['R10']],
  ['muestra diluida (va primero por severidad)', { CO: 0.1, HC: 60, CO2: 7.0, O2: 9.0 }, ['R11', 'R06']],
  ['CO2 bajo con λ≈1', { CO: 0.3, HC: 90, CO2: 11.0, O2: 0.3 }, ['R12']],
  ['NOx alto en motor sano', { CO: 0.2, HC: 40, CO2: 14.8, O2: 0.4, NOx: 1500 }, ['R13', 'R01']],
  ['ligeramente pobre', { CO: 0.6, HC: 90, CO2: 13.5, O2: 1.3 }, ['R14']],
];

for (const [nombre, v, esperado] of CASOS) {
  test(`reglas base: ${nombre}`, () => {
    const values = { ...v, Lambda: calcLambda(v, COMBUSTIBLES[0]) };
    assert.deepEqual(ids(diagnose(DEFAULT_RULES, values, '')), esperado);
  });
}

test('filas con el mismo diagnóstico se muestran una sola vez', () => {
  // CO 0,8 y HC 150 con λ≈1 cumplen R02 y R03 (mismo diagnóstico).
  const v = { CO: 0.8, HC: 150, CO2: 13.8, O2: 0.6 };
  const r = diagnose(DEFAULT_RULES, { ...v, Lambda: calcLambda(v, COMBUSTIBLES[0]) }, '');
  assert.deepEqual(r.found.map((x) => x.diagnostico), ['Catalizador con baja eficiencia']);
});

test('una regla con rango de un gas no medido no aplica', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 3.2 }, '');
  assert.deepEqual(ids(r), []);
});

test('códigos: coincidencia sin distinguir mayúsculas y códigos desconocidos', () => {
  const reglas = [{ id: 'C1', codigo: 'E01, E03', diagnostico: 'Flujo bajo', severidad: 'Media' }];
  const r = diagnose(reglas, {}, 'e03 X99');
  assert.deepEqual(ids(r), ['C1']);
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

const gasolina = COMBUSTIBLES.find((c) => c.key === 'gasolina');
const gas = (k) => GASES.find((g) => g.key === k);

test('lambda corregido con el ejemplo del Excel del cliente (HC en ppm)', () => {
  // CO2 7 %, O2 5 %, CO 250 ppm = 0,025 %, HC 500 ppm. El Excel original daba 1,485.
  const l = calcLambda({ CO2: 7, O2: 5, CO: 0.025, HC: 500 }, gasolina);
  assert.equal(l.toFixed(4), '1.4243');
});

test('lambda ≈ 1 en una combustión estequiométrica típica', () => {
  const l = calcLambda({ CO2: 14.8, O2: 0.3, CO: 0.4, HC: 80 }, gasolina);
  assert.ok(l > 0.97 && l < 1.03, `lambda=${l}`);
});

test('lambda: faltan datos o CO2 = 0 -> null', () => {
  assert.equal(calcLambda({ CO2: 7, O2: 5, CO: 0.025 }, gasolina), null);
  assert.equal(calcLambda({ CO2: 0, O2: 5, CO: 0.025, HC: 500 }, gasolina), null);
});

test('conversión de unidades ppm <-> %', () => {
  assert.equal(toRuleUnit(gas('CO'), 250, 'ppm'), 0.025);
  assert.equal(toRuleUnit(gas('CO'), 0.5, '%'), 0.5);
  assert.equal(toRuleUnit(gas('HC'), 0.05, '%'), 500);
  assert.equal(toRuleUnit(gas('HC'), 500, 'ppm'), 500);
  assert.equal(toRuleUnit(gas('O2'), 5, undefined), 5);
});

test('sin lambda (ni calculable) no se activan las reglas que dependen de lambda', () => {
  const r = diagnose(DEFAULT_RULES, { CO: 0.2, CO2: 14.8, O2: 0.4 }, '');
  assert.deepEqual(ids(r), []);
});
