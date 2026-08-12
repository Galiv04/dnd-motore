/* ============================================================
   TEMPLATE DI CAMPAGNA — scheletro commentato
   ============================================================
   Copiare questo file in js/campaign.js di un progetto nuovo e
   riempirlo. Ogni sezione ha un esempio funzionante da imitare.

   Riferimenti:
   - formati dati completi  → docs/ARCHITETTURA.md
   - tono e regole di stile → docs/STILE-NARRATIVO.md
   - procedura completa     → docs/COME-CREARE-UNA-CAMPAGNA.md
   ============================================================ */


/* ---------- 1. OGGETTI ----------
   Tre famiglie: curativi (usable+heal), da lancio (combat),
   oggetti chiave (usable:false, aprono scelte con requires).   */

const ITEMS = {
  pozione_cura:      { name: 'Pozione di Cura', desc: 'Ripristina 10 PV. Usabile in combattimento.', usable: true, heal: 10 },
  pozione_cura_magg: { name: 'Pozione di Cura Maggiore', desc: 'Ripristina 20 PV.', usable: true, heal: 20 },

  // da lancio: colpiscono sempre; holy = danni doppi ai non-morti; distract = svantaggio al nemico
  fiala_esempio:     { name: 'Fiala d\'Esempio', desc: 'Da lancio: 2d6 danni.', combat: { dice: [2, 6] }, icon: '💥' },

  // oggetto chiave: sblocca scelte con requires:{item:'...'}
  chiave_esempio:    { name: 'Chiave d\'Esempio', desc: 'Apre qualcosa di importante.', usable: false },
};


/* ---------- 2. SCENE ----------
   Ogni scena ha: location (painter), caption, text e
   choices OPPURE combat. Nessun vicolo cieco: solo i finali
   possono non avere uscite (ending: true).                     */

