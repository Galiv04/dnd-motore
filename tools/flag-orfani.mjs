#!/usr/bin/env node
/* ============ FLAG ORFANI — le promesse che il gioco non mantiene ============

   A COSA SERVE. Un flag è una cosa che il gioco RICORDA. Se la imposta e poi non la
   legge mai, il gioco ha registrato che il giocatore SA una cosa — o che l'ha fatta, o
   che gliel'hanno detta — e poi non gliela fa mai usare né dire. È la stessa regola
   delle scelte vuote, un piano sotto: «mai flag invisibili, ogni promessa narrativa ha
   la sua scena».
   E il contrario è peggio: un flag LETTO da una scelta e impostato da nessuno è una
   scelta che non può comparire mai. Il testo esiste, il giocatore non lo vedrà.

   COME LEGGE UN FLAG QUESTO MOTORE — sono tutti i modi, e ci sono tutti:
     requires: { flag, flag2, notFlag }   sulle scelte
     CRONACA[].flag                        le righe di mondo dell'epilogo
     IMPRESE[].flag                        gli achievement di fine partita
     DIARY_FLAGS[][0]                      le note del Quaderno
     MISTERI[].indizi[].flag               gli indizi (contati da misteri.js)
     MISTERI[].premio.flag                 il premio, impostato da misteri.js
     CHECKPOINT_FLAGS[]                    i punti di ripartenza
     G.flags.nome / G.flags['nome']         nel codice di js/*.js (combat, engine, ...)
     ${...G.flags.nome...}                 dentro il testo delle scene

   E COME LO SCRIVE:
     sets: { ... }                          su scene e su scelte
     minigame.config.extraFlag              i minigiochi
     sacrificeSets                          chi è rimasto indietro
     RECIPES[].flag                         il crafting
     famiglie generate dal motore           <eroe>_in_squadra, rimasto_*, sacrificio_*,
                                            tornato_*  → non sono orfane per definizione

   USO
     node ../dnd-motore/tools/flag-orfani.mjs            # dal repo del gioco
     node ../dnd-motore/tools/flag-orfani.mjs --dove     # e dove viene impostato ognuno
     node ../dnd-motore/tools/flag-orfani.mjs --json     # per gli altri strumenti

   Torna 0 sempre: è una lente, non un cancello. Il cancello è il validatore. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const arg = new Set(process.argv.slice(2));
const radice = process.cwd();
const DOVE = arg.has('--dove');
const JSON_OUT = arg.has('--json');

/* ---------------------------------------------------------------- i dati veri
   Si carica il gioco per davvero invece di leggerlo con le regex: una regex su
   `sets: { a: true, b: true }` sbaglia appena qualcuno scrive su due righe, e in
   settemila righe di draft qualcuno lo scrive sempre. */
const finto = {
  console, Math, JSON, Object, Array, String, Number, Boolean, Date, RegExp,
  document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} }, appendChild(){}, addEventListener(){} }), body: { appendChild(){}, classList: { add(){}, remove(){} } }, querySelectorAll: () => [], querySelector: () => null, addEventListener(){} },
  window: { addEventListener(){}, matchMedia: () => ({ matches: false, addEventListener(){} }) },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
  AudioContext: function () { return { createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency: { value: 0, setValueAtTime(){} }, type: '' }), createGain: () => ({ connect(){}, gain: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} } }), destination: {}, currentTime: 0, close(){} }; },
};
finto.globalThis = finto;
finto.self = finto;
const ctx = vm.createContext(finto);

const sorgenti = readdirSync(join(radice, 'js')).filter(f => f.endsWith('.js')).sort();
const testo = {};
for (const f of sorgenti) testo[f] = readFileSync(join(radice, 'js', f), 'utf8');

// I file di soli dati si caricano; quelli che toccano il DOM al volo possono esplodere e
// non importa: di loro serve il TESTO, non gli oggetti.
for (const f of ['campaign.js', 'epilogues.js', ...sorgenti]) {
  if (!testo[f]) continue;
  try { vm.runInContext(testo[f], ctx); } catch { /* di questo basta il testo */ }
}
const dato = n => { try { return vm.runInContext(`typeof ${n} !== 'undefined' ? ${n} : null`, ctx); } catch { return null; } };
const CAMPAIGN = dato('CAMPAIGN');
if (!CAMPAIGN) { console.error('non trovo CAMPAIGN: questo tool si lancia dalla radice del repo di un gioco'); process.exit(1); }

