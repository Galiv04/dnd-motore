/* ============ PLAYTHROUGH — simulazioni complete headless (no browser) ============
   Uso: node tests/playthrough.mjs

   Basato sull'harness collaudato del Relais (a sua volta figlio della Corona):
   carica engine.js, combat.js, dice.js (+ dati) in un vm.Context Node con uno stub
   minimale di document/localStorage/timer, e gioca partite complete cliccando
   programmaticamente i bottoni generati dal gioco (choices, azioni di combattimento,
   overlay dei dadi, selezione eroe per le prove), esattamente come farebbe un utente.

   Novità della Casa gestite dall'harness:
   - unlockHero (Daniele): la modale arriva con setTimeout(600) → la coda timer dello
     stub la DRENA dentro act(), e la modale (solo informativa) viene chiusa.
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

// La Casa scrive il nome completo della statistica ("Saggezza: +2"): il pattern
// cerca solo ": +N"/": -N" (identico al Relais).
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
    throw new Error(`STATO INCOERENTE: Colore invalido (${G.gold}) @ ${where}`);
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

// L'hub h1 e il corridoio u1 si rivisitano: le "sequences" per-scenario indicano,
// in ORDINE, quale bottone scegliere a ogni visita successiva della stessa scena.
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
// Un array viene consumato un elemento per tiro (es. u6: ['fail','success']).
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
         1) offerta di ritiro col d20 di Daniele (bottoni via innerHTML + getElementById);
         2) modale di SACRIFICIO (bottoni-eroe reali + "Riparliamone");
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
          if (typeof btn.onclick !== 'function') throw new Error('modale del d20 di Daniele senza handler');
          const fn = btn.onclick;
          yes.onclick = null; no.onclick = null; // niente handler stantii al prossimo giro
          game.act(() => fn());
          checkInvariants(getG(), `dopo offerta di ritiro (d20) in "${sceneId}"`);
          continue;
        }

        const btns = buttons(content);
        const clickable = btns.filter(b => typeof b.onclick === 'function');
        if (!clickable.length) { modalGeneric.classList.add('hidden'); continue; }

        // NB: il bottone "Riparliamone" è creato con textContent, non innerHTML — vanno letti entrambi
        const btnText = b => (b.innerHTML || '') + (b.textContent || '');
        if (clickable.some(b => /Riparliamone/.test(btnText(b)))) {
          // modale di sacrificio: il tavolo sceglie CHI resta
          const heroBtns = clickable.filter(b => !/Riparliamone/.test(btnText(b)));
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
        if (!startBtn) throw new Error(`Bottone "INIZIA IL COMBATTIMENTO" mancante in scena "${sceneId}"`);
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

/* ==================== DEFINIZIONE DEGLI SCENARI ==================== */

let seedCounter = 1;
function nextSeed() { return seedCounter++ * 104729; }

// Piste standard dall'hub: biblioteca, poi porte, poi lo snodo m1 (che si apre con due piste).
const DEFAULT_SEQUENCES = {
  h1: ['La porta dei libri', 'Il corridoio delle porte', 'Seguire il suono'],
  u1: ['La porta "1994"', 'La porta "GAETA"', 'La porta "IMBARCO"', 'Chiudere col corridoio'],
};

// Scelte "felici" di default per ogni scena che potrebbe presentarsi: ogni scenario
// ne eredita una copia e sovrascrive solo le chiavi che gli interessano.
const BASE_CHOICES = {
  /* prologo + soglia */
  a0: '🔔 Citofonare',
  a2: '🔑 Aprire con le chiavi',
  a3: '🍳 Prima la cucina',
  a4: '🚿 Controllare il bagno',
  a7_ko: '⚔️ Ai topi',
  s3: '🤬 Lasciar parlare Federico',
  s4: 'RIPROVA SOCIALE',
  /* biblioteca */
  b1: '🚶 Inoltrarsi',
  b2: 'Portaci alla sezione',
  b3: 'Fermarsi a leggere',
  b5: 'Attraversare la sala',
  b7: 'Strappare la catena',
  b8b: 'Riprovare',
  b9: 'Portare il segreto',
  b_ko: 'RIVINCITA',
  /* porte */
  u5: 'Sfilare la foto',
  u5b: 'Ricomporre la foto',
  u_ko: 'Tornare là dentro',
  /* cucina */
  k1: 'Seguire la freccia',
  k2: 'Non aprire',
  k3: 'Prendere anche le birre',
  k4: 'Calarsi in cordata',
  k4b: 'Tornare alla botola',
  k6: 'Lasciare il banco',
  k8: 'Lasciar stare',
  k9: 'Gaetano tenta la sequenza',
  k_ko: 'Tornare giù',
  /* snodo */
  m3: 'Accoppiare il joy-con',
  m6: 'Dargli la Zero',
  m_ko: 'Di nuovo addosso',
  /* finale */
  z_ko: 'Ancora',
  z3: 'STRAWMAN',
  z4: 'FALSA DICOTOMIA',
  z5: 'RICATTO EMOTIVO',
};

// Esiti forzati standard: le prove che APRONO contenuti (joycon, foto, calata in cucina)
// riescono; tutto il resto va a dado naturale.
const HAPPY_CHECKS = { u2: 'success', u5: 'success', b5: 'success', b8: 'success', k4: 'success', k9: 'success' };

function scenario(name, heroes, choices, opts = {}) {
  return {
    name,
    seed: opts.seed ?? nextSeed(),
    heroes,
    choices: { ...BASE_CHOICES, ...choices },
    sequences: { ...DEFAULT_SEQUENCES, ...(opts.sequences || {}) },
    checkBias: opts.checkBias || 'best',
    checkOutcomes: { ...HAPPY_CHECKS, ...(opts.checkOutcomes || {}) },
    defaultCheckOutcome: opts.defaultCheckOutcome || null,
    sacrificeHero: opts.sacrificeHero || null,
    forceLossAt: opts.forceLossAt || null,
    acceptReroll: !!opts.acceptReroll,
    difficulty: opts.difficulty || 'normale',
    verify: opts.verify || null, // (r, expect) => void
  };
}

const scenarios = [];

/* ---- 1. FINALE e_parola — modalità Sopravvissuto (party di 1) ----
   Prologo → soglia → biblioteca COMPLETA (manuale + note + segreto dello specchio)
   → porte (foto ricomposta + joycon) → m1 → liberazione col joycon → boss m8 →
   z2 via della Parola → duello z3/z4/z5 con le risposte GIUSTE → e_parola. */
scenarios.push(scenario(
  'e_parola — Sopravvissuto: Natalino SOLO, biblioteca+porte complete, duello perfetto',
  ['natalino'],
  { z2: 'Smontiamolo' },
  {
    difficulty: 'facile',
    verify: (r, expect) => {
      expect(r.log.ending === 'e_parola', `finale atteso e_parola, trovato ${r.log.ending}`);
      expect(r.log.flags.segreto_specchio, 'flag segreto_specchio non impostato (biblioteca completa)');
      expect(r.log.flags.manuale_annotato_letto, 'flag manuale_annotato_letto non impostato');
      expect(r.log.flags.foto_ricomposta, 'flag foto_ricomposta non impostato');
      expect(r.log.flags.daniele_in_squadra, 'Daniele non risulta in squadra dopo m6 (unlockHero)');
      expect(r.log.finalParty.some(h => h.id === 'daniele'), 'Daniele assente dal party finale');
      expect(r.log.everMorto.length === 0, `morti inattesi nella run pulita: ${r.log.everMorto.join(', ')}`);
      expect(r.log.itemsEverOwned.includes('joycon_sinistro'), 'joycon_sinistro mai ottenuto');
      expect(r.log.scenes.includes('m4'), 'la liberazione col joycon (m4) non risulta usata');
      expect(['z3', 'z4', 'z5', 'z5b'].every(s => r.log.scenes.includes(s)), 'duello z3→z4→z5→z5b incompleto');
      expect(!r.log.scenes.includes('z3_colpo') && !r.log.scenes.includes('z4_colpo'), 'risposte sbagliate in una run che doveva essere perfetta');
      expect(r.log.flags.solo === true, 'flag solo non impostato in modalità Sopravvissuto');
    },
  }));

