/* Motor de puntuación de pádel. Funciones puras: no modifican el estado recibido.
   Se usa igual en el navegador (window.PadelEngine) y en Node (require). */
(function (root) {
  'use strict';

  var DEFAULT_CONFIG = {
    sets: 3,              // al mejor de 3 (o 1, 5)
    juegosSet: 6,         // juegos para ganar un set
    tiebreakA: 6,         // tie-break con 6-6
    puntosTiebreak: 7,
    superTiebreak: false, // set decisivo como super tie-break
    puntosSuperTiebreak: 10,
    modoIguales: 'starpoint', // 'ventaja' | 'oro' | 'starpoint'
    starPointEn: 3        // en star point, el n-ésimo 40-40 es punto decisivo
  };

  var TEMA_DEFECTO = { acento: '#c8f135', fondo: '#0d1014', texto: '#ffffff', secundario: '#9aa4b2' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function nuevoPartido(config, saque) {
    return {
      config: Object.assign({}, DEFAULT_CONFIG, config || {}),
      setsJugados: [],        // [{ j:[6,4], tb:null|[7,5] }]
      juegos: [0, 0],
      puntos: [0, 0],         // puntos brutos del juego o del tie-break
      tiebreak: false,
      superTiebreak: false,
      // saque: equipo que sacó el primer juego y orden de sacadores de cada pareja
      saque: Object.assign({ primerEquipo: 0, orden: [[0, 1], [0, 1]], turno: 0, turnoInicioTb: 0 }, saque || {}),
      ganador: null
    };
  }

  function setsGanados(s) {
    var g = [0, 0];
    s.setsJugados.forEach(function (st) { g[st.j[0] > st.j[1] ? 0 : 1]++; });
    return g;
  }

  function setsParaGanar(s) { return Math.floor(s.config.sets / 2) + 1; }

  function esSetDecisivo(s) {
    var g = setsGanados(s), n = setsParaGanar(s) - 1;
    return g[0] === n && g[1] === n;
  }

  /* Quién saca ahora: { equipo, jugador } (jugador 0/1 dentro de la pareja) */
  function sacador(s) {
    var sq = s.saque, turno = sq.turno;
    if (s.tiebreak) {
      var p = s.puntos[0] + s.puntos[1];
      turno = sq.turnoInicioTb + Math.floor((p + 1) / 2);
    }
    var equipo = (sq.primerEquipo + turno) % 2;
    var k = Math.floor(turno / 2) % 2;
    return { equipo: equipo, jugador: sq.orden[equipo][k] };
  }

  /* Número de "iguales" (40-40) alcanzado ahora: 0 si no hay iguales */
  function numeroIguales(s) {
    var a = s.puntos[0], b = s.puntos[1];
    return (!s.tiebreak && a === b && a >= 3) ? a - 2 : 0;
  }

  /* ¿El próximo punto decide el juego para ambos? (punto de oro / star point) */
  function puntoDecisivo(s) {
    var n = numeroIguales(s);
    if (!n) return null;
    var m = s.config.modoIguales;
    if (m === 'oro') return 'oro';
    if (m === 'starpoint' && n >= s.config.starPointEn) return 'starpoint';
    return null;
  }

  function cerrarSet(s, ganadorSet, tb) {
    s.setsJugados.push({ j: s.juegos.slice(), tb: tb || null });
    s.juegos = [0, 0];
    s.puntos = [0, 0];
    var g = setsGanados(s);
    if (g[ganadorSet] >= setsParaGanar(s)) {
      s.ganador = ganadorSet;
      return;
    }
    if (s.config.superTiebreak && esSetDecisivo(s)) {
      s.tiebreak = true;
      s.superTiebreak = true;
      s.saque.turnoInicioTb = s.saque.turno;
    }
  }

  function ganarJuego(s, e) {
    s.juegos[e]++;
    s.puntos = [0, 0];
    s.saque.turno++;
    var a = s.juegos[e], b = s.juegos[1 - e], c = s.config;
    if (a >= c.juegosSet && a - b >= 2) { cerrarSet(s, e); return; }
    if (s.juegos[0] === c.tiebreakA && s.juegos[1] === c.tiebreakA) {
      s.tiebreak = true;
      s.saque.turnoInicioTb = s.saque.turno;
    }
  }

  function ganarTiebreak(s, e) {
    var tb = s.puntos.slice();
    var eraSuper = s.superTiebreak;
    s.tiebreak = false;
    s.superTiebreak = false;
    // Saca primero en el set siguiente quien recibió el primer punto del tie-break
    s.saque.turno = s.saque.turnoInicioTb + 1;
    if (eraSuper) { s.juegos = e === 0 ? [1, 0] : [0, 1]; }
    else { s.juegos[e]++; }
    cerrarSet(s, e, tb);
  }

  /* Suma un punto a la pareja e (0 o 1). Devuelve un estado nuevo. */
  function punto(estado, e) {
    var s = clone(estado);
    if (s.ganador !== null) return s;
    if (s.tiebreak) {
      s.puntos[e]++;
      var objetivo = s.superTiebreak ? s.config.puntosSuperTiebreak : s.config.puntosTiebreak;
      if (s.puntos[e] >= objetivo && s.puntos[e] - s.puntos[1 - e] >= 2) ganarTiebreak(s, e);
      return s;
    }
    var decisivo = puntoDecisivo(s);
    s.puntos[e]++;
    var a = s.puntos[e], b = s.puntos[1 - e];
    if (decisivo || (a >= 4 && a - b >= 2)) ganarJuego(s, e);
    return s;
  }

  /* Texto de los puntos de cada pareja para el marcador */
  function textoPuntos(s) {
    if (s.ganador !== null) return ['', ''];
    var a = s.puntos[0], b = s.puntos[1];
    if (s.tiebreak) return [String(a), String(b)];
    var tabla = ['0', '15', '30', '40'];
    if (a < 3 || b < 3) return [tabla[Math.min(a, 3)], tabla[Math.min(b, 3)]];
    if (a === b) {
      var d = puntoDecisivo(s);
      if (d === 'starpoint') return ['SP', 'SP'];
      if (d === 'oro') return ['PO', 'PO'];
      return ['40', '40'];
    }
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }

  /* Etiquetas de situación: BREAKPOINT, SET POINT, MATCH POINT, STAR POINT, PUNTO DE ORO, TIE-BREAK */
  function etiquetas(s) {
    if (s.ganador !== null) return [];
    var out = [];
    var srv = sacador(s).equipo;
    var bp = false, sp = false, mp = false;
    for (var e = 0; e < 2; e++) {
      var t = punto(s, e);
      var juegoGanado = t.setsJugados.length > s.setsJugados.length ||
        t.juegos[e] > s.juegos[e];
      if (t.ganador === e) mp = true;
      else if (t.setsJugados.length > s.setsJugados.length) sp = true;
      else if (juegoGanado && !s.tiebreak && e !== srv) bp = true;
    }
    var d = puntoDecisivo(s);
    if (mp) out.push('MATCH POINT');
    else if (sp) out.push('SET POINT');
    if (d === 'starpoint') out.push('STAR POINT');
    else if (d === 'oro') out.push('PUNTO DE ORO');
    if (bp && !mp && !sp && !d) out.push('BREAKPOINT');
    if (!out.length && s.tiebreak) out.push(s.superTiebreak ? 'SUPER TIE-BREAK' : 'TIE-BREAK');
    return out;
  }

  /* Vista lista para pintar */
  function vista(s) {
    var p = textoPuntos(s);
    return {
      sets: s.setsJugados.map(function (x) { return { j: x.j, tb: x.tb }; }),
      juegos: s.juegos.slice(),
      puntos: p,
      sacador: s.ganador === null ? sacador(s) : null,
      etiquetas: etiquetas(s),
      tiebreak: s.tiebreak,
      ganador: s.ganador,
      setsGanados: setsGanados(s)
    };
  }

  /* Acciones de saque manuales */
  function cambiarEquipoSaque(estado) {
    var s = clone(estado);
    s.saque.primerEquipo = 1 - s.saque.primerEquipo;
    return s;
  }
  function cambiarSacador(estado) {
    var s = clone(estado);
    var e = sacador(s).equipo;
    s.saque.orden[e] = s.saque.orden[e].slice().reverse();
    return s;
  }

  var api = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    nuevoPartido: nuevoPartido,
    punto: punto,
    sacador: sacador,
    textoPuntos: textoPuntos,
    etiquetas: etiquetas,
    vista: vista,
    cambiarEquipoSaque: cambiarEquipoSaque,
    cambiarSacador: cambiarSacador,
    setsGanados: setsGanados
  };

  /* ---------- Documento compartido (marcador + widgets) ---------- */
  function documentoInicial() {
    function j(n, a) {
      return { nombre: n, apellido: a, pais: '', foto: '', ranking: null, mejorRanking: null, edad: null,
        posicion: '', mano: '', puntos: null, partidosJugados: null, partidosGanados: null, titulos: null };
    }
    return {
      jugadores: [j('', 'JUGADOR 1'), j('', 'JUGADOR 2'), j('', 'JUGADOR 3'), j('', 'JUGADOR 4')],
      partido: { categoria: '', ronda: '', torneo: '', logo: '' },
      widgets: { ficha: { visible: false, jugador: 0, vista: 'bio' }, vs: { visible: false } },
      tema: Object.assign({}, TEMA_DEFECTO),
      marcadorVisible: true,
      marcador: nuevoPartido()
    };
  }

  /* Aplica una acción al documento. Devuelve un documento nuevo. */
  function aplicarAccion(doc, accion) {
    var d = clone(doc);
    switch (accion.type) {
      case 'punto': d.marcador = punto(d.marcador, accion.equipo === 1 ? 1 : 0); break;
      case 'cambiarEquipoSaque': d.marcador = cambiarEquipoSaque(d.marcador); break;
      case 'cambiarSacador': d.marcador = cambiarSacador(d.marcador); break;
      case 'nuevoPartido': d.marcador = nuevoPartido(accion.config || d.marcador.config, accion.saque); break;
      case 'config': d.marcador.config = Object.assign({}, d.marcador.config, accion.config || {}); break;
      case 'marcadorVisible': d.marcadorVisible = !!accion.visible; break;
      default: throw new Error('Acción desconocida: ' + accion.type);
    }
    return d;
  }

  api.documentoInicial = documentoInicial;
  api.TEMA_DEFECTO = TEMA_DEFECTO;
  api.aplicarAccion = aplicarAccion;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PadelEngine = api;
})(typeof window !== 'undefined' ? window : this);
