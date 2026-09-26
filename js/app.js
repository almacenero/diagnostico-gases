import { DEFAULT_RULES, GASES } from './rules.js';
import { diagnose, readRulesFile, toNumber } from './engine.js';
import { buildWorkbook } from './template.js';

const VERSION = 'v1.0.0';
const STORE = { rules: 'dg.rules', meta: 'dg.rulesMeta', taller: 'dg.taller' };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- Almacenamiento local (persiste al reiniciar el celular) ----

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin espacio o modo privado */ }
}

let rules = load(STORE.rules, null) || DEFAULT_RULES;
let rulesMeta = load(STORE.meta, null) || { source: 'Reglas de ejemplo', date: null };

// ---- Formulario ----

function renderGasInputs() {
  $('#gases').innerHTML = GASES.map((g) => `
    <label><span>${g.label} ${g.unit ? `<span class="unit">(${g.unit})</span>` : ''}</span>
      <input name="${g.key}" inputmode="decimal" step="${g.step}" placeholder="—">
    </label>`).join('');
}

function readForm() {
  const fd = new FormData($('#form'));
  const values = {};
  for (const g of GASES) values[g.key] = toNumber(fd.get(g.key));
  return {
    values,
    codigos: String(fd.get('codigos') || ''),
    placa: String(fd.get('placa') || '').trim(),
    modelo: String(fd.get('modelo') || '').trim(),
    km: String(fd.get('km') || '').trim(),
  };
}

let lastReport = null;

function renderReport(input) {
  const { found, unknownCodes } = diagnose(rules, input.values, input.codigos);
  const fecha = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  const meta = [input.placa && `Placa ${input.placa}`, input.modelo, input.km && `${input.km} km`, fecha]
    .filter(Boolean).join(' · ');
  $('#report-meta').textContent = meta;

  const chips = GASES.filter((g) => input.values[g.key] != null)
    .map((g) => `<span class="chip">${g.label}: <strong>${input.values[g.key]}</strong> ${g.unit}</span>`);
  const codes = input.codigos.trim();
  if (codes) chips.push(`<span class="chip">Códigos: <strong>${esc(codes.toUpperCase())}</strong></span>`);
  $('#report-values').innerHTML = chips.join('');

  let html = found.map((r) => `
    <article class="result sev-${r.severidad}">
      <h3>${esc(r.diagnostico)}<span class="badge">${r.severidad}</span></h3>
      ${r.causas ? `<p><strong>Posibles causas:</strong> ${esc(r.causas)}</p>` : ''}
      ${r.recomendacion ? `<p><strong>Recomendación:</strong> ${esc(r.recomendacion)}</p>` : ''}
    </article>`).join('');
  if (!found.length) {
    html = `<p class="notice">Ninguna regla coincide con estas lecturas. Revise los valores ingresados
      o agregue una regla para este caso en el Excel.</p>`;
  }
  if (unknownCodes.length) {
    html += `<p class="notice notice-warn">Códigos sin regla definida: <strong>${esc(unknownCodes.join(', '))}</strong></p>`;
  }
  $('#results').innerHTML = html;
  $('#report').hidden = false;
  $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  lastReport = { meta, input, found, unknownCodes };
}

function reportAsText() {
  const { meta, input, found, unknownCodes } = lastReport;
  const taller = load(STORE.taller, '');
  const lines = [`*Diagnóstico de gases*${taller ? ` — ${taller}` : ''}`, meta, ''];
  const vals = GASES.filter((g) => input.values[g.key] != null)
    .map((g) => `${g.key}: ${input.values[g.key]} ${g.unit}`.trim());
  if (vals.length) lines.push(vals.join(' | '), '');
  for (const r of found) {
    lines.push(`• ${r.diagnostico} (${r.severidad})`);
    if (r.causas) lines.push(`  Causas: ${r.causas}`);
    if (r.recomendacion) lines.push(`  Recomendación: ${r.recomendacion}`);
  }
  if (!found.length) lines.push('Sin coincidencias en las reglas.');
  if (unknownCodes.length) lines.push(`Códigos sin regla: ${unknownCodes.join(', ')}`);
  return lines.join('\n');
}