/* ---- 2. FINALE e_parola con DUELLO SBAGLIATO DUE VOLTE in z4 (killRoller) ----
   Stesso percorso, ma in z4 si sbaglia due volte: la PRIMA visita a z4_colpo uccide
   DAVVERO chi ha tirato l'ultimo dado (killRoller); la vittoria finale (e_parola,
   reviveAll) lo riporta indietro. */
scenarios.push(scenario(
  'e_parola — duello sbagliato DUE volte in z4: killRoller uccide, reviveAll ripara',
  ['gaetano', 'emanuela'],
  { z2: 'Smontiamolo' },
  {
    difficulty: 'facile',
    sequences: { z4: ['AUTORITÀ', 'SCARSITÀ', 'FALSA DICOTOMIA'] },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_parola', `finale atteso e_parola, trovato ${r.log.ending}`);
      const colpi = r.log.scenes.filter(s => s === 'z4_colpo').length;
      expect(colpi >= 2, `z4_colpo atteso 2 volte, visto ${colpi}`);
      expect(r.log.everMorto.length >= 1, 'killRoller in z4_colpo non ha ucciso nessuno (G.lastRoller?)');
      expect(r.log.finalParty.every(h => !h.morto), 'reviveAll di e_parola non ha riportato indietro gli spiriti');
    },
  }));

/* ---- 3. FINALE e_gemelli — piste porte+cucina, via dei Gemelli ---- */
scenarios.push(scenario(
  'e_gemelli — porte+cucina, foto ricomposta, z2 via dei Gemelli (CAR riuscita)',
  ['federico', 'claudia'],
  { z2: 'La foto' },
  {
    difficulty: 'facile',
    sequences: { h1: ['Il corridoio delle porte', 'La porta fredda', 'Seguire il suono'] },
    checkOutcomes: { z6: 'success' },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_gemelli', `finale atteso e_gemelli, trovato ${r.log.ending}`);
      expect(r.log.flags.segreto_gemelli, 'flag segreto_gemelli non impostato (stanza 1994)');
      expect(r.log.flags.foto_ricomposta, 'flag foto_ricomposta non impostato');
      expect(r.log.flags.gemelli_pace, 'flag gemelli_pace non impostato (z6)');
      expect(r.log.scenes.includes('k10') && r.log.scenes.includes('u8'), 'una delle due piste (porte/cucina) non è stata completata');
      expect(r.log.finalParty.every(h => !h.morto), 'reviveAll di e_gemelli non ha funzionato');
    },
  }));

/* ---- 4. FINALE e_colori — party di 5, scene di respiro dell'hub, battaglia z7 ----
   Copre anche h2 (il cerchio del tronello: RICHIEDE il tronello di partenza),
   h3 (racchettoni), h4 (bivacco) e la sveglia dei Sonnambuli (eco nel boss). */
scenarios.push(scenario(
  'e_colori — 5 giocatori, respiro all\'hub (tronello/racchettoni/bivacco), battaglia z7 vinta',
  ['gaetano', 'natalino', 'claudia', 'federico', 'emanuela'],
  { z2: 'Basta parlare', m3: 'Cercare un\'altra via' },
  {
    sequences: { h1: ['Un momento. Un momento SOLO', 'Claudia e Gaetano scaldano', 'Bivacco', 'La porta dei libri', 'La porta fredda', 'Seguire il suono'] },
    checkOutcomes: { m3: 'success' },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_colori', `finale atteso e_colori, trovato ${r.log.ending}`);
      expect(r.log.scenes.includes('h2'), 'h2 (cerchio del tronello) non raggiunto: manca il tronello di partenza?');
      expect(r.log.flags.fumo_mappa && r.log.flags.racchettoni_pronti && r.log.flags.bivacco_fatto, 'flag delle scene di respiro mancanti');
      expect(r.log.flags.sonnambuli_svegli, 'flag sonnambuli_svegli non impostato (k9 riuscita)');
      expect(r.log.flags.eleinad_distrutto, 'flag eleinad_distrutto non impostato (z8)');
      expect(r.log.scenes.includes('z7') && r.log.scenes.includes('z8'), 'battaglia z7→z8 non attraversata');
    },
  }));

/* ---- 5. FINALE e_scambio + MERCANTE — si compra Boccata di Colore e Cuore di Colore ----
   Tutti i tiri riescono (defaultCheckOutcome) per accumulare Colore; alla cucina si
   passa dal citofono (Luca Giunti!) e dal frigo, poi il banco del Mercante: Boccata
   (3🎨) e CUORE DI COLORE (12🎨 + il tronello). Chiusura: z9, la modale di sacrificio
   sceglie Emanuela, e_scambio. */
scenarios.push(scenario(
  'e_scambio + Mercante — boccata_colore e cuore_colore comprati, sacrificio di Emanuela',
  ['natalino', 'emanuela'],
  {
    a0: 'Claudia guarda le finestre',
    a4: 'Cercare come cercherebbe un amico',
    z2: 'Ascoltare l\'offerta',
    z9: 'Accettare lo scambio',
  },
  {
    difficulty: 'facile',
    defaultCheckOutcome: 'success',
    sacrificeHero: 'Emanuela',
    sequences: {
      h1: ['La porta fredda', 'La porta dei libri', 'Seguire il suono'],
      k1: ['Il citofono', 'Frugare il frigo'],
      k6: ['Boccata di Colore', 'CUORE DI COLORE', 'Il Divano-Trono'],
    },
    choicesOverride: null,
    checkOutcomes: { m3: 'success' },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_scambio', `finale atteso e_scambio, trovato ${r.log.ending}`);
      expect(r.log.itemsEverOwned.includes('boccata_colore'), 'boccata_colore mai comprata dal Mercante');
      expect(r.log.itemsEverOwned.includes('cuore_colore'), 'cuore_colore mai comprato dal Mercante (Colore o tronello mancanti?)');
      expect(!r.log.inventory.includes('tronello'), 'il tronello doveva essere ceduto al Mercante per il Cuore');
      expect(r.log.flags.segreto_trono, 'flag segreto_trono non impostato (k7)');
      expect(r.log.flags.luca_promosso, 'flag luca_promosso non impostato (citofono k2 → Luca Giunti sconfitto)');
      expect(r.log.flags.sacrificio_emanuela, 'flag sacrificio_emanuela non impostato dalla modale di sacrificio');
      const morti = r.log.finalParty.filter(h => h.morto).map(h => h.id);
      expect(morti.length === 1 && morti[0] === 'emanuela', `atteso solo emanuela spirito, trovato: ${morti.join(', ') || '(nessuno)'}`);
      expect(r.log.gold >= 0, 'Colore negativo dopo gli acquisti');
    },
  }));
