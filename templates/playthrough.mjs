/* ============ PLAYTHROUGH — simulazioni complete headless (no browser) — TEMPLATE ============

   QUESTO FILE È UN TEMPLATE, non un test pronto all'uso: va COPIATO in tests/playthrough.mjs
   del gioco specifico e adattato prima di poterlo eseguire.
   1. Compilare il blocco CONFIG poco più sotto con gli id veri del gioco (eroi, una scena
      finale, una scena di combattimento).
   2. Sostituire i DUE scenari di esempio (in fondo al file) con quelli reali della campagna:
      quanti servono per coprire ogni finale, ogni boss, ogni oggetto chiave, le morti e le
      resurrezioni (se il gioco le prevede), le sconfitte volute, party di dimensioni diverse.
   3. Eseguire `node tests/playthrough.mjs`.
   Finché CONFIG non è compilato, lo script esce subito con un messaggio chiaro (vedi sotto)
   invece di andare a caccia di file e scene che non esistono ancora.

   Uso (una volta adattato): node tests/playthrough.mjs

   Cos'è l'HARNESS qui sotto (la parte da NON toccare, è il valore riusabile del template):
   carica engine.js, combat.js, dice.js (+ dati) in un vm.Context Node con uno stub minimale
   di document/localStorage/timer, e gioca partite complete cliccando programmaticamente i
   bottoni generati dal gioco (choices, azioni di combattimento, overlay dei dadi, selezione
   eroe per le prove), esattamente come farebbe un utente.

   Meccaniche del motore condiviso gestite dall'harness:
   - unlockHero: se un eroe si aggiunge al party a runtime con una modale ritardata
     (setTimeout), la coda timer dello stub la DRENA dentro act(), e la modale (solo
     informativa) viene chiusa.
   - choice.sacrifice: la modale di scelta dell'eroe viene cliccata (scenario.sacrificeHero).
   - killRoller: nessuna UI — muore chi ha tirato l'ultimo dado (G.lastRoller).
   - checkOutcomes: esiti dei tiri FORZATI per scena (Math.random pilotato solo durante
     il click dell'eroe nella modale della prova: 0.999 → 20 naturale, 0 → 1 naturale),
     per rendere deterministici i percorsi che dipendono dal dado.
   - forceLossAt: sconfitta VOLUTA in un combattimento specifico (solo Difesa totale).

   Obiettivo: scovare bug di RUNTIME (eccezioni, scene mancanti, loop infiniti,
   stato incoerente) che i controlli statici di validate.mjs non possono vedere. */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/* ====== CONFIGURAZIONE — l'unica parte da adattare al gioco ======
   Sostituire i valori segnaposto con quelli veri della campagna. */
const CONFIG = {
  // Due (o più) id di eroi giocabili REALI, usati negli scenari di esempio sotto.
  eroiEsempio: ['eroe1', 'eroe2'],
  // Id di una scena qualunque della prima parte del gioco, usata per l'esempio del
  // salvataggio/ricarica e come punto in cui forzare la prima scelta.
  unaSceneScelta: 'a1',
  // Id di una scena con `ending: true` raggiungibile facilmente (di norma senza scelte
  // forzate, o con poche), usata dall'esempio "percorso principale fino a un finale".
  sceneFinale: 'finale1',
  // Id di una scena con `combat` incontrata presto, usata dall'esempio "sconfitta voluta".
  sceneCombattimento: 'combattimento1',
};

// Il file resta un TEMPLATE finché questi segnaposto non sono stati sostituiti.
function configNonCompilato() {
  const placeholder = new Set(['eroe1', 'eroe2', 'a1', 'finale1', 'combattimento1']);
  return CONFIG.eroiEsempio.some(id => placeholder.has(id))
    || placeholder.has(CONFIG.unaSceneScelta)
    || placeholder.has(CONFIG.sceneFinale)
    || placeholder.has(CONFIG.sceneCombattimento);
}

if (configNonCompilato()) {
  console.error('❌ CONFIG non configurato: questo è un TEMPLATE, non un test pronto.');
  console.error('   Apri templates/playthrough.mjs (o la tua copia in tests/), leggi il');
  console.error('   commento in testa al file e compila CONFIG con gli id veri del gioco');
  console.error('   (eroi, una scena finale, una scena di combattimento), poi sostituisci');
  console.error('   i due scenari di esempio con quelli reali della campagna.');
  process.exit(1);
}

// Ordine di caricamento IDENTICO a index.html (main.js escluso: qui non serve la UI del titolo).
const FILES = [
  'js/sound.js', 'js/sprites.js', 'js/scenes.js', 'js/characters.js', 'js/campaign.js',
  'js/epilogues.js', 'js/rules.js', 'js/dice.js', 'js/combat.js', 'js/engine.js',
];
const SOURCES = FILES.map(f => ({ name: f, code: readFileSync(join(root, f), 'utf8') }));

