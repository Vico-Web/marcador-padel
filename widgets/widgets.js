/* Ficha de jugador y pantalla VS. Render + sincronización.
   Estado compartido: { jugadores[4], partido{categoria,ronda,torneo,logo}, widgets{ficha{visible,jugador,vista}, vs{visible}, acento} }
   Transporte: si la página se sirve desde el servidor del marcador (http), SSE en /events y POST /api/patch.
   Si se abre como archivo, BroadcastChannel "marcador-padel" + localStorage (útil para probar en un mismo navegador). */
(function(){
const KEY='marcador-padel-widgets';
const EJEMPLO={
  jugadores:[
    {nombre:'Marcos',apellido:'Vidal',pais:'ES',foto:'',ranking:12,mejorRanking:8,edad:27,posicion:'Revés',mano:'Diestro',puntos:4210,partidosJugados:184,partidosGanados:121,titulos:3},
    {nombre:'Iker',apellido:'Soler',pais:'ES',foto:'',ranking:15,mejorRanking:11,edad:24,posicion:'Drive',mano:'Diestro',puntos:3890,partidosJugados:132,partidosGanados:84,titulos:1},
    {nombre:'Tomás',apellido:'Ferreyra',pais:'AR',foto:'',ranking:9,mejorRanking:6,edad:31,posicion:'Revés',mano:'Zurdo',puntos:4870,partidosJugados:265,partidosGanados:181,titulos:6},
    {nombre:'Diego',apellido:'Paredes',pais:'AR',foto:'',ranking:18,mejorRanking:14,edad:29,posicion:'Drive',mano:'Diestro',puntos:3320,partidosJugados:210,partidosGanados:128,titulos:2}
  ],
  partido:{categoria:'Masculino',ronda:'Cuartos de final',torneo:'Open de Otoño',sede:'Pista central',logo:''},
  widgets:{ficha:{visible:false,jugador:0,vista:'auto'},vs:{visible:false},acento:'#c8f031'}
};
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const has=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
function completar(e){
  const b=clone(EJEMPLO);e=e||{};
  const j=Array.isArray(e.jugadores)?e.jugadores:b.jugadores;
  return {...e,jugadores:[0,1,2,3].map(i=>({...(j[i]||{})})),partido:{categoria:'',ronda:'',torneo:'',sede:'',logo:'',...(e.partido||{})},
    widgets:{...b.widgets,...(e.widgets||{}),ficha:{...b.widgets.ficha,...((e.widgets||{}).ficha||{})},vs:{...b.widgets.vs,...((e.widgets||{}).vs||{})}}};
}
function bandera(p){
  const c=String(p||'').trim().toUpperCase();if(!/^[A-Z]{2}$/.test(c))return '';
  return `<img class="pw-flag" alt="" src="https://flagcdn.com/w80/${c.toLowerCase()}.png" onerror="this.remove()">`;
}
function avatar(j,cls){
  const ini=esc(((j.nombre||'')[0]||'')+((j.apellido||'')[0]||'')).toUpperCase();
  return `<svg class="pw-avatar ${cls}" viewBox="0 0 240 280" preserveAspectRatio="xMidYMax meet"><circle cx="120" cy="92" r="58" fill="#333b46"/><path d="M14 280c0-76 46-118 106-118s106 42 106 118z" fill="#333b46"/><text x="120" y="108" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="46" fill="#7f8a99">${ini}</text></svg>`;
}
const foto=(j,cls='')=>j.foto?`<img class="pw-photo ${cls}" alt="" src="${esc(j.foto)}">`:avatar(j,cls);
const efectividad=j=>(+j.partidosJugados>0&&has(j.partidosGanados))?(100*j.partidosGanados/j.partidosJugados).toFixed(1).replace('.',',')+'%':'';
function stat(l,v,txt,wide){return has(v)?`<div class="pw-stat${wide?' wide':''}"><div class="pw-lab">${l}</div><div class="pw-val${txt?' txt':''}">${esc(v)}</div></div>`:'';}

function hexRgb(h){const m=String(h||'').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!m)return null;let x=m[1];if(x.length===3)x=x.replace(/./g,c=>c+c);const n=parseInt(x,16);return [n>>16,(n>>8)&255,n&255];}
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mezcla=(c,d,k)=>c.map((v,i)=>Math.round(v+(d[i]-v)*k));
function tintaSobre(c){const L=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return (.2126*L[0]+.7152*L[1]+.0722*L[2])>.32?'#11140a':'#ffffff';}
function aplicarTema(root,est){
  const t=est.tema||{},acc=hexRgb(t.acento)||hexRgb(est.widgets.acento)||[200,240,49],fon=hexRgb(t.fondo)||[13,16,20],tx=hexRgb(t.texto)||[255,255,255],se=hexRgb(t.secundario)||[154,164,178];
  const set=(k,v)=>root.style.setProperty(k,v);
  set('--acc',rgba(acc,1));set('--acc-ink',tintaSobre(acc));
  set('--fondo',rgba(fon,1));set('--fondo2',rgba(mezcla(fon,[255,255,255],.09),1));set('--borde',rgba(mezcla(fon,[255,255,255],.16),1));
  const fd=est.widgets.fondo||{},tipo=['liso','franja','imagen'].includes(fd.tipo)?fd.tipo:'franja';
  root.classList.remove('f-liso','f-franja','f-imagen');root.classList.add('f-'+(tipo==='imagen'&&!fd.imagen?'liso':tipo));
  set('--bg-img',fd.imagen?`url("${String(fd.imagen).replace(/["\\\n]/g,'')}")`:'none');set('--texto',rgba(tx,1));set('--mute',rgba(se,1));
}
const ordenSeq=est=>[0,1,2,3].filter(i=>has(est.jugadores[i].apellido)||has(est.jugadores[i].nombre));

function montar(root){
  root.classList.add('pw-stage');
  root.innerHTML='<div class="pw-ficha"></div><div class="pw-vs"></div>';
  const ficha=root.querySelector('.pw-ficha'),vs=root.querySelector('.pw-vs');
  let est=completar(null),firmaF='',firmaV='',tAuto=null,pag=0,jF=0,seq=null,tCambio=null;
  function pintarFicha(i){
    jF=i;const j=est.jugadores[i],p=est.partido;
    const comp=est.jugadores[i^1];
    const bio=[stat('Ranking',j.ranking),stat('Edad',j.edad),stat('Posición',j.posicion,1),stat('Juega',j.mano,1),stat('Puntos ranking',has(j.puntos)?Number(j.puntos).toLocaleString('es-ES'):'',0,1)].join('');
    const sts=[stat('Mejor ranking',j.mejorRanking),stat('Títulos',j.titulos),stat('Partidos jugados',j.partidosJugados),stat('Partidos ganados',j.partidosGanados),stat('Efectividad',efectividad(j),0,1)].join('');
    ficha.innerHTML=`<div class="pw-card"><div class="pw-head"><div class="pw-bg"></div>${foto(j)}</div><div class="pw-nameband"><div class="pw-country">${bandera(j.pais)}${esc(String(j.pais||'').toUpperCase())}</div><div class="pw-fullname">${esc(j.nombre)} <b>${esc(j.apellido)}</b></div></div>
      <div class="pw-bar"><span class="t">Ficha del jugador</span><small></small></div>
      <div class="pw-body"><div class="pw-grid g0">${bio}</div><div class="pw-grid g1 alt">${sts}</div></div>
      <div class="pw-foot"><span>${has(comp.apellido)?'Pareja de '+esc(comp.apellido):''}</span><span>${esc(p.torneo)}</span></div></div>`;
    pagina(pag);
  }
  function pagina(v){
    pag=v;const g0=ficha.querySelector('.g0'),g1=ficha.querySelector('.g1');if(!g0)return;
    g0.classList.toggle('hid',v!==0);g1.classList.toggle('hid',v!==1);
    ficha.querySelector('.pw-bar small').textContent=v?'Trayectoria':'Perfil';
  }
  const pagFija=()=>{const v=est.widgets.ficha.vista;return v==='stats'?1:v==='bio'?0:null;};
  function pintarVS(){
    const J=est.jugadores,p=est.partido;
    const lado=(k,a,b)=>`<div class="pw-side ${k}"><div class="pw-pics"><div class="pw-bg"></div>${foto(J[a],'p0')}${foto(J[b],'p1')}</div>
      <div class="pw-names">${[J[a],J[b]].map(j=>`<div class="pw-pl"><div class="pw-first">${k==='a'?bandera(j.pais):''}${esc(j.nombre)}${k==='b'?bandera(j.pais):''}</div><div class="pw-last pw-cond">${esc(j.apellido)}</div></div>`).join('')}</div></div>`;
    vs.innerHTML=lado('a',0,1)+`<div class="pw-mid"><div><div class="pw-cat">${esc(p.categoria)}</div><div class="pw-round">${esc(p.ronda)}</div>${(p.categoria||p.ronda)?'<div class="pw-rule"></div>':''}</div>
      <div class="pw-big">V<span>S</span></div><div class="pw-tour">${p.logo?`<img alt="" src="${esc(p.logo)}">`:''}<div>${esc(p.torneo)}</div><small>${esc(p.sede||'')}</small></div></div>`+lado('b',2,3);
  }
  /* Muestra la ficha del jugador i; si ya había otra en pantalla, sale y entra la nueva */
  function verFicha(i,v){
    const firma=JSON.stringify([i,est.jugadores,est.partido.torneo]);
    if(firma===firmaF&&ficha.classList.contains('on')){if(v!==pag)pagina(v);return;}
    clearTimeout(tCambio);
    const entrar=()=>{firmaF=firma;pintarFicha(i);pagina(v);ficha.classList.add('on');};
    if(ficha.classList.contains('on')&&i!==jF){ficha.classList.remove('on');tCambio=setTimeout(entrar,550);}else entrar();
  }
  function ocultarFicha(){clearTimeout(tCambio);ficha.classList.remove('on');}
  function tickSeq(){
    if(!seq)return;
    const t=(Date.now()-seq.t0)/1000,k=Math.floor(t/seq.seg);
    if(k<seq.ord.length){vs.classList.remove('on');const f=pagFija();verFicha(seq.ord[k],f!==null?f:((t%seq.seg)<seq.seg/2?0:1));}
    else{ocultarFicha();vs.classList.add('on');clearInterval(seq.tm);seq.fin=true;}
  }
  function aplicar(e){
    est=completar(e);const w=est.widgets,s=w.secuencia||{};
    aplicarTema(root,est);
    const fV=JSON.stringify([est.jugadores,est.partido]);
    if(fV!==firmaV){firmaV=fV;pintarVS();}
    clearInterval(tAuto);
    if(s.activa){
      if(!seq||seq.id!==s.id){if(seq)clearInterval(seq.tm);seq={id:s.id,seg:Math.max(3,+s.segundos||10),ord:ordenSeq(est),t0:Date.now()};seq.tm=setInterval(tickSeq,250);}
      tickSeq();return;
    }
    if(seq){clearInterval(seq.tm);seq=null;}
    vs.classList.toggle('on',!!w.vs.visible);
    if(w.ficha.visible){
      const i=Math.max(0,Math.min(3,+w.ficha.jugador||0)),f=pagFija();
      verFicha(i,f!==null?f:(i===jF&&ficha.classList.contains('on')?pag:0));
      if(f===null)tAuto=setInterval(()=>pagina(1-pag),8000);
    }else ocultarFicha();
  }
  return {aplicar};
}

/* ---------- Sincronización ---------- */
const enServidor=!window.PW_LOCAL&&/^https?:$/.test(location.protocol)&&!/claudeusercontent|claude\.ai/.test(location.host)&&!new URLSearchParams(location.search).has('local');
let bc=null;try{bc=new BroadcastChannel('marcador-padel');}catch(e){}
const leerLS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch(e){return d;}};
const escribirLS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
function escuchar(cb){
  if(enServidor){
    let es;const abrir=()=>{es=new EventSource('/events');es.onmessage=ev=>{try{cb(JSON.parse(ev.data));}catch(e){}};es.onerror=()=>{es.close();setTimeout(abrir,2000);};};
    abrir();return;
  }
  cb(leerLS(KEY,null)||clone(EJEMPLO));
  if(bc)bc.onmessage=ev=>{const d=ev.data;if(!d)return;if(d.tipo==='estado')cb(d.estado);else if(d.jugadores||d.widgets)cb(d);};
  addEventListener('storage',ev=>{if(ev.key===KEY)cb(leerLS(KEY,null));});
}
/* Clave del panel: compartida con /control (localStorage "marcador-clave"). Si el servidor responde 401, se llama a pedirClave(). */
let pedirClave=null,promClave=null;
const clave=()=>{try{return localStorage.getItem('marcador-clave')||'';}catch(e){return '';}};
async function post(ruta,cuerpo){
  for(let intento=0;intento<2;intento++){
    const r=await fetch(ruta,{method:'POST',headers:{'Content-Type':'application/json','X-Clave':clave()},body:JSON.stringify(cuerpo)});
    if(r.status===401&&pedirClave&&intento===0){const c=await (promClave||(promClave=Promise.resolve(pedirClave()).finally(()=>{promClave=null;})));if(!c)throw new Error('clave');try{localStorage.setItem('marcador-clave',c);}catch(e){}continue;}
    if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||('Error '+r.status));
    return r.json();
  }
  throw new Error('clave');
}
/* parche: { jugadores?, partido?, widgets? } (claves de primer nivel completas) */
async function publicar(parche,estadoCompleto){
  if(enServidor){try{await post('/api/patch',parche);return true;}catch(e){return false;}}
  escribirLS(KEY,estadoCompleto);
  if(bc)bc.postMessage({tipo:'estado',estado:estadoCompleto});
  return true;
}
/* Archivo de fichas guardadas */
const KEYB='marcador-padel-biblioteca';
const biblioteca={
  async listar(){if(enServidor){const r=await fetch('/api/biblioteca',{cache:'no-store'});return r.ok?r.json():[];}return leerLS(KEYB,[]);},
  async guardar(j){
    if(enServidor)return post('/api/biblioteca/guardar',{jugador:j});
    const l=leerLS(KEYB,[]),o={...j,actualizado:Date.now()};if(!o.id)o.id='j'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const i=l.findIndex(x=>x.id===o.id);if(i>=0)l[i]=o;else l.push(o);
    l.sort((a,b)=>String(a.apellido||'').localeCompare(String(b.apellido||''),'es'));
    if(!escribirLS(KEYB,l))throw new Error('No cabe en el navegador');return {lista:l,jugador:o};
  },
  async borrar(id){if(enServidor)return (await post('/api/biblioteca/borrar',{id})).lista;const l=leerLS(KEYB,[]).filter(x=>x.id!==id);escribirLS(KEYB,l);return l;}
};
window.PadelWidgets={montar,escuchar,publicar,completar,EJEMPLO,enServidor,biblioteca,set pedirClave(f){pedirClave=f;}};
})();
