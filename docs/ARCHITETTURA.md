# Architettura del motore

Riferimento tecnico completo: formati dati, moduli e flusso. Serve per estendere il gioco o riusare il motore per una campagna nuova.

## Flusso di gioco

```
main.js (titolo, profili, setup compagnia)
   └─> Engine.newGame(selezione, slot, difficoltà)
          └─> Engine.gotoScene(id)  ─┬─> renderScene()  → narrazione + scelte
                                     ├─> Combat.start() → schermata di battaglia
                                     └─> Dice.showRoll() → prove di abilità
```

Lo stato globale vive in `G` (oggetto serializzato in `localStorage` a ogni scena).

## Lo stato di gioco `G`

| Campo | Contenuto |
|---|---|
| `G.party` | array di eroi (copia profonda da `HEROES` + `hp`, `down`, `player`) |
| `G.uses` | `{heroId: {abilityId: usiRimasti}}` |
| `G.gold` | monete d'oro |
| `G.inventory` | array di id oggetto (duplicati = quantità) |
| `G.flags` | tutte le variabili di trama (`{sa_corona: true, via: 'bosco', reputazione: 2}`) |
| `G.sceneId` | scena corrente |
| `G.usedChoices` | scelte `once` già consumate, per scena |
| `G.enteredScenes` | scene già visitate (per effetti one-shot) |
| `G.history` | cronologia delle caption (diario + riepilogo alla ripresa) |
| `G.seenEnemies` | nemici incontrati (bestiario) |
| `G.slot`, `G.difficulty` | slot di salvataggio e difficoltà scelti |
| `G.stats` | statistiche finali (combattimenti, prove, durata) |

## Formato SCENA (`js/campaign.js` → `CAMPAIGN`)

```js
id_scena: {
  location: 'taverna',        // chiave di un painter in scenes.js
  caption: 'Titolo mostrato in alto e sotto l\'immagine',
  npc: ['gerbold', 'vesper'], // opzionale: sprite mostrati nella scena
  text: `Il testo narrativo.

**grassetto** per nomi/meccaniche, *corsivo* per gli a parte.
> Nome: "battuta del personaggio"`,

  // --- effetti all'ingresso (una sola volta, salvo dove indicato) ---
  sets: { flag: true, via: 'bosco' },  // scrive su G.flags
  rep: 1,                     // +1 reputazione (si SOMMA, a differenza di sets)
  gold: 50,                   // aggiunge oro (negativo per toglierlo)
  goldLoss: 15,               // toglie oro
  item: 'pozione_cura',       // aggiunge un oggetto
  item2: 'spartito',          // secondo oggetto
  heal: 8,                    // cura tutti
  damage: 3,                  // danneggia tutti (mai sotto 1 PV)
  fullHeal: true,             // PV e abilità al massimo — si applica a OGNI visita
  recharge: true,             // ricarica solo le abilità — a OGNI visita
  onEnterOnce: { itemEach: 'pozione_cura' },  // un oggetto per ogni eroe

  hub: true,                  // scena "base" con scelte ripetibili (solo semantico)
  ending: true,               // è un finale: mostra epiloghi, cronache, imprese

  choices: [ /* vedi sotto */ ],
  combat: { /* vedi sotto */ },   // in alternativa a choices
}
```

## Formato SCELTA

```js
{
  text: '🗣 "Testo della scelta"',
  tag: 'Prova di Carisma — CD 12',   // etichetta mostrata sotto (solo estetica)

  next: 'id_scena',                  // dove porta
  // OPPURE una prova di abilità:
  check: { stat: 'CAR', dc: 12, success: 'id_ok', fail: 'id_ko' },

  requires: { flag: 'sa_corona' },   // condizioni: flag | notFlag | item | notItem
  requiresGold: 20,                  // disabilita la scelta se manca l'oro
  once: true,                        // sparisce dopo essere stata usata (negozi/hub)

  sets: { flag: true },              // effetti immediati
  rep: 1, gold: -10,
  item: 'corda', removeItem: 'aglio',
}
```

Statistiche valide: `FOR DES COS INT SAG CAR`. CD indicative: **10** facile · **12** media · **13-14** difficile.
Un **20 naturale** è sempre successo, un **1 naturale** sempre fallimento.

## Formato COMBATTIMENTO

```js
combat: {
  enemies: ['goblin', 'goblin', 'goblin_capo'],  // chiavi di BESTIARY
  victory: 'id_scena_vittoria',
  defeat: 'sconfitta_generica',                  // scena con fullHeal + RETRY_COMBAT
  loot: { gold: 15, items: ['pozione_cura'] },
}
```

`RETRY_COMBAT` come `next` riporta all'ultima scena di combattimento: è il modo standard per far riprovare uno scontro perso.

## Formato OGGETTO (`ITEMS`)

```js
pozione_cura:     { name: '...', desc: '...', usable: true, heal: 10 },              // curativa
bomba_puzzolente: { name: '...', desc: '...', combat: { dice: [2,6], distract: true }, icon: '💣' }, // da lancio
acqua_santa:      { name: '...', desc: '...', combat: { dice: [2,8], holy: true }, icon: '💧' },     // danni doppi ai non-morti
chiave_torre:     { name: '...', desc: '...', usable: false },                       // oggetto chiave
dado_destino:     { name: '...', desc: '...', usable: false, reroll: true },         // ritira una prova fallita
```

