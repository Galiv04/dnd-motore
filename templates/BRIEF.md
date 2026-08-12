# BRIEF DI PRODUZIONE — <<NOME DEL GIOCO>>

Sei uno degli sceneggiatori di questo gioco della serie. Scrivi in ITALIANO. Leggi prima
`docs/DESIGN.md` di questo repo e `../dnd-motore/docs/STILE-NARRATIVO.md` (le convenzioni di
scrittura valgono TUTTE, ma il tono qui è quello descritto sotto).

## Tono

- **<<TONO>>**: descrivi qui il registro (horror hardcore, macabro cinematografico, psichedelico,
  fantasy classico, ecc.), cosa è ammesso e cosa no (turpiloquio, gore, contenuti sessuali,
  parodia sì/no).
- **150-350 parole a scena** (obiettivo medio 150-260, vedi "Densità minima" sotto). Apri con
  un'immagine concreta, chiudi con una spinta. Le scelte sono azioni. Il gioco deve MUOVERSI: ogni
  scena porta qualcosa di nuovo (luogo, creatura, verità, twist).
- Seconda persona plurale. I protagonisti citati per nome sempre (chi non è giocato è comunque
  presente, se il gioco prevede personaggi non giocati).
- Formato battute: `> Nome: "..."` — indicazioni sceniche `*(corsivo)*` — effetti meccanici `**(...)**`.

## Vincoli etici / di contenuto NON NEGOZIABILI

<<elenco dei vincoli specifici di questo gioco: persone reali coinvolte, temi sensibili da trattare
solo per metafora, argomenti da NON nominare mai, ritratti che devono restare affettuosi, ecc.>>

## <<PROTAGONISTI>> (dettagli veri autorizzati, da usare)

<<per ciascun personaggio: mestiere/tratto, una caratteristica ricorrente, una paura, eventuali
bonus di statistica, eventuali condizioni di sblocco (`locked: true` + `unlockHero`)>>

## Formato dati (il contratto tecnico col motore — NON modificare la forma)

```js
id_scena: {
  location: 'salotto',              // OBBLIGATORIO, dal <<CATALOGO LOCATION>> qui sotto
  caption: 'Un sottotitolo di scena',
  npc: ['nemico_o_pnG'],             // sprite mostrati nella scena (facolt.)
  stinger: 'jumpscare',              // suono alla 1ª visita — deve esistere in sound.js (<<STINGER AMMESSI>>)
  text: `...150-350 parole...`,
  item: 'oggetto',                   // oggetto alla 1ª visita (item2 per il secondo)
  gold: 1,                           // valuta guadagnata (goldLoss per perderla)
  sets: { flag: true },              // flag alla 1ª visita
  damage: 3, heal: 4,                // PV a tutto il gruppo (1ª visita)
  poisonRoller: true,                // chi ha tirato (e fallito) prende la condizione "avvelenato" del gioco
  killRoller: true,                  // ⚰️ morte vera (se il gioco la prevede) — solo dove indicato!
  unlockHero: 'id_personaggio',      // sblocca un personaggio locked
  fullHeal: true, goldLoss: 2,       // scene di sconfitta (a OGNI visita)
  freeAll: true,                     // libera i "presi"/catturati
  combat: { enemies: ['nemico','nemico'], victory: 'sceneA', defeat: 'sceneA_ko', loot: { gold: 2, items: ['oggetto'] } },
  ending: true,                      // solo epiloghi e_*
  choices: [
    { text: '🚪 Aprite la porta', next: 'a3' },
    { text: '👀 Guardare meglio', tag: 'Prova di Saggezza — CD 11', check: { stat: 'SAG', dc: 11, success: 'a4', fail: 'a5' } },
    { text: '🗣 Solo se hai l\'oggetto', requires: { item: 'oggetto', flag: 'x', notFlag: 'y', hero: 'id_personaggio', spirit: true, flagAny: ['a','b'] }, next: '...' },
    { text: '🎁 una tantum', once: true, item: 'oggetto2', gold: 1, sets: { f: true }, removeItem: 'oggetto3', next: '...' },
    { text: '💰 costa valuta', requiresGold: 3, gold: -3, next: '...' },
    { text: '🕯 Qualcuno resta.', sacrifice: true, sacrificeSets: 'scambiato', sacrificeTitle: 'Chi resta?', sacrificeText: '...', next: 'e_scambio' },
  ],
}
```

- `requires.hero` = quel personaggio è nel party e VIVO. `requires.spirit` = c'è almeno uno Spirito
  (se il gioco prevede la morte vera, scelte che solo i morti sbloccano). `requires.flagAny` = basta
  UNO dei flag elencati (OR) — utile per le vie alternative che convergono.
- Le prove: CD 10-11 facili, 12-13 medie, 14+ dure. Ogni personaggio deve avere prove dove brilla.
- REGOLA D'ORO DEI FLAG: ogni flag che imposti DEVE avere un consumatore (una scelta `requires`, un
  eco in combattimento, una voce di diario/impresa/cronaca). Elenca a fine file i flag che imposti.
- I fallimenti nelle prove normali deviano la storia (spesso in peggio, MAI in un vicolo cieco).
- Un combattimento o prova di gruppo ogni 4-5 scene circa.

## Densità minima (obbligatoria)

Ogni scena deve avere **almeno 2 scelte**, di cui almeno una con conseguenza meccanica
(`heal`/`damage`/`gold`/`item`/`sets`), e ci vuole **una prova di dado ogni tre scene** circa,
distribuita su statistiche diverse. Le scene con un solo bottone "avanti" sono un difetto, non
uno stile.

## <<CATALOGO LOCATION>> ammesse (painter)

<<elenco delle location che `scenes.js` sa disegnare per questo gioco>>

## <<BESTIARIO>> (chiavi esatte)

<<elenco dei nemici, con i boss segnalati>>

## <<CATALOGO ITEM>> (chiavi esatte — non inventarne altre)

<<elenco degli oggetti, con eventuali rarità/vincoli di distribuzione>>

## Eventuale meccanica firma del gioco

<<se il gioco ha una meccanica ricorrente e distintiva (es. un enigma di logica, un minigioco a
scelte, una sequenza rituale), descrivi qui il pattern esatto passo per passo, con un esempio>>

## Esempi di voce (calibrati — studiali)

<<ESEMPI DI VOCE: 3 esempi scritti dall'orchestratore, che mostrano il registro giusto per: (1) una
scena d'azione/orrore/atmosfera tipica, (2) un momento di cuore/pausa, (3) una battuta o un
dialogo del principale antagonista o di un personaggio chiave>>

## Consegna

Scrivi il tuo blocco in `drafts/scene-<blocco>.js` come:
```js
const SCENE_<BLOCCO> = {
  id1: { ... },
  id2: { ... },
};
```
In fondo al file, in un commento: l'elenco dei flag impostati con il loro consumatore, gli item
dati, e le eventuali morti/deviazioni possibili. NON toccare altri file. NON usare id fuori dal tuo
prefisso (le uscite verso altri blocchi sono elencate nel tuo incarico e sono le UNICHE ammesse).
