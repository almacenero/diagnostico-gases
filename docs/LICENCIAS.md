# Proceso de licencias

Guía operativa para entregar demos, activar clientes que pagaron y bloquear el
uso sin pago de la app **Diagnóstico de Gases**.

> Este documento no contiene claves ni códigos. Los datos de cada cliente
> (licencias emitidas, códigos) viven solo en la carpeta local `.licencias/`,
> que no se sube a git.

## Índice

1. [Cómo funciona](#1-cómo-funciona)
2. [Archivos involucrados](#2-archivos-involucrados)
3. [Configuración inicial (una sola vez)](#3-configuración-inicial-una-sola-vez)
4. [Procesos del día a día](#4-procesos-del-día-a-día)
5. [Qué ve el cliente](#5-qué-ve-el-cliente)
6. [Cuánto tarda cada acción en aplicarse](#6-cuánto-tarda-cada-acción-en-aplicarse)
7. [Seguridad y límites](#7-seguridad-y-límites)
8. [Respaldo y cambio de clave](#8-respaldo-y-cambio-de-clave)
9. [Solución de problemas](#9-solución-de-problemas)
10. [Mensajes para el cliente](#10-mensajes-para-el-cliente)

---

## 1. Cómo funciona

```
 TU MAC                                GITHUB PAGES                    CELULAR DEL CLIENTE
 ──────                                ────────────                    ───────────────────
 .licencias/privada.pem
        │
        │ npm run licencia -- emitir
        ▼
 código firmado ──── WhatsApp ─────────────────────────────────────▶  app verifica la firma
                                                                        con la clave pública
 npm run licencia -- revocar                                            (js/license-key.js)
        │                                                                     │
        ▼            git push                                                 │ al abrir, con internet
 licencias/estado.json ──────────▶ licencias/estado.json ◀──────────────────┘
                                   (lista de licencias revocadas)
```

- **Licencia firmada.** Cada código contiene cliente, tipo (demo o completa),
  fecha de vencimiento y días de gracia, firmado con una clave privada
  (ECDSA P-256) que solo existe en tu Mac. La app trae la clave pública: puede
  **verificar** códigos pero no **fabricarlos**. Cambiar un solo carácter
  (por ejemplo, la fecha) invalida el código.
- **Vencimiento.** Una demo deja de funcionar al terminar el día de vencimiento
  (hora del dispositivo).
- **Bloqueo remoto.** `licencias/estado.json` lista las licencias revocadas. La
  app lo consulta cada vez que se abre con internet.
- **Validación periódica obligatoria.** Si la app pasa más de *N* días sin poder
  consultar ese archivo (días de gracia: 3 en demo, 30 en licencia completa), se
  bloquea hasta que tenga internet. Así no se puede evitar un bloqueo
  apagando los datos.
- **Reloj protegido.** La app recuerda la fecha más alta que ha visto y usa la
  hora del servidor cuando hay internet: atrasar el reloj del celular no
  revive una demo vencida.
- **El bloqueo no borra nada.** Reglas, combustible, unidades y nombre del
  taller se conservan; al activar un código válido todo sigue igual.

## 2. Archivos involucrados

| Archivo | Qué es | ¿En git? |
|---|---|---|
| `.licencias/privada.pem` | Clave privada. Quien la tenga puede emitir licencias. | **No, nunca** |
| `.licencias/emitidas.jsonl` | Registro de todas las licencias emitidas (una por línea, con su código). | No |
| `js/license-key.js` | Clave pública que usa la app para verificar. | Sí |
| `licencias/estado.json` | Lista pública de licencias revocadas. | Sí |
| `js/license.js` | Lógica de verificación en la app. | Sí |
| `scripts/licencia.mjs` | Herramienta de línea de comandos (`npm run licencia`). | Sí |

Todos los comandos se ejecutan dentro de la carpeta `diagnostico-gases/`.

## 3. Configuración inicial (una sola vez)

Ya está hecha. Solo se repite si se cambia la clave (ver [sección 8](#8-respaldo-y-cambio-de-clave)).

```bash
npm install
npm run licencia -- init
```

`init` crea `.licencias/privada.pem` y escribe la clave pública en
`js/license-key.js`. Se niega a sobrescribir una clave existente.

**Inmediatamente después:** hacer respaldo de `.licencias/privada.pem`
(ver [sección 8](#8-respaldo-y-cambio-de-clave)).

## 4. Procesos del día a día

### 4.1 Entregar una demo a un cliente nuevo

```bash
npm run licencia -- emitir --cliente "Nombre del cliente"
```

Por defecto: **demo de 15 días**, validación en línea cada **3 días**.
Opciones: `--dias 7` (otra duración), `--gracia 5` (otros días sin internet).

La salida muestra:

```
Licencia L-1A2B3C4D — Nombre del cliente (demo, vence 2026-10-13, validar en línea cada 3 días)

Enlace de activación:
https://almacenero.github.io/diagnostico-gases/#lic=eyJ...

Código:
eyJ...
```

1. Anotar el **id** (`L-...`): es el que se usa para bloquear.
2. Enviar al cliente el **enlace de activación** con el
   [mensaje de demo](#mensaje-demo).
3. Si el cliente usa **iPhone** y ya instaló la app en la pantalla de inicio,
   enviarle también el **código** para pegarlo en la pantalla de licencia
   (en iPhone, Safari y la app instalada no comparten datos).

No hace falta publicar nada: emitir una licencia no cambia el sitio.

### 4.2 El cliente pagó: licencia completa

```bash
npm run licencia -- emitir --cliente "Nombre del cliente" --tipo full
```

Licencia **sin vencimiento**, validación en línea cada **30 días**. Enviar el
enlace nuevo con el [mensaje de activación](#mensaje-pago). Al abrirlo, el
código nuevo reemplaza al de la demo y desaparece el aviso de demostración.

Para una licencia completa con vencimiento (por ejemplo, suscripción anual):
`--tipo full --dias 365`. La app avisa cuando faltan 7 días o menos.

### 4.3 Extender una demo

Emitir un código nuevo con la duración deseada y enviárselo:

```bash
npm run licencia -- emitir --cliente "Nombre del cliente" --dias 10
```

### 4.4 Bloquear por falta de pago

```bash
npm run licencia -- listar                      # buscar el id del cliente
npm run licencia -- revocar L-1A2B3C4D
git commit -am "Revocar licencia L-1A2B3C4D"
git push
```

**Sin el `git push` el bloqueo no se aplica.** Ver
[sección 6](#6-cuánto-tarda-cada-acción-en-aplicarse) para los tiempos.

Si solo se quiere que la demo termine en su fecha, no hay que hacer nada: se
bloquea sola al vencer.

### 4.5 Desbloquear (el cliente pagó después de ser bloqueado)

Opción A — reactivar la misma licencia:

```bash
npm run licencia -- restaurar L-1A2B3C4D
git commit -am "Restaurar licencia L-1A2B3C4D"
git push
```

El cliente toca **Reintentar** en la pantalla de bloqueo (o vuelve a abrir la app).

Opción B — si la licencia era una demo, lo normal es emitir directamente una
licencia completa ([4.2](#42-el-cliente-pagó-licencia-completa)); el cliente la
pega en la pantalla de bloqueo o abre el enlace nuevo.

### 4.6 Cliente cambió de celular o borró los datos del navegador

Reenviar el **mismo enlace** (está en `.licencias/emitidas.jsonl`, campo `token`,
o en la salida de cuando se emitió). Las reglas cargadas en el celular anterior
no se transfieren: el cliente debe volver a cargar su Excel.

### 4.7 Ver las licencias emitidas

```bash
npm run licencia -- listar
```

```
L-1A2B3C4D  activa    demo  vence: 2026-10-13      emitida: 2026-09-28  Santiago
L-5E6F7A8B  REVOCADA  full  vence: sin vencimiento emitida: 2026-10-20  Taller X
```

## 5. Qué ve el cliente

| Situación | Título en pantalla | Mensaje |
|---|---|---|
| Demo vigente | *(la app funciona)* | Aviso arriba: "Versión de demostración para *cliente* · vence el *fecha* (quedan *N* días)" |
| Licencia completa por vencer (≤ 7 días) | *(la app funciona)* | Aviso arriba: "Licencia para *cliente* · vence el *fecha*…" |
| Sin código | Licencia requerida | "Esta aplicación necesita un código de licencia. Solicítelo a su proveedor." |
| Demo o licencia vencida | Demostración finalizada | "La licencia venció el *fecha*. Contacte a su proveedor…" |
| Revocada | Licencia suspendida | "Esta licencia fue suspendida. Contacte a su proveedor." |
| Demasiados días sin internet | Validación pendiente | "Conéctese a internet para validar la licencia (se requiere al menos cada *N* días) y toque Reintentar." |

La pantalla de bloqueo siempre ofrece pegar un código nuevo (**Activar**) y
volver a verificar (**Reintentar**), e indica que las reglas se conservan.
El "Días restantes" cuenta el día de hoy como un día.

## 6. Cuánto tarda cada acción en aplicarse

| Acción | Se aplica… |
|---|---|
| Emitir y enviar un código | En cuanto el cliente abre el enlace o pega el código. |
| Vencimiento de demo | Automáticamente al terminar el día de vencimiento, aun sin internet. |
| Revocar (+ `git push`) | La próxima vez que el cliente abra la app **con internet**, desde unos minutos después del push (GitHub Pages tarda ~1 min en publicar y su CDN puede guardar el archivo hasta 10 min). Con la app abierta, al volver a ella tras 10 min o más, o al recuperar la conexión. |
| Revocar, si el cliente se queda sin internet | Como máximo tras los días de gracia desde su última validación (3 en demo, 30 en licencia completa): la app se bloquea por "Validación pendiente" y, al conectarse, ve que está revocada. |
| Restaurar (+ `git push`) | Igual que revocar: al tocar Reintentar o abrir la app con internet, unos minutos después del push. |

## 7. Seguridad y límites

- **La clave privada es lo único que hay que proteger.** Con ella cualquiera
  puede emitir licencias. No enviarla por WhatsApp/correo ni subirla a git
  (`.gitignore` ya la excluye).
- **Un código no está atado a un dispositivo.** Si el cliente comparte su
  enlace, funciona en otros celulares. Si se detecta, revocar ese código y
  emitir uno nuevo solo para él.
- **Protege contra un usuario común, no contra un programador.** Como en toda
  app web, el código se ejecuta en el dispositivo del cliente; alguien con
  conocimientos podría copiar la app y quitar la verificación. Además, el
  repositorio es público. Para vender de forma masiva conviene hacer el
  repositorio privado (GitHub Pages en repo privado requiere GitHub Pro) o
  alojarla en AWS desde un repositorio privado.
- **Transparencia con el cliente.** Informar desde el inicio que es una demo
  con fecha de vencimiento y que el uso posterior requiere licencia (la app
  lo muestra, pero conviene decirlo también por escrito — ver
  [mensajes](#10-mensajes-para-el-cliente)).

## 8. Respaldo y cambio de clave

### Respaldo

Guardar una copia de `.licencias/privada.pem` fuera del computador (gestor de
contraseñas como nota segura, o una memoria USB guardada). Opcionalmente
también `.licencias/emitidas.jsonl`, para poder reenviar códigos.

Si se pierde la clave privada: las licencias ya emitidas **siguen funcionando**,
pero no se pueden emitir nuevas hasta cambiar la clave.

### Cambio de clave (si se perdió o se filtró)

Invalida **todas** las licencias existentes: hay que reenviar un código nuevo
a cada cliente.

```bash
mv .licencias .licencias-anterior          # conservar el registro viejo
npm run licencia -- init
npm run licencia -- emitir --cliente "..." # repetir por cada cliente activo
npm run release
npm test
git commit -am "Cambiar clave de licencias"
git push
```

Al actualizarse, la app de cada cliente mostrará "Licencia requerida" hasta
que active su código nuevo.

## 9. Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| "El enlace de activación no es válido" / "Código no válido" | El enlace o código llegó cortado o con espacios. | Reenviar el código completo; pedir que lo copie con "Copiar" de WhatsApp y lo pegue en la pantalla de licencia. |
| Activó en Safari pero la app del iPhone sigue pidiendo licencia | En iPhone, Safari y la app instalada tienen datos separados. | Pegar el código dentro de la app instalada. |
| "Validación pendiente" aun con internet | Sin acceso a GitHub en ese momento, o red que bloquea el sitio. | Tocar Reintentar; probar con datos móviles. |
| Revoqué y el cliente sigue usando la app | Falta el `git push`, pasaron pocos minutos, o el celular está sin internet. | Verificar con `git log` que se publicó; esperar; como máximo se bloquea al cumplirse los días de gracia. |
| Emití un código y no funciona en ningún lado | Se cambió la clave y el sitio publicado todavía tiene la clave pública anterior. | Publicar (`npm run release`, commit, `git push`). |
| `npm run licencia -- emitir` dice "No hay clave privada" | Falta `.licencias/privada.pem` (otra computadora o se borró). | Restaurar el respaldo en `.licencias/privada.pem`, o [cambiar la clave](#cambio-de-clave-si-se-perdió-o-se-filtró). |

## 10. Mensajes para el cliente

<a id="mensaje-demo"></a>
**Entrega de demo**

> Hola *Nombre*, te comparto la versión de demostración del software de
> diagnóstico de gases. Ábrela desde este enlace en tu celular y toca
> "Instalar app" (en iPhone: Compartir → Agregar a inicio):
>
> *enlace*
>
> La demo es válida hasta el *fecha*. Para que siga funcionando, conéctate a
> internet al menos cada 3 días. Después de esa fecha se requiere la licencia
> para continuar; tus reglas y configuración se mantienen.

<a id="mensaje-pago"></a>
**Activación tras el pago**

> Hola *Nombre*, gracias por tu pago. Este es tu código de licencia definitiva.
> Abre este enlace en el mismo celular donde tienes la app:
>
> *enlace*
>
> Si usas iPhone, abre la app, pega este código en "Código de licencia" y toca
> Activar: *código*

**Aviso antes del vencimiento**

> Hola *Nombre*, te recuerdo que la demo del software vence el *fecha*. Si
> quieres seguir usándolo, coordinemos el pago para enviarte la licencia
> definitiva.
