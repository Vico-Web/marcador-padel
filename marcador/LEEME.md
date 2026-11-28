# Marcador de pádel en directo

Dos páginas: un **marcador para OBS** y un **panel de control** para el móvil, sincronizados por un pequeño servidor que corre en el ordenador de OBS.

## Puesta en marcha

1. Instala Node.js 18 o superior (https://nodejs.org) si no lo tienes.
2. Copia esta carpeta `marcador` (y, si quieres las fichas de jugador y la pantalla VS, también la carpeta `widgets` a su lado) al ordenador de OBS.
3. En una terminal, dentro de `marcador`: `node server.js`
4. La terminal muestra las direcciones:
   - **OBS**: añade una fuente *Navegador* de 1920×1080 con `http://localhost:3000/overlay`
   - **Móvil** (misma wifi): `http://IP-DEL-ORDENADOR:3000/control`
   - **Gráficos** (fichas y VS): otra fuente Navegador de 1920×1080 con `http://localhost:3000/widgets/widgets.html`
   - **Panel de gráficos** (fotos y datos de jugadores): `http://IP-DEL-ORDENADOR:3000/widgets/panel-widgets.html`

Posición y tamaño del marcador: `/overlay?x=48&y=40&escala=1`. Con `&fondo` se ve sobre un fondo azul para probarlo en el navegador.

El estado se guarda en `estado.json`, así que si se cierra el servidor el partido sigue donde estaba.

## Variables de entorno

- `CLAVE_PANEL`: contraseña del panel. Si está definida, el panel la pide una vez y la recuerda en ese móvil. Los overlays de OBS no la necesitan (solo leen).
- `PORT`: puerto (por defecto 3000; los servicios de hosting lo ponen solos).
- `DATA_DIR`: carpeta donde guardar `estado.json` y `biblioteca.json` (en hosting, la del disco persistente).
- `CLAVE_RELOJ`: clave de los atajos del reloj (`/reloj/...`). Si no se define, se usa `CLAVE_PANEL`.

## Colores

En el panel, sección *Colores*: paletas preparadas o cuatro colores (acento, fondo, texto, secundario) con selector o escribiendo `#hex`, `rgb(...)` o el nombre. Se aplican al marcador y a las fichas a la vez.

## Reglas que aplica

- 0 / 15 / 30 / 40, juegos, sets (a 1, 3 o 5) y tie-break a 7 con 6-6.
- En 40-40, a elegir: **ventaja**, **punto de oro** o **star point** (por defecto: tras dos ventajas, el tercer 40-40 es punto decisivo; configurable).
- Set decisivo como **super tie-break** a 10 (opcional).
- Rotación de saque A1, B1, A2, B2 y saque en el tie-break (1 punto y luego de 2 en 2). Botones para corregir quién saca.
- Etiquetas automáticas: BREAKPOINT, SET POINT, MATCH POINT, STAR POINT, PUNTO DE ORO, TIE-BREAK.

## Archivos

- `server.js`: servidor sin dependencias (SSE en `/events`, `POST /api/action`, `/api/undo`, `/api/patch`).
- `public/engine.js`: lógica de puntuación.
- `public/overlay.html`, `public/scoreboard.js`, `public/scoreboard.css`: el marcador.
- `public/control.html`: el panel. Si se abre sin servidor funciona en modo demo.
