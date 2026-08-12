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
  if (scene.ending) endingScenes++;

  if (choices.length === 1 && !isCombat) corridorScenes++;

  for (const c of choices) {
    if (c.check) diceChecks++;
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
console.log(`Scene con effetto meccanico:${scenesWithEffect} (${effectPct.toFixed(1)}%)`);
console.log(`Combattimenti:              ${combatScenes}`);
console.log(`Finali:                     ${endingScenes}`);
console.log(`Durata stimata:             ~${readingHours.toFixed(1)}-${readingHoursMax.toFixed(1)} ore`);

/* ---------- confronto con le soglie della pipeline ---------- */
console.log(`\n✅/❌ Soglie (docs/PIPELINE-PRODUZIONE.md)\n`);

let failed = false;
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
check(
  'Prove di dado ~1 ogni 3 scene',
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
