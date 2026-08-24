#!/usr/bin/env node
/* ============ FONDALI IN PNG ============
   Rende i fondali di un gioco in file PNG, per guardarli uno per uno senza browser,
   senza push e senza aspettare Pages.

   Uso, dalla cartella di un gioco:
     node ../dnd-motore/tools/fondali-in-png.mjs                    tutti, in /tmp/fondali
     node ../dnd-motore/tools/fondali-in-png.mjs --solo scauri      uno solo
     node ../dnd-motore/tools/fondali-in-png.mjs --provino          un contatto unico
     node ../dnd-motore/tools/fondali-in-png.mjs --sfondo '#ff00ff' i buchi si vedono
     node ../dnd-motore/tools/fondali-in-png.mjs --zoom 3           ingrandito 3x a pixel interi
     node ../dnd-motore/tools/fondali-in-png.mjs --solo scauri --zona 300,240,220,120 --zoom 4
     node ../dnd-motore/tools/fondali-in-png.mjs --out cartella
     node ../dnd-motore/tools/fondali-in-png.mjs --pulisci          cancella i PNG e basta

   PERCHÉ. Richiesta del committente: utility riusabili per ispezionare la grafica, che
   costino meno e facciano un lavoro migliore. Prima ogni sguardo a un fondale voleva
   commit, push, attesa della ricostruzione di Pages, ricarico degli asset e uno
   screenshot del browser: cinque passi. Adesso è un comando, e i file si buttano
   quando si è finito (`--pulisci`).

   IL FONDO MAGENTA (`--sfondo '#ff00ff'`) è la cosa più utile di tutte: il riquadro
   della scena, in partita, ha fondo NERO, quindi le zone che nessuno dipinge si vedono
   come nero e il cervello le legge come contenuto. Su fondo magenta si vedono come
   errori. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { Tela, scriviPng } from './tela.mjs';

const arg = (nome, def = null) => {
  const i = process.argv.indexOf('--' + nome);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v && !v.startsWith('--')) ? v : true;
};

const radice = resolve(arg('gioco', process.cwd()));
const fuori = resolve(arg('out', '/tmp/fondali'));
const sfondo = arg('sfondo', null);
const solo = arg('solo', null);
/* --notte applica il velo notturno del motore, quello che le scene con `notturno: true`
   ricevono dopo il painter. Serve perche' cinque scene di Pandataria erano notturne su
   fondali di pieno giorno, e per correggerle bisogna GUARDARLE di notte, non di giorno. */
const NOTTE = arg('notte', false) !== false;
/* La dimensione del canvas, che è quella del gioco. NON si usa per ingrandire: i painter
   mescolano frazioni di W/H e misure in pixel assoluti (una macchina è larga 420 px, non
   0,43 W), quindi rendere su un canvas doppio non raddoppia il disegno — lo rimpicciolisce
   a metà dentro un quadro grande. Ci sono cascato subito dopo aver scritto il tool: ho
   chiesto --scala 4 per guardare un dettaglio e mi sono ritrovato la macchina piccolissima
   in mezzo al nulla. Per ingrandire c'è --zoom, che è un ingrandimento a pixel interi
   (nearest neighbour) fatto DOPO il disegno, cioè quello che serve alla pixel art. */
const W = Math.round(Number(arg('largo', 960)));
const H = Math.round(Number(arg('alto', 360)));
const zoom = Math.max(1, Math.round(Number(arg('zoom', 1)) || 1));
/* --zona x,y,w,h ritaglia una finestra in coordinate del gioco, prima dello zoom: serve a
   guardare un oggetto senza rendere e leggere tutta l'inquadratura. */
const zona = (() => {
  const z = arg('zona', null);
  if (!z || z === true) return null;
  const p = String(z).split(',').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isFinite(n))) {
    console.error('❌ --zona vuole x,y,w,h in pixel del gioco, per esempio --zona 300,240,220,120');
    process.exit(1);
  }
  return { x: p[0], y: p[1], w: p[2], h: p[3] };
})();

/* Ritaglio e ingrandimento a pixel interi. Niente interpolazione: un pixel diventa un
   quadrato di zoom×zoom, che è l'unico ingrandimento onesto per un'immagine a pixel. */
