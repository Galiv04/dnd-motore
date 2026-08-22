# MINIGIOCHI.md — Varietà oltre i dadi e i combattimenti

> Nato dal feedback post-partita del Relais (agosto 2026): "c'è poca varietà — sarebbe bello
> vedere giochi di astuzia, minigiochi, indovinelli, giochi interattivi coi personaggini,
> calcoli, filastrocche". Questo documento definisce il modulo riusabile `js/minigames.js`
> e le regole per usarlo bene in TUTTI i giochi della serie.

## Principi (dalla ricerca + esperienza al tavolo)

1. **Ancorati alla storia**: un minigioco non è una pausa dal gioco — È il gioco. La corsa a
   ostacoli esiste perché il corridoio si sta accorciando; l'indovinello perché la porta lo
   chiede; il ritmo perché il grammofono del '24 pretende il tempo giusto. Mai minigiochi
   "perché sì".
2. **Regole spiegate rompendo la quarta parete**: come per gli skill challenge di D&D, un
   riquadro "🎮 COME SI GIOCA" prima di iniziare. Il tavolo deve capire in 5 secondi.
3. **Un eroe alla volta, un set di comandi**: c'è UNO schermo. Il minigioco d'azione lo gioca
   un eroe scelto dal tavolo (come le prove); il resto del tavolo fa il tifo. I minigiochi di
   testa (indovinelli, calcolo) li gioca IL TAVOLO intero ad alta voce.
4. **Successo e fallimento entrambi interessanti**: il fallimento costa (PV, Sangue Freddo,
   una via chiusa) ma NON blocca la storia — pattern "X successi prima di X fallimenti" degli
   skill challenge. Sempre una via d'uscita.
5. **Ricompense piccole e concrete**: valuta, un oggetto, un vantaggio nel prossimo scontro
   (il modello Pazaak/hacking: micro-sfida → micro-ricompensa).
6. **Brevi**: 30-90 secondi di gioco attivo. La durata della serata viene dalla varietà,
   non dalla lunghezza di ogni pezzo.
7. **Accessibili**: tutto giocabile con tastiera+mouse/touch, un solo input per la corsa
   (salto). Rispettare `prefers-reduced-motion` (offrire la variante "narrata a dadi").

## Il modulo riusabile: `js/minigames.js`

API identica in tutti i giochi (il file si copia dal gioco più avanzato, come il motore):

```js
// nella scena:
mg1: {
  ...,
  minigame: {
    type: 'corsa' | 'indovinello' | 'memoria' | 'calcolo' | 'filastrocca',
    hero: null | 'natalino',      // null = sceglie il tavolo (solo per i type d'azione)
    success: 'scena_ok',          // dove si va vincendo
    fail: 'scena_ko',             // dove si va perdendo (MAI un vicolo cieco)
    config: { ... },              // parametri specifici del tipo (sotto)
  },
}
// il motore, in renderChoices: if (scene.minigame) Minigames.start(scene.minigame, G, gotoScene)
```

### Le firme REALI delle config (lette da `js/minigames.js`, agosto 2026)

> ⚠️ **Queste non si ricordano, si rileggono.** Ho scritto `config: { problema, risultato }` per il
> tipo `calcolo`, e in parallelo tre agenti hanno fatto lo stesso errore. Il modulo legge
> `{ domande: [...] }`: nessun errore a runtime, il minigioco parte **vuoto**, e te ne accorgi solo
> giocandoci. Il validatore di Pandataria ora ha una tabella `MG_SPEC` che **fallisce** su qualunque
> chiave di config che il modulo non legge — copiala nei validatori degli altri giochi.

| Tipo | Chi gioca | Comandi | Config reale |
|---|---|---|---|
| `apnea` | 1 eroe (Claudia) | TIENI PREMUTO = scendi, LASCI = risali | `{ titolo, profondita, oggetto, cosa, extra, extraFlag, cosaExtra }` — **non** `fiato`: viene dalla risorsa del gruppo |
| `corsa` | 1 eroe (sprite vero) | un tasto/tap = salto | `{ titolo, ostacoli, tema: 'siepi'\|'libri'\|'lavatrici'\|'tornanti', velocita, cielo, suolo }` |
| `indovinello` | il tavolo | una risposta sola | `{ titolo, testo, risposte: [{t, ok: true}, {t}, …] }` |
| `memoria` | 1 eroe o tavolo | ripetere la sequenza | `{ titolo, lunghezza, simboli: ['🔦','🚪',…] }` |
| `calcolo` | il tavolo | scelta multipla **a tempo**, serve 2/3 di giuste | `{ titolo, secondi, domande: [{ q, r: [{t, ok: true}, {t}] }] }` |
| `filastrocca` | il tavolo | completare il verso | `{ titolo, versi (con `___` per la lacuna, `\n` per andare a capo), risposte: [{t, ok: true}, …] }` |

