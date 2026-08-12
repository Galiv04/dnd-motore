# PIPELINE DI PRODUZIONE — il framework riusabile della serie

> Come si produce un gioco nuovo della serie spendendo MENO token e MENO tempo del precedente.
> Nato con "La Casa che non Finisce" (prodotta in una sessione contro le 24h+ del Relais).
> Regola madre: **tutto ciò che si costruisce deve essere riusabile dal gioco successivo.**

## Il principio

Il modello principale fa SOLO da **orchestratore**: decide, scrive i brief, integra, revisiona.
Il lavoro pesante (scene, grafica, audio, test, audit) va ad **agenti in parallelo**, ognuno con
un incarico chiuso. I costi si abbattono perché: (1) il motore si eredita per copia, (2) i processi
sono template già scritti, (3) gli agenti lavorano in parallelo su blocchi indipendenti.

## La pipeline in 10 passi

| # | Passo | Chi | Artefatto |
|---|---|---|---|
| 1 | Brainstorming col committente (domande mirate, widget) | orchestratore | decisioni confermate |
| 2 | `docs/DESIGN.md`: struttura, meccaniche nuove, finali, vincoli | orchestratore | il contratto del gioco |
| 3 | Copia del motore **dal repo più avanzato** + rebrand (chiavi localStorage, stringhe, index.html) | orchestratore | repo nuovo |
| 4 | Meccaniche nuove nel motore (engine/combat) | orchestratore | motore esteso |
| 5 | `characters.js` + `ITEMS` + **`drafts/BRIEF.md`** (formato dati, tono con ESEMPI calibrati, contratti chiusi: item/flag/location/stinger/bestiario, grafo scena-per-scena a blocchi) | orchestratore | i contratti di produzione |
| 6 | **Fan-out**: un agente per blocco di scene (prefissi riservati, uscite ammesse elencate) + epiloghi/imprese/cronache + sprite + painter + musiche — TUTTI in parallelo, output in `drafts/` | agenti | drafts/scene-*.js ecc. |
| 7 | `tests/assemble.mjs` ricompone `js/campaign.js` dai draft (i fix alle scene si fanno NEI DRAFT) | orchestratore | campaign.js |
| 8 | `validate.mjs` (statico) + `playthrough.mjs` (partite simulate) — un agente adatta gli scenari | agente | suite verdi |
| 9 | Pubblicazione (gh repo create + Pages + CI copiata) | orchestratore | sito live |
| 10 | **Audit visivo** sul sito live (ogni painter + giro UI coi click veri) | agente | fix grafici |

E POI, prima di dichiarare pronto: **la checklist dei requisiti del committente presi dai prompt
originali** (lezione 31) — inclusa la stima di durata DAI DATI (scene per run × parole ÷ 180).

## Le regole del fan-out (perché non degeneri nel caos)

1. Ogni agente scrive UN file in `drafts/`, con prefissi di scena riservati e le UNICHE uscite
   esterne ammesse elencate nell'incarico.
2. Il BRIEF contiene esempi di voce **scritti dall'orchestratore**: gli agenti calibrano su quelli.
3. Contratti chiusi: niente item/location/stinger/nemici inventati — solo i cataloghi del BRIEF.
4. Ogni flag impostato dichiara il suo consumatore nel commento di coda del draft (il validatore
   poi lo impone).
5. Nelle espansioni (ondate successive): scelte-aggancio SOLO in coda agli array `choices`
   (le policy dei playthrough contano sull'ordine), spesso `once: true`.
6. Modelli per costo: haiku/sonnet per lavoro meccanico (audit, refactoring, test), modelli
   capaci solo dove la qualità creativa lo esige.

## Moduli riusabili (si portano nel gioco nuovo con un copia-incolla)

- **Motore completo** (engine/combat/dice/sprites/scenes/sound + css + index.html): dal repo più
  avanzato della serie (oggi: casa-che-non-finisce).
- **Suite di test**: `validate.mjs` (grafo, flag, sprite, stinger, capitoli, prove ripetibili) e
  l'harness di `playthrough.mjs` (stub DOM + click programmatici): si riscrivono solo gli scenari.
- **`tests/assemble.mjs`**: ricompone campaign.js dai draft.
- **"Cosa manca e dove"** (engine.js): `seenScenes/markSeen` + `chapterProgress()` + righe di
  stato in `showRevive` + blocco suggerimenti senza spoiler in `renderEnding`. Richiede solo
  `prefixes` nei CHAPTERS; l'inferenza impresa→capitolo è automatica (dalla scena che ne imposta
  il flag). Presente nella Casa e retro-applicata al Relais.
