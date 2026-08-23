#!/usr/bin/env node
/* ============ VOCE DI GAETANO — il contatore delle battute ============
   Uso:  node ../dnd-motore/tools/voce-di-gaetano.mjs            (dalla cartella di un gioco)
         node dnd-motore/tools/voce-di-gaetano.mjs pandataria …  (dalla cartella padre)

   PERCHÉ ESISTE. Il committente, 23 agosto 2026, dopo aver giocato i giochi
   precedenti: le battute di Gaetano sono «un po' troppo da ingegnere nerd,
   analitico o sociopatico, che non è esattamente come sono io». La parte analitica
   c'è per davvero — ma è metà del personaggio. L'altra metà è quello alla mano e
   avventuroso, quello che PROPONE: escursioni, immersioni, snorkeling, stare fuori.
   È lui che tira il gruppo verso le cose nuove, e Claudia quella che si fa tirare.

   Un difetto di ritratto non si vede rileggendo una scena: la battuta che spiega,
   presa da sola, è simpatica. Si vede solo CONTANDO — quante ne spiegano e quante
   ne muovono, su tutto il gioco. Questo tool conta.

   SOGLIA: almeno una battuta che propone o agisce ogni due che spiegano
   (motore ≥ 0.50 × spiegazioni). Sotto, il personaggio è diventato un'enciclopedia.
   E in nessuna scena la sua UNICA battuta può essere una spiegazione. */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';

/* Chi spiega: date, misure, nomi propri di cose, definizioni. Sono le spie della
   cattedra — non del sapere, che va benissimo, ma del tenere lezione. */
const SPIEGA = [
  /\bvuol dire\b/i, /\bsignifica\b/i, /\bsi chiama(va|no)?\b/i, /\bin pratica\b/i,
  /\bcioè\b/i, /\btecnicamente\b/i, /\bin teoria\b/i, /\bè greco\b/i, /\bdal latino\b/i,
  /\bdel (17|18|19|20)\d\d\b/, /\bnel (17|18|19|20)\d\d\b/, /\b\d+ (metri|chilometri|gradi|secoli|anni luce|bar|atmosfere|hertz|volt|watt)\b/i,
  /\bper questo\b/i, /\bil motivo è\b/i, /\bfunziona (così|che)\b/i, /\bsi forma\b/i,
  /\bsi chiamano\b/i, /\bè un fenomeno\b/i, /\bproprietà\b/i,
];
/* Chi muove: inviti, proposte, primi passi. È la metà che si era persa. */
const MOTORE = [
  /\band(iamo|iam)\b/i, /\bvieni\b/i, /\bvenite\b/i, /\bdai\b/i, /\bproviamo\b/i, /\bprovo\b/i,
  /\bci butt(iamo|o)\b/i, /\bscend(iamo|o)\b/i, /\bsal(iamo|go)\b/i, /\bentr(iamo|o)\b/i,
  /\bfacciamo\b/i, /\bfaccio io\b/i, /\bvado io\b/i, /\bvengo io\b/i, /\bci penso io\b/i,
  /\btieni\b/i, /\bprendi\b/i, /\bguarda (qua|qui|lì|là|questo|quella)\b/i, /\bseguimi\b/i,
  /\baspetta\b/i, /\bti tengo\b/i, /\bti porto\b/i, /\bvoglio vedere\b/i, /\bvoglio guardar/i,
  /\bmuoviamoci\b/i, /\bsi va\b/i, /\bsi parte\b/i, /\btuffiamoci\b/i, /\bnuotiamo\b/i,
];

function battuteDi(nome, testo) {
  const fuori = [];
  const re = new RegExp('^>\\s*' + nome + ':\\s*(.*)$', 'gim');
  let m;
  while ((m = re.exec(testo)) !== null) fuori.push(m[1].trim());
  return fuori;
}

function classifica(b) {
  const spiega = SPIEGA.some(re => re.test(b));
  const motore = MOTORE.some(re => re.test(b));
  if (motore && !spiega) return 'motore';
  if (spiega && !motore) return 'spiega';
  if (spiega && motore) return 'misto';        // spiega mentre fa: è quello giusto
  return 'altro';
}

function analizza(cartella) {
  const campagna = join(cartella, 'js', 'campaign.js');
  if (!existsSync(campagna)) return null;
  const src = readFileSync(campagna, 'utf8');
  // le scene, spezzate sul loro id: basta per attribuire ogni battuta a una scena
  const pezzi = src.split(/\n  ([a-z0-9_]+): \{/);
  const conta = { spiega: 0, motore: 0, misto: 0, altro: 0 };
  const soleSpiegazioni = [];
  for (let i = 1; i < pezzi.length; i += 2) {
    const id = pezzi[i], corpo = pezzi[i + 1] || '';
    const bs = battuteDi('Gaetano', corpo);
    if (!bs.length) continue;
    const tipi = bs.map(classifica);
    tipi.forEach(t => conta[t]++);
    if (tipi.length && tipi.every(t => t === 'spiega')) soleSpiegazioni.push(`${id} (${tipi.length})`);
  }
  return { conta, soleSpiegazioni, totale: Object.values(conta).reduce((a, b) => a + b, 0) };
}

const argomenti = process.argv.slice(2);
const cartelle = argomenti.length ? argomenti : ['.'];
let rotti = 0;

for (const c of cartelle) {
  const res = analizza(c);
  const nome = basename(c === '.' ? process.cwd() : c);
  if (!res) { console.log(`\n${nome}: nessun js/campaign.js, salto`); continue; }
  if (!res.totale) { console.log(`\n${nome}: Gaetano non compare`); continue; }
  const { spiega, motore, misto, altro } = res.conta;
  const rapporto = spiega ? (motore + misto) / spiega : Infinity;
  console.log(`\n▶ ${nome} — ${res.totale} battute di Gaetano`);
  console.log(`   spiegano ............ ${spiega}`);
  console.log(`   propongono o fanno .. ${motore}`);
  console.log(`   fanno spiegando ..... ${misto}   ← la voce giusta`);
  console.log(`   altro (affetto, sì/no, battute) ${altro}`);
  console.log(`   rapporto motore/spiegazioni = ${rapporto === Infinity ? '∞' : rapporto.toFixed(2)}  (soglia 0.50)`);
  if (rapporto < 0.50) { console.log('   ❌ troppo cattedra: è diventato un\'enciclopedia'); rotti++; }
  else console.log('   ✔ equilibrio accettabile');
  if (res.soleSpiegazioni.length) {
    console.log(`   ⚠ ${res.soleSpiegazioni.length} scene in cui la sua UNICA battuta spiega:`);
    console.log('     ' + res.soleSpiegazioni.slice(0, 14).join(', ')
      + (res.soleSpiegazioni.length > 14 ? ', …' : ''));
  }
}
process.exit(rotti ? 1 : 0);