let failures = 0;
function fail(msg) { failures++; console.error('  ❌ FAIL:', msg); }
function section(name) { console.log('\n▶', name); }

/* ==================== RNG SEEDABILE ==================== */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ==================== DOM FINTO MINIMALE ==================== */

function makeFakeCtx(canvasEl) {
  const store = { canvas: canvasEl };
  const noop = () => {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return () => ({ width: 8 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      return noop;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this._id = '';
    this._className = '';
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this._innerHTML = '';
    this._textContent = '';
    this.disabled = false;
    this.value = '';
    this.onclick = null;
    this.oninput = null;
    this.width = 300;
    this.height = 150;
    this.clientWidth = 300;
    this.clientHeight = 150;
    this._ctx = null;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this._listeners = {};
  }
  get id() { return this._id; }
  set id(v) { this._id = v; }
  get className() { return this._className; }
  set className(v) { this._className = String(v); }
  get classList() {
    const self = this;
    const toks = () => self._className.split(/\s+/).filter(Boolean);
    return {
      add: (...cls) => { const s = new Set(toks()); cls.forEach(c => s.add(c)); self._className = [...s].join(' '); },
      remove: (...cls) => { const s = new Set(toks()); cls.forEach(c => s.delete(c)); self._className = [...s].join(' '); },
      contains: (c) => toks().includes(c),
      toggle: (c) => { if (toks().includes(c)) self.classList.remove(c); else self.classList.add(c); },
    };
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; this.children = []; }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }
  // Alias tollerante: alcuni punti del gioco leggono .parentElement (standard DOM) invece
  // di .parentNode. Se non è mai stato collegato a nulla (es. i canvas), si auto-crea
  // un contenitore fittizio.
  get parentElement() {
    if (!this.parentNode) this.parentNode = new FakeElement('div');
    return this.parentNode;
  }
  set parentElement(v) { this.parentNode = v; }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); return child; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getContext(type) { if (!this._ctx) this._ctx = makeFakeCtx(this); return this._ctx; }
}

const CANVAS_SIZES = {
  'title-canvas': [480, 270], 'scene-canvas': [960, 360], 'combat-canvas': [960, 380],
  'dice-canvas': [140, 140], 'map-canvas': [720, 480],
};

const KNOWN_IDS_WITH_CLASS = {
  'screen-title': 'screen active', 'screen-howto': 'screen', 'screen-setup': 'screen',
  'screen-game': 'screen', 'screen-combat': 'screen',
  'modal-char': 'modal hidden', 'modal-generic': 'modal hidden', 'dice-overlay': 'modal hidden',
  'combat-banner': 'combat-banner hidden',
  'btn-dice-continue': 'btn btn-big hidden',
};

function makeDocument() {
  const elementsById = new Map();
  function getElementById(id) {
    if (!elementsById.has(id)) {
      const tag = /canvas/.test(id) ? 'canvas' : 'div';
      const el = new FakeElement(tag);
      el._id = id;
      if (KNOWN_IDS_WITH_CLASS[id] !== undefined) el.className = KNOWN_IDS_WITH_CLASS[id];
      if (CANVAS_SIZES[id]) { el.width = CANVAS_SIZES[id][0]; el.height = CANVAS_SIZES[id][1]; }
      elementsById.set(id, el);
    }
    return elementsById.get(id);
  }
  for (const id of Object.keys(KNOWN_IDS_WITH_CLASS)) getElementById(id);
  return {
    getElementById,
    createElement: (tag) => new FakeElement(tag),
    querySelectorAll(sel) {
      if (sel === '.screen') return [...elementsById.values()].filter(e => e.classList.contains('screen'));
      return [];
    },
    addEventListener() {},
  };
}

/* ==================== SANDBOX / CARICAMENTO SCRIPT ==================== */

const scriptCache = SOURCES.map(s => ({ name: s.name, script: new vm.Script(s.code, { filename: s.name }) }));
const scriptGetG = new vm.Script('(typeof G !== "undefined" ? G : null)');
const scriptGetApi = new vm.Script('({Engine, Combat, Dice, HEROES, BESTIARY, ITEMS, CAMPAIGN, CAMPAIGN_START, CHAPTERS, WORLD_MAP})');

function makeTimers() {
  let seq = 0;
  const timers = new Map();
  const pending = [];
  return {
    setTimeout(fn, _ms, ...args) {
      const id = ++seq;
      timers.set(id, { fn: () => fn(...args), repeat: false });
      pending.push(id);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, _ms, ...args) {
      const id = ++seq;
      timers.set(id, { fn: () => fn(...args), repeat: true });
      pending.push(id);
      return id;
    },
    clearInterval(id) { timers.delete(id); },
    drain(maxSteps = 200000) {
      let steps = 0;
      while (pending.length) {
        steps++;
        if (steps > maxSteps) throw new Error('I timer non si esauriscono (probabile loop infinito in un setTimeout/setInterval del gioco)');
        const id = pending.shift();
        const t = timers.get(id);
        if (!t) continue;
        t.fn();
        if (t.repeat && timers.has(id)) pending.push(id);
      }
    },
  };
}

