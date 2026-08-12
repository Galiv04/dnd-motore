/* ============ TEST AUTOMATICI — validazione dati e logica — TEMPLATE ============
   Uso: node tests/validate.mjs
   Verifica: integrità del grafo delle scene, dati personaggi/nemici/oggetti,
   sprite ben formati, raggiungibilità dei finali, sanità dei dadi, bilanciamento.

   QUESTO FILE È UN TEMPLATE: va copiato in tests/validate.mjs del gioco specifico. L'unica
   parte da adattare è il blocco CONFIG qui sotto — tutti i controlli restano identici nella
   sostanza e leggono i loro parametri da lì. Dove un controllo non ha senso per la
   configurazione del gioco (es. bossFinale: null), viene saltato con un messaggio
   informativo invece di fallire. */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/* ====== CONFIGURAZIONE — l'unica parte da adattare al gioco ====== */
const CONFIG = {
  eroiAttesi: 2,                    // quanti personaggi giocabili prevede il gioco (totale, sbloccabili inclusi)
  eroiSbloccabili: [],               // id degli eroi con `locked: true` (si sbloccano giocando, via unlockHero)
  oggettiChiave: [],                 // item che il giocatore DEVE poter ottenere (controllo statico di percorso)
  snodiObbligatori: [],              // id di scena che devono essere raggiungibili (piste principali, snodi, boss)
  bossFinale: null,                  // chiave/i del BESTIARY usate per la stima del boss finale (stringa, array, o null)
  flagEsterni: ['sorpresa', 'reputazione'], // flag impostati dal motore (unlockHero, combattimento...), non dalle scene
  minFinali: 3,                      // numero minimo di finali attesi
};

/* ---------- carica i moduli di gioco in un contesto Node ---------- */
const src = ['js/sprites.js', 'js/characters.js', 'js/campaign.js']
  .map(f => readFileSync(join(root, f), 'utf8'))
  .join('\n;\n');

const context = {};
const loader = new Function(`${src}; return { Sprites, HEROES, BESTIARY, ITEMS, CAMPAIGN, CAMPAIGN_START, WORLD_MAP, CHAPTERS: typeof CHAPTERS !== 'undefined' ? CHAPTERS : [] };`);
let g;
try {
  g = loader();
} catch (e) {
  console.error('❌ ERRORE FATALE nel caricamento dei moduli:', e.message);
  process.exit(1);
}
const { Sprites, HEROES, BESTIARY, ITEMS, CAMPAIGN, CAMPAIGN_START, WORLD_MAP, CHAPTERS } = g;

let failures = 0, warnings = 0, passed = 0;
function ok(msg) { passed++; }
function fail(msg) { failures++; console.error('  ❌ FAIL:', msg); }
function warn(msg) { warnings++; console.warn('  ⚠ WARN:', msg); }
function section(name) { console.log('\n▶', name); }
function info(msg) { console.log('  ℹ', msg); }

ok('moduli caricati');

/* ---------- 1. grafo delle scene ---------- */
section('Grafo delle scene');

const sceneIds = new Set(Object.keys(CAMPAIGN));
const SPECIAL = new Set(['RETRY_COMBAT']);

function refsOf(scene) {
  const refs = [];
  for (const c of scene.choices || []) {
    if (c.next) refs.push(c.next);
    if (c.check) { refs.push(c.check.success, c.check.fail); }
  }
  if (scene.combat) { refs.push(scene.combat.victory, scene.combat.defeat); }
  return refs.filter(Boolean);
}

let badRefs = 0;
for (const [id, scene] of Object.entries(CAMPAIGN)) {
  for (const ref of refsOf(scene)) {
    if (!sceneIds.has(ref) && !SPECIAL.has(ref)) { fail(`scena "${id}" punta a scena inesistente "${ref}"`); badRefs++; }
  }
}
if (!badRefs) { ok(); console.log(`  ✔ tutti i riferimenti tra ${sceneIds.size} scene sono validi`); }