scenarios[scenarios.length - 1].choices.m3 = 'Cercare un\'altra via'; // niente joycon in questa run

/* ---- 6. FINALE e_grigio — sconfitta VOLUTA a z7, poi la resa ---- */
scenarios.push(scenario(
  'e_grigio — sconfitta voluta contro ELEINAD (z7), z_ko, resa',
  ['gaetano', 'claudia'],
  { z2: 'Basta parlare', z_ko: 'Non alzarsi più' },
  {
    difficulty: 'facile',
    sequences: { h1: ['Il corridoio delle porte', 'La porta fredda', 'Seguire il suono'] },
    forceLossAt: 'z7',
    verify: (r, expect) => {
      expect(r.log.ending === 'e_grigio', `finale atteso e_grigio, trovato ${r.log.ending}`);
      expect(r.log.scenes.includes('z_ko'), 'z_ko (sconfitta al boss) mai raggiunta');
      expect(r.log.flags.finale_grigio, 'flag finale_grigio non impostato');
      expect(r.log.everMorto.length === 0, 'la sconfitta in combattimento non deve creare SPIRITI (solo a terra)');
    },
  }));

/* ---- 7. MORTE VERA a u6 + SPIRITO fino alla fine (e_colori NON rianima) ----
   La prova di COS a u6 viene FORZATA a fallire: killRoller uccide chi ha tirato,
   che resta 👻 SPIRITO. Si ritenta (successo forzato) e si prende il Cuore di Colore
   dall'acqua — che resta nello zaino, non usato. Lo spirito apre le scelte dedicate
   (u9, z2b) e a e_colori è ANCORA spirito: quel finale non rianima nessuno. */
scenarios.push(scenario(
  'morte vera a u6 — spirito, porta dei morti (u9), z2b, e_colori senza resurrezione',
  ['claudia', 'federico', 'natalino'],
  { u6: 'Immergersi', u6_morte: 'si ritenta', z2: 'Basta parlare' },
  {
    difficulty: 'facile',
    sequences: {
      h1: ['Il corridoio delle porte', 'La porta fredda', 'Seguire il suono'],
      u1: ['La porta "NON APRIRE"', 'La porta senza targhetta', 'La porta "1994"', 'La porta "IMBARCO"', 'Chiudere col corridoio'],
      z2: ['I morti non ti temono', 'Basta parlare'],
    },
    checkOutcomes: { u6: ['fail', 'success'] },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_colori', `finale atteso e_colori, trovato ${r.log.ending}`);
      expect(r.log.scenes.includes('u6_morte'), 'u6_morte mai raggiunta (la prova forzata a fallire non è fallita)');
      expect(r.log.everMorto.length === 1, `atteso esattamente 1 morto vero, trovati: ${r.log.everMorto.join(', ') || '(nessuno)'}`);
      const spiriti = r.log.finalParty.filter(h => h.morto);
      expect(spiriti.length === 1, 'lo spirito doveva RESTARE spirito a e_colori (niente reviveAll lì)');
      expect(/SPIRITO/.test(r.log.partyBar), 'la barra del gruppo non mostra 👻 SPIRITO per il morto vero');
      expect(r.log.flags.indizio_spiriti, 'la porta senza targhetta (u9, solo spiriti) non è stata aperta');
      expect(r.log.flags.eleinad_vacilla, 'z2b (la scelta degli Spiriti) non è stata usata');
      expect(r.log.inventory.includes('cuore_colore'), 'il Cuore di Colore pescato a u6 non risulta nello zaino');
      expect(r.log.scenes.includes('u6b') || r.log.scenes.includes('u6c'), 'il secondo tentativo a u6 (successo forzato) non è avvenuto');
    },
  }));

/* ==================== SECONDA ONDATA — NUOVI SCENARI (137 → 184 scene) ====================
   La campagna è passata da 137 a 184 scene: i contenuti nuovi sono agganciati come scelte
   IN CODA agli array `choices` di scene esistenti (spesso `once: true`), quindi gli scenari
   1-7 sopra — verdi ma scritti per la prima ondata — non li attraversano mai. I 5 scenari
   che seguono vanno a caccia esplicitamente di quei rami: biblioteca a fondo, porte a fondo,
   cucina a fondo, e i bivi minori di prologo/soglia/duelli lasciati indietro dal caso. */

/* ---- 8. BIBLIOTECA a fondo (percorso pacifico) — Archivio, Sala dei Libri Mai Finiti,
   topi tra gli scaffali, Duello Impegno/Coerenza, Libro delle Cose Belle ---- */
scenarios.push(scenario(
  'Biblioteca a fondo — Archivio dei Diari, Libri Mai Finiti, topi, Duello Coerenza, Cose Belle',
  ['natalino', 'claudia', 'federico'],
  {
    a2: 'Bussare',
    s3: 'Firmare',
    b1: 'rumore',      // "seguire il rumore" (once) -> b15, i topi tra gli scaffali
    b2: 'sezione',     // "Portaci alla sezione" -> b3
    b3: 'coro sottile', // once -> b14, la Sala dei Libri Mai Finiti
    b14: 'Improvvisare', // prova di gruppo CAR 12 -> b14b se riuscita
    b13: 'RESTITUITI',   // -> b13b, il diario di Rosa
    b7: 'scatola da scarpe', // once -> b17, le tessere dei lettori
    b17: 'scaffale proibito', // -> b8
    b8b: 'Riprovare',
    b9: 'segreto fuori', // -> b11 (bibliotecario ancora vivo qui: non lo riaffrontiamo a parole)
    m3: 'Accoppiare il joy-con',
    m6: 'Dargli la Zero',
    m7: 'Che venga',
    z2: 'Basta parlare',
  },
  {
    difficulty: 'facile',
    forceLossAt: 'a7', // primo sangue nel corridoio: si perde, ci si rialza, si rivince — a7_ko
    sequences: {
      b16: ['RICATTO EMOTIVO', 'IMPEGNO'], // prima il colpo sbagliato (b16k), poi la risposta giusta (b16v)
      b5: ['girevole', 'porticina', 'silenzio assoluto'], // scaffale girevole(b12) → Archivio(b13/b13b) → poi FALLIRE il silenzio → b6b
    },
    checkOutcomes: {
      b14: 'success',
      b5: 'fail',              // la 3ª visita (attraversare in silenzio) fallisce apposta: sveglia i Lettori Grigi (b6b)
      b8: ['fail', 'success'], // prima la nausea grigia (b8b), poi si rilegge bene (b9)
    },
    verify: (r, expect) => {
      expect(r.log.ending, `nessun finale raggiunto (${r.log.ending})`);
      const mustSee = ['b15', 'b15b', 'b14', 'b14b', 'b16', 'b16k', 'b16v', 'b12', 'b13', 'b13b', 'b6b', 'b17', 'b8b', 'a7_ko'];
      for (const s of mustSee) expect(r.log.scenes.includes(s), `scena "${s}" della seconda ondata non attraversata`);
      expect(r.log.flags.libro_cose_belle, 'flag libro_cose_belle non impostato (b12)');
      expect(r.log.flags.pagina_del_salvato, 'flag pagina_del_salvato non impostato (b13b, il diario di Rosa)');
      expect(r.log.itemsEverOwned.includes('boccata_colore'), 'boccata_colore (b13b) mai ottenuta');
      expect(r.log.itemsEverOwned.includes('lattina_zero'), 'lattina_zero (b17) mai ottenuta');
      expect(r.log.everMorto.length === 0, `morti inattesi: ${r.log.everMorto.join(', ')}`);
      expect(r.log.flags.daniele_in_squadra, 'Daniele non è entrato in squadra a m6');
    },
  }));

