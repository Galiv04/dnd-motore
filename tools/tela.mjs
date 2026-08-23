/* ============ TELA — un canvas 2D che disegna per davvero, in Node ============
   Serve a UNA cosa: rendere i fondali dei giochi in PNG senza browser, senza server e
   senza dipendenze, così si possono guardare uno per uno e si può misurare quello che
   l'occhio non vede.

   PERCHÉ ESISTE. Richiesta del committente, 23 agosto 2026: «tutte queste utility per
   ispezionare le componenti grafiche, mettiamole nel motore — una pagina con tutte le
   figure insieme, oppure uno script che converte le scene in PNG, che tu le ispezioni
   una a una e poi le elimini. Utility riusabili, che costano meno token e fanno un
   lavoro di qualità». Aveva ragione su tutte e tre le cose: prima ogni verifica visiva
   voleva un push, l'attesa di Pages, un ricarico degli asset e uno screenshot — cinque
   passi e qualche minuto per guardare un'immagine. Da qui: `node fondali-in-png.mjs`,
   e le immagini sono su disco.

   COSA IMPLEMENTA. Quello che i painter della serie usano davvero: fillRect,
   strokeRect, i tracciati (moveTo/lineTo/arc/stroke/fill), le trasformazioni
   (save/restore/translate/rotate/scale/transform) e i gradienti lineari. Il colore
   accetta #rgb, #rrggbb, rgb() e rgba(). L'antialiasing è a supercampionamento 2×2,
   che è quello che serve per vedere il difetto delle righe su coordinate frazionarie.

   COSA NON IMPLEMENTA. Testo (i painter non ne disegnano: le parole stanno nel DOM,
   lezione 43), immagini, ombre, compositing diverso da source-over, clip. Se un giorno
   servissero, si aggiungono qui e tutti i giochi ne beneficiano. */

import { deflateSync } from 'zlib';

/* ---------- colore ---------- */
/* Quanti colori non validi sono stati assegnati durante il disegno. Serve, perché il
   browser IGNORA in silenzio un colore che non capisce e continua a usare il
   precedente: un `rgb(NaN,NaN,NaN)` — che è quello che produce shade(mix(...)), dato
   che shade vuole un esadecimale — non si vede mai, e la scena resta col colore di
   un'altra cosa. Qui si fa come il browser (si ignora) ma si CONTA. */
export const colorìSballati = { n: 0, esempi: [] };

function colore(v) {
  if (typeof v === 'object' && v && v.__gradiente) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    if (h.length === 4) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16) / 255];
    if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    if (h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
    return null;
  }
  const m = /^rgba?\(([^)]*)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(',').map(x => parseFloat(x));
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) return null;
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 && Number.isFinite(p[3]) ? Math.max(0, Math.min(1, p[3])) : 1];
  }
  const nomi = { black: [0, 0, 0, 1], white: [255, 255, 255, 1], red: [255, 0, 0, 1],
                 lime: [0, 255, 0, 1], blue: [0, 0, 255, 1], transparent: [0, 0, 0, 0] };
  return nomi[s.toLowerCase()] || null;
}

/* Come il browser: un colore che non si capisce non cambia niente. Ma lo si conta. */
function colValido(v, precedente) {
  const c = colore(v);
  if (c) return c;
  colorìSballati.n++;
  if (colorìSballati.esempi.length < 6 && typeof v === 'string') colorìSballati.esempi.push(v);
  return precedente;
}

/* ---------- la tela ---------- */
export class Tela {
  constructor(w, h) {
    this.width = w; this.height = h;
    // RGBA premoltiplicato no: teniamo semplice, canali separati in float
    this.px = new Float32Array(w * h * 4);   // r,g,b in 0-255, a in 0-1
  }

  getContext() { return new Contesto(this); }

  /* Il colore finale di un pixel su fondo `sfondo` (per il PNG): serve perché un
     fondale con buchi va guardato su un fondo che li faccia vedere. */
  rgba(sfondo = null) {
    const { width: w, height: h, px } = this;
    const out = Buffer.alloc(w * h * 4);
    const sf = sfondo ? colore(sfondo) : null;
    for (let i = 0; i < w * h; i++) {
      let r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
      if (sf) {
        r = r * a + sf[0] * (1 - a); g = g * a + sf[1] * (1 - a); b = b * a + sf[2] * (1 - a);
        a = 1;
      }
      out[i * 4] = Math.max(0, Math.min(255, Math.round(r)));
      out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      out[i * 4 + 3] = Math.round(a * 255);
    }
    return out;
  }

  /* La trasparenza residua pixel per pixel: 1 = nessuno ha dipinto qui. */
  trasparenza() {
    const n = this.width * this.height;
    const t = new Float32Array(n);
    for (let i = 0; i < n; i++) t[i] = 1 - this.px[i * 4 + 3];
    return t;
  }

  png(sfondo = null) {
    return scriviPng(this.width, this.height, this.rgba(sfondo));
  }
}

/* ---------- il contesto ---------- */
const SUB = 2;   // supercampionamento per lato: 4 campioni per pixel

