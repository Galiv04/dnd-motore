#!/usr/bin/env node
/* ============ C'È UN SOGGETTO? ============
   Misura, fondale per fondale, le tre cose che le lezioni 58-62 chiedono a occhio e
   che a occhio non si riescono a controllare su venti quadri:

     1. IL SOGGETTO — quanto è grande la cosa più grande che ha un contorno.
        La regola dice «un fondale ha UN soggetto, grande almeno un terzo
        dell'inquadratura». Un terzo del lato = un nono dell'area: 11%.
     2. GLI ELEMENTI DI CONTESTO — quanti oggetti stanno sopra i cento pixel di
        lato. La regola ne chiede due o tre: sotto i sessanta un oggetto non dice
        cosa è, dice solo che c'è.
     3. IL BUIO E IL PIATTO — che frazione del quadro il giocatore vede come nero,
        e che frazione è tutta dello stesso colore. Un fondale fatto di due bande
        piatte non è un'inquadratura, è uno sfondo di cortesia.

   Uso, dalla cartella di un gioco:
     node ../dnd-motore/tools/soggetto.mjs                 tutti i fondali, in classifica
     node ../dnd-motore/tools/soggetto.mjs --solo cella    uno, con i suoi riquadri
     node ../dnd-motore/tools/soggetto.mjs --notte         col velo notturno, se c'è
     node ../dnd-motore/tools/soggetto.mjs --riquadri      scrive i PNG coi riquadri

   COME TROVA GLI OGGETTI. Non per colore: per CONTORNO. Un muro dipinto con
   blocks() ha mille gradini di luminanza, ma piccoli (varianza 0.08 = otto punti);
   un oggetto vero ha un bordo, e un bordo è un salto di venticinque punti o più.
   Si prendono quei salti, si dilatano di sei pixel per ricucire i tratteggi, e si
   contano le macchie connesse: ognuna è un oggetto, il suo riquadro è la sua taglia.

   PERCHÉ ESISTE. Il provino di un gioco intero dice «sono tutti grigi con una cosa
   piccola in mezzo» in un colpo d'occhio, e poi non si sa da quale cominciare.
   Questi numeri dicono da quale: quello col soggetto più piccolo. */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import vm from 'vm';
import { Tela, scriviPng } from './tela.mjs';

const arg = (nome, def = null) => {
  const i = process.argv.indexOf('--' + nome);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v && !v.startsWith('--')) ? v : true;
};

const radice = resolve(arg('gioco', process.cwd()));
const SOLO = arg('solo', null);
const NOTTE = arg('notte', false) !== false;
const RIQUADRI = arg('riquadri', false) !== false;
const FUORI = String(arg('out', '/tmp/soggetti'));
const W = 960, H = 360;

/* --- soglie, e ognuna ha la sua ragione ---------------------------------- */
const SALTO = 32;        // un bordo vero: sopra la varianza di blocks() (8-14 punti)
const CUCITURA = 2;      // dilatazione: ricuce i contorni tratteggiati del pixel art
const MIN_MACCHIA = 90;  // sotto, è rumore di texture
const LATO_OGGETTO = 100;   // «sotto i cento pixel è un elemento di contesto»
const LATO_MINIMO = 60;     // «sotto i sessanta non dice cosa è»
const AREA_SOGGETTO = 0.11; // un terzo del lato = un nono dell'area
/* MA L'AREA DA SOLA SBAGLIA sui soggetti alti e stretti. Il telescopio della
   soffitta del Relais e' 136x175: 175 pixel su 360 sono metà dell'altezza del
   quadro, cioe' la regola «grande almeno un terzo dell'inquadratura» e'
   soddisfatta con abbondanza — ma l'area fa il 6,9%, sotto l'11%. La regola,
   letta come la si dice, e' LINEARE: un terzo dell'inquadratura. Quindi passa
   chi soddisfa l'area OPPURE chi arriva a un terzo di un lato. */
const LATO_SOGGETTO = 1 / 3;
const NERO = 42;            // sotto questa luminanza il giocatore vede nero

/* LE DEROGHE, e ognuna scritta con la sua ragione (lezione 82). Ci sono quadri che
   DEVONO essere neri — la schermata del titolo, una terrazza a mezzanotte e quaranta
   dove il nero del mare è il soggetto — e quadri che non hanno un oggetto perché
   sono un paesaggio. Vanno dichiarati in `docs/FONDALI.json` del gioco:

     { "terrazza": { "nero": "mezzanotte e quaranta: il mare deve restare una lastra
                              nera, e il primo piano è illuminato dalla lampada del B&B" } }

   Le chiavi ammesse sono "soggetto", "oggetti", "nero", "piatto". Una deroga senza
   ragione scritta non viene accettata: il file la deve spiegare, o non serve a niente. */
