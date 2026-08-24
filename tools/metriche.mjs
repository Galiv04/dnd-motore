#!/usr/bin/env node
/* ============ metriche.mjs — misura la densità di giocabilità di una campagna ============
   Uso:  node tools/metriche.mjs <cartella-del-gioco>     (default: cartella corrente)

   Carica js/campaign.js del gioco indicato ed espone CAMPAIGN + ITEMS, poi stampa una tabella
   di metriche di densità e le confronta con le soglie della pipeline di produzione
   (vedi ../docs/PIPELINE-PRODUZIONE.md). Esce con codice 1 se una soglia non è rispettata,
   così può essere usato come gate in CI. */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';

const gameDir = resolve(process.argv[2] || '.');
const campaignPath = join(gameDir, 'js', 'campaign.js');

let src;
try {
  src = readFileSync(campaignPath, 'utf8');
} catch (e) {
  console.error(`❌ Impossibile leggere ${campaignPath}: ${e.message}`);
  process.exit(1);
}

let CAMPAIGN, ITEMS;
try {
  const loader = new Function(`${src}\n; return { CAMPAIGN, ITEMS };`);
  ({ CAMPAIGN, ITEMS } = loader());
} catch (e) {
  console.error(`❌ Errore nel caricare ${campaignPath}: ${e.message}`);
  process.exit(1);
}

/* ---------- conteggio parole (spazi/punteggiatura come separatori) ---------- */
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const MECHANICAL_KEYS = ['gold', 'goldLoss', 'heal', 'damage', 'item', 'item2', 'sets'];

const scenes = Object.entries(CAMPAIGN);
const nScenes = scenes.length;

let totalWords = 0;
let scenesOver280 = 0;
let totalChoices = 0;
let corridorScenes = 0;   // una sola scelta, scena non di combattimento
let conStinger = 0;
let momentiIncerti = 0;
let diceChecks = 0;
let scenesWithEffect = 0;
let combatScenes = 0;
let endingScenes = 0;

for (const [id, scene] of scenes) {
  const words = countWords(scene.text);
  totalWords += words;
  if (words > 280) scenesOver280++;

  const choices = scene.choices || [];
  totalChoices += choices.length;

  const isCombat = !!scene.combat;
  if (isCombat) combatScenes++;
  if (scene.stinger) conStinger++;
  if (isCombat) momentiIncerti++;          // lo scontro e' il momento d'incertezza per eccellenza
  if (scene.minigame) momentiIncerti++;    // e il minigioco sta sulla SCENA, non solo sulle scelte
  if (scene.ending) endingScenes++;

  if (choices.length === 1 && !isCombat) corridorScenes++;

  for (const c of choices) {
    if (c.check) diceChecks++;
    /* L'INCERTEZZA NON E' SOLO IL d20. Contare le sole `check` ha dichiarato Pandataria
       vuota — 7 prove in 203 scene — mentre quel gioco mette l'incertezza nei MINIGIOCHI
       (l'apnea, le tacche, la corsa), nelle SOGLIE DI FIATO (`requiresGold`: sotto quel
       numero non ci arrivi e lo sai) e nei COMBATTIMENTI. Misurare una cosa sola e
       chiamarla «giocabilità» fa bocciare un gioco per come e' fatto invece che per come
       e' venuto. Si contano tutti i momenti in cui il gioco puo' dire no. */
    if (c.minigame) momentiIncerti++;
    if (c.requiresGold) momentiIncerti++;
    if (c.combat) momentiIncerti++;
  }

  const hasEffect = MECHANICAL_KEYS.some(k => scene[k] !== undefined) ||
    choices.some(c => MECHANICAL_KEYS.some(k => c[k] !== undefined));
  if (hasEffect || isCombat) scenesWithEffect++;
}

const avgWords = nScenes ? totalWords / nScenes : 0;
const avgChoices = nScenes ? totalChoices / nScenes : 0;
const corridorPct = nScenes ? (corridorScenes / nScenes) * 100 : 0;
const effectPct = nScenes ? (scenesWithEffect / nScenes) * 100 : 0;
const diceEveryN = diceChecks ? nScenes / diceChecks : Infinity;

const readingHours = (totalWords / 180) * 2.2;
const readingHoursMax = (totalWords / 180) * 2.8;

