// Genera plantilla/reglas_ejemplo.xlsx a partir de las reglas por defecto.
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { DEFAULT_RULES } from '../js/rules.js';
import { buildWorkbook } from '../js/template.js';

XLSX.set_fs(fs);
const out = new URL('../plantilla/reglas_ejemplo.xlsx', import.meta.url).pathname;
XLSX.writeFile(buildWorkbook(XLSX, DEFAULT_RULES), out);
console.log('Plantilla generada:', out);