/* ---- 9. BIBLIOTECA — il Bibliotecario ostile: combattimento, sconfitta (b_ko), rivincita,
   la frana (b6b_vinto) e il d20 custodito (b7b) — e la liberazione col SACRIFICIO (m5/m6_sacrificio) ---- */
scenarios.push(scenario(
  'Biblioteca — Bibliotecario in combattimento (b_ko + rivincita), b7b, liberazione col sacrificio',
  ['claudia', 'gaetano'],
  {
    a2: 'Aprire con le chiavi',
    s3: 'Rifiutare con stile',
    b1: 'Inoltrarsi',
    b2: 'Basta chiacchiere', // attaccare -> b6 (combattimento)
    b7: 'tintinnare',        // once, prova SAG 13 -> b7b (richiede bibliotecario_morto)
    b8: 'riflesso',
    m3: 'Tagliare il bozzolo', // -> m5_sacrificio
    m6: 'Dargli la Zero',
    m7: 'Che venga',
    z2: 'Basta parlare',
  },
  {
    difficulty: 'facile',
    forceLossAt: 'b6', // il Bibliotecario vince il primo scontro: b_ko, poi RIVINCITA (default) e vittoria
    sacrificeHero: 'Claudia',
    checkOutcomes: { s3: 'fail', b7: 'success' },
    sequences: { h1: ['La porta dei libri', 'Il corridoio delle porte', 'La porta fredda', 'Seguire il suono'] },
    verify: (r, expect) => {
      expect(r.log.ending, `nessun finale raggiunto (${r.log.ending})`);
      const mustSee = ['b6', 'b_ko', 'b6b_vinto', 'b7b', 's3d', 'm5_sacrificio', 'm6_sacrificio'];
      for (const s of mustSee) expect(r.log.scenes.includes(s), `scena "${s}" non attraversata`);
      expect(r.log.flags.bibliotecario_morto, 'flag bibliotecario_morto non impostato (b6b_vinto)');
      expect(r.log.itemsEverOwned.includes('d20_daniele'), 'd20_daniele (b7b) mai ottenuto');
      expect(r.log.everMorto.includes('claudia'), 'Claudia non risulta mai morta davvero (sacrificio nel bozzolo)');
      expect(r.log.flags.daniele_in_squadra, 'Daniele non è entrato in squadra a m6 dopo il sacrificio');
      expect(r.log.flags['tornato_claudia'] === undefined, 'Claudia non dovrebbe essere già stata resuscitata in questa run');
    },
  }));

/* ---- 10. BIBLIOTECA — Duello di Parole col Bibliotecario VIVO (b10/b10c/b10b), b2b,
   il duello finale con i colpi sbagliati (z3_colpo/z5_colpo) e la vittoria e_parola ---- */
scenarios.push(scenario(
  'Biblioteca — Duello col Bibliotecario vivo, b2b, contraccolpi nel duello finale, e_parola',
  ['gaetano', 'natalino', 'emanuela'],
  {
    a2: 'Aprire con le chiavi',
    s3: 'Rifiutare con stile',
    b1: 'CORRERE',          // prova di COS forzata a fallire -> b2b (la voce sbagliata... i sussurri troppo lenti)
    b2: 'sezione',
    b3: 'sala di lettura',   // "Non c'è tempo" -> b5
    b5: 'silenzio assoluto', // prova DES forzata a riuscire -> b7 (bibliotecario ancora vivo)
    b7: 'Bibliotecario vi ha seguiti', // -> b10, il Duello di Parole
    b10b: 'Prima, se non',   // -> b8, leggere la biografia
    b8: 'riflesso',
    b9: 'segreto fuori',
    m3: 'Accoppiare il joy-con',
    m6: 'Dargli la Zero',
    m7: 'Che venga',
    z2: 'Smontiamolo',
    z4: 'FALSA DICOTOMIA',
  },
  {
    difficulty: 'facile',
    checkOutcomes: { s3: 'success', b1: 'fail', b5: 'success', b8: 'success' },
    sequences: {
      s4: ['AUTORITÀ', 'RIPROVA SOCIALE'],           // prima il colpo sbagliato (s4c), poi quello giusto
      b10: ['RIPROVA SOCIALE', 'AUTORITÀ'],          // prima il contraccolpo (b10c), poi la vittoria (b10b)
      z3: ['AD HOMINEM', 'STRAWMAN'],                // z3_colpo, poi la risposta giusta
      z5: ['IMPEGNO E COERENZA', 'RICATTO EMOTIVO'], // z5_colpo, poi la risposta giusta
    },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_parola', `finale atteso e_parola, trovato ${r.log.ending}`);
      const mustSee = ['b2b', 'b10', 'b10c', 'b10b', 's3c', 's4c', 'z3_colpo', 'z5_colpo'];
      for (const s of mustSee) expect(r.log.scenes.includes(s), `scena "${s}" non attraversata`);
      expect(r.log.flags.bibliotecario_amico, 'flag bibliotecario_amico non impostato (b10b)');
      expect(r.log.itemsEverOwned.includes('d20_daniele'), 'd20_daniele (b10b) mai ottenuto');
      expect(r.log.flags.rifiuto_stile, 'flag rifiuto_stile non impostato (s3c)');
      expect(r.log.flags.segreto_specchio, 'flag segreto_specchio non impostato (b9)');
    },
  }));

/* ---- 11. PORTE a fondo — SALA CONTROLLO (l'incubo di Gaetano), IBIZA (Emanuela),
   IL SALONE (manichini, e la sconfitta u_ko), AGOSTO 2019, il Duello ad hominem, e la
   liberazione senza joy-con (m4c) ---- */
scenarios.push(scenario(
  'Porte a fondo — Sala Controllo, Ibiza, il Salone (u_ko), Agosto 2019, Duello Obiezione',
  ['gaetano', 'emanuela', 'natalino', 'federico'],
  {
    a2: 'Aprire con le chiavi',
    b1: 'Inoltrarsi',
    b2: 'sezione',
    b3: 'sala di lettura',
    b5: 'silenzio assoluto',
    b7: 'catena e aprire',
    b8: 'riflesso',
    b9: 'segreto fuori',
    m6: 'Dargli la Zero',
    m7: 'Che venga',
    u6: 'Ingegnarsi da riva',
    u12b: 'Rimettere in ordine',
    z2: 'Smontiamolo',
    z3: 'STRAWMAN',
    z4: 'FALSA DICOTOMIA',
    z5: 'RICATTO EMOTIVO',
  },
  {
    difficulty: 'facile',
    forceLossAt: 'u12', // il Salone: prima sconfitta (u_ko), poi la rivincita
    checkOutcomes: {
      b5: 'success', b8: 'success',
      u10: ['fail', 'success'], // il ticket del satellite: prima si riapre (u10c), poi si chiude per sempre
      u11: ['fail', 'success'], // Ibiza: prima abbassa gli occhi (u11c, Ingrigito), poi attraversa a testa alta
      u6: 'success',             // "Ingegnarsi da riva" riesce -> u6c
      m3: 'fail',                // "cercare un'altra via" fallisce apposta -> m4c, il Guardiano anticipato
    },
    sequences: {
      u1: ['SALA CONTROLLO', 'IBIZA', 'IL SALONE', 'AGOSTO 2019', 'NON APRIRE', 'OBIEZIONE', 'Chiudere col corridoio'],
      u10: ['chiudere il ticket', 'chiudere il ticket'],
      u11: ['testa alta', 'testa alta'],
      u14: ['AUTORITÀ', 'AD HOMINEM'], // prima il colpo sbagliato (u14c), poi quello giusto (u14b)
      m3: ['altra via'],
    },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_parola', `finale atteso e_parola, trovato ${r.log.ending}`);
      const mustSee = [
        'u10', 'u10b', 'u10c', 'u11', 'u11b', 'u11c', 'u12', 'u12b', 'u12c',
        'u13', 'u13b', 'u14', 'u14b', 'u14c', 'u6c', 'u_ko', 'm4c',
      ];
      for (const s of mustSee) expect(r.log.scenes.includes(s), `scena "${s}" della porte non attraversata`);
      expect(r.log.itemsEverOwned.includes('spray_kerastase'), 'spray_kerastase (u11b, Ibiza) mai ottenuto');
      expect(r.log.flags.via_porte, 'flag via_porte non impostato');
      expect(r.log.flags.daniele_in_squadra, 'Daniele non è entrato in squadra dopo m4c/m5');
    },
  }));

