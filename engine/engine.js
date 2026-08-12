/* ============ ENGINE — stato di gioco, scene, prove, modali ============ */

let G = null; // stato di gioco globale

const Engine = (() => {

  const SLOTS = 3;
  const $ = id => document.getElementById(id);

  /* ---------- profili utente (ognuno ha i suoi 3 slot) ---------- */

  const PROFILES_KEY = 'casa-profiles';
  const CURRENT_PROFILE_KEY = 'casa-current-profile';
  const DEFAULT_PROFILE = 'Gli Amici di Daniele';

  function listProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.length ? list : [DEFAULT_PROFILE];
    } catch (e) { return [DEFAULT_PROFILE]; }
  }

  function saveProfiles(list) {
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function currentProfile() {
    try { return localStorage.getItem(CURRENT_PROFILE_KEY) || DEFAULT_PROFILE; } catch (e) { return DEFAULT_PROFILE; }
  }

  function setCurrentProfile(name) {
    try { localStorage.setItem(CURRENT_PROFILE_KEY, name); } catch (e) {}
    const list = listProfiles();
    if (!list.includes(name)) { list.push(name); saveProfiles(list); }
  }

  const slotKey = (n, profile = null) => `casa-save-${encodeURIComponent(profile || currentProfile())}-slot-${n}`;

  try {
    if (!localStorage.getItem(PROFILES_KEY)) saveProfiles([DEFAULT_PROFILE]);
    if (!localStorage.getItem(CURRENT_PROFILE_KEY)) setCurrentProfile(DEFAULT_PROFILE);
  } catch (e) {}

  /* ---------- stato ---------- */

  function newGame(selection, slot = null, difficulty = 'normale') {
    // selection: [{heroId, player}]
    if (slot == null) slot = firstFreeSlot() || 1;
    const solo = selection.length === 1;
    G = {
      party: selection.map(s => {
        const base = HEROES.find(h => h.id === s.heroId);
        const hero = { ...JSON.parse(JSON.stringify(base)), hp: base.maxHp, down: false, player: s.player || '' };
        if (solo) {
          // Modalità Eroe Solitario: più resistente, più risorse
          hero.maxHp += 10; hero.hp = hero.maxHp; hero.ac += 1;
          for (const ab of hero.abilities) ab.uses += 1;
        }
        return hero;
      }),
      uses: {},
      gold: solo ? 12 : 10,   // 🎨 Colore
      // Il tronello di scorta di Natalino parte SEMPRE nello zaino (come la borsa Kerastase):
      // è la chiave del cerchio del tronello (h1 -> h2) e il pegno che il Mercante esige
      // per il Cuore di Colore — senza, quei due contenuti sarebbero irraggiungibili.
      inventory: solo ? ['kit_emanuela', 'tronello', 'lattina_zero', 'lattina_zero'] : ['kit_emanuela', 'tronello'],
      flags: solo ? { solo: true } : {},
      sceneId: CAMPAIGN_START,
      usedChoices: {},   // sceneId -> [testi scelti "once"]
      enteredScenes: {}, // sceneId -> true (per effetti one-shot)
      lastCombatSceneId: null,
      history: [],       // tappe della storia (per il riepilogo alla ripresa)
      seenEnemies: [],   // nemici incontrati (per il bestiario)
      slot,
      difficulty,
      stats: { combats: 0, checksPassed: 0, checksFailed: 0, scenes: 0, start: Date.now() },
    };
    for (const h of G.party) {
      G.uses[h.id] = {};
      for (const ab of h.abilities) G.uses[h.id][ab.id] = ab.uses;
    }
    saveGame();
    gotoScene(CAMPAIGN_START);
    {
      const box = $('modal-generic-content');
      let html = `<h2>📖 La Storia</h2>` + (typeof RULES_STORY !== 'undefined' ? RULES_STORY : '');
      if (solo) {
        html += `<h2 style="margin-top:16px">🌒 Modalità Sopravvissuto</h2>
        <p style="margin-bottom:12px">${G.party[0].name} entra nella Casa DA SOLO. Che incoscienza. Che stile. La notte concede:</p>
        <div class="ability-box"><span class="ability-name">❤ +10 PV massimi e +1 CA</span></div>
        <div class="ability-box"><span class="ability-name">✨ +1 uso a ogni abilità speciale</span></div>
        <div class="ability-box"><span class="ability-name">🎒 Il kit di Emanuela e due Coca Zero di Daniele già in borsa</span></div>
        <p style="color:var(--text-dim);margin-top:10px">Consiglio del narratore: nei film horror il gruppo si divide. Tu SEI già diviso. Compensa con la prudenza.</p>`;
      }
      html += `<button class="btn btn-gold" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">🌙 Che la notte cominci</button>`;
      box.innerHTML = html;
      $('modal-generic').classList.remove('hidden');
    }
  }

  function saveGame() {
    if (!G) return;
    G.savedAt = Date.now();
    try { localStorage.setItem(slotKey(G.slot || 1), JSON.stringify(G)); } catch (e) { /* storage pieno o disabilitato */ }
  }

  function listSaves(profile = null) {
    const out = [];
    for (let n = 1; n <= SLOTS; n++) {
      try {
        const raw = localStorage.getItem(slotKey(n, profile));
        if (!raw) { out.push(null); continue; }
        const g = JSON.parse(raw);
        const scene = CAMPAIGN[g.sceneId];
        out.push({
          slot: n,
          heroes: (g.party || []).map(h => h.name.split(' ')[0]).join(', '),
          players: (g.party || []).map(h => h.player).filter(Boolean).join(', '),
          caption: scene ? scene.caption : '—',
          gold: g.gold,
          savedAt: g.savedAt || null,
          ended: !!(scene && scene.ending),
        });
      } catch (e) { out.push(null); }
    }
    return out;
  }

  function hasSave() { return listSaves().some(Boolean); }

  function firstFreeSlot() {
    const saves = listSaves();
    for (let n = 1; n <= SLOTS; n++) if (!saves[n - 1]) return n;
    return null;
  }

  function loadGame(slot = null) {
    try {
      if (slot == null) slot = listSaves().findIndex(Boolean) + 1;
      if (!slot) return false;
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return false;
      G = JSON.parse(raw);
      G.slot = slot;
      if (!CAMPAIGN[G.sceneId]) G.sceneId = CAMPAIGN_START;
      renderScene(CAMPAIGN[G.sceneId], true);
      showRecap();
      return true;
    } catch (e) { return false; }
  }

  // "La storia finora": riepilogo alla ripresa della partita
  function showRecap() {
    if (!G || !G.history || G.history.length < 2) return;
    const beats = G.history.slice(-6).map(c => `<div class="ability-box" style="border-left-color:var(--gold)"><div class="ability-desc">📖 ${c}</div></div>`).join('');
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>📜 La storia finora...</h2>
      <p style="color:var(--text-dim);margin-bottom:10px">Bentornati nella Casa. Il gruppo (${G.party.map(h => h.name.split(' ')[0]).join(', ')}) ha 🎨 ${G.gold} di Colore. Le ultime tappe:</p>
      ${beats}
      <button class="btn btn-gold" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">▶ Si riparte!</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function clearSave(slot = null, profile = null) {
    try {
      if (slot != null) localStorage.removeItem(slotKey(slot, profile));
      else if (G && G.slot) localStorage.removeItem(slotKey(G.slot));
    } catch (e) {}
  }

  /* ---------- codici di salvataggio (trasferimento tra dispositivi) ---------- */

  function exportCode(slot, profile = null) {
    try {
      const raw = localStorage.getItem(slotKey(slot, profile));
      if (!raw) return null;
      return btoa(unescape(encodeURIComponent(raw)));
    } catch (e) { return null; }
  }

  function importCode(code, slot, profile = null) {
    try {
      const raw = decodeURIComponent(escape(atob(code.trim())));
      const g = JSON.parse(raw);
      if (!g.party || !g.party.length || !g.sceneId) return 'Codice non valido: manca la compagnia o la scena.';
      if (!CAMPAIGN[g.sceneId]) g.sceneId = CAMPAIGN_START;
      localStorage.setItem(slotKey(slot, profile), JSON.stringify(g));
      return null; // nessun errore
    } catch (e) { return 'Codice non riconosciuto: controllate di averlo copiato per intero.'; }
  }

  function deleteProfile(name) {
    for (let n = 1; n <= SLOTS; n++) clearSave(n, name);
    const list = listProfiles().filter(p => p !== name);
    saveProfiles(list.length ? list : [DEFAULT_PROFILE]);
    if (currentProfile() === name) setCurrentProfile(list[0] || DEFAULT_PROFILE);
  }

  function renameProfile(oldName, newName) {
    if (!newName || listProfiles().includes(newName)) return false;
    for (let n = 1; n <= SLOTS; n++) {
      try {
        const raw = localStorage.getItem(slotKey(n, oldName));
        if (raw) { localStorage.setItem(slotKey(n, newName), raw); localStorage.removeItem(slotKey(n, oldName)); }
      } catch (e) {}
    }
    saveProfiles(listProfiles().map(p => p === oldName ? newName : p));
    if (currentProfile() === oldName) setCurrentProfile(newName);
    return true;
  }

  /* ---------- navigazione schermate ---------- */

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function currentScene() { return CAMPAIGN[G && G.sceneId] || null; }

  /* ---------- formattazione testo ---------- */

  function formatText(text) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc(text)
      .split('\n')
      .map(line => {
        const m = line.match(/^&gt; ([^:]+): ?(.*)$/);
        if (m) return `<span class="speaker">${m[1]}:</span> ${m[2]}`;
        return line;
      })
      .join('\n')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>');
  }

  /* ---------- scene ---------- */

  /* Scene viste CUMULATIVE per profilo (tra tutte le partite): servono a
     "Rientra nella Casa" per dire quanto manca e DOVE. */
  const seenKey = () => 'casa-viste-' + encodeURIComponent(currentProfile());
  function seenScenes() {
    try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch (e) { return new Set(); }
  }
  function markSeen(id) {
    try {
      const s = seenScenes();
      if (!s.has(id)) { s.add(id); localStorage.setItem(seenKey(), JSON.stringify([...s])); }
    } catch (e) {}
  }

  function gotoScene(id) {
    if (id === 'RETRY_COMBAT') id = G.lastCombatSceneId || CAMPAIGN_START;
    const scene = CAMPAIGN[id];
    if (!scene) { console.error('Scena mancante:', id); return; }
    G.sceneId = id;
    G.stats.scenes++;
    markSeen(id);

    const firstVisit = !G.enteredScenes[id];
    G.enteredScenes[id] = true;

    // effetti d'ingresso (solo alla prima visita)
    if (firstVisit) {
      if (scene.sets) Object.assign(G.flags, scene.sets);
      if (scene.rep) G.flags.reputazione = (G.flags.reputazione || 0) + scene.rep;
      if (scene.gold) G.gold = Math.max(0, G.gold + scene.gold);
      if (scene.goldLoss) G.gold = Math.max(0, G.gold - scene.goldLoss);
      if (scene.item) G.inventory.push(scene.item);
      if (scene.item2) G.inventory.push(scene.item2);
      if (scene.heal) {
        for (const h of G.party) if (!h.down && !h.morto) h.hp = Math.min(h.maxHp, h.hp + scene.heal);
      }
      if (scene.damage) for (const h of G.party) if (!h.down && !h.morto) h.hp = Math.max(1, h.hp - scene.damage);
      if (scene.onEnterOnce && scene.onEnterOnce.itemEach) {
        for (const h of G.party) G.inventory.push(scene.onEnterOnce.itemEach);
      }
      // condizioni della Casa: colpiscono chi ha appena tirato il dado
      if (scene.poisonRoller && G.lastRoller != null && G.party[G.lastRoller]) {
        G.party[G.lastRoller].veleno = true; // INGRIGITO: il Grigiore nelle vene
      }
      if (scene.captureRoller && G.lastRoller != null && G.party[G.lastRoller]) {
        const attivi = G.party.filter(h => !h.preso && !h.down && !h.morto).length;
        if (attivi > 1) G.party[G.lastRoller].preso = true; // mai catturare l'ultimo in piedi
      }
      // MORTE VERA: chi ha appena tirato (e fallito) muore — resta come SPIRITO.
      // Mai l'ultimo vivo: quel caso lo gestiscono le scene di sconfitta esplicite.
      if (scene.killRoller && G.lastRoller != null && G.party[G.lastRoller]) {
        const vivi = G.party.filter(h => !h.morto).length;
        const h = G.party[G.lastRoller];
        if (vivi > 1 && !h.morto) {
          h.morto = true; h.down = false; h.preso = false; h.veleno = false; h.hp = 0;
          if (typeof Sound !== 'undefined') Sound.play('defeat');
        }
      }
      // sblocco di un eroe (Daniele): entra nel gruppo a PV pieni
      if (scene.unlockHero && !G.party.some(h => h.id === scene.unlockHero)) {
        const base = HEROES.find(h => h.id === scene.unlockHero);
        if (base) {
          const hero = { ...JSON.parse(JSON.stringify(base)), hp: base.maxHp, down: false, player: '' };
          G.party.push(hero);
          G.uses[hero.id] = {};
          for (const ab of hero.abilities) G.uses[hero.id][ab.id] = ab.uses;
          G.flags[hero.id + '_in_squadra'] = true;
          setTimeout(() => {
            const box = $('modal-generic-content');
            box.innerHTML = `<h2>🎮 ${hero.name} si unisce al gruppo!</h2>
              <p style="margin-bottom:12px">${hero.class} — <i>${hero.tagline}</i></p>
              <div class="ability-box"><span class="ability-name">🌟 ${hero.passive}</span></div>
              ${hero.abilities.map(ab => `<div class="ability-box"><span class="ability-name">✨ ${ab.name}</span><div class="ability-desc">${ab.desc}</div></div>`).join('')}
              <p style="color:var(--text-dim);margin-top:10px">Chiunque al tavolo può giocarlo — o guidarlo insieme. Toccate il suo ritratto nella barra del gruppo per la scheda completa.</p>
              <button class="btn btn-gold" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">▶ Si va</button>`;
            $('modal-generic').classList.remove('hidden');
          }, 600);
        }
      }
    }

    // effetti che devono valere a OGNI visita (scene di sconfitta e di riposo)
    if (scene.fullHeal) {
      for (const h of G.party) {
        if (h.morto) continue; // la morte vera NON si cura riposando: serve un Cuore di Colore
        h.hp = h.maxHp; h.down = false;
        for (const ab of h.abilities) G.uses[h.id][ab.id] = ab.uses;
      }
      if (!firstVisit && scene.goldLoss) G.gold = Math.max(0, G.gold - scene.goldLoss);
    }
    if (scene.recharge) {
      for (const h of G.party) for (const ab of h.abilities) G.uses[h.id][ab.id] = ab.uses;
    }
    if (scene.freeAll) {
      for (const h of G.party) h.preso = false; // la casa "perde le chiavi"
    }
    if (scene.reviveAll) {
      for (const h of G.party) if (h.morto) { h.morto = false; h.hp = Math.ceil(h.maxHp / 2); } // solo i finali che lo meritano
    }

    if (scene.combat) G.lastCombatSceneId = id;

    if (firstVisit && scene.stinger && typeof Sound !== 'undefined') Sound.play(scene.stinger);

    // cronologia per il riepilogo "la storia finora"
    if (!G.history) G.history = [];
    if (scene.caption && G.history[G.history.length - 1] !== scene.caption) {
      G.history.push(scene.caption);
      if (G.history.length > 60) G.history.shift();
    }

    saveGame();
    renderScene(scene);
  }

  let typeTimer = null;

  const MUSIC_BY_LOCATION = {
    strada: 'viaggio', palazzo: 'viaggio', pianerottolo: 'appartamento',
    appartamento: 'appartamento', corridoio: 'corridoio', salotto: 'salotto',
    biblioteca: 'biblioteca', porte: 'porte', cameretta: 'porte', spiaggia_grigia: 'porte',
    cabina: 'porte', stanza_sommersa: 'sommersa',
    cucina_fredda: 'cucina', sottoscala: 'sottoscala', mercante: 'sottoscala', galleria: 'sottoscala',
    sala_switch: 'switch', trono: 'trono', cattedrale: 'trono', alba_colori: 'alba',
  };

  function musicForScene(scene) {
    if (scene.ending) return 'alba';
    return MUSIC_BY_LOCATION[scene.location] || 'corridoio';
  }

  /* Quanto avanza il GRIGIORE, scena per scena (0 = mondo a colori, 1 = grigio totale). */
  function eclipsePhaseFor(id) {
    if (/^e_/.test(id)) return 0;          // epiloghi: i colori tornano
    if (/^z/.test(id)) return 1;           // la Cattedrale del Grigiore
    if (/^m/.test(id)) return 0.85;        // la Sala della Switch, il Trono
    if (/^(b|u|k)/.test(id)) return 0.65;  // le tre piste
    if (/^h/.test(id)) return 0.5;         // il Salotto-Cattedrale
    if (/^s/.test(id)) return 0.35;        // la Soglia
    if (/^a[4-9]/.test(id)) return 0.2;    // dentro l'appartamento
    return 0.08;                           // la strada, il palazzo
  }

  function renderScene(scene, instant = false) {
    showScreen('screen-game');
    if (typeof Sound !== 'undefined') Sound.music(musicForScene(scene));
    if (typeof Scenes.setEclipse === 'function') Scenes.setEclipse(eclipsePhaseFor(G.sceneId));
    $('hud-location').textContent = '📍 ' + (scene.caption || '');
    Scenes.paint('scene-canvas', scene.location, null, scene.npc);
    $('scene-caption').textContent = scene.caption || '';

    const narr = $('narration');
    const choicesEl = $('choices');
    choicesEl.innerHTML = '';

    const html = `<span class="dm-label">🎙 IL NARRATORE</span>` + formatText(scene.text);

    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }

    const finishRender = () => {
      narr.innerHTML = html;
      renderChoices(scene);
      renderPartyBar('party-bar');
    };

    if (instant) { finishRender(); return; }

    // effetto macchina da scrivere (cliccabile per saltare)
    narr.innerHTML = '';
    const plain = document.createElement('div');
    narr.appendChild(plain);
    let i = 0;
    const step = 3; // caratteri per tick
    const raw = scene.text;
    typeTimer = setInterval(() => {
      i += step;
      if (i >= raw.length) {
        clearInterval(typeTimer); typeTimer = null;
        finishRender();
      } else {
        plain.innerHTML = `<span class="dm-label">🎙 IL NARRATORE</span>` + formatText(raw.slice(0, i)) + '<span class="cursor"></span>';
      }
    }, 12);
    narr.onclick = () => {
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null; finishRender(); }
    };
    renderPartyBar('party-bar');
  }

  function choiceAvailable(c) {
    if (c.requires) {
      if (c.requires.flag && !G.flags[c.requires.flag]) return false;
      if (c.requires.flag2 && !G.flags[c.requires.flag2]) return false;
      if (c.requires.notFlag && G.flags[c.requires.notFlag]) return false;
      // flagAny: basta UNO dei flag elencati (OR) — utile per le vie alternative
      if (Array.isArray(c.requires.flagAny) && !c.requires.flagAny.some(f => G.flags[f])) return false;
      if (c.requires.item && !G.inventory.includes(c.requires.item)) return false;
      if (c.requires.item2 && !G.inventory.includes(c.requires.item2)) return false;
      if (c.requires.notItem && G.inventory.includes(c.requires.notItem)) return false;
      // hero: l'eroe è nel gruppo e VIVO (es. le scelte di Daniele nel finale)
      if (c.requires.hero && !G.party.some(h => h.id === c.requires.hero && !h.morto)) return false;
      // spirit: c'è almeno uno SPIRITO nel gruppo (le scelte che solo i morti vedono)
      if (c.requires.spirit && !G.party.some(h => h.morto)) return false;
      if (c.requires.heroDead && !G.party.some(h => h.id === c.requires.heroDead && h.morto)) return false;
    }
    if (c.once && (G.usedChoices[G.sceneId] || []).includes(c.text)) return false;
    return true;
  }

  function renderChoices(scene) {
    const choicesEl = $('choices');
    choicesEl.innerHTML = '';

    if (scene.ending) {
      renderEnding(scene);
      return;
    }

    if (scene.combat) {
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.innerHTML = `⚔ <b>INIZIA IL COMBATTIMENTO!</b> <span class="choice-tag">Preparatevi: si combatte a turni, il gioco vi guida.</span>`;
      b.onclick = () => Combat.start(scene.combat, G.sceneId);
      choicesEl.appendChild(b);
      return;
    }

    for (const c of (scene.choices || [])) {
      if (!choiceAvailable(c)) continue;
      const b = document.createElement('button');
      b.className = 'choice-btn';
      let inner = c.text;
      if (c.tag) inner += ` <span class="choice-check">🎲 ${c.tag}</span>`;
      const poor = c.requiresGold && G.gold < c.requiresGold;
      if (poor) inner += ` <span class="choice-tag">(vi servono ${c.requiresGold} monete — ne avete ${G.gold})</span>`;
      b.innerHTML = inner;
      b.disabled = !!poor;
      b.onclick = () => resolveChoice(scene, c);
      choicesEl.appendChild(b);
    }
  }

  function resolveChoice(scene, c) {
    if (typeof Sound !== 'undefined') Sound.play(c.item ? 'item' : c.gold ? 'gold' : 'click');
    if (c.once) {
      if (!G.usedChoices[G.sceneId]) G.usedChoices[G.sceneId] = [];
      G.usedChoices[G.sceneId].push(c.text);
    }
    if (c.gold) G.gold = Math.max(0, G.gold + c.gold);
    if (c.item) G.inventory.push(c.item);
    if (c.removeItem) {
      const i = G.inventory.indexOf(c.removeItem);
      if (i >= 0) G.inventory.splice(i, 1);
    }
    if (c.removeItem2) {
      const i = G.inventory.indexOf(c.removeItem2);
      if (i >= 0) G.inventory.splice(i, 1);
    }
    if (c.sets) Object.assign(G.flags, c.sets);
    if (c.rep) G.flags.reputazione = (G.flags.reputazione || 0) + c.rep;
    saveGame();

    if (c.sacrifice) {
      pickHeroForSacrifice(c);
    } else if (c.check) {
      pickHeroForCheck(c.check);
    } else if (c.next) {
      gotoScene(c.next);
    } else {
      // scelta "da negozio": resta nella scena e aggiorna
      renderScene(scene, true);
    }
  }

  /* Il dilemma più duro: qualcuno RESTA. La scelta è del tavolo, mai del caso. */
  function pickHeroForSacrifice(c) {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>🕯 ${c.sacrificeTitle || 'Chi si sacrifica?'}</h2>
      <p style="margin-bottom:12px">${c.sacrificeText || 'Decidete insieme. Con calma. È il tipo di scelta che non si rifà.'}</p>`;
    G.party.forEach((h, i) => {
      if (h.morto) return;
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.innerHTML = `${h.name} <span class="choice-tag">PV ${h.hp}/${h.maxHp}${h.player ? ' · giocato da ' + h.player : ''}</span>`;
      b.onclick = () => {
        h.morto = true; h.down = false; h.preso = false; h.veleno = false; h.hp = 0;
        if (c.sacrificeSets) G.flags[c.sacrificeSets] = h.id; // memorizza CHI (per epiloghi e testi)
        G.flags['sacrificio_' + h.id] = true;
        saveGame();
        $('modal-generic').classList.add('hidden');
        if (typeof Sound !== 'undefined') Sound.play('defeat');
        gotoScene(c.next);
      };
      box.appendChild(b);
    });
    const back = document.createElement('button');
    back.className = 'btn';
    back.style.marginTop = '12px';
    back.textContent = '↩ Un momento. Riparliamone.';
    back.onclick = () => { $('modal-generic').classList.add('hidden'); renderScene(currentScene(), true); };
    box.appendChild(back);
    $('modal-generic').classList.remove('hidden');
  }

  /* ---------- prove di abilità ---------- */

  const STAT_NAMES = { FOR: 'Forza', DES: 'Destrezza', COS: 'Costituzione', INT: 'Intelligenza', SAG: 'Saggezza', CAR: 'Carisma' };

  function heroCheckMod(h, stat) {
    let m = h.stats[stat] || 0;
    if (h.veleno) m -= 2; // INGRIGITO: il Grigiore nelle vene
    if (h.id === 'gaetano' && stat === 'INT') m += 2;
    if (h.id === 'claudia' && stat === 'SAG') m += 2;
    if (h.id === 'federico' && stat === 'CAR') m += 2;
    if (h.id === 'daniele' && stat === 'CAR') m += 2; // Ha Letto il Manuale
    return m;
  }

  function pickHeroForCheck(check) {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>🎲 Prova di ${STAT_NAMES[check.stat]} — CD ${check.dc}</h2>
      <p style="margin-bottom:12px">Chi ci prova? Scegliete l'eroe (contano i suoi bonus!):</p>`;
    G.party.forEach((h, hIdx) => {
      if (h.down || h.preso || h.morto) return;
      const mod = heroCheckMod(h, check.stat);
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.innerHTML = `${h.name}${h.veleno ? ' 🩶' : ''} <span class="choice-tag">${STAT_NAMES[check.stat]}: ${mod >= 0 ? '+' + mod : mod}${h.veleno ? ' (INGRIGITO)' : ''}${h.player ? ' · giocato da ' + h.player : ''}</span>`;
      b.onclick = () => {
        G.lastRoller = hIdx;   // la Casa ricorda chi ha osato tirare
        $('modal-generic').classList.add('hidden');
        const rollIt = (isReroll) => Dice.showRoll({
          title: `${h.name} ${isReroll ? 'RITIRA (il d20 di Daniele!)' : 'tenta'}:<br>${STAT_NAMES[check.stat]} — CD ${check.dc}`,
          mod, dc: check.dc,
          onDone: res => {
            if (!res.success && !isReroll && G.inventory.includes('d20_daniele')) {
              return offerReroll(() => {
                const i = G.inventory.indexOf('d20_daniele');
                if (i >= 0) G.inventory.splice(i, 1);
                saveGame();
                rollIt(true);
              }, () => {
                G.stats.checksFailed++;
                gotoScene(check.fail);
              });
            }
            if (res.success) G.stats.checksPassed++; else G.stats.checksFailed++;
            gotoScene(res.success ? check.success : check.fail);
          },
        });
        rollIt(false);
      };
      box.appendChild(b);
    });
    $('modal-generic').classList.remove('hidden');
  }

  // proposta di ritiro con il d20 portafortuna di Daniele
  function offerReroll(onYes, onNo) {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>🎲 Il d20 di Daniele scalda la tasca...</h2>
      <p style="margin-bottom:12px">La prova è fallita, ma il d20 portafortuna di Daniele <i>vibra</i>. "Statisticamente non significa niente", direbbe lui. E poi lo tirerebbe. Un uso solo: questo momento lo merita?</p>
      <button class="choice-btn" id="btn-reroll-yes">🎲 <b>SÌ: tirate il d20 di Daniele!</b> (si consuma)</button>
      <button class="choice-btn" id="btn-reroll-no">🙅 No, accettate il fato: sarà per un momento più importante</button>`;
    $('modal-generic').classList.remove('hidden');
    $('btn-reroll-yes').onclick = () => { $('modal-generic').classList.add('hidden'); onYes(); };
    $('btn-reroll-no').onclick = () => { $('modal-generic').classList.add('hidden'); onNo(); };
  }

  /* ---------- barra del gruppo ---------- */

  function renderPartyBar(containerId, activeIdx = -1) {
    const bar = $(containerId);
    bar.innerHTML = '';
    G.party.forEach((h, i) => {
      const slot = document.createElement('div');
      slot.className = 'party-slot' + (i === activeIdx ? ' active-turn' : '') + ((h.down || h.preso || h.morto) ? ' dead' : '');
      const cv = document.createElement('canvas');
      cv.width = 36; cv.height = 36;
      slot.appendChild(cv);
      const info = document.createElement('div');
      info.className = 'party-slot-info';
      const frac = h.hp / h.maxHp;
      info.innerHTML = `
        <div class="party-slot-name">${h.name.split(' ')[0]}</div>
        ${h.player ? `<div class="party-slot-player">${h.player}</div>` : ''}
        <div class="hp-bar"><div class="hp-fill ${frac > 0.5 ? 'high' : frac > 0.25 ? 'mid' : ''}" style="width:${Math.max(0, frac * 100)}%"></div></div>
        <span class="hp-text">${h.morto ? '👻 SPIRITO' : h.preso ? '🕸 PRESO' : h.down ? 'A TERRA' : (h.veleno ? '🩶 ' : '') + h.hp + '/' + h.maxHp + ' PV'}</span>`;
      slot.appendChild(info);
      slot.onclick = () => showHeroSheet(h);
      bar.appendChild(slot);
      Sprites.renderToCanvas(cv, Sprites.registry[h.sprite]);
    });
  }

  /* ---------- schede e modali ---------- */

  function heroSheetHTML(h, withUses = true) {
    const stats = Object.entries(h.stats).map(([k, v]) =>
      `<div class="stat-chip"><span class="stat-label">${k}</span><span class="stat-val">${v >= 0 ? '+' + v : v}</span></div>`).join('');
    const abilities = h.abilities.map(ab => {
      const left = withUses && G && G.uses[h.id] ? ` — usi rimasti: <b>${G.uses[h.id][ab.id]}</b>` : ` — usi per avventura: <b>${ab.uses}</b>`;
      return `<div class="ability-box"><span class="ability-name">✨ ${ab.name}</span>${left}<div class="ability-desc">${ab.desc}</div></div>`;
    }).join('');
    return `
      <h2>${h.name}</h2>
      <p style="color:var(--blue);font-size:20px">${h.class} — <i>${h.tagline}</i></p>
      ${h.player ? `<p style="color:var(--text-dim)">Giocato da: <b>${h.player}</b></p>` : ''}
      <div class="stat-row">
        <div class="stat-chip"><span class="stat-label">PV</span><span class="stat-val">${G ? h.hp + '/' + h.maxHp : h.maxHp}</span></div>
        <div class="stat-chip"><span class="stat-label">CA</span><span class="stat-val">${h.ac}</span></div>
        ${stats}
      </div>
      <h3>⚔ Attacco</h3>
      <div class="ability-box"><span class="ability-name">${h.attack.name}</span><div class="ability-desc">${h.attack.desc}</div></div>
      <h3>✨ Abilità speciali</h3>
      ${abilities}
      <div class="ability-box"><span class="ability-name">🌟 Passiva</span><div class="ability-desc">${h.passive}</div></div>
      <h3>📜 Storia</h3>
      <div class="backstory">${h.backstory}</div>
      <div class="backstory" style="border-left:5px solid var(--green)"><b>Come interpretarlo:</b> ${h.voice}</div>
      <p style="font-size:19px;color:var(--text-dim);margin-top:8px"><b>Ruolo nel gruppo:</b> ${h.role}</p>`;
  }

  function showHeroSheet(h) {
    const box = $('modal-generic-content');
    box.innerHTML = heroSheetHTML(h) + `<button class="btn" style="margin-top:14px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function showParty() {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>🎭 La Compagnia</h2>` +
      G.party.map((h, i) => `<div class="ability-box" style="cursor:pointer" onclick="Engine.showHeroSheetIdx(${i})">
        <span class="ability-name">${h.name}</span> — ${h.class}${h.player ? ' · ' + h.player : ''}
        <div class="ability-desc">PV ${h.hp}/${h.maxHp} · CA ${h.ac} ${h.down ? '· 💀 A TERRA' : ''} — <i>tocca per la scheda completa</i></div>
      </div>`).join('') +
      `<button class="btn" style="margin-top:14px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function showHeroSheetIdx(i) { showHeroSheet(G.party[i]); }

  function showInventory() {
    const box = $('modal-generic-content');
    const counts = {};
    for (const it of G.inventory) counts[it] = (counts[it] || 0) + 1;
    let itemsHtml = Object.entries(counts).map(([it, n]) => {
      const item = ITEMS[it];
      const useBtn = item.revive ? `<button class="btn btn-small" onclick="Engine.useRevive('${it}')">💗 Riporta indietro</button>` :
        item.usable ? `<button class="btn btn-small" onclick="Engine.usePotionOutside('${it}')">🧪 Usa</button>` :
        item.cureVeleno ? `<button class="btn btn-small" onclick="Engine.useAntidote('${it}')">🌈 Cura il Grigiore</button>` : '';
      return `<div class="inv-item"><span class="inv-name">${item.name}${n > 1 ? ' ×' + n : ''}</span><span class="inv-desc">${item.desc}</span>${useBtn}</div>`;
    }).join('') || '<p style="color:var(--text-dim)">Lo zaino è vuoto. Succede ai migliori.</p>';
    box.innerHTML = `<h2>🎒 Le Vostre Cose</h2>
      <div class="gold-display">🎨 Colore: ${G.gold}</div>
      ${itemsHtml}
      <button class="btn" style="margin-top:14px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function useAntidote(itemId) {
    const box = $('modal-generic-content');
    const ingrigiti = G.party.filter(h => h.veleno);
    if (!ingrigiti.length) {
      box.innerHTML = `<h2>🌈 ${ITEMS[itemId].name}</h2>
        <p style="margin-bottom:12px">Nessuno ha il Grigiore nelle vene, per ora. Conservatela: la Casa è lunga.</p>
        <button class="btn" onclick="Engine.showInventory()">↩ Indietro</button>`;
      $('modal-generic').classList.remove('hidden');
      return;
    }
    box.innerHTML = `<h2>🌈 ${ITEMS[itemId].name}</h2><p style="margin-bottom:12px">Chi la prende?</p>` +
      G.party.map((h, i) => h.veleno ? `<button class="choice-btn" onclick="Engine.applyAntidote('${itemId}', ${i})">${h.name} <span class="choice-tag">🩶 INGRIGITO</span></button>` : '').join('');
    $('modal-generic').classList.remove('hidden');
  }

  /* Il Cuore di Colore: riporta indietro uno SPIRITO. L'oggetto più prezioso del gioco. */
  function useRevive(itemId) {
    const box = $('modal-generic-content');
    const spiriti = G.party.filter(h => h.morto);
    if (!spiriti.length) {
      box.innerHTML = `<h2>💗 ${ITEMS[itemId].name}</h2>
        <p style="margin-bottom:12px">Batte piano, nella borsa. Nessuno di voi è uno spirito — e speriamo che resti così. Conservatelo come la cosa più preziosa che avete. Perché lo è.</p>
        <button class="btn" onclick="Engine.showInventory()">↩ Indietro</button>`;
      $('modal-generic').classList.remove('hidden');
      return;
    }
    box.innerHTML = `<h2>💗 ${ITEMS[itemId].name}</h2><p style="margin-bottom:12px">Batte più forte, adesso. Sa che c'è lavoro. Chi riportate indietro?</p>` +
      G.party.map((h, i) => h.morto ? `<button class="choice-btn" onclick="Engine.applyRevive('${itemId}', ${i})">${h.name} <span class="choice-tag">👻 SPIRITO</span></button>` : '').join('') +
      `<button class="btn" style="margin-top:12px" onclick="Engine.showInventory()">↩ Non ancora</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function applyRevive(itemId, heroIdx) {
    const i = G.inventory.indexOf(itemId);
    if (i < 0) return;
    G.inventory.splice(i, 1);
    const h = G.party[heroIdx];
    h.morto = false; h.down = false;
    h.hp = Math.ceil(h.maxHp / 2);
    G.flags['tornato_' + h.id] = true;
    saveGame();
    renderPartyBar('party-bar');
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>💗 ${h.name} respira.</h2>
      <p style="margin-bottom:12px">Il Cuore di Colore si spegne in un ultimo battito caldo, e il grigio scivola via da ${h.name} come acqua sporca. Un colpo di tosse. Occhi aperti. <b>${h.name} è di nuovo con voi</b> (${h.hp}/${h.maxHp} PV).</p>
      <p style="color:var(--text-dim)">La Casa, da qualche parte, ha appena URLATO.</p>
      <button class="btn btn-gold" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">▶ Si continua. Insieme.</button>`;
    if (typeof Sound !== 'undefined') Sound.play('victory');
  }

  function applyAntidote(itemId, heroIdx) {
    const i = G.inventory.indexOf(itemId);
    if (i < 0) return;
    G.inventory.splice(i, 1);
    G.party[heroIdx].veleno = false;
    saveGame();
    renderPartyBar('party-bar');
    showInventory();
  }

  function usePotionOutside(itemId) {
    const box = $('modal-generic-content');
    const item = ITEMS[itemId];
    box.innerHTML = `<h2>🧪 ${item.name}</h2><p style="margin-bottom:12px">Chi la beve?</p>` +
      G.party.map((h, i) => h.morto ? '' : `<button class="choice-btn" onclick="Engine.applyPotion('${itemId}', ${i})">${h.name} <span class="choice-tag">PV ${h.hp}/${h.maxHp}${h.down ? ' — A TERRA' : ''}</span></button>`).join('');
    $('modal-generic').classList.remove('hidden');
  }

  function applyPotion(itemId, heroIdx) {
    const i = G.inventory.indexOf(itemId);
    if (i < 0) return;
    const h = G.party[heroIdx];
    if (h.morto) return; // gli spiriti non bevono: serve un Cuore di Colore
    G.inventory.splice(i, 1);
    if (ITEMS[itemId].recharge) {
      // il caffè di Don Michele: tutte le abilità di nuovo cariche
      for (const ab of h.abilities) G.uses[h.id][ab.id] = ab.uses;
      saveGame();
      renderPartyBar('party-bar');
      showInventory();
      return;
    }
    h.down = false;
    h.hp = Math.min(h.maxHp, Math.max(0, h.hp) + ITEMS[itemId].heal);
    saveGame();
    renderPartyBar('party-bar');
    showInventory();
  }

  function showRules() {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>📖 Regole Rapide</h2>${RULES_QUICK}
      <button class="btn" style="margin-top:14px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  /* ---------- mappa ---------- */

  function showMap() {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>🗺 La Casa — pianta (per quello che vale)</h2><canvas id="map-canvas" width="720" height="480"></canvas>
      <p style="color:var(--text-dim);font-size:19px;margin-top:8px">⭐ = dove siete adesso. La pianta è stata disegnata da Gaetano su un tovagliolo. La Casa la CONTRADDICE volentieri.</p>
      <button class="btn" style="margin-top:10px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    $('modal-generic').classList.remove('hidden');
    drawMap();
  }

  function drawMap() {
    // la pianta "da tovagliolo" di Gaetano: stile blueprint, righello incluso
    const canvas = $('map-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    const r = Scenes.rng(500);

    // carta scura da progetto
    Scenes.blocks(ctx, 0, 0, W, H, '#12141d', 20, r, 0.10);
    // griglia millimetrata
    ctx.strokeStyle = 'rgba(90,110,150,0.10)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // corridoi tratteggiati tra le stanze
    ctx.strokeStyle = '#5a6a8a'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]);
    const pts = k => { const l = WORLD_MAP.find(w => w.key === k); return l ? [l.x * W, l.y * H] : [W / 2, H / 2]; };
    const path = (a, b) => {
      const A = WORLD_MAP.find(w => w.key === a), B = WORLD_MAP.find(w => w.key === b);
      if (!A || !B) return;
      const [x1, y1] = pts(a), [x2, y2] = pts(b);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    path('strada', 'palazzo'); path('palazzo', 'appartamento'); path('appartamento', 'salotto');
    path('salotto', 'biblioteca'); path('salotto', 'porte'); path('salotto', 'cucina');
    path('cucina', 'sottoscala'); path('biblioteca', 'switch'); path('porte', 'switch');
    path('sottoscala', 'switch'); path('switch', 'cattedrale');
    ctx.setLineDash([]);

    const cur = WORLD_MAP.find(w => w.scenes.includes(G.sceneId));

    for (const loc of WORLD_MAP) {
      const x = loc.x * W, y = loc.y * H;
      const isCur = cur && cur.key === loc.key;
      // stanza: rettangolo da pianta con "muri"
      const rw = 52, rh = 34;
      ctx.fillStyle = isCur ? 'rgba(232,182,76,0.16)' : 'rgba(90,110,150,0.12)';
      ctx.fillRect(x - rw / 2, y - rh / 2, rw, rh);
      ctx.strokeStyle = isCur ? '#e8b64c' : '#7a8ab0'; ctx.lineWidth = 3;
      ctx.strokeRect(x - rw / 2, y - rh / 2, rw, rh);
      // la porta (un varco nel muro in basso)
      ctx.fillStyle = '#12141d'; ctx.fillRect(x - 6, y + rh / 2 - 2, 12, 5);
      // dettaglio per stanza
      ctx.font = "14px 'Press Start 2P'"; ctx.textAlign = 'center'; ctx.fillStyle = isCur ? '#e8b64c' : '#9aa6c0';
      const ICONS = { strada: '🌆', palazzo: '🏢', appartamento: '🚪', salotto: '🛋', biblioteca: '📚', porte: '🚪', cucina: '🧊', sottoscala: '🕳', switch: '🎮', cattedrale: '🩶' };
      ctx.fillText(ICONS[loc.key] || '▪', x, y + 5);
      // etichetta
      ctx.font = "9px 'Press Start 2P'";
      ctx.fillStyle = isCur ? '#e8b64c' : '#8a94ac';
      ctx.fillText(loc.label, x, y + rh / 2 + 14);
      if (isCur) { ctx.font = "14px 'Press Start 2P'"; ctx.fillStyle = '#e8b64c'; ctx.fillText('⭐', x, y - rh / 2 - 8); }
      ctx.textAlign = 'left';
    }

    // nota a margine, in grafia da ingegnere
    ctx.font = "9px 'Press Start 2P'"; ctx.fillStyle = 'rgba(200,210,235,0.45)'; ctx.textAlign = 'left';
    ctx.fillText('scala 1:boh — G.', 14, H - 14);
    // il timbro del Grigiore nell'angolo
    ctx.fillStyle = 'rgba(120,120,130,0.5)';
    for (let dy = -12; dy <= 12; dy += 3) {
      const hw = Math.floor(Math.sqrt(144 - dy * dy) / 3) * 3;
      ctx.fillRect(W - 40 - hw, 36 + dy, hw * 2, 3);
    }
  }

  /* ---------- menu ---------- */

  function showMenu() {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>☰ Menu</h2>
      <p style="color:var(--text-dim);margin-bottom:14px">💾 Salvataggio automatico a ogni scena — utente <b>${currentProfile()}</b>, <b>slot ${G.slot || 1}</b> di 3. Potete chiudere il browser e riprendere quando volete.</p>
      <button class="choice-btn" onclick="document.getElementById('modal-generic').classList.add('hidden')">▶ Torna alla partita</button>
      <button class="choice-btn" onclick="Engine.showDiary()">📔 Diario di viaggio</button>
      <button class="choice-btn" onclick="Engine.showBestiary()">🐺 Bestiario (nemici incontrati)</button>
      <button class="choice-btn" onclick="Engine.backToTitle()">🏠 Torna al titolo (la partita resta salvata)</button>
      <button class="choice-btn" style="border-left-color:var(--red)" onclick="Engine.confirmRestart()">🗑 Ricomincia da capo (cancella il salvataggio)</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function reviveUnlocked() {
    try { return localStorage.getItem('casa-notte-finita-' + encodeURIComponent(currentProfile())) === '1'; } catch (e) { return false; }
  }

  /* "Rientra nella Casa" con il CONTO di quello che manca, capitolo per capitolo:
     % di stanze viste (cumulative del profilo) e imprese ancora da sbloccare LÌ. */
  function chapterProgress() {
    const seen = seenScenes();
    // impresa → capitolo: si deduce dalla scena che imposta il suo flag (zero manutenzione)
    const flagScene = {};
    for (const [id, sc] of Object.entries(CAMPAIGN)) {
      for (const f of Object.keys(sc.sets || {})) if (!(f in flagScene)) flagScene[f] = id;
      for (const ch of sc.choices || []) for (const f of Object.keys(ch.sets || {})) if (!(f in flagScene)) flagScene[f] = id;
    }
    let collezione = new Set();
    try { collezione = new Set(JSON.parse(localStorage.getItem('casa-imprese-' + encodeURIComponent(currentProfile())) || '[]')); } catch (e) {}
    return (c) => {
      if (!c.prefixes) return null;
      const match = id => c.prefixes.some(p => id.startsWith(p));
      const ids = Object.keys(CAMPAIGN).filter(match);
      const viste = ids.filter(id => seen.has(id)).length;
      const imprese = (typeof IMPRESE !== 'undefined' ? IMPRESE : []).filter(i => flagScene[i.flag] && match(flagScene[i.flag]));
      const mancanti = imprese.filter(i => !collezione.has(i.flag));
      return { pct: Math.round(viste / Math.max(1, ids.length) * 100), viste, tot: ids.length, imprese: imprese.length, mancanti };
    };
  }

  function showRevive() {
    const box = $('modal-generic-content');
    const progress = chapterProgress();
    const rows = (typeof CHAPTERS !== 'undefined' ? CHAPTERS : []).map((c, i) => {
      const p = progress(c);
      let stato = '';
      if (p) {
        const done = p.pct >= 100 && !p.mancanti.length;
        const manca = p.mancanti.length
          ? ` · 🏆 mancano ${p.mancanti.length}: <i>${p.mancanti.slice(0, 3).map(m => m.title).join(' · ')}${p.mancanti.length > 3 ? ' · …' : ''}</i>`
          : (p.imprese ? ' · 🏆 imprese complete' : '');
        stato = `<br><span style="color:${done ? 'var(--green)' : 'var(--gold)'}">${done ? '✅ COMPLETO' : `👁 esplorato ${p.pct}% (${p.viste}/${p.tot} stanze)`}${manca}</span>`;
      }
      return `<button class="choice-btn" onclick="Engine.startChapter(${i})">${c.label} <span class="choice-tag">${c.desc}${stato}</span></button>`;
    }).join('');
    const seenAll = seenScenes().size;
    const totAll = Object.keys(CAMPAIGN).length;
    box.innerHTML = `<h2>🗝 Rientra nella Casa</h2>
      <p style="color:var(--text-dim);margin-bottom:10px">Ne siete già usciti una volta: adesso la Casa vi lascia scegliere DA DOVE rientrare — e vi dice QUANTO vi manca. Esplorazione totale del profilo: <b>${Math.round(seenAll / totAll * 100)}%</b> (${seenAll}/${totAll} stanze).</p>
      ${rows}
      <button class="btn" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">↩ Indietro</button>`;
    $('modal-generic').classList.remove('hidden');
  }

  function startChapter(i) {
    const c = (typeof CHAPTERS !== 'undefined') ? CHAPTERS[i] : null;
    if (!c) return;
    const tutti = ['gaetano', 'natalino', 'claudia', 'federico', 'emanuela'].map(id => ({ heroId: id, player: '' }));
    newGame(tutti);
    $('modal-generic').classList.add('hidden');
    if (c.flags) Object.assign(G.flags, c.flags);
    if (c.items) for (const it of c.items) G.inventory.push(it);
    if (c.addHero) { // i capitoli del finale partono con Daniele già in squadra
      const base = HEROES.find(h => h.id === c.addHero);
      if (base && !G.party.some(h => h.id === c.addHero)) {
        const hero = { ...JSON.parse(JSON.stringify(base)), hp: base.maxHp, down: false, player: '' };
        G.party.push(hero);
        G.uses[hero.id] = {};
        for (const ab of hero.abilities) G.uses[hero.id][ab.id] = ab.uses;
        G.flags[hero.id + '_in_squadra'] = true;
      }
    }
    gotoScene(c.scene || c.id);
  }

  function showDiary() {
    const box = $('modal-generic-content');
    const beats = (G.history || []).map((c, i) => `<div class="ability-box" style="border-left-color:var(--gold)"><div class="ability-desc">${i + 1}. ${c}</div></div>`).join('') ||
      '<p style="color:var(--text-dim)">Il diario è ancora bianco. Le grandi storie iniziano così.</p>';
    let sapete = '';
    if (typeof DIARY_FLAGS !== 'undefined') {
      const note = DIARY_FLAGS.filter(([f]) => G.flags && G.flags[f])
        .map(([, t]) => `<div class="ability-box" style="border-left-color:var(--purple)"><div class="ability-desc">🕯 ${t}</div></div>`).join('');
      sapete = `<h2 style="margin-top:16px">🩶 Cose che la Casa vi ha insegnato</h2>
        ${note || '<p style="color:var(--text-dim)">Ancora niente. Ma la Casa è lunga, e insegna volentieri. A caro prezzo.</p>'}`;
    }
    box.innerHTML = `<h2>📔 Diario di Viaggio</h2>
      <p style="color:var(--text-dim);margin-bottom:10px">Le tappe della vostra impresa, in ordine:</p>
      ${beats}
      ${sapete}
      <button class="btn" style="margin-top:12px" onclick="Engine.showMenu()">↩ Menu</button>`;
  }

  function showBestiary() {
    const box = $('modal-generic-content');
    const seen = G.seenEnemies || [];
    let html = `<h2>🩶 Le Cose della Casa</h2>
      <p style="color:var(--text-dim);margin-bottom:10px">Cose incontrate finora: ${seen.length}. Le altre vi stanno già aspettando.</p>`;
    if (!seen.length) html += '<p style="color:var(--text-dim)">Nessuno scontro finora. Beati voi.</p>';
    for (const key of seen) {
      const b = BESTIARY[key];
      if (!b) continue;
      html += `<div class="ability-box" style="display:flex;gap:12px;align-items:center">
        <canvas data-sprite="${b.sprite}" width="56" height="56" style="border:2px solid var(--border);background:#111;flex-shrink:0"></canvas>
        <div><span class="ability-name">${b.name}</span>${b.undead ? ' <span style="color:var(--purple)">· non-morto</span>' : ''}${b.boss ? ' <span style="color:var(--red)">· BOSS</span>' : ''}
        <div class="ability-desc">${b.flavor}<br>PV ${b.maxHp} · CA ${b.ac} · ${b.attack.name}</div></div>
      </div>`;
    }
    html += `<button class="btn" style="margin-top:12px" onclick="Engine.showMenu()">↩ Menu</button>`;
    box.innerHTML = html;
    box.querySelectorAll('canvas[data-sprite]').forEach(cv => Sprites.renderToCanvas(cv, Sprites.registry[cv.dataset.sprite]));
  }

  function backToTitle() {
    $('modal-generic').classList.add('hidden');
    showScreen('screen-title');
    Main.refreshTitle();
  }

  function confirmRestart() {
    const box = $('modal-generic-content');
    box.innerHTML = `<h2>⚠ Sicuri sicuri?</h2>
      <p style="margin-bottom:14px">Cancellerete il salvataggio e tutta la gloria accumulata. Per sempre.</p>
      <button class="choice-btn" onclick="Engine.doRestart()">🗑 Sì, ricominciamo da capo</button>
      <button class="choice-btn" onclick="Engine.showMenu()">↩ No, torna al menu</button>`;
  }

  function doRestart() {
    clearSave();
    $('modal-generic').classList.add('hidden');
    showScreen('screen-title');
    Main.refreshTitle();
  }

  /* ---------- finale ---------- */

  function renderEnding(scene) {
    const choicesEl = $('choices');
    const mins = Math.round((Date.now() - G.stats.start) / 60000);

    // epiloghi personali degli eroi
    const endingType = G.sceneId === 'e_parola' ? 'parola' : G.sceneId === 'e_gemelli' ? 'gemelli' : G.sceneId === 'e_scambio' ? 'scambio' : G.sceneId === 'e_grigio' ? null : 'colori';
    if (typeof HERO_EPILOGUES !== 'undefined' && endingType) {
      const epi = document.createElement('div');
      epi.innerHTML = `<h3 style="font-family:var(--font-pixel);font-size:14px;color:var(--blue);margin:14px 0 8px">🌟 E i nostri eroi?</h3>` +
        G.party.map(h => {
          const text = HERO_EPILOGUES[h.id] && HERO_EPILOGUES[h.id][endingType];
          return text ? `<div class="ability-box"><span class="ability-name">${h.name}${h.player ? ' (' + h.player + ')' : ''}</span><div class="ability-desc">${text}</div></div>` : '';
        }).join('');
      choicesEl.appendChild(epi);
    }

    // cronache: il mondo là fuori ricorda le vostre scelte
    if (typeof CRONACA !== 'undefined') {
      const righe = CRONACA.filter(c => G.flags[c.flag]);
      if (righe.length) {
        const cron = document.createElement('div');
        cron.innerHTML = `<h3 style="font-family:var(--font-pixel);font-size:14px;color:var(--purple);margin:14px 0 8px">📜 Cronache di Fuori — sei mesi dopo</h3>` +
          righe.map(c => `<div class="ability-box" style="border-left-color:var(--purple)"><div class="ability-desc">${c.icon} ${c.text}</div></div>`).join('');
        choicesEl.appendChild(cron);
      }
    }

    // imprese sbloccate
    // sblocca "Rientra nella Casa" per il profilo: da adesso ogni ramo è visitabile a scelta
    try { localStorage.setItem('casa-notte-finita-' + encodeURIComponent(currentProfile()), '1'); } catch (e) {}
    if (typeof IMPRESE !== 'undefined') {
      const unlocked = IMPRESE.filter(i => G.flags[i.flag]);
      // la COLLEZIONE del profilo: le imprese restano sbloccate tra una notte e l'altra
      let collezione = unlocked.map(i => i.flag);
      try {
        const key = 'casa-imprese-' + encodeURIComponent(currentProfile());
        const prima = JSON.parse(localStorage.getItem(key) || '[]');
        collezione = [...new Set([...prima, ...collezione])].filter(f => IMPRESE.some(i => i.flag === f));
        localStorage.setItem(key, JSON.stringify(collezione));
      } catch (e) { /* localStorage pieno o assente: la collezione resta di sessione */ }
      if (unlocked.length) {
        const nuove = unlocked.length, totale = collezione.length;
        const ach = document.createElement('div');
        ach.innerHTML = `<h3 style="font-family:var(--font-pixel);font-size:14px;color:var(--gold);margin:14px 0 8px">🏆 Imprese di stanotte (${nuove}/${IMPRESE.length}) — Collezione di ${currentProfile()}: ${totale}/${IMPRESE.length}</h3>` +
          unlocked.map(i => `<div class="ability-box" style="border-left-color:var(--gold)"><span class="ability-name">${i.icon} ${i.title}</span><div class="ability-desc">${i.desc}</div></div>`).join('') +
          (totale < IMPRESE.length ? `<p style="color:var(--text-dim);font-size:18px;margin:6px 0 10px">Le altre ${IMPRESE.length - totale} imprese vi aspettano in un altro giro — e la collezione le RICORDA.</p>` : `<p style="color:var(--gold);font-size:18px;margin:6px 0 10px">🏆 COLLEZIONE COMPLETA: avete spremuto la Casa fino all'ultima stanza. Chapeau.</p>`);
        choicesEl.appendChild(ach);
      }
    }

    const spiriti = G.party.filter(h => h.morto);
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="ability-box" style="border-left-color:var(--gold)">
        <span class="ability-name">📊 Cronaca dell'impresa</span>
        <div class="ability-desc">
          ${spiriti.length ? `Usciti vivi: ${G.party.filter(h => !h.morto).map(h => h.name.split(' ')[0]).join(', ')} · 👻 Rimasti spiriti: ${spiriti.map(h => h.name.split(' ')[0]).join(', ')}` : `Usciti tutti: ${G.party.map(h => h.name.split(' ')[0]).join(', ')}`}<br>
          Scontri vinti: ${G.stats.combats} · Prove superate: ${G.stats.checksPassed} · Prove fallite: ${G.stats.checksFailed} (le più memorabili)<br>
          Colore finale: 🎨 ${G.gold} · Durata: circa ${mins} minuti<br>
          Esplorazione della Casa: ${Math.round(Object.keys(G.enteredScenes || {}).length / Object.keys(CAMPAIGN).length * 100)}% (${Object.keys(G.enteredScenes || {}).length} stanze su ${Object.keys(CAMPAIGN).length})<br>
          Segreti su Eleinad: ${['segreto_specchio','segreto_gemelli','segreto_trono'].filter(n => G.flags[n]).length}/3 ${G.flags.daniele_in_squadra ? '· 🎮 Daniele si è unito alla squadra' : ''} ${G.flags.foto_ricomposta ? '· 📷 La foto dei gemelli è intera' : ''}
        </div>
      </div>`;
    choicesEl.appendChild(div);

    /* Quello che la Casa non vi ha mostrato: suggerimenti SENZA spoiler,
       col capitolo giusto da cui rientrare (la feature "cosa manca e dove"). */
    const progress = chapterProgress();
    const daFare = (typeof CHAPTERS !== 'undefined' ? CHAPTERS : [])
      .map(c => ({ c, p: progress(c) }))
      .filter(x => x.p && (x.p.pct < 100 || x.p.mancanti.length))
      .sort((a, b) => (b.p.mancanti.length - a.p.mancanti.length) || (a.p.pct - b.p.pct));
    if (daFare.length) {
      const sugg = document.createElement('div');
      sugg.innerHTML = `<h3 style="font-family:var(--font-pixel);font-size:14px;color:var(--green);margin:14px 0 8px">🗝 Quello che la Casa non vi ha mostrato</h3>` +
        daFare.slice(0, 4).map(({ c, p }) =>
          `<div class="ability-box" style="border-left-color:var(--green)"><span class="ability-name">${c.label}</span>
            <div class="ability-desc">👁 esplorato ${p.pct}% (${p.viste}/${p.tot} stanze)${p.mancanti.length ? ` · 🏆 ${p.mancanti.length} impres${p.mancanti.length === 1 ? 'a' : 'e'} ancora là dentro: <i>${p.mancanti.slice(0, 3).map(m => m.title).join(' · ')}${p.mancanti.length > 3 ? ' · …' : ''}</i>` : ''}</div>
          </div>`).join('') +
        `<p style="color:var(--text-dim);font-size:18px;margin:6px 0 2px">Nessuno spoiler: solo i titoli. Con <b>🗝 Rientra nella Casa</b> partite dal capitolo giusto, con zaino e conoscenze già pronti — senza rigiocare tutto.</p>`;
      choicesEl.appendChild(sugg);
      const goRevive = document.createElement('button');
      goRevive.className = 'choice-btn';
      goRevive.style.borderLeftColor = 'var(--green)';
      goRevive.innerHTML = `🗝 <b>Rientra nella Casa</b> <span class="choice-tag">Scegliete il capitolo: il gioco vi dice quanto manca in ognuno.</span>`;
      goRevive.onclick = () => showRevive();
      choicesEl.appendChild(goRevive);
    } else if (typeof CHAPTERS !== 'undefined') {
      const done = document.createElement('div');
      done.innerHTML = `<div class="ability-box" style="border-left-color:var(--gold)"><span class="ability-name">🏆 100%</span><div class="ability-desc">Avete visto OGNI stanza e sbloccato OGNI impresa. La Casa non ha più niente da nascondervi. Voi, a lei, non dovete più niente.</div></div>`;
      choicesEl.appendChild(done);
    }

    const replay = document.createElement('button');
    replay.className = 'choice-btn';
    replay.innerHTML = `🔄 <b>Nuova partita</b> <span class="choice-tag">Un'altra pista, un altro segreto su Eleinad, un altro finale... e le stanze che non avete aperto.</span>`;
    replay.onclick = () => { clearSave(); showScreen('screen-title'); Main.refreshTitle(); };
    choicesEl.appendChild(replay);

    const title = document.createElement('button');
    title.className = 'choice-btn';
    title.innerHTML = `🏠 Torna al titolo`;
    title.onclick = () => { showScreen('screen-title'); Main.refreshTitle(); };
    choicesEl.appendChild(title);
  }

  return {
    newGame, saveGame, loadGame, hasSave, clearSave, listSaves, firstFreeSlot,
    listProfiles, currentProfile, setCurrentProfile, deleteProfile, renameProfile, exportCode, importCode,
    showScreen, gotoScene, currentScene, renderPartyBar,
    showParty, showHeroSheet, showHeroSheetIdx, showInventory, showRules, showMap, showMenu, showDiary, showBestiary, showRevive, startChapter, reviveUnlocked,
    usePotionOutside, applyPotion, useAntidote, applyAntidote, useRevive, applyRevive, backToTitle, confirmRestart, doRestart,
    heroSheetHTML, formatText,
  };
})();
