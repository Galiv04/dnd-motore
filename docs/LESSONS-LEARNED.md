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