/* ---- 12. CUCINA a fondo — congelatore a pozzetto, la calata mortale (k4_morte), il
   montavivande (k4b), la Cucina Viva, il lavoretto e il furto al Mercante, la Galleria
   (k8_prendi), lo sconto (sconto_mercante) sul Cuore di Colore, e_gemelli con z6b ---- */
scenarios.push(scenario(
  'Cucina a fondo — congelatore, calata mortale, quest e furto al Mercante, sconto sul Cuore',
  ['federico', 'claudia', 'gaetano'],
  {
    a2: 'Aprire con le chiavi',
    m6: 'Dargli la Zero',
    m7: 'Che venga',
    k12: 'Accettare il lavoretto',
    k14: 'Il credito',
    k8: 'Prenderlo. Serve ai vostri',
    z2: 'La foto',
  },
  {
    difficulty: 'facile',
    forceLossAt: 'k13', // l'Ufficiale della casa vince il primo round: k_ko, poi la rivincita
    sequences: {
      h1: ['Il corridoio delle porte', 'La porta fredda', 'Seguire il suono'],
      k1: ['congelatore', 'Frugare il frigo'],
      k15b: ['Riaprire'],
      k3: ['Accendere i fuochi', 'spigolo', 'spigolo'],
      k4: ['cordata', 'altra via', 'cordata'],
      k4_morte: ['Risalire'],
      k6: ['manodopera', 'Fregarlo', 'prezzo da colleghi', 'Lasciare il banco'],
      k9: ['tenta la sequenza'],
      z6: ['Fare scudo'],
    },
    checkOutcomes: {
      k1: ['fail', 'fail'],       // congelatore fallito (k15b), poi frigo fallito (k1c)
      k15b: 'success',
      k4: ['fail', 'fail', 'success'], // calata fallita (k4_morte), montavivande fallito (k4b), calata riuscita
      k6: ['fail'],                    // Fregarlo il Mercante fallisce (k7b_fail)
      k9: 'fail',                      // sveglia generale fallita (k9c)
      z6: ['fail', 'success'],         // prima l'onda (z6b), poi lo scudo riuscito
    },
    verify: (r, expect) => {
      expect(r.log.ending === 'e_gemelli', `finale atteso e_gemelli, trovato ${r.log.ending}`);
      const mustSee = [
        'k1c', 'k4_morte', 'k4b', 'k15', 'k15b', 'k17',
        'k7b_fail', 'k7c', 'k12', 'k13', 'k14', 'k8_prendi', 'k9c', 'k_ko', 'z6b',
      ];
      for (const s of mustSee) expect(r.log.scenes.includes(s), `scena "${s}" della cucina non attraversata`);
      expect(r.log.everMorto.length >= 1, 'la calata mortale (k4_morte) non ha ucciso nessuno davvero');
      expect(r.log.flags.sconto_mercante, 'flag sconto_mercante non impostato (k14, il credito)');
      expect(r.log.itemsEverOwned.includes('cuore_colore'), 'cuore_colore mai ottenuto (né alla Galleria né dal Mercante)');
      expect(r.log.itemsEverOwned.includes('ipa_gaetano'), 'ipa_gaetano (k15, il pozzetto) mai ottenuta');
      expect(r.log.flags.gemelli_pace, 'flag gemelli_pace non impostato (z6)');
      expect(r.log.gold >= 0, 'Colore negativo dopo la spesa dal Mercante');
    },
  }));

/* ==================== VERIFICA DIRETTA — b4, il nome proibito (Eleinad costa Colore) ====================
   b4 è raggiungibile SOLO scegliendo "Parlaci di ELEINAD" a b2, il che esclude — nella stessa
   visita — sia "Portaci alla sezione" (b3, il manuale) sia l'attacco diretto (b6): non esiste
   un percorso narrativo che passi per b4 E per uno degli altri due rami di b2. Copriamolo con
   una chiamata diretta, come le altre "verifiche dirette" di questo file. */
(function testNomeProibitoB4() {
  section('Verifica diretta: b4, il nome proibito — Eleinad costa Colore alla biblioteca');
  const game = buildGame(8765);
  game.act(() => game.api.Engine.newGame([{ heroId: 'claudia', player: '' }, { heroId: 'federico', player: '' }]));
  const G = game.getG();
  G.gold = 5;
  game.act(() => game.api.Engine.gotoScene('b2'));
  const btn = matchButton(buttons(game.doc.getElementById('choices')), 'ELEINAD');
  if (!btn) { fail('nomeProibitoB4: bottone "Parlaci di ELEINAD" assente/disabilitato a b2'); return; }
  game.act(() => btn.onclick());
  if (G.sceneId !== 'b4') { fail(`nomeProibitoB4: attesa scena b4, trovata ${G.sceneId}`); return; }
  if (G.gold !== 4) fail(`nomeProibitoB4: Colore atteso 4 dopo il costo del nome, trovato ${G.gold}`);
  const goBtn = buttons(game.doc.getElementById('choices'))[0];
  if (!goBtn) { fail('nomeProibitoB4: nessun bottone per proseguire verso la biografia (b8)'); return; }
  game.act(() => goBtn.onclick());
  if (G.sceneId !== 'b8') fail(`nomeProibitoB4: attesa scena b8 dopo b4, trovata ${G.sceneId}`);
  else console.log('  ✅ b4 (il nome proibito) raggiunto: costa 1🎨, apre lo scaffale proibito (b8) senza passare dal manuale');
})();

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

/* ==================== VERIFICA DELLA COPERTURA ==================== */

section('Copertura dei percorsi richiesti');

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
function coverageFlag(label, flagNames) {
  const seen = flagNames.filter(f => allFlagsSeen.has(f));
  const ok = seen.length === flagNames.length;
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${seen.join(', ') || '(nessuno)'}`);
  if (!ok) fail(`${label}: mancano i flag ${flagNames.filter(f => !allFlagsSeen.has(f)).join(', ')}`);
}
function coverageItem(label, itemIds) {
  const seen = itemIds.filter(id => allItemsSeen.has(id));
  const ok = seen.length === itemIds.length;
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${seen.join(', ') || '(nessuno)'}`);
  if (!ok) fail(`${label}: mancano gli oggetti ${itemIds.filter(id => !allItemsSeen.has(id)).join(', ')}`);
}

