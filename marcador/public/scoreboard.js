/* Pinta el marcador a partir del documento compartido. Requiere engine.js y scoreboard.css. */
(function () {
  'use strict';
  var E = window.PadelEngine;

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function setTexto(n, txt) {
    txt = txt == null ? '' : String(txt);
    if (n.textContent === txt) return;
    n.textContent = txt;
    n.classList.remove('cambio');
    void n.offsetWidth;
    n.classList.add('cambio');
  }

  function nombreCorto(j) {
    if (!j) return '';
    return (j.apellido || j.nombre || '').toUpperCase();
  }

  /* ---------- colores ---------- */
  function rgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mezcla(c, d, t) { return [0, 1, 2].map(function (i) { return Math.round(c[i] + (d[i] - c[i]) * t); }); }
  function luminancia(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  /* Convierte cualquier color CSS (hex, rgb(), hsl(), nombre) a #rrggbb; null si no es válido */
  var ctx = null;
  function normalizar(txt) {
    txt = String(txt || '').trim();
    if (/^[0-9a-f]{6}$/i.test(txt)) txt = '#' + txt;
    if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(txt)) txt = 'rgb(' + txt + ')';
    ctx = ctx || document.createElement('canvas').getContext('2d');
    ctx.fillStyle = '#010203';
    ctx.fillStyle = txt;
    var r = ctx.fillStyle;
    if (r === '#010203' && !/^#?010203$/i.test(txt)) return null;
    if (r.charAt(0) === '#') return r.toLowerCase();
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(r);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + (+x).toString(16)).slice(-2); }).join('');
  }
  function aplicarTema(nodo, tema) {
    var d = E.TEMA_DEFECTO;
    tema = tema || {};
    var ac = rgb(tema.acento) || rgb(d.acento), fo = rgb(tema.fondo) || rgb(d.fondo),
      tx = rgb(tema.texto) || rgb(d.texto), se = rgb(tema.secundario) || rgb(d.secundario);
    var claro = luminancia(fo) > 0.4;
    var st = nodo.style;
    st.setProperty('--mk-fondo', rgba(fo, 0.92));
    st.setProperty('--mk-fondo-solido', rgba(fo, 1));
    st.setProperty('--mk-fondo-2', rgba(mezcla(fo, claro ? [0, 0, 0] : [255, 255, 255], 0.1), 0.95));
    st.setProperty('--mk-linea', rgba(tx, 0.1));
    st.setProperty('--mk-texto', rgba(tx, 1));
    st.setProperty('--mk-tenue', rgba(se, 0.85));
    st.setProperty('--mk-set', rgba(se, 1));
    st.setProperty('--mk-acento', rgba(ac, 1));
    st.setProperty('--mk-acento-texto', luminancia(ac) > 0.35 ? '#0e1218' : '#ffffff');
    st.setProperty('--mk-acento-suave', rgba(ac, 0.18));
  }

  function crear(contenedor) {
    var raiz = el('div', 'mk');
    var cab = el('div', 'mk-cabecera');
    var caja = el('div', 'mk-caja');
    var filas = [0, 1].map(function () {
      var f = el('div', 'mk-fila');
      var saque = el('div', 'mk-saque'); saque.appendChild(el('i'));
      var nombres = el('div', 'mk-nombres');
      var j0 = el('span', 'j'), j1 = el('span', 'j');
      nombres.appendChild(j0); nombres.appendChild(el('span', 'sep', '/')); nombres.appendChild(j1);
      var sets = el('div', 'mk-sets');
      var juegos = el('div', 'mk-juegos'), jt = el('span'); juegos.appendChild(jt);
      var puntos = el('div', 'mk-puntos'), pt = el('span'); puntos.appendChild(pt);
      f.appendChild(saque); f.appendChild(nombres); f.appendChild(sets); f.appendChild(juegos); f.appendChild(puntos);
      caja.appendChild(f);
      return { f: f, j: [j0, j1], sets: sets, juegos: jt, puntos: pt };
    });
    var etq = el('div', 'mk-etiquetas');
    raiz.appendChild(cab); raiz.appendChild(caja); raiz.appendChild(etq);
    contenedor.appendChild(raiz);
    return { raiz: raiz, cab: cab, caja: caja, filas: filas, etq: etq, ultimasEtiquetas: '' };
  }

  function pintar(ui, doc) {
    var v = E.vista(doc.marcador);
    var jug = doc.jugadores || [];
    var partido = doc.partido || {};
    ui.raiz.classList.toggle('oculto', doc.marcadorVisible === false);
    var claveTema = JSON.stringify(doc.tema || {});
    if (claveTema !== ui.ultimoTema) { ui.ultimoTema = claveTema; aplicarTema(ui.raiz, doc.tema); }
    ui.raiz.classList.toggle('mk-sin-puntos', v.ganador !== null);

    var cab = [partido.torneo, partido.ronda].filter(Boolean).join(' · ');
    if (ui.cab.textContent !== cab) ui.cab.textContent = cab;

    ui.filas.forEach(function (r, e) {
      r.j[0].textContent = nombreCorto(jug[e * 2]);
      r.j[1].textContent = nombreCorto(jug[e * 2 + 1]);
      var saca = v.sacador && v.sacador.equipo === e;
      r.f.classList.toggle('saca', !!saca);
      r.j[0].classList.toggle('saca', !!saca && v.sacador.jugador === 0);
      r.j[1].classList.toggle('saca', !!saca && v.sacador.jugador === 1);
      r.f.classList.toggle('ganador', v.ganador === e);

      // sets terminados
      while (r.sets.children.length > v.sets.length) r.sets.removeChild(r.sets.lastChild);
      while (r.sets.children.length < v.sets.length) r.sets.appendChild(el('div', 'mk-set'));
      v.sets.forEach(function (st, i) {
        var c = r.sets.children[i];
        var gana = st.j[e] > st.j[1 - e];
        c.className = 'mk-set' + (gana ? ' gana' : '');
        c.innerHTML = '';
        var esSuper = st.tb && st.j[0] + st.j[1] === 1;
        c.appendChild(document.createTextNode(esSuper ? st.tb[e] : st.j[e]));
        // puntos del tie-break del perdedor, como en tenis
        if (st.tb && !gana && !esSuper) c.appendChild(el('sup', null, st.tb[e]));
      });

      if (v.ganador !== null) {
        setTexto(r.juegos, v.setsGanados[e]);
      } else {
        setTexto(r.juegos, doc.marcador.tiebreak && doc.marcador.superTiebreak ? '' : v.juegos[e]);
      }
      setTexto(r.puntos, v.puntos[e]);
    });

    var etiquetas = v.ganador !== null ? ['FIN DEL PARTIDO'] : v.etiquetas;
    var clave = etiquetas.join('|');
    if (clave !== ui.ultimasEtiquetas) {
      ui.ultimasEtiquetas = clave;
      ui.etq.innerHTML = '';
      etiquetas.forEach(function (t) {
        var fuerte = /MATCH|SET|STAR|ORO|FIN/.test(t);
        ui.etq.appendChild(el('div', 'mk-etiqueta' + (fuerte ? ' fuerte' : ''), t));
      });
    }
  }

  window.Scoreboard = { crear: crear, pintar: pintar, normalizar: normalizar, aplicarTema: aplicarTema };
})();