// raggiungibilità dalla scena iniziale (RETRY_COMBAT torna a una scena combat: consideriamo
// raggiungibili le scene combat già visitate)
const reachable = new Set();
const queue = [CAMPAIGN_START];
while (queue.length) {
  const id = queue.pop();
  if (reachable.has(id) || SPECIAL.has(id)) continue;
  reachable.add(id);
  const scene = CAMPAIGN[id];
  if (scene) queue.push(...refsOf(scene));
}
const unreachable = [...sceneIds].filter(id => !reachable.has(id));
if (unreachable.length) unreachable.forEach(id => fail(`scena orfana (mai raggiungibile): "${id}"`));
else { ok(); console.log(`  ✔ tutte le ${sceneIds.size} scene sono raggiungibili da "${CAMPAIGN_START}"`); }

// scene senza uscite (devono essere solo i finali)
for (const [id, scene] of Object.entries(CAMPAIGN)) {
  const exits = refsOf(scene).length;
  if (!exits && !scene.ending) fail(`scena "${id}" è un vicolo cieco (nessuna uscita e non è un finale)`);
  if (scene.ending && refsOf(scene).length) warn(`finale "${id}" ha delle uscite: strano`);
}
ok(); console.log('  ✔ nessun vicolo cieco fuori dai finali');

// i finali sono raggiungibili
const endings = Object.entries(CAMPAIGN).filter(([, s]) => s.ending).map(([id]) => id);
if (endings.length < CONFIG.minFinali) fail(`solo ${endings.length} finali trovati (attesi ≥${CONFIG.minFinali})`);
for (const e of endings) {
  if (!reachable.has(e)) fail(`finale "${e}" non raggiungibile`);
}
console.log(`  ✔ ${endings.length} finali, tutti raggiungibili: ${endings.join(', ')}`);

// gli snodi obbligatori configurati (piste principali, hub, boss) sono raggiungibili
if (CONFIG.snodiObbligatori.length) {
  const mancanti = CONFIG.snodiObbligatori.filter(id => !reachable.has(id));
  if (mancanti.length) fail(`snodo/i obbligatorio/i non raggiungibile/i: ${mancanti.join(', ')}`);
  else console.log(`  ✔ tutti gli snodi obbligatori raggiungibili: ${CONFIG.snodiObbligatori.join(', ')}`);
} else {
  info('CONFIG.snodiObbligatori è vuoto: controllo di raggiungibilità degli snodi saltato');
}

/* ---------- 2. scelte e requisiti ---------- */
section('Scelte, oggetti e flag');