/* ---------- stampa la tabella ---------- */
console.log(`\n📊 Metriche di densità — ${gameDir}\n`);
console.log(`Scene totali:              ${nScenes}`);
console.log(`Parole totali:              ${totalWords}`);
console.log(`Parole medie per scena:     ${avgWords.toFixed(1)}`);
console.log(`Scene oltre 280 parole:     ${scenesOver280}`);
console.log(`Scelte medie per scena:     ${avgChoices.toFixed(2)}`);
console.log(`Scene-corridoio:            ${corridorScenes} (${corridorPct.toFixed(1)}%)`);
console.log(`Prove di dado totali:       ${diceChecks}`);
console.log(`Momenti d'incertezza:       ${diceChecks + momentiIncerti} (dadi + minigiochi + soglie + scontri) = 1 ogni ${(nScenes / Math.max(1, diceChecks + momentiIncerti)).toFixed(1)} scene`);
console.log(`Scene con effetto meccanico:${scenesWithEffect} (${effectPct.toFixed(1)}%)`);
console.log(`Combattimenti:              ${combatScenes}`);
console.log(`Scene con uno stinger:      ${conStinger} (${(conStinger / nScenes * 100).toFixed(0)}%)`);
console.log(`Finali:                     ${endingScenes}`);
console.log(`Durata stimata:             ~${readingHours.toFixed(1)}-${readingHoursMax.toFixed(1)} ore`);

/* ---------- confronto con le soglie della pipeline ---------- */
console.log(`\n✅/❌ Soglie (docs/PIPELINE-PRODUZIONE.md)\n`);

let failed = false;
function infoOnly(label, pass, detail) {
  console.log(`${pass ? '✅' : 'ℹ️ '} ${label} — ${detail}`);
}
function check(label, pass, detail) {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!pass) failed = true;
}

check(
  'Parole medie per scena tra 150 e 260',
  avgWords >= 150 && avgWords <= 260,
  `${avgWords.toFixed(1)} parole`
);
check(
  'Scelte medie per scena ≥ 1.9',
  avgChoices >= 1.9,
  `${avgChoices.toFixed(2)}`
);
check(
  'Scene-corridoio ≤ 20%',
  corridorPct <= 20,
  `${corridorPct.toFixed(1)}%`
);
/* LO STINGER E' MEZZA SCENA. Il suono all'ingresso e' la meta' dell'atmosfera, e resta
   invisibile a ogni controllo: un suono che non parte non lascia tracce. La Corona di
   Mezzanotte e' stata a ZERO per tutta la sua vita — nel suo motore mancava la riga che
   legge `scene.stinger`, e nessuno se n'era accorto in cinque giochi. La soglia e' bassa di
   proposito (un quarto delle scene): uno stinger segna un MOMENTO — un finale, un oggetto,
   una prova risolta, un colpo vero, una cura vera — e non un numero che cambia di uno. */
check(
  'Scene con uno stinger ≥ 25%',
  conStinger >= nScenes * 0.25,
  `${conStinger} su ${nScenes} (${(conStinger / nScenes * 100).toFixed(0)}%)`
);
check(
  "Momenti d'incertezza ~1 ogni 4 scene (dadi, minigiochi, soglie, scontri)",
  (diceChecks + momentiIncerti) >= nScenes / 4,
  `1 ogni ${(nScenes / Math.max(1, diceChecks + momentiIncerti)).toFixed(1)} scene`
);
/* La soglia sui SOLI dadi e' stata demossa a informativa il 24 agosto 2026: quattro giochi
   su cinque la mancano per come sono PROGETTATI — chi mette l'incertezza nei minigiochi e
   nelle soglie di fiato non ha bisogno di un d20 ogni tre scene — e una soglia che quattro
   giochi su cinque devono ignorare e' un falso allarme, cioe' un controllo spento. La soglia
   vera e' sopra, sui momenti d'incertezza di qualunque tipo. */
infoOnly(
  'Prove di dado (informativo)',
  diceChecks > 0 && diceEveryN <= 3.5,
  diceChecks > 0 ? `1 ogni ${diceEveryN.toFixed(1)} scene` : 'nessuna prova di dado'
);
check(
  'Scene con effetto meccanico ≥ 80%',
  effectPct >= 80,
  `${effectPct.toFixed(1)}%`
);

console.log('');
if (failed) {
  console.error('❌ Una o più soglie di densità non sono rispettate.\n');
  process.exit(1);
} else {
  console.log('✅ Tutte le soglie di densità sono rispettate.\n');
  process.exit(0);
}