coverage('Prologo completo', ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
coverage('Soglia (TV, Eleinad, primo duello, la casa si apre)', ['s1', 's2', 's3', 's4', 's4b', 's5']);
coverage('Hub h1 + scene di respiro', ['h1', 'h2', 'h3', 'h4']);
coverage('Biblioteca — manuale, note, sala di lettura, specchio, uscita', ['b1', 'b2', 'b3', 'b3b', 'b5', 'b7', 'b8', 'b9', 'b11']);
coverage('Porte — 1994, imbarco, foto ricomposta, uscita', ['u1', 'u2', 'u2b', 'u3', 'u3b', 'u5', 'u5b', 'u5d', 'u8']);
coverage('Porte — NON APRIRE: morte vera, cuore, la Cosa', ['u6', 'u6_morte', 'u7', 'u7b']);
coverage('Porte — la porta degli spiriti', ['u9']);
coverage('Cucina — segnali, citofono (Luca), dispensa, calata', ['k1', 'k1b', 'k2', 'k2b', 'k2c', 'k3', 'k4', 'k5']);
coverage('Mercante e Galleria', ['k6', 'k7', 'k8', 'k9', 'k10']);
coverage('Snodo — sala della Switch, liberazione, maschera', ['m1', 'm2', 'm3', 'm4', 'm6', 'm7', 'm8', 'm9']);
coverage('Snodo — la via senza joycon (m4b/m5)', ['m4b', 'm5']);
coverage('Cattedrale — tutte le vie di z2', ['z1', 'z2', 'z2b', 'z3', 'z4', 'z5', 'z5b', 'z6', 'z7', 'z8', 'z9', 'z_ko']);
coverage('Duello — i colpi sbagliati', ['z4_colpo']);
coverageFlag('Segreti su Eleinad', ['segreto_specchio', 'segreto_gemelli', 'segreto_trono']);
coverageFlag('Echi dei boss', ['foto_ricomposta', 'daniele_sabota', 'sonnambuli_svegli', 'gemelli_pace', 'manuale_annotato_letto', 'eleinad_vacilla']);
coverageFlag('Daniele in squadra (unlockHero)', ['daniele_in_squadra']);
coverageFlag('Finali (flag)', ['finale_parola', 'finale_gemelli', 'finale_colori', 'finale_scambio', 'finale_grigio']);
coverageItem('Oggetti chiave posseduti almeno una volta', [
  'manuale_annotato', 'joycon_sinistro', 'foto_meta_federico', 'foto_meta_daniele', 'foto_gemelli',
  'cuore_colore', 'boccata_colore', 'conchiglia_gaeta', 'pallina_racchettoni', 'tronello', 'gocce_dottore',
]);

const EXPECTED_ENDINGS = ['e_parola', 'e_gemelli', 'e_colori', 'e_scambio', 'e_grigio'];
console.log(`  ${allEndings.size >= 5 ? '✅' : '❌'} Finali raggiunti (${allEndings.size}/5): ${[...allEndings].join(', ') || '(nessuno)'}`);
if (!EXPECTED_ENDINGS.every(e => allEndings.has(e))) {
  fail(`Finali non raggiunti: ${EXPECTED_ENDINGS.filter(e => !allEndings.has(e)).join(', ')}`);
}
{
  const sizes = new Set(okRuns.map(r => r.scenario.heroes.length));
  const ok = sizes.has(1) && sizes.has(2) && sizes.has(5);
  console.log(`  ${ok ? '✅' : '❌'} Dimensioni del party coperte: ${[...sizes].sort().join(', ')} (richieste 1, 2 e 5)`);
  if (!ok) fail('Manca una run in 1, 2 o 5 giocatori');
}

/* ==================== VERIFICHE DIRETTE ==================== */

(function testKillRollerRisparmiaUltimoVivo() {
  section('Verifica diretta: killRoller NON uccide mai l\'ultimo vivo');
  const game = buildGame(1111);
  game.act(() => game.api.Engine.newGame([{ heroId: 'natalino', player: '' }]));
  const G = game.getG();
  game.act(() => game.api.Engine.gotoScene('u1'));
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'NON APRIRE').onclick());
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'Immergersi').onclick());
  const heroBtn = buttons(game.doc.getElementById('modal-generic-content'))[0];
  if (!heroBtn) { fail('killRollerUltimoVivo: modale della prova senza bottoni'); return; }
  game.withForcedRandom(0, () => game.act(() => heroBtn.onclick())); // 1 naturale: fallita
  const cont = game.doc.getElementById('btn-dice-continue');
  if (typeof cont.onclick === 'function') game.act(() => cont.onclick());
  if (G.sceneId !== 'u6_morte') { fail(`killRollerUltimoVivo: attesa u6_morte, trovata ${G.sceneId}`); return; }
  if (G.party[0].morto) fail('killRollerUltimoVivo: l\'ULTIMO vivo è stato ucciso da killRoller (vietato dal design)');
  else console.log('  ✅ u6_morte raggiunta in solitaria: il Sopravvissuto NON muore (mai sull\'ultimo vivo)');
})();

