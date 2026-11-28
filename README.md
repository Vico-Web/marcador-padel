# Marcador de pádel en directo

Marcador para OBS, fichas de jugador, pantalla VS y panel de control para el móvil.

- `marcador/`: servidor (`server.js`), marcador (`/overlay`) y panel (`/control`). Más detalles en `marcador/LEEME.md`.
- `widgets/`: fichas de jugador y pantalla VS (`/widgets/widgets.html`) y su panel (`/widgets/panel-widgets.html`).

## Publicarlo en Railway

1. En railway.com: **New Project → Deploy from GitHub repo** y elige `marcador-padel`.
2. En el servicio, ve a **Variables** y añade:
   - `CLAVE_PANEL` = la contraseña que quieras para el panel
   - `DATA_DIR` = `/data`
3. Haz clic derecho en el lienzo del proyecto (o pulsa Ctrl+K), elige **Add Volume**, selecciona el servicio y usa la ruta de montaje `/data`. Ahí se guardan el partido y las fichas.
4. En **Settings → Networking**, pulsa **Generate Domain**. Te dará una dirección del tipo `https://marcador-padel-production.up.railway.app`.
5. Tope de gasto: en **Workspace → Usage → Usage Limits**, pon un límite duro, por ejemplo 10 $.

Direcciones finales (sustituye por tu dominio):
- Panel en el móvil: `https://TU-DOMINIO/control`
- OBS, fuente Navegador de 1920×1080: `https://TU-DOMINIO/overlay`
- OBS, fichas y VS, otra fuente de 1920×1080: `https://TU-DOMINIO/widgets/widgets.html`

Cada vez que se sube un cambio a GitHub, Railway lo vuelve a publicar solo.

## Control desde el Apple Watch (app Atajos)

El servidor tiene direcciones sencillas pensadas para atajos del iPhone y el Apple Watch. Responden con un texto corto con el marcador, por ejemplo `40-15 · Juegos 3-2 · Sets 1-0`, y el cambio aparece al momento en OBS y en el panel.

| Acción | Método | Dirección |
| --- | --- | --- |
| Punto pareja A | POST | `/reloj/punto/a` |
| Punto pareja B | POST | `/reloj/punto/b` |
| Quitar el último punto de A | POST | `/reloj/restar/a` |
| Quitar el último punto de B | POST | `/reloj/restar/b` |
| Deshacer lo último | POST | `/reloj/deshacer` |
| Ver el marcador | GET | `/reloj/estado` |

La clave va en la cabecera `X-Clave` o al final de la dirección: `?clave=TU-CLAVE`. Por defecto es la misma que `CLAVE_PANEL`; si quieres una distinta para el reloj, define la variable `CLAVE_RELOJ` en Railway.

"Restar" solo quita el último punto y solo si lo ganó esa pareja (el pádel no permite restar un punto suelto sin saber cómo se llegó al marcador). Para cualquier otra corrección, usa deshacer o el panel.

En la app Atajos: nuevo atajo → acción **Obtener contenido de URL** con la dirección completa (por ejemplo `https://TU-DOMINIO/reloj/punto/a?clave=TU-CLAVE`), método **POST** → acción **Mostrar resultado**. En los detalles del atajo, activa **Mostrar en el Apple Watch**.

## Probar en local

```
node marcador/server.js
```
Después abre http://localhost:3000/control
