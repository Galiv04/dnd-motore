  /* ---------- il rendering: identico in tutti i giochi della serie ---------- */

  const $ = id => document.getElementById(id);
  let corrente = null;

  function apri(key, titoloHUD) {
    const L = LUOGHI[key];
    if (!L) return;
    const box = $('modal-generic-content');
    if (!box) return;
    box.innerHTML = `<h2>🔎 ${L.titolo}</h2>`
      + `<p style="color:var(--text-dim);margin:-6px 0 14px">${L.ora}</p>`
      + (titoloHUD && titoloHUD !== L.titolo
          ? `<p style="color:var(--text-dim);font-size:.92em;margin:-10px 0 14px">Nel gioco, adesso: <b>${titoloHUD}</b></p>` : '')
      + `<h3>👁 Cosa vedete nel quadro</h3><ul style="margin:0 0 14px;padding-left:18px">`
      + L.guarda.map(([n, t]) => `<li style="margin-bottom:7px"><b>${n}.</b> ${t}</li>`).join('')
      + `</ul><h3>📜 Perché questo posto esiste</h3><p style="margin:0 0 14px">${L.storia}</p>`
      + `<h3>🎲 Cosa c'entra col gioco</h3><p style="margin:0 0 4px">${L.gioco}</p>`
      + `<p style="color:var(--text-dim);font-size:.86em;margin:14px 0 0">Questa scheda racconta solo quello che`
      + ` avete già davanti agli occhi: non anticipa niente di quello che deve ancora succedere.</p>`;
    const chiudi = document.createElement('button');
    chiudi.className = 'btn';
    chiudi.style.marginTop = '14px';
    chiudi.textContent = '↩ Torna alla scena';
    chiudi.onclick = () => $('modal-generic').classList.add('hidden');
    box.appendChild(chiudi);
    $('modal-generic').classList.remove('hidden');
  }

  /* Chiamata dal motore dopo ogni Scenes.paint(): accende il pulsante se questo
     luogo ha una scheda, lo spegne se non ce l'ha. Un luogo senza scheda non
     mostra un pulsante che apre il vuoto. */
  function aggiorna(key, titoloHUD) {
    corrente = key;
    const b = $('btn-scena');
    if (!b) return;
    const haScheda = !!LUOGHI[key];
    b.classList.toggle('hidden', !haScheda);
    if (!haScheda) return;
    b.onclick = () => apri(key, titoloHUD);
    b.title = 'Cosa sto guardando?';
  }

  return { LUOGHI, apri, aggiorna, corrente: () => corrente };
})();
