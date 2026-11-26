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

## Probar en local

```
node marcador/server.js
```
Después abre http://localhost:3000/control
