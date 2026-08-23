/* ============ BUCHI NEI FONDALI ============
   Trova le zone di uno sfondo che il gioco non copre. Si importa dal validatore di
   ogni gioco: `import { cercaBuchi } from '.../buchi-nei-fondali.mjs'`.

   PERCHÉ ESISTE, difetto numero uno. In `paese`, la piazza di Ventotene, c'era un
   rettangolo di 52×160 pixel che nessuna chiamata copriva: il filare delle facciate
   arrivava a x=0.50 e ripartiva da x=0.62, e il campanile che sta in mezzo è più
   stretto del vuoto. Sullo schermo, fra le case gialle e rosa, c'era una **fessura
   nera alta mezza inquadratura** — il riquadro della scena ha fondo nero, e quel nero
   era il fondo che si vedeva attraverso. È rimasta lì per mesi, in una scena guardata
   più volte, perché una fessura nera fra due case sembra un vicolo.

   DIFETTO NUMERO DUE, trovato cercando il primo: zone DIPINTE ma non OPACHE. Nella
   spiaggia di `scauri` la sfumatura era fatta di righe alte un pixel appoggiate su
   coordinate FRAZIONARIE: il canvas le antialiasa, la copertura si fermava all'84%, e
   il testo del Narratore si leggeva attraverso la sabbia. In partita i due difetti si
   vedono uguale. Quindi qui non si contano le chiamate: si misura la TRASPARENZA
   RESIDUA di ogni pixel, esattamente come farebbe il canvas — copertura frazionaria
   sui bordi compresa, che è l'unico modo di vedere l'antialias. Un buco vero è solo il
   caso limite in cui la residua è 1.

   LIMITE NOTO. Registra `fillRect` e `strokeRect`. Nei giochi che usano anche i
   tracciati (`stroke` per cavi e corde) una zona potrebbe essere coperta da una linea
   che qui non si vede: per questo la soglia è alta — si segnala solo quello che sullo
   schermo si legge come una macchia, non un pelo scoperto. */

/* L'opacità di un fillStyle: 1 per gli esadecimali e per rgb(), il quarto valore per
   rgba(). Se non si capisce, si assume 1: meglio un falso negativo che un falso
   allarme su ogni scena. */
function opacitaDi(stile) {
  if (typeof stile !== 'string') return 1;
  const m = /rgba?\(([^)]*)\)/i.exec(stile);
  if (!m) return 1;
  const parti = m[1].split(',');
  if (parti.length < 4) return 1;
  const a = parseFloat(parti[3]);
  return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1;
}

