# Reglas base de diagnóstico

Estas son las reglas que trae la app de fábrica (`js/rules.js`, y la plantilla
`plantilla/reglas_ejemplo.xlsx`). Se basan en literatura técnica de análisis de
gases de escape, no en datos de un equipo en particular. El taller puede
ajustarlas o ampliarlas cargando su propio Excel.

## Alcance

- **Motores a gasolina**, prueba estática en **ralentí** (máx. 1200 rpm, NTE INEN 2203)
  con el motor a **temperatura de operación**.
- Valores en % de volumen (CO, CO₂, O₂) y ppm (HC, NOx). Lambda se calcula con la
  ecuación de Brettschneider si el equipo no la entrega (ver el README).
- Los rangos de "motor sano" son los de un vehículo con catalizador de 3 vías.
  En vehículos antiguos sin catalizador, CO y HC más altos pueden ser normales:
  la regla de catalizador lo menciona en sus causas.
- Para GLP y GNC el cálculo de lambda sí se ajusta al combustible, pero los
  umbrales de CO y HC son los de gasolina.

## Equipo del cliente

El equipo que vende el cliente es un detector portátil con bomba de succión
("Pump-suction Four-in-One Gas Detector", marca HIREP según los videos de
demostración) configurado con estos rangos:

| Gas | Rango |
|---|---|
| CO | 0 – 10 000 ppm (0 – 1 %) |
| CO₂ | 0 – 20 % vol |
| HC | 0 – 1000 ppm |
| O₂ | 0 – 21 % vol |

No mide NOx, por lo que la regla R13 no aplica con este equipo. Por eso la app
trae el CO en ppm por defecto.

**Consecuencias para el diagnóstico:**

- Una mezcla rica suele producir entre 1 y 10 % de CO, y este equipo **se satura
  en 1 %**. Con la lectura en 10 000 ppm, la regla R16 avisa que el CO real puede
  ser mayor y que la mezcla probablemente es rica. En ese caso el lambda
  calculado sale más cercano a 1 de lo real, y la regla de catalizador no se
  aplica.
- El HC se satura en 1000 ppm. Con la lectura en el tope, la regla R17 avisa que
  el valor real puede ser mayor, lo que es típico de una falla de encendido.
- Para la norma INEN 2204, el rango alcanza a verificar los límites de vehículos
  2000 y posteriores (CO 1 %, HC 200 ppm), pero no los de vehículos más antiguos
  (CO hasta 6,5 %, HC hasta 1200 ppm).
- Antes de medir, el fabricante indica esperar unos 100 segundos de
  calentamiento y hacer la calibración de cero **en aire limpio**, lejos de
  autos encendidos.

## Valores de referencia

**Motor y catalizador en buen estado, ralentí** (Walker Exhaust, *Five Gas Diagnostic Chart*):

| Gas | Rango |
|---|---|
| CO₂ | 14,5 – 16 % |
| O₂ | 0 – 0,35 % |
| CO | 0,1 – 0,45 % |
| HC | 0 – 35 ppm |
| Lambda | 0,995 – 1,005 |

El catalizador solo funciona con λ entre 0,98 y 1,02. Un catalizador que no
convierte deja CO de 0,5 a 0,9 % y HC de 75 a 125 ppm, con lambda normal
(misma fuente).

**Reglas de interpretación** (Smog Tech Institute, *Understanding 5 Gas Diagnosis*):

- CO₂ es el indicador de eficiencia de la combustión. Lo óptimo es de 12 a 15 %,
  y bajo 12 % indica combustión deficiente.
- HC alto con CO₂ normal (sobre 12 %) indica un problema del catalizador. HC alto
  con CO₂ bajo indica un problema de combustión.
- CO alto indica mezcla rica y debe ir con O₂ bajo. **CO y O₂ altos a la vez**
  solo ocurren con fallas de encendido, fugas de escape o inyección de aire:
  la sonda de O₂ ve aire de más y la computadora enriquece.
- O₂ indica mezcla pobre. En el escape debería estar bajo 1 %.
- El HC más alto lo produce una falla de encendido (sale combustible crudo). Una
  falla por mezcla pobre sube el HC menos que una falla de encendido.

**Tabla de referencia rápida** (misma fuente), con la dirección en que se mueve
cada gas en cada falla:

