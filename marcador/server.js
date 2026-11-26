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
const DATOS = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
try { fs.mkdirSync(DATOS, { recursive: true }); } catch (_) {}
let ultimoGuardado = null, errorGuardado = null;
const ARCHIVO_ESTADO = path.join(DATOS, 'estado.json');
const CLAVE = process.env.CLAVE_PANEL || '';            // si está definida, el panel pide contraseña
const crypto = require('crypto');
let bib = async () => false;
try { bib = require(path.join(WIDGETS, 'biblioteca-server.js'))(DATOS); } catch (_) { /* sin carpeta widgets */ }

function claveOk(req) {
  if (!CLAVE) return true;
  const a = Buffer.from(String(req.headers['x-clave'] || ''));
  const b = Buffer.from(CLAVE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  if (p === '/api/info' && req.method === 'GET') return json(res, 200, { clave: !!CLAVE, datos: DATOS, volumen: !!process.env.RAILWAY_VOLUME_MOUNT_PATH, ultimoGuardado, errorGuardado });

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
