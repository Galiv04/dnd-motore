# dnd-motore

La cassetta degli attrezzi condivisa della serie di avventure D&D interattive di Gali
(giocabili nel browser, in italiano, siti statici pubblicati su GitHub Pages, zero build,
zero dipendenze). Qui vive tutto ciò che è **riusabile fra i giochi**: il motore JS/CSS,
la documentazione di architettura e stile, i template di produzione e gli strumenti.

## Cos'è

- `docs/` — architettura del motore, stile narrativo, pipeline di produzione, lezioni
  apprese, preferenze del committente, ricetta per creare una campagna nuova.
- `engine/` — il motore condiviso: `engine.js`, `combat.js`, `dice.js`, `main.js`, `sound.js`,
  `sprites.js`, `scenes.js`, `rules.js`, `style.css`, e uno `index.html` scheletro con i
  segnaposto da personalizzare (vedi i commenti in testa al file).
- `templates/` — `BRIEF.md` e `POLISH.md` generalizzati per orchestrare la scrittura di un
  nuovo gioco, il template di una campagna (`campagna-template.js`), i test riusabili
  (`validate.mjs`, `playthrough.mjs`, `assemble.mjs`) e il workflow CI (`ci-tests.yml`).
- `tools/` — `metriche.mjs` (misura la densità di giocabilità di una campagna) e
  `nuovo-gioco.sh` (scaffolding automatico di un gioco nuovo).

## Come si usa per un gioco nuovo

```bash
cd dnd-motore
bash tools/nuovo-gioco.sh <nome-repo> "<Titolo del gioco>"
```

Crea `../<nome-repo>` con motore, test, CI e draft di produzione già copiati, un `docs/DESIGN.md`
scheletro e un `CLAUDE.md` iniziale che punta a questo repo. Da lì si segue la checklist stampata
in fondo allo script: design → brief → personaggi → fan-out delle scene → assemble → validate →
playthrough → metriche → pubblicazione → audit visivo.

## Cosa NON va qui

I **contenuti** dei singoli giochi: scene, personaggi, sprite specifici, campagne, design
document del singolo gioco. Questo repo non contiene mai un `js/campaign.js`, un
`js/characters.js` giocabile o testo narrativo di una storia — solo motore e strumenti generici.

## I giochi che lo usano

- [Galiv04/dnd-corona-di-mezzanotte](https://github.com/Galiv04/dnd-corona-di-mezzanotte) — fantasy, il primo della serie
- [Galiv04/relais-lord-gregorio](https://github.com/Galiv04/relais-lord-gregorio) — horror gotico
- [Galiv04/casa-che-non-finisce](https://github.com/Galiv04/casa-che-non-finisce) — horror hardcore, il motore più stabile e completo
- [Galiv04/effetto-zoom](https://github.com/Galiv04/effetto-zoom) — psichedelico

## Come si aggiorna

Quando un gioco migliora il motore (una funzione nuova in `engine.js`, un fix in `combat.js`,
un test in più in `validate.mjs`...), il miglioramento **generico** si porta QUI — non resta
intrappolato nel repo del gioco che l'ha inventato — e si documenta una riga in
[`docs/LESSONS-LEARNED.md`](docs/LESSONS-LEARNED.md) con la data e il gioco di provenienza.

## Regola d'oro

**I giochi COPIANO i file di questo repo, non li importano.** Non c'è build, non c'è un
package manager, non c'è un link simbolico: ogni gioco è un sito statico autonomo, apribile
anche da `file://`. Aggiornare il motore in un gioco non aggiorna automaticamente gli altri:
va fatto a mano, gioco per gioco, quando serve davvero.