function buildGame(seed) {
  const doc = makeDocument();
  const storage = new Map();
  const localStorage = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  };
  const consoleErrors = [];
  const timers = makeTimers();
  const sandbox = {
    document: doc,
    window: {},
    localStorage,
    console: { log() {}, warn() {}, error: (...a) => consoleErrors.push(a.map(String).join(' ')), info() {} },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    btoa: (x) => Buffer.from(x, 'binary').toString('base64'),
    atob: (x) => Buffer.from(x, 'base64').toString('binary'),
  };
  const context = vm.createContext(sandbox);
  for (const { name, script } of scriptCache) {
    try { script.runInContext(context); } catch (e) { throw new Error(`Errore caricando ${name}: ${e.message}`); }
  }
  const ctxMath = vm.runInContext('Math', context);
  const gameRandom = mulberry32(seed);
  ctxMath.random = gameRandom;

  const api = scriptGetApi.runInContext(context);
  const getG = () => scriptGetG.runInContext(context);
  function act(fn) {
    const r = fn();
    timers.drain();
    return r;
  }
  // Math.random pilotato SOLO per la durata di fn (dado forzato: 0.999 → 20, 0 → 1)
  function withForcedRandom(value, fn) {
    ctxMath.random = () => value;
    try { return fn(); } finally { ctxMath.random = gameRandom; }
  }
  return { context, doc, api, getG, consoleErrors, act, withForcedRandom };
}

/* ==================== UTILITA' DI INTERAZIONE ==================== */

function buttons(el) { return el.children.filter(c => c.tagName === 'BUTTON'); }
function enabledButtons(el) { return buttons(el).filter(b => !b.disabled); }

function matchButton(list, matcher) {
  if (matcher == null) return null;
  if (typeof matcher === 'string') return list.find(b => b.innerHTML.includes(matcher)) || null;
  if (matcher instanceof RegExp) return list.find(b => matcher.test(b.innerHTML)) || null;
  if (typeof matcher === 'function') return list.find(matcher) || null;
  return null;
}