function contestoFinto(W, H, residua) {
  /* Copertura esatta: per ogni pixel toccato, la frazione di area coperta dal
     rettangolo, per l'alfa del colore. È il modello del canvas, e serve così preciso
     perché il difetto dell'antialias vive tutto nei bordi frazionari. */
  const segna = (x, y, w, h, alfa) => {
    if (!(w > 0) || !(h > 0) || !(alfa > 0)) return;
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(W - 1, Math.ceil(x + w) - 1);
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(H - 1, Math.ceil(y + h) - 1);
    for (let py = y0; py <= y1; py++) {
      const cy = Math.min(py + 1, y + h) - Math.max(py, y);
      if (cy <= 0) continue;
      for (let px = x0; px <= x1; px++) {
        const cx = Math.min(px + 1, x + w) - Math.max(px, x);
        if (cx <= 0) continue;
        residua[py * W + px] *= (1 - alfa * cx * cy);
      }
    }
  };
  const nulla = () => {};
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
    fillRect(x, y, w, h) { segna(x, y, w, h, opacitaDi(this.fillStyle) * (this.globalAlpha ?? 1)); },
    strokeRect(x, y, w, h) { segna(x - 1, y - 1, w + 2, h + 2, opacitaDi(this.strokeStyle)); },
    clearRect: nulla, beginPath: nulla, closePath: nulla, moveTo: nulla, lineTo: nulla,
    arc: nulla, ellipse: nulla, fill: nulla, stroke: nulla, save: nulla, restore: nulla,
    translate: nulla, rotate: nulla, scale: nulla, setTransform: nulla, clip: nulla,
    transform: nulla, resetTransform: nulla, quadraticCurveTo: nulla, bezierCurveTo: nulla,
    arcTo: nulla, rect: nulla, roundRect: nulla, setLineDash: nulla, getLineDash: () => [],
    createPattern: () => null, isPointInPath: () => false, filter: 'none',
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, shadowBlur: 0, shadowColor: '#000',
    shadowOffsetX: 0, shadowOffsetY: 0, imageSmoothingEnabled: false,
    globalCompositeOperation: 'source-over', textBaseline: 'alphabetic', direction: 'ltr',
    fillText: nulla, strokeText: nulla, measureText: () => ({ width: 0 }),
    drawImage: nulla, putImageData: nulla,
    createLinearGradient: () => ({ addColorStop: nulla }),
    createRadialGradient: () => ({ addColorStop: nulla }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
}

const SCOPERTO = 0.08;   // trasparenza residua oltre la quale il nero del riquadro passa

/* Le macchie scoperte, per grandezza. Flood fill a quattro direzioni sui pixel. */
function macchie(residua, W, H) {
  const visto = new Uint8Array(residua.length);
  const scoperto = i => residua[i] > SCOPERTO;
  const fuori = [];
  const pila = new Int32Array(residua.length);
  for (let i = 0; i < residua.length; i++) {
    if (!scoperto(i) || visto[i]) continue;
    let n = 0, minX = W, maxX = -1, minY = H, maxY = -1, peggio = 0, cima = 0;
    pila[cima++] = i; visto[i] = 1;
    while (cima) {
      const j = pila[--cima];
      const x = j % W, y = (j - x) / W;
      n++;
      if (residua[j] > peggio) peggio = residua[j];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && scoperto(j - 1) && !visto[j - 1]) { visto[j - 1] = 1; pila[cima++] = j - 1; }
      if (x < W - 1 && scoperto(j + 1) && !visto[j + 1]) { visto[j + 1] = 1; pila[cima++] = j + 1; }
      if (y > 0 && scoperto(j - W) && !visto[j - W]) { visto[j - W] = 1; pila[cima++] = j - W; }
      if (y < H - 1 && scoperto(j + W) && !visto[j + W]) { visto[j + W] = 1; pila[cima++] = j + W; }
    }
    fuori.push({ pixel: n, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1,
                 maiDipinto: peggio > 0.98, copertura: 1 - peggio });
  }
  return fuori.sort((a, b) => b.pixel - a.pixel);
}

/* painters: l'oggetto Scenes.painters. Ritorna [{ nome, buchi }] solo per i fondali
   con almeno una macchia oltre soglia.
   sogliaPixel: quanti pixel scoperti fanno una macchia che si vede (default 700).
   latoMin: e quanto deve essere spessa (default 9 px): un pelo di due pixel non lo
   vede nessuno, una fascia di nove sì. */
export function cercaBuchi(painters, { W = 960, H = 360, sogliaPixel = 700, latoMin = 9,
                                       salta = ['titolo'], setDepth = null } = {}) {
  const esito = [];
  for (const [nome, fn] of Object.entries(painters)) {
    if (salta.includes(nome)) continue;
    const residua = new Float64Array(W * H).fill(1);
    const ctx = contestoFinto(W, H, residua);
    if (setDepth) setDepth(0);
    try { fn(ctx, W, H); } catch (e) { esito.push({ nome, errore: e.message }); continue; }
    const buchi = macchie(residua, W, H)
      .filter(b => b.pixel >= sogliaPixel && Math.min(b.w, b.h) >= latoMin);
    if (buchi.length) esito.push({ nome, buchi });
  }
  return esito;
}
