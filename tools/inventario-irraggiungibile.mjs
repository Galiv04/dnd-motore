#!/usr/bin/env node
/* ============================================================================
   INVENTARIO DI QUELLO CHE NESSUNO PUÒ INCONTRARE
   Tre domande a un gioco della serie:
     1. quale requires.flag non è impostato da nessuna scena NÉ da nessun modulo?
     2. quale oggetto di ITEMS non è dato da nessuna scena, ricetta, minigioco o
        inventario iniziale?
     3. quale voce di BESTIARY non compare in nessun combat.enemies?

   Uso:  node tools/inventario-irraggiungibile.mjs ../nome-del-gioco

   La regola per il risultato: o si rende raggiungibile, o si toglie. Non tutto va
   reso raggiungibile — vedi il POLPO di Pandataria nella lezione 46 — ma niente
   resta a metà: se si toglie, si scrive accanto perché.

   ATTENZIONE ai falsi negativi, che sono il vero rischio di questo strumento:
   i flag possono essere impostati da js/misteri.js (premi dei misteri),
   js/crafting.js (ricette) o dal motore; gli oggetti dall'inventario iniziale
   (spesso dentro un ternario) e dalla config dei minigiochi (`oggetto`, `extra`).
   Tutte queste strade sono guardate qui sotto: se se ne aggiunge una nuova al
   motore, va aggiunta anche qui, o lo strumento comincia a mentire.
   ========================================================================== */
import { readFileSync, existsSync } from 'fs';
import vm from 'vm';

const gioco = process.argv[2];
if (!gioco) { console.error('uso: node tools/inventario-irraggiungibile.mjs ../nome-del-gioco'); process.exit(2); }

const leggi = (f) => { try { return readFileSync(`${gioco}/${f}`, 'utf8'); } catch { return ''; } };
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(leggi('js/characters.js') + ';globalThis.__B=(typeof BESTIARY!=="undefined")?BESTIARY:{};', ctx);
vm.runInContext(leggi('js/campaign.js')
  + ';globalThis.__C=CAMPAIGN;globalThis.__I=ITEMS;'
  + 'globalThis.__M=(typeof MISTERI!=="undefined")?MISTERI:null;'
  + 'globalThis.__R=(typeof RECIPES!=="undefined")?RECIPES:null;', ctx);
const C = ctx.__C, I = ctx.__I, B = ctx.__B, M = ctx.__M, R = ctx.__R;
const MODULI = ['js/misteri.js', 'js/crafting.js', 'js/engine.js', 'js/combat.js', 'js/minigames.js'];

/* ---- 1. flag richiesti e mai impostati ---- */
const flagImpostati = new Set();
for (const s of Object.values(C)) {
  for (const f of Object.keys(s.sets || {})) flagImpostati.add(f);
  /* E ANCHE I FLAG CHE IMPOSTANO I MINIGIOCHI. `minigame.config.extraFlag` è il
     flag che l'apnea imposta se il giocatore scende SOTTO la profondità che gli
     serviva, per vedere quella cosa che non gli serve — ed è il modo in cui
     Pandataria apre la scena della muta sul fondo. Non conoscendolo, lo strumento
     dichiarava irraggiungibile una scena che si raggiunge benissimo: un falso
     positivo in uno strumento costa la fiducia in tutti i suoi veri positivi
     (lezione 87). */
  if (s.minigame && s.minigame.config && s.minigame.config.extraFlag) flagImpostati.add(s.minigame.config.extraFlag);
  for (const c of (s.choices || [])) {
    for (const f of Object.keys(c.sets || {})) flagImpostati.add(f);
    for (const f of Object.keys(c.sacrificeSets || {})) flagImpostati.add(f);
    if (c.minigame && c.minigame.config && c.minigame.config.extraFlag) flagImpostati.add(c.minigame.config.extraFlag);
  }
}
if (R) for (const r of R) if (r.flag) flagImpostati.add(r.flag);
if (M) for (const m of M) if (m.premio && m.premio.flag) flagImpostati.add(m.premio.flag);
for (const f of MODULI) for (const m of leggi(f).matchAll(/G\.flags\[['"]([a-z0-9_]+)['"]\]\s*=/gi)) flagImpostati.add(m[1]);

const flagMorti = new Map();
for (const [id, s] of Object.entries(C)) for (const c of (s.choices || [])) {
  const r = c.requires; if (!r) continue;
  for (const f of [r.flag, r.flag2, ...(r.flagAny || [])]) {
    if (!f || flagImpostati.has(f)) continue;
    if (!flagMorti.has(f)) flagMorti.set(f, []);
    flagMorti.get(f).push(id);
  }
}

/* ---- 2. oggetti mai ottenibili ---- */
const oggettiDati = new Set();
for (const s of Object.values(C)) {
  for (const k of ['item', 'item2']) if (s[k]) oggettiDati.add(s[k]);
  if (s.onEnterOnce && s.onEnterOnce.itemEach) oggettiDati.add(s.onEnterOnce.itemEach);
  if (s.minigame && s.minigame.config) for (const k of ['oggetto', 'extra']) {
    if (s.minigame.config[k]) oggettiDati.add(s.minigame.config[k]);
  }
  for (const c of (s.choices || [])) for (const k of ['item', 'item2']) if (c[k]) oggettiDati.add(c[k]);
}
if (R) for (const r of R) { if (r.out) oggettiDati.add(r.out); for (const i of (r.in || [])) oggettiDati.add(i); }
/* l'inventario iniziale sta nel motore, spesso dentro un ternario: prendo tutte le
   stringhe quotate della riga, senza provare a interpretare la condizione */
for (const m of leggi('js/engine.js').matchAll(/inventory:\s*([^\n]*)/g)) {
  for (const q of m[1].matchAll(/'([a-z0-9_]+)'/g)) oggettiDati.add(q[1]);
}
const oggettiOrfani = Object.keys(I).filter(k => !oggettiDati.has(k));

/* ---- 3. nemici mai incontrati ---- */
const nemiciUsati = new Set();
for (const s of Object.values(C)) if (s.combat) for (const e of (s.combat.enemies || [])) nemiciUsati.add(e);
for (const m of leggi('js/combat.js').matchAll(/BESTIARY\[['"]([a-z0-9_]+)['"]\]/g)) nemiciUsati.add(m[1]);
const nemiciMai = Object.keys(B).filter(k => !nemiciUsati.has(k));

/* ---- esito ---- */
console.log(`\n${gioco}`);
if (flagMorti.size) for (const [f, scene] of flagMorti) {
  console.log(`  ⚠ flag "${f}" mai impostato → scelte irraggiungibili in: ${scene.join(', ')}`);
} else console.log('  ✔ ogni scelta condizionata può comparire');
console.log(oggettiOrfani.length
  ? `  ⚠ oggetti mai ottenibili: ${oggettiOrfani.join(', ')}`
  : '  ✔ ogni oggetto è ottenibile da qualche parte');
console.log(nemiciMai.length
  ? `  ⚠ nemici mai incontrati: ${nemiciMai.join(', ')}`
  : '  ✔ ogni nemico del bestiario compare in almeno uno scontro');

process.exit((flagMorti.size || oggettiOrfani.length || nemiciMai.length) ? 1 : 0);
