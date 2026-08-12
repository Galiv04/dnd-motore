/* ============ COMBAT — combattimento a turni ============ */

const Combat = (() => {

  let battle = null; // stato del combattimento corrente

  const $ = id => document.getElementById(id);

  function log(html, cls = '') {
    const el = $('combat-log');
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.innerHTML = html;
    el.appendChild(p);
    el.scrollTop = el.scrollHeight;
  }

  function heroMod(hero, stat) {
    let m = hero.stats[stat] || 0;
    if (hero.veleno) m -= 2; // INGRIGITO
    if (hero.id === 'gaetano' && stat === 'INT') m += 2;
    if (hero.id === 'claudia' && stat === 'SAG') m += 2;
    if (hero.id === 'federico' && stat === 'CAR') m += 2;
    if (hero.id === 'daniele' && stat === 'CAR') m += 2; // Ha Letto il Manuale
    return m;
  }

  /* ---------- avvio ---------- */

  function start(combatDef, sceneId) {
    const isBoss = /^[zm]\d/.test(sceneId) || (combatDef.enemies || []).some(e => /eleinad|divorente|bozzolo|luca_giunti|cosa_sommersa/.test(e));
    // la Casa dosa il Grigiore in proporzione: meno vittime, porzioni più piccole
    const attivi = G.party.filter(h => !h.down && !h.preso && !h.morto).length;
    const porzione = G.difficulty === 'incubo' ? 1 : (attivi === 1 ? 0.7 : attivi === 2 ? 0.85 : 1);
    battle = {
      def: combatDef,
      sceneId,
      isBoss,
      round: 1,
      enemies: combatDef.enemies.map((key, i) => {
        const b = BESTIARY[key];
        const e = { ...b, key, hp: b.maxHp, idx: i, stunned: false, distracted: false, dead: false,
          attack: { ...b.attack } };
        if (G.difficulty === 'facile') {
          e.maxHp = Math.max(1, Math.round(e.maxHp * 0.8));
          e.hp = e.maxHp;
          e.attack.bonus = Math.max(0, e.attack.bonus - 1);
        }
        if (G.difficulty === 'incubo') {
          e.maxHp = Math.round(e.maxHp * 1.25);
          e.hp = e.maxHp;
          e.attack.bonus += 1;
        }
        if (porzione < 1) {
          e.maxHp = Math.max(1, Math.round(e.maxHp * porzione));
          e.hp = e.maxHp;
          if (attivi === 1) e.attack.bonus = Math.max(0, e.attack.bonus - 1);
        }
        return e;
      }),
      turnQueue: [],
      turnPtr: -1,
      tauntHeroIdx: null, tauntRounds: 0,
      smokeRounds: 0,
      over: false,
    };

    // reset per-combattimento
    for (const h of G.party) {
      h.defending = false;
      h.rageRounds = 0;
      h.luckUsed = false;
      h.zonkGritUsed = false;
    }

    // passiva di Emanuela: +3 PV a tutti a inizio combattimento
    const ema = G.party.find(h => h.id === 'emanuela' && !h.down && !h.preso && !h.morto);
    let openLines = [];
    if (porzione < 1) {
      openLines.push(`🩶 <b>Porzioni ridotte</b>: siete ${attivi === 1 ? 'in UNO' : 'in due'}, e la Casa dosa il Grigiore in proporzione — cose meno robuste${attivi === 1 ? ' e meno precise' : ''}.`);
    }
    if (ema) {
      for (const h of G.party) if (!h.down && !h.preso && !h.morto) h.hp = Math.min(h.maxHp, h.hp + 3);
      openLines.push(`🧰 <b>Cuore Saldo</b>: Emanuela ha già la borsa Kerastase aperta — +3 PV a tutti. «Respirate. Ci sono io.»`);
    }

    // iniziativa (gli spiriti guardano: niente turno, ma restano in scena)
    const combatants = [];
    G.party.forEach((h, i) => { if (!h.preso && !h.morto) combatants.push({ type: 'hero', idx: i, init: Dice.roll(20) + heroMod(h, 'DES') }); });
    battle.enemies.forEach((e, i) => combatants.push({ type: 'enemy', idx: i, init: Dice.roll(20) + 2 }));
    combatants.sort((a, b) => b.init - a.init);
    battle.turnQueue = combatants;

    // UI
    Engine.showScreen('screen-combat');
    $('combat-log').innerHTML = '';
    $('combat-actions').innerHTML = '';
    const banner = $('combat-banner');
    banner.textContent = '⚔ COMBATTIMENTO! ⚔';
    banner.classList.remove('hidden', 'victory');
    render();

    const COMBAT_MUSIC = {}; // una sola traccia di scontro (+ 'boss'): la Casa non ha bisogno di variare per farvi male
    const loc = (Engine.currentScene() || {}).location;
    if (typeof Sound !== 'undefined') { Sound.play('combat'); Sound.music(battle.isBoss ? 'boss' : (COMBAT_MUSIC[loc] || 'combat')); }
    log(`<b>Nemici:</b> ${battle.enemies.map(e => e.name).join(', ')}`, 'log-info');
    for (const e of [...new Set(battle.enemies.map(e => e.key))]) {
      log(`<i>${BESTIARY[e].name}: ${BESTIARY[e].flavor}</i>`, 'log-info');
      if (!G.seenEnemies) G.seenEnemies = [];
      if (!G.seenEnemies.includes(e)) G.seenEnemies.push(e);
    }

    // reazioni situazionali degli eroi
    if (battle.enemies.some(e => e.key === 'topo_grigio') && G.party.some(h => h.id === 'natalino' && !h.down && !h.morto)) {
      log(`🐀 Natalino: "TOPI. Ovviamente topi. Io lo dico al mio avvocato, a 'sta casa. Forbici alla mano, NON toccatemi i tronelli."`, 'log-turn');
    }
    if (battle.enemies.some(e => e.undead) && G.party.some(h => h.id === 'emanuela' && !h.down && !h.morto)) {
      log(`💨 Emanuela accende il phon: "Cose grigie, vi presento i 2200 watt. Il caldo VIVO. Odiatelo pure."`, 'log-turn');
    }
    if (battle.isBoss && G.party.some(h => h.id === 'federico' && !h.down && !h.morto)) {
      log(`👔 Federico: "Quella cosa ha la faccia di mio fratello. La faccia SBAGLIATA di mio fratello. E l'unico autorizzato a litigare con mio fratello sono IO."`, 'log-turn');
    }
    if (battle.isBoss && G.party.some(h => h.id === 'daniele' && !h.down && !h.morto)) {
      log(`🎮 Daniele: "Regola numero uno del manuale: chi urla di più sta perdendo. Ascoltate quanto urla."`, 'log-turn');
    }
    const spiriti = G.party.filter(h => h.morto);
    if (spiriti.length) {
      log(`👻 ${spiriti.map(h => h.name.split(' ')[0]).join(' e ')} guarda${spiriti.length > 1 ? 'no' : ''} lo scontro da un passo fuori dal mondo. Fa il tifo. Si sente.`, 'log-info');
    }
    openLines.forEach(l => log(l, 'log-heal'));
    log(`Ordine di iniziativa: ${battle.turnQueue.map(c => c.type === 'hero' ? G.party[c.idx].name.split(' ')[0] : battle.enemies[c.idx].name.split(',')[0]).join(' → ')}`, 'log-info');

    /* Gli echi delle scelte della notte, dove pesano di più: nei boss. */
    if (battle.isBoss && G.flags.sorpresa) log(`⚡ <b>Sorpresa!</b> Primo giro con VANTAGGIO agli attacchi!`, 'log-heal');
    if (battle.isBoss && G.flags.foto_ricomposta) {
      battle.enemies.forEach(e => { if (!e.dead) e.attack.bonus = Math.max(0, e.attack.bonus - 1); });
      log(`📷 La foto dei gemelli, INTERA, brucia nella tasca di chi la porta: il Grigiore non riesce a guardarla. Le cose colpiscono più piano (<b>-1 ai loro colpi</b>).`, 'log-heal');
    }
    if (battle.isBoss && G.flags.daniele_sabota && !G.flags.daniele_in_squadra) {
      log(`📺 Le luci sfarfallano in codice Morse. È DANIELE, da dentro: sta sabotando i fusibili della casa. <b>+1 a tutti i vostri tiri!</b>`, 'log-heal');
    }
    if (battle.isBoss && G.flags.sonnambuli_svegli) {
      const bersaglio = battle.enemies.find(e => e.boss && !e.dead) || battle.enemies[0];
      if (bersaglio) {
        bersaglio.hp = Math.max(1, bersaglio.hp - 5);
        log(`🧟 Dalla Galleria arrivano PASSI: i Sonnambuli che avete svegliato entrano in ciabatte e si mettono in mezzo. ${bersaglio.name} incassa la loro rabbia lenta: <b>-5 PV</b>.`, 'log-crit');
      }
    }
    if (battle.isBoss && G.flags.gemelli_pace) {
      battle.enemies.forEach(e => { if (!e.dead) e.distracted = true; });
      log(`👥 Federico e Daniele, spalla a spalla, D'ACCORDO SU QUALCOSA per la prima volta dal 1994. Il Grigiore non ha una casella per questo evento: esita (primo attacco con svantaggio).`, 'log-heal');
    }
    if (battle.isBoss && G.flags.manuale_annotato_letto) log(`📖 Avete letto le note di Daniele sul Manuale: conoscete i trucchi del nemico PRIMA che li usi. <b>+1 a tutti i vostri tiri!</b>`, 'log-heal');

    setTimeout(() => { banner.classList.add('hidden'); nextTurn(); }, 1600);
    if (raf) battle._raf = raf(animLoop);
  }

  /* ---------- rendering ---------- */

  function renderCanvas(ts = 0) {
    const canvas = $('combat-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    const scene = Engine.currentScene();
    (Scenes.painters[scene && scene.location] || Scenes.painters.strada)(ctx, W, H);

    // eroi a sinistra (con leggera oscillazione "idle")
    const heroes = G.party;
    const hScale = 4, hSize = 16 * hScale;
    heroes.forEach((h, i) => {
      const cols = Math.min(3, heroes.length);
      const col = i % cols, row = Math.floor(i / cols);
      const bob = (h.down || reducedMotion) ? 0 : Math.round(Math.sin(ts / 320 + i * 1.4) * 3);
      const x = 30 + col * (hSize + 16), y = H - 20 - hSize - row * (hSize + 14) + bob;
      h._x = x; h._y = y; h._size = hSize;
      const def = Sprites.registry[h.sprite];
      ctx.globalAlpha = h.morto ? 0.22 : h.down ? 0.35 : 1;
      Sprites.drawSprite(ctx, def.map, def.palette, x, y, hScale);
      ctx.globalAlpha = 1;
      if (h.morto) { ctx.font = "18px 'Press Start 2P'"; ctx.fillText('👻', x + hSize / 2 - 10, y - 6); }
      else if (h.down) { ctx.fillStyle = '#e05252'; ctx.font = "16px 'Press Start 2P'"; ctx.fillText('✖', x + hSize / 2 - 8, y + hSize / 2); }
    });

    // nemici a destra
    const alive = battle.enemies;
    const eScale = battle.enemies.length > 2 ? 4 : 5;
    const eSize = 16 * eScale;
    alive.forEach((e, i) => {
      const bob = (e.dead || reducedMotion) ? 0 : Math.round(Math.sin(ts / 280 + i * 2.1) * 3);
      const x = W - 60 - eSize - (i % 3) * (eSize + 26);
      const y = 60 + Math.floor(i / 3) * (eSize + 30) + (i % 2) * 18 + bob;
      e._x = x; e._y = y; e._size = eSize;
      if (e.dead) { ctx.globalAlpha = 0.18; }
      const def = Sprites.registry[e.sprite];
      Sprites.drawSprite(ctx, def.map, def.palette, x, y, eScale, true);
      ctx.globalAlpha = 1;
      if (!e.dead) {
        // barra HP nemico — targhette SFALSATE per indice, così i gruppi ravvicinati non si coprono
        const lift = (i % 2) * 26;
        const bw = eSize, bh = 8;
        ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 16 - lift, bw + 4, bh + 4);
        ctx.fillStyle = '#3a3045'; ctx.fillRect(x, y - 14 - lift, bw, bh);
        const frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = frac > 0.5 ? '#5fca6a' : frac > 0.25 ? '#f5c542' : '#e05252';
        ctx.fillRect(x, y - 14 - lift, Math.floor(bw * frac), bh);
        // nome
        ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P'"; ctx.textAlign = 'center';
        ctx.fillText((e.short || e.name.split(',')[0]).slice(0, 16), x + eSize / 2, y - 22 - lift);
        ctx.textAlign = 'left';
        if (e.stunned) { ctx.font = "14px 'Press Start 2P'"; ctx.fillText('💫', x + eSize - 10, y + 4); }
      }
    });
  }

  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const reducedMotion = (typeof matchMedia !== 'undefined') && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : null;
  const caf = (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : () => {};

  function render() {
    renderCanvas(now());
    Engine.renderPartyBar('combat-party-bar');
  }

  // ciclo di animazione: attivo solo durante il combattimento
  function animLoop(ts) {
    if (!battle || battle.over || !raf) return;
    if ($('screen-combat').classList.contains('active')) renderCanvas(ts);
    battle._raf = raf(animLoop);
  }

  // numeri di danno/cura fluttuanti sopra il canvas
  function floatText(cx, cy, text, cls = '') {
    const canvas = $('combat-canvas');
    const wrap = canvas.parentElement;
    const scale = canvas.clientWidth / canvas.width;
    const span = document.createElement('span');
    span.className = 'dmg-float ' + cls;
    span.textContent = text;
    span.style.left = Math.round(cx * scale) + 'px';
    span.style.top = Math.round(cy * scale) + 'px';
    wrap.appendChild(span);
    setTimeout(() => span.remove(), 1100);
  }

  /* ---------- gestione turni ---------- */

  function heroesAlive() { return G.party.some(h => !h.down && !h.preso && !h.morto); }
  function enemiesAlive() { return battle.enemies.some(e => !e.dead); }

  function nextTurn() {
    if (battle.over) return;
    if (!enemiesAlive()) return victory();
    if (!heroesAlive()) return defeat();

    battle.turnPtr++;
    if (battle.turnPtr >= battle.turnQueue.length) {
      battle.turnPtr = 0;
      battle.round++;
      if (battle.tauntRounds > 0) { battle.tauntRounds--; if (battle.tauntRounds === 0) battle.tauntHeroIdx = null; }
      if (battle.smokeRounds > 0) battle.smokeRounds--;
      log(`— Round ${battle.round} —`, 'log-turn');
    }

    const c = battle.turnQueue[battle.turnPtr];
    if (c.type === 'hero') {
      const h = G.party[c.idx];
      if (h.down || h.preso || h.morto) return nextTurn();
      h.defending = false;
      if (h.rageRounds > 0) { h.rageRounds--; if (h.rageRounds === 0) log(`${h.name} si calma. La FURIA sfuma.`, 'log-info'); }
      heroTurn(c.idx);
    } else {
      const e = battle.enemies[c.idx];
      if (e.dead) return nextTurn();
      if (e.stunned) {
        e.stunned = false;
        log(`💫 ${e.name} è stordito e salta il turno!`, 'log-info');
        render();
        return setTimeout(nextTurn, 900);
      }
      setTimeout(() => enemyTurn(c.idx), 700);
    }
  }

  /* ---------- turno dell'eroe ---------- */

  function heroTurn(hIdx) {
    const h = G.party[hIdx];
    render();
    Engine.renderPartyBar('combat-party-bar', hIdx);
    const box = $('combat-actions');
    box.innerHTML = `<div class="action-title">▶ Turno di ${h.name}${h.player ? ' (' + h.player + ')' : ''}</div>`;

    const mkBtn = (html, fn, disabled = false) => {
      const b = document.createElement('button');
      b.className = 'action-btn';
      b.innerHTML = html;
      b.disabled = disabled;
      b.onclick = fn;
      box.appendChild(b);
      return b;
    };

    // attacco
    mkBtn(`⚔ ${h.attack.name} <span class="action-sub">${h.attack.desc} — tiro per colpire</span>`,
      () => pickTarget(t => heroAttack(hIdx, t)));

    // abilità
    for (const ab of h.abilities) {
      const left = G.uses[h.id][ab.id];
      mkBtn(`✨ ${ab.name} (${left}) <span class="action-sub">${ab.desc}</span>`,
        () => useAbility(hIdx, ab), left <= 0);
    }

    // pozioni (un bottone per ogni tipo di pozione posseduta)
    const potions = G.inventory.filter(it => ITEMS[it].usable);
    for (const type of [...new Set(potions)]) {
      const count = potions.filter(p => p === type).length;
      mkBtn(`🧪 ${ITEMS[type].name} (x${count}) <span class="action-sub">${ITEMS[type].desc} Scegli chi la beve.</span>`,
        () => pickAlly(a => usePotion(hIdx, a, type), true));
    }

    // oggetti da lancio
    const throwables = G.inventory.filter(it => ITEMS[it].combat);
    for (const type of [...new Set(throwables)]) {
      const count = throwables.filter(p => p === type).length;
      mkBtn(`${ITEMS[type].icon || '🎯'} ${ITEMS[type].name} (x${count}) <span class="action-sub">${ITEMS[type].desc}</span>`,
        () => ITEMS[type].combat.calm ? useThrowable(hIdx, 0, type) : pickTarget(t => useThrowable(hIdx, t, type)));
    }

    // difesa
    mkBtn(`🛡 Difesa totale <span class="action-sub">+3 alla tua CA fino al prossimo turno</span>`, () => {
      h.defending = true;
      log(`🛡 ${h.name} si mette in guardia (+3 CA).`, 'log-info');
      endHeroAction();
    });
  }

  function pickTarget(fn, noBack = false) {
    const box = $('combat-actions');
    box.innerHTML = `<div class="action-title">Scegli il bersaglio:</div>`;
    battle.enemies.forEach((e, i) => {
      if (e.dead) return;
      const b = document.createElement('button');
      b.className = 'action-btn target-btn';
      b.innerHTML = `🎯 ${e.name} <span class="action-sub">PV ${e.hp}/${e.maxHp} · CA ${e.ac}${e.undead ? ' · non-morto' : ''}</span>`;
      b.onclick = () => fn(i);
      box.appendChild(b);
    });
    if (noBack) return;
    const back = document.createElement('button');
    back.className = 'action-btn';
    back.innerHTML = '↩ Indietro';
    back.onclick = () => heroTurn(currentHeroIdx());
    box.appendChild(back);
  }

  function pickAlly(fn, includeDown = false) {
    const box = $('combat-actions');
    box.innerHTML = `<div class="action-title">Scegli il compagno:</div>`;
    G.party.forEach((h, i) => {
      if (h.morto) return; // gli SPIRITI non bevono e non si medicano: serve un Cuore di Colore
      if (h.down && !includeDown) return;
      const b = document.createElement('button');
      b.className = 'action-btn target-btn';
      b.innerHTML = `${h.down ? '💀' : '❤'} ${h.name} <span class="action-sub">PV ${h.hp}/${h.maxHp}${h.down ? ' — A TERRA: rialzalo!' : ''}</span>`;
      b.onclick = () => fn(i);
      box.appendChild(b);
    });
    const back = document.createElement('button');
    back.className = 'action-btn';
    back.innerHTML = '↩ Indietro';
    back.onclick = () => heroTurn(currentHeroIdx());
    box.appendChild(back);
  }

  function currentHeroIdx() {
    const c = battle.turnQueue[battle.turnPtr];
    return c.idx;
  }

  function firstRoundAdvantage() {
    return battle.round === 1 && battle.isBoss && G.flags.sorpresa;
  }

  function heroAttack(hIdx, tIdx, opts = {}) {
    const h = G.party[hIdx];
    const e = battle.enemies[tIdx];
    // le abilità usano la LORO statistica (es. Sacra Folgore -> SAG), altrimenti quella dell'arma
    const stat = opts.stat || h.attack.stat;
    let mod = heroMod(h, stat) + 2;
    if (battle.isBoss && ((G.flags.daniele_sabota && !G.flags.daniele_in_squadra) || G.flags.manuale_annotato_letto)) mod += 1;
    if (opts.modOverride != null) mod = opts.modOverride;
    Dice.showRoll({
      title: `${h.name}: ${opts.label || h.attack.name}<br>contro ${e.name} (CA ${e.ac})`,
      mod, dc: e.ac,
      advantage: opts.advantage || firstRoundAdvantage(),
      onDone: res => {
        // Fortuna Sfacciata di Fizzle
        if (res.fumble && h.id === 'natalino' && !h.luckUsed) {
          h.luckUsed = true;
          log(`✂️ <b>Mani di Fata!</b> Il polso di Natalino non sbaglia due volte: ritira il dado!`, 'log-crit');
          return heroAttack(hIdx, tIdx, opts);
        }
        // la lattina portafortuna: Daniele ritira il primo 1 di ogni scontro se ha bevuto la Zero
        if (res.fumble && h.id === 'daniele' && G.flags.zero_bevuta && !h.luckUsed) {
          h.luckUsed = true;
          log(`🥤 La caffeina della Zero entra in circolo al momento GIUSTO: Daniele ritira il dado! "Statisticamente irrilevante. Praticamente decisivo."`, 'log-crit');
          return heroAttack(hIdx, tIdx, opts);
        }
        if (res.success) {
          const dice = opts.dice || h.attack.dice;
          let dmgRoll = Dice.rollDice(dice[0], dice[1]);
          // abilità: solo il modificatore della loro statistica; arma base: stat + bonus arma
          const baseBonus = opts.stat ? heroMod(h, opts.stat) : heroMod(h, h.attack.stat) + (h.attack.bonus || 0);
          let dmg = dmgRoll.total + (opts.dmgBonus != null ? opts.dmgBonus : baseBonus);
          if (res.crit) { const extra = Dice.rollDice(dice[0], dice[1]); dmg += extra.total; }
          if (h.rageRounds > 0) dmg += 3;
          if (opts.holy && e.undead) dmg *= 2;
          e.hp -= dmg;
          const verbi = ['colpisce', 'centra in pieno', 'travolge', 'raggiunge', 'sorprende', 'castiga'];
          const verbo = res.crit ? 'DEVASTA' : verbi[Math.floor(Math.random() * verbi.length)];
          log(`${res.crit ? '💥 <b>CRITICO!</b> ' : ''}⚔ ${h.name} ${verbo} ${e.name}: <b>${dmg} danni</b>${opts.holy && e.undead ? ' (DOPPI sul non-morto!)' : ''}.`, res.crit ? 'log-crit' : 'log-hit');
          if (typeof Sound !== 'undefined') Sound.play('hit');
          floatText(e._x + e._size / 2, e._y, `-${dmg}`, res.crit ? 'float-crit' : 'float-dmg');
          checkEnemyDeath(e);
        } else {
          log(`${h.name} manca ${e.name}. ${res.fumble ? 'Malissimo. Con stile, ma malissimo.' : ''}`, 'log-info');
          floatText(e._x + e._size / 2, e._y, 'MANCATO', 'float-miss');
        }
        render();
        if (opts.after) opts.after(res); else endHeroAction();
      },
    });
  }

  function useAbility(hIdx, ab) {
    const h = G.party[hIdx];
    const spend = () => { G.uses[h.id][ab.id]--; };

    switch (ab.type) {
      case 'taunt':
        spend();
        battle.tauntHeroIdx = hIdx; battle.tauntRounds = 2;
        log(`📣 <b>${ab.name}!</b> Tutti gli occhi (quelli che ci sono) su ${h.name}, che subisce metà danni!`, 'log-crit');
        endHeroAction();
        break;

      case 'bighit':
        pickTarget(t => { spend(); heroAttack(hIdx, t, { dice: ab.dice, label: ab.name, stat: ab.stat }); });
        break;

      case 'autohit': {
        pickTarget(t => {
          spend();
          const e = battle.enemies[t];
          const dmg = Dice.rollDice(ab.dice[0], ab.dice[1]).total + (ab.bonus || 0);
          log(`✨ <b>${ab.name}</b>: i dardi inseguono ${e.name} e colpiscono SEMPRE: <b>${dmg} danni</b>.`, 'log-hit');
          e.hp -= dmg; checkEnemyDeath(e); render(); endHeroAction();
        });
        break;
      }

      case 'aoe': {
        spend();
        log(`🔥 <b>${ab.name}!</b>`, 'log-crit');
        let killed = 0;
        for (const e of battle.enemies) {
          if (e.dead) continue;
          const dmg = Dice.rollDice(ab.dice[0], ab.dice[1]).total;
          e.hp -= dmg;
          log(`🔥 ${e.name} investito dalle fiamme: <b>${dmg} danni</b>.`, 'log-hit');
          if (checkEnemyDeath(e, true)) killed++;
        }
        render(); endHeroAction();
        break;
      }

      case 'sneak':
        pickTarget(t => { spend(); heroAttack(hIdx, t, { dice: ab.dice, label: ab.name, stat: ab.stat, advantage: true }); });
        break;

      case 'smoke':
        spend();
        battle.smokeRounds = 2;
        log(`💨 <b>${ab.name}!</b> PUFF! Il campo si riempie di fumo: i nemici attaccano con SVANTAGGIO!`, 'log-crit');
        endHeroAction();
        break;

      case 'heal':
        pickAlly(a => {
          spend();
          const ally = G.party[a];
          const amount = Dice.rollDice(ab.dice[0], ab.dice[1]).total + (ab.bonus || 0);
          const wasDown = ally.down;
          ally.down = false;
          ally.hp = Math.min(ally.maxHp, Math.max(0, ally.hp) + amount);
          log(`✨ <b>${ab.name}</b>: ${ally.name} ${wasDown ? 'SI RIALZA e ' : ''}recupera <b>${amount} PV</b>!`, 'log-heal');
          if (ally._x != null) floatText(ally._x + ally._size / 2, ally._y, `+${amount}`, 'float-heal');
          if (typeof Sound !== 'undefined') Sound.play('heal');
          render(); endHeroAction();
        }, true);
        break;

      case 'holy':
        pickTarget(t => { spend(); heroAttack(hIdx, t, { dice: ab.dice, label: ab.name, stat: ab.stat, holy: true }); });
        break;

      case 'double':
        pickTarget(t1 => {
          spend();
          heroAttack(hIdx, t1, { dice: ab.dice, label: ab.name + ' (1º colpo)', stat: ab.stat, after: () => {
            if (!enemiesAlive()) return victory();
            pickTarget(t2 => heroAttack(hIdx, t2, { dice: ab.dice, label: ab.name + ' (2º colpo)', stat: ab.stat }), true);
          }});
        });
        break;

      case 'pet':
        pickTarget(t => {
          spend();
          const e = battle.enemies[t];
          const dmg = Dice.rollDice(ab.dice[0], ab.dice[1]).total + (ab.bonus || 0);
          e.hp -= dmg; e.distracted = true;
          log(`💡 <b>${ab.name}!</b> ${e.name} subisce <b>${dmg} danni</b> ed è accecato (svantaggio al prossimo attacco). Nella casa grigia, la luce vera FA MALE.`, 'log-crit');
          checkEnemyDeath(e); render(); endHeroAction();
        });
        break;

      case 'rage':
        spend();
        G.party[hIdx].rageRounds = 4; // conta anche il turno corrente
        log(`💢 <b>${ab.name}!</b> (+3 danni, -2 danni subiti per 3 turni.) Le cose fanno un passo indietro. Sagge.`, 'log-crit');
        endHeroAction();
        break;

      case 'stun':
        pickTarget(t => {
          spend();
          heroAttack(hIdx, t, { dice: ab.dice, label: ab.name, stat: ab.stat, after: res => {
            if (res.success) {
              const e = battle.enemies[t];
              if (!e.dead) { e.stunned = true; log(`💫 ${e.name} è STORDITO: salterà il prossimo turno!`, 'log-crit'); }
            }
            render(); endHeroAction();
          }});
        });
        break;

      default:
        endHeroAction();
    }
  }

  function useThrowable(hIdx, tIdx, itemId) {
    const item = ITEMS[itemId];
    const i = G.inventory.indexOf(itemId);
    if (i >= 0) G.inventory.splice(i, 1);
    if (item.combat.calm) {
      // la playlist dell'estate: la musica VIVA ferma le cose grigie
      let stunned = 0;
      for (const e of battle.enemies) {
        if (e.dead) continue;
        if (e.boss) { e.distracted = true; }
        else { e.stunned = true; stunned++; }
      }
      battle.smokeRounds = Math.max(battle.smokeRounds, 1);
      log(`🔊 ${G.party[hIdx].name} preme PLAY a tutto volume: la playlist dell'estate riempie la stanza di roba VIVA. ${stunned ? `<b>${stunned} cose si FERMANO ad ascoltare</b>` : 'Le cose esitano'}${battle.enemies.some(e => e.boss && !e.dead) ? ' — e perfino la cosa grande, per un attimo, ricorda com\'era avere un\'estate' : ''}. Poi la batteria muore.`, 'log-crit');
      if (typeof Sound !== 'undefined') Sound.play('heal');
      render(); endHeroAction();
      return;
    }
    if (item.combat.all) {
      // colpisce TUTTI i nemici vivi
      log(`${item.icon || '🎯'} ${G.party[hIdx].name} lancia ${item.name}: la stanza DIVAMPA!`, 'log-crit');
      for (const en of battle.enemies) {
        if (en.dead) continue;
        let d = Dice.rollDice(item.combat.dice[0], item.combat.dice[1]).total;
        if (item.combat.holy && en.undead) d *= 2;
        en.hp -= d;
        if (item.combat.distract && en.hp > 0) en.distracted = true;
        log(`🔥 ${en.name}: <b>${d} danni</b>${item.combat.distract && en.hp > 0 ? ' (accecato)' : ''}.`, 'log-hit');
        if (en._x != null) floatText(en._x + en._size / 2, en._y, `-${d}`, 'float-dmg');
        checkEnemyDeath(en);
      }
      if (typeof Sound !== 'undefined') Sound.play('hit');
      render(); endHeroAction();
      return;
    }
    const e = battle.enemies[tIdx];
    let dmg = Dice.rollDice(item.combat.dice[0], item.combat.dice[1]).total;
    const doubled = item.combat.holy && e.undead;
    if (doubled) dmg *= 2;
    e.hp -= dmg;
    let extra = '';
    if (item.combat.distract && !e.dead) { e.distracted = true; extra = item.combat.distractText || ' Il tanfo lo stordisce: svantaggio al prossimo attacco!'; }
    log(`${item.icon || '🎯'} ${G.party[hIdx].name} lancia ${item.name} su ${e.name}: <b>${dmg} danni</b>${doubled ? ' (DOPPI sul non-morto!)' : ''}.${extra}`, 'log-hit');
    if (e._x != null) floatText(e._x + e._size / 2, e._y, `-${dmg}`, 'float-dmg');
    if (typeof Sound !== 'undefined') Sound.play('hit');
    checkEnemyDeath(e); render(); endHeroAction();
  }

  function usePotion(hIdx, allyIdx, itemId) {
    const ally = G.party[allyIdx];
    const item = ITEMS[itemId];
    const i = G.inventory.indexOf(itemId);
    if (i >= 0) G.inventory.splice(i, 1);
    if (item.recharge) {
      // il caffè della moka di Daniele: abilità di nuovo cariche, anche in piena battaglia
      for (const ab of ally.abilities) G.uses[ally.id][ab.id] = ab.uses;
      log(`☕ ${G.party[hIdx].name} passa il caffè a ${ally.name}: TUTTE le abilità ricaricate. Nero, bollente, VIVO.`, 'log-heal');
      if (typeof Sound !== 'undefined') Sound.play('heal');
      render(); endHeroAction();
      return;
    }
    const wasDown = ally.down;
    ally.down = false;
    ally.hp = Math.min(ally.maxHp, Math.max(0, ally.hp) + item.heal);
    log(`🧪 ${G.party[hIdx].name} usa ${item.name} su ${ally.name}: ${wasDown ? 'SI RIALZA e ' : ''}recupera <b>${item.heal} PV</b>!`, 'log-heal');
    if (ally._x != null) floatText(ally._x + ally._size / 2, ally._y, `+${item.heal}`, 'float-heal');
    if (typeof Sound !== 'undefined') Sound.play('heal');
    render(); endHeroAction();
  }

  function checkEnemyDeath(e, silentRender = false) {
    if (!e.dead && e.hp <= 0) {
      e.hp = 0; e.dead = true;
      log(`☠ <b>${e.name} è sconfitto!</b>`, 'log-crit');
      return true;
    }
    return false;
  }

  function endHeroAction() {
    $('combat-actions').innerHTML = '<div class="action-title">…</div>';
    render();
    Engine.saveGame();
    setTimeout(nextTurn, 500);
  }

  /* ---------- turno del nemico ---------- */

  function pickHeroTarget(e) {
    if (battle.tauntHeroIdx != null && !G.party[battle.tauntHeroIdx].down && !G.party[battle.tauntHeroIdx].morto) return battle.tauntHeroIdx;
    const alive = G.party.map((h, i) => ({ h, i })).filter(x => !x.h.down && !x.h.preso && !x.h.morto);
    if (!alive.length) return -1;
    if (e.ai === 'weakest') { alive.sort((a, b) => a.h.hp - b.h.hp); return alive[0].i; }
    if (e.ai === 'strongest') { alive.sort((a, b) => b.h.hp - a.h.hp); return alive[0].i; }
    if (e.ai === 'smart') {
      // il boss punta il guaritore, poi il più debole
      const healer = alive.find(x => x.h.id === 'emanuela');
      if (healer && Math.random() < 0.5) return healer.i;
      alive.sort((a, b) => a.h.hp - b.h.hp);
      return alive[0].i;
    }
    return alive[Math.floor(Math.random() * alive.length)].i;
  }

  function enemyTurn(eIdx) {
    const e = battle.enemies[eIdx];
    const tIdx = pickHeroTarget(e);
    if (tIdx < 0) return defeat();
    const h = G.party[tIdx];

    let atkBonus = e.attack.bonus;
    if (G.inventory.includes('ombrellone_gaeta')) atkBonus -= 1; // l'ombrellone di Gaeta: il ricordo del sole fa esitare il Grigiore
    if (battle.isBoss && G.flags.eleinad_vacilla && battle.round <= 2) atkBonus -= 1;

    let die = Dice.roll(20);
    const disadv = battle.smokeRounds > 0 || e.distracted;
    if (disadv) { const d2 = Dice.roll(20); die = Math.min(die, d2); }
    e.distracted = false;

    let ca = h.ac + (h.defending ? 3 : 0);
    const total = die + atkBonus;
    const crit = die === 20, fumble = die === 1;

    if (!fumble && (crit || total >= ca)) {
      let dmg = Dice.rollDice(e.attack.dice[0], e.attack.dice[1]).total + e.attack.plus;
      if (crit) dmg += Dice.rollDice(e.attack.dice[0], e.attack.dice[1]).total;
      // riduzioni
      if (h.rageRounds > 0) dmg = Math.max(1, dmg - 2);
      if (battle.tauntHeroIdx === tIdx) dmg = Math.max(1, Math.floor(dmg / 2));
      h.hp -= dmg;
      log(`${crit ? '💥 <b>CRITICO!</b> ' : ''}🗡 ${e.name} colpisce ${h.name} con ${e.attack.name}: <b>${dmg} danni</b>.`, crit ? 'log-crit' : 'log-hit');
      if (typeof Sound !== 'undefined') Sound.play('hit');
      if (h._x != null) floatText(h._x + h._size / 2, h._y, `-${dmg}`, 'float-dmg');
      // il vampiro si nutre dei colpi che mette a segno
      if (e.lifesteal && e.hp > 0 && e.hp < e.maxHp) {
        const drain = Math.min(Math.ceil(dmg / 2), e.maxHp - e.hp);
        if (drain > 0) {
          e.hp += drain;
          log(`🩶 ${e.name.split(',')[0]} BEVE il colore del colpo e recupera <b>${drain} PV</b>. È così che si nutre. Di voi.`, 'log-hit');
          if (e._x != null) floatText(e._x + e._size / 2, e._y, `+${drain}`, 'float-heal');
        }
      }
      if (h.hp <= 0) {
        // passiva Zonk
        if (false) {
        } else {
          h.hp = 0; h.down = true;
          log(`💀 <b>${h.name} cade a terra!</b> Serve una cura o una pozione per rialzarlo!`, 'log-hit');
        }
      }
    } else {
      log(`🗡 ${e.name} attacca ${h.name}${h.defending ? ' (in difesa)' : ''}... e MANCA${fumble ? ' clamorosamente' : ''}!${disadv ? ' (svantaggio)' : ''}`, 'log-info');
    }

    render();
    setTimeout(nextTurn, 850);
  }

  /* ---------- esiti ---------- */

  function victory() {
    if (battle.over) return;
    battle.over = true;
    if (battle._raf) caf(battle._raf);
    const banner = $('combat-banner');
    banner.textContent = '🏆 VITTORIA! 🏆';
    banner.classList.add('victory');
    banner.classList.remove('hidden');
    if (typeof Sound !== 'undefined') Sound.play('victory');
    $('combat-actions').innerHTML = '';

    G.stats.combats++;
    if (battle.isBoss && G.flags.sorpresa) G.flags.sorpresa = false; // l'effetto sorpresa si consuma
    // gli eroi a terra si rialzano con 1 PV (gli SPIRITI no: serve un Cuore di Colore)
    for (const h of G.party) if (h.down && !h.morto) { h.down = false; h.hp = 1; }

    const loot = battle.def.loot || {};
    if (loot.gold) { G.gold += loot.gold; log(`🎨 La paura passa, il COLORE torna: <b>+${loot.gold} Colore</b>!`, 'log-heal'); }
    if (loot.items) for (const it of loot.items) { G.inventory.push(it); log(`🎁 Trovato: <b>${ITEMS[it].name}</b>!`, 'log-heal'); }

    const next = battle.def.victory;
    setTimeout(() => {
      banner.classList.add('hidden');
      Engine.gotoScene(next);
    }, 1800);
  }

  function defeat() {
    if (battle.over) return;
    battle.over = true;
    if (battle._raf) caf(battle._raf);
    const banner = $('combat-banner');
    banner.textContent = '💀 SCONFITTA... 💀';
    banner.classList.remove('hidden', 'victory');
    if (typeof Sound !== 'undefined') Sound.play('defeat');
    $('combat-actions').innerHTML = '';
    const next = battle.def.defeat;
    setTimeout(() => {
      banner.classList.add('hidden');
      Engine.gotoScene(next);
    }, 2000);
  }

  return { start };
})();