const knownFlags = new Set();
for (const scene of Object.values(CAMPAIGN)) {
  if (scene.sets) Object.keys(scene.sets).forEach(f => knownFlags.add(f));
  for (const c of scene.choices || []) if (c.sets) Object.keys(c.sets).forEach(f => knownFlags.add(f));
}
let flagProblems = 0;
for (const [id, scene] of Object.entries(CAMPAIGN)) {
  for (const c of scene.choices || []) {
    for (const fRef of [c.requires?.flag, c.requires?.flag2, c.requires?.notFlag, ...(c.requires?.flagAny || [])]) {
      if (fRef && !knownFlags.has(fRef) && !CONFIG.flagEsterni.includes(fRef)) { fail(`scena "${id}": richiede flag mai impostato "${fRef}"`); flagProblems++; }
    }
    for (const hRef of [c.requires?.hero, c.requires?.heroDead]) {
      if (hRef && !HEROES.some(h => h.id === hRef)) { fail(`scena "${id}": requires.hero inesistente "${hRef}"`); flagProblems++; }
    }
    if (c.sacrifice && !c.next) { fail(`scena "${id}": scelta sacrifice senza next`); flagProblems++; }
    for (const itemRef of [c.item, c.removeItem, c.removeItem2, c.requires?.item, c.requires?.item2, c.requires?.notItem]) {
      if (itemRef && !ITEMS[itemRef]) { fail(`scena "${id}": oggetto inesistente "${itemRef}"`); flagProblems++; }
    }
    if (c.check && !['FOR','DES','COS','INT','SAG','CAR'].includes(c.check.stat)) { fail(`scena "${id}": statistica invalida "${c.check.stat}"`); flagProblems++; }
    if (c.check && (c.check.dc < 5 || c.check.dc > 20)) warn(`scena "${id}": CD insolita ${c.check.dc}`);
  }
  for (const itemRef of [scene.item, scene.item2, scene.onEnterOnce?.itemEach]) {
    if (itemRef && !ITEMS[itemRef]) { fail(`scena "${id}": oggetto inesistente "${itemRef}"`); flagProblems++; }
  }
  if (scene.unlockHero && !HEROES.some(h => h.id === scene.unlockHero)) { fail(`scena "${id}": unlockHero inesistente "${scene.unlockHero}"`); flagProblems++; }
}
// ogni eroe sbloccabile deve sbloccarsi da qualche parte
for (const heroId of CONFIG.eroiSbloccabili) {
  if (!Object.values(CAMPAIGN).some(s => s.unlockHero === heroId)) fail(`nessuna scena sblocca l'eroe sbloccabile "${heroId}" (unlockHero)`);
}
if (!CONFIG.eroiSbloccabili.length) info('CONFIG.eroiSbloccabili è vuoto: controllo unlockHero saltato');
if (!flagProblems) { ok(); console.log(`  ✔ tutti i flag (${knownFlags.size}) e gli oggetti referenziati esistono`); }

// oggetti chiave ottenibili prima di dove servono (controllo statico di percorso).
// "ottenibile" = dato da una scena/combattimento, OPPURE nello zaino di partenza
// (Engine.newGame in js/engine.js: alcuni giochi partono già con un oggetto in mano).
if (CONFIG.oggettiChiave.length) {
  const engineSrcForItems = readFileSync(join(root, 'js/engine.js'), 'utf8');
  for (const it of CONFIG.oggettiChiave) {
    const givenInScena = Object.values(CAMPAIGN).some(s => s.item === it || s.item2 === it || (s.choices || []).some(c => c.item === it) || (s.combat?.loot?.items || []).includes(it));
    const inZainoIniziale = new RegExp(`['"]${it}['"]`).test(engineSrcForItems);
    if (!givenInScena && !inZainoIniziale) fail(`oggetto chiave "${it}" non viene mai dato al giocatore (né da una scena né nello zaino di partenza)`);
  }
  console.log('  ✔ oggetti chiave ottenibili');
} else {
  info('CONFIG.oggettiChiave è vuoto: controllo di ottenibilità saltato');
}

/* ---------- 3. combattimenti ---------- */
section('Combattimenti');

let combatProblems = 0;
const combats = Object.entries(CAMPAIGN).filter(([, s]) => s.combat);
for (const [id, scene] of combats) {
  for (const e of scene.combat.enemies) {
    if (!BESTIARY[e]) { fail(`combattimento "${id}": nemico inesistente "${e}"`); combatProblems++; }
  }
  if (!scene.combat.victory || !scene.combat.defeat) { fail(`combattimento "${id}": manca victory/defeat`); combatProblems++; }
  for (const it of scene.combat.loot?.items || []) {
    if (!ITEMS[it]) { fail(`combattimento "${id}": loot inesistente "${it}"`); combatProblems++; }
  }
}
if (!combatProblems) { ok(); console.log(`  ✔ ${combats.length} combattimenti validi (nemici, esiti, loot)`); }

// le sconfitte non-boss portano a una scena che deve esistere (per poter tornare al combattimento)
const defeats = new Set(combats.map(([, s]) => s.combat.defeat));
for (const d of defeats) {
  if (!CAMPAIGN[d]) fail(`scena di sconfitta "${d}" inesistente`);
}
console.log(`  ✔ scene di sconfitta esistenti: ${[...defeats].join(', ')}`);