function ritagliaEIngrandisci(tela) {
  const z = zona || { x: 0, y: 0, w: tela.width, h: tela.height };
  const x0 = Math.max(0, Math.min(tela.width - 1, z.x));
  const y0 = Math.max(0, Math.min(tela.height - 1, z.y));
  const w = Math.max(1, Math.min(tela.width - x0, z.w));
  const h = Math.max(1, Math.min(tela.height - y0, z.h));
  if (!zona && zoom === 1) return tela;
  const fuoriT = new Tela(w * zoom, h * zoom);
  for (let y = 0; y < h * zoom; y++) {
    const sy = y0 + Math.floor(y / zoom);
    for (let x = 0; x < w * zoom; x++) {
      const sx = x0 + Math.floor(x / zoom);
      const a = (sy * tela.width + sx) * 4, b = (y * fuoriT.width + x) * 4;
      for (let k = 0; k < 4; k++) fuoriT.px[b + k] = tela.px[a + k];
    }
  }
  return fuoriT;
}

if (arg('pulisci')) {
  if (existsSync(fuori)) {
    const f = readdirSync(fuori).filter(n => n.endsWith('.png'));
    for (const n of f) unlinkSync(join(fuori, n));
    console.log(`✔ cancellati ${f.length} PNG da ${fuori}`);
  } else console.log('niente da cancellare');
  process.exit(0);
}

/* Il modulo delle scene, caricato in un contesto con la nostra tela al posto del
   canvas del browser. `document.getElementById` restituisce un finto elemento, così
   anche `Scenes.paint(id, luogo)` funziona se serve. */
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

/* Le macchie scoperte sull'alfa vera del rendering: flood fill, e si tengono solo
   quelle che sullo schermo si vedrebbero. Stessi numeri del validatore. */
function macchieScoperte(tela, sogliaPixel = 700, latoMin = 9, soglia = 0.08) {
  const W = tela.width, H = tela.height;
  const t = tela.trasparenza();
  const visto = new Uint8Array(t.length);
  const pila = new Int32Array(t.length);
  const scoperto = i => t[i] > soglia;
  const fuori = [];
  for (let i = 0; i < t.length; i++) {
    if (!scoperto(i) || visto[i]) continue;
    let n = 0, minX = W, maxX = -1, minY = H, maxY = -1, peggio = 0, cima = 0;
    pila[cima++] = i; visto[i] = 1;
    while (cima) {
      const j = pila[--cima];
      const x = j % W, y = (j - x) / W;
      n++;
      if (t[j] > peggio) peggio = t[j];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && scoperto(j - 1) && !visto[j - 1]) { visto[j - 1] = 1; pila[cima++] = j - 1; }
      if (x < W - 1 && scoperto(j + 1) && !visto[j + 1]) { visto[j + 1] = 1; pila[cima++] = j + 1; }
      if (y > 0 && scoperto(j - W) && !visto[j - W]) { visto[j - W] = 1; pila[cima++] = j - W; }
      if (y < H - 1 && scoperto(j + W) && !visto[j + W]) { visto[j + W] = 1; pila[cima++] = j + W; }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    if (n >= sogliaPixel && Math.min(w, h) >= latoMin) {
      fuori.push({ pixel: n, x: minX, y: minY, w, h, maiDipinto: peggio > 0.98, copertura: 1 - peggio });
    }
  }
  return fuori.sort((a, b) => b.pixel - a.pixel);
}

/* IL NERO PIENO. Un fondale con una macchia di nero perfetto — (0,0,0) opaco — quasi sempre non e
   una scelta: e un colore CALCOLATO male. Il caso che ha insegnato la lezione: blocks() richiama
   shade() sul colore che riceve, e a una chiamata era stato passato shade('#3a3a42', f), cioe gia
   'rgb(58,58,66)'; shade su quella stringa fa parseInt('gb(58,58,66)', 16) = NaN, e NaN>>16&255 = 0.
   Risultato: rgb(0,0,0), un nero PERFETTAMENTE VALIDO che nessun controllo sui colori sballati puo
   intercettare. Erano ottomilatrecento pixel sotto il trono del finale di un gioco, e sembravano
   una voragine voluta. Il nero pieno voluto esiste (la stiva di un relitto a quarantacinque metri,
   dove la torcia entra e non torna indietro), quindi qui e un avviso e non un errore: lo si guarda
   e si decide. */
