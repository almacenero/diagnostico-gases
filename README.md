# Diagnóstico de Gases

App web instalable (PWA) que traduce las lecturas de un analizador de gases
(CO, HC, CO₂, O₂, NOx, Lambda) y los códigos del reporte en un diagnóstico
detallado del vehículo: posibles causas, recomendación y severidad.

**App:** https://almacenero.github.io/diagnostico-gases/

## Cómo se instala

- **Android (Chrome):** abrir el enlace → botón **Instalar app** (o menú ⋮ → *Instalar aplicación*).
- **iPhone (Safari):** abrir el enlace → **Compartir** → **Agregar a inicio**.
- **PC (Chrome / Edge):** abrir el enlace → ícono de instalar en la barra de direcciones.

Después de abrirla una vez, funciona **sin internet**. Las reglas y el nombre del
taller se guardan en el dispositivo y se mantienen aunque se reinicie el equipo.

## Cómo se usa

1. Ingresar los datos del vehículo, las lecturas del analizador y/o los códigos del reporte.
2. Tocar **Diagnosticar**.
3. **Imprimir / PDF** o **Compartir** (WhatsApp, correo, etc.).

## Cálculo de lambda (λ)

Si el equipo no entrega lambda, se deja vacío y la app lo calcula con la
**ecuación de Brettschneider** a partir de CO, CO₂, O₂ y HC:

```
       [CO2] + [CO]/2 + [O2] + (Hcv/4 · 3.5/(3.5 + [CO]/[CO2]) − Ocv/2) · ([CO2] + [CO])
λ = ─────────────────────────────────────────────────────────────────────────────────
                   (1 + Hcv/4 − Ocv/2) · ([CO2] + [CO] + K1 · [HC])
```

- CO, CO₂ y O₂ en % vol; **HC en ppm**; K1 = 6×10⁻⁴ (500 ppm × K1 = 0,3 % de carbono).
- Hcv / Ocv según el combustible elegido: Gasolina 1,85 / 0 · E10 1,85 / 0,03 · GLP 2,52 / 0 · GNC 4,00 / 0.
- CO y HC se pueden ingresar en ppm o en %; la app convierte a la unidad de las reglas
  (CO en %, HC en ppm). El combustible y las unidades elegidas se recuerdan.
- Si se ingresa lambda a mano, se usa ese valor.

Ejemplo del Excel del cliente (CO₂ 7 %, O₂ 5 %, CO 250 ppm, HC 500 ppm, gasolina): **λ = 1,424**.
El Excel original daba 1,485 porque aplicaba K1 al HC en % en lugar de ppm.

## Reglas de diagnóstico (Excel)

El taller mantiene sus propias reglas en Excel, sin programar:

1. En la app: **Reglas y configuración → Descargar plantilla** (o usar
   [`plantilla/reglas_ejemplo.xlsx`](plantilla/reglas_ejemplo.xlsx)).
2. Editar la hoja **Reglas**. La hoja **Instrucciones** explica cada columna.
3. En la app: **Cargar reglas (Excel)**. Las reglas nuevas reemplazan a las anteriores.

Solo hay que volver a cargar el Excel cuando se cambian las reglas.

Una regla aplica cuando se cumplen **todas** sus condiciones llenas:

| Columna | Significado |
|---|---|
| `codigo` | Código(s) impresos por el analizador, separados por coma |
| `CO_min` … `Lambda_max` | Rango permitido de cada lectura (vacío = sin condición) |
| `diagnostico` | Obligatorio |
| `causas`, `recomendacion` | Detalle para el cliente |
| `severidad` | `Alta`, `Media` o `Baja` (orden de los resultados) |

Las 10 reglas incluidas son **referenciales** (gasolina, ralentí, motor caliente).
Las reglas `E01` y `E02` son códigos de ejemplo: hay que reemplazarlas por los
códigos reales que imprime el equipo.

## Desarrollo

Sitio estático sin paso de compilación (HTML + JS módulos + SheetJS local).

```bash
npm install
npm start              # http://localhost:5173
npm test               # pruebas del motor de reglas
npm run build:template # regenera plantilla/reglas_ejemplo.xlsx desde js/rules.js
```

- `js/rules.js` — reglas por defecto y columnas del Excel
- `js/engine.js` — lectura del Excel y evaluación de reglas
- `js/app.js` — interfaz
- `sw.js` — funcionamiento sin conexión (si se agregan archivos, añadirlos a `ASSETS` y subir `CACHE`)

Cada `git push` a `main` publica la nueva versión en GitHub Pages; las apps
instaladas se actualizan solas la próxima vez que se abren con internet.
