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

// Reglas base para motores a gasolina: prueba estática en ralentí (máx. 1200 rpm,
// NTE INEN 2203) con el motor a temperatura de operación. Fundamento y fuentes
// de cada regla en docs/REGLAS.md. El taller puede reemplazarlas o ampliarlas
// cargando su propio Excel. Varias filas con el mismo diagnóstico funcionan
// como alternativas ("o"): se muestra una sola vez.
export const DEFAULT_RULES = [
  {
    id: 'R01',
    CO_max: 0.5, HC_max: 100, CO2_min: 12.5, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Combustión correcta',
    causas: 'Mezcla estequiométrica (λ ≈ 1), CO₂ alto y CO, HC y O₂ bajos: el motor quema bien y el catalizador convierte los gases.',
    recomendacion: 'No se requiere intervención. Mantener el plan de mantenimiento preventivo.',
    severidad: 'Baja',
  },
  {
    id: 'R02',
    CO_min: 0.51, CO_max: 3, HC_max: 400, CO2_min: 12, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Catalizador con baja eficiencia',
    causas: 'La mezcla es correcta (λ ≈ 1) y la combustión eficiente (CO₂ normal), pero salen CO o HC por encima de lo esperado: el catalizador no está convirtiendo los gases (desgastado, contaminado por aceite o anticongelante, o no alcanza su temperatura). En vehículos sin catalizador estos valores pueden ser normales.',
    recomendacion: 'Verificar que el vehículo tenga catalizador y que el motor esté caliente. Medir la temperatura a la entrada y salida del catalizador (la salida debe estar más caliente). Si no convierte, reemplazarlo y corregir la causa (consumo de aceite, fallas de encendido).',
    severidad: 'Media',
  },
  {
    id: 'R03',
    CO_max: 0.5, HC_min: 101, HC_max: 400, CO2_min: 12, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Catalizador con baja eficiencia',
    causas: 'La mezcla es correcta (λ ≈ 1) y la combustión eficiente (CO₂ normal), pero salen CO o HC por encima de lo esperado: el catalizador no está convirtiendo los gases (desgastado, contaminado por aceite o anticongelante, o no alcanza su temperatura). En vehículos sin catalizador estos valores pueden ser normales.',
    recomendacion: 'Verificar que el vehículo tenga catalizador y que el motor esté caliente. Medir la temperatura a la entrada y salida del catalizador (la salida debe estar más caliente). Si no convierte, reemplazarlo y corregir la causa (consumo de aceite, fallas de encendido).',
    severidad: 'Media',
  },
  {
    id: 'R04',
    CO_min: 1, CO_max: 2.99, Lambda_max: 0.97,
    diagnostico: 'Mezcla rica',
    causas: 'Exceso de combustible: CO alto con O₂ bajo. Posibles causas: sensor de oxígeno sesgado o lento, sensor de temperatura del refrigerante indicando motor frío, presión de combustible alta (regulador), inyectores goteando, canister EVAP saturado, válvula PCV obstruida, filtro de aire sucio (motores con sensor MAP).',
    recomendacion: 'Revisar con escáner los ajustes de combustible (fuel trims) y los sensores de O₂, ECT y MAP/MAF. Medir la presión de combustible y probar el regulador e inyectores. Revisar PCV, canister y filtro de aire.',
    severidad: 'Media',
  },
  {
    id: 'R05',
    CO_min: 3, Lambda_max: 0.97,
    diagnostico: 'Mezcla muy rica',
    causas: 'Gran exceso de combustible (CO muy alto con O₂ bajo): inyector goteando o pegado abierto, regulador de presión dañado, sensor ECT o de O₂ defectuoso, combustible en el aceite del cárter. En carburados: flotador hundido o chiclé desgastado.',
    recomendacion: 'Corregir de inmediato: consume combustible en exceso y daña el catalizador. Medir presión de combustible, probar estanqueidad de inyectores, revisar sensores con escáner y oler el aceite por dilución con gasolina (cambiarlo si está contaminado).',
    severidad: 'Alta',
  },
  {
    id: 'R06',
    CO_max: 0.99, HC_max: 299, O2_min: 2,
    diagnostico: 'Mezcla pobre',
    causas: 'Falta de combustible o exceso de aire: O₂ alto con CO bajo. Posibles causas: entrada de aire falso (fuga de vacío, mangueras, empaque del múltiple de admisión), inyectores obstruidos, presión o caudal de combustible bajos, sensor MAF sucio.',
    recomendacion: 'Buscar fugas de vacío (prueba de humo o con limpiador de carburador y RPM), limpiar inyectores y sensor MAF, medir presión y caudal de la bomba de combustible y revisar el filtro de combustible.',
    severidad: 'Media',
  },
  {
    id: 'R06B',
    CO_max: 0.99, HC_max: 299, Lambda_min: 1.05,
    diagnostico: 'Mezcla pobre',
    causas: 'Falta de combustible o exceso de aire: O₂ alto con CO bajo. Posibles causas: entrada de aire falso (fuga de vacío, mangueras, empaque del múltiple de admisión), inyectores obstruidos, presión o caudal de combustible bajos, sensor MAF sucio.',
    recomendacion: 'Buscar fugas de vacío (prueba de humo o con limpiador de carburador y RPM), limpiar inyectores y sensor MAF, medir presión y caudal de la bomba de combustible y revisar el filtro de combustible.',
    severidad: 'Media',
  },
  {
    id: 'R07',
    CO_min: 0.5, HC_min: 300, O2_min: 2,
    diagnostico: 'Falla de encendido (cilindro que no quema)',
    causas: 'HC muy alto junto con O₂ y CO altos: un cilindro no quema la mezcla y sale combustible crudo; la computadora interpreta el oxígeno sobrante como mezcla pobre y enriquece. Posibles causas: bujías gastadas o sucias, cables o bobinas defectuosos, inyector de ese cilindro sin pulverizar.',
    recomendacion: 'Revisar con escáner los contadores de fallas por cilindro (misfire). Inspeccionar bujías, cables y bobinas; intercambiar bobinas entre cilindros para ubicar la falla. Si persiste, prueba de compresión.',
    severidad: 'Alta',
  },
  {
    id: 'R07B',
    CO_min: 1.51, HC_min: 300, O2_min: 1,
    diagnostico: 'Falla de encendido (cilindro que no quema)',
    causas: 'HC muy alto junto con O₂ y CO altos: un cilindro no quema la mezcla y sale combustible crudo; la computadora interpreta el oxígeno sobrante como mezcla pobre y enriquece. Posibles causas: bujías gastadas o sucias, cables o bobinas defectuosos, inyector de ese cilindro sin pulverizar.',
    recomendacion: 'Revisar con escáner los contadores de fallas por cilindro (misfire). Inspeccionar bujías, cables y bobinas; intercambiar bobinas entre cilindros para ubicar la falla. Si persiste, prueba de compresión.',
    severidad: 'Alta',
  },
  {
    id: 'R08',
    CO_max: 0.49, HC_min: 300, O2_min: 2,
    diagnostico: 'Falla por mezcla muy pobre',
    causas: 'HC alto con O₂ muy alto y CO muy bajo: la mezcla es tan pobre que la llama no la quema por completo (falla por mezcla pobre). Posibles causas: fuga de vacío grande, inyectores obstruidos, presión de combustible muy baja, sensor MAF defectuoso.',
    recomendacion: 'Buscar fugas de vacío grandes, medir presión y caudal de combustible, limpiar o probar inyectores y el sensor MAF. Verificar también que la sonda del analizador no tome aire (ver muestra diluida).',
    severidad: 'Alta',
  },
  {
    id: 'R09',
    CO_max: 1.5, HC_min: 300, O2_max: 1.99,
    diagnostico: 'HC alto sin problema de mezcla: compresión, aceite o puesta a punto',
    causas: 'Mezcla normal (ni CO ni O₂ altos) pero HC alto: el combustible no termina de quemarse por baja compresión (anillos, válvulas quemadas o mal asentadas), paso de aceite a la cámara (guías o sellos de válvula, anillos), válvula EGR abierta en ralentí o avance de encendido excesivo.',
    recomendacion: 'Hacer prueba de compresión seca y húmeda o de fugas de cilindro, revisar humo azul y consumo de aceite, verificar que la EGR cierre en ralentí y comprobar el avance de encendido.',
    severidad: 'Media',
  },
  {
    id: 'R10',
    CO_min: 1, HC_max: 299, O2_min: 2,
    diagnostico: 'CO y O₂ altos a la vez',
    causas: 'En una combustión normal no pueden estar ambos altos. Indica aire que entra al escape antes de la sonda de oxígeno (fuga en múltiple o tubo de escape), sistema de inyección de aire secundario activo, o mezcla desigual entre cilindros (un inyector goteando y otro obstruido).',
    recomendacion: 'Revisar fugas en el múltiple y el tubo de escape antes de la sonda de O₂, verificar el sistema de aire secundario si lo tiene, y hacer prueba de balance de inyectores.',
    severidad: 'Media',
  },
  {
    id: 'R11',
    CO2_max: 10, HC_max: 300, O2_min: 4,
    diagnostico: 'Muestra diluida: prueba no válida',
    causas: 'CO₂ muy bajo con O₂ alto y HC normal: el analizador está midiendo aire mezclado con los gases. Sonda insertada poco profundo, fuga en el sistema de escape, o manguera o filtro del analizador con fugas.',
    recomendacion: 'Insertar la sonda al menos 30 cm dentro del tubo de escape, revisar fugas del escape y de la manguera del analizador, y repetir la medición antes de interpretar los demás resultados.',
    severidad: 'Alta',
  },
  {
    id: 'R12',
    CO2_max: 12.49, Lambda_min: 0.97, Lambda_max: 1.03,
    diagnostico: 'Combustión ineficiente (CO₂ bajo)',
    causas: 'Mezcla correcta pero CO₂ bajo: la combustión no es completa. Posibles causas: puesta a punto incorrecta (avance), válvula EGR abierta en ralentí, baja compresión, o analizador descalibrado o con fugas en la sonda.',
    recomendacion: 'Verificar el avance de encendido y la EGR, hacer prueba de compresión y comprobar la calibración del analizador.',
    severidad: 'Media',
  },
  {
    id: 'R13',
    NOx_min: 1000,
    diagnostico: 'NOx elevado (temperatura de combustión alta)',
    causas: 'Temperatura o presión de combustión excesivas: válvula EGR obstruida o inoperante, mezcla pobre, avance de encendido excesivo, carbonilla en pistones o válvulas, sistema de enfriamiento deficiente, combustible de bajo octanaje o sensor de detonación inoperante.',
    recomendacion: 'Revisar y limpiar la válvula EGR y sus conductos, verificar el avance de encendido y el sensor de detonación, descarbonizar el motor y revisar el sistema de enfriamiento.',
    severidad: 'Media',
  },
  {
    id: 'R14',
    CO_max: 1, HC_max: 300, Lambda_min: 1.031, Lambda_max: 1.049,
    diagnostico: 'Mezcla ligeramente pobre',
    causas: 'Lambda algo por encima de 1. Puede ser la oscilación normal del control de mezcla en el momento de la medición, o una pequeña entrada de aire falso, inyectores algo sucios o un sensor de oxígeno lento.',
    recomendacion: 'Repetir la medición con el motor estabilizado. Si se mantiene, revisar con escáner los ajustes de combustible (fuel trims) y buscar pequeñas fugas de vacío.',
    severidad: 'Baja',
  },
  {
    id: 'R15',
    CO_max: 0.99, O2_max: 1.5, Lambda_min: 0.95, Lambda_max: 0.969,
    diagnostico: 'Mezcla ligeramente rica',
    causas: 'Lambda algo por debajo de 1. Puede ser la oscilación normal del control de mezcla, o un leve exceso de combustible: sensor de oxígeno lento, filtro de aire sucio o canister EVAP purgando.',
    recomendacion: 'Repetir la medición con el motor estabilizado. Si se mantiene, revisar con escáner los ajustes de combustible, el sensor de oxígeno y el filtro de aire.',
    severidad: 'Baja',
  },
];
