import { COLUMNAS, GASES } from './rules.js';

const INSTRUCCIONES = [
  ['Cómo llenar la hoja "Reglas"'],
  [''],
  ['1. Cada fila es una regla de diagnóstico. No cambie los nombres de las columnas de la fila 1.'],
  ['2. Una regla aplica cuando se cumplen TODAS las condiciones que tenga llenas. Las celdas vacías se ignoran.'],
  ['   Varias filas con el mismo diagnóstico funcionan como alternativas ("o"): si se cumple cualquiera, se muestra una vez.'],
  ['3. Columnas <gas>_min y <gas>_max: rango del valor medido (inclusive). Puede llenar solo el mínimo, solo el máximo o ambos.'],
  ['4. Columna "codigo": código que imprime el analizador (ej. E01). Varios códigos separados por coma.'],
  ['   Si una regla tiene código y rangos, deben cumplirse ambos.'],
  ['5. "diagnostico" es obligatorio. "causas" y "recomendacion" son el detalle que verá el cliente.'],
  ['6. "severidad": Alta, Media o Baja. Los resultados se ordenan de mayor a menor severidad.'],
  ['7. Use punto o coma como separador decimal.'],
  ['8. Guarde el archivo y cárguelo en la app con el botón "Cargar reglas (Excel)".'],
  ['9. Las reglas base asumen gasolina, prueba en ralentí (máx. 1200 rpm) y motor a temperatura de operación.'],
  ['   Lambda (λ) se calcula automáticamente si el equipo no lo entrega.'],
  [''],
  ['Unidades'],
  ...GASES.map((g) => [`${g.key}: ${g.unit || 'sin unidad'}`]),
];

// Libro con la hoja "Reglas" (llena con `rules`) y la hoja "Instrucciones".
export function buildWorkbook(XLSX, rules) {
  const rows = rules.map((r) => COLUMNAS.map((c) => r[c] ?? ''));
  const reglas = XLSX.utils.aoa_to_sheet([COLUMNAS, ...rows]);
  reglas['!cols'] = COLUMNAS.map((c) =>
    ({ wch: ['causas', 'recomendacion'].includes(c) ? 60 : c === 'diagnostico' ? 40 : 10 }));
  reglas['!freeze'] = { xSplit: 0, ySplit: 1 };
  const instr = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
  instr['!cols'] = [{ wch: 110 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, reglas, 'Reglas');
  XLSX.utils.book_append_sheet(wb, instr, 'Instrucciones');
  return wb;
}
