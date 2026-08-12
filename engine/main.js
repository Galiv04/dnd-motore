/* ============ MAIN — titolo, setup della compagnia, wiring ============ */

const Main = (() => {

  const $ = id => document.getElementById(id);
  let selection = {}; // heroId -> { selected: bool, player: '' }
  let pendingSlot = null; // slot scelto per la nuova partita
  let pendingDifficulty = 'normale';

  /* Selettore degli slot di salvataggio (mode: 'load' | 'new').
     Viene mostrato SEMPRE: prima restava nascosto quando c'era un solo
     salvataggio o uno slot libero, e i tre slot non si vedevano mai. */
  function pickSlot(mode) {
    const saves = Engine.listSaves();
    const box = $('modal-generic-content');
    const fmtAge = ts => {
      if (!ts) return '';
      const m = Math.round((Date.now() - ts) / 60000);
      return m < 60 ? `${m} min fa` : m < 1440 ? `${Math.round(m / 60)} ore fa` : `${Math.round(m / 1440)} giorni fa`;
    };
    box.innerHTML = `<h2>${mode === 'load' ? '📂 Quale partita riprendete?' : '💾 In quale slot salvate la nuova partita?'}</h2>
      <p style="color:var(--text-dim);margin-bottom:12px">Utente: <b>${Engine.currentProfile()}</b> — ogni utente ha 3 slot indipendenti, uno per ogni partita in corso.</p>`;
    saves.forEach((s, i) => {
      const n = i + 1;
      const b = document.createElement('button');
      b.className = 'choice-btn';
      if (s) {
        b.innerHTML = `<b>Slot ${n}</b> — ${s.heroes}${s.players ? ' (' + s.players + ')' : ''} ${s.ended ? '· 🏆 COMPLETATA' : ''}
          <span class="choice-tag">📍 ${s.caption} · 🎨 ${s.gold} · 🕐 ${fmtAge(s.savedAt)}</span>`;
        b.onclick = () => {
          if (mode === 'load') {
            $('modal-generic').classList.add('hidden');
            if (!Engine.loadGame(n)) alert('Salvataggio danneggiato.');
          } else {
            if (!confirm(`Lo Slot ${n} contiene già una partita (${s.heroes}).\nSovrascriverla? La partita salvata andrà persa.`)) return;
            $('modal-generic').classList.add('hidden');
            Engine.clearSave(n); pendingSlot = n; openSetup();
          }
        };
      } else {
        b.innerHTML = `<b>Slot ${n}</b> — <span class="choice-tag">vuoto${mode === 'new' ? ' — libero per una nuova avventura' : ''}</span>`;
        if (mode === 'load') b.disabled = true;
        else b.onclick = () => { $('modal-generic').classList.add('hidden'); pendingSlot = n; openSetup(); };
      }
      box.appendChild(b);
    });
    const trasferisci = document.createElement('button');
    trasferisci.className = 'choice-btn';
    trasferisci.style.borderLeftColor = 'var(--green)';
    trasferisci.innerHTML = `📤 <b>Trasferisci una partita da/verso un altro dispositivo</b>
      <span class="choice-tag">Genera un codice da incollare su un altro browser o computer: la partita riprende esattamente da dov'era.</span>`;
    trasferisci.onclick = () => showCodes(Engine.currentProfile());
    box.appendChild(trasferisci);
    const nota = document.createElement('p');
    nota.style.cssText = 'color:var(--text-dim);font-size:18px;margin-top:10px';
    nota.innerHTML = '👤 Per creare o cambiare utente, usate il pulsante <b>Utenti</b> nel titolo.';
    box.appendChild(nota);
    const close = document.createElement('button');
    close.className = 'btn';
    close.style.marginTop = '12px';
    close.textContent = '↩ Indietro';
    close.onclick = () => $('modal-generic').classList.add('hidden');
    box.appendChild(close);
    $('modal-generic').classList.remove('hidden');
  }

  function refreshTitle() {
    $('btn-continue').style.display = Engine.hasSave() ? '' : 'none';
    $('btn-revive').style.display = Engine.reviveUnlocked() ? '' : 'none';
    $('btn-profile').textContent = '👤 ' + Engine.currentProfile();
    Sound.music('title');
  }

  /* ---------- gestione utenti e codici di salvataggio ---------- */

  function showProfiles() {
    const box = $('modal-generic-content');
    const current = Engine.currentProfile();
    let html = `<h2>👤 Utenti di questo dispositivo</h2>
      <p style="color:var(--text-dim);margin-bottom:12px">Ogni utente ha i suoi 3 slot di salvataggio. I salvataggi restano su QUESTO browser: per portarli altrove usate i <b>codici di salvataggio</b> qui sotto.</p>`;
    for (const p of Engine.listProfiles()) {
      const saves = Engine.listSaves(p).filter(Boolean);
      html += `<div class="ability-box" style="border-left-color:${p === current ? 'var(--gold)' : 'var(--border)'}">
        <span class="ability-name">${p === current ? '⭐ ' : ''}${p}</span>
        <div class="ability-desc">${saves.length ? saves.map(s => `Slot ${s.slot}: ${s.heroes} — ${s.caption}`).join('<br>') : 'Nessuna partita salvata.'}</div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          ${p !== current ? `<button class="btn btn-small btn-gold" onclick="Main.useProfile('${p.replace(/'/g, "\\'")}')">✔ Usa</button>` : ''}
          <button class="btn btn-small" onclick="Main.renameProfileUI('${p.replace(/'/g, "\\'")}')">✏ Rinomina</button>
          <button class="btn btn-small" onclick="Main.showCodes('${p.replace(/'/g, "\\'")}')">📤 Codici</button>
          ${Engine.listProfiles().length > 1 ? `<button class="btn btn-small btn-danger" onclick="Main.deleteProfileUI('${p.replace(/'/g, "\\'")}')">🗑</button>` : ''}
        </div>
      </div>`;
    }
    html += `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <input class="player-name-input" id="new-profile-name" placeholder="Nome nuovo utente..." maxlength="20" style="flex:1;min-width:180px;margin:0">
        <button class="btn btn-small btn-gold" id="btn-add-profile">➕ Crea utente</button>
      </div>
      <button class="btn" style="margin-top:12px" onclick="document.getElementById('modal-generic').classList.add('hidden')">✔ Chiudi</button>`;
    box.innerHTML = html;
    $('btn-add-profile').onclick = () => {
      const name = $('new-profile-name').value.trim();
      if (!name) return;
      Engine.setCurrentProfile(name);
      refreshTitle();
      showProfiles();
    };
    $('modal-generic').classList.remove('hidden');
  }

  function useProfile(p) { Engine.setCurrentProfile(p); refreshTitle(); showProfiles(); }

  function renameProfileUI(p) {
    const nuovo = prompt(`Nuovo nome per "${p}":`, p);
    if (nuovo && nuovo.trim() && nuovo.trim() !== p) {
      if (!Engine.renameProfile(p, nuovo.trim())) alert('Nome già in uso.');
      refreshTitle();
    }
    showProfiles();
  }

  function deleteProfileUI(p) {
    if (confirm(`Eliminare l'utente "${p}" e TUTTI i suoi salvataggi? Non si torna indietro.`)) {
      Engine.deleteProfile(p);
      refreshTitle();
    }
    showProfiles();
  }

  function showCodes(p) {
    const box = $('modal-generic-content');
    const saves = Engine.listSaves(p);
    let html = `<h2>📤 Codici di salvataggio — ${p}</h2>
      <p style="color:var(--text-dim);margin-bottom:10px">Copiate un codice e incollatelo su un altro browser o computer (stesso sito → 👤 → 📥 Importa) per trasferire la partita.</p>`;
    saves.forEach((s, i) => {
      const n = i + 1;
      if (!s) { html += `<div class="ability-box"><span class="ability-name">Slot ${n}</span><div class="ability-desc">vuoto</div></div>`; return; }
      const code = Engine.exportCode(n, p) || '';
      html += `<div class="ability-box"><span class="ability-name">Slot ${n} — ${s.heroes}</span>
        <div class="ability-desc">${s.caption}</div>
        <textarea readonly onclick="this.select()" style="width:100%;height:64px;margin-top:6px;background:#111;color:var(--green);border:2px solid var(--border);font-size:12px;font-family:monospace">${code}</textarea>
        <button class="btn btn-small" style="margin-top:4px" onclick="navigator.clipboard && navigator.clipboard.writeText(this.previousElementSibling.value).then(()=>this.textContent='✔ Copiato!')">📋 Copia</button>
      </div>`;
    });
    html += `<h3 style="font-family:var(--font-pixel);font-size:13px;color:var(--blue);margin:14px 0 6px">📥 Importa un codice</h3>
      <textarea id="import-code" placeholder="Incollate qui il codice..." style="width:100%;height:64px;background:#111;color:var(--text);border:2px solid var(--border);font-size:12px;font-family:monospace"></textarea>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap">
        <span style="color:var(--text-dim)">nello slot:</span>
        ${[1, 2, 3].map(n => `<button class="btn btn-small" onclick="Main.doImport('${p.replace(/'/g, "\\'")}', ${n})">Slot ${n}</button>`).join('')}
        <span id="import-result" style="color:var(--green)"></span>
      </div>
      <button class="btn" style="margin-top:12px" onclick="Main.showProfiles()">↩ Utenti</button>`;
    box.innerHTML = html;
    $('modal-generic').classList.remove('hidden');
  }

  function doImport(p, slot) {
    const code = $('import-code').value;
    if (!code.trim()) return;
    const err = Engine.importCode(code, slot, p);
    $('import-result').textContent = err ? '❌ ' + err : `✔ Importato nello Slot ${slot}!`;
    $('import-result').style.color = err ? 'var(--red)' : 'var(--green)';
    if (!err) { refreshTitle(); setTimeout(() => showCodes(p), 900); }
  }

  function init() {
    // scena del titolo
    Scenes.paint('title-canvas', 'titolo');
    refreshTitle();

    // entrambi mostrano sempre i 3 slot: così si vede dove si salva e cosa c'è
    $('btn-new-game').onclick = () => pickSlot('new');
    $('btn-continue').onclick = () => pickSlot('load');
    $('btn-story').onclick = () => {
      $('story-content').innerHTML = RULES_STORY;
      Engine.showScreen('screen-story');
    };
    $('btn-story-back').onclick = () => Engine.showScreen('screen-title');
    $('btn-howto').onclick = () => {
      $('howto-content').innerHTML = RULES_HOWTO;
      Engine.showScreen('screen-howto');
    };
    $('btn-howto-back').onclick = () => Engine.showScreen('screen-title');
    $('btn-setup-back').onclick = () => Engine.showScreen('screen-title');
    $('btn-start-adventure').onclick = startAdventure;
    $('btn-revive').onclick = () => Engine.showRevive();
    $('btn-diff-normale').onclick = () => setDifficulty('normale');
    $('btn-diff-facile').onclick = () => setDifficulty('facile');
    $('btn-diff-incubo').onclick = () => setDifficulty('incubo');
    $('btn-profile').onclick = showProfiles;

    // header di gioco
    $('btn-map').onclick = Engine.showMap;
    $('btn-party').onclick = Engine.showParty;
    $('btn-inventory').onclick = Engine.showInventory;
    $('btn-rules').onclick = Engine.showRules;
    const syncAudioUI = () => {
      $('btn-sound').textContent = Sound.isMuted() ? '🔇' : '🔊';
      $('btn-music').style.opacity = Sound.isMusicMuted() ? '.5' : '1';
      $('btn-sound-title').textContent = Sound.isMuted() ? '🔇 Effetti' : '🔊 Effetti';
      $('btn-sound-title').style.opacity = Sound.isMuted() ? '.55' : '1';
      $('btn-music-title').style.opacity = Sound.isMusicMuted() ? '.55' : '1';
    };
    $('btn-sound').onclick = () => { Sound.toggleMute(); syncAudioUI(); };
    $('btn-music').onclick = () => { Sound.toggleMusicMute(); syncAudioUI(); };
    $('btn-sound-title').onclick = () => { Sound.toggleMute(); syncAudioUI(); };
    $('btn-music-title').onclick = () => { Sound.toggleMusicMute(); syncAudioUI(); };
    syncAudioUI();
    // testo grande (persistente)
    try { if (localStorage.getItem('casa-textsize') === 'large') document.documentElement.classList.add('text-large'); } catch (e) {}
    $('btn-textsize').onclick = () => {
      const large = document.documentElement.classList.toggle('text-large');
      try { localStorage.setItem('casa-textsize', large ? 'large' : 'normal'); } catch (e) {}
    };
    $('btn-fullscreen').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    };

    // scorciatoie da tastiera: 1-9 scelte/azioni, Invio = continua (dado), Esc = chiudi modale
    document.addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        $('modal-generic').classList.add('hidden');
        $('modal-char').classList.add('hidden');
        return;
      }
      const diceBtn = $('btn-dice-continue');
      if ((e.key === 'Enter' || e.key === ' ') && !$('dice-overlay').classList.contains('hidden') && !diceBtn.classList.contains('hidden')) {
        e.preventDefault();
        diceBtn.click();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        // priorità: modale aperta > azioni di combattimento > scelte di scena
        const pools = [
          '#modal-generic:not(.hidden) .choice-btn',
          '#screen-combat.active #combat-actions .action-btn',
          '#screen-game.active #choices .choice-btn',
        ];
        for (const sel of pools) {
          const btns = [...document.querySelectorAll(sel)].filter(b => !b.disabled);
          if (btns.length) { if (btns[n - 1]) btns[n - 1].click(); return; }
        }
      }
    });
    $('btn-menu').onclick = Engine.showMenu;

    // chiusura modali cliccando fuori
    for (const mid of ['modal-generic', 'modal-char']) {
      $(mid).addEventListener('click', e => { if (e.target === $(mid)) $(mid).classList.add('hidden'); });
    }
  }

  function setDifficulty(d) {
    pendingDifficulty = d;
    $('btn-diff-normale').classList.toggle('btn-gold', d === 'normale');
    $('btn-diff-facile').classList.toggle('btn-gold', d === 'facile');
    $('btn-diff-incubo').classList.toggle('btn-gold', d === 'incubo');
  }

  /* ---------- setup della compagnia ---------- */

  /* Gli eroi selezionabili al setup: quelli bloccati (Daniele) si sbloccano GIOCANDO. */
  function selectableHeroes() { return HEROES.filter(h => !h.locked); }

  function openSetup() {
    selection = {};
    for (const h of selectableHeroes()) selection[h.id] = { selected: false, player: '' };
    renderSetup();
    Engine.showScreen('screen-setup');
  }

  function renderSetup() {
    const grid = $('char-grid');
    grid.innerHTML = '';

    // gli eroi bloccati (Daniele) si VEDONO ma non si scelgono: la scheda resta leggibile
    for (const h of HEROES.filter(x => x.locked)) {
      const card = document.createElement('div');
      card.className = 'char-card locked';
      card.innerHTML = `
        <div class="char-card-top">
          <canvas width="72" height="72"></canvas>
          <div>
            <div class="char-name">${h.name} 🔒</div>
            <div class="char-class">${h.class}</div>
          </div>
        </div>
        <div class="char-tag">"${h.tagline}"</div>
        <div class="char-card-btns">
          <button class="btn btn-small" data-act="story">📜 Storia</button>
          <button class="btn btn-small" disabled title="Si sblocca giocando">🔒 Si sblocca giocando</button>
        </div>`;
      const cv = card.querySelector('canvas');
      Sprites.renderToCanvas(cv, Sprites.registry[h.sprite]);
      card.querySelector('[data-act="story"]').onclick = e => { e.stopPropagation(); showCharDetail(h); };
      grid.appendChild(card);
    }

    for (const h of selectableHeroes()) {
      const card = document.createElement('div');
      card.className = 'char-card' + (selection[h.id].selected ? ' selected' : '');
      card.innerHTML = `
        <div class="char-card-top">
          <canvas width="72" height="72"></canvas>
          <div>
            <div class="char-name">${h.name}</div>
            <div class="char-class">${h.class}</div>
          </div>
        </div>
        <div class="char-tag">"${h.tagline}"</div>
        <div class="char-card-btns">
          <button class="btn btn-small" data-act="story">📜 Storia</button>
          <button class="btn btn-small ${selection[h.id].selected ? 'btn-danger' : 'btn-gold'}" data-act="toggle">
            ${selection[h.id].selected ? '✖ Rimuovi' : '✔ Scegli'}
          </button>
        </div>
        ${selection[h.id].selected ? `<input class="player-name-input" placeholder="Nome del giocatore (facoltativo)" value="${selection[h.id].player.replace(/"/g, '&quot;')}" maxlength="18">` : ''}
      `;
      const cv = card.querySelector('canvas');
      Sprites.renderToCanvas(cv, Sprites.registry[h.sprite]);

      card.querySelector('[data-act="story"]').onclick = e => { e.stopPropagation(); showCharDetail(h); };
      card.querySelector('[data-act="toggle"]').onclick = e => {
        e.stopPropagation();
        const count = Object.values(selection).filter(s => s.selected).length;
        if (!selection[h.id].selected && count >= 6) return;
        selection[h.id].selected = !selection[h.id].selected;
        renderSetup();
      };
      const input = card.querySelector('.player-name-input');
      if (input) {
        input.onclick = e => e.stopPropagation();
        input.oninput = () => { selection[h.id].player = input.value; };
      }
      grid.appendChild(card);
    }
    updateSetupBar();
  }

  function updateSetupBar() {
    const count = Object.values(selection).filter(s => s.selected).length;
    $('setup-count').textContent = `Eroi selezionati: ${count} / ${selectableHeroes().length}` +
      (count === 0 ? ' (minimo 1)' : count === 1 ? ' — 🌟 Eroe Solitario!' : '');
    $('btn-start-adventure').disabled = count < 1;
  }

  function showCharDetail(h) {
    const box = $('modal-char-content');
    const pickBtn = h.locked
      ? `<button class="btn" disabled>🔒 Si sblocca giocando: andate a riprendervelo</button>`
      : `<button class="btn btn-gold" id="btn-char-pick">✔ Scegli ${h.name.split(' ')[0]}</button>`;
    box.innerHTML = Engine.heroSheetHTML(h, false) +
      `<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        ${pickBtn}
        <button class="btn" id="btn-char-close">Chiudi</button>
      </div>`;
    $('modal-char').classList.remove('hidden');
    $('btn-char-close').onclick = () => $('modal-char').classList.add('hidden');
    if (!h.locked) {
      $('btn-char-pick').onclick = () => {
        const count = Object.values(selection).filter(s => s.selected).length;
        if (!selection[h.id].selected && count < 6) selection[h.id].selected = true;
        $('modal-char').classList.add('hidden');
        renderSetup();
      };
    }
  }

  function startAdventure() {
    const chosen = selectableHeroes().filter(h => selection[h.id].selected)
      .map(h => ({ heroId: h.id, player: selection[h.id].player.trim() }));
    if (chosen.length < 1) return;
    Engine.newGame(chosen, pendingSlot, pendingDifficulty);
    pendingSlot = null;
  }

  return { init, refreshTitle, showProfiles, useProfile, renameProfileUI, deleteProfileUI, showCodes, doImport };
})();

document.addEventListener('DOMContentLoaded', Main.init);