/* ---------- 4. personaggi e bestiario ---------- */
section('Personaggi e bestiario');

let charProblems = 0;
if (HEROES.length !== CONFIG.eroiAttesi) fail(`attesi ${CONFIG.eroiAttesi} protagonisti, trovati ${HEROES.length}`);
const lockedHeroes = HEROES.filter(h => h.locked).map(h => h.id);
if (CONFIG.eroiSbloccabili.length) {
  const stesso = lockedHeroes.length === CONFIG.eroiSbloccabili.length && CONFIG.eroiSbloccabili.every(id => lockedHeroes.includes(id));
  if (!stesso) fail(`gli eroi "locked" (${lockedHeroes.join(', ') || 'nessuno'}) non corrispondono a CONFIG.eroiSbloccabili (${CONFIG.eroiSbloccabili.join(', ')})`);
} else if (lockedHeroes.length) {
  fail(`trovati eroi "locked" (${lockedHeroes.join(', ')}) non dichiarati in CONFIG.eroiSbloccabili`);
}
for (const h of HEROES) {
  for (const k of ['id','name','class','tagline','role','stats','maxHp','ac','attack','abilities','passive','backstory','voice','sprite']) {
    if (h[k] === undefined) { fail(`eroe "${h.id}": campo mancante "${k}"`); charProblems++; }
  }
  if (!Sprites.registry[h.sprite]) { fail(`eroe "${h.id}": sprite mancante "${h.sprite}"`); charProblems++; }
  for (const s of ['FOR','DES','COS','INT','SAG','CAR']) {
    if (typeof h.stats[s] !== 'number') { fail(`eroe "${h.id}": stat mancante ${s}`); charProblems++; }
  }
  if (h.abilities.length < 2) { fail(`eroe "${h.id}": meno di 2 abilità`); charProblems++; }
  for (const ab of h.abilities) {
    if (!ab.id || !ab.name || !ab.uses || !ab.type || !ab.desc) { fail(`eroe "${h.id}": abilità incompleta "${ab.id}"`); charProblems++; }
  }
  if (h.backstory.length < 200) warn(`eroe "${h.id}": backstory corta (${h.backstory.length} caratteri)`);
}
for (const [key, b] of Object.entries(BESTIARY)) {
  if (!Sprites.registry[b.sprite]) { fail(`nemico "${key}": sprite mancante "${b.sprite}"`); charProblems++; }
  if (!b.attack || !b.attack.dice || b.attack.bonus === undefined) { fail(`nemico "${key}": attacco malformato`); charProblems++; }
}
if (!charProblems) { ok(); console.log(`  ✔ ${HEROES.length} protagonisti completi (stats, abilità, backstory, sprite) e ${Object.keys(BESTIARY).length} nemici validi`); }

/* ---------- 5. sprite ---------- */
section('Sprite pixel-art');

let spriteProblems = 0;
for (const [name, def] of Object.entries(Sprites.registry)) {
  const n = def.map.length;
  if (n !== 16 && n !== 32) { fail(`sprite "${name}": ${n} righe (attese 16 o 32)`); spriteProblems++; }
  def.map.forEach((row, i) => {
    if (row.length !== n) { fail(`sprite "${name}" riga ${i}: ${row.length} colonne (attese ${n}, mappa quadrata)`); spriteProblems++; }
    for (const ch of row) {
      if (ch !== '.' && !def.palette[ch]) { fail(`sprite "${name}" riga ${i}: carattere "${ch}" non in palette`); spriteProblems++; }
    }
  });
  const solid = def.map.join('').split('').filter(c => c !== '.').length;
  if (solid < (n === 32 ? 160 : 40)) warn(`sprite "${name}": molto vuoto (${solid} pixel)`);
}
if (!spriteProblems) { ok(); console.log(`  ✔ ${Object.keys(Sprites.registry).length} sprite ben formati (16x16 o 32x32, palette coerenti)`); }