Regole trasversali, verificate dal validatore:
- **Esattamente una** risposta con `ok: true` per domanda, e almeno due risposte.
- `minigame.hero` è un id di eroe esistente. Attenzione: `pickHero` restituisce l'eroe indicato
  **anche se morto** — se la morte è possibile a quel punto della storia, ometti `hero` e lascia
  scegliere il tavolo fra i vivi.
- **Una scena con `minigame` (o `combat`) ignora del tutto le sue `choices`**: l'engine mette il
  pulsante di gioco e fa `return`. Le scelte scritte lì sotto sono testo morto che nessuno vedrà, e
  gonfiano falsamente le metriche di densità. Metti `choices: []` e usa `minigame.tag` per la riga
  sotto il pulsante.
- Il `fail` **non è mai un vicolo cieco e non è mai un game over**: è una scena peggiore, scritta.
- Se il minigioco dipende da una risorsa (in Pandataria il Fiato è l'aria dell'apnea), il briefing
  deve dire **la verità** su cosa è raggiungibile con quello che il giocatore ha adesso: *«con questo
  fiato arrivate a 22 metri, e quella cosa sta a 34: non ce la fate»*. Un briefing che mente fa
  crollare tutta la meccanica, e va verificato nei test (Pandataria registra le `apneaBugie`).

### Contratto di rendering
- Ogni tipo disegna dentro `#minigame-overlay` (full screen, sopra la scena, stile pixel coerente).
- La `corsa` usa il canvas e `Sprites.registry[hero.sprite]` — i personaggini VERI che corrono.
- Sempre presente il riquadro "🎮 COME SI GIOCA" + bottone "▶ VIA" (niente inizi a sorpresa).
- `onDone(success)` → `gotoScene(success ? mg.success : mg.fail)`. Il fallimento può applicare
  `failDamage`/`goldLoss` da config.
- Un minigioco perso si può ritentare SOLO se la scena lo prevede (scelta esplicita), come i
  combattimenti col RETRY.

### Dove usarli (linee guida per scena)
- 1 minigioco ogni ~15-20 scene: sono spezie, non il piatto.
- Ogni gioco della serie dovrebbe averne 3-5, di ALMENO 3 tipi diversi.
- Il tipo deve nascere dal luogo: corsa = inseguimenti/corridoi; memoria = rituali/musica;
  indovinello = porte/guardiani; calcolo = contabili/registri; filastrocca = bambini/fantasmi/nonne.
- Temi per gioco: Relais (il Contabile e i conti del patto, il valzer del '24, la corsa tra le
  siepi del Giardiniere) · Casa (il telecomando/canali, le lavatrici dei giorni, i duelli già
  coperti dai Duelli di Parole) · Zoom (le geometrie da ripetere, il conto che non torna,
  la corsa dei tornanti del ritorno).

## Economia e checkpoint (regola di serie, stesso feedback)

1. **Checkpoint ai nodi**: completare un nodo/pista/atto = `fullHeal: true, recharge: true`
   sulla scena di completamento + riga nel testo: *"(NODO SCIOLTO — checkpoint: il gruppo
   recupera PV e mosse.)"* Il giocatore DEVE saperlo.
2. **La valuta si spende**: ogni gioco ha UN negozio rivisitabile (Casa: il Mercante; Relais:
   lo Spaccio del Contabile; futuri giochi: prevederlo dal design). Catalogo minimo: cura
   grande, cura del veleno/condizione, 1 oggetto da combattimento, 1 chicca narrativa.
3. **La valuta si guadagna**: combattimenti (loot), dialoghi riusciti, sidequest — ogni pista
   opzionale deve pagare in valuta oltre che in storia.
4. **Oggetti trovabili**: ogni zona esplorabile contiene ALMENO un consumabile (cura piccola
   o antidoto). Il totale per partita deve reggere: ~2 cure a testa + 2 antidoti di scorta.
5. **Difficoltà**: con checkpoint+negozio attivi, i combattimenti possono salire di ~10%
   (un +1 al tiro nemico su 'normale' O +15% PV nemici — MAI entrambi). Rimisurare col
   validatore di bilanciamento dopo ogni ritocco.

## Fonti
- Sly Flourish / Kobold Press / Flutes Loot sugli skill challenge 5e (struttura X-successi,
  varietà di approcci, stakes chiari)
- Game Developer / GameDesignSkills sui minigiochi che funzionano (Pazaak, hacking:
  micro-sfida → micro-ricompensa, integrazione col plot, limiti di tempo)