// Cerca solo ": +N"/": -N" nel testo del bottone (es. "Saggezza: +2"): funziona con
// qualunque convenzione di etichetta purché il modificatore sia scritto così.
function statModFromButton(html) {
  const m = html.match(/:\s*([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
function hpRatioFromButton(html) {
  const m = html.match(/PV\s*(\d+)\s*\/\s*(\d+)/);
  return m ? parseInt(m[1], 10) / Math.max(1, parseInt(m[2], 10)) : 1;
}

// Testo della barra del gruppo (per verificare 👻 SPIRITO / 🕸 PRESO / PV)
function partyBarText(doc, id = 'party-bar') {
  const bar = doc.getElementById(id);
  const collect = el => [el._innerHTML || '', ...el.children.map(collect)].join(' ');
  return collect(bar);
}

/* ==================== CONTROLLI DI COERENZA DELLO STATO ==================== */

function checkInvariants(G, where) {
  if (!G) return;
  if (!Number.isFinite(G.gold) || G.gold < 0) {
    throw new Error(`STATO INCOERENTE: valuta invalida (${G.gold}) @ ${where}`);
  }
  for (const h of G.party) {
    if (!Number.isFinite(h.hp) || h.hp < 0 || h.hp > h.maxHp) {
      throw new Error(`STATO INCOERENTE: HP invalidi per "${h.id}" (${h.hp}/${h.maxHp}) @ ${where}`);
    }
    if (h.morto && h.hp !== 0) {
      throw new Error(`STATO INCOERENTE: SPIRITO con PV > 0 per "${h.id}" (${h.hp}) @ ${where}`);
    }
    if (h.veleno !== undefined && typeof h.veleno !== 'boolean') {
      throw new Error(`STATO INCOERENTE: h.veleno non booleano per "${h.id}" (${JSON.stringify(h.veleno)}) @ ${where}`);
    }
    if (h.preso !== undefined && typeof h.preso !== 'boolean') {
      throw new Error(`STATO INCOERENTE: h.preso non booleano per "${h.id}" (${JSON.stringify(h.preso)}) @ ${where}`);
    }
  }
  const vivi = G.party.filter(h => !h.morto).length;
  if (G.party.length && vivi === 0 && !/e_scambio|sacrificio/.test(where)) {
    throw new Error(`STATO INCOERENTE: TUTTO il gruppo risulta morto (killRoller sull'ultimo vivo?) @ ${where}`);
  }
  for (const hid of Object.keys(G.uses || {})) {
    for (const abid of Object.keys(G.uses[hid])) {
      const v = G.uses[hid][abid];
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`STATO INCOERENTE: usi negativi/non-numerici ${hid}.${abid} = ${v} @ ${where}`);
      }
    }
  }
}

/* ==================== STRATEGIA DI COMBATTIMENTO ==================== */

function classifyCombatMenu(btns) {
  if (btns.some(b => /^🎯/.test(b.innerHTML))) return 'target';
  if (btns.some(b => /^❤|^💀/.test(b.innerHTML))) return 'ally';
  return 'main';
}

function pickWeakestTarget(btns) {
  const targets = btns.filter(b => !/Indietro/.test(b.innerHTML));
  targets.sort((a, b) => hpRatioFromButton(a.innerHTML) - hpRatioFromButton(b.innerHTML));
  return targets[0] || btns[0];
}

function pickAllyForHealing(btns) {
  const allies = btns.filter(b => !/Indietro/.test(b.innerHTML));
  const down = allies.find(b => /A TERRA/.test(b.innerHTML));
  if (down) return down;
  allies.sort((a, b) => hpRatioFromButton(a.innerHTML) - hpRatioFromButton(b.innerHTML));
  return allies[0] || btns[0];
}

function pickMainCombatAction(btns, turnCounter, G) {
  const enabled = btns.filter(b => !b.disabled);
  if (!enabled.length) return btns[0];
  // gli SPIRITI non contano: la morte vera non si cura con le pozioni
  const needHeal = G && G.party.some(h => !h.morto && (h.down || h.hp / h.maxHp < 0.35));
  if (needHeal) {
    const healer = enabled.find(b => /Cura/i.test(b.innerHTML) && /^(✨|🧪)/.test(b.innerHTML));
    if (healer) return healer;
  }
  const attack = enabled.find(b => /^⚔/.test(b.innerHTML));
  const abilities = enabled.filter(b => /^✨/.test(b.innerHTML));
  const pool = [];
  if (attack) pool.push(attack);
  pool.push(...abilities);
  if (!pool.length) return enabled[0];
  return pool[turnCounter % pool.length];
}

function runCombat(game, scenario, state) {
  const { doc } = game;
  const LIMIT = 800;
  let steps = 0;
  let turnCounter = 0;
  while (true) {
    steps++;
    if (steps > LIMIT) throw new Error(`LOOP INFINITO sospetto nel combattimento (> ${LIMIT} azioni)`);

    const diceOverlay = doc.getElementById('dice-overlay');
    if (!diceOverlay.classList.contains('hidden')) {
      const btn = doc.getElementById('btn-dice-continue');
      if (typeof btn.onclick !== 'function') throw new Error('overlay dado visibile ma bottone "Continua" senza onclick');
      game.act(() => btn.onclick());
      checkInvariants(game.getG(), 'dopo tiro di dado in combattimento');
      continue;
    }
    const screenCombat = doc.getElementById('screen-combat');
    if (!screenCombat.classList.contains('active')) return; // combattimento risolto, siamo tornati alla scena

    const box = doc.getElementById('combat-actions');
    const btns = buttons(box);
    if (!btns.length) throw new Error('Nessuna azione di combattimento disponibile mentre "screen-combat" e\' attivo');

    const kind = classifyCombatMenu(btns);
    let chosen;
    if (state.strategy === 'passive' && kind === 'main') {
      chosen = btns.find(b => /Difesa totale/.test(b.innerHTML)) || enabledButtons(box)[0];
    } else if (kind === 'target') {
      chosen = pickWeakestTarget(btns);
    } else if (kind === 'ally') {
      chosen = pickAllyForHealing(btns);
    } else {
      chosen = pickMainCombatAction(btns, turnCounter++, game.getG());
    }
    if (!chosen) throw new Error(`Nessuna azione selezionabile in combattimento (kind=${kind})`);
    game.act(() => chosen.onclick());
    checkInvariants(game.getG(), 'dopo azione di combattimento');
  }
}

/* ==================== STRATEGIA DI NAVIGAZIONE SCENE ==================== */

// Gli hub e i corridoi rivisitabili usano "sequences": in ORDINE, quale bottone scegliere
// a ogni visita successiva della stessa scena.
function pickSceneChoice(sceneId, btns, scenario, state) {
  const seq = scenario.sequences && scenario.sequences[sceneId];
  if (seq && seq.length) {
    state.seqIdx = state.seqIdx || {};
    const idx = state.seqIdx[sceneId] || 0;
    if (idx < seq.length) {
      const m = matchButton(btns, seq[idx]);
      if (m) { state.seqIdx[sceneId] = idx + 1; return m; }
    }
  }
  const forced = scenario.choices && scenario.choices[sceneId];
  if (forced) {
    const m = matchButton(btns, forced);
    if (m) return m;
  }
  return btns[Math.floor(scenario.rand() * btns.length)];
}

function pickCheckHero(btns, scenario) {
  const bias = scenario.checkBias || 'random';
  if (bias === 'random') return btns[Math.floor(scenario.rand() * btns.length)];
  const withMod = btns.map(b => ({ b, mod: statModFromButton(b.innerHTML) }));
  withMod.sort((x, y) => (bias === 'best' ? y.mod - x.mod : x.mod - y.mod));
  return withMod[0].b;
}

// Esito forzato del prossimo tiro originato dalla scena sceneId ('success' | 'fail' | null).
// Un array viene consumato un elemento per tiro (es. { sceneId: ['fail','success'] }).
function forcedOutcomeFor(scenario, state, sceneId) {
  const co = scenario.checkOutcomes || {};
  let v = co[sceneId];
  if (Array.isArray(v)) {
    state.coIdx = state.coIdx || {};
    const i = state.coIdx[sceneId] || 0;
    v = i < v.length ? v[i] : v[v.length - 1];
    state.coIdx[sceneId] = i + 1;
  }
  return v || scenario.defaultCheckOutcome || null;
}

/* ==================== ESECUZIONE DI UNA PARTITA ==================== */

function runGame(scenario) {
  const game = buildGame(scenario.seed);
  scenario.rand = mulberry32(scenario.seed * 7919 + 13); // rand separato per le scelte, dal dado di gioco
  const { doc, api, getG } = game;
  const log = { scenes: [], ending: null, combats: 0, everMorto: new Set(), itemsEverOwned: new Set() };
  const state = { strategy: 'aggressive', forcedLossDone: false, seqIdx: {}, coIdx: {} };

  try {
    game.act(() => api.Engine.newGame(
      scenario.heroes.map(id => ({ heroId: id, player: '' })),
      null,
      scenario.difficulty || 'normale',
    ));
  } catch (e) {
    return { ok: false, scenario, error: `Engine.newGame ha lanciato un'eccezione: ${e.stack || e}`, log };
  }

  const STEP_LIMIT = 2500;
  let steps = 0;
  try {
    checkInvariants(getG(), 'dopo newGame');
    while (true) {
      steps++;
      if (steps > STEP_LIMIT) throw new Error(`LOOP INFINITO sospetto nella navigazione (> ${STEP_LIMIT} passi totali)`);

      const G = getG();
      const sceneId = G.sceneId;
      const scene = api.CAMPAIGN[sceneId];
      if (!scene) throw new Error(`Scena non trovata: "${sceneId}" (riferita da qualche parte ma assente in CAMPAIGN)`);
      log.scenes.push(sceneId);
      for (const h of G.party) if (h.morto) log.everMorto.add(h.id);
      for (const it of G.inventory) log.itemsEverOwned.add(it);

      if (scene.ending) { log.ending = sceneId; break; }

      /* Modali generiche, in ordine di riconoscimento:
         1) offerta di ritiro col dado (bottoni via innerHTML + getElementById);
         2) modale di SACRIFICIO (bottoni-eroe reali + bottone di rifiuto);
         3) selezione eroe per una prova (bottoni-eroe reali, con eventuale esito forzato);
         4) modale solo informativa (nessun handler JS reale: si chiude, come farebbe
            un browser che non esegue gli onclick scritti dentro l'HTML statico). */
      const modalGeneric = doc.getElementById('modal-generic');
      if (!modalGeneric.classList.contains('hidden')) {
        const content = doc.getElementById('modal-generic-content');

        if (/btn-reroll-yes/.test(content.innerHTML)) {
          const yes = doc.getElementById('btn-reroll-yes');
          const no = doc.getElementById('btn-reroll-no');
          const btn = scenario.acceptReroll ? yes : no;
          if (typeof btn.onclick !== 'function') throw new Error('modale di ritiro del dado senza handler');
          const fn = btn.onclick;
          yes.onclick = null; no.onclick = null; // niente handler stantii al prossimo giro
          game.act(() => fn());
          checkInvariants(getG(), `dopo offerta di ritiro (dado) in "${sceneId}"`);
          continue;
        }

        const btns = buttons(content);
        const clickable = btns.filter(b => typeof b.onclick === 'function');
        if (!clickable.length) { modalGeneric.classList.add('hidden'); continue; }

        // NB: il bottone di rifiuto è spesso creato con textContent, non innerHTML —
        // vanno letti entrambi (lezione: gli stub del DOM tradiscono su questa differenza).
        const btnText = b => (b.innerHTML || '') + (b.textContent || '');
        if (clickable.some(b => /Riparliamone|Non ancora|Rifiuta/.test(btnText(b)))) {
          // modale di sacrificio: si sceglie CHI resta
          const heroBtns = clickable.filter(b => !/Riparliamone|Non ancora|Rifiuta/.test(btnText(b)));
          const chosen = (scenario.sacrificeHero && matchButton(heroBtns, scenario.sacrificeHero)) || heroBtns[0];
          if (!chosen) throw new Error(`modale di sacrificio senza eroi selezionabili in "${sceneId}"`);
          game.act(() => chosen.onclick());
          checkInvariants(getG(), `dopo sacrificio in "${sceneId}"`);
          continue;
        }

        const chosen = pickCheckHero(clickable, scenario);
        const outcome = forcedOutcomeFor(scenario, state, sceneId);
        if (outcome === 'success') game.withForcedRandom(0.999, () => game.act(() => chosen.onclick()));
        else if (outcome === 'fail') game.withForcedRandom(0, () => game.act(() => chosen.onclick()));
        else game.act(() => chosen.onclick());
        checkInvariants(getG(), `dopo scelta eroe per prova in "${sceneId}"`);
        continue;
      }

      const diceOverlay = doc.getElementById('dice-overlay');
      if (!diceOverlay.classList.contains('hidden')) {
        const btn = doc.getElementById('btn-dice-continue');
        if (typeof btn.onclick !== 'function') throw new Error('overlay dado visibile ma bottone "Continua" senza onclick');
        game.act(() => btn.onclick());
        checkInvariants(getG(), `dopo tiro di dado fuori combattimento (scena "${sceneId}")`);
        continue;
      }

      if (scene.combat) {
        log.combats++;
        const box = doc.getElementById('choices');
        const startBtn = buttons(box)[0];
        if (!startBtn) throw new Error(`Bottone per iniziare il combattimento mancante in scena "${sceneId}"`);
        if (scenario.forceLossAt === sceneId && !state.forcedLossDone) {
          state.strategy = 'passive'; // solo Difesa totale: la sconfitta è garantita
          state.forcedLossDone = true;
        } else {
          state.strategy = 'aggressive';
        }
        game.act(() => startBtn.onclick());
        runCombat(game, scenario, state);
        checkInvariants(getG(), `dopo combattimento originato da "${sceneId}"`);
        continue;
      }

      const choicesBox = doc.getElementById('choices');
      const btns = enabledButtons(choicesBox);
      if (!btns.length) throw new Error(`Nessuna scelta disponibile in scena "${sceneId}" (vicolo cieco a runtime)`);
      const chosen = pickSceneChoice(sceneId, btns, scenario, state);
      if (!chosen) throw new Error(`pickSceneChoice non ha selezionato nulla in scena "${sceneId}"`);
      game.act(() => chosen.onclick());
      checkInvariants(getG(), `dopo scelta in "${sceneId}"`);
    }
  } catch (e) {
    return { ok: false, scenario, error: e.stack || String(e), log };
  }

  if (game.consoleErrors.length) {
    return { ok: false, scenario, error: `console.error catturati durante la partita: ${game.consoleErrors.join(' | ')}`, log };
  }
  const G = getG();
  log.flags = { ...(G.flags || {}) };
  log.inventory = [...(G.inventory || [])];
  log.gold = G.gold;
  log.finalParty = G.party.map(h => ({ id: h.id, hp: h.hp, maxHp: h.maxHp, morto: !!h.morto, down: !!h.down }));
  log.partyBar = partyBarText(doc);
  log.everMorto = [...log.everMorto];
  log.itemsEverOwned = [...log.itemsEverOwned];
  return { ok: true, scenario, log };
}

/* ==================== DEFINIZIONE DEGLI SCENARI ====================
   Ogni scenario è una partita pilotata dall'inizio a una scena `ending: true` (o a una
   sconfitta voluta). scenario(...) assembla un oggetto con questi campi:

   - heroes: array di ID eroe (come in HEROES) da mettere nel party per questa partita.
   - choices: { idScena: matcher } — quando la partita arriva sulla scena idScena, si clicca
     il PRIMO bottone il cui testo combacia col matcher (stringa = sottostringa, oppure
     RegExp, oppure funzione bottone=>bool). Le scene non elencate né in `choices` né in
     `sequences` scelgono a caso (RNG seedato: la run resta comunque riproducibile).
   - sequences: { idScena: [matcher1, matcher2, ...] } — per le scene RIVISITABILI (hub,
     corridoi con ritorno): al primo passaggio si usa matcher1, al secondo matcher2, ecc.
   - checkOutcomes: { idScena: 'success' | 'fail' | ['fail','success', ...] } — forza
     l'esito del PROSSIMO tiro di dado originato da quella scena, per rendere deterministico
     un percorso che dipende dal dado. Un array si consuma un elemento per ogni tiro
     successivo dalla stessa scena (es. prima fallisce, poi riesce al secondo tentativo).
   - sacrificeHero: matcher del bottone-eroe da cliccare quando compare la modale di
     sacrificio (se il gioco ne prevede una). Se assente, si sceglie il primo eroe proposto.
   - forceLossAt: id di una scena di combattimento in cui si vuole PERDERE apposta (l'harness
     userà solo "Difesa totale", garantendo la sconfitta) — utile per testare la scena di
     sconfitta e la ripresa.
   - verify(r, expect): dopo la partita, r.log contiene { scenes, ending, combats, flags,
     inventory, gold, finalParty, everMorto, itemsEverOwned, partyBar }. expect(cond, msg)
     registra un fallimento se cond è falsa, senza interrompere le altre verifiche in corso.

   Scrivere UNO scenario per ogni finale/percorso importante da coprire: ogni boss, ogni
   oggetto chiave, le morti e le resurrezioni (se il gioco le prevede), le sconfitte volute,
   party di dimensioni diverse. Due esempi minimi sotto: sostituirli con quelli veri. */

function scenario(name, heroes, choices, opts = {}) {
  return {
    name,
    seed: opts.seed ?? nextSeed(),
    heroes,
    choices: { ...choices },
    sequences: { ...(opts.sequences || {}) },
    checkBias: opts.checkBias || 'best',
    checkOutcomes: { ...(opts.checkOutcomes || {}) },
    defaultCheckOutcome: opts.defaultCheckOutcome || null,
    sacrificeHero: opts.sacrificeHero || null,
    forceLossAt: opts.forceLossAt || null,
    acceptReroll: !!opts.acceptReroll,
    difficulty: opts.difficulty || 'normale',
    verify: opts.verify || null, // (r, expect) => void
  };
}

let seedCounter = 1;
function nextSeed() { return seedCounter++ * 104729; }

const scenarios = [];

/* ---- ESEMPIO 1: percorso principale fino a un finale ----
   Aggiungere in `choices` tutte le scelte forzate necessarie a percorrere la strada che si
   vuole testare, e aggiornare CONFIG.sceneFinale con l'id vero del finale raggiunto. */
scenarios.push(scenario(
  'esempio — percorso principale fino a un finale',
  CONFIG.eroiEsempio,
  {
    // [CONFIG.unaSceneScelta]: 'testo (anche parziale) del bottone da cliccare qui',
  },
  {
    difficulty: 'facile',
    verify: (r, expect) => {
      expect(r.log.ending === CONFIG.sceneFinale, `finale atteso "${CONFIG.sceneFinale}", trovato "${r.log.ending}"`);
      expect(r.log.everMorto.length === 0, `morti inattesi nella run pulita: ${r.log.everMorto.join(', ')}`);
    },
  }));

/* ---- ESEMPIO 2: sconfitta di proposito e ripresa ----
   forceLossAt fa perdere apposta il combattimento indicato (per testare la scena di
   sconfitta e la rivincita); la partita prosegue poi verso un finale come nell'esempio 1. */
scenarios.push(scenario(
  'esempio — sconfitta voluta e ripresa',
  CONFIG.eroiEsempio,
  {},
  {
    difficulty: 'facile',
    forceLossAt: CONFIG.sceneCombattimento,
    verify: (r, expect) => {
      expect(r.log.combats >= 1, 'nessun combattimento affrontato');
      expect(r.log.ending, `nessun finale raggiunto (${r.log.ending})`);
    },
  }));

/* ==================== ESECUZIONE ==================== */

section('Simulazione di partite complete (headless)');

const results = [];
function execute(sc) {
  const r = runGame(sc);
  results.push(r);
  const endingTxt = r.ok ? (r.log.ending || '(nessun finale?!)') : 'ERRORE';
  console.log(`  ${r.ok ? '✅' : '❌'} [seed ${sc.seed}] ${sc.name} — scene: ${r.log.scenes.length}, combattimenti: ${r.log.combats}, esito: ${endingTxt}`);
  if (!r.ok) { console.error(`      ↳ ${r.error.split('\n')[0]}`); return r; }
  if (sc.verify) {
    const expect = (cond, msg) => { if (!cond) fail(`[${sc.name}] ${msg}`); };
    try { sc.verify(r, expect); } catch (e) { fail(`[${sc.name}] verifica esplosa: ${e.message}`); }
  }
  return r;
}

console.log(`  Esecuzione di ${scenarios.length} partite pilotate...\n`);
for (const sc of scenarios) execute(sc);

const fatalRuns = results.filter(r => !r.ok);
for (const r of fatalRuns) fail(`Partita "${r.scenario.name}" (seed ${r.scenario.seed}): ${r.error.split('\n')[0]}`);

/* ==================== VERIFICA DELLA COPERTURA ====================
   Utilità pronte per controllare che le run coprano scene/flag/oggetti specifici della
   campagna: decommentare e adattare gli id man mano che si aggiungono scenari.

   const okRuns = results.filter(r => r.ok);
   const allScenesSeen = new Set(okRuns.flatMap(r => r.log.scenes));
   const allEndings = new Set(okRuns.filter(r => r.log.ending).map(r => r.log.ending));
   const allFlagsSeen = new Set(okRuns.filter(r => r.log.flags).flatMap(r => Object.keys(r.log.flags).filter(k => r.log.flags[k])));
   const allItemsSeen = new Set(okRuns.flatMap(r => r.log.itemsEverOwned || []));

   function coverage(label, sceneIds) {
     const seen = sceneIds.filter(id => allScenesSeen.has(id));
     const ok = seen.length === sceneIds.length;
     console.log(`  ${ok ? '✅' : '❌'} ${label}: ${seen.join(', ') || '(nessuna)'}`);
     if (!ok) fail(`${label}: mancano ${sceneIds.filter(id => !allScenesSeen.has(id)).join(', ')}`);
   }
   // coverage('Un ramo importante', ['scena1', 'scena2', 'scena3']);
   // coverageFlag/coverageItem seguono lo stesso schema su allFlagsSeen/allItemsSeen. */

/* ==================== VERIFICHE DIRETTE ====================
   Oltre alle partite complete, si possono testare direttamente funzioni dell'Engine senza
   attraversare tutta la campagna: costruire una partita, saltare a una scena con
   Engine.gotoScene, e controllare lo stato. Esempio generico e riusabile così com'è:
   salvataggio, ricarica e roundtrip export/import di un codice partita. */

(function testSalvataggioRicarica() {
  section('Verifica diretta: salvataggio/ricarica + codici di esportazione (roundtrip)');
  const game = buildGame(6666);
  const E = game.api.Engine;
  game.act(() => E.newGame(CONFIG.eroiEsempio.map(id => ({ heroId: id, player: '' })), 1));
  game.act(() => E.gotoScene(CONFIG.unaSceneScelta));
  const G1 = game.getG();
  G1.gold = 7;
  const sceneDopo = G1.sceneId;
  // ricarica dallo stesso slot
  game.act(() => E.loadGame(1));
  let G2 = game.getG();
  if (G2.sceneId !== sceneDopo) fail(`saveLoad: scena attesa "${sceneDopo}" dopo loadGame, trovata "${G2.sceneId}"`);
  if (G2.gold !== 7) fail('saveLoad: lo stato (es. la valuta) non è sopravvissuto alla ricarica');
  // "altro dispositivo": export → import su slot diverso → load
  const code = E.exportCode(1);
  if (!code) { fail('saveLoad: exportCode ha restituito null'); return; }
  const err = E.importCode(code, 3);
  if (err) { fail('saveLoad: importCode ha rifiutato il proprio codice: ' + err); return; }
  game.act(() => E.loadGame(3));
  G2 = game.getG();
  if (G2.sceneId !== sceneDopo || G2.gold !== 7) fail('saveLoad: stato corrotto dopo il viaggio export/import');
  if (E.importCode('non-un-codice!!!', 3) === null) fail('saveLoad: un codice spazzatura è stato accettato');
  console.log('  ✅ Salvataggio, ricarica, export/import tra slot: stato integro e spazzatura rifiutata');
})();

/* Altre meccaniche del motore condiviso testabili con lo stesso pattern (costruire una
   partita, saltare a una scena, chiamare la funzione Engine, controllare lo stato) se il
   gioco le usa: killRoller (nessun tiro uccide MAI l'ultimo vivo del party), unlockHero
   (un eroe si aggiunge a runtime, modale ritardata drenata dai timer), useRevive/
   applyRevive (resurrezione da SPIRITO con un oggetto), useAntidote/applyAntidote (cura di
   uno stato alterato), startChapter/reviveUnlocked (rigioca-capitoli sbloccato dopo un
   finale). Vedi js/engine.js per le firme esatte. */

/* ==================== ESITO FINALE ==================== */

section('Copertura totale della campagna');
{
  const okRuns = results.filter(r => r.ok);
  const allScenesSeen = new Set(okRuns.flatMap(r => r.log.scenes));
  const allEndings = new Set(okRuns.filter(r => r.log.ending).map(r => r.log.ending));
  const probe = buildGame(999999);
  const allCampaignIds = Object.keys(probe.api.CAMPAIGN);
  const unseen = allCampaignIds.filter(id => !allScenesSeen.has(id));
  console.log(`  Scene distinte visitate: ${allScenesSeen.size} / ${allCampaignIds.length}`);
  console.log(`  Finali raggiunti: ${allEndings.size} (${[...allEndings].join(', ') || '(nessuno)'})`);
  console.log(`  Scene MAI visitate (${unseen.length}): ${unseen.join(', ') || '(nessuna)'}`);
}

console.log('\n' + '═'.repeat(60));
if (failures === 0) {
  const okRuns = results.filter(r => r.ok);
  const allScenesSeen = new Set(okRuns.flatMap(r => r.log.scenes));
  const allEndings = new Set(okRuns.filter(r => r.log.ending).map(r => r.log.ending));
  console.log(`✅ TUTTE LE PARTITE SIMULATE COMPLETATE SENZA ERRORI (${results.length} run, ${allScenesSeen.size} scene distinte visitate, ${allEndings.size} finali)`);
  process.exit(0);
} else {
  console.log(`❌ ${failures} PROBLEMI RILEVATI su ${results.length} partite simulate`);
  process.exit(1);
}