/* ---------- 6. mappa del mondo ---------- */
section('Mappa del mondo');

const mapped = new Set(WORLD_MAP.flatMap(l => l.scenes));
let unmapped = [...sceneIds].filter(id => !mapped.has(id));
if (unmapped.length) unmapped.forEach(id => warn(`scena "${id}" senza luogo sulla mappa (userà fallback)`));
const mapGhost = [...mapped].filter(id => !sceneIds.has(id));
if (mapGhost.length) mapGhost.forEach(id => fail(`la mappa cita una scena inesistente "${id}"`));
else { ok(); console.log(`  ✔ mappa coerente: ${WORLD_MAP.length} luoghi, nessun riferimento fantasma`); }

/* ---------- 7. logica dei dadi ---------- */
section('Logica dei dadi (statistica)');

function roll(sides) { return 1 + Math.floor(Math.random() * sides); }
const N = 100000;
let sum = 0, min = 99, max = 0;
for (let i = 0; i < N; i++) { const r = roll(20); sum += r; min = Math.min(min, r); max = Math.max(max, r); }
const avg = sum / N;
if (min !== 1 || max !== 20) fail(`d20 fuori range: min=${min} max=${max}`);
else if (Math.abs(avg - 10.5) > 0.15) fail(`d20 media anomala: ${avg.toFixed(3)}`);
else { ok(); console.log(`  ✔ d20 uniforme su ${N} tiri (media ${avg.toFixed(2)}, range ${min}-${max})`); }

/* ---------- 8. bilanciamento (simulazione grezza) ---------- */
section('Bilanciamento (stime statistiche)');

function heroDPR(h) { // danno medio per round con attacco base
  const [n, s] = h.attack.dice;
  const statMod = h.stats[h.attack.stat];
  const hitChance = Math.min(0.95, Math.max(0.05, (21 - (13 - (statMod + 2))) / 20)); // vs CA 13 media
  const avgDmg = n * (s + 1) / 2 + statMod + (h.attack.bonus || 0);
  return hitChance * avgDmg;
}
function enemyDPR(e) {
  const [n, s] = e.attack.dice;
  const hitChance = Math.min(0.95, Math.max(0.05, (21 - (14 - e.attack.bonus)) / 20)); // vs CA 14 media
  return hitChance * (n * (s + 1) / 2 + e.attack.plus);
}

// party minimo (2 eroi più deboli in danno) contro ogni combattimento
const dprs = HEROES.map(h => ({ id: h.id, dpr: heroDPR(h), hp: h.maxHp })).sort((a, b) => a.dpr - b.dpr);
const weakDuo = dprs.slice(0, 2);
const duoDPR = weakDuo.reduce((t, x) => t + x.dpr, 0) * 1.5; // ~x1.5 per abilità speciali
const duoHP = weakDuo.reduce((t, x) => t + x.hp, 0) + 20;    // + pozioni/cure

for (const [id, scene] of combats) {
  const totalEhp = scene.combat.enemies.reduce((t, e) => t + BESTIARY[e].maxHp, 0);
  const totalEdpr = scene.combat.enemies.reduce((t, e) => t + enemyDPR(BESTIARY[e]), 0);
  const roundsToWin = totalEhp / duoDPR;
  const roundsToLose = duoHP / totalEdpr;
  const margin = roundsToLose / roundsToWin;
  if (margin < 0.9) warn(`combattimento "${id}" molto duro per 2 giocatori (margine ${margin.toFixed(2)}): ok se boss`);
  else ok();
}
console.log('  ✔ stima di bilanciamento per party di 2 completata (vedi eventuali warn)');

