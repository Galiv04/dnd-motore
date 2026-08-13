# Linee guida di design — Giochi D&D interattivi

Regole di design estratte dal feedback di produzione (agosto 2026).
Da consultare a inizio progettazione di ogni nuovo gioco e durante le revisioni di qualità.

## Effetti visivi

- Gli effetti sul testo (wobble, pulsazioni, distorsioni) sono **idee buone ma fastidiose a lungo andare**. Limitarli a momenti specifici di picco, mai per intere sezioni di gioco.
- **Varietà**: non un solo effetto ripetuto — alternare: saturazione colori, respiro del canvas, distorsione geometrica, tracers, glitch, cambio palette. Ogni effetto deve avere un significato narrativo.
- **Intensità progressiva**: partire sottili e crescere. Il giocatore deve notare che "qualcosa è cambiato" senza essere infastidito.
- Rispettare sempre `prefers-reduced-motion`.

## Esplorazione e mappa

- I giochi non devono essere solo "scene e scelte". Servono **mappe esplorabili** con spostamenti, oggetti nascosti, aree segrete.
- Ogni location della mappa dovrebbe avere almeno un **segreto scopribile** (oggetto nascosto, passaggio, dialogo opzionale che sblocca qualcosa).
- Le scene devono variare nel tipo: narrativa pura (leggi e avanti), esplorazione (cerca e trova), dialogo (scelte relazionali), puzzle (logica/deduzione), combattimento, prova di abilità.
- **Backtracking significativo**: tornare in un luogo già visitato deve rivelare qualcosa di nuovo (se un flag è cambiato, se si ha un oggetto, se l'ora/fase è avanzata).

## Oggetti

- Ogni gioco deve avere **almeno 15-20 oggetti** tra equipaggiamento, consumabili, chiavi, e oggetti narrativi.
- Oggetti nascosti: almeno il 30% degli oggetti non deve essere sulla strada principale — richiede esplorazione, scelta, o prova per trovarli.
- **Oggetti in combattimento**: ogni consumabile deve avere un uso tattico distinto (cura, danno, stordimento, buff, debuff). Non basta "cura X PV".
- **Echi degli oggetti**: trovare un oggetto deve influenzare scene future (dialoghi, scelte sbloccate, reazioni dei personaggi, finali).

## Combattimento e strategia

- Il combattimento base (attacco vs CA) è il pavimento, non il soffitto. Ogni scontro deve avere almeno **una decisione tattica** oltre "chi attacco".
- **Abilità speciali devono servire**: se il giocatore non usa mai le abilità speciali, il bilanciamento è sbagliato. Le abilità devono essere necessarie per vincere, non opzionali.
- **Varietà di nemici**: non basta cambiare nome e PV. Ogni tipo di nemico deve avere un comportamento distinto che richiede una risposta tattica diversa (AI diversa, immunità, debolezze, pattern di attacco).
- **Oggetti in combattimento**: il giocatore deve poter usare oggetti trovati durante l'esplorazione anche in battaglia. Gli oggetti combat devono avere effetti unici (non solo danno).
- **Scaling di difficoltà reale**: "incubo" deve essere davvero duro — non solo +PV ai nemici, ma pattern diversi, attacchi aggiuntivi, meccaniche esclusive.

## Scelte e ramificazione

- Le scelte non devono essere obbligatoriamente 2 per scena. Meglio: scene narrative senza scelta, seguite da nodi con 3-4+ opzioni significative.
- **Ogni scelta deve avere un costo o un rischio**: non "porta A o porta B dove entrambe vanno bene". Almeno una opzione deve avere una conseguenza negativa possibile.
- **Varietà strutturale**: scelte morali (chi sacrifichi), scelte tattiche (rischio/sicurezza), scelte di esplorazione (dove vai), scelte relazionali (con chi parli), scelte a tempo (il gioco avanza).
- I corridoi (scene con una sola uscita) sono accettabili SOLO se hanno un effetto meccanico (heal, item, flag, danno, prova).

## Difficoltà

- La difficoltà "normale" deve essere una sfida vera: il giocatore deve rischiare di perdere almeno 2-3 volte per partita.
- Le abilità speciali (usi limitati) devono essere **necessarie** per superare certi scontri — se il giocatore vince sempre con l'attacco base, il bilanciamento è rotto.
- **Porzioni ridotte**: giocare da soli deve essere più duro, non solo "nemici con meno PV".

## Standard di qualità target

Il livello target è **gioco professionale da vendita**. Ogni aspetto — testi, grafica, suoni, scelte, meccaniche, bilanciamento — deve reggere il confronto con giochi indie pubblicati. "Funziona e i test passano" è il punto di partenza, non il traguardo.