- **Incipit** (`RULES_STORY` in js/rules.js + schermata `screen-story` gemella di `screen-howto` +
  modale in `newGame`): la presentazione della storia senza spoiler. Obbligatoria in ogni gioco
  (lezione 33): dove siete / cosa sta succedendo / cosa vi aspetta / cosa serve al tavolo.
- **CI GitHub Actions** (15 righe): validate + playthrough a ogni push.
- **`drafts/BRIEF.md`** come TEMPLATE: si riscrive solo la parte di contenuto.

## Trappole note (pagate una volta, mai più)

- Stub DOM: i matcher dei test leggono `innerHTML + textContent` (lezione 28).
- Oggetti richiesti dai `requires` garantiti nello zaino o nel percorso (lezione 30).
- I numeri nei documenti invecchiano: soglie, non conteggi (lezione 22).
- Rete di questa macchina: niente localhost, push con `curloptResolve`, cache Pages ~10'.

## Costo: scegliere SEMPRE il modello dell'agente

Gli agenti **ereditano il modello del chiamante** se non lo si specifica: un fan-out di 6 agenti
lanciato senza `model` consuma la quota del modello più caro e, quando finisce, muoiono TUTTI
insieme a metà lavoro (successo dopo il fatto: i file scritti fino a quel punto restano validi,
ma i riferimenti alle scene non ancora scritte rompono il grafo).
→ **Regola**: passare `model` esplicito a ogni agente. `sonnet` per il 90% dei compiti (scene su
brief, test, audit, refactoring, backport); il modello più capace SOLO per il design e i brief,
che li scrive l'orchestratore. E far chiudere ogni agente con una verifica che LUI stesso esegue
(`node tests/validate.mjs` verde), così un'interruzione non lascia mai il repo incoerente.

## Mai `git add -A` mentre un agente sta scrivendo

Un commit "di servizio" (aggiornare un doc) fatto con `git add -A` mentre un agente riscriveva
`tests/playthrough.mjs` ha pushato il file A METÀ: CI rossa su un lavoro che localmente era solo
incompleto, non rotto. → **Regola**: durante un fan-out, committare **solo i file che si stanno
toccando** (`git add <file>`), oppure aspettare che gli agenti abbiano finito. E prima di ogni
push: `git status --short` per vedere se c'è dentro roba di qualcun altro.

## Controllo di densità (misurare la giocabilità, non solo le parole)

Regola ripetuta del committente: *i testi non devono essere prolissi; la lunghezza del gioco deve
venire dalla varietà e dalla giocabilità.* Non basta tenere le scene corte: bisogna misurare quante
DECISIONI offre il gioco. Metriche da controllare prima di dichiarare pronto (script in
`effetto-zoom` — leggono la campagna assemblata):

| Metrica | Soglia |
|---|---|
| Parole medie per scena | 150-260 (max 300) |
| Scene oltre 280 parole | 0 |
| **Scelte medie per scena** | **≥ 1.9** |
| **Scene con una sola scelta** (corridoi "avanti") | **≤ 20% delle scene** |
| Prove di dado | ~1 ogni 3 scene |
| Scene con un effetto meccanico (gold/heal/damage/item/sets) | ≥ 80% |

Sull'Effetto Zoom la prima stesura aveva testi perfetti (194 parole medie, zero scene lunghe) ma
1.37 scelte per scena e 52 corridoi su 84: il gioco *si leggeva* invece di *giocarsi*. La passata
di rifinitura (`drafts/POLISH.md`, riusabile come template) aggiunge scelte e prove **senza toccare
i testi** — anzi accorciandoli dove serve. Farla SEMPRE, subito dopo la prima stesura.