function neroPieno(tela) {
  const px = tela.px;
  let n = 0;
  for (let i = 0; i < tela.width * tela.height; i++) {
    if (px[i * 4 + 3] > 0.9 && px[i * 4] < 0.5 && px[i * 4 + 1] < 0.5 && px[i * 4 + 2] < 0.5) n++;
  }
  return n;
}

const S = caricaScene();
const nomi = Object.keys(S.painters).filter(n => solo ? n === solo : true);
if (!nomi.length) { console.error(`❌ nessun fondale che si chiami "${solo}"`); process.exit(1); }
mkdirSync(fuori, { recursive: true });

function disegna(nome) {
  const tela = new Tela(W, H);
  const c = tela.getContext();
  if (typeof S.setDepth === 'function') S.setDepth(0);
  else if (typeof S.setEclipse === 'function') S.setEclipse(0);
  S.painters[nome](c, W, H);
  if (NOTTE && typeof S.notte === 'function') S.notte(c, W, H, nome);
  return tela;
}

const fatti = [];
for (const nome of nomi) {
  let tela;
  try { tela = disegna(nome); }
  catch (e) { console.error(`❌ ${nome}: ${e.message}`); continue; }
  const file = join(fuori, `${nome}.png`);
  writeFileSync(file, ritagliaEIngrandisci(tela).png(sfondo));
  /* Quanto di questo fondale il riquadro mostrerebbe nero. Non il conto grezzo dei
     pixel: le MACCHIE. La prima versione contava ogni pixel con alfa bassa e gridava
     al lupo per una cucitura di un pixel sulla battigia — 11.000 pixel sparsi su una
     riga, invisibili, mentre il validatore (che filtra per forma) taceva giustamente.
     Due misure che si contraddicono sono peggio di una misura sola: qui si usa lo
     stesso criterio del validatore, cioè macchie da almeno 700 px e spesse almeno 9. */
  const macchie = macchieScoperte(tela);
  fatti.push({ nome, file, macchie, nero: neroPieno(tela) });
}

if (arg('provino')) {
  /* IL PROVINO: tutti i fondali su una lastra sola, in colonne. Serve a scegliere
     quale guardare da vicino senza aprirne venti. */
  const cols = Number(arg('colonne', 3)) || 3;
  const cw = Math.round(W / 2), ch = Math.round(H / 2);
  const righe = Math.ceil(fatti.length / cols);
  const lastra = new Tela(cols * cw, righe * ch);
  for (let i = 0; i < fatti.length; i++) {
    const t = disegna(fatti[i].nome);
    const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
    const src = t.px;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const sx = Math.round(x * 2), sy = Math.round(y * 2);
      if (sx >= W || sy >= H) continue;
      const a = (sy * W + sx) * 4, b = ((oy + y) * lastra.width + (ox + x)) * 4;
      for (let k = 0; k < 4; k++) lastra.px[b + k] = src[a + k];
    }
  }
  const file = join(fuori, '_provino.png');
  writeFileSync(file, lastra.png(sfondo || '#101014'));
  console.log(`✔ provino: ${file}  (${cols} colonne, ${fatti.length} fondali)`);
}

console.log(`✔ ${fatti.length} fondali in ${fuori}  (disegnati ${W}×${H}`
  + (zona ? `, ritaglio ${zona.w}×${zona.h} da (${zona.x},${zona.y})` : '')
  + (zoom > 1 ? `, ingranditi ${zoom}×` : '')
  + (sfondo ? `, fondo ${sfondo}` : '') + ')');
const sporchi = fatti.filter(f => f.macchie.length);
if (sporchi.length) {
  console.log('\n⚠ fondali con macchie che il riquadro mostrerebbe nere:');
  for (const f of sporchi) {
    console.log(`   ${f.nome}: ` + f.macchie.map(m =>
      `${m.w}×${m.h} a (${m.x},${m.y})` + (m.maiDipinto ? ' mai dipinto' : ` coperto al ${(m.copertura * 100) | 0}%`)).join(', '));
  }
} else {
  console.log('  nessuna macchia scoperta');
}
const neri = fatti.filter(f => f.nero > 500).sort((a, b) => b.nero - a.nero);
if (neri.length) {
  console.log('\n· nero pieno (0,0,0): guardalo, spesso e un colore calcolato male e non una scelta');
  for (const f of neri) console.log(`   ${f.nome}: ${f.nero} px (${(f.nero / (W * H) * 100).toFixed(1)}%)`);
}
for (const f of fatti) console.log(`   ${f.file}`);
