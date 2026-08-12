# Come creare una nuova campagna

Ricetta collaudata per una storia nuova sullo stesso motore. Tempo indicativo: una sessione di lavoro intensa.

## Passo 0 — Le domande da fare al committente

Quattro domande, prima di scrivere una riga (hanno determinato tutto il primo gioco):

1. **Come giocherete?** Stesso schermo condiviso (consigliato) o altro.
2. **Lingua** dei testi.
3. **Tono**: epico-divertente / dark fantasy / commedia pura.
4. **Regole**: semplificate (consigliato per principianti) o fedeli a D&D 5e.

Più due specifiche del contenuto: **durata desiderata** e **numero di giocatori**.

## Passo 1 — Il seme della storia

Serve una premessa che stia in **una riga** e contenga già un'assurdità e una scadenza:

> *"Un vampiro ha spento il sole perché duecento anni fa il pubblico rise della sua canzone. Avete tempo fino a mezzanotte."*

Da lì si ricavano subito: l'antagonista con la ferita umana, l'obiettivo concreto, il conto alla rovescia.

## Passo 2 — La struttura a clessidra

Struttura usata (funziona: la consiglio come default):

```
PROLOGO (villaggio base)     ~15 scene   il fatto scatenante, il committente, i preparativi
   ↓
VIAGGIO + primo scontro      ~10 scene   uno scontro facile che insegna il combattimento
   ↓
IL BIVIO                      1 scena    2-3 strade alternative: qui nasce la rigiocabilità
   ↓
ATTO 2 (A / B / C)          ~20 scene    ogni ramo dà un OGGETTO CHIAVE + un SEGRETO sul villain
   ↓
ATTO 3 (roccaforte)         ~30 scene    più ingressi, un mini-boss, un alleato conquistabile
   ↓
FINALE                      ~15 scene    3+ modi di risolvere: forza, empatia, astuzia
   ↓
EPILOGHI                     3-5 scene   + epiloghi per eroe + cronache legate ai flag
```

**Regole di dimensionamento**: ~180 parole = 1 minuto di lettura ad alta voce; una partita di 2-4 ore vuole **12.000-17.000 parole** e **120-140 scene**.

## Passo 3 — I personaggi giocanti

Sei eroi pregenerati coprono bene ogni gruppo. Formula per ciascuno:
- un **archetipo D&D riconoscibile** (guerriero, mago, ladro, chierico, ranger, barbaro)
- un **rovesciamento comico** (il guerriero è un ex cuoco, il ranger tenebroso è stato cresciuto dai tassi)
- un **ruolo tattico chiaro** in una riga ("il muro", "danni enormi ma fragile")
- una **passiva** che si nota in gioco
- due **abilità** con usi limitati: una offensiva, una di utilità
- **backstory di 5-8 righe** + una riga su come interpretarlo

Distribuire le statistiche in modo che **ogni eroe sia il migliore in almeno una prova**: così ogni giocatore ha il suo momento.

## Passo 3-bis — Il brief per gli sceneggiatori (e le soglie di densità)

Il grafo che scrivi nell'incarico è **il tetto** dell'interattività, non il pavimento: chi scrive su
brief tende a produrre una scelta per scena (lezione 35). Nel brief va quindi scritto ESPLICITAMENTE:

> Ogni scena deve avere **almeno 2 scelte**, di cui almeno una con una conseguenza meccanica
> (`heal`/`damage`/`gold`/`item`/`sets`), e ci vuole **una prova di dado ogni tre scene** circa,
> distribuita su statistiche diverse. Le scene con un solo bottone "avanti" sono un difetto.

E dopo la prima stesura si misura sempre (soglie in `PIPELINE-PRODUZIONE.md`): scelte medie per scena
≥1,9 · scene-corridoio ≤20% · prove ~1 ogni 3 scene · scene con effetti meccanici ≥80% ·
parole medie 150-260. Se non tornano: passata di densità (template `drafts/POLISH.md`).

