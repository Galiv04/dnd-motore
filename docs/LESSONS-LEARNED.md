# Lezioni imparate — dalla creazione del primo gioco

Errori realmente commessi durante lo sviluppo di "La Corona di Mezzanotte" e come evitarli la prossima volta.

## Ambiente <a name="rete"></a>

**1. Su questa macchina localhost non funziona.**
I server HTTP locali si avviano ma ogni connessione a `127.0.0.1` va in timeout (filtro di rete), sia dal browser sia da `curl`. Sono stati persi ~20 minuti a diagnosticarlo.
→ **Prossima volta**: saltare direttamente il server locale. Si verifica con i **test headless in Node** e con il **sito live su GitHub Pages**.

**2. `git push` fallisce con "Could not resolve host: github.com".**
Il DNS del sistema non risolve `github.com` (ma `api.github.com` sì, e `gh` funziona).
→ **Soluzione permanente già applicata**: `git config http.curloptResolve "github.com:443:140.82.121.3"`. Se cambia l'IP: `nslookup github.com`.

**3. GitHub Pages serve gli asset dalla cache per ~10 minuti.**
Dopo un deploy il browser mostrava ancora la versione vecchia, facendo sembrare "non funzionante" un fix corretto.
→ **Prossima volta**: verificare prima con `curl` che il file sul server sia aggiornato, poi nel browser forzare `fetch(url, {cache:'reload'})` su tutti gli asset e ricaricare.

## Testing

**4. I test hanno ripagato immediatamente.**
`validate.mjs` (grafo delle scene, dati, sprite) ha trovato al primo colpo: un riferimento a una scena inesistente, 2 pixel fuori palette, una scelta irraggiungibile.
→ **Prossima volta**: scrivere il validatore del grafo **prima** di scrivere metà campagna. Costa un'ora, ne fa risparmiare molte.

**5. Il simulatore di partite complete è la rete di sicurezza vera.**
`playthrough.mjs` gioca 46 partite headless con stub del DOM e copre tutte le strade e i finali. Ha impedito più volte di pushare regressioni.
→ **Attenzione**: gli stub del DOM vanno progettati **generosi** (timer con coda vera, `parentElement`, `remove()`, `clientWidth`), altrimenti ogni nuova API del browser rompe il test.

**6. Le API del browser vanno protette.**
`performance.now()` e `requestAnimationFrame` hanno rotto tutte le simulazioni Node.
→ **Regola**: ogni API browser usata nel codice di gioco va dietro un `typeof X !== 'undefined'`.

