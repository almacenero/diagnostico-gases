// Parámetros medidos por el analizador. `key` es el prefijo de las columnas
// <key>_min / <key>_max en el Excel de reglas, siempre en la unidad `unit`.
// `alt` es una unidad alternativa en la que se puede ingresar el valor.
export const GASES = [
  { key: 'CO', label: 'CO', unit: '%', alt: 'ppm' },
  { key: 'HC', label: 'HC', unit: 'ppm', alt: '%' },
  { key: 'CO2', label: 'CO₂', unit: '%' },
  { key: 'O2', label: 'O₂', unit: '%' },
  { key: 'NOx', label: 'NOx', unit: 'ppm' },
  { key: 'Lambda', label: 'Lambda (λ)', unit: '' },
];

// Constantes de la ecuación de Brettschneider por combustible.
// Hcv: relación hidrógeno/carbono. Ocv: relación oxígeno/carbono.
export const COMBUSTIBLES = [
  { key: 'gasolina', label: 'Gasolina', Hcv: 1.85, Ocv: 0 },
  { key: 'e10', label: 'Gasolina con etanol (E10)', Hcv: 1.85, Ocv: 0.03 },
  { key: 'glp', label: 'GLP', Hcv: 2.52, Ocv: 0 },
  { key: 'gnc', label: 'GNC (gas natural)', Hcv: 4.0, Ocv: 0 },
];

export const SEVERIDADES = ['Alta', 'Media', 'Baja'];

// Orden de columnas de la hoja "Reglas" de la plantilla Excel.
export const COLUMNAS = [
  'id',
  'codigo',
  ...GASES.flatMap((g) => [`${g.key}_min`, `${g.key}_max`]),
  'diagnostico',
  'causas',
  'recomendacion',
  'severidad',
];

// Reglas de ejemplo para motores a gasolina, medición en ralentí con motor
// caliente. Son referenciales: el cliente las reemplaza por las suyas en Excel.
export const DEFAULT_RULES = [
  {
    id: 'R01',
    CO_max: 0.5, HC_max: 100, CO2_min: 14, O2_max: 1, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Combustión correcta',
    causas: 'Valores dentro de los rangos normales para un motor a gasolina en buen estado.',
    recomendacion: 'No se requiere intervención. Mantener el plan de mantenimiento preventivo.',
    severidad: 'Baja',
  },
  {
    id: 'R02',
    CO_min: 1.5, O2_max: 1, Lambda_max: 0.97,
    diagnostico: 'Mezcla rica (exceso de combustible)',
    causas: 'Inyectores goteando; presión de combustible alta; sensor de oxígeno, MAP o temperatura defectuoso; filtro de aire obstruido.',
    recomendacion: 'Revisar presión de combustible y regulador, probar inyectores, verificar sensores con escáner y cambiar filtro de aire.',
    severidad: 'Alta',
  },
  {
    id: 'R03',
    CO_max: 0.5, O2_min: 2, Lambda_min: 1.05,
    diagnostico: 'Mezcla pobre (falta de combustible o exceso de aire)',
    causas: 'Entrada de aire falso (fuga de vacío); inyectores sucios; bomba de combustible débil; sensor MAF sucio.',
    recomendacion: 'Buscar fugas de vacío, limpiar inyectores y MAF, medir presión y caudal de la bomba de combustible.',
    severidad: 'Media',
  },
  {
    id: 'R04',
    HC_min: 500, O2_min: 2,
    diagnostico: 'Falla de encendido (cilindro que no quema)',
    causas: 'Bujías gastadas o sucias; cables de bujía o bobinas defectuosas; baja compresión en un cilindro.',
    recomendacion: 'Revisar bujías, cables y bobinas; hacer prueba de compresión si persiste.',
    severidad: 'Alta',
  },
  {
    id: 'R05',
    CO2_max: 10, O2_min: 4,
    diagnostico: 'Dilución de la muestra (fuga en el escape o sonda mal colocada)',
    causas: 'Fisura o empaque dañado en el sistema de escape; sonda del analizador insertada de forma insuficiente.',
    recomendacion: 'Verificar la inserción de la sonda (mínimo 30 cm) y revisar el escape en busca de fugas antes de repetir la prueba.',
    severidad: 'Media',
  },
  {
    id: 'R06',
    CO_min: 0.5, CO_max: 1.5, HC_min: 100, HC_max: 300, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Catalizador con baja eficiencia',
    causas: 'Mezcla correcta (lambda ≈ 1) pero CO y HC por encima de lo esperado: el catalizador no está convirtiendo los gases.',
    recomendacion: 'Medir temperatura de entrada y salida del catalizador; considerar su reemplazo.',
    severidad: 'Media',
  },
  {
    id: 'R07',
    NOx_min: 1000,
    diagnostico: 'NOx elevado (temperatura de combustión alta)',
    causas: 'Válvula EGR obstruida o inoperante; mezcla pobre; exceso de carbonilla; sistema de enfriamiento deficiente.',
    recomendacion: 'Revisar y limpiar la válvula EGR, descarbonizar el motor y verificar el sistema de enfriamiento.',
    severidad: 'Media',
  },
  {
    id: 'R08',
    CO_max: 1, HC_min: 300, O2_max: 2,
    diagnostico: 'Posible consumo de aceite',
    causas: 'HC alto sin exceso de combustible ni de oxígeno: anillos de pistón o guías de válvula desgastados; válvula PCV defectuosa.',
    recomendacion: 'Revisar la válvula PCV, hacer prueba de compresión seca y húmeda, y verificar el consumo de aceite.',
    severidad: 'Alta',
  },
  {
    id: 'R09',
    codigo: 'E01',
    diagnostico: 'Flujo de muestra bajo (código de ejemplo)',
    causas: 'Filtro de la sonda obstruido o manguera doblada.',
    recomendacion: 'Limpiar o cambiar el filtro de la sonda y repetir la medición. Reemplace este código por el que imprime su equipo.',
    severidad: 'Media',
  },
  {
    id: 'R10',
    codigo: 'E02',
    diagnostico: 'Motor sin temperatura de operación (código de ejemplo)',
    causas: 'La prueba se inició con el motor frío; los valores medidos no son representativos.',
    recomendacion: 'Calentar el motor hasta 80 °C y repetir la prueba. Reemplace este código por el que imprime su equipo.',
    severidad: 'Baja',
  },
];
