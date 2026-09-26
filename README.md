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
