import { COMBUSTIBLES, DEFAULT_RULES, GASES } from './rules.js';
import { calcLambda, diagnose, readRulesFile, toNumber, toRuleUnit } from './engine.js';
import { activate, checkLicense } from './license.js';
import { buildWorkbook } from './template.js';

const VERSION = 'v1.2.0';
const STORE = { rules: 'dg.rules', meta: 'dg.rulesMeta', taller: 'dg.taller', prefs: 'dg.prefs' };

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
let rulesMeta = load(STORE.meta, null) || { source: 'Reglas base', date: null };

// ---- Formulario ----

function renderGasInputs() {
  $('#combustible').innerHTML = COMBUSTIBLES.map((c) => `<option value="${c.key}">${c.label}</option>`).join('');
  $('#gases').innerHTML = GASES.map((g) => {
    const unit = g.alt
      ? `<select name="${g.key}_unit" aria-label="Unidad de ${g.label}">
          <option>${g.unit}</option><option>${g.alt}</option></select>`
      : g.unit && `<span class="unit">(${g.unit})</span>`;
    return `
    <div class="field">
      <div class="field-head"><label for="g-${g.key}">${g.label}</label> ${unit || ''}</div>
      <input id="g-${g.key}" name="${g.key}" inputmode="decimal" placeholder="—">
    </div>`;
  }).join('');
}

// Combustible y unidades elegidas se recuerdan entre usos.
const PREF_FIELDS = ['combustible', ...GASES.filter((g) => g.alt).map((g) => `${g.key}_unit`)];

function applyPrefs() {
  const prefs = load(STORE.prefs, {});
  for (const name of PREF_FIELDS) {
    const el = $('#form').elements[name];
    if (prefs[name] && [...el.options].some((o) => o.value === prefs[name])) el.value = prefs[name];
  }
}

function savePrefs() {
  const els = $('#form').elements;
  save(STORE.prefs, Object.fromEntries(PREF_FIELDS.map((n) => [n, els[n].value])));
}

function readForm() {
  const fd = new FormData($('#form'));
  const values = {};
  for (const g of GASES) values[g.key] = toRuleUnit(g, toNumber(fd.get(g.key)), fd.get(`${g.key}_unit`));
  const combustible = COMBUSTIBLES.find((c) => c.key === fd.get('combustible')) || COMBUSTIBLES[0];
  // Si el equipo no entrega lambda, se calcula con la ecuación de Brettschneider.
  let lambdaCalculado = false;
  if (values.Lambda == null) {
    const lambda = calcLambda(values, combustible);
    if (lambda != null) {
      values.Lambda = Math.round(lambda * 1000) / 1000;
      lambdaCalculado = true;
    }
  }
  return {
    values,
    combustible,
    lambdaCalculado,
    codigos: String(fd.get('codigos') || ''),
    placa: String(fd.get('placa') || '').trim(),
    modelo: String(fd.get('modelo') || '').trim(),
    km: String(fd.get('km') || '').trim(),
  };
}

let lastReport = null;

function previewLambda() {
  const el = $('#form').elements.Lambda;
  const { values, lambdaCalculado } = readForm();
  el.placeholder = lambdaCalculado ? `${values.Lambda} (calculado)` : 'Se calcula solo';
}

function renderReport(input) {
  const { found, unknownCodes } = diagnose(rules, input.values, input.codigos);
  const fecha = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' });
  const meta = [input.placa && `Placa ${input.placa}`, input.modelo, input.km && `${input.km} km`,
    input.combustible.label, fecha]
    .filter(Boolean).join(' · ');
  $('#report-meta').textContent = meta;

  const chips = GASES.filter((g) => input.values[g.key] != null)
    .map((g) => `<span class="chip">${g.label}: <strong>${input.values[g.key]}</strong> ${g.unit}${
      g.key === 'Lambda' && input.lambdaCalculado ? ' (calculado)' : ''}</span>`);
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
  const report = $('#report');
  report.hidden = false;
  report.classList.remove('stale', 'flash');
  $('#report-stale').hidden = true;
  void report.offsetWidth; // reinicia la animación aunque el resultado sea igual al anterior
  report.classList.add('flash');
  report.scrollIntoView({ behavior: 'smooth', block: 'start' });
  lastReport = { meta, input, found, unknownCodes };
}