(function testMorteSpiritoRevive() {
  section('Verifica diretta: morte vera → SPIRITO → Cuore di Colore dal Mercante → resurrezione');
  const game = buildGame(2222);
  game.act(() => game.api.Engine.newGame([{ heroId: 'claudia', player: '' }, { heroId: 'gaetano', player: '' }, { heroId: 'emanuela', player: '' }]));
  const G = game.getG();

  // morte VERA per la via del gioco: u6 fallita → killRoller
  game.act(() => game.api.Engine.gotoScene('u1'));
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'NON APRIRE').onclick());
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'Immergersi').onclick());
  const heroBtn = buttons(game.doc.getElementById('modal-generic-content'))[0];
  if (!heroBtn) { fail('morteSpiritoRevive: modale della prova senza bottoni'); return; }
  const rollerName = heroBtn.innerHTML.split(' ')[0];
  game.withForcedRandom(0, () => game.act(() => heroBtn.onclick()));
  const cont = game.doc.getElementById('btn-dice-continue');
  if (typeof cont.onclick === 'function') game.act(() => cont.onclick());
  const spirito = G.party.find(h => h.morto);
  if (!spirito) { fail('morteSpiritoRevive: nessun morto vero dopo u6 fallita (killRoller rotto)'); return; }
  if (spirito.hp !== 0) fail(`morteSpiritoRevive: lo spirito ha ${spirito.hp} PV (attesi 0)`);
  if (!new RegExp(rollerName.split(' ')[0]).test(spirito.name)) fail(`morteSpiritoRevive: morto ${spirito.name}, ma a tirare era ${rollerName}`);
  if (!/SPIRITO/.test(partyBarText(game.doc))) fail('morteSpiritoRevive: la barra del gruppo non mostra 👻 SPIRITO');

  // dal Mercante: il Cuore costa 12🎨 e il tronello (di partenza)
  G.gold = 20;
  game.act(() => game.api.Engine.gotoScene('k6'));
  const cuoreBtn = matchButton(enabledButtons(game.doc.getElementById('choices')), 'CUORE DI COLORE');
  if (!cuoreBtn) { fail('morteSpiritoRevive: il CUORE DI COLORE non è acquistabile (manca il tronello di partenza?)'); return; }
  game.act(() => cuoreBtn.onclick());
  if (!G.inventory.includes('cuore_colore')) { fail('morteSpiritoRevive: cuore_colore non in zaino dopo l\'acquisto'); return; }
  if (G.inventory.includes('tronello')) fail('morteSpiritoRevive: il tronello non è stato ceduto al Mercante');
  if (G.gold !== 8) fail(`morteSpiritoRevive: Colore atteso 8 dopo l'acquisto, trovato ${G.gold}`);

  // resurrezione: useRevive popola la modale, applyRevive fa il lavoro (il bottone
  // reale ha l'onclick DENTRO l'HTML, come per l'antidoto: si chiama la funzione)
  game.act(() => game.api.Engine.useRevive('cuore_colore'));
  const modalHtml = game.doc.getElementById('modal-generic-content').innerHTML;
  if (!new RegExp(spirito.name.split(' ')[0]).test(modalHtml)) fail('morteSpiritoRevive: useRevive non elenca lo spirito nella modale');
  const idx = G.party.indexOf(spirito);
  game.act(() => game.api.Engine.applyRevive('cuore_colore', idx));
  if (spirito.morto) fail('morteSpiritoRevive: applyRevive non ha tolto lo stato di SPIRITO');
  if (spirito.hp !== Math.ceil(spirito.maxHp / 2)) fail(`morteSpiritoRevive: PV attesi ${Math.ceil(spirito.maxHp / 2)}, trovati ${spirito.hp}`);
  if (G.inventory.includes('cuore_colore')) fail('morteSpiritoRevive: il Cuore non è stato consumato');
  if (!G.flags['tornato_' + spirito.id]) fail('morteSpiritoRevive: flag tornato_<id> non impostato');
  if (/SPIRITO/.test(partyBarText(game.doc))) fail('morteSpiritoRevive: la barra mostra ancora SPIRITO dopo la resurrezione');
  if (!failures) console.log(`  ✅ ${spirito.name}: morte vera a u6, 👻 SPIRITO in barra, Cuore comprato (12🎨+tronello), resurrezione a ${spirito.hp}/${spirito.maxHp} PV`);

  // useRevive senza spiriti non deve esplodere
  const game2 = buildGame(2223);
  game2.act(() => game2.api.Engine.newGame([{ heroId: 'natalino', player: '' }]));
  game2.getG().inventory.push('cuore_colore');
  try { game2.act(() => game2.api.Engine.useRevive('cuore_colore')); }
  catch (e) { fail(`morteSpiritoRevive: useRevive senza spiriti ha lanciato: ${e.message}`); }
})();

(function testMercanteBoccata() {
  section('Verifica diretta: il Mercante vende la Boccata di Colore (cura il Grigiore)');
  const game = buildGame(3333);
  game.act(() => game.api.Engine.newGame([{ heroId: 'emanuela', player: '' }, { heroId: 'federico', player: '' }]));
  const G = game.getG();
  G.gold = 5;
  game.act(() => game.api.Engine.gotoScene('k6'));
  const btn = matchButton(enabledButtons(game.doc.getElementById('choices')), 'Boccata di Colore');
  if (!btn) { fail('mercanteBoccata: bottone della Boccata assente/disabilitato con 5🎨'); return; }
  game.act(() => btn.onclick());
  if (!G.inventory.includes('boccata_colore')) fail('mercanteBoccata: boccata_colore non in zaino');
  if (G.gold !== 2) fail(`mercanteBoccata: Colore atteso 2, trovato ${G.gold}`);
  // e la boccata CURA il Grigiore: useAntidote/applyAntidote
  G.party[1].veleno = true;
  game.act(() => game.api.Engine.useAntidote('boccata_colore'));
  if (!/Federico/.test(game.doc.getElementById('modal-generic-content').innerHTML)) fail('mercanteBoccata: useAntidote non mostra l\'INGRIGITO');
  game.act(() => game.api.Engine.applyAntidote('boccata_colore', 1));
  if (G.party[1].veleno !== false) fail('mercanteBoccata: la Boccata non ha curato il Grigiore');
  if (G.inventory.includes('boccata_colore')) fail('mercanteBoccata: la Boccata non è stata consumata');
  console.log('  ✅ Boccata comprata (3🎨) e usata: il Grigiore se ne va, l\'oggetto si consuma');
})();

(function testUnlockHeroModale() {
  section('Verifica diretta: unlockHero (Daniele) — la modale ritardata (600ms) viene drenata');
  const game = buildGame(4444);
  game.act(() => game.api.Engine.newGame([{ heroId: 'gaetano', player: '' }, { heroId: 'claudia', player: '' }]));
  const G = game.getG();
  G.inventory.push('joycon_sinistro', 'lattina_zero');
  game.act(() => game.api.Engine.gotoScene('m3'));
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'Accoppiare il joy-con').onclick()); // m4
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'Prenderlo al volo').onclick());     // m6 → unlockHero
  if (!G.party.some(h => h.id === 'daniele')) { fail('unlockHero: Daniele non è entrato nel party a m6'); return; }
  if (!G.flags.daniele_in_squadra) fail('unlockHero: flag daniele_in_squadra mancante');
  if (!G.uses.daniele || Object.keys(G.uses.daniele).length === 0) fail('unlockHero: usi delle abilità di Daniele non inizializzati');
  const modal = game.doc.getElementById('modal-generic');
  const html = game.doc.getElementById('modal-generic-content').innerHTML;
  if (modal.classList.contains('hidden') || !/si unisce al gruppo/.test(html)) {
    fail('unlockHero: la modale di benvenuto (setTimeout 600ms) non risulta aperta dopo il drain dei timer');
  } else {
    console.log('  ✅ Daniele si unisce a m6: party aggiornato, usi pronti, modale ritardata aperta dal drain dei timer');
  }
})();

(function testCapitoliRientraNellaCasa() {
  section('Verifica diretta: "Rientra nella Casa" — capitolo z1 con Daniele (addHero) fino a e_parola');
  const game = buildGame(5555);
  const E = game.api.Engine;
  if (E.reviveUnlocked()) fail('capitoli: "Rientra nella Casa" risulta sbloccato PRIMA di aver visto un finale');
  const CH = game.api.CHAPTERS;
  const idx = CH.findIndex(c => (c.scene || c.id) === 'z1' && c.addHero === 'daniele');
  if (idx < 0) { fail('capitoli: nessun capitolo z1 con addHero daniele in CHAPTERS'); return; }
  game.act(() => E.startChapter(idx));
  const G = game.getG();
  if (G.sceneId !== 'z1') fail(`capitoli: scena attesa z1, trovata ${G.sceneId}`);
  if (!G.party.some(h => h.id === 'daniele')) fail('capitoli: Daniele NON è nel party del capitolo (addHero rotto)');
  if (G.party.length !== 6) fail(`capitoli: attesi 6 eroi (5 amici + Daniele), trovati ${G.party.length}`);
  const c = CH[idx];
  for (const f of Object.keys(c.flags || {})) if (!G.flags[f]) fail(`capitoli: flag del capitolo "${f}" non applicato`);
  for (const it of (c.items || [])) if (!G.inventory.includes(it)) fail(`capitoli: oggetto del capitolo "${it}" non nello zaino`);
  // e il capitolo è GIOCABILE: la via della Parola fino in fondo (nessun dado nel duello)
  const click = (m) => {
    const b = matchButton(enabledButtons(game.doc.getElementById('choices')), m);
    if (!b) throw new Error(`bottone "${m}" non trovato in ${G.sceneId}`);
    game.act(() => b.onclick());
  };
  try {
    click('Percorrere la navata');            // z1 → z2
    click('Smontiamolo');                     // z2 → z3 (richiede Daniele + manuale)
    click('STRAWMAN');                        // z3 → z4
    click('FALSA DICOTOMIA');                 // z4 → z5
    click('RICATTO EMOTIVO');                 // z5 → z5b
    click('Guardarlo cadere');                // z5b → e_parola
  } catch (e) { fail(`capitoli: duello dal capitolo z1 interrotto: ${e.message}`); }
  if (G.sceneId !== 'e_parola') fail(`capitoli: atteso e_parola a fine duello, trovato ${G.sceneId}`);
  if (!E.reviveUnlocked()) fail('capitoli: reviveUnlocked ancora falso dopo un finale');
  else console.log('  ✅ Capitolo z1: 6 eroi (Daniele incluso), flag e zaino pronti, duello giocato fino a e_parola, sblocco registrato');
  // e il capitolo "a mani nude" (z1_puro) apre la stessa scena
  const idx2 = CH.findIndex(c2 => c2.id === 'z1_puro');
  if (idx2 >= 0) {
    game.act(() => E.startChapter(idx2));
    if (game.getG().sceneId !== 'z1') fail('capitoli: z1_puro non apre z1');
  }
})();