class Contesto {
  constructor(tela) {
    this.tela = tela;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = ''; this.textAlign = 'left'; this.textBaseline = 'alphabetic';
    this.lineCap = 'butt'; this.lineJoin = 'miter'; this.miterLimit = 10;
    this.globalCompositeOperation = 'source-over';
    this.shadowBlur = 0; this.shadowColor = 'transparent';
    this.shadowOffsetX = 0; this.shadowOffsetY = 0;
    this.imageSmoothingEnabled = false; this.filter = 'none';
    this._m = [1, 0, 0, 1, 0, 0];      // a b c d e f
    this._pila = [];
    this._percorso = [];               // lista di sottotracciati: [[x,y], ...]
    this._corrente = null;
  }

  /* --- stato e trasformazioni --- */
  save() { this._pila.push([this._m.slice(), this.fillStyle, this.strokeStyle, this.lineWidth, this.globalAlpha]); }
  restore() {
    const s = this._pila.pop();
    if (!s) return;
    [this._m, this.fillStyle, this.strokeStyle, this.lineWidth, this.globalAlpha] = [s[0], s[1], s[2], s[3], s[4]];
  }
  transform(a, b, c, d, e, f) {
    const m = this._m;
    this._m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b,
               m[0] * c + m[2] * d, m[1] * c + m[3] * d,
               m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
  }
  setTransform(a, b, c, d, e, f) { this._m = [a, b, c, d, e, f]; }
  resetTransform() { this._m = [1, 0, 0, 1, 0, 0]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(t) { const c = Math.cos(t), s = Math.sin(t); this.transform(c, s, -s, c, 0, 0); }
  _pt(x, y) { const m = this._m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /* --- rettangoli --- */
  fillRect(x, y, w, h) {
    if (!(w > 0) || !(h > 0)) return;
    this._poligono([this._pt(x, y), this._pt(x + w, y), this._pt(x + w, y + h), this._pt(x, y + h)],
                   this.fillStyle, { x, y, w, h });
  }
  strokeRect(x, y, w, h) {
    const l = Math.max(0.5, this.lineWidth) / 2;
    this.fillStyleTmp = this.fillStyle;
    const c = this.strokeStyle;
    this._quad(x - l, y - l, x + w + l, y + l, c);
    this._quad(x - l, y + h - l, x + w + l, y + h + l, c);
    this._quad(x - l, y - l, x + l, y + h + l, c);
    this._quad(x + w - l, y - l, x + w + l, y + h + l, c);
  }
  _quad(x0, y0, x1, y1, stile) {
    this._poligono([this._pt(x0, y0), this._pt(x1, y0), this._pt(x1, y1), this._pt(x0, y1)], stile, null);
  }
  clearRect(x, y, w, h) {
    const t = this.tela;
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(t.height, Math.ceil(y + h)); py++)
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(t.width, Math.ceil(x + w)); px++)
        t.px.fill(0, (py * t.width + px) * 4, (py * t.width + px) * 4 + 4);
  }