/* ------------------------------------------------------------- chi SCRIVE cosa */
const scritti = new Map();                       // flag → [posti]
const segna = (f, dove) => {
  if (typeof f !== 'string' || !f) return;
  if (!scritti.has(f)) scritti.set(f, []);
  scritti.get(f).push(dove);
};
const daSets = (o, dove) => {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) segna(k, dove);
};
for (const [id, sc] of Object.entries(CAMPAIGN)) {
  daSets(sc.sets, id);
  if (sc.minigame?.config?.extraFlag) segna(sc.minigame.config.extraFlag, id + ' (minigioco)');
  for (const c of sc.choices || []) {
    daSets(c.sets, id + ' → scelta');
    if (c.minigame?.config?.extraFlag) segna(c.minigame.config.extraFlag, id + ' (minigioco)');
    if (typeof c.sacrificeSets === 'string') segna(c.sacrificeSets, id + ' → sacrificio');
  }
}
for (const r of dato('RECIPES') || []) if (r.flag) segna(r.flag, 'ricetta ' + (r.id || r.name || '?'));
/* E gli assegnamenti fatti dal CODICE. Senza questi, ogni contatore che il motore tiene
   da se' — l'attenzione del Coro, la reputazione, «siete tornati dal checkpoint» — usciva
   nell'elenco dei letti-e-mai-scritti, cioe' fra i bug. Sette falsi allarmi su sette: e
   un elenco di bug tutto falso non lo guarda piu' nessuno, compreso il giorno che dentro
   ci finisce un bug vero. */
for (const [f, src] of Object.entries(testo)) {
  for (const m of src.matchAll(/flags\s*\.\s*([A-Za-z_$][\w$]*)\s*(?:=[^=]|\+\+|--|\+=)/g)) segna(m[1], 'js/' + f);
  for (const m of src.matchAll(/flags\s*\[\s*['"]([^'"]+)['"]\s*\]\s*(?:=[^=]|\+\+|--|\+=)/g)) segna(m[1], 'js/' + f);
  /* E l'INIZIALIZZAZIONE, che non e' un assegnamento e sfuggiva: `flags: solo ? { solo:
     true } : {}` in newGame(). Il flag `solo` della Corona di Mezzanotte usciva fra i bug —
     letto dalla CRONACA e scritto da nessuno — e invece era scritto alla riga quattro del
     motore. Un falso allarme in uno strumento nuovo e' la cosa che lo fa spegnere. */
  for (const m of src.matchAll(/flags\s*:\s*[^;\n]{0,240}/g)) {
    for (const k of m[0].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:true|false|0|1)\b/g)) segna(k[1], 'js/' + f + ' (init)');
  }
}
for (const m of dato('MISTERI') || []) if (m.premio?.flag) segna(m.premio.flag, 'premio del mistero ' + (m.id || m.titolo || '?'));

/* Le famiglie che genera il motore: non sono orfane per definizione, perché chi le
   scrive è codice e chi le legge è codice. */
const DEL_MOTORE = /^(rimasto_|sacrificio_|tornato_)|_in_squadra$/;

/* ------------------------------------------------------------- chi LEGGE cosa */
const letti = new Map();
const leggi = (f, dove) => {
  if (typeof f !== 'string' || !f) return;
  if (!letti.has(f)) letti.set(f, []);
  letti.get(f).push(dove);
};
for (const [id, sc] of Object.entries(CAMPAIGN)) {
  for (const r of [sc.requires, ...(sc.choices || []).map(c => c.requires)]) {
    if (!r) continue;
    for (const k of ['flag', 'flag2', 'notFlag']) if (r[k]) leggi(r[k], id);
  }
}
for (const c of dato('CRONACA') || []) if (c.flag) leggi(c.flag, 'CRONACA');
for (const i of dato('IMPRESE') || []) if (i.flag) leggi(i.flag, 'IMPRESE');
for (const d of dato('DIARY_FLAGS') || []) if (Array.isArray(d) && d[0]) leggi(d[0], 'Quaderno');
for (const m of dato('MISTERI') || []) {
  for (const i of m.indizi || []) if (i.flag) leggi(i.flag, 'indizio del mistero ' + (m.id || '?'));
  if (m.premio?.flag) leggi(m.premio.flag, 'premio del mistero ' + (m.id || '?'));
}
for (const f of dato('CHECKPOINT_FLAGS') || []) leggi(f, 'CHECKPOINT_FLAGS');
// e le letture nel codice: G.flags.nome, G.flags['nome'], flags.nome
for (const [f, src] of Object.entries(testo)) {
  for (const m of src.matchAll(/flags\s*\.\s*([A-Za-z_$][\w$]*)/g)) leggi(m[1], 'js/' + f);
  for (const m of src.matchAll(/flags\s*\[\s*['"]([^'"]+)['"]\s*\]/g)) leggi(m[1], 'js/' + f);
}