**7. I test non vedono la grafica. È l'errore più costoso di tutti.**
Una regola CSS `.hidden` mancante lasciava il banner "COMBATTIMENTO!" sopra la scena: suite verde, gioco visivamente rotto. Peggio: per giorni **le chiome degli alberi sono rimaste staccate dai tronchi** (fluttuavano a mezz'aria) in metà delle ambientazioni, e nessun test se n'è accorto — l'ha trovato il committente giocando.
→ **Prossima volta**: costruire un **banco di prova visivo** che disegni ogni sfondo a piena dimensione su richiesta (qui: `Scenes.painters[nome]` su un canvas a tutto schermo) e passarli in rassegna **uno per uno** con uno screenshot, prima del rilascio e dopo ogni modifica grafica.

**7-bis. Le classi di bug grafico da cercare sempre.**
Dall'audit completo delle 15 ambientazioni:
- elementi **staccati o fluttuanti** rispetto a ciò che dovrebbe reggerli (chiome/tronchi, torce senza staffa, cartelli senza palo);
- elementi **nascosti dietro altri** (l'eclissi finiva dietro la torre del castello);
- **bande e rettangoli netti** dove serve un profilo naturale (le "colline" sembravano muri);
- **aloni squadrati** attorno alle fonti di luce;
- **coerenza tra testo e immagine**: se la scena dice "tre goblin con un cartello", devono esserci tre goblin e un cartello. Due segnalazioni su tre del committente erano di questo tipo.

**7-ter. Una funzione irraggiungibile dall'interfaccia è un bug, anche se il codice è giusto.**
I 3 slot di salvataggio funzionavano perfettamente ma non comparivano mai: con un solo salvataggio "Continua" caricava diretto, e "Nuova Avventura" sceglieva lo slot da sé.
→ **Regola**: per ogni funzionalità, verificare *il percorso con cui l'utente ci arriva*, non solo che funzioni.

## Codice

**8. Dati dichiarati ma mai letti = bug silenzioso.**
Le abilità dichiaravano `stat: 'SAG'` ma il combattimento usava sempre la statistica dell'arma: la Sacra Folgore di Brunilde era molto più debole del previsto.
→ **Prossima volta**: aggiungere al validatore un controllo "ogni campo dichiarato nei dati è consumato da qualche parte nel codice".

**9. Gli effetti "una volta sola" e le scene ripetibili non vanno d'accordo.**
Il gate `enteredScenes` bloccava `fullHeal` dalla seconda sconfitta in poi: il gruppo riprovava il boss senza cure, di fatto in una partita impossibile.
→ **Regola**: distinguere esplicitamente **effetti one-shot** (oggetti, oro) da **effetti di stato ripetibili** (cure, riposi).

**10. Le promesse nel testo sono contratti.**
Il manuale prometteva che le abilità si ricaricassero "nelle scene di riposo" — che non esistevano. Il testo prometteva "+1 Reputazione" da un flag che nessuno leggeva. Le torce erano acquistabili ma inutili.
→ **Regola**: se il testo promette una meccanica, o la si implementa o si cambia il testo. Nessuna eccezione.

**11. Un bottone "Indietro" può regalare un'azione extra.**
Nella seconda freccia di Kael il back rimetteva a disposizione l'intero menu: due azioni in un turno.
→ **Regola**: nelle azioni a più passi, il ritorno indietro va disabilitato dopo che una risorsa è stata spesa.

## Processo

**12. La delega in parallelo ha funzionato benissimo.**
Agenti separati per: simulatore di test, code review, scrittura del ramo del fiume, side-quest ed epiloghi. Il tempo di scrittura si è ridotto drasticamente.
→ **Prossima volta**: dare agli agenti **il formato dati esatto e il tono con esempi**, e chiedere output in un file di bozza separato (`drafts/`) da integrare a mano. Funziona molto meglio del farli scrivere direttamente nei file vivi.

**13. Chiedere prima, decidere dopo.**
Le 4 domande iniziali (multiplayer, lingua, tono, regole) hanno indirizzato l'intero progetto. Sono valse più di qualunque discussione successiva.

**14. "Fatto" è un giudizio del committente, non dello sviluppatore.**
Il gioco era "completo" almeno tre volte prima di esserlo davvero: mancavano audio, accessibilità, profili, varianti di trama.
→ **Prossima volta**: continuare a proporre migliorie finché non è il committente a dire basta.

## Contenuti

**15. Le scene si scrivono in blocchi tematici, non in ordine.**
Scrivere tutto un ramo (bosco, miniere, fiume) in una volta mantiene coerenti tono e ritmo molto meglio che procedere in sequenza.

**16. Il conteggio parole predice la durata.**
~180 parole = 1 minuto di lettura ad alta voce. Con 16.700 parole → ~90 minuti di sola lettura, che con discussioni, dadi e combattimenti diventano le **2-4 ore** promesse. Il validatore lo calcola automaticamente.

**17. Le scelte che cambiano la trama valgono più delle scene in più.**
Il ramo del fiume (19 scene) ha aggiunto meno rigiocabilità della "Tentazione della Corona" (3 scene) e delle Cronache di Lumelia, che fanno sentire ogni partita diversa.


## Dalla produzione del Relais di Lord Gregorio (agosto 2026)

**18. Ogni flag narrativo deve avere un consumatore.**
Un flag impostato e mai letto (meccanica, diario, impresa o cronaca) è una promessa non mantenuta: nel Relais ne sono emersi a decine (`ada_perdono`, `chef_allertato`, `menu_memoria`, `avviso_benzinaio`...), e OGNI volta trasformarli in echi ha prodotto le scene migliori del gioco. Ora un validatore statico lo impone.
→ **Prossima volta**: scrivere l'eco NELLO STESSO momento in cui si scrive il flag.

**19. I validatori di coerenza incrociata valgono più dei test funzionali.**
Le giunzioni tra moduli (flag↔scene, stinger↔suoni, sprite↔palette, capitoli↔scene) falliscono in silenzio, senza errori JavaScript. Quattro validatori da ~15 righe l'uno hanno intercettato più bug reali di qualunque playthrough.

**20. Il collaudo via UI trova ciò che l'headless non vede.**
156 partite simulate non hanno mai notato il contatore "0 / 6" (eroi hardcoded dalla Corona) perché il harness non passa dalla schermata di setup. Un solo giro coi click veri l'ha trovato subito.
→ **Prossima volta**: un giro UI completo (nuova partita → salvataggio → ripresa) fa parte della definizione di fatto.

**21. Sprite a risoluzione doppia senza toccare i call-site.**
Normalizzare `drawSprite` sulla griglia 16 (`px = scale * 16 / h`) permette mappe 32x32 con lo stesso ingombro: dettaglio quadruplicato, zero modifiche altrove. E uno sprite può riusare la mappa di un altro con palette diversa (Don Michele = Gregorio in tonaca: il papillon diventa il collarino).

**22. I numeri nei documenti invecchiano: usare soglie.**
"163 scene" era falso dopo due ondate. "Oltre 160 scene" resta vero a lungo — e i numeri si ricalcolano DAL MOTORE, mai a memoria (il conteggio manuale aveva già sbagliato due volte).

**23. La CI trasforma la disciplina in garanzia.**
"Test verdi prima di ogni push" come convenzione regge finché c'è una sola persona attenta. Una GitHub Action da 15 righe la rende strutturale, per sempre, per chiunque.

**24. La personalizzazione vera sta nei dettagli d'inventario.**
I dettagli veri delle persone vere — un rito di gruppo, una bevanda preferita, un'abitudine buffa, una sfida ricorrente — trasformati in oggetti e scene hanno reso il gioco "loro" più di qualunque ritratto. Chiedere al committente gli aneddoti minori: sono oro. (Gli esempi concreti restano nel repo del singolo gioco, dove è giusto che stiano.)

**25. I testi non devono contare il gruppo.**
"Sei intrusi in cucina", "sei eroi che salvarono il sole": veri solo col gruppo al completo. Con 2 giocatori stonano subito (segnalato da Gali in partita). Scrivere sempre neutro ("Intrusi in cucina", "gli eroi") o usare il conteggio dal motore.

**26. `once` non basta per i salvataggi esistenti.**
Una prova resa `once` DOPO che un giocatore l'ha già fatta ricompare comunque nel suo salvataggio (usedChoices non registrato all'epoca). Il fix retro-compatibile è il flag dell'esito: `requires: { notFlag: <flag_del_successo> }` in aggiunta al `once`.

**27. Le battute degli eroi vanno condizionate alla presenza.**
Con 2 giocatori su 6, "Zonk vuole andare a casa" detto da uno Zonk assente rompe l'incanto (segnalato in partita). Soluzione a due livelli: `[[eroe:id]]...[[/eroe]]` nei testi (il motore filtra) e `requires: { <id>_presente }` nelle scelte. Nel Relais il problema si è risolto a monte col framing: i cinque amici sono SEMPRE nella storia, si sceglie solo chi si gioca.

## Dalla produzione della Casa che non Finisce (agosto 2026)

**28. Gli stub del DOM tradiscono sulle differenze innerHTML/textContent.**
La modale di sacrificio creava il bottone "Riparliamone" con `textContent`, ma il rilevatore del
simulatore guardava solo `innerHTML`: la modale veniva scambiata per una normale prova e il test
"sacrificava" l'eroe sbagliato. → **Regola**: nei matcher dei test leggere SEMPRE
`innerHTML + textContent`, e nel motore essere consistenti su come si scrive il testo dei bottoni.

**29. La produzione a blocchi paralleli con brief regge benissimo.**
Cinque agenti-sceneggiatori su blocchi separati (con un BRIEF condiviso: formato dati esatto, tono
con esempi calibrati, grafo scena-per-scena, elenco chiuso di item/flag/uscite) più assemblaggio
meccanico (`assemble.mjs`) hanno prodotto ~28.500 parole coerenti in una sessione. I punti che
hanno evitato il caos: prefissi di scena riservati per blocco, uscite ammesse elencate nel brief,
"ogni flag dichiara il suo consumatore" nel commento di coda di ogni draft.

**30. I contenuti "gate" vanno garantiti nello zaino di partenza.**
Due scene distinte in punti diversi della campagna richiedevano lo stesso oggetto di un
mercante/rito d'inventario: se il giocatore non lo trovava prima, entrambi i contenuti
diventavano irraggiungibili. → **Regola**: per ogni scelta
`requires: { item }`, verificare che l'oggetto sia garantito (zaino iniziale o percorso obbligato),
non solo possibile.

**31. "Veloce" non è "completo": ricontrollare i prompt originali prima di dichiarare pronto.**
La Casa che non Finisce è stata prodotta in poche ore (motore ereditato + agenti in parallelo) e i
test erano tutti verdi — ma rileggendo le richieste originali mancavano DUE cose: la durata
promessa (~6 ore: una run visitava ~75 scene ≈ 4 ore) e la funzione "il gioco ti dice cosa manca
e in che capitolo, senza spoiler". I test verificano ciò che c'è, non ciò che è stato promesso.
→ **Regola**: prima di dichiarare pronto, checklist esplicita dei requisiti del committente presi
dai prompt originali, e stima della durata DAI DATI del playthrough (scene visitate per run ×
parole/scena ÷ 180), non a sensazione.

**32. La rigiocabilità va servita, non solo permessa.**
I capitoli rigiocabili non bastano: a fine partita il gioco deve DIRE quanto manca e dove
(percentuale di stanze viste per capitolo + imprese mancanti lì, senza spoiler), e offrire il
salto diretto al capitolo giusto. L'inferenza impresa→capitolo si fa dalla scena che ne imposta
il flag: zero manutenzione. Feature nata sulla Casa, da retro-applicare a ogni gioco della serie.

**33. Il gioco deve presentarsi: serve l'INCIPIT.**
Per tre giochi di fila si entrava in partita senza sapere dove si era: il titolo, i personaggi, e
via nella prima scena. Il committente l'ha segnalato dopo il terzo: manca "la prima parte del
README" dentro il gioco — dove siamo, che sta succedendo, cosa ci aspetta, senza spoiler.
→ **Regola per ogni gioco nuovo**: una schermata **📖 La Storia** raggiungibile dal titolo E
mostrata automaticamente all'inizio di una partita nuova, con quattro blocchi:
*dove siete* (setting e personaggi), *cosa sta succedendo* (l'evento scatenante), *cosa vi aspetta*
(la promessa: strade, tono, posta in gioco — mai i twist), *cosa serve al tavolo* (giocatori,
come si gioca, salvataggi, avvertenze sui contenuti). Circa 250-350 parole, nella voce del gioco.
Implementazione riusabile: costante `RULES_STORY` in js/rules.js + schermata gemella di
`screen-howto` + modale in `newGame` (attenzione: dove esiste già la modale del solitario, i due
contenuti vanno nella STESSA modale).

**34. Scene corte non bastano: contare le DECISIONI.**
Sull'Effetto Zoom la prima stesura aveva testi esemplari — 194 parole medie, zero scene oltre 280 —
ma 1,37 scelte per scena e 52 scene su 84 con un solo bottone "avanti": il gioco si LEGGEVA invece
di giocarsi. È esattamente il difetto che il committente segnala da sempre ("la lunghezza deve
stare nella varietà e nella giocabilità"), e la metrica delle parole non lo intercetta.
→ **Regola**: dopo la prima stesura, misurare con uno script sulla campagna assemblata scelte medie
per scena (≥1,9), percentuale di scene-corridoio (≤20%), prove di dado (~1 ogni 3 scene) e scene con
effetti meccanici (≥80%); poi fare la **passata di densità** (template `drafts/POLISH.md`), che
aggiunge scelte e prove SENZA allungare i testi. Da mettere in preventivo dall'inizio: è una fase
della pipeline, non un extra.

**35. Chi scrive su brief tende al corridoio.**
Gli agenti-sceneggiatori, se il grafo dell'incarico dice "A → B", scrivono esattamente una scelta
per scena: il grafo che gli dai è il tetto della loro interattività, non il pavimento.
→ **Prossima volta**: nel brief chiedere ESPLICITAMENTE un minimo di 2 scelte per scena (di cui
almeno una con conseguenza meccanica) e una prova di dado ogni tre scene, e mettere le soglie di
densità nel testo dell'incarico.

**36. L'ordine di disegno è un bug invisibile ai test.**
Nel Capovolto dell'Effetto Zoom le geometrie e le linee di fuga erano disegnate PRIMA del suolo:
finivano coperte, e la scena madre dell'atto sembrava un blob viola vuoto. Stessa famiglia: un
`ground()` che copriva 60px invece di tutto il canvas lasciava un buco dietro la ringhiera in
quattro ambientazioni, e un riempimento di piastrelle con un gap da 1px faceva trapelare lo
sfondo della scena PRECEDENTE. Nessun test automatico vede niente di tutto questo.
→ **Regola**: nell'audit visivo controllare esplicitamente, oltre alle classi note (elementi
fluttuanti, bande nette, aloni squadrati), anche **l'ordine di disegno** (ciò che sta dietro va
disegnato prima) e la **copertura totale del canvas** (nessun pixel non dipinto: il canvas non
viene ripulito tra le scene, quindi un buco mostra la scena precedente). E fare l'audit a TUTTI
i livelli degli effetti dinamici (qui: trip 0 / 0.5 / 1): certi difetti si vedono solo a metà.


## Agosto 2026 — Le lezioni della campagna di correzioni (Relais/Casa/Zoom/Corona)

### Design delle scelte (LA lezione)
1. **Ogni scelta che promette contenuto DEVE consegnarlo in una scena dedicata.** Non solo i verbi di
   osservazione (osserva/leggi/ascolta): anche i GESTI EMOTIVI (abbracciare, stringere la mano,
   promettere, mostrare un oggetto a qualcuno, salutare una voce) — se il gioco imposta un flag,
   il momento contava, e il personaggio DEVE reagire. Un abbraccio che "continua e basta" è una
   promessa tradita (feedback diretto del committente).
2. **Scanner in due livelli**: (a) verbi di rivelazione + destinazione condivisa + soli effetti numerici;
   (b) QUALSIASI scelta con `sets:` e destinazione condivisa → sospetta finché non riclassificata come
   gesto auto-contenuto. Un gesto è auto-contenuto solo se l'ESITO è già nel testo della scelta
   ("La previsione n°49: 'Domani, alba. GARANTITA.'") — mai "chiedere X" senza la risposta.
3. Gli effetti devono avere senso diegetico: l'oro/valuta per valore materiale plausibile,
   la cura per gesti che ristorano. Niente `gold: 1` su "giurare il silenzio".

15. **`sets` sulla SCELTA scatta anche se la prova FALLISCE.** Il motore applica gli effetti della
    scelta prima di tirare il dado: un flag di scoperta messo sulla scelta fa dichiarare al diario
    conoscenze mai acquisite. I flag di ESITO vanno sulla scena di successo, non sulla scelta.
    Scan: scelte con `sets` + `check` con `success !== fail`.
16. **`heal`/`damage`/`goldLoss` sulle scelte non esistevano nei motori** (solo `gold`, `item`,
    `removeItem`, `sets`, `rep`): 91 scelte nei quattro giochi dichiaravano effetti muti. Aggiunti
    in `resolveChoice` con la stessa semantica delle scene. Regola generale: **se una chiave di dati
    non è implementata, è una bugia al lettore del codice** — quando si inventa un campo, si aggiunge
    subito al motore E al validatore.

### Pipeline e strumenti
4. **Batch di modifiche via script**: confini di scena ANCORATI (`^  id: \{` ... `^  \},` multiline),
   MAI `.*?` fino a un marcatore generico (sconfina nella scena dopo); gestire ENTRAMBI i formati di
   choices (multilinea e inline); VERIFICA PER-SCENA dopo ogni replace (il testo inserito deve stare
   dentro il blocco della scena); scrivere il file SOLO se tutte le asserzioni passano.
5. **Mai mascherare gli exit code con le pipe**: `node tests/... | tail` ritorna l'exit di tail.
   Test standalone, poi commit. (Un push è partito con un validatore rosso per questo.)
6. **La suite è fragile ai seed**: aggiungere scelte sposta il flusso random del bot → gli scenari
   che dipendevano dalla fortuna del seed divergono. Cura: scenari DETERMINISTICI (forced choices,
   sequences) per i percorsi che i verify richiedono; `TEST_FILTER`/`TEST_DUMP` nel harness per il
   debug mirato; diagnostica del LOOP INFINITO che stampa le scene più visitate.
7. **Le scelte forzate del bot possono loopare** (z1<->z_smemorati x979): mai forzare su una scena
   rivisitabile una scelta che ci ritorna; rete di sicurezza dopo N usi.
8. **`once` sulle porte dei contenuti = soft-lock**: se un duello/stanza si può "sospendere",
   la porta deve chiudersi sulla VITTORIA (`requires: { notFlag: vinto }`), non sul primo ingresso.
9. **requestAnimationFrame è sospeso a pagina nascosta**: ogni loop canvas ha bisogno del fallback
   a timer (watchdog 500ms) o si congela in test/embed.
10. **Cache di Pages e del browser**: dopo il deploy servono ~10' + un hard-refresh (Cmd+Shift+R);
    la verifica live si fa con fetch {cache:'reload'} + reload.
11. **I numeri del bilanciamento non si ritoccano alla cieca**: un +12% PV applicato ANCHE ai boss
    (già tarati al limite) ha reso lo scontro finale un muro. I buff di difficoltà si applicano
    ai nemici normali, i boss si ritoccano singolarmente.
12. **Ogni gioco della serie condivide i moduli** (minigames.js, pattern del motore): si sviluppa nel
    repo più avanzato e si SINCRONIZZANO le copie nello stesso giro di push.
13. **Geografia e nomi reali** (richiesta committente): itinerari veri verificabili (Minturno → A16 →
    Passo di Mirabella → Fontanarosa → Paternopoli); le distanze devono reggere (un "bar a due ore
    a piedi" deve stare a due ore a piedi).
14. **Revisione periodica con agenti paralleli**: un revisore per gioco con le regole di qualità nel
    prompt trova ciò che gli scanner non vedono (guardie [[eroe:]] mancanti, promesse di flag mai
    consumate nei finali, incoerenze di continuità).

---

## Agosto 2026 — seconda tornata: le risorse decorative

Feedback del committente dopo aver giocato, parola per parola:

> «Non mi convince questa valuta del fiato, così come quella della lucidità o della fattanza, perché
> alla fine non sono davvero utilizzate nel gioco, **non fanno nulla**. Se sono utili e hanno un
> effetto di qualche tipo, usiamole, altrimenti no: teniamo i punti vita, gli stati tipo avvelenato,
> i potenziamenti, e la morte che si recupera con gli oggetti trovati o craftati. E se muoiono tutti,
> si riparte da un checkpoint. Fatto bene, veramente giocabile.»

### 15. Se una risorsa non ha effetti visibili, non esiste — e il conto lo dice subito

La misura è banale e va fatta **prima** di scrivere le scene, non dopo:

```bash
grep -c "gold: "        js/campaign.js   # quante volte la DAI
grep -c "requiresGold"  js/campaign.js   # quante volte la fai SPENDERE
```

I numeri dei quattro giochi al momento del feedback:

| gioco | valuta | la dà | la spende | verdetto |
|---|---|---|---|---|
| relais | 🕯 Sangue Freddo | 212 | 4 | decorativa |
| casa | 🎨 Colore | 174 | 7 | decorativa |
| zoom | 🍄 Fattanza | 48 | 4 | un effetto reale, mai spiegato |
| corona | 💰 monete | 53 | 20 | sana (c'è un mercante) |

**Regola**: il rapporto dare/spendere sta sotto 6:1, altrimenti il tetto si satura entro il primo
atto e il numero smette di significare qualcosa. Una risorsa che si satura è peggio di nessuna
risorsa, perché occupa spazio nella HUD e insegna al giocatore che i numeri lì non contano.

### 16. Una risorsa vera fa UNA cosa, e il gioco la dice dentro il gioco

In Pandataria il Fiato è stato riscritto così: **non compra niente, non c'è negozio**. È l'aria dei
minigiochi d'apnea. `Engine.apneaFiato()` lo traduce in aria, `Engine.metriPossibili()` in metri
raggiungibili, e il briefing dell'immersione scrive in chiaro:

> «Con il fiato che avete adesso (68) arrivate a circa **22 metri** — e quella cosa sta a 34.
> **Non ce la fate.** Andate a mangiare, a dormire, o riparate la bombola, e tornate.»

Questo è il test: **il giocatore capisce a cosa serve la risorsa senza leggere i doc?** Se la
risposta è no, la risorsa non è progettata, è decorata. La HUD dell'inventario deve contenere la
spiegazione, non un numero.

Corollario: si guadagna **solo con le cose umane** (mangiare, dormire, ridere, stare fermi un
momento con l'altro), mai combattendo per combattere. Così l'economia insegna il tema del gioco
invece di contraddirlo.

### 17. I potenziamenti sono OGGETTI, e il log deve nominare l'effetto quando scatta

Niente livelli, niente punti da spendere. Si diventa più forti solo trovando e combinando cose, e
**ogni oggetto craftato ha un effetto che il log del combattimento nomina per esteso**:

```
💍 Le due fedi, legate con la lenza, battono l'una contro l'altra nella tasca: +2 PV a tutti.
📿 Duemila anni e la riconosce ancora: -10 PV, e smette di succhiare vita agli altri.
```

Un bonus che si applica in silenzio è indistinguibile da un bonus che non c'è. Stesso discorso per
i **misteri risolti**: il premio deve avere un effetto meccanico e una riga di log. Il validatore
ora fallisce se il flag-premio di un mistero non è usato da nessuna parte (`usi < 2`).

### 18. Morire non è un game over: si riparte dal checkpoint

`Engine.riprendiDaCheckpoint()`. Nell'ordine:

1. Se il gruppo ha l'oggetto che **paga la morte** (in Pandataria l'Àncora di Voce), si consuma e
   lo scontro riprende a metà PV. È l'unico modo in cui la morte si annulla, ed è un oggetto che il
   giocatore ha costruito con le sue mani.
2. Altrimenti si torna all'ultimo checkpoint con lo **snapshot di allora** — party, zaino, flag,
   risorsa, ricette — salvato quando il checkpoint è scattato. Quello che avevi capito dopo l'hai
   perso, e **la modale te lo dice per nome**: *«Vi manca: la collana di Giulia, il registratore.»*
3. Solo se non esiste nessun checkpoint (morire nel primo atto) si va al game over vero.

Lo snapshot va preso **dentro il blocco dei `CHECKPOINT_FLAGS`**, con `JSON.stringify`, non
ricostruito dopo. E la modale del ritorno è una scena vera, scritta: in Pandataria ci si risveglia
asciutti alle Paracine, e l'essere asciutti è la parte peggiore.

### 19. Le firme delle config dei minigiochi si LEGGONO, non si ricordano

Errore commesso di nuovo, stavolta da me e in parallelo da tre agenti: scrivere
`config: { problema, risultato }` per il minigioco `calcolo`, che in realtà legge
`config: { titolo, secondi, domande: [{ q, r: [{t, ok}] }] }`. Nessun errore a runtime: il
minigioco parte **vuoto**. Le firme reali stanno in `js/minigames.js` e vanno rilette ogni volta.

Cura strutturale, ora nel validatore di Pandataria: `MG_SPEC` elenca per ogni tipo di minigioco le
chiavi ammesse e quelle obbligatorie, e il test **fallisce su qualunque chiave di config che il
modulo non legge**. Stessa medicina applicata a tutte le chiavi di scena e di scelta
(`CHIAVI_SCENA`, `CHIAVI_SCELTA`, `CHIAVI_REQUIRES`), con la controprova inversa: se la whitelist
ammette `scene.X` ma il motore non contiene `scene.X`, esce un warning.

### 20. Una scena con `minigame` o `combat` IGNORA le sue `choices`

L'engine mette il pulsante di gioco e fa `return`. Le scelte scritte lì sotto sono testo morto che
nessuno vedrà mai — e gonfiano le metriche di densità dando l'illusione che il gioco sia più ramificato
di quanto sia. Va messo `choices: []` e usato `minigame.tag` per la riga sotto il pulsante. Il
validatore ora lo controlla.

### 21. I metadati delle repo su GitHub sono parte del prodotto, e vanno allineati

Segnalazione del committente: *«la descrizione e i temi delle repo su GitHub non sono allineate»*.
Aveva ragione — allo stato del 22 agosto 2026: due giochi su quattro avevano la descrizione **vuota**,
nessuna repo aveva **un solo topic**, e **nessuna** aveva l'URL di GitHub Pages nel campo *Website*,
pur avendo tutte le Pages pubblicate e funzionanti. Chi arrivava sul profilo vedeva quattro cartelle
anonime e non un link per giocare.

**La repo è la vetrina.** Il gioco più bello del mondo, con la descrizione vuota, è una cartella.

Checklist da eseguire **a ogni nuovo gioco e a ogni cambio di titolo o di numero di finali**:

```bash
gh repo edit Galiv04/<repo> \
  --description "<emoji> <Titolo> — <genere> interattivo in italiano per N giocatori: <gancio in una riga>. <N> finali. Giocabile nel browser, zero installazioni." \
  --homepage "https://galiv04.github.io/<repo>/" \
  --add-topic gioco-italiano --add-topic avventura-testuale --add-topic interactive-fiction \
  --add-topic vanilla-javascript --add-topic github-pages --add-topic zero-dependencies \
  --add-topic dungeons-and-dragons --add-topic <genere-specifico>
```

Formato della descrizione, identico per tutta la serie: **emoji · titolo · genere e lingua · numero
di giocatori · un gancio di una riga · numero di finali · «Giocabile nel browser, zero installazioni»**.

Topic: i sei comuni della serie (`gioco-italiano`, `avventura-testuale`, `interactive-fiction`,
`vanilla-javascript`, `github-pages`, `zero-dependencies`), più `dungeons-and-dragons`, più uno
specifico del genere (`horror`, `fantasy`, `psichedelico`, …). Il repo del motore non porta
`github-pages` (non ha un sito) e prende `game-engine` e `documentation`.

**I numeri nella descrizione devono essere veri**, e si verificano, non si ricordano:

```bash
grep -c "ending:" js/campaign.js              # quanti finali
grep -oE 'class="game-subtitle">[^<]*' index.html   # quanti giocatori, com'è scritto nel gioco
```

La descrizione della repo, il `<title>`, il `<meta name="description">`, la `game-subtitle` sulla
schermata del titolo e il README **devono raccontare la stessa cosa con gli stessi numeri**. Se il
gioco guadagna un finale, si aggiornano tutti e cinque nello stesso giro.

Verifica finale, da fare sempre dopo le modifiche (i comandi `gh repo edit` non danno conferma utile):

```bash
gh repo list --limit 30 --json name,description,repositoryTopics,homepageUrl
```

### 22. Un checkpoint senza via d'uscita è un loop, non una difficoltà

Conseguenza diretta della lezione 18. Implementata la ripartenza dal checkpoint, la prima partita
simulata **non è finita più**: gruppo troppo debole → sconfitta → ritorno al checkpoint → stessa
strada → stessa sconfitta, per sempre. Non un game over e non una vittoria: un rimbalzo.

Tre pezzi, tutti necessari:

1. **Pietà progressiva.** Ogni ritorno dal checkpoint toglie il 12% delle forze a chi vi ha ucciso
   (fino a un terzo), e il log del combattimento **lo dice**: *«Anche loro sono stanchi: siete già
   tornati due volte, e rifarvi da capo costa fatica anche al Coro.»* Il gioco cede, non il giocatore.
2. **Una via d'uscita esplicita.** Dal terzo ritorno la modale offre un secondo bottone: andarsene
   adesso, che porta a un **finale vero** (quello in cui si esce vivi senza aver capito), non a una
   schermata di resa. *«Andarsene adesso è una fine vera, non una resa.»*
3. **Una guardia nel test.** `if (G.stats.checkpointRitorni > 4) throw` con un messaggio che nomina
   il problema. Senza, un loop di checkpoint non si presenta come errore: si presenta come una suite
   lenta, e la si scambia per un problema di prestazioni.

### 23. I boss si tarano sul party che il giocatore ha davvero, non sul caso migliore

Rifacimento della lezione 11. La stima di bilanciamento usava il **party pieno** (tre eroi): i boss
sembravano giusti a 5-6 round. Ma il terzo eroe si unisce solo il terzo giorno e può non essere
nello scontro, quindi il caso reale è **due**, e a due gli stessi boss diventavano da 14 round. Un
boss da 14 round non è difficile: è noioso.

Il validatore ora stampa entrambi i numeri e **fallisce** (non avvisa) sopra gli 11 round per due
giocatori:

```
ℹ boss "IL CORO": 170 PV → ~10 round in DUE, ~6 col terzo
```

Regola: 4-10 round per il party minimo realistico. Sotto i 4 non è un boss, sopra i 10 è una
maratona. E gli oggetti craftati e i misteri risolti devono accorciarlo **visibilmente** — il che
è anche il modo in cui il giocatore scopre che servivano.

### 24. Il finto DOM dei test va tenuto al passo col motore

`document.documentElement.style.setProperty('--prof', …)`: una riga nuova nel motore (la profondità
pilotata via variabile CSS) e tutte e tredici le partite simulate sono morte con
`Cannot read properties of undefined (reading 'style')` — dentro `Engine.newGame`, prima della prima
scena. Il finto documento non aveva un `documentElement`.

Corollari raccolti nello stesso giro:
- **Un `fail()` dentro un'invariante chiamata a ogni passo stampa migliaia di righe** e la suite
  sembra bloccata. Le invarianti che descrivono uno *stato* vanno segnalate **una volta per run**
  (un `Set` di ciò che si è già detto), non a ogni passo.
- `execute()` stampava solo `error.split('\n')[0]`: il messaggio senza lo stack. Mezz'ora buttata a
  indovinare da dove venisse un `reading 'usable'`. Stampare le prime 4-5 righe di stack **e** la
  scena corrente (`sceneId` + le ultime scene attraversate) è la differenza tra un minuto e un'ora.
- Un id nello zaino che non esiste in `ITEMS` fa esplodere ogni `ITEMS[it].qualcosa`. Due difese:
  le letture in combattimento diventano `ITEMS[it] && ITEMS[it].x`, e un'invariante di test che
  **nomina** l'oggetto sconosciuto.
- **Non testare una combinazione non vincibile come se lo fosse**: "un eroe solo + difficoltà
  massima" non è una configurazione da vincere. Le due dimensioni si provano separate — solitario
  in facile, difficoltà massima in due.

### 25. Un id del DOM sbagliato non dà errore: fa peggio

`showScreen('screen-scene')` in una funzione nuova del motore, con `index.html` che dichiara
`screen-game`. `getElementById` restituisce `null`, la riga non fa niente, **nessun errore** — e la
schermata di combattimento restava attiva. Risultato: dopo una sconfitta il gioco rimbalzava sullo
stesso scontro all'infinito. Ci sono voluti tre giri di test per capire che il problema non era il
bilanciamento dei boss ma **una stringa sbagliata di cinque caratteri**.

Nel validatore, adesso, due controlli distinti:

```js
// 1. ogni id usato dal codice esiste — in index.html O in un template JS
//    (le modali creano elementi a runtime dentro innerHTML: sono legittimi)
const idsDinamici = new Set([...jsTutti.matchAll(/id=["'`]?([a-zA-Z0-9_-]+)["'`]?[\s>]/g)].map(m => m[1]));

// 2. le SCHERMATE, invece, devono stare in index.html: una schermata non si crea a
//    runtime, e showScreen con un id sbagliato non fallisce, lascia attiva quella di prima
for (const m of jsTutti.matchAll(/showScreen\('([a-zA-Z0-9_-]+)'\)/g))
  if (!idsHtml.has(m[1])) fail(`showScreen('${m[1]}'): quella schermata non esiste`);
```

Al primo giro il controllo ha trovato **altri sei** id che sembravano fantasma e invece nascono
dentro l'innerHTML delle modali: la distinzione fra «creato a runtime» e «non esiste» è la parte
che fa la differenza fra un controllo utile e uno che urla al vento.

### 26. Il matcher dei test è case-sensitive, e i testi cominciano con la maiuscola

Uno scenario forzava la scelta con `'se la ricorda, la cosa che cantava'` mentre il bottone dice
`'🎶 "Signora Rosa. Se la ricorda, la cosa che cantava?"'`. `String.includes` è case-sensitive:
il match falliva, il bot prendeva una scelta a caso, e la copertura di quel ramo restava a zero
**senza nessun errore** — solo un `❌` su un flag mancante, tre sezioni più in basso.

Cura: nei matcher usare un frammento **interno** alla frase (mai la prima parola, che è quasi sempre
capitalizzata dopo l'emoji), oppure normalizzare il confronto. E quando un flag risulta mancante,
sospettare **prima** il matcher e poi il gioco.

### 27. Il numero che rende un boss invincibile è il DANNO, non i punti vita

Il caso peggiore del bilanciamento, e il più facile da diagnosticare male. In Pandataria i boss
avevano PV tarati per 6-9 turni, e sembrava giusto. Ma il danno era 11-15 medi contro eroi da 22-24
PV: **un eroe cadeva in due colpi**. Nessuna quantità di PV in più o in meno sistema quella
situazione — è invincibile per costruzione, e i test lo mostravano come «loop di checkpoint», cioè
come un problema di struttura, non di numeri.

Il conto che va nel validatore, e che vale per tutta la serie:

```js
const dannoMedio = n * (facce + 1) / 2 + (attack.plus || 0);
const pvMin = Math.min(...HEROES.map(h => h.maxHp));
const colpiRetti = Math.ceil(pvMin / dannoMedio);
if (colpiRetti < 3) fail(`boss "${k}": uccide l'eroe più fragile in ${colpiRetti} colpi ma servono ~${round} round per abbatterlo: matematicamente invincibile`);
```

Soglie: l'eroe più fragile deve reggere **almeno 3 colpi** (4-5 è la zona buona) e il boss deve
cadere in **4-10 round** per il party minimo realistico. Le due condizioni insieme, mai una sola.

Stesso conto per i nemici **normali**, che però arrivano in gruppo: due nemici da 6 danni sono 12 al
round, e un eroe da 22 PV cade in due turni. Il validatore somma il danno di tutti i nemici della
scena e avvisa quando supera metà dei PV dell'eroe più fragile.

E la conseguenza pratica: quando un test dice «il gruppo non ce la fa», la prima cosa da guardare
non è quanto vive il nemico, è **quanto vive l'eroe**.

### 28. La soglia sui «corridoi» era la metrica sbagliata, e spingeva a sbagliare

La regola della serie diceva: *corridoi ≤15%*, dove corridoio = scena con una sola scelta.
Misurandola sui cinque giochi, il verdetto sembrava brutto:

| gioco | scelte/scena | corridoi | scelte per NODO di decisione | corridoi STERILI |
|---|---|---|---|---|
| relais | 1,85 ✗ | 20,5% ✗ | **2,41** ✔ | **1** |
| casa | 1,83 ✗ | 27,0% ✗ | **2,47** ✔ | **6** |
| zoom | 2,09 ✗ | 12,8% ✔ | **2,61** ✔ | **0** |
| corona | 1,94 ✗ | 10,9% ✔ | **2,42** ✔ | **2** |
| pandataria | 2,39 ✔ | 5,2% ✔ | **2,96** ✔ | **0** |

Poi ho letto le scene. Dei 67 «corridoi» di Casa, quasi tutti sono **battute**: sotto-scene che
chiudono un momento — *«Diciassette. Non era un buon segno: era una FIRMA.»* — cioè esattamente
quello che la regola «scena 6-14 righe, se serve più spazio si spezza in due» chiede di fare.
Inseguire quel numero significa aggiungere seconde scelte finte alle battute: **il difetto che il
committente ha segnalato tre volte giocando.** La metrica spingeva verso il male che doveva impedire.

Le due misure che contano, ora in tutti e cinque i validatori:

1. **Scelte per NODO DI DECISIONE** — la media sulle sole scene con ≥2 scelte. Quando il gioco ti
   offre una scelta, quanto è ricca? Soglia **≥2.2**. Tutti i giochi stanno fra 2,4 e 3,0.
2. **CORRIDOI STERILI** — una sola uscita **e** nessun effetto: niente item, sets, check, cure,
   danni, valuta, combattimento, minigioco, finale. *Quelli* sono riempitivo. Soglia: 0, o
   pochissimi e giustificati.

Il numero grezzo di corridoi resta stampato, ma come informazione, non come voto.

**E il rimedio per un corridoio sterile non è una seconda scelta**: è dare alla scena l'effetto che
il suo testo già afferma. I sei di Casa chiudevano tutti dichiarando qualcosa di vero che il gioco
non ricordava — «Daniele ci ha risposto con le luci», «Daniele si era fatto la scorta di blu» — e
sono diventati sei flag con sei voci di diario. Zero scelte aggiunte, zero prosa toccata, e adesso
il gioco si ricorda quello che dice.

### 29. Una pipeline di draft scollata dal gioco è una mina innescata

In Casa `js/campaign.js` aveva **248 scene** e `drafts/` **184**: la pipeline era stata abbandonata
a metà e il file generato era diventato la fonte vera. `node tests/assemble.mjs`, il comando che il
CLAUDE.md di quel repo consiglia, avrebbe cancellato **64 scene in silenzio**.

Due cose, entrambe necessarie:

1. **Rigenerare i draft dal file vero**, e verificarlo nel solo modo che conta: riassemblare e
   confrontare **carattere per carattere** con l'originale. Se non è identico, il taglio è sbagliato
   (i miei primi confini sbagliavano di 19 caratteri: la riga `const CAMPAIGN = …` che l'assemble
   aggiunge da sé, e le righe vuote intorno).
2. **Una guardia nell'assemble**, in tutti i repo che ne hanno uno:

```js
const nNuovo = contaScene(nuovo), nVecchio = contaScene(vecchio);
if (vecchio && nNuovo < nVecchio) {
  console.error(`❌ RIFIUTO DI SCRIVERE: i draft producono ${nNuovo} scene, il file attuale ne ha ${nVecchio}.`);
  process.exit(1);
}
```

Regola generale: **uno strumento che può distruggere lavoro deve rifiutarsi di farlo**, non fidarsi
di chi lo lancia. E l'assemble ora stampa il conteggio delle scene, non solo i caratteri: un numero
di caratteri non dice niente, un numero di scene sì.

### 30. Uno sfondo sbagliato non dà errore: dà una scena che mente

La validazione visiva su Pages ha trovato, in mezz'ora, quattro cose che 33 controlli statici e 14
partite simulate non potevano vedere:

1. **Otto scene di fila con il fondale sbagliato.** Il cluster dell'orto dei Coraggio — pomodori, un
   fico, un cane, in pieno sole, alle 11:24 — usava `location: 'sotto'`, il painter sottomarino. Il
   testo raccontava un orto e il canvas mostrava una stanza allagata. Nessun errore, nessun avviso.
2. **La scena d'apertura disegnava il posto sbagliato.** Scauri, il lungomare di casa con la macchina
   parcheggiata male, usava `porto` — che in quel gioco è il porto romano di Ventotene, una parete di
   tufo scavata a picco. Due posti diversi a centoventi chilometri di distanza.
3. **Una scena sul traghetto tinta di blu profondo**: `metri: 40` su `location: 'traghetto'`, perché
   il primo paragrafo ricordava un'immersione. Il canvas si oscurava e si stringeva mentre la scena
   parlava del ponte di poppa alle 17:30.
4. **Un painter illeggibile**: `porto` disegnava un lastrone di tufo piatto su metà inquadratura, con
   le case del ciglio sepolte sotto la parete e i segni degli scalpelli invisibili a quell'alfa.
   In codice era ricchissimo; sullo schermo era un muro giallo.

I primi tre sono diventati controlli automatici (`Coerenza fra sfondo e didascalia`): un luogo
**chiuso** su una scena la cui **didascalia** dice che sei all'aperto è un FAIL; `metri > 0` su un
luogo che non è sott'acqua è un FAIL. Il confronto si fa sulla didascalia e non sul corpo del testo,
perché una scena può ricordare un altro posto senza sbagliare — e `cisterna_sigillata` resta lecita
con una didascalia «all'aperto», perché quel muro si guarda **da** un orto.

Il quarto no: quello lo trovano solo gli occhi. Il metodo che funziona, quando localhost è morto:
**si pubblica, e poi si guarda sul sito vero** — e per guardarli tutti insieme si inietta dal
browser una griglia che chiama ogni painter su un canvas 960×360 e li impagina in una tavola. A
miniatura si giudica la composizione; a dimensione vera si giudica il dettaglio. La `cella 47`
sembrava vuota nella miniatura e a 960 px aveva tutte e ottomilaquarantuno le tacche in gruppi di
cinque: **le due scale servono entrambe**.

### 31. Un indicatore fuori dallo schermo è un indicatore che non esiste

Il difetto più grave trovato guardando Pandataria sul sito vero, e il più invisibile ai test:
durante il minigioco dell'**apnea** la barra del fiato stava a **812 px** su una finestra alta
**720**. Fuori dallo schermo. Chi giocava non vedeva né quanto fiato gli restava né a che profondità
era — e senza quei due numeri l'apnea non è una meccanica, è un tasto da tenere premuto a caso.

La causa è banale e generale: `.minigame-canvas { width: 100% }` su un canvas 960×320 dentro un box
larga 1000 px lo rende alto **557 px**, e tutto quello che sta sotto (barra, HUD, bottoni) finisce
sotto la piega. Nessun test lo vede: il DOM è lì, i valori sono giusti, la partita simulata passa.

Due rimedi, entrambi necessari:

1. **I numeri che servono MENTRE giochi si disegnano dentro il canvas**, non sotto. Il canvas è
   l'unica cosa che sicuramente stai guardando. La HUD HTML resta, come ridondanza.
2. **`max-height` in vh sul canvas**, a scaglioni (`52vh`, poi `44vh` sotto 780 px di altezza,
   `38vh` sotto 620), con `object-fit: contain`. Larghezza al 100% senza un tetto in altezza è una
   trappola su qualunque finestra bassa — e i portatili sono finestre basse.

Regola generale, che vale oltre i minigiochi: **per ogni informazione che il giocatore deve leggere
mentre agisce, misurare `getBoundingClientRect().bottom <= innerHeight`.** È una riga di JavaScript
nel browser e trova in un secondo quello che nessun test statico può vedere.

### 32. La schermata che nessun test apre è quella che si rompe

`Engine.showHeroSheetIdx(1)` → `ReferenceError: conditions is not defined`. La scheda del
personaggio — quella che il committente aveva chiesto **espressamente** dopo aver giocato
(«siamo avvelenati ma se clicchi il personaggio non si vede e non dà info al riguardo») —
esplodeva a ogni click, in tre giochi su cinque, e il blocco delle condizioni non era mai stato
mostrato a nessuno.

La causa è una patch messa nel posto sbagliato: `const conditions = [...]` era finita **dentro** il
ciclo `h.abilities.map(...)`, dove nasceva e moriva a ogni abilità, mentre il template in fondo alla
funzione la cercava al livello della funzione. `node --check` passa (è JS valido), il validatore
passa (non esegue l'interfaccia), le partite simulate passano — **perché nessuna partita simulata
clicca su un eroe.**

Due lezioni dentro una:

1. **Quando si applica la stessa patch a N repo, si verifica in N repo.** Qui il primo (relais) era
   giusto e i tre successivi no: il punto d'inserzione dello script cadeva dentro una closure.
   Un `node --check` non basta: serve *eseguire* la funzione toccata.
2. **Ogni schermata che il giocatore può aprire deve avere una prova che la apre.** La prova aggiunta
   ora in tutti e cinque i giochi apre la scheda di ogni eroe in **otto combinazioni di stati** e
   verifica che l'HTML non esploda, non sia vuoto, non contenga `undefined`/`NaN`, e che ogni stato
   produca il blocco «Condizioni attive». Costa venti righe e copre la classe di bug che i test di
   percorso non possono vedere per costruzione.

Corollario da applicare subito: le altre modali (zaino, crafting, Quaderno, mappa, bestiario,
diario, menu) meritano la stessa prova. Se una schermata si apre con un click, un test deve cliccarla.

### 33. `justify-content: center` su un flex che sfora spinge il contenuto fuori dallo scroll

Segnalazione del committente, in cinque parole: *«la schermata iniziale del gioco è tutta sbagliata
e a sinistra»*. Guardando, non era spostata a sinistra: era **spostata in alto e non raggiungibile**.

`#screen-title.active { justify-content: center }` su un contenitore `min-height: 100vh` centra il
contenuto verticalmente — ma quando il contenuto è **più alto** dello schermo, il centraggio lo
spinge sopra l'origine dello scroll, dove non si può scorrere. Il risultato: un rettangolo vuoto in
cima alla pagina e mezzo titolo tagliato. È un comportamento noto dei flexbox e succedeva su tutti
e cinque i giochi; con l'incipit aggiunto (che alza il contenuto) si vedeva ancora meglio.

```css
#screen-title.active {
  justify-content: safe center;   /* centra se c'è spazio, flex-start se non c'è */
  padding-block: 18px;
}
@supports not (justify-content: safe center) {
  #screen-title.active { justify-content: flex-start; }
}
```

Due regole che ne seguono, per qualunque schermata:

1. **Il pulsante principale sta sopra la piega, sempre.** Si verifica in una riga:
   `document.getElementById('btn-new-game').getBoundingClientRect().bottom <= innerHeight`.
   Con l'incipit sopra i bottoni, in Pandataria quel bottone stava a 943 px su una finestra alta
   720: l'incipit è finito **sotto** i bottoni, dove non copre la porta d'ingresso.
2. **Le misure prese col pannello del browser nascosto sono spazzatura**: `innerWidth`/`innerHeight`
   tornano 0 e ogni `getBoundingClientRect` mente. Prima di misurare, portare la scheda in primo
   piano — o si passa mezz'ora a inseguire difetti che non esistono (mi è capitato due volte).

### 34. La pietà progressiva non è gentilezza: è l'unica cosa che chiude il loop

Estensione della lezione 22 a tutta la serie, trovata leggendo la diagnostica di una suite lenta.
Nelle partite simulate del Relais il bot visitava lo stesso boss **225 volte** in una singola run
(`z3_boss×225`, `h1×362`), fino a esaurire la guardia dei 2000 passi. L'implementazione del ritorno
al checkpoint era **migliore** della mia (una scelta vera nella scena di sconfitta, offerta dalla
seconda caduta, non una modale) — e proprio per questo il loop era perfetto: il bot la cliccava,
tornava, ripercorreva la strada, perdeva di nuovo, per sempre.

Il ritorno al checkpoint, da solo, non basta. Servono **tre pezzi**:

1. **La ripartenza** (lezione 18).
2. **La pietà progressiva**: ogni ritorno toglie il 12% dei PV e −1/−2 ai colpi di chi ti ha steso,
   fino a un terzo. E il log del combattimento **lo dice**: *«siete già tornati indietro due volte,
   e chi vi ha steso è più stanco di allora (−24% PV e ai suoi colpi)»*. Il gioco cede, non il
   giocatore — e il giocatore lo vede cedere, che è metà del regalo.
3. **Una via d'uscita esplicita** dopo N ritorni, che porti a un **finale vero** e non a una resa.

E nel test, la guardia che lo nomina:

```js
if (Gc.stats.checkpointRitorni > 4) throw new Error(`LOOP DI CHECKPOINT: ${n} ritorni — il gruppo non supera questo scontro e il gioco non offre una via d'uscita`);
```

Senza quella riga il sintomo non è «errore»: è **«la suite è lenta»**, e si perde mezz'ora a
ottimizzare i test invece di sistemare il gioco. Il conteggio dei ritorni è il termometro giusto:
se sale sopra 3 in una partita pilotata, il problema è il bilanciamento, non il bot.

### 35. Il difetto era in TUTTI E CINQUE i giochi, e nessuno l'aveva mai misurato

Seguito della 27 e della 34, e la scoperta più larga di questa tornata. Il controllo scritto per
Pandataria («l'eroe più fragile deve reggere almeno 3 colpi») è stato portato negli altri quattro
validatori, e il risultato è stato uguale in tutti:

| gioco | eroe più fragile | boss squilibrati | il peggiore |
|---|---|---|---|
| relais | 22 PV | 3 su 3 | 13,5 danni → **2 colpi** |
| casa | 18 PV | 6 su 6 | 13,0 danni → **1 colpo** |
| zoom | 22 PV | 1 su 1 | 15,0 danni → **1 colpo** |
| corona | 18 PV | 3 su 3 | 13,5 danni → **1 colpo** |

**Ogni boss della serie uccideva l'eroe più fragile in uno o due colpi.** Nessuno se n'era accorto in
mesi di lavoro, perché nessuno l'aveva *misurato*: le suite passavano (i bot vincono spesso grazie ai
ritiri e alle cure), il committente non si era lamentato (chi gioca al tavolo bara un po' in proprio
favore, ed è giusto così), e in un playthrough il sintomo si presenta come **«loop di checkpoint»**
o **«la suite è lenta»** — mai come «i numeri sono sbagliati».

Ritarati tutti: danno portato a ≈ `pvMin / 4` scegliendo la combinazione dado+bonus più vicina
**senza mai aumentare** (2d8+3 → 1d8+1), PV lasciati intatti perché quelli erano giusti. Ora l'eroe
più fragile regge 4 colpi in tutti e cinque i giochi e i boss restano da 35-81 PV, cioè scontri veri.

La lezione oltre i numeri: **un difetto che si presenta sempre travestito non viene trovato
giocando, viene trovato misurando.** Le tre righe di aritmetica che lo scoprono valgono più di
qualunque quantità di ore di test manuale — e vanno nel validatore, dove nessuno se le dimentica.

### 36. La pietà e il guardiano si contano PER SCONTRO, non a vita

Correzione alla 34, sbagliata nella prima stesura e scoperta dai test stessi — che è il modo giusto
di scoprirla. Avevo contato i ritorni dal checkpoint **a vita**: `G.stats.checkpointRitorni`, e il
guardiano del test falliva sopra i quattro. In una notte del Relais da **180 scene e 40
combattimenti**, cadere cinque volte in punti diversi è **normale**: sei partite pilotate sono
fallite con «LOOP DI CHECKPOINT» senza avere nessun loop.

E il difetto era doppio, perché anche la pietà era sbagliata nello stesso modo: contata a vita,
dopo tre cadute sparse regalava il 34% di sconto a **tutti** gli scontri successivi, compresi quelli
che il gruppo avrebbe vinto lo stesso.

Il conto giusto è **per scontro**:

```js
const scontro = G.lastCombatSceneId || G.sceneId || '?';
G.stats.ritorniPerScontro[scontro] = (G.stats.ritorniPerScontro[scontro] || 0) + 1;
G.pieta = Math.min(0.34, G.stats.ritorniPerScontro[scontro] * 0.12);
// il conteggio a vita resta, ma serve solo alle imprese
```

E il guardiano guarda il **massimo per scontro**, non la somma:

```js
const peggio = Object.entries(G.stats.ritorniPerScontro).sort((a,b) => b[1]-a[1])[0];
if (peggio && peggio[1] > 3) throw new Error(`LOOP DI CHECKPOINT: ${peggio[1]} ritorni sullo STESSO scontro ("${peggio[0]}")`);
```

Il messaggio adesso **nomina lo scontro**, che è la differenza fra un errore da leggere e un errore
da indagare. La regola generale: quando una soglia misura «troppe volte», chiedersi sempre *troppe
volte **dove***. Un contatore globale su una storia lunga produce falsi positivi garantiti.

### 37. Quando una misura diretta e una per procura litigano, vince quella diretta

Il Relais aveva **due** controlli sull'economia, scritti in momenti diversi, e si contraddicevano:

- sul **grafo**: «al massimo 110 punti distribuiti in tutta la campagna, perché una partita ne vede
  circa il 40%»;
- nelle **partite simulate**: «il raccolto mediano di una notte di lunghezza umana deve stare fra
  12 e 34, cioè 3-4 secondi tentativi».

Tagliando i punti per rispettare il tetto (258 → 78) il raccolto mediano è crollato a **5**: due
ritiri in tutta la notte, cioè di nuovo una valuta che non si usa. L'assunzione del 40% era sbagliata
di un fattore tre — la percorrenza reale di una notte è più vicina al **10-15%**, perché i punti
stanno anche sui rami che una partita non attraversa.

Il tetto sul grafo è una **procura**: stima quello che il giocatore riceverà. Il raccolto mediano è
la **misura diretta**: è quello che il giocatore riceve davvero, contato su partite vere. Quando le
due litigano, si aggiusta la procura, non la realtà. Tetto portato a 200 con il perché scritto
accanto, e la fascia 12-34 lasciata a fare da vero guardiano.

Corollario sul **dove** rimettere i punti: non a caso e non «un po' su tutto». In Relais sono tornati
sui **76 momenti umani** — le scene il cui testo parla di mangiare, bere, il caffè, i taralli, una
risata, dormire, sedersi, tenersi per mano, respirare. Un filtro sul *testo*, non sulla struttura, e
il risultato è che l'economia insegna il tema del gioco invece di contraddirlo.

### 38. Chi porta compagni colpisce più piano

L'ultimo loop di checkpoint del Relais non era un boss: era `cuoco + cameriere + cameriere`, tre
nemici per **20 danni potenziali al round** contro eroi da 22 PV. Un eroe cadeva in poco più di un
round, e il gruppo rimbalzava sul checkpoint anche con la pietà al massimo.

La regola della 27 va estesa: **il danno di un nemico non si giudica da solo, si giudica nella
compagnia in cui compare.** Un nemico da 5,5 danni è mite; tre insieme fanno 16,5 e uccidono. Il
validatore somma il danno di tutti i nemici di ogni scena e avvisa quando supera metà dei PV
dell'eroe più fragile — e quell'avviso va guardato, non archiviato: era già lì, e l'ho lasciato
passare come «informativo» finché non è diventato un loop.

Ritarati: cuoco 9,0 → 6,5 e cameriere 5,5 → 4,5, gruppo da 20 → 15,5.

### 39. Chi ruba vita deve essere colpibile

Lo scontro finale del Relais era `gregorio + cameriere + cameriere`: 85 PV, 14,5 danni al round e —
il dettaglio che lo rendeva invincibile — **ruba vita** su un boss con CA 16. La CA alta allunga lo
scontro perché il gruppo manca; il furto di vita lo allunga di nuovo perché disfa i colpi che vanno
a bersaglio; e ogni round in più è danno incassato. Le tre cose insieme non si sommano, si
moltiplicano.

Quando un boss ha una capacità che **allunga** lo scontro (furto di vita, cura, rigenerazione,
richiamo di rinforzi), la sua CA va **abbassata**, non alzata: uno scontro lungo deve essere uno
scontro in cui i colpi arrivano. E i comprimari accanto a lui devono morire nel primo giro, così il
danno del gruppo crolla invece di restare piatto per dieci round. Ritarati: gregorio CA 16 → 14,
cameriere 15 → 10 PV.

### 40. L'HUD orienta, la didascalia commenta

Per cinque giochi la stessa frase è stata stampata due volte a duecento pixel di distanza: nella
barra in alto e sotto il quadro. Nessun test poteva accorgersene — erano entrambe «presenti e
giuste». L'ho visto in uno screenshot.

Le didascalie sono scritte come `Luogo, ora — frase`. Il taglio naturale è quello: **il luogo e
l'ora vanno nell'HUD** (a cosa serve un HUD se non a sapere dove sei), **la frase sotto il quadro**
(è la didascalia di un'immagine, deve dire cosa stai guardando). Senza trattino lungo l'HUD prende
tutto e la didascalia sotto si nasconde. Due righe, due lavori diversi, zero ripetizioni.

### 41. Una finta DOM che diverge dal browser nasconde i bug

Nella finta DOM dei test `classList.toggle(c)` ignorava il secondo argomento. Nel browser
`toggle('hidden', false)` **rimuove**; nella finta DOM, con la classe assente, **aggiungeva**. Un
test verde su un comportamento invertito.

Ogni scorciatoia nella finta DOM è un punto in cui i test smettono di parlare del programma vero.
Quando si aggiunge un metodo va implementato con la firma completa, o va fatto lanciare un errore
sugli argomenti che non gestisce — mai fallire in silenzio in una direzione plausibile.

### 42. Una correzione grafica va misurata, non guardata

Il sottotitolo del titolo lasciava una parola sola sull'ultima riga. Ho aggiunto
`max-width: 30ch` e `text-wrap: balance` e sarei passato oltre chiamandola una correzione.
Misurando i rettangoli di riga sul sito vero: **30ch è più stretto del testo e AGGIUNGE una riga** —
quattro invece di tre sul telefono, cinque invece di due sul desktop. Il bilanciamento, da solo, non
cambiava niente. Avrei pubblicato un peggioramento con la descrizione di un miglioramento.

Per ogni modifica a un layout va misurato **il numero di righe, la larghezza e la posizione prima e
dopo**, sullo schermo vero e a due larghezze di finestra (`getClientRects()` sul contenuto dà le
righe una per una). Uno screenshot dice se una cosa è brutta; solo la misura dice se è migliorata.

Stessa disciplina ha evitato una correzione inutile: sembrava che entrando in combattimento la
pagina restasse a metà. Misurato: al cambio di scena il documento si accorcia e il browser riporta
lo scorrimento a zero da sé. Non c'era niente da correggere, e aggiungere uno `scrollTo` avrebbe
solo aggiunto codice da mantenere.

### 43. Il testo non si scrive dentro un canvas

Due volte lo stesso errore. La pianta è un canvas da **720×480** che sul telefono viene mostrato a
**289×195**: scala 0,40, quindi i nomi delle stanze scritti a 9px arrivavano a **3,6px** — un impasto
grigio dove si leggeva «La Sala Switch» solo sapendo già cosa c'era scritto. Il campo di battaglia è
un canvas da **960×380** mostrato a **355×141**: scala 0,37, e nessuna misura di carattere può
salvare un *nome* lì dentro — a 30px «cameriere» sarebbe largo 270px su nemici distanti 90px.

La regola: **nel canvas vanno solo cose che restano leggibili rimpicciolite** — numeri, icone,
barre, simboli. Le parole vanno in DOM, dove non si scalano con l'immagine. Nella pianta sono
rimasti i numeri e i nomi stanno in una legenda sotto; sul campo di battaglia sono rimasti i numeri
sopra i nemici e sotto la cornice c'è l'elenco «1 Sussurri 32/32 · 2 Eco 16/16», che come effetto
collaterale dà i **punti vita esatti** — cosa che una barra di 3px non ha mai detto.

Prima di scrivere in un canvas: calcolare `larghezza_mostrata / larghezza_interna` e verificare che
il carattere reso stia sopra i ~10px veri. Se non ci sta, non è un problema di misura: è testo nel
posto sbagliato.

### 44. Una funzione costruita e vuota è una bugia come le altre

Il bottone «📖 Ispeziona» nello zaino compare solo se l'oggetto ha un campo `lore`. Il codice era
scritto in quattro giochi su cinque. Gli oggetti che avevano davvero qualcosa da leggere erano:
Relais 18 su 32, Casa 8 su 24, **Zoom 0 su 12, Corona 0 su 29 — e in Corona il bottone non era
nemmeno stato portato**. Un bottone che compare su un oggetto su trenta è peggio di nessun bottone:
il giocatore impara che quella funzione non c'è, e smette di cercarla anche dove c'è.

È lo stesso errore della valuta che non compra niente (lezione 25), applicato a una funzione invece
che a una risorsa. Il validatore adesso tiene insieme le due metà: se un oggetto ha un retro,
l'interfaccia deve mostrarlo; se l'interfaccia lo mostra, almeno l'8 e il 20% degli oggetti devono
averne uno; e un retro sotto le 35 parole è uno stub, non un contenuto.

Il controllo **non** pretende un retro su ogni oggetto, e questo è deliberato: un pezzo di nastro
isolante che serve solo a costruire altro non ha un secondo strato, e inventarglielo sarebbe
riempitivo — cioè il difetto che si stava cercando di correggere. Il retro va agli oggetti che
portano una storia: la lista d'imbarco con un nome aggiunto a penna, il d20 comprato nel 2019 e mai
tirato, la candela del motore ancora tiepida con la targhetta «Gruppo 2024».

### 45. Un'esenzione in un controllo è un bug che si è deciso di non vedere

Il validatore di tutti e cinque i giochi aveva già il controllo «questa scelta chiede un flag che
nessuno imposta». In Corona la condizione era:

```js
if (c.requires?.flag && !knownFlags.has(c.requires.flag) && !/^[a-z]+_presente$/.test(...))
```

Quel `!/^[a-z]+_presente$/` è un'esenzione scritta per far passare il controllo invece di
correggerne la causa. Sotto ci stava nascosta **un'intera scena** — `k_torvald`, «da cuoco a cuoco»
con Monsieur Ragoût — chiusa dietro `torvald_presente`, un flag che nessuna scena e nessun modulo
impostava mai. Scritta, testata dal grafo, e invisibile a chiunque abbia giocato.

Le esenzioni erano cinque toppe diverse, e due copiate male: Zoom esentava `daniele_in_squadra`, che
in Zoom non esiste — copia-incolla da Casa. Sostituite tutte da un controllo che invece di
**esentare i nomi** va a **cercare dove i flag vengono impostati**, anche fuori da `campaign.js`
(`js/misteri.js`, `js/crafting.js`, `js/engine.js`: `G.flags['x'] = …`). Zero esenzioni, e la
vera causa risolta portando `requires.hero` anche in Corona.

Quando un controllo dà fastidio ci sono due strade, e una sola è quella giusta: capire perché
protesta. L'esenzione va scritta solo quando si può dire **per quale ragione strutturale** quel caso
non è un errore — e allora è una regola, non una toppa.

### 46. Fare l'inventario di quello che nessuno può incontrare

Una passata sistematica su tutti e cinque i giochi — «cosa esiste nei dati e non è raggiungibile
dal gioco?» — ha trovato in un pomeriggio:

- **una scena intera** (Corona, `k_torvald`) dietro un flag mai impostato;
- **un oggetto** definito e descritto e mai dato a nessuno (il coltello di Ragoût, il cui stesso
  retro promette «se glielo chiedete ve lo dà»);
- **quattro nemici** con scheda, sprite e attacco che nessuna scena faceva comparire (Corona:
  bandito; Pandataria: murena, annegata, polpo);
- **due reazioni in combattimento** già scritte — «se c'è Ciro contro la murena», «se c'è Claudia
  contro l'annegata» — che non potevano scattare perché quei nemici non comparivano mai.

Le tre domande da fare a ogni gioco, e che stanno in `tools/`:
1. quale `requires.flag` non è impostato da nessuna scena **né da nessun modulo**?
2. quale oggetto di `ITEMS` non è dato da nessuna scena, ricetta, minigioco o inventario iniziale?
3. quale voce di `BESTIARY` non compare in nessun `combat.enemies`?

E la regola per il risultato: **o si rende raggiungibile, o si toglie.** Non tutto va reso
raggiungibile: il POLPO di Pandataria è stato eliminato perché il gioco ha già un polpo — quello di
Cala Nave che guarda Claudia «con quell'occhio orizzontale e decide che non vale la pena spostarsi»
— e farne un mostro con «otto braccia e un becco» contraddiceva la sua scena migliore. Una creatura
che il gioco stesso smentisce si toglie, e si scrive accanto perché.

Ultima cosa, imparata subito dopo: **contenuto aggiunto e non attraversato da nessun test è
contenuto non finito.** L'imboscata dei banditi ha girato per 48 partite simulate senza che nessuna
la incontrasse. Ogni scena nuova si accompagna con lo scenario che la gioca.

### 47. Gli scenari nuovi vanno in coda, sempre

In tutte le suite i semi si assegnano con un contatore progressivo:

```js
let seedCounter = 1;
function nextSeed() { return seedCounter++ * 104729; }
```

Ho inserito uno scenario nuovo **in testa** alla lista di Casa e due scenari che passavano da
mesi hanno cominciato a fallire — non perché il gioco fosse cambiato, ma perché ogni scenario dopo
il mio aveva preso il seme del precedente, e con un altro seme i dadi cadono diversi. Dieci minuti
buttati a cercare una regressione che non esisteva.

Uno scenario nuovo si aggiunge **in fondo**, o gli si dà un seme esplicito (`{ seed: 424242 }`). E
se serve davvero metterlo in mezzo, si mette il seme esplicito a lui e a tutti quelli che seguono,
oppure si accetta di rileggere i fallimenti come «i dadi sono cambiati», non come «il gioco si è
rotto».

Nota di merito ai test: hanno fallito **forte e in modo specifico** («finale atteso e_gemelli,
trovato e_scambio», «scena u10b non attraversata»), che è esattamente quello che serve per capire
in due minuti che il problema era il seme e non il contenuto.

Corollario, pagato dieci minuti dopo: **sostituire un blocco porta via anche quello che c'era
dentro.** Avevo rimpiazzato due righe di uno scenario con una `sequences`, poi ho capito che la
sequenza non serviva e l'ho tolta — restando senza la chiave `c3: 'Al secondo anello'` che stava
in quelle due righe. Il mistero della cella 47 ha smesso di chiudersi e la suite è diventata rossa
per una cosa che avevo cancellato per sbaglio, non per una scelta di design. Prima di togliere una
modifica, rileggere cosa aveva sostituito.

### 48. Un'opzione del banco di prova che non ha effetto è indistinguibile da un contenuto che non esiste

Inseguendo tre contenuti che nessuno scenario attraversava, ho trovato tre modi diversi di scrivere
un test che sembra provare una cosa e non prova niente — e tutti e tre erano **verdi**.

1. **L'opzione buttata via.** Il ciclo di gioco del Relais legge `scenario.minigames` per forzare
   l'esito di un minigioco, ma la funzione `scenario()` non inoltrava quel campo: lo scenario
   «valzer perso» vinceva il valzer come tutti gli altri, e `u3_ninna` — che sta sull'uscita di
   **fallimento** — restava irraggiungibile. Quando si aggiunge un'opzione a `scenario()`, si
   verifica che arrivi davvero al ciclo di gioco.
2. **Il tiro che non avviene.** In Casa forzavo `checkOutcomes: { k8: 'fail' }` mentre le scelte
   base, a quella scena, prendevano «Lasciar stare» — che non tira nessun dado. Forzare l'esito di
   un tiro che non si tira non fa niente: prima si sceglie la strada che il dado lo tira.
3. **Il dado che decide al posto tuo.** In Corona la radura dei funghi sta oltre una prova di
   Saggezza CD 11, tentata con eroi da SAG +1 e +0: il seme la faceva fallire e lo scenario finiva
   altrove. Serviva `executeUntil` (che ritenta con semi diversi finché il bersaglio non è
   raggiunto) e un eroe con SAG +4.

La contromisura è sempre la stessa: **ogni scenario nuovo dichiara nel suo `verify` la scena che
deve aver visitato.** Se l'opzione non funziona, il test diventa rosso subito e dice quale scena
manca, invece di passare in silenzio per mesi.