  /* --- tracciati --- */
  beginPath() { this._percorso = []; this._corrente = null; }
  closePath() { if (this._corrente && this._corrente.length > 1) this._corrente.push(this._corrente[0].slice()); }
  moveTo(x, y) { this._corrente = [this._pt(x, y)]; this._percorso.push(this._corrente); }
  lineTo(x, y) { if (!this._corrente) this.moveTo(x, y); else this._corrente.push(this._pt(x, y)); }
  quadraticCurveTo(cx, cy, x, y) { this._curva([[cx, cy], [x, y]]); }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this._curva([[c1x, c1y], [c2x, c2y], [x, y]]); }
  _curva(punti) { for (const [x, y] of punti) this.lineTo(x, y); }
  arc(cx, cy, rr, a0, a1, anti = false) {
    const passi = Math.max(8, Math.ceil(Math.abs(a1 - a0) * rr / 2));
    for (let i = 0; i <= passi; i++) {
      const t = a0 + (a1 - a0) * (i / passi) * (anti ? -1 : 1);
      const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
      if (i === 0 && !this._corrente) this.moveTo(x, y); else this.lineTo(x, y);
    }
  }
  ellipse(cx, cy, rx, ry, rot, a0, a1) {
    const passi = 32;
    for (let i = 0; i <= passi; i++) {
      const t = a0 + (a1 - a0) * (i / passi);
      const x = cx + Math.cos(t) * rx * Math.cos(rot) - Math.sin(t) * ry * Math.sin(rot);
      const y = cy + Math.cos(t) * rx * Math.sin(rot) + Math.sin(t) * ry * Math.cos(rot);
      if (i === 0 && !this._corrente) this.moveTo(x, y); else this.lineTo(x, y);
    }
  }
  rect(x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
  }
  roundRect(x, y, w, h) { this.rect(x, y, w, h); }
  fill() {
    for (const sub of this._percorso) if (sub.length > 2) this._poligono(sub, this.fillStyle, null);
  }
  stroke() {
    const l = Math.max(0.6, this.lineWidth) / 2;
    for (const sub of this._percorso) {
      for (let i = 1; i < sub.length; i++) {
        const [x0, y0] = sub[i - 1], [x1, y1] = sub[i];
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * l, ny = dx / len * l;
        this._poligono([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]],
                       this.strokeStyle, null);
      }
    }
  }
  clip() {}
  fillText() {} strokeText() {}
  measureText() { return { width: 0 }; }
  drawImage() {} putImageData() {}
  getImageData(x, y, w, h) {
    const t = this.tela, d = new Uint8ClampedArray(w * h * 4), buf = t.rgba();
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const s = ((y + py) * t.width + (x + px)) * 4, o = (py * w + px) * 4;
      for (let k = 0; k < 4; k++) d[o + k] = buf[s + k] || 0;
    }
    return { data: d, width: w, height: h };
  }
  createLinearGradient(x0, y0, x1, y1) {
    const g = { __gradiente: true, x0, y0, x1, y1, stop: [],
                addColorStop(t, c) { this.stop.push([t, colore(c)]); } };
    return g;
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return this.createLinearGradient(x0, y0 - r0, x1, y1 + r1);
  }
  createPattern() { return null; }
  isPointInPath() { return false; }
  setLineDash() {} getLineDash() { return []; }

  /* Riempimento di un poligono convesso (tutti quelli che i painter producono lo
     sono: rettangoli trasformati e segmenti ispessiti), a supercampionamento 2×2. */
  _poligono(p, stile, rettOriginale) {
    const t = this.tela, W = t.width, H = t.height;
    const col = colValido(stile, this._ultimoColore || [0, 0, 0, 1]);
    if (col && !col.__gradiente) this._ultimoColore = col;
    const grad = col.__gradiente ? col : null;
    const alfaBase = (grad ? 1 : col[3]) * (Number.isFinite(this.globalAlpha) ? this.globalAlpha : 1);
    if (!grad && alfaBase <= 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of p) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(W - 1, Math.ceil(maxX));
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    if (x1 < x0 || y1 < y0) return;
    const dentro = (px, py) => {
      let segno = 0;
      for (let i = 0; i < p.length; i++) {
        const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
        const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        if (c > 1e-9) { if (segno < 0) return false; segno = 1; }
        else if (c < -1e-9) { if (segno > 0) return false; segno = -1; }
      }
      return true;
    };
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let dentroN = 0;
        for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
          if (dentro(px + (sx + 0.5) / SUB, py + (sy + 0.5) / SUB)) dentroN++;
        }
        if (!dentroN) continue;
        const cop = dentroN / (SUB * SUB);
        let cr, cg, cb, ca;
        if (grad) {
          const dx = grad.x1 - grad.x0, dy = grad.y1 - grad.y0;
          const den = dx * dx + dy * dy || 1;
          let u = ((px + 0.5 - grad.x0) * dx + (py + 0.5 - grad.y0) * dy) / den;
          u = Math.max(0, Math.min(1, u));
          const st = grad.stop.slice().sort((a, b) => a[0] - b[0]);
          if (!st.length) continue;
          let A = st[0], B = st[st.length - 1];
          for (let i = 1; i < st.length; i++) if (st[i][0] >= u) { A = st[i - 1]; B = st[i]; break; }
          const k = B[0] === A[0] ? 0 : (u - A[0]) / (B[0] - A[0]);
          cr = A[1][0] + (B[1][0] - A[1][0]) * k;
          cg = A[1][1] + (B[1][1] - A[1][1]) * k;
          cb = A[1][2] + (B[1][2] - A[1][2]) * k;
          ca = (A[1][3] + (B[1][3] - A[1][3]) * k) * (this.globalAlpha ?? 1);
        } else { cr = col[0]; cg = col[1]; cb = col[2]; ca = alfaBase; }
        const a = ca * cop;
        if (a <= 0) continue;
        const i4 = (py * W + px) * 4;
        const aOld = t.px[i4 + 3];
        const aNew = a + aOld * (1 - a);
        if (aNew <= 0) continue;
        t.px[i4] = (cr * a + t.px[i4] * aOld * (1 - a)) / aNew;
        t.px[i4 + 1] = (cg * a + t.px[i4 + 1] * aOld * (1 - a)) / aNew;
        t.px[i4 + 2] = (cb * a + t.px[i4 + 2] * aOld * (1 - a)) / aNew;
        t.px[i4 + 3] = aNew;
      }
    }
  }
}

/* ---------- PNG ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pezzo(tipo, dati) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dati.length);
  const t = Buffer.from(tipo, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dati])));
  return Buffer.concat([len, t, dati, crc]);
}
export function scriviPng(w, h, rgba) {
  const righe = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    righe[y * (w * 4 + 1)] = 0;                       // filtro: nessuno
    rgba.copy(righe, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo('IHDR', ihdr),
    pezzo('IDAT', deflateSync(righe, { level: 9 })),
    pezzo('IEND', Buffer.alloc(0)),
  ]);
}