## Formato NEMICO (`BESTIARY` in characters.js)

```js
goblin: {
  name: 'Goblin del Sindacato', sprite: 'goblin',
  maxHp: 12, ac: 12,
  ai: 'random',        // random | weakest | strongest | smart (il boss punta il guaritore)
  undead: true,        // opzionale: subisce danni doppi da Sacra Folgore/acqua santa
  boss: true,          // opzionale: etichetta nel bestiario
  lifesteal: true,     // opzionale: recupera metà del danno inflitto
  attack: { name: 'Mazza chiodata', bonus: 3, dice: [1, 6], plus: 1 },
  flavor: 'Una riga di colore, mostrata a inizio scontro e nel bestiario.',
}
```

## Tipi di ABILITÀ degli eroi

Dichiarati in `HEROES[].abilities[].type`, gestiti in `combat.js`:

| tipo | effetto |
|---|---|
| `bighit` | attacco potenziato con dadi propri |
| `autohit` | danno automatico senza tiro |
| `aoe` | danno a tutti i nemici |
| `sneak` | attacco con vantaggio |
| `double` | due attacchi (anche su bersagli diversi) |
| `stun` | attacco + salta il turno del nemico |
| `pet` | danno automatico + nemico distratto |
| `heal` | cura un alleato (rialza chi è a terra) |
| `holy` | danni doppi ai non-morti |
| `taunt` | i nemici attaccano solo lui, danni dimezzati |
| `smoke` | svantaggio agli attacchi nemici |
| `rage` | +danni e -danni subiti per alcuni turni |

Se l'abilità dichiara `stat`, quella statistica viene usata per tiro e danno (invece di quella dell'arma).

## SPRITE (`js/sprites.js`)

Mappa di **16 righe da 16 caratteri**; `.` = trasparente, ogni altro carattere è una chiave della palette.

```js
const mioSprite = {
  palette: { s:'#e8b88a', b:'#c14b2a' },
  map: [ '....bbbb....', ... ].map(r => r.padEnd(16,'.').slice(0,16)),
};
```

`tests/validate.mjs` verifica dimensioni e palette: un carattere non dichiarato fa fallire i test.

## SFONDI (`js/scenes.js` → `painters`)

Ogni location è una funzione `(ctx, W, H)` che disegna con gli helper disponibili:
`blocks()` (blocchi stile minecraft con variazione di tono), `skyGradient()`, `stars()`, `moon()`, `tree()`, `house()`, `torch()`, `rng(seed)` (casuale riproducibile), `shade()`.

Regola d'oro: **usare sempre `rng(seme)`**, mai `Math.random()`, così lo sfondo non "sfarfalla" a ogni ridisegno.

## AUDIO (`js/sound.js`)

- **Effetti**: `Sound.play('click'|'dice'|'success'|'crit'|'fail'|'hit'|'heal'|'gold'|'item'|'victory'|'defeat'|'combat')`
- **Musica**: `Sound.music('nome_traccia')` — cambia solo se diversa da quella in corso.
  Le tracce sono array di semitoni (57 = LA4, `null` = pausa) con `bass`, `lead` e `hat` opzionale:
  ```js
  bosco: { bpm: 76, vol: 0.04, bass: [38, null, ...], lead: [null, 65, ...] }
  ```
  La mappa scena→traccia è in `engine.js` (`MUSIC_BY_LOCATION` + `musicForScene`).
- Entrambi disattivabili separatamente, preferenze in `localStorage`.

## SALVATAGGI

- Chiave: `corona-save-<profilo>-slot-<n>`, 3 slot per profilo.
- Profili in `corona-profiles`, corrente in `corona-current-profile`.
- **Export/Import**: `Engine.exportCode(slot)` → base64 da incollare altrove; `Engine.importCode(code, slot)`.
- Migrazione automatica dai formati vecchi all'avvio.

## EPILOGHI E IMPRESE (`js/epilogues.js`)

- `HERO_EPILOGUES[heroId][tipoFinale]` — tre varianti per eroe (`vittoria`/`redenzione`/`esilio`).
- `IMPRESE` — achievement `{flag, icon, title, desc}`, sbloccati se `G.flags[flag]` è veritiero.
- `CRONACA` — righe di epilogo mondiale mostrate solo se il flag corrispondente è attivo.


## Righe condizionate alla presenza dell'eroe (agosto 2026)

Nel campo `text` delle scene: `[[eroe:torvald]]> Torvald: "..."[[/eroe]]` — il blocco appare solo se l'eroe è nel gruppo e non a terra. Il motore (engine.js, renderScene) rimuove i blocchi degli assenti e collassa le righe vuote residue. Usarlo per OGNI battuta o frase che nomina un eroe giocabile: il gruppo va da 1 a 6. Per le SCELTE esiste già `requires: { flag: '<id>_presente' }` (impostato automaticamente da newGame).