let DEROGHE = {};
try {
  const p = join(radice, 'docs/FONDALI.json');
  if (existsSync(p)) DEROGHE = JSON.parse(readFileSync(p, 'utf8'));
} catch (e) { console.error(`⚠ docs/FONDALI.json illeggibile: ${e.message}`); }
const deroga = (nome, che) => {
  const d = DEROGHE[nome] && DEROGHE[nome][che];
  return (typeof d === 'string' && d.trim().length > 12) ? d.trim() : null;
};

/* LA SOGLIA DEL NERO NON È UNIVERSALE. Il Relais si svolge tutto in una notte: su
   ventun fondali, diciotto stavano sopra il 45% di pixel scuri, e non erano
   diciotto difetti — era un gioco che sta di notte. Uno strumento che segna
   diciotto righe su ventuno non viene più letto. Quindi la soglia si dichiara nel
   gioco, con la sua ragione, in `docs/FONDALI.json`:

     "_soglie": { "nero": 0.62, "perche": "tutta la storia sta in una notte" }

   Restano fuori i quadri che sono neri E VUOTI: la soglia del nero si può alzare,
   quella del soggetto no. */
const SOGLIE = DEROGHE._soglie || {};
const SOGLIA_NERO = typeof SOGLIE.nero === 'number' && SOGLIE.nero > 0.45 && String(SOGLIE.perche || '').length > 12
  ? SOGLIE.nero : 0.45;

function caricaScene() {
  const ctx = { console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  let src = '';
  for (const f of ['js/sprites.js', 'js/scenes.js']) {
    const p = join(radice, f);
    if (existsSync(p)) src += readFileSync(p, 'utf8') + '\n;\n';
  }
  if (!src) { console.error(`❌ non trovo js/scenes.js in ${radice}`); process.exit(1); }
  vm.runInContext(src + ';globalThis.__S = Scenes;', ctx);
  return ctx.__S;
}

const lumDi = (rgba, i) => (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;

/* Le macchie di CONTORNO: dove la luminanza salta, dilatato e connesso. */
function oggetti(lum) {
  const bordo = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = x < W - 1 ? Math.abs(lum[i] - lum[i + 1]) : 0;
      const dy = y < H - 1 ? Math.abs(lum[i] - lum[i + W]) : 0;
      if (Math.max(dx, dy) >= SALTO) bordo[i] = 1;
    }
  }
  // dilatazione separabile: ricuce i contorni interrotti del pixel art
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!bordo[y * W + x]) continue;
    for (let k = -CUCITURA; k <= CUCITURA; k++) { const xx = x + k; if (xx >= 0 && xx < W) dil[y * W + xx] = 1; }
  }
  const dd = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dil[y * W + x]) continue;
    for (let k = -CUCITURA; k <= CUCITURA; k++) { const yy = y + k; if (yy >= 0 && yy < H) dd[yy * W + x] = 1; }
  }
  const visto = new Uint8Array(W * H);
  const pila = new Int32Array(W * H);
  const out = [];
  for (let i = 0; i < W * H; i++) {
    if (!dd[i] || visto[i]) continue;
    let n = 0, minX = W, maxX = -1, minY = H, maxY = -1, cima = 0;
    pila[cima++] = i; visto[i] = 1;
    while (cima) {
      const j = pila[--cima];
      const x = j % W, y = (j - x) / W;
      n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && dd[j - 1] && !visto[j - 1]) { visto[j - 1] = 1; pila[cima++] = j - 1; }
      if (x < W - 1 && dd[j + 1] && !visto[j + 1]) { visto[j + 1] = 1; pila[cima++] = j + 1; }
      if (y > 0 && dd[j - W] && !visto[j - W]) { visto[j - W] = 1; pila[cima++] = j - W; }
      if (y < H - 1 && dd[j + W] && !visto[j + W]) { visto[j + W] = 1; pila[cima++] = j + W; }
    }
    if (n < MIN_MACCHIA) continue;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    out.push({ n, x: minX, y: minY, w, h, area: (w * h) / (W * H) });
  }
  /* E POI SI UNISCONO I RIQUADRI CHE SI TOCCANO. Un letto disegnato in cinque
     toni — testiera di noce, lino del piano, fascia del risvolto, fianco,
     pediera — ha cinque contorni interni e il misuratore lo contava come cinque
     oggetti, quindi «nessun soggetto». Ma un oggetto disegnato in cinque toni è
     un oggetto: due macchie i cui riquadri si toccano (a meno di otto pixel,
     che è la cucitura del pixel art) sono lo stesso oggetto. Si fondono a
     ripetizione, finché non cambia più niente. */
  const crude = out.map(o => ({ ...o }));
  const GIUNZIONE = 8;
  let cambiato = true;
  while (cambiato) {
    cambiato = false;
    for (let a = 0; a < out.length && !cambiato; a++) {
      for (let b = a + 1; b < out.length; b++) {
        const A = out[a], B = out[b];
        const tocca = A.x - GIUNZIONE < B.x + B.w && B.x - GIUNZIONE < A.x + A.w
                   && A.y - GIUNZIONE < B.y + B.h && B.y - GIUNZIONE < A.y + A.h;
        if (!tocca) continue;
        const nx = Math.min(A.x, B.x), ny = Math.min(A.y, B.y);
        const nw = Math.max(A.x + A.w, B.x + B.w) - nx, nh = Math.max(A.y + A.h, B.y + B.h) - ny;
        out[a] = { n: A.n + B.n, x: nx, y: ny, w: nw, h: nh, area: (nw * nh) / (W * H) };
        out.splice(b, 1);
        cambiato = true;
        break;
      }
    }
  }
  return { fusi: out.sort((a, b) => b.area - a.area), crude: crude.sort((a, b) => b.area - a.area) };
}