| Falla | HC | CO | CO₂ | O₂ | NOx |
|---|---|---|---|---|---|
| Falla de encendido | ↑↑ | ↓ | ↓ | ↑–↑↑ | ↓–↓↓ |
| Pérdida de compresión | ↑–↑↑ | ↓ | ↓ | ↑ | ↓–↓↓ |
| Mezcla rica | ↑–↑↑ | ↑↑ | ↓ | ↓ | ↓–↓↓ |
| Mezcla pobre | ↑ | ↓↓ | ↓ | ↑ | ↑–↑↑ |
| Mezcla muy pobre | ↑↑ | ↓↓ | ↓ | ↑↑ | ↓–↓↓ |
| Avance de encendido excesivo | ↑ | = o ↓ | = | = | ↑↑ |
| EGR con fuga (abierta en ralentí) | ↑ | = | = o ↓ | = | ↓ o = |
| Catalizador que no funciona | ↑–↑↑ | ↑–↑↑ | ↓ | ↑ | ↑ |
| Fuga en el escape | ↓ | ↓ | ↓ | ↑ | = |
| Motor desgastado | ↑ | ↑ | ↓ | ↓ | = o ↓ |

## Reglas

Una regla aplica cuando se cumplen **todas** sus condiciones. Si una regla usa
un gas que no se midió, no aplica. Las filas con el mismo diagnóstico (R02/R02B/R03,
R06/R06B, R07/R07B) son alternativas: si se cumple cualquiera, el diagnóstico se
muestra una sola vez. Los resultados se ordenan por severidad.

| Id | Diagnóstico | Severidad | Condiciones |
|---|---|---|---|
| R01 | Combustión correcta | Baja | CO ≤ 0,5 · HC ≤ 100 · CO₂ ≥ 12,5 · 0,97 ≤ λ ≤ 1,03 |
| R02 | Catalizador con baja eficiencia | Media | 0,5 ≤ CO ≤ 0,9999 · HC ≤ 400 · CO₂ ≥ 12 · 0,97 ≤ λ ≤ 1,03 |
| R02B | Catalizador con baja eficiencia | Media | 1,0001 ≤ CO ≤ 3 · HC ≤ 400 · CO₂ ≥ 12 · 0,97 ≤ λ ≤ 1,03 |
| R03 | Catalizador con baja eficiencia | Media | CO ≤ 0,5 · 100 ≤ HC ≤ 400 · CO₂ ≥ 12 · 0,97 ≤ λ ≤ 1,03 |
| R04 | Mezcla rica | Media | 1 ≤ CO ≤ 3 · λ ≤ 0,97 |
| R05 | Mezcla muy rica | Alta | CO ≥ 3 · λ ≤ 0,97 |
| R06 | Mezcla pobre | Media | CO ≤ 1 · HC ≤ 300 · O₂ ≥ 2 |
| R06B | Mezcla pobre | Media | CO ≤ 1 · HC ≤ 300 · λ ≥ 1,05 |
| R07 | Falla de encendido (cilindro que no quema) | Alta | CO ≥ 0,5 · HC ≥ 300 · O₂ ≥ 2 |
| R07B | Falla de encendido (cilindro que no quema) | Alta | CO ≥ 1,5 · HC ≥ 300 · O₂ ≥ 1 |
| R08 | Falla por mezcla muy pobre | Alta | CO ≤ 0,5 · HC ≥ 300 · O₂ ≥ 2 |
| R09 | HC alto sin problema de mezcla: compresión, aceite o puesta a punto | Media | CO ≤ 1,5 · HC ≥ 300 · O₂ ≤ 2 |
| R10 | CO y O₂ altos a la vez | Media | CO ≥ 1 · HC ≤ 300 · O₂ ≥ 2 |
| R11 | Muestra diluida: prueba no válida | Alta | HC ≤ 300 · CO₂ ≤ 10 · O₂ ≥ 4 |
| R12 | Combustión ineficiente (CO₂ bajo) | Media | CO₂ ≤ 12,5 · 0,97 ≤ λ ≤ 1,03 |
| R13 | NOx elevado (temperatura de combustión alta) | Media | NOx ≥ 1000 |
| R14 | Mezcla ligeramente pobre | Baja | CO ≤ 1 · HC ≤ 300 · 1,03 ≤ λ ≤ 1,05 |
| R15 | Mezcla ligeramente rica | Baja | CO ≤ 1 · O₂ ≤ 1,5 · 0,95 ≤ λ ≤ 0,97 |
| R16 | CO en el máximo del equipo (10 000 ppm) | Alta | CO = 1 |
| R17 | HC en el máximo del equipo (1000 ppm) | Alta | HC = 1000 |