if (CONFIG.bossFinale) {
  const bossKeys = Array.isArray(CONFIG.bossFinale) ? CONFIG.bossFinale : [CONFIG.bossFinale];
  const mancanti = bossKeys.filter(k => !BESTIARY[k]);
  if (mancanti.length) fail(`CONFIG.bossFinale cita nemici inesistenti nel BESTIARY: ${mancanti.join(', ')}`);
  else {
    const bossHp = bossKeys.reduce((t, k) => t + BESTIARY[k].maxHp, 0);
    const fullParty = dprs.reduce((t, x) => t + x.dpr, 0) * 1.4;
    console.log(`  ℹ boss finale: HP totali = ${bossHp}, DPR party completo ≈ ${fullParty.toFixed(1)} → ~${Math.ceil(bossHp / fullParty)} round`);
  }
} else {
  info('CONFIG.bossFinale è null: stima dedicata del boss saltata');
}

/* ---------- 9. testi ---------- */
section('Qualità dei testi');

let shortScenes = 0;
for (const [id, scene] of Object.entries(CAMPAIGN)) {
  if (!scene.text || scene.text.length < 80) { warn(`scena "${id}": testo molto corto`); shortScenes++; }
  if (!scene.caption) warn(`scena "${id}": manca la caption`);
  if (!scene.location) fail(`scena "${id}": manca la location`);
}
const totalChars = Object.values(CAMPAIGN).reduce((t, s) => t + (s.text || '').length, 0);
const words = Math.round(totalChars / 6);
console.log(`  ✔ ${Object.keys(CAMPAIGN).length} scene, ~${words} parole di narrazione (~${Math.round(words / 180)} min di sola lettura ad alta voce)`);
if (words < 6000) warn('campagna forse corta per 2-4 ore');

/* ---------- capitoli rigiocabili: scene e oggetti devono esistere ---------- */
section('Capitoli rigiocabili');

if (CHAPTERS.length) {
  let capitoliRotti = 0;
  for (const c of CHAPTERS) {
    const dest = c.scene || c.id;
    if (!CAMPAIGN[dest]) { fail(`capitolo "${c.label}": la scena di destinazione "${dest}" non esiste`); capitoliRotti++; }
    for (const it of (c.items || [])) {
      if (!ITEMS[it]) { fail(`capitolo "${c.label}": l'oggetto preparato "${it}" non esiste in ITEMS`); capitoliRotti++; }
    }
    if (!c.label || !c.desc) { fail(`capitolo "${dest}": manca label o desc`); capitoliRotti++; }
  }
  if (!capitoliRotti) { ok(); console.log(`  ✔ ${CHAPTERS.length} capitoli, tutte le destinazioni e gli zaini preparati esistono`); }
} else {
  info('CHAPTERS è vuoto: il gioco non usa capitoli rigiocabili, controllo saltato');
}

/* ---------- stinger dichiarati dalle scene: devono esistere in sound.js ---------- */
section('Stinger delle scene (nessun suono fantasma)');

const soundSrc = readFileSync(join(root, 'js/sound.js'), 'utf8');
const effectsBlock = soundSrc.slice(soundSrc.indexOf('const effects = {'), soundSrc.indexOf('function play('));
const effectNames = new Set([...effectsBlock.matchAll(/^\s{4}([a-z_0-9]+)\(\)/gm)].map(m => m[1]));
let stingerMorti = 0;
for (const [id, scene] of Object.entries(CAMPAIGN)) {
  if (scene.stinger && !effectNames.has(scene.stinger)) {
    fail(`scena "${id}": stinger "${scene.stinger}" non esiste in sound.js (suono fantasma silenzioso)`);
    stingerMorti++;
  }
}
const conStinger = Object.values(CAMPAIGN).filter(sc => sc.stinger).length;
if (!stingerMorti) { ok(); console.log(`  ✔ ${conStinger} scene con stinger, tutti esistenti in sound.js (${effectNames.size} effetti nel catalogo)`); }

/* ---------- flag morti: imprese/cronache/diario devono poter scattare ---------- */
section('Flag di imprese, cronache e diario (nessun flag morto)');