const CAMPAIGN = {

  /* ===== PROLOGO ===== */

  p1: {
    location: 'taverna',          // chiave di un painter in js/scenes.js
    caption: 'Dove comincia tutto',
    npc: ['nome_sprite'],         // opzionale: personaggi mostrati in scena
    text: `**Luogo, momento della giornata.**

Un'immagine concreta che apre la scena: un odore, un suono, un dettaglio.

> Nome PNG: "Una battuta che presenta il personaggio e il suo problema."

Una riga che chiude con una spinta in avanti. *E magari un a parte del narratore.*`,
    choices: [
      { text: '🍻 Una scelta che è un\'AZIONE, non una risposta', next: 'p2' },
      { text: '🗣 Una scelta alternativa che porta altrove', next: 'p1b' },
    ],
  },

  p1b: {
    location: 'taverna',
    caption: 'Una deviazione facoltativa',
    text: `Scena breve di colore: aggiunge personalità, non trama. Riconfluisce subito.`,
    choices: [{ text: 'Continua', next: 'p2' }],
  },

  /* ===== SCENA CON PROVA DI ABILITÀ =====
     Il successo e il fallimento portano a scene DIVERSE:
     il fallimento deve essere divertente, mai bloccante.        */

  p2: {
    location: 'villaggio',
    caption: 'Il fatto scatenante',
    text: `Qui succede la cosa che mette in moto l'avventura.

**Il fatto** deve essere grosso, visibile e con una scadenza.`,
    choices: [
      { text: '🗣 Provate a calmare la folla', tag: 'Prova di Carisma — CD 10',
        check: { stat: 'CAR', dc: 10, success: 'p2_ok', fail: 'p2_ko' } },
      { text: '🧠 Studiate cosa sta succedendo', tag: 'Prova di Intelligenza — CD 10',
        check: { stat: 'INT', dc: 10, success: 'p2_ok', fail: 'p2_ko' } },
    ],
  },

  p2_ok: {
    location: 'villaggio',
    caption: 'Successo',
    text: `La riuscita, raccontata in modo soddisfacente.

**(+1 Reputazione)**`,
    rep: 1,                       // la reputazione si SOMMA (sets sovrascriverebbe)
    sets: { sa_qualcosa: true },  // flag di trama, usabile più avanti con requires
    choices: [{ text: 'Continua', next: 'hub1' }],
  },

  p2_ko: {
    location: 'villaggio',
    caption: 'Fallimento (divertente)',
    text: `Il fallimento va storto in modo COMICO, e il gruppo ne esce comunque.

Be'... diciamo che era il piano fin dall'inizio.`,
    choices: [{ text: 'Continua', next: 'hub1' }],
  },

  /* ===== HUB CON SCELTE A CONSUMO =====
     Le scelte 'once' spariscono dopo l'uso: perfetto per
     negozi, PNG da visitare, side-quest.                        */

  hub1: {
    location: 'villaggio',
    caption: 'Preparativi',
    hub: true,
    text: `Prima di partire, c'è tempo per qualche giro in paese.`,
    choices: [
      { text: '🧪 L\'emporio', next: 'negozio', once: true },
      { text: '👵 Il PNG che conosce il passato del villain', next: 'lore', once: true },
      { text: '🐴 Si parte!', next: 'bivio' },
    ],
  },

  negozio: {
    location: 'taverna',
    caption: 'L\'emporio',
    hub: true,
    text: `Il negoziante e il suo carattere in tre righe.`,
    onEnterOnce: { itemEach: 'pozione_cura' },   // un oggetto per ogni eroe, alla prima visita
    choices: [
      { text: '💰 Comprate qualcosa (10 oro)', requiresGold: 10, gold: -10, item: 'chiave_esempio', once: true },
      { text: '↩ Tornate in piazza', next: 'hub1' },
    ],
  },

  lore: {
    location: 'taverna',
    caption: 'Il segreto del villain',
    text: `Qui si scopre PERCHÉ il cattivo fa quello che fa: la sua ferita umana.

**(Segreto scoperto: sbloccherà una scelta speciale nel finale.)**`,
    sets: { sa_segreto: true },
    choices: [{ text: 'Tornate in piazza', next: 'hub1' }],
  },

  /* ===== IL BIVIO — il cuore della rigiocabilità ===== */

  bivio: {
    location: 'strada',
    caption: 'Il bivio',
    text: `Due (o tre) strade, ciascuna con un vantaggio diverso e un personaggio memorabile.

**C'è tempo per una sola strada.**`,
    choices: [
      { text: '🌲 Strada A', next: 'a1', sets: { via: 'A', via_a: true } },
      { text: '⛏ Strada B', next: 'b1', sets: { via: 'B', via_b: true } },
    ],
  },

  /* ===== RAMO A (esempio con combattimento) ===== */

  a1: {
    location: 'bosco',
    caption: 'Ramo A',
    text: `Scena d'apertura del ramo.`,
    choices: [
      { text: '⚔ Affrontate il nemico', next: 'a_fight' },
      { text: '🧠 Evitatelo con l\'astuzia', tag: 'Prova di Intelligenza — CD 12',
        check: { stat: 'INT', dc: 12, success: 'a_fine', fail: 'a_fight' } },
    ],
  },

  a_fight: {
    location: 'bosco',
    caption: 'Scontro!',
    text: `Il nemico attacca. *(Consiglio da DM per i giocatori, se serve.)*`,
    combat: {
      enemies: ['nemico_esempio', 'nemico_esempio'],
      victory: 'a_fine',
      defeat: 'sconfitta_generica',
      loot: { gold: 15 },
    },
  },

  a_fine: {
    location: 'bosco',
    caption: 'Fine del ramo A',
    text: `Il ramo consegna: un OGGETTO CHIAVE e un SEGRETO sul villain.`,
    item: 'chiave_esempio',
    sets: { sa_segreto: true },
    choices: [{ text: 'Verso il finale', next: 'finale1' }],
  },

  b1: {
    location: 'miniera',
    caption: 'Ramo B',
    text: `Stesso schema del ramo A, con tono e personaggio diversi.`,
    item: 'chiave_esempio',
    sets: { sa_segreto: true },
    choices: [{ text: 'Verso il finale', next: 'finale1' }],
  },

  /* ===== FINALE — più modi di risolvere ===== */

  finale1: {
    location: 'vetta',
    caption: 'Faccia a faccia col villain',
    npc: ['sprite_villain'],
    text: `Il confronto. Il villain parla, si spiega, minaccia.

Le scelte qui devono essere DIVERSE tra loro: forza, empatia, astuzia, oggetto.`,
    choices: [
      { text: '⚔ Combattete', next: 'boss' },
      { text: '🗣 Usate il segreto che avete scoperto', requires: { flag: 'sa_segreto' }, next: 'finale_empatia' },
      { text: '🔑 Usate l\'oggetto chiave', requires: { item: 'chiave_esempio' }, removeItem: 'chiave_esempio', next: 'finale_astuzia' },
    ],
  },

  boss: {
    location: 'vetta',
    caption: 'BATTAGLIA FINALE',
    text: `Lo scontro decisivo.`,
    combat: { enemies: ['boss_esempio'], victory: 'epilogo_vittoria', defeat: 'sconfitta_boss' },
  },

  finale_empatia:  { location: 'vetta', caption: 'La via delle parole', text: `Il villain viene raggiunto dalle parole giuste.`, sets: { finale_buono: true }, choices: [{ text: 'Continua', next: 'epilogo_buono' }] },
  finale_astuzia:  { location: 'vetta', caption: 'La via dell\'astuzia', text: `L'oggetto chiave ribalta la situazione.`, sets: { finale_astuto: true }, choices: [{ text: 'Continua', next: 'epilogo_buono' }] },

  /* ===== SCONFITTE — mai fine partita: si riprova =====
     fullHeal si applica a OGNI visita (non è one-shot).         */

  sconfitta_generica: {
    location: 'strada',
    caption: 'Tutto nero... ma non è finita',
    text: `Qualcuno vi soccorre. Vi rialzate, doloranti ma vivi.

**(PV e abilità ripristinati.)**`,
    fullHeal: true,
    goldLoss: 15,
    choices: [{ text: '↩ Riprovate', next: 'RETRY_COMBAT' }],   // torna all'ultimo combattimento
  },

  sconfitta_boss: {
    location: 'cripta',
    caption: 'Prigionieri',
    text: `Un alleato vi libera. C'è ancora tempo.

**(PV e abilità ripristinati.)**`,
    fullHeal: true,
    choices: [{ text: '🏃 Secondo round!', next: 'boss' }],
  },

  /* ===== EPILOGHI (ending: true) ===== */

  epilogo_vittoria: {
    location: 'alba',
    caption: 'EPILOGO — La vittoria',
    text: `**Sei mesi dopo.**

Come cambia il mondo grazie a voi. Chiudere con un'immagine, non con una spiegazione.

**🌅 FINE**`,
    ending: true,
  },

  epilogo_buono: {
    location: 'alba',
    caption: 'EPILOGO — Il finale migliore',
    text: `La variante più bella, riservata a chi ha scoperto i segreti.

**🌅 FINE**`,
    ending: true,
  },
};

/* Scena iniziale */
const CAMPAIGN_START = 'p1';

/* ---------- 3. MAPPA DEL MONDO ----------
   Ogni luogo elenca le scene che vi si svolgono: serve alla
   mappa interattiva per mostrare "voi siete qui".              */

const WORLD_MAP = [
  { key: 'villaggio', label: 'Villaggio',  x: 0.18, y: 0.72, scenes: ['p1','p1b','p2','p2_ok','p2_ko','hub1','negozio','lore'] },
  { key: 'bivio',     label: 'Il Bivio',   x: 0.50, y: 0.50, scenes: ['bivio'] },
  { key: 'ramoA',     label: 'Ramo A',     x: 0.30, y: 0.30, scenes: ['a1','a_fight','a_fine'] },
  { key: 'ramoB',     label: 'Ramo B',     x: 0.70, y: 0.34, scenes: ['b1'] },
  { key: 'finale',    label: 'Roccaforte', x: 0.52, y: 0.12, scenes: ['finale1','boss','finale_empatia','finale_astuzia','epilogo_vittoria','epilogo_buono','sconfitta_boss'] },
];
