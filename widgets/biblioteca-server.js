/* Archivo de fichas de jugadores guardadas. Se guarda en biblioteca.json, fuera del documento que va por SSE.
   Uso en server.js:
     const bib = require('../widgets/biblioteca-server.js')(__dirname);
     // al principio del manejador de peticiones:
     if (await bib(req, res, url)) return;
   Si existe CLAVE_PANEL, los POST exigen la cabecera X-Clave (igual que el resto de /api).
   Rutas: GET /api/biblioteca            -> [jugador...]
          POST /api/biblioteca/guardar   {jugador}  -> crea o actualiza (por id) y devuelve {ok, jugador, lista}
          POST /api/biblioteca/borrar    {id}       -> {ok, lista} */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CAMPOS = ['id','nombre','apellido','pais','foto','ranking','mejorRanking','edad','posicion','mano','puntos','partidosJugados','partidosGanados','titulos','actualizado'];

module.exports = function (dir) {
  const archivo = path.join(dir, 'biblioteca.json');
  let lista = [];
  try { lista = JSON.parse(fs.readFileSync(archivo, 'utf8')); if (!Array.isArray(lista)) lista = []; } catch (_) {}
  const guardar = () => fs.writeFile(archivo, JSON.stringify(lista), () => {});
  const limpiar = j => { const o = {}; for (const k of CAMPOS) if (j[k] !== undefined) o[k] = j[k]; return o; };
  const resp = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const leer = req => new Promise((ok, ko) => { let s = ''; req.on('data', c => { s += c; if (s.length > 10e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } }); });
  const orden = () => lista.sort((a, b) => String(a.apellido || '').localeCompare(String(b.apellido || ''), 'es'));

  return async function (req, res, url) {
    const p = (url || new URL(req.url, 'http://x')).pathname;
    if (!p.startsWith('/api/biblioteca')) return false;
    if (req.method === 'GET' && p === '/api/biblioteca') { resp(res, 200, orden()); return true; }
    if (req.method !== 'POST') { resp(res, 405, { error: 'Método no permitido' }); return true; }
    const clave = process.env.CLAVE_PANEL;
    if (clave && req.headers['x-clave'] !== clave) { resp(res, 401, { error: 'clave' }); return true; }
    let c; try { c = await leer(req); } catch (_) { resp(res, 400, { error: 'JSON no válido' }); return true; }
    if (p === '/api/biblioteca/guardar') {
      const j = limpiar(c.jugador || {});
      if (!String(j.apellido || j.nombre || '').trim()) { resp(res, 400, { error: 'Falta el nombre' }); return true; }
      j.actualizado = Date.now();
      const i = j.id ? lista.findIndex(x => x.id === j.id) : -1;
      if (i >= 0) lista[i] = j; else { j.id = j.id || crypto.randomUUID(); lista.push(j); }
      guardar(); resp(res, 200, { ok: true, jugador: j, lista: orden() }); return true;
    }
    if (p === '/api/biblioteca/borrar') {
      lista = lista.filter(x => x.id !== c.id); guardar(); resp(res, 200, { ok: true, lista: orden() }); return true;
    }
    resp(res, 404, { error: 'Ruta desconocida' }); return true;
  };
};