## Passo 4 — Scrivere le scene

1. Definire prima l'**elenco degli id** e il grafo su carta (chi porta a chi).
2. Scrivere per **blocchi tematici** (tutto il ramo A, poi tutto il ramo B): il tono resta coerente.
3. Ogni ramo deve fornire: **un oggetto chiave**, **un segreto sul villain** (che diventa una scelta nel finale), **un personaggio memorabile**.
4. Ogni 4-5 scene: **un combattimento** o **una prova di gruppo**.
5. Fallimenti sempre divertenti e mai bloccanti (vedi [STILE-NARRATIVO](STILE-NARRATIVO.md)).

## Passo 5 — Grafica

- **Sprite** 16x16 per eroi, nemici e PNG importanti (mappa di caratteri + palette).
- **Un painter per ambientazione** in `scenes.js`, sempre con `rng(seme)` fisso.
- Controllare che gli sfondi siano leggibili: aree scure con un elemento chiaro (candele, lanterne, riflessi) o la scena "sparisce".
- Aggiungere gli NPC alle scene con `npc: ['chiave_sprite']`.

## Passo 6 — Audio

- Una **traccia musicale per ambientazione** (16 step di basso + melodia; il valzer del ballo usa 12 step in 3/4).
- Mappare scena→traccia in `MUSIC_BY_LOCATION` dentro `engine.js`.
- Riusare gli effetti esistenti: sono generici.

## Passo 7 — Test (non negoziabile)

1. Adattare `tests/validate.mjs`: controlla automaticamente grafo, orfani, vicoli ciechi, oggetti/flag inesistenti, sprite, bilanciamento, conteggio parole.
2. Adattare gli scenari di `tests/playthrough.mjs` ai nuovi percorsi: **ogni ramo e ogni finale devono essere coperti**.
3. Audit visivo con screenshot: **ogni schermata e ogni ambientazione**.
4. Solo allora: commit e push.

## Passo 8 — Pubblicazione

```bash
gh repo create <nome> --public --source=. --push
gh api repos/<utente>/<nome>/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```
Attendere `built`, poi verificare il sito live (ricordando la cache di 10 minuti).

## Checklist finale

- [ ] **Incipit `RULES_STORY`** scritto e cablato (schermata 📖 La Storia dal titolo + modale a inizio partita): dove siete / cosa sta succedendo / cosa vi aspetta / cosa serve al tavolo, senza spoiler
- [ ] **"Cosa manca e dove"**: `prefixes` nei CHAPTERS, stato per capitolo in Rivivi/Rientra, suggerimenti senza spoiler nel finale
- [ ] Requisiti del committente ripresi dai **prompt originali**, uno per uno
- [ ] Durata stimata **dai dati** (scene per run × parole medie ÷ 180 × 2,2-2,8)
- [ ] `validate.mjs` e `playthrough.mjs` verdi
- [ ] tutti i finali raggiungibili e testati
- [ ] ogni promessa scritta nei testi è implementata davvero
- [ ] screenshot di ogni schermata controllati
- [ ] audio: una traccia per ambientazione, tutto disattivabile
- [ ] accessibilità: tastiera, testo grande, focus visibile, riduzione animazioni
- [ ] salvataggi: profili, 3 slot, export/import
- [ ] README aggiornato con i numeri reali (scene, finali, imprese)
- [ ] provata una partita vera dall'inizio alla fine

## Idee già pronte per la prossima volta

- **New Game+**: rigiocare mantenendo oro e imprese, con nemici più tosti.
- **Nuovi eroi sbloccabili** completando imprese specifiche.
- **Missioni secondarie a tempo**: scegliere una side-quest costa tempo prezioso prima di mezzanotte.
- **Seconda campagna nello stesso mondo**: "Il Ritorno del Re Sordo" — il regno c'è già, i personaggi pure.
- **Sincronizzazione dei salvataggi** con un database gratuito (Firebase/Supabase), se il committente crea l'account.