/* ------------------------------------------------------------------ il verdetto */
/* LA DISTINZIONE CHE CONTA. Un flag orfano su una scelta che fa GIA' altro — porta a una
   scena nuova, da' un oggetto, cura, tira un dado — e' contabilita' inutile: si toglie
   quando si passa da quelle parti e nessuno se ne accorge. Un flag orfano che e' l'UNICO
   effetto di una scelta e' un'altra cosa: quella scelta non fa NIENTE. Il giocatore la
   premeva, il gioco segnava una crocetta su un foglio che non legge nessuno, e la storia
   restava dov'era. Sono queste che vanno aggredite, e sono poche. */
const soloEffetto = new Set();
for (const [id, sc] of Object.entries(CAMPAIGN)) {
  for (const c of sc.choices || []) {
    if (!c.sets || typeof c.sets !== 'object') continue;
    const altro = c.item || c.items || c.heal || c.damage || c.gold || c.goldLoss || c.fiato
               || c.check || c.combat || c.minigame || c.recipe || c.killRoller || c.reviveAll
               || c.sacrificeSets || c.requiresGold || c.shop;
    const altrove = (sc.choices || []).filter(x => x !== c).map(x => x.next);
    const nuovo = c.next && !altrove.includes(c.next);
    if (!altro && !nuovo) for (const k of Object.keys(c.sets)) soloEffetto.add(k);
  }
}
const orfani = [...scritti.keys()].filter(f => !letti.has(f) && !DEL_MOTORE.test(f)).sort();
const critici = orfani.filter(f => soloEffetto.has(f));
const fantasmi = [...letti.keys()].filter(f => !scritti.has(f) && !DEL_MOTORE.test(f)).sort();
const tutti = new Set([...scritti.keys(), ...letti.keys()].filter(f => !DEL_MOTORE.test(f)));

if (JSON_OUT) {
  console.log(JSON.stringify({
    totale: tutti.size, orfani, fantasmi, critici,
    dove: Object.fromEntries(orfani.map(f => [f, scritti.get(f)])),
  }, null, 2));
  process.exit(0);
}

const pc = n => tutti.size ? Math.round(n / tutti.size * 100) : 0;
console.log(`\n🚩 FLAG — ${tutti.size} in tutto\n`);
console.log(`  scritti e letti da qualcuno: ${tutti.size - orfani.length - fantasmi.length}`);
console.log(`  \x1b[33mscritti e MAI letti: ${orfani.length} (${pc(orfani.length)}%)\x1b[0m   ← promesse non mantenute`);
console.log(`  \x1b[31mletti e MAI scritti: ${fantasmi.length}\x1b[0m   ← scelte che non compaiono mai`);
console.log(`  \x1b[35mdi cui CRITICI (unico effetto di una scelta): ${critici.length}\x1b[0m   ← scelte che non fanno niente\n`);

if (critici.length) {
  console.log('\x1b[35m▸ I CRITICI — unico effetto di una scelta, che quindi non fa niente:\x1b[0m');
  for (const f of critici) console.log(`    ${f.padEnd(30)} ${[...new Set(scritti.get(f))].slice(0, 2).join(', ')}`);
  console.log('');
}
if (fantasmi.length) {
  console.log('\x1b[31m▸ LETTI E MAI SCRITTI — questi sono bug, non debito:\x1b[0m');
  for (const f of fantasmi) console.log(`    ${f.padEnd(30)} letto da ${[...new Set(letti.get(f))].join(', ')}`);
  console.log('');
}
if (orfani.length) {
  console.log('\x1b[33m▸ SCRITTI E MAI LETTI:\x1b[0m');
  // raggruppati per atto, che è l'ordine in cui si lavora
  const perAtto = new Map();
  for (const f of orfani) {
    const posto = scritti.get(f)[0] || '?';
    const atto = (posto.match(/^([a-z])\d/) || [null, '?'])[1];
    if (!perAtto.has(atto)) perAtto.set(atto, []);
    perAtto.get(atto).push([f, scritti.get(f)]);
  }
  for (const atto of [...perAtto.keys()].sort()) {
    console.log(`\n  atto ${atto.toUpperCase()} — ${perAtto.get(atto).length}`);
    for (const [f, dove] of perAtto.get(atto)) {
      console.log(DOVE ? `    ${f.padEnd(30)} ${[...new Set(dove)].slice(0, 3).join(', ')}`
                       : `    ${f}`);
    }
  }
  console.log('\n  Per ognuno c\'è una scelta sola fra tre, e va fatta:');
  console.log('    1. gli si dà la sua scena  (una scelta con requires, una riga in più, un esito)');
  console.log('    2. lo si mette nel Quaderno o nella CRONACA  (il giocatore almeno lo rilegge)');
  console.log('    3. si toglie il flag  (se non aveva niente da promettere, era rumore)\n');
}
if (existsSync(join(radice, 'docs'))) {
  console.log('  (le regole stanno in ../dnd-motore/docs/LESSONS-LEARNED.md — «scelte con payoff obbligatorio»)\n');
}
