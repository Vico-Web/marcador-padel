#!/usr/bin/env node
/* Servidor del marcador de pádel. Sin dependencias: solo Node 18 o superior.
   Uso: node server.js   (puerto por defecto 3000; cambiar con PORT=4000 node server.js) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const E = require('./public/engine.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const WIDGETS = path.join(__dirname, '..', 'widgets');
// Carpeta donde se guardan estado.json y biblioteca.json. En Railway se usa el disco (volumen) automáticamente.
const DATOS = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
try { fs.mkdirSync(DATOS, { recursive: true }); } catch (_) {}
let ultimoGuardado = null, errorGuardado = null;
const ARCHIVO_ESTADO = path.join(DATOS, 'estado.json');
const CLAVE = process.env.CLAVE_PANEL || '';            // si está definida, el panel pide contraseña
// Clave para los atajos del reloj (/reloj/...). Si no se define, se usa la del panel.
const CLAVE_RELOJ = process.env.CLAVE_RELOJ || CLAVE;
const crypto = require('crypto');
let bib = async () => false;
try { bib = require(path.join(WIDGETS, 'biblioteca-server.js'))(DATOS); } catch (_) { /* sin carpeta widgets */ }

function iguales(dada, clave) {
  const a = Buffer.from(String(dada || ''));
  const b = Buffer.from(clave);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function claveOk(req) {
  if (!CLAVE) return true;
  return iguales(req.headers['x-clave'], CLAVE);
}
function claveRelojOk(req, url) {
  if (!CLAVE_RELOJ) return true;
  return iguales(req.headers['x-clave'] || url.searchParams.get('clave'), CLAVE_RELOJ);
}

/* Resumen corto del marcador para mostrar en el reloj, p. ej. "40-15 · Juegos 3-2 · Sets 1-0" */
function resumen() {
  const m = doc.marcador;
  const v = E.vista(m);
  if (v.ganador !== null) return 'Partido terminado. Gana la pareja ' + (v.ganador === 0 ? 'A' : 'B') +
    ' · Sets ' + v.setsGanados.join('-');
  const puntos = v.puntos.join('-');
  const partes = [(v.tiebreak ? 'TB ' : '') + puntos, 'Juegos ' + v.juegos.join('-'), 'Sets ' + v.setsGanados.join('-')];
  if (v.etiquetas.length) partes.push(v.etiquetas.join(', '));
  return partes.join(' · ');
}
function texto(res, code, t) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(t);
}

/* Atajos del reloj: POST /reloj/punto/a|b, /reloj/restar/a|b, /reloj/deshacer; GET o POST /reloj/estado.
   Clave en la cabecera X-Clave o en ?clave=. Responden con texto corto. */
function atajoReloj(req, res, url) {
  if (!claveRelojOk(req, url)) return texto(res, 401, 'Clave incorrecta');
  const partes = url.pathname.split('/').filter(Boolean).slice(1); // ['punto','a']
  const orden = partes[0], equipo = { a: 0, b: 1 }[(partes[1] || '').toLowerCase()];
  if (orden === 'estado') return texto(res, 200, resumen());
  if (req.method !== 'POST') return texto(res, 405, 'Usa el método POST');
  if (orden === 'punto' && equipo !== undefined) {
    if (doc.marcador.ganador !== null) return texto(res, 409, 'El partido ya ha terminado. ' + resumen());
    historial.push(doc.marcador);
    if (historial.length > MAX_HISTORIAL) historial.shift();
    doc = E.aplicarAccion(doc, { type: 'punto', equipo });
  } else if (orden === 'restar' && equipo !== undefined) {
    // Solo se puede quitar el último punto, y solo si lo ganó esa pareja.
    const previo = historial[historial.length - 1];
    if (!previo || JSON.stringify(E.punto(previo, equipo)) !== JSON.stringify(doc.marcador))
      return texto(res, 409, 'El último punto no fue de la pareja ' + partes[1].toUpperCase() + '. ' + resumen());
    doc.marcador = historial.pop();
  } else if (orden === 'deshacer') {
    if (!historial.length) return texto(res, 409, 'Nada que deshacer. ' + resumen());
    doc.marcador = historial.pop();
  } else return texto(res, 404, 'Orden desconocida');
  emitir();
  return texto(res, 200, resumen());
}
const MAX_HISTORIAL = 300;