function misura(S, nome) {
  const tela = new Tela(W, H);
  const c = tela.getContext('2d');
  S.painters[nome](c, W, H);
  if (NOTTE && typeof S.notte === 'function') S.notte(c, W, H, nome);
  const rgba = tela.rgba('#000000');
  const lum = new Float32Array(W * H);
  let nero = 0;
  const bucket = new Map();
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const l = lumDi(rgba, p);
    lum[i] = l;
    if (l < NERO) nero++;
    // colore quantizzato a 16 livelli per canale: «quanto del quadro è un colore solo»
    const k = ((rgba[p] >> 4) << 8) | ((rgba[p + 1] >> 4) << 4) | (rgba[p + 2] >> 4);
    bucket.set(k, (bucket.get(k) || 0) + 1);
  }
  let dominante = 0;
  for (const v of bucket.values()) if (v > dominante) dominante = v;
  /* Due liste, e ognuna serve a una domanda diversa. I riquadri FUSI dicono
     quanto e' grande il soggetto (un letto in cinque toni e' un letto). Quelli
     CRUDI dicono quante cose distinte ci sono sopra i cento pixel: se si
     contassero sui fusi, un mobile che ne occlude un altro ne farebbe uno. */
  const { fusi, crude } = oggetti(lum);
  const og = fusi;
  const soggetto = og[0] || { area: 0, w: 0, h: 0, x: 0, y: 0 };
  return {
    nome,
    soggetto,
    oggetti: og,
    haSoggetto: soggetto.area >= AREA_SOGGETTO
      || soggetto.w / W >= LATO_SOGGETTO || soggetto.h / H >= LATO_SOGGETTO,
    grossi: crude.filter(o => Math.max(o.w, o.h) >= LATO_OGGETTO).length,
    minuscoli: crude.filter(o => Math.max(o.w, o.h) < LATO_MINIMO).length,
    nero: nero / (W * H),
    piatto: dominante / (W * H),
  };
}

/* --- il referto ---------------------------------------------------------- */
const S = caricaScene();
if (!S || !S.painters) { console.error('❌ Scenes.painters non trovato'); process.exit(1); }
const nomi = SOLO && SOLO !== true ? [String(SOLO)] : Object.keys(S.painters);
for (const n of nomi) if (!S.painters[n]) { console.error(`❌ fondale sconosciuto: ${n}`); process.exit(1); }

const ref = nomi.map(n => misura(S, n));