(function testSalvataggioRicarica() {
  section('Verifica diretta: salvataggio/ricarica + codici di esportazione (roundtrip)');
  const game = buildGame(6666);
  const E = game.api.Engine;
  game.act(() => E.newGame([{ heroId: 'gaetano', player: 'Gali' }, { heroId: 'emanuela', player: '' }], 1));
  game.act(() => E.gotoScene('a2'));
  const G1 = game.getG();
  G1.inventory.push('manuale_annotato'); G1.gold = 7;
  game.act(() => E.gotoScene('a3'));   // l'auto-save fotografa lo stato
  // ricarica dallo stesso slot
  game.act(() => E.loadGame(1));
  let G2 = game.getG();
  if (G2.sceneId !== 'a3') fail(`saveLoad: scena attesa a3 dopo loadGame, trovata ${G2.sceneId}`);
  if (!G2.inventory.includes('manuale_annotato') || G2.gold !== 7) fail('saveLoad: zaino o Colore persi nella ricarica');
  if (G2.party[0].player !== 'Gali') fail('saveLoad: nome del giocatore perso');
  // "altro dispositivo": export → import su slot diverso → load
  const code = E.exportCode(1);
  if (!code) { fail('saveLoad: exportCode ha restituito null'); return; }
  const err = E.importCode(code, 3);
  if (err) { fail('saveLoad: importCode ha rifiutato il proprio codice: ' + err); return; }
  game.act(() => E.loadGame(3));
  G2 = game.getG();
  if (G2.sceneId !== 'a3' || G2.gold !== 7) fail('saveLoad: stato corrotto dopo il viaggio export/import');
  if (E.importCode('non-un-codice!!!', 3) === null) fail('saveLoad: un codice spazzatura è stato accettato');
  console.log('  ✅ Salvataggio, ricarica, export/import tra slot: stato integro (scena, zaino, Colore, nomi) e spazzatura rifiutata');
})();

(function testSpiritiEsclusiDalleProve() {
  section('Verifica diretta: gli SPIRITI non tirano dadi e non bevono in combattimento');
  const game = buildGame(7777);
  game.act(() => game.api.Engine.newGame([{ heroId: 'claudia', player: '' }, { heroId: 'gaetano', player: '' }]));
  const G = game.getG();
  G.party[0].morto = true; G.party[0].hp = 0;
  // prova fuori combattimento: la modale non deve elencare lo spirito
  game.act(() => game.api.Engine.gotoScene('a0'));
  game.act(() => matchButton(buttons(game.doc.getElementById('choices')), 'Claudia guarda').onclick());
  const heroBtns = buttons(game.doc.getElementById('modal-generic-content'));
  if (heroBtns.some(b => /Claudia/.test(b.innerHTML))) fail('spiriti: Claudia (morta) compare nella modale della prova');
  if (!heroBtns.some(b => /Gaetano/.test(b.innerHTML))) fail('spiriti: Gaetano (vivo) NON compare nella modale della prova');
  // in combattimento: il menu delle cure non deve offrire lo spirito
  const cont = game.doc.getElementById('btn-dice-continue');
  if (typeof cont.onclick === 'function') game.act(() => cont.onclick()); // chiudi il tiro di Gaetano
  const game2 = buildGame(7778);
  game2.act(() => game2.api.Engine.newGame([{ heroId: 'emanuela', player: '' }, { heroId: 'natalino', player: '' }, { heroId: 'gaetano', player: '' }]));
  const G2 = game2.getG();
  G2.party[1].morto = true; G2.party[1].hp = 0; // Natalino spirito
  game2.act(() => game2.api.Engine.gotoScene('a7'));
  game2.act(() => matchButton(buttons(game2.doc.getElementById('choices')), 'INIZIA IL COMBATTIMENTO').onclick());
  // primo menu principale di un eroe: apri il kit (🧪) e controlla la lista degli alleati
  let guard = 0, checked = false;
  while (guard++ < 200 && !checked) {
    const dice = game2.doc.getElementById('btn-dice-continue');
    if (!game2.doc.getElementById('dice-overlay').classList.contains('hidden')) { game2.act(() => dice.onclick()); continue; }
    if (!game2.doc.getElementById('screen-combat').classList.contains('active')) break;
    const acts = buttons(game2.doc.getElementById('combat-actions'));
    if (!acts.length) break;
    const kind = classifyCombatMenu(acts);
    if (kind === 'main') {
      const potion = acts.find(b => /^🧪/.test(b.innerHTML) && !b.disabled);
      if (potion) {
        game2.act(() => potion.onclick());
        const allies = buttons(game2.doc.getElementById('combat-actions')).filter(b => /^❤|^💀/.test(b.innerHTML));
        if (allies.some(b => /Natalino/.test(b.innerHTML))) fail('spiriti: lo SPIRITO compare tra i bersagli delle cure in combattimento');
        checked = true;
        break;
      }
      game2.act(() => acts.find(b => !b.disabled).onclick());
    } else {
      game2.act(() => acts[0].onclick());
    }
  }
  if (!checked) fail('spiriti: non sono riuscito ad aprire il menu delle pozioni in combattimento');
  else console.log('  ✅ Spiriti esclusi dalle prove e dai menu di cura in combattimento');
})();

/* ==================== ESITO FINALE ==================== */

section('Copertura totale della campagna');
{
  const probe = buildGame(999999);
  const allCampaignIds = Object.keys(probe.api.CAMPAIGN);
  const unseen = allCampaignIds.filter(id => !allScenesSeen.has(id));
  console.log(`  Scene distinte visitate: ${allScenesSeen.size} / ${allCampaignIds.length}`);
  console.log(`  Scene MAI visitate (${unseen.length}): ${unseen.join(', ') || '(nessuna)'}`);
}

console.log('\n' + '═'.repeat(60));
if (failures === 0) {
  console.log(`✅ TUTTE LE PARTITE SIMULATE COMPLETATE SENZA ERRORI (${results.length} run, ${allScenesSeen.size} scene distinte visitate, ${allEndings.size}/5 finali)`);
  process.exit(0);
} else {
  console.log(`❌ ${failures} PROBLEMI RILEVATI su ${results.length} partite simulate`);
  process.exit(1);
}