let doc = E.documentoInicial();
let historial = []; // copias anteriores de doc.marcador para "deshacer"
try {
  const guardado = JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, 'utf8'));
  doc = Object.assign(doc, guardado.doc || {});
  doc.tema = Object.assign({}, E.TEMA_DEFECTO, doc.tema || {});
  historial = guardado.historial || [];
  console.log('Estado recuperado de estado.json');
} catch (_) { /* primera vez */ }

const clientes = new Set();
let guardarPendiente = null;

function emitir() {
  const datos = 'data: ' + JSON.stringify(doc) + '\n\n';
  for (const res of clientes) res.write(datos);
  clearTimeout(guardarPendiente);
  guardarPendiente = setTimeout(() => {
    fs.writeFile(ARCHIVO_ESTADO, JSON.stringify({ doc, historial }), err => {
      if (err) { errorGuardado = err.message; console.error('No se pudo guardar el estado:', err.message); }
      else { ultimoGuardado = new Date().toISOString(); errorGuardado = null; }
    });
  }, 300);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2' };

function servirArchivo(res, base, rel) {
  const ruta = path.normalize(path.join(base, rel));
  if (!ruta.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(ruta, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(ruta).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

function leerJSON(req) {
  return new Promise((ok, ko) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 10e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Clave' });
    return res.end();
  }

  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*', 'X-Accel-Buffering': 'no' });
    res.write('retry: 1000\n');
    res.write('data: ' + JSON.stringify(doc) + '\n\n');
    clientes.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); clientes.delete(res); });
    return;
  }

  if (p === '/api/state' && req.method === 'GET') return json(res, 200, doc);
  if (p === '/api/info' && req.method === 'GET') return json(res, 200, { clave: !!CLAVE, datos: DATOS, volumen: process.env.RAILWAY_VOLUME_MOUNT_PATH || null, dataDir: process.env.DATA_DIR || null, ultimoGuardado, errorGuardado });

  if (p.startsWith('/reloj/')) return atajoReloj(req, res, url);

  if (req.method === 'POST' && p.startsWith('/api/') && !claveOk(req)) return json(res, 401, { error: 'clave' });
  if (p === '/api/login') return json(res, 200, { ok: true });
  if (await bib(req, res, url)) return;

  if (req.method === 'POST' && p.startsWith('/api/')) {
    let cuerpo;
    try { cuerpo = await leerJSON(req); } catch (e) { return json(res, 400, { error: 'JSON no válido' }); }
    try {
      if (p === '/api/action') {
        historial.push(doc.marcador);
        if (historial.length > MAX_HISTORIAL) historial.shift();
        doc = E.aplicarAccion(doc, cuerpo);
      } else if (p === '/api/undo') {
        if (historial.length) doc.marcador = historial.pop();
      } else if (p === '/api/patch') {
        for (const k of Object.keys(cuerpo)) if (k !== 'marcador') doc[k] = cuerpo[k];
      } else if (p === '/api/reset') {
        historial = [];
        doc = E.documentoInicial();
      } else return json(res, 404, { error: 'Ruta desconocida' });
    } catch (e) {
      if (p === '/api/action') historial.pop();
      return json(res, 400, { error: e.message });
    }
    emitir();
    return json(res, 200, { ok: true, deshacer: historial.length });
  }

  if (p === '/' ) { res.writeHead(302, { Location: '/control' }); return res.end(); }
  if (p === '/overlay') return servirArchivo(res, PUBLIC, 'overlay.html');
  if (p === '/control') return servirArchivo(res, PUBLIC, 'control.html');
  if (p.startsWith('/widgets/')) return servirArchivo(res, WIDGETS, decodeURIComponent(p.slice(9)));
  return servirArchivo(res, PUBLIC, decodeURIComponent(p.slice(1)));
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const lista of Object.values(os.networkInterfaces()))
    for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  console.log('\n  Marcador de pádel en marcha\n');
  console.log('  Datos guardados en: ' + DATOS);
  console.log('  OBS (fuente de navegador 1920x1080):  http://localhost:' + PORT + '/overlay');
  console.log('  Panel en este ordenador:              http://localhost:' + PORT + '/control');
  for (const ip of ips) console.log('  Panel desde el móvil (misma wifi):    http://' + ip + ':' + PORT + '/control');
  console.log(CLAVE ? '  Panel protegido con contraseña (CLAVE_PANEL).' : '  Aviso: panel sin contraseña. Define CLAVE_PANEL para protegerlo.');
  console.log('\n  Ctrl+C para parar.\n');
});