async function share() {
  const text = reportAsText();
  if (navigator.share) {
    try { await navigator.share({ title: 'Diagnóstico de gases', text }); } catch { /* cancelado */ }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// ---- Reglas ----

function describeRule(r) {
  const conds = [];
  if (r.codigo) conds.push(`código ${r.codigo}`);
  for (const g of GASES) {
    const min = r[`${g.key}_min`];
    const max = r[`${g.key}_max`];
    if (min != null && max != null) conds.push(`${min} ≤ ${g.key} ≤ ${max}`);
    else if (min != null) conds.push(`${g.key} ≥ ${min}`);
    else if (max != null) conds.push(`${g.key} ≤ ${max}`);
  }
  return conds.join(', ');
}

function renderRules() {
  const date = rulesMeta.date ? ` · cargadas el ${new Date(rulesMeta.date).toLocaleDateString('es-EC')}` : '';
  $('#rules-status').textContent = `${rules.length} reglas activas — ${rulesMeta.source}${date}`;
  $('#rules-list').innerHTML = rules.map((r) => `
    <div class="rule"><strong>${esc(r.id)} · ${esc(r.diagnostico)}</strong>
      <span class="badge sev-${r.severidad}">${r.severidad}</span><br>
      <span class="cond">${esc(describeRule(r))}</span></div>`).join('');
}

function showErrors(errors) {
  const box = $('#rules-errors');
  box.hidden = !errors.length;
  box.innerHTML = errors.length
    ? `Se omitieron ${errors.length} filas:<ul>${errors.slice(0, 20).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    : '';
}

async function onRulesFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const result = await readRulesFile(file);
    if (!result.rules.length) {
      showErrors(result.errors.length ? result.errors : ['El archivo no contiene reglas válidas.']);
      return;
    }
    rules = result.rules;
    rulesMeta = { source: file.name, date: Date.now() };
    save(STORE.rules, rules);
    save(STORE.meta, rulesMeta);
    showErrors(result.errors);
    renderRules();
    alert(`Se cargaron ${rules.length} reglas de "${file.name}".`);
  } catch (err) {
    showErrors([`No se pudo leer el archivo: ${err.message}`]);
  }
}

function downloadTemplate() {
  XLSX.writeFile(buildWorkbook(XLSX, rules), 'reglas_diagnostico_gases.xlsx');
}

function resetRules() {
  if (!confirm('¿Reemplazar las reglas actuales por las reglas de ejemplo?')) return;
  rules = DEFAULT_RULES;
  rulesMeta = { source: 'Reglas de ejemplo', date: null };
  localStorage.removeItem(STORE.rules);
  localStorage.removeItem(STORE.meta);
  showErrors([]);
  renderRules();
}

function renderTaller() {
  const taller = load(STORE.taller, '');
  $('#taller-label').textContent = taller;
  $('#taller-input').value = taller;
}

// ---- Instalación ----

function setupInstall() {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    $('#install-btn').hidden = false;
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    $('#install-btn').hidden = true;
  });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#ios-hint').hidden = !(ios && !standalone);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ---- Inicio ----

renderGasInputs();
renderRules();
renderTaller();
setupInstall();
$('#version').textContent = VERSION;

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = readForm();
  if (Object.values(input.values).every((v) => v == null) && !input.codigos.trim()) {
    alert('Ingrese al menos una lectura o un código.');
    return;
  }
  renderReport(input);
});
$('#form').addEventListener('reset', () => { $('#report').hidden = true; lastReport = null; });
$('#print-btn').addEventListener('click', () => window.print());
$('#share-btn').addEventListener('click', share);
$('#rules-file').addEventListener('change', onRulesFile);
$('#download-btn').addEventListener('click', downloadTemplate);
$('#reset-rules-btn').addEventListener('click', resetRules);
$('#taller-input').addEventListener('change', (e) => {
  save(STORE.taller, e.target.value.trim());
  renderTaller();
});
