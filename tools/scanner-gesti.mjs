#!/usr/bin/env node
/* ============================================================================
   SCANNER DEI GESTI — v2
   Cerca le scelte che promettono un GESTO verso una persona (abbracciare,
   promettere, giurare, mostrare, chiedere scusa, chiamare per nome…) e che
   finiscono in una scena scritta per un'altra scelta: il gesto non avviene mai.

   Uso:  node tools/scanner-gesti.mjs ../nome-del-gioco

   COSA NON È UN DIFETTO (imparato sbagliando, agosto 2026):
   · «Ringraziate X e proseguite» quando l'altra scelta della coppia porta il
     contenuto e l'effetto: quella è l'USCITA della scena, non una promessa.
   · «in fila stretta» non è una stretta di mano: le parole ambigue vanno
     tenute fuori dal filtro, o lo scanner grida al posto sbagliato e si
     smette di dargli retta.
   ========================================================================== */
import { readFileSync } from 'fs';
import vm from 'vm';

const gioco = process.argv[2];
if (!gioco) { console.error('uso: node tools/scanner-gesti.mjs ../nome-del-gioco'); process.exit(2); }

const ctx = { console }; vm.createContext(ctx);
vm.runInContext(readFileSync(`${gioco}/js/campaign.js`, 'utf8') + ';globalThis.__C=CAMPAIGN;', ctx);
const C = ctx.__C;

/* Solo gesti non ambigui. Niente «stretta» (in fila stretta), niente «mostra»
   da solo (mostrare la mappa a un muro non è un gesto affettivo). */
const GESTO = /abbracc|promett|prometti|giur[aio]\b|chiedi scusa|chiedere scusa|tieni la mano|tenere la mano|prendi la mano|bacia|baciar|conforta|consola|chiamarla per nome|chiamarlo per nome|dirle che|dirgli che|cantarle|cantargli/i;
/* Le formule di cortesia che chiudono una scena non sono promesse. */
const CORTESIA = /^\s*[^\w]*\s*ringrazi\w*\b.*\b(torna|tornate|scendi|scendete|imbocca|imboccate|andate|uscite|proseguite|salutate)/i;

const haEffetto = c => !!(c.sets || c.item || c.item2 || c.check || c.heal || c.damage || c.gold
  || c.goldLoss || c.sacrifice || c.removeItem || c.removeItem2 || c.combat || c.minigame || c.hero);

const sospetti = [];
for (const [id, s] of Object.entries(C)) {
  const scelte = s.choices || [];
  if (scelte.length < 2) continue;
  const perDestinazione = {};
  for (const c of scelte) (perDestinazione[c.next] ||= []).push(c);
  for (const c of scelte) {
    const testo = c.text || '';
    if (!GESTO.test(testo) || CORTESIA.test(testo)) continue;
    const fratelli = perDestinazione[c.next] || [];
    if (fratelli.length < 2) continue;               // destinazione sua: la scena può rispondergli
    if (haEffetto(c)) continue;                      // il gesto lascia una traccia
    if (fratelli.some(f => f !== c && haEffetto(f))) continue;  // lui è l'uscita, il fratello è il contenuto
    sospetti.push({ scena: id, testo: testo.slice(0, 76), verso: c.next });
  }
}

console.log(`${gioco}: ${sospetti.length} gesti senza reazione`);
for (const x of sospetti) console.log(`  ${x.scena} → ${x.verso}  «${x.testo}»`);
process.exit(sospetti.length ? 1 : 0);