console.log(`\n  C'È UN SOGGETTO?  ${nomi.length} fondali di ${radice.split('/').pop()}${NOTTE ? '  (di notte)' : ''}`);
if (SOGLIA_NERO !== 0.45) console.log(`  soglia del nero al ${(SOGLIA_NERO * 100) | 0}% — ${SOGLIE.perche}`);
console.log('');
console.log("  (soggetto: passa all'11% dell'area OPPURE a un terzo di un lato)");
console.log('  fondale               soggetto     riquadro    >100px  <60px   nero   piatto');
console.log('  ' + '─'.repeat(78));
const ordinati = [...ref].sort((a, b) => a.soggetto.area - b.soggetto.area);
const segno = (m, che, male) => male ? (deroga(m.nome, che) ? '~' : '✗') : ' ';
for (const m of ordinati) {
  const pct = (m.soggetto.area * 100).toFixed(1).padStart(5);
  const rq = `${m.soggetto.w}×${m.soggetto.h}`.padStart(9);
  const seg = segno(m, 'soggetto', !m.haSoggetto);
  const segN = segno(m, 'nero', m.nero > SOGLIA_NERO);
  const segP = segno(m, 'piatto', m.piatto > 0.40);
  console.log(`  ${m.nome.padEnd(20)} ${pct}%${seg}  ${rq}    ${String(m.grossi).padStart(4)}   ${String(m.minuscoli).padStart(4)}  ${(m.nero * 100).toFixed(0).padStart(4)}%${segN} ${(m.piatto * 100).toFixed(0).padStart(4)}%${segP}`);
}

const senza = ordinati.filter(m => !m.haSoggetto && !deroga(m.nome, 'soggetto'));
const buii = ref.filter(m => m.nero > SOGLIA_NERO && !deroga(m.nome, 'nero'));
const piatti = ref.filter(m => m.piatto > 0.40 && !deroga(m.nome, 'piatto'));
const poveri = ref.filter(m => m.grossi < 2 && !deroga(m.nome, 'oggetti'));
const derogati = ref.filter(m => DEROGHE[m.nome]);
if (derogati.length) {
  console.log(`\n  ~ ${derogati.length} deroghe dichiarate in docs/FONDALI.json:`);
  for (const m of derogati) for (const [che, perche] of Object.entries(DEROGHE[m.nome])) {
    console.log(`     ${m.nome} · ${che}: ${perche}`);
  }
}

console.log('');
if (senza.length) console.log(`  ✗ ${senza.length} fondali senza un soggetto sopra l'11% dell'area: ${senza.slice(0, 6).map(m => m.nome).join(', ')}${senza.length > 6 ? ', …' : ''}`);
if (poveri.length) console.log(`  ✗ ${poveri.length} fondali con meno di due oggetti sopra i cento pixel: ${poveri.slice(0, 6).map(m => m.nome).join(', ')}${poveri.length > 6 ? ', …' : ''}`);
if (buii.length) console.log(`  ✗ ${buii.length} fondali che il giocatore vede neri oltre la soglia: ${buii.map(m => m.nome).join(', ')}`);
if (piatti.length) console.log(`  ✗ ${piatti.length} fondali con più del 40% in un colore solo: ${piatti.map(m => m.nome).join(', ')}`);
if (!senza.length && !poveri.length && !buii.length && !piatti.length) console.log('  ✔ tutti i fondali hanno un soggetto, due oggetti veri e nessuna parete vuota');

if (RIQUADRI) {
  mkdirSync(FUORI, { recursive: true });
  for (const m of ref) {
    const tela = new Tela(W, H);
    const c = tela.getContext('2d');
    S.painters[m.nome](c, W, H);
    if (NOTTE && typeof S.notte === 'function') S.notte(c, W, H, m.nome);
    // il soggetto in verde, gli altri oggetti sopra i cento pixel in giallo
    m.oggetti.slice(0, 8).forEach((o, k) => {
      c.fillStyle = k === 0 ? 'rgba(80,255,120,.85)' : (Math.max(o.w, o.h) >= LATO_OGGETTO ? 'rgba(255,230,80,.7)' : 'rgba(255,90,90,.55)');
      c.fillRect(o.x, o.y, o.w, 2); c.fillRect(o.x, o.y + o.h - 2, o.w, 2);
      c.fillRect(o.x, o.y, 2, o.h); c.fillRect(o.x + o.w - 2, o.y, 2, o.h);
    });
    writeFileSync(join(FUORI, m.nome + '.png'), scriviPng(W, H, tela.rgba('#101014')));
  }
  console.log(`\n  riquadri in ${FUORI}  (verde = il soggetto, giallo = sopra i 100 px, rosso = sotto i 60)`);
}
console.log('');
process.exit(senza.length || buii.length ? 1 : 0);
