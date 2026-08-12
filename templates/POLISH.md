# PASSATA DI RIFINITURA — densità di azione (non lunghezza)

Regola del committente, ripetuta a ogni gioco:

> **I testi non devono essere prolissi o stancanti. La "lunghezza" del gioco deve venire dalla
> VARIETÀ e dalla GIOCABILITÀ — scelte, azioni, dinamiche — non dal numero di parole per scena.**

## Diagnosi attuale (misurata dal motore con `tools/metriche.mjs`)

| Metrica | Ora | Obiettivo |
|---|---|---|
| Parole medie per scena | <<misura>> | **restare 150-260** (max assoluto 300) |
| Scene oltre 280 parole | <<misura>> | 0 |
| Scelte medie per scena | <<misura>> | **≥ 1.9** |
| Scene con UNA sola scelta (corridoi) | <<misura>> | **≤ 20%** |
| Prove di dado | <<misura>> | **~1 ogni 3 scene**, distribuite su tutte le statistiche |
| Scene con un effetto meccanico | <<misura>> | **≥ 80%** |

## Cosa fare, scena per scena

Per ogni scena che oggi ha **una sola scelta** ("avanti"), aggiungerne almeno una **vera**, scegliendo
tra questi tipi (variare! non ripetere sempre lo stesso schema):

1. **L'azione fisica con conseguenza**: un gesto concreto legato al tono del gioco, con un piccolo
   effetto meccanico (`heal`/`damage`/`gold`/`goldLoss`).
2. **Il gesto che muove la valuta del gioco**: un'azione rischiosa che alza o abbassa la risorsa
   speciale (`gold`), con un guadagno narrativo e un rischio.
3. **La prova di dado giusta per il momento**: scegli la statistica coerente con l'azione (FOR/DES/
   COS per il fisico, INT/SAG per capire, CAR per convincere). CD 10-11 facile, 12-13 media, 14 dura.
   **Il fallimento non blocca: devia** (e spesso costa qualcosa, non un vicolo cieco).
4. **La scelta di ruolo**: la stessa cosa fatta da un personaggio o da un altro, con esiti diversi
   (`requires: { hero: '<<id_personaggio>>' }`).
5. **La deviazione opzionale `once: true`**: un dettaglio da guardare, un oggetto da prendere, una
   micro-scena di due battute — che riporta alla scena principale.
6. **La scorciatoia**: "salta questa parte" per chi vuole andare avanti (rende il gioco rigiocabile
   senza rileggere tutto).

Regole di conservazione (NON negoziabili in questa passata):
- **NON allungare i testi.** Se aggiungi una scelta, il testo resta com'è o si ACCORCIA. Le scelte
  nuove non hanno bisogno di essere spiegate nel testo: si spiegano da sole.
- Non cambiare la trama, i finali, i flag esistenti né i loro consumatori.
- Aggiungere scene nuove solo se serve una destinazione per una prova (tenerle a 150-200 parole).
- Le scelte-aggancio nuove vanno **in coda** agli array `choices` esistenti.
- Rispettare i contratti del BRIEF: solo location, item, nemici e stinger dei cataloghi.
- Le regole di contenuto/etiche del BRIEF di questo gioco valgono sempre.