function reportAsText() {
  const { meta, input, found, unknownCodes } = lastReport;
  const taller = load(STORE.taller, '');
  const lines = [`*Diagnóstico de gases*${taller ? ` — ${taller}` : ''}`, meta, ''];
  const vals = GASES.filter((g) => input.values[g.key] != null)
    .map((g) => `${g.key}: ${input.values[g.key]} ${g.unit}${
      g.key === 'Lambda' && input.lambdaCalculado ? ' (calculado)' : ''}`.trim());
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

function showErrors(title, errors = []) {
  const box = $('#rules-errors');
  box.hidden = !title;
  box.innerHTML = title
    ? `${esc(title)}<ul>${errors.slice(0, 20).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    : '';
}

async function onRulesFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const result = await readRulesFile(file);
    if (!result.rules.length) {
      showErrors(`No se cargó ninguna regla de "${file.name}".`, result.errors);
      return;
    }
    rules = result.rules;
    rulesMeta = { source: file.name, date: Date.now() };
    save(STORE.rules, rules);
    save(STORE.meta, rulesMeta);
    showErrors(result.errors.length ? `Se omitieron ${result.errors.length} filas:` : '', result.errors);
    renderRules();
    alert(`Se cargaron ${rules.length} reglas de "${file.name}".`);
  } catch (err) {
    showErrors(`No se pudo cargar "${file.name}".`, [err.message]);
  }
}

function downloadTemplate() {
  XLSX.writeFile(buildWorkbook(XLSX, rules), 'reglas_diagnostico_gases.xlsx');
}

function resetRules() {
  if (!confirm('¿Reemplazar las reglas actuales por las reglas base?')) return;
  rules = DEFAULT_RULES;
  rulesMeta = { source: 'Reglas base', date: null };
  localStorage.removeItem(STORE.rules);
  localStorage.removeItem(STORE.meta);
  showErrors('');
  renderRules();
}

function renderTaller() {
  const taller = load(STORE.taller, '');
  $('#taller-label').textContent = taller;
  $('#taller-input').value = taller;
}

// ---- Licencia ----

const fmtDate = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('es-EC', { dateStyle: 'long' });

const LOCK_TEXT = {
  'sin-licencia': ['Licencia requerida',
    () => 'Esta aplicación necesita un código de licencia. Solicítelo a su proveedor.'],
  vencida: ['Demostración finalizada',
    (l) => `La licencia venció el ${fmtDate(l.exp)}. Contacte a su proveedor para seguir usando la aplicación.`],
  revocada: ['Licencia suspendida',
    () => 'Esta licencia fue suspendida. Contacte a su proveedor.'],
  'sin-conexion': ['Validación pendiente',
    (l) => `Conéctese a internet para validar la licencia (se requiere al menos cada ${l.g} días) y toque "Reintentar".`],
};

function showLockError(msg) {
  $('#lock-error').hidden = !msg;
  $('#lock-error').textContent = msg || '';
}

function applyLicense(result) {
  $('#lock').hidden = result.ok;
  $('#app-content').hidden = !result.ok;
  const banner = $('#lic-banner');
  banner.hidden = true;
  if (!result.ok) {
    const [title, msg] = LOCK_TEXT[result.reason];
    $('#lock-title').textContent = title;
    $('#lock-msg').textContent = msg(result.lic);
    return;
  }
  const { lic, daysLeft } = result;
  if (lic.t === 'demo' || (daysLeft != null && daysLeft <= 7)) {
    const tipo = lic.t === 'demo' ? 'Versión de demostración' : 'Licencia';
    const dias = daysLeft === 1 ? '1 día' : `${daysLeft} días`;
    banner.textContent = lic.exp
      ? `${tipo} para ${lic.c} · vence el ${fmtDate(lic.exp)} (quedan ${dias})`
      : `${tipo} para ${lic.c}`;
    banner.hidden = false;
  }
}

let lastLicenseCheck = 0;
async function refreshLicense() {
  lastLicenseCheck = Date.now();
  applyLicense(await checkLicense());
}

// Enlace de activación: ...#lic=<código>. Devuelve true si traía un código.
async function consumeLicenseLink() {
  const m = location.hash.match(/lic=([\w.-]+)/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  showLockError((await activate(m[1])) ? '' : 'El enlace de activación no es válido.');
  return true;
}

async function startLicense() {
  await consumeLicenseLink();
  await refreshLicense();
  window.addEventListener('hashchange', async () => {
    if (await consumeLicenseLink()) await refreshLicense();
  });
  $('#lock-activate').addEventListener('click', async () => {
    if (!(await activate($('#lock-code').value))) {
      showLockError('Código no válido. Revise que lo haya copiado completo.');
      return;
    }
    showLockError('');
    $('#lock-code').value = '';
    await refreshLicense();
  });
  $('#lock-retry').addEventListener('click', refreshLicense);
  window.addEventListener('online', refreshLicense);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLicenseCheck > 10 * 60000) refreshLicense();
  });
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
applyPrefs();
previewLambda();
renderRules();
renderTaller();
setupInstall();
startLicense();
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
$('#form').addEventListener('reset', () => {
  $('#report').hidden = true;
  lastReport = null;
  setTimeout(() => { applyPrefs(); previewLambda(); });
});
// Si se editan los datos después de diagnosticar, el resultado queda desactualizado.
function markReportStale() {
  if ($('#report').hidden) return;
  $('#report').classList.add('stale');
  $('#report-stale').hidden = false;
}
$('#form').addEventListener('input', () => { previewLambda(); markReportStale(); });
$('#form').addEventListener('change', (e) => {
  if (PREF_FIELDS.includes(e.target.name)) savePrefs();
  previewLambda();
  markReportStale();
});
$('#print-btn').addEventListener('click', () => window.print());
$('#share-btn').addEventListener('click', share);
$('#rules-file').addEventListener('change', onRulesFile);
$('#download-btn').addEventListener('click', downloadTemplate);
$('#reset-rules-btn').addEventListener('click', resetRules);
$('#taller-input').addEventListener('change', (e) => {
  save(STORE.taller, e.target.value.trim());
  renderTaller();
});
