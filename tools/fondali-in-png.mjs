#!/usr/bin/env node
/* ============ FONDALI IN PNG ============
   Rende i fondali di un gioco in file PNG, per guardarli uno per uno senza browser,
   senza push e senza aspettare Pages.

   Uso, dalla cartella di un gioco:
     node ../dnd-motore/tools/fondali-in-png.mjs                    tutti, in /tmp/fondali
     node ../dnd-motore/tools/fondali-in-png.mjs --solo scauri      uno solo
     node ../dnd-motore/tools/fondali-in-png.mjs --provino          un contatto unico
     node ../dnd-motore/tools/fondali-in-png.mjs --sfondo '#ff00ff' i buchi si vedono
     node ../dnd-motore/tools/fondali-in-png.mjs --scala 2          il doppio, per i dettagli
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
const scala = Number(arg('scala', 1)) || 1;
const sfondo = arg('sfondo', null);
const solo = arg('solo', null);
const W = Math.round(Number(arg('largo', 960)) * scala);
const H = Math.round(Number(arg('alto', 360)) * scala);

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
  return tela;
}

const fatti = [];
for (const nome of nomi) {
  let tela;
  try { tela = disegna(nome); }
  catch (e) { console.error(`❌ ${nome}: ${e.message}`); continue; }
  const file = join(fuori, `${nome}.png`);
  writeFileSync(file, tela.png(sfondo));
  /* Quanto di questo fondale il riquadro mostrerebbe nero. Non il conto grezzo dei
     pixel: le MACCHIE. La prima versione contava ogni pixel con alfa bassa e gridava
     al lupo per una cucitura di un pixel sulla battigia — 11.000 pixel sparsi su una
     riga, invisibili, mentre il validatore (che filtra per forma) taceva giustamente.
     Due misure che si contraddicono sono peggio di una misura sola: qui si usa lo
     stesso criterio del validatore, cioè macchie da almeno 700 px e spesse almeno 9. */
  const macchie = macchieScoperte(tela);
  fatti.push({ nome, file, macchie });
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

console.log(`✔ ${fatti.length} fondali in ${fuori}  (${W}×${H}${sfondo ? ', fondo ' + sfondo : ''})`);
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
for (const f of fatti) console.log(`   ${f.file}`);