const epiSrc = readFileSync(join(root, 'js/epilogues.js'), 'utf8');
const campSrc = readFileSync(join(root, 'js/campaign.js'), 'utf8');
const setsBlocks = [...campSrc.matchAll(/sets:\s*{([^}]*)}/g)].map(m => m[1]).join(' ');
const settableFlags = new Set([...setsBlocks.matchAll(/([a-z_0-9]+)\s*:/g)].map(m => m[1]));
// flag impostati fuori dalle scene (motore/combattimento): CONFIG.flagEsterni, più quelli
// impostati da unlockHero (uno per eroe sbloccabile, per convenzione "<id>_in_squadra")
const FLAG_ESTERNI = new Set([...CONFIG.flagEsterni, ...CONFIG.eroiSbloccabili.map(id => `${id}_in_squadra`)]);
const flagRichiesti = new Set([
  ...[...epiSrc.matchAll(/flag:\s*'([a-z_0-9]+)'/g)].map(m => m[1]),
  ...[...campSrc.matchAll(/^\s*\['([a-z_0-9]+)',/gm)].map(m => m[1]), // DIARY_FLAGS
]);
let flagMorti = 0;
for (const f of flagRichiesti) {
  if (!settableFlags.has(f) && !FLAG_ESTERNI.has(f)) { fail(`flag "${f}" richiesto da imprese/cronache/diario ma MAI impostato da nessuna scena`); flagMorti++; }
}
if (!flagMorti) { ok(); console.log(`  ✔ ${flagRichiesti.size} flag di imprese/cronache/diario, tutti impostabili da almeno una scena`); }

// direzione inversa: flag impostati dalle scene ma senza NESSUN consumatore di gioco
// (né requires, né combat, né diario/imprese/cronache) — debito narrativo, non errore
const engineSrc2 = readFileSync(join(root, 'js/engine.js'), 'utf8') + readFileSync(join(root, 'js/combat.js'), 'utf8');
const consumatori = campSrc + engineSrc2 + epiSrc;
const senzaConsumatore = [...settableFlags].filter(f => {
  const inSets = (setsBlocks.match(new RegExp('\\b' + f + '\\b', 'g')) || []).length;
  const totale = (consumatori.match(new RegExp('\\b' + f + '\\b', 'g')) || []).length;
  return totale <= inSets;
});
if (senzaConsumatore.length) warn(`${senzaConsumatore.length} flag impostati ma senza consumatore di gioco (debito narrativo): ${senzaConsumatore.slice(0, 8).join(', ')}${senzaConsumatore.length > 8 ? ', …' : ''}`);

/* ---------- prove ripetibili: check senza once nelle scene rivisitabili ---------- */
section('Prove nei luoghi rivisitabili (nessuna prova ripetibile)');

const bersagliRitorno = new Set([...campSrc.matchAll(/text: ["']↩[^"']*["'][^\n]*?next: '([a-z_0-9]+)'/g)].map(m => m[1]));
let proveRipetibili = 0;
for (const sid of bersagliRitorno) {
  const m = campSrc.match(new RegExp('^  ' + sid + ': \\{', 'm'));
  if (!m) continue;
  const blocco = campSrc.slice(m.index, campSrc.indexOf('\n  },', m.index));
  for (const c of blocco.matchAll(/\{ text: '([^']{0,60})'[^\n]*?check: \{[^}]*\}[^\n]*\}/g)) {
    if (!c[0].includes('once')) { fail(`scena rivisitabile "${sid}": la prova "${c[1]}" è ripetibile (manca once)`); proveRipetibili++; }
  }
}
if (!proveRipetibili) { ok(); console.log(`  ✔ ${bersagliRitorno.size} scene rivisitabili, nessuna prova ripetibile`); }

/* ---------- esito ---------- */
console.log('\n' + '═'.repeat(50));
if (failures === 0) {
  console.log(`✅ TUTTI I TEST SUPERATI (${passed} controlli, ${warnings} avvisi non bloccanti)`);
  process.exit(0);
} else {
  console.log(`❌ ${failures} TEST FALLITI (${warnings} avvisi)`);
  process.exit(1);
}