Las causas y recomendaciones de cada regla están en `js/rules.js` y en la
plantilla Excel.

### Cómo se separan los casos que se parecen

Con O₂ alto (≥ 2 %), las reglas dividen los casos sin superponerse:

```
                    HC < 300                     HC ≥ 300
 CO < 0,5     R06 Mezcla pobre           R08 Falla por mezcla muy pobre
 CO 0,5 – 1   R06 Mezcla pobre           R07 Falla de encendido
 CO ≥ 1       R10 CO y O₂ altos          R07 Falla de encendido
```

Con O₂ bajo, lambda decide: bajo 0,97 es rica (R04, R05 o R15), entre 0,97 y
1,03 se evalúa la eficiencia (R01, R02/R03, R09 o R12), y sobre 1,03 es pobre
(R14 o R06B).

## Validación

`tests/engine.test.js` incluye 18 casos: 14 típicos, uno por cada falla, y 4 dentro del rango del equipo del cliente (topes de CO y HC, y los bordes entre reglas). Comprueba
que cada uno produce exactamente el diagnóstico esperado. Uno de ellos es el
ejemplo del Excel del cliente (CO₂ 7 %, O₂ 5 %, CO 250 ppm, HC 500 ppm):
λ = 1,424, que da **Falla por mezcla muy pobre**.

También se generaron 20 000 combinaciones al azar de CO (0–6 %), HC (0–1500 ppm),
CO₂ (6–15,5 %) y O₂ (0–8 %), y el 99,7 % recibe al menos un diagnóstico. Las que
quedan sin diagnóstico son combinaciones físicamente improbables, como CO 3 %
con HC 5 ppm. En ese caso la app avisa que ninguna regla coincide.

Dentro del rango del equipo del cliente (CO 0–10 000 ppm, HC 0–1000 ppm), un barrido
de 20 000 combinaciones da diagnóstico al 99,96 %.

## Limitaciones

- Son reglas **orientativas**. Un análisis de gases indica la zona del
  problema, pero la causa exacta se confirma con escáner, pruebas de presión,
  de compresión, etc. La app lo indica en cada reporte.
- No evalúa la prueba a 2500 rpm por separado. Si el equipo entrega ambas
  mediciones, se ingresa la de ralentí.
- Los umbrales de NOx (1000 ppm) aplican solo si el equipo mide NOx. Muchos
  analizadores de 4 gases no lo miden.
- **Cumplimiento legal (NTE INEN 2204):** estas reglas diagnostican fallas; no
  dicen si el vehículo aprueba la revisión técnica. Los límites oficiales en
  prueba estática dependen del año del vehículo y de la altitud:

  | Año modelo | CO % (0–1500 m) | CO % (1500–3000 m) | HC ppm (0–1500 m) | HC ppm (1500–3000 m) |
  |---|---|---|---|---|
  | 2000 y posteriores | 1,0 | 1,0 | 200 | 200 |
  | 1990 a 1999 | 3,5 | 4,5 | 650 | 750 |
  | 1989 y anteriores | 5,5 | 6,5 | 1000 | 1200 |

## Fuentes

- Walker Exhaust Systems, *Five Gas Diagnostic Chart*:
  https://www.walkerexhaust.com/support/tech-tips/five-gas-diagnostic-chart.html
- Smog Tech Institute, *Understanding 5 Gas Diagnosis*:
  https://911sg.com/wp-content/uploads/2023/06/understanding5gas_frpm-smog-tech-institute.pdf
- NTE INEN 2204, *Límites permitidos de emisiones producidas por fuentes móviles
  terrestres de gasolina*, tabla reproducida en: "Evaluación de emisiones de
  gases en vehículos a gasolina…", Ciencia Latina, pág. 1842:
  https://ciencialatina.org/index.php/cienciala/article/download/13656/19602/
- Ecuación de Brettschneider y constantes por combustible: documento del
  cliente (Excel "SOFTWARE GASES", 2026-09-28), con la corrección de K1
  aplicado al HC en ppm (ver README).
