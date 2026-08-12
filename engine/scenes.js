/* ============ SCENES — sfondi pixel/blocchi procedurali ============
   "La Casa che non Finisce" — l'appartamento di Daniele divorato dal Grigiore.
   Palette generale desaturata; UN tocco di colore acceso per painter.
   L'eclissi qui è il GRIGIORE che avanza: overlay grigio + vignettatura. */

const Scenes = (() => {

  // RNG con seme, per texture riproducibili
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return `rgb(${r},${g},${b})`;
  }

  // Riempi area con blocchi stile minecraft (variazione di tono per blocco)
  function blocks(ctx, x, y, w, h, color, blockSize, rand, variance = 0.18) {
    for (let by = y; by < y + h; by += blockSize) {
      for (let bx = x; bx < x + w; bx += blockSize) {
        const f = 1 - variance / 2 + rand() * variance;
        ctx.fillStyle = shade(color, f);
        ctx.fillRect(bx, by, Math.min(blockSize, x + w - bx), Math.min(blockSize, y + h - by));
        // bordo superiore più chiaro (effetto 3D blocco)
        ctx.fillStyle = shade(color, f * 1.15);
        ctx.fillRect(bx, by, Math.min(blockSize, x + w - bx), 2);
      }
    }
  }

  function skyGradient(ctx, W, H, top, bottom, bands = 8) {
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c1 = parseInt(top.slice(1), 16), c2 = parseInt(bottom.slice(1), 16);
      const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
      const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
      const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, Math.floor(H * i / bands), W, Math.ceil(H / bands) + 1);
    }
  }

  function stars(ctx, W, H, rand, n = 60) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand() * W), y = Math.floor(rand() * H * 0.7);
      ctx.fillStyle = rand() > 0.8 ? '#d8d8dc' : '#8a8a96';
      const s = rand() > 0.9 ? 3 : 2;
      ctx.fillRect(x, y, s, s);
    }
  }

  /* ---------- IL GRIGIORE ----------
     Fase 0 = il colore resiste. Fase 1 = il Grigiore ha vinto quasi tutto.
     La imposta il motore scena per scena (Engine.eclipsePhaseFor).
     Niente luna: qui l'avanzare della notte DESATURA il mondo. */
  let eclipsePhase = 0.3;
  function setEclipse(p) { eclipsePhase = Math.max(0, Math.min(1, p)); }
  function getEclipse() { return eclipsePhase; }

  // Velo del Grigiore: desaturazione progressiva + vignettatura grigia
  function grigiore(ctx, W, H, p) {
    if (p <= 0.02) return;
    // velo grigio uniforme che "beve" la saturazione
    ctx.fillStyle = `rgba(138,138,144,${0.05 + p * 0.20})`;
    ctx.fillRect(0, 0, W, H);
    // vignettatura a cornici concentriche (mai un bordo netto)
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const t = (i + 1) / layers;
      const inset = Math.round(Math.min(W, H) * 0.06 * t * (0.4 + p));
      ctx.fillStyle = `rgba(90,90,96,${0.028 * (layers - i) * p})`;
      ctx.fillRect(0, 0, W, inset);                    // alto
      ctx.fillRect(0, H - inset, W, inset);            // basso
      ctx.fillRect(0, 0, inset, H);                    // sinistra
      ctx.fillRect(W - inset, 0, inset, H);            // destra
    }
  }

  // Disco a pixel simmetrico (usato per luci tonde, sole dell'alba)
  function pixelDisc(ctx, cx, cy, r, px = 3) {
    const CX = Math.round(cx / px) * px, CY = Math.round(cy / px) * px;
    const R = Math.max(px, Math.round(r / px) * px);
    for (let dy = -R; dy < R; dy += px) {
      const yy = dy + px / 2;
      const hw = Math.sqrt(Math.max(0, R * R - yy * yy));
      const w = Math.max(px, Math.round(hw / px) * px);
      ctx.fillRect(CX - w, CY + dy, w * 2, px);
    }
  }

  function mix(a, b, t) {
    const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
    const r = Math.round(((ca >> 16) & 255) * (1 - t) + ((cb >> 16) & 255) * t);
    const g = Math.round(((ca >> 8) & 255) * (1 - t) + ((cb >> 8) & 255) * t);
    const bl = Math.round((ca & 255) * (1 - t) + (cb & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // Compat con l'API storica: disco pieno (niente più eclissi lunare)
  function moon(ctx, x, y, r, color = '#e8e0f0') {
    ctx.fillStyle = color; pixelDisc(ctx, x, y, r);
  }

  /* ---------- helper di terreno ---------- */

  // Profilo di terreno irregolare: niente bande orizzontali nette
  function ground(ctx, W, H, topY, color, rand, blockSize = 12, jag = 8) {
    for (let x = 0; x < W; x += blockSize) {
      const off = Math.round((rand() - 0.5) * jag / blockSize) * blockSize;
      blocks(ctx, x, topY + off, blockSize, H - topY - off, color, blockSize, rand, 0.22);
    }
  }

  // Colline/skyline morbidi sul fondo (silhouette a gradini)
  function hills(ctx, W, baseY, height, color, rand, step = 24) {
    let h = height * (0.5 + rand() * 0.5);
    for (let x = 0; x < W; x += step) {
      h += (rand() - 0.5) * height * 0.5;
      h = Math.max(height * 0.25, Math.min(height, h));
      blocks(ctx, x, baseY - h, step, h + 4, color, 12, rand, 0.14);
    }
  }

  // ALBERO — la chioma poggia sul tronco
  function tree(ctx, x, groundY, size, leaf, trunk, rand) {
    const tw = Math.max(8, Math.round(size / 6) * 2);
    const topY = groundY - size;
    blocks(ctx, x - tw / 2, topY, tw, size, trunk, 6, rand);
    blocks(ctx, x - tw, groundY - 8, tw * 2, 8, trunk, 6, rand, 0.3);
    const lw = size * 1.15;
    const leafBottom = topY + size * 0.22;
    blocks(ctx, x - lw / 2, leafBottom - lw * 0.5, lw, lw * 0.5, leaf, 8, rand, 0.28);
    blocks(ctx, x - lw * 0.36, leafBottom - lw * 0.8, lw * 0.72, lw * 0.34, leaf, 8, rand, 0.28);
    blocks(ctx, x - lw * 0.2, leafBottom - lw * 0.98, lw * 0.4, lw * 0.24, leaf, 8, rand, 0.28);
  }

  function willow(ctx, x, groundY, size, leaf, trunk, rand) {
    const tw = Math.max(8, Math.round(size / 7) * 2);
    blocks(ctx, x - tw / 2, groundY - size, tw, size, trunk, 6, rand);
    const lw = size * 1.3;
    blocks(ctx, x - lw / 2, groundY - size - lw * 0.28, lw, lw * 0.42, leaf, 8, rand, 0.26);
    for (let i = -4; i <= 4; i++) {
      const bx = x + i * (lw / 10);
      const len = size * (0.5 - Math.abs(i) * 0.05) + rand() * 10;
      blocks(ctx, bx - 3, groundY - size + lw * 0.1, 6, len, leaf, 6, rand, 0.34);
    }
  }

  /* ---------- helper di costruzioni e luci ---------- */

  function house(ctx, x, groundY, w, h, wall, roof, rand, windowLit = true) {
    blocks(ctx, x, groundY - h, w, h, wall, 8, rand, 0.12);
    const steps = 7, over = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const rw = (w + over * 2) * (1 - t);
      blocks(ctx, x + (w - rw) / 2, groundY - h - 8 - i * 8, rw, 9, roof, 8, rand, 0.16);
    }
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(x + w / 2 - 9, groundY - 28, 18, 28);
    ctx.fillStyle = '#55555c'; ctx.fillRect(x + w / 2 - 11, groundY - 31, 22, 4);
    if (windowLit) {
      for (const wx of [x + 10, x + w - 24]) {
        ctx.fillStyle = 'rgba(200,200,210,.12)'; ctx.fillRect(wx - 6, groundY - h + 6, 26, 26);
        ctx.fillStyle = '#c8c8ce'; ctx.fillRect(wx, groundY - h + 12, 14, 14);
        ctx.fillStyle = '#55555c'; ctx.fillRect(wx + 6, groundY - h + 12, 2, 14);
      }
    }
  }

  // Torcia con staffa (compat API)
  function torch(ctx, x, y, bracket = true) {
    if (bracket) { ctx.fillStyle = '#3a3a45'; ctx.fillRect(x - 5, y + 4, 16, 4); ctx.fillRect(x - 5, y + 4, 4, 12); }
    ctx.fillStyle = '#5a5248'; ctx.fillRect(x, y, 6, 22);
    ctx.fillStyle = 'rgba(232,200,140,.14)'; ctx.fillRect(x - 14, y - 22, 34, 34);
    ctx.fillStyle = '#e8c88c'; ctx.fillRect(x - 3, y - 10, 12, 12);
    ctx.fillStyle = '#f5e0aa'; ctx.fillRect(x, y - 7, 6, 6);
  }

  // Cartello con righe di "scritta" (compat API)
  function sign(ctx, x, groundY, w = 84, h = 30, lines = 2) {
    ctx.fillStyle = '#4a4440'; ctx.fillRect(x - 4, groundY - 46, 8, 46);
    ctx.fillStyle = '#6e6660'; ctx.fillRect(x - w / 2, groundY - 76, w, h);
    ctx.fillStyle = '#5a544e'; ctx.fillRect(x - w / 2, groundY - 76, w, 3);
    ctx.fillStyle = '#2e2a28';
    for (let i = 0; i < lines; i++) {
      const lw = w * (0.5 + (i % 2) * 0.2);
      ctx.fillRect(x - lw / 2, groundY - 66 + i * 9, lw, 4);
    }
  }

  // Ellisse a pixel (come pixelDisc, ma con raggi indipendenti)
  function pixelEllipse(ctx, cx, cy, rx, ry, px = 4) {
    const CX = Math.round(cx / px) * px, CY = Math.round(cy / px) * px;
    const RY = Math.max(px, Math.round(ry / px) * px);
    for (let dy = -RY; dy < RY; dy += px) {
      const t = (dy + px / 2) / RY;
      const hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
      const w = Math.max(px, Math.round(hw / px) * px);
      ctx.fillRect(CX - w, CY + dy, w * 2, px);
    }
  }

  // Alone luminoso morbido: dischi pixelati concentrici, MAI rettangoli
  // (i rettangoli annidati creavano aloni squadrati attorno a ogni luce)
  function glow(ctx, x, y, w, h, rgb) {
    for (let i = 4; i >= 1; i--) {
      ctx.fillStyle = `rgba(${rgb},${0.022 * i})`;
      pixelEllipse(ctx, x, y, w * (5 - i) / 2, h * (5 - i) / 2, 4);
    }
  }

  // Porta chiusa con stipite e maniglia; targhetta opzionale
  function door(ctx, x, floorY, w, h, leaf, frame, tag = null) {
    ctx.fillStyle = frame; ctx.fillRect(x - 4, floorY - h - 4, w + 8, h + 4);
    ctx.fillStyle = leaf; ctx.fillRect(x, floorY - h, w, h);
    ctx.fillStyle = shade(leaf, 0.72);
    ctx.fillRect(x + 6, floorY - h + 8, w - 12, h * 0.36);
    ctx.fillRect(x + 6, floorY - h * 0.5, w - 12, h * 0.36);
    ctx.fillStyle = '#8a8a90'; ctx.fillRect(x + w - 9, floorY - h * 0.52, 5, 5);
    if (tag) { ctx.fillStyle = tag; ctx.fillRect(x + w / 2 - 9, floorY - h - 12, 18, 7); }
  }

  // Sagoma umana grigia, seduta o in piedi, appoggiata al pavimento dato
  function sagoma(ctx, x, footY, hgt, color = '#3a3a40', seated = false) {
    const w = Math.round(hgt * 0.34);
    if (seated) {
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, footY - hgt * 0.62, w, hgt * 0.42);          // busto
      ctx.fillRect(x - w / 2, footY - hgt * 0.22, w * 1.3, hgt * 0.10);    // gambe piegate
      ctx.fillRect(x - w * 0.32, footY - hgt * 0.86, w * 0.64, hgt * 0.26); // testa
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, footY - hgt * 0.72, w, hgt * 0.72);
      ctx.fillRect(x - w * 0.3, footY - hgt, w * 0.6, hgt * 0.3);
    }
  }

  // TV accesa: cassa scura + schermo, con alone morbido del colore dato
  function tvScreen(ctx, x, y, w, h, rgb = '150,170,186', screen = '#8aa2b6') {
    glow(ctx, x + w / 2, y + h / 2, w, h, rgb);
    ctx.fillStyle = '#1d1d22'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = screen; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 3, y + 3, Math.max(4, w * 0.2), 3);
  }

  // Lattina di Coca (rossa: il colore-firma di Daniele)
  function lattina(ctx, x, y) {
    ctx.fillStyle = '#c0242e'; ctx.fillRect(x, y, 7, 11);
    ctx.fillStyle = '#e8e8ea'; ctx.fillRect(x, y, 7, 2);
    ctx.fillStyle = '#f0f0f2'; ctx.fillRect(x + 1, y + 4, 5, 2);
  }

  function heroesRow(ctx, W, groundY, partySpriteKeys, scale = 4) {
    const n = partySpriteKeys.length;
    const totalW = n * 20 * scale;
    let x = Math.floor(W / 2 - totalW / 2);
    for (const key of partySpriteKeys) {
      const def = Sprites.registry[key];
      if (def) Sprites.drawSprite(ctx, def.map, def.palette, x, groundY - 16 * scale, scale);
      x += 20 * scale;
    }
  }

  /* ------------- PITTORI DI LOCATION ------------- */

  const painters = {

    titolo(ctx, W, H) {
      // la facciata del palazzo di notte: UNA finestra accesa di luce TV
      const r = rng(2001);
      skyGradient(ctx, W, H, '#0a0a10', '#1a1a22', 10);
      stars(ctx, W, H, r, 24);
      const g = H - 46;
      // skyline di palazzi spenti dietro
      hills(ctx, W, g - 120, 70, '#101014', r, 44);
      // IL PALAZZO: sette piani di cemento
      const bx = W * 0.30, bw = W * 0.40, bh = H * 0.78;
      blocks(ctx, bx, g - bh, bw, bh, '#26262c', 10, r, 0.10);
      blocks(ctx, bx - 6, g - bh - 8, bw + 12, 10, '#2e2e34', 8, r, 0.08);
      // griglia di finestre TUTTE buie...
      const cols = 4, rows = 7;
      for (let ro = 0; ro < rows; ro++) for (let co = 0; co < cols; co++) {
        const wx = bx + 16 + co * (bw - 32 - 14) / (cols - 1);
        const wy = g - bh + 18 + ro * (bh - 60) / rows;
        ctx.fillStyle = '#141418'; ctx.fillRect(wx, wy, 14, 18);
        ctx.fillStyle = '#1d1d24'; ctx.fillRect(wx, wy, 14, 3);
      }
      // ...tranne UNA: luce TV pulsante grigio-azzurra (quarto piano)
      const lx = bx + 16 + 2 * (bw - 32 - 14) / (cols - 1);
      const ly = g - bh + 18 + 3 * (bh - 60) / rows;
      glow(ctx, lx + 7, ly + 9, 44, 40, '138,168,190');
      ctx.fillStyle = '#8aa8be'; ctx.fillRect(lx, ly, 14, 18);
      ctx.fillStyle = '#b8d0de'; ctx.fillRect(lx + 2, ly + 4, 6, 4);
      ctx.fillStyle = '#5a7686'; ctx.fillRect(lx + 9, ly + 10, 4, 6);
      // portone al piano terra
      ctx.fillStyle = '#17171c'; ctx.fillRect(bx + bw / 2 - 13, g - 34, 26, 34);
      ctx.fillStyle = '#33333a'; ctx.fillRect(bx + bw / 2 - 15, g - 38, 30, 5);
      // citofono con spia minuscola
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(bx + bw / 2 + 17, g - 30, 6, 12);
      ctx.fillStyle = '#9ab2c2'; ctx.fillRect(bx + bw / 2 + 19, g - 28, 2, 2);
      // marciapiede e strada
      blocks(ctx, 0, g, W, 12, '#33333a', 10, r, 0.10);
      blocks(ctx, 0, g + 12, W, H - g - 12, '#1d1d22', 12, r, 0.14);
      // un lampione spento e uno stanco ai lati
      ctx.fillStyle = '#2e2e34'; ctx.fillRect(W * 0.12, g - 84, 5, 84);
      ctx.fillRect(W * 0.115, g - 88, 16, 5);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(W * 0.125 + 8, g - 86, 8, 6);
      ctx.fillStyle = '#2e2e34'; ctx.fillRect(W * 0.84, g - 84, 5, 84);
      ctx.fillRect(W * 0.835, g - 88, 16, 5);
      glow(ctx, W * 0.85 + 8, g - 82, 22, 16, '170,170,160');
      ctx.fillStyle = '#b6b6aa'; ctx.fillRect(W * 0.845 + 8, g - 86, 8, 6);
    },

    strada(ctx, W, H) {
      // strada cittadina di sera; il palazzo di Daniele in fondo
      const r = rng(2003);
      skyGradient(ctx, W, H, '#12121a', '#2a2a34', 10);
      stars(ctx, W, H, r, 14);
      const g = H - 58;
      // quinte di palazzi ai lati, in prospettiva verso il fondo
      for (const side of [0, 1]) {
        for (let i = 0; i < 3; i++) {
          const t = i / 3;
          const pw = W * (0.16 - t * 0.04), ph = H * (0.66 - t * 0.14);
          const px = side ? W - W * (0.02 + i * 0.15) - pw : W * (0.02 + i * 0.15);
          blocks(ctx, px, g - ph, pw, ph, i % 2 ? '#232329' : '#2a2a30', 9, r, 0.10);
          ctx.fillStyle = '#15151a';
          for (let wr = 0; wr < 4; wr++) for (let wc = 0; wc < 2; wc++)
            ctx.fillRect(px + 8 + wc * (pw - 26), g - ph + 12 + wr * ph / 4.6, 11, 14);
          // qualche finestra accesa, calda ma stanca
          if (i === 0) {
            ctx.fillStyle = '#c8b482';
            ctx.fillRect(px + 8, g - ph + 12 + ph / 4.6, 11, 14);
          }
        }
      }
      // in fondo: il palazzo di Daniele, riconoscibile, con la finestra TV
      const bx = W * 0.42, bw = W * 0.16, bh = H * 0.42;
      blocks(ctx, bx, g - bh, bw, bh, '#2e2e36', 8, r, 0.08);
      ctx.fillStyle = '#17171c';
      for (let ro = 0; ro < 5; ro++) for (let co = 0; co < 2; co++)
        ctx.fillRect(bx + 8 + co * (bw - 24), g - bh + 8 + ro * (bh - 26) / 5, 8, 10);
      glow(ctx, bx + 12, g - bh + 8 + 2 * (bh - 26) / 5 + 5, 26, 22, '138,168,190');
      ctx.fillStyle = '#8aa8be'; ctx.fillRect(bx + 8, g - bh + 8 + 2 * (bh - 26) / 5, 8, 10);
      // asfalto con striscia di mezzeria sbiadita che converge
      blocks(ctx, 0, g, W, H - g, '#222228', 12, r, 0.14);
      ctx.fillStyle = 'rgba(200,200,190,.20)';
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        ctx.fillRect(W * 0.5 - 8 + t * 4, g + 6 + i * (H - g - 10) / 5, 16 - t * 8, 5);
      }
      // marciapiedi
      blocks(ctx, 0, g - 4, W * 0.20, 8, '#3a3a40', 8, r, 0.10);
      blocks(ctx, W * 0.80, g - 4, W * 0.20, 8, '#3a3a40', 8, r, 0.10);
      // lampioni accesi: la luce buona della sera
      for (const fx of [0.16, 0.5, 0.84]) {
        ctx.fillStyle = '#33333a'; ctx.fillRect(W * fx - 2, g - 96, 5, 92);
        ctx.fillRect(W * fx - 10, g - 100, 21, 5);
        glow(ctx, W * fx, g - 92, 30, 22, '224,192,120');
        ctx.fillStyle = '#e0c078'; ctx.fillRect(W * fx - 5, g - 98, 11, 8);
        // pozza di luce a terra (fasce, non rettangolo netto)
        for (let k = 3; k >= 1; k--) {
          ctx.fillStyle = `rgba(224,192,120,${0.028 * k})`;
          ctx.fillRect(W * fx - 14 * k, g + 2, 28 * k, 10);
        }
      }
      // una macchina parcheggiata, spenta
      const cx = W * 0.66, cy = g - 4;
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(cx, cy - 14, 66, 16);
      ctx.fillStyle = '#2c2c34'; ctx.fillRect(cx + 10, cy - 24, 44, 12);
      ctx.fillStyle = '#1a1e24'; ctx.fillRect(cx + 14, cy - 21, 15, 9); ctx.fillRect(cx + 34, cy - 21, 15, 9);
      ctx.fillStyle = '#17171c'; ctx.fillRect(cx + 8, cy - 2, 12, 8); ctx.fillRect(cx + 46, cy - 2, 12, 8);
    },

    palazzo(ctx, W, H) {
      // androne con cassette della posta; quella di Daniele trabocca di pacchi
      const r = rng(2005);
      blocks(ctx, 0, 0, W, H, '#26262c', 16, r, 0.10);
      const floorY = H - 70;
      // pavimento in graniglia
      blocks(ctx, 0, floorY, W, H - floorY, '#3a3a40', 10, r, 0.14);
      ctx.fillStyle = 'rgba(200,200,205,.06)';
      for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, floorY + 4 + r() * (H - floorY - 8), 3, 2);
      // plafoniera al neon, un tubo mezzo morto
      ctx.fillStyle = '#33333a'; ctx.fillRect(W * 0.34, 14, W * 0.32, 8);
      glow(ctx, W * 0.5, 26, W * 0.28, 18, '198,206,214');
      ctx.fillStyle = '#c6ced6'; ctx.fillRect(W * 0.36, 20, W * 0.28, 4);
      ctx.fillStyle = '#6a6e74'; ctx.fillRect(W * 0.36 + W * 0.19, 20, W * 0.05, 4); // il tratto morto
      // il muro delle CASSETTE DELLA POSTA
      const mx = W * 0.08, mw = W * 0.50, my = H * 0.26, rows = 3, colsN = 5;
      blocks(ctx, mx - 8, my - 8, mw + 16, rows * 34 + 16, '#4a4a52', 8, r, 0.08);
      for (let ro = 0; ro < rows; ro++) for (let co = 0; co < colsN; co++) {
        const cxx = mx + co * (mw / colsN), cyy = my + ro * 34;
        ctx.fillStyle = '#5a5a62'; ctx.fillRect(cxx, cyy, mw / colsN - 6, 28);
        ctx.fillStyle = '#3a3a42'; ctx.fillRect(cxx + 6, cyy + 6, mw / colsN - 18, 4); // feritoia
        ctx.fillStyle = '#84848c'; ctx.fillRect(cxx + 6, cyy + 18, 12, 5);            // etichetta
      }
      // LA CASSETTA DI DANIELE: sportello divelto, posta e pacchi che traboccano
      const dx = mx + 2 * (mw / colsN), dy = my + 34;
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(dx, dy, mw / colsN - 6, 28);
      ctx.fillStyle = '#8a8a92'; // sportello aperto, storto
      ctx.save(); ctx.translate(dx + 4, dy + 26); ctx.rotate(0.5); ctx.fillRect(0, 0, mw / colsN - 14, 22); ctx.restore();
      ctx.fillStyle = '#d8d4c8'; // buste che sbordano
      ctx.fillRect(dx + 4, dy + 8, 18, 6); ctx.fillRect(dx + 14, dy + 14, 20, 6); ctx.fillRect(dx + 2, dy + 18, 16, 6);
      // pila di pacchi a terra sotto la cassetta
      ctx.fillStyle = '#7a6a52'; ctx.fillRect(dx - 6, floorY - 26, 40, 26);
      ctx.fillStyle = '#8a7a5e'; ctx.fillRect(dx + 2, floorY - 46, 34, 20);
      ctx.fillStyle = '#6a5c48'; ctx.fillRect(dx + 10, floorY - 62, 26, 16);
      ctx.fillStyle = '#c8b878'; // nastro adesivo
      ctx.fillRect(dx - 6, floorY - 16, 40, 4); ctx.fillRect(dx + 2, floorY - 38, 34, 4); ctx.fillRect(dx + 10, floorY - 56, 26, 3);
      // le scale in fondo a destra, con corrimano
      for (let i = 0; i < 6; i++) blocks(ctx, W * 0.70 + i * 10, floorY - 12 - i * 13, W * 0.26 - i * 12, 13, '#33333a', 8, r, 0.10);
      ctx.fillStyle = '#54545c';
      for (let i = 0; i < 6; i++) ctx.fillRect(W * 0.72 + i * 10, floorY - 40 - i * 13, 4, 30);
      ctx.fillRect(W * 0.72, floorY - 44 - 5 * 13, 10 * 5 + 4, 4);
      // l'ascensore con la porta a soffietto e il cartello GUASTO
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(W * 0.64, floorY - 104, 4, 104);
      ctx.fillStyle = '#44444c'; ctx.fillRect(W * 0.645, floorY - 100, W * 0.045, 100);
      ctx.fillStyle = '#2e2e36';
      for (let i = 0; i < 5; i++) ctx.fillRect(W * 0.648 + i * W * 0.009, floorY - 96, 2, 92);
      ctx.fillStyle = '#d8d4c8'; ctx.fillRect(W * 0.647, floorY - 70, W * 0.04, 12);
      ctx.fillStyle = '#8a3a3a'; ctx.fillRect(W * 0.651, floorY - 67, W * 0.032, 3);
      // lo zerbino condominiale sbiadito davanti al portone (in basso)
      blocks(ctx, W * 0.36, H - 22, W * 0.28, 14, '#4a4438', 6, r, 0.14);
    },

    pianerottolo(ctx, W, H) {
      // la porta di Daniele: zerbino, luce a intermittenza
      const r = rng(2007);
      blocks(ctx, 0, 0, W, H, '#232329', 16, r, 0.10);
      const floorY = H - 64;
      blocks(ctx, 0, floorY, W, H - floorY, '#33333a', 10, r, 0.12);
      // la plafoniera che sfarfalla: mezza luce, alone irregolare
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(W * 0.47, 12, W * 0.06, 8);
      glow(ctx, W * 0.5, 26, 46, 22, '210,214,200');
      ctx.fillStyle = '#c2c6b6'; ctx.fillRect(W * 0.475, 18, W * 0.05, 5);
      // cono di luce debole: si ALLARGA scendendo, con ellissi morbide sovrapposte (niente rettangolo netto)
      ctx.fillStyle = 'rgba(210,214,200,.05)';
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const cy2 = 24 + t * H * 0.5;
        const rx = W * (0.05 + t * 0.14);
        const ry = H * 0.09;
        pixelEllipse(ctx, W * 0.5, cy2, rx, ry, 4);
      }
      // LA PORTA DI DANIELE, al centro
      door(ctx, W * 0.42, floorY, W * 0.16, 128, '#4a4038', '#33302c');
      // spioncino e targhetta col nome
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(W * 0.5 - 3, floorY - 104, 6, 6);
      ctx.fillStyle = '#b8b4a8'; ctx.fillRect(W * 0.5 - 14, floorY - 90, 28, 8);
      ctx.fillStyle = '#5a564e'; ctx.fillRect(W * 0.5 - 10, floorY - 88, 20, 3);
      // lo ZERBINO, consumato al centro
      blocks(ctx, W * 0.40, floorY + 4, W * 0.20, 14, '#5a5244', 6, r, 0.12);
      ctx.fillStyle = '#4a4438'; ctx.fillRect(W * 0.45, floorY + 7, W * 0.10, 8);
      // le porte dei vicini ai lati, più buie
      door(ctx, W * 0.06, floorY, W * 0.13, 116, '#3a3630', '#2a2824');
      door(ctx, W * 0.81, floorY, W * 0.13, 116, '#3a3630', '#2a2824');
      // il quadro elettrico che ronza, con la spia
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(W * 0.27, H * 0.30, 26, 34);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(W * 0.27 + 4, H * 0.30 + 4, 18, 22);
      ctx.fillStyle = '#c0242e'; ctx.fillRect(W * 0.27 + 8, H * 0.30 + 8, 4, 4); // la spia ROSSA: unico colore
      glow(ctx, W * 0.27 + 10, H * 0.30 + 10, 12, 10, '192,36,46');
      // la finestrella del pianerottolo sulla notte
      ctx.fillStyle = '#33302c'; ctx.fillRect(W * 0.68, H * 0.22, 44, 54);
      ctx.fillStyle = '#101016'; ctx.fillRect(W * 0.68 + 5, H * 0.22 + 5, 34, 44);
      ctx.fillStyle = '#8a8a96'; ctx.fillRect(W * 0.68 + 26, H * 0.22 + 12, 3, 3);
      ctx.fillStyle = '#33302c'; ctx.fillRect(W * 0.68 + 20, H * 0.22 + 5, 3, 44);
      // il campanello con l'etichetta scritta a mano
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(W * 0.60, floorY - 78, 8, 10);
      ctx.fillStyle = '#b8b4a8'; ctx.fillRect(W * 0.60 + 1, floorY - 76, 6, 4);
    },

    appartamento(ctx, W, H) {
      // interno bilocale ordinato ma DESATURATO: divano, TV
      const r = rng(2011);
      blocks(ctx, 0, 0, W, H, '#3a3a3e', 16, r, 0.08);
      const floorY = H - 72;
      // parquet sbiadito a doghe
      blocks(ctx, 0, floorY, W, H - floorY, '#55504a', 12, r, 0.10);
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      for (let y = floorY + 10; y < H; y += 12) for (let x = ((y / 12) % 2) * 30; x < W; x += 60) ctx.fillRect(x, y, 56, 2);
      // finestra sulla città notturna
      ctx.fillStyle = '#4a4a50'; ctx.fillRect(W * 0.70, 30, 116, 96);
      ctx.fillStyle = '#121218'; ctx.fillRect(W * 0.70 + 7, 37, 102, 82);
      ctx.fillStyle = '#8a8a96'; ctx.fillRect(W * 0.70 + 20, 52, 3, 3); ctx.fillRect(W * 0.70 + 70, 44, 3, 3);
      ctx.fillStyle = '#c8b482'; ctx.fillRect(W * 0.70 + 44, 70, 6, 8); // una finestra accesa lontana
      ctx.fillStyle = '#4a4a50'; ctx.fillRect(W * 0.70 + 55, 37, 4, 82);
      // la libreria bassa ordinata, dorsi tutti grigi
      blocks(ctx, W * 0.04, floorY - 66, W * 0.16, 66, '#45413c', 8, r, 0.10);
      for (let sh = 0; sh < 3; sh++) {
        const sy = floorY - 58 + sh * 20;
        ctx.fillStyle = '#332f2b'; ctx.fillRect(W * 0.045, sy + 14, W * 0.15, 3);
        for (let b = 0; b < 7; b++) {
          ctx.fillStyle = ['#5a5a5e', '#66666a', '#4e4e52'][b % 3];
          ctx.fillRect(W * 0.05 + b * W * 0.02, sy, W * 0.015, 14);
        }
      }
      // IL DIVANO, al centro, di spalle verso la TV
      const sx = W * 0.30, sy2 = floorY - 44;
      blocks(ctx, sx, sy2, W * 0.26, 34, '#5c5c62', 8, r, 0.10);         // seduta+schienale
      blocks(ctx, sx, sy2 - 16, W * 0.26, 18, '#54545a', 8, r, 0.08);    // schienale
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(sx - 8, sy2 - 8, 12, 42); ctx.fillRect(sx + W * 0.26 - 4, sy2 - 8, 12, 42); // braccioli
      ctx.fillStyle = '#66666c'; ctx.fillRect(sx + 12, sy2 - 12, 24, 16); ctx.fillRect(sx + W * 0.26 - 38, sy2 - 12, 24, 16); // cuscini
      // il plaid piegato con cura: ORDINATO, non abbandonato
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(sx + W * 0.13 - 14, sy2 - 6, 28, 10);
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(sx + W * 0.13 - 14, sy2 - 2, 28, 2);
      // mobile TV + TV accesa su STATICO grigio
      blocks(ctx, W * 0.63, floorY - 26, W * 0.20, 26, '#45413c', 8, r, 0.10);
      tvScreen(ctx, W * 0.655, floorY - 78, W * 0.15, 48, '150,160,170', '#77828c');
      ctx.fillStyle = 'rgba(220,224,228,.5)';
      for (let i = 0; i < 26; i++) ctx.fillRect(W * 0.655 + r() * (W * 0.15 - 3), floorY - 78 + r() * 45, 2, 2);
      // il tavolino con UNA lattina rossa, perfettamente centrata (il colore-firma)
      blocks(ctx, W * 0.40, floorY - 2, W * 0.10, 6, '#45413c', 6, r, 0.08);
      ctx.fillStyle = '#332f2b'; ctx.fillRect(W * 0.415, floorY + 4, 5, 12); ctx.fillRect(W * 0.475, floorY + 4, 5, 12);
      lattina(ctx, W * 0.445, floorY - 13);
      glow(ctx, W * 0.448, floorY - 8, 14, 12, '192,36,46');
      // il corridoio buio sulla sinistra: qualcosa non torna
      ctx.fillStyle = '#1d1d22'; ctx.fillRect(W * 0.22, H * 0.14, W * 0.05, floorY - H * 0.14);
      ctx.fillStyle = '#4a4a50'; ctx.fillRect(W * 0.215, H * 0.13, W * 0.06, 5);
      // lampada a stelo ACCANTO al divano, appoggiata a terra
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(W * 0.585, floorY - 70, 4, 70);
      ctx.fillRect(W * 0.575, floorY - 2, 24, 4);
      glow(ctx, W * 0.587, floorY - 76, 26, 18, '208,200,176');
      ctx.fillStyle = '#d0c8b0'; ctx.fillRect(W * 0.575, floorY - 82, 24, 12);
    },

    corridoio(ctx, W, H) {
      // il corridoio impossibile: prospettiva profonda, porte che si ripetono, buio in fondo
      const r = rng(2013);
      blocks(ctx, 0, 0, W, H, '#2c2c32', 16, r, 0.10);
      const floorY = H - 60;
      blocks(ctx, 0, floorY, W, H - floorY, '#44403a', 12, r, 0.12);
      // il punto di fuga: buio denso al centro
      const vpx = W * 0.5, vpy = H * 0.44;
      // pareti/soffitto/pavimento che convergono a fasce sempre più scure
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const x0 = W * 0.5 * t, y0 = vpy * t * 0.9, w0 = W - W * t;
        const c = shade('#2c2c32', 1 - t * 0.75);
        ctx.fillStyle = c;
        ctx.fillRect(x0, y0, w0, 8);                              // soffitto che scende
        ctx.fillRect(x0, floorY - (floorY - vpy) * t, w0, 8);     // pavimento che sale
      }
      // battiscopa convergenti
      ctx.fillStyle = '#1d1d22';
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        ctx.fillRect(W * (0.06 + t * 0.38), floorY - (floorY - vpy) * t, 5, 6);
        ctx.fillRect(W * (0.94 - t * 0.38), floorY - (floorY - vpy) * t, 5, 6);
      }
      // PORTE IDENTICHE che si ripetono, sempre più piccole verso il fondo
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const dh = 118 * (1 - t * 0.62), dw = W * 0.11 * (1 - t * 0.6);
        const fy = floorY - (floorY - vpy) * t + 4;
        door(ctx, W * (0.08 + t * 0.30), fy, dw, dh, '#4a4038', '#33302c');
        door(ctx, W * (0.92 - t * 0.30) - dw, fy, dw, dh, '#4a4038', '#33302c');
      }
      // il BUIO in fondo: un rettangolo di niente, con un ultimo gradino di luce prima
      ctx.fillStyle = 'rgba(200,204,196,.05)';
      ctx.fillRect(vpx - W * 0.09, vpy - 20, W * 0.18, floorY - (floorY - vpy) - vpy + 60);
      ctx.fillStyle = '#0c0c10';
      ctx.fillRect(vpx - W * 0.06, vpy - 12, W * 0.12, (floorY - vpy) * 0.34 + 12);
      // le plafoniere in fila: le prime accese, le ultime morte
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const px2 = vpx, py2 = 20 + (vpy - 34) * t;
        const lw = 26 * (1 - t * 0.55);
        if (i < 2) {
          glow(ctx, px2, py2 + 4, lw + 14, 14, '206,210,198');
          ctx.fillStyle = '#c6cabe';
        } else ctx.fillStyle = '#4a4a50';
        ctx.fillRect(px2 - lw / 2, py2, lw, 4);
      }
      // la striscia di corsa del tappeto, che il fondo inghiotte
      blocks(ctx, W * 0.42, floorY + 2, W * 0.16, H - floorY - 4, '#4a3e3a', 8, r, 0.12);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(W * 0.42, floorY + 2, W * 0.16, 2);
    },

    salotto(ctx, W, H) {
      // il Salotto-Cattedrale: soffitto altissimo nel buio, divano enorme, TV come vetrata
      const r = rng(2017);
      blocks(ctx, 0, 0, W, H, '#1a1a20', 16, r, 0.14);
      const floorY = H - 66;
      blocks(ctx, 0, floorY, W, H - floorY, '#3a3833', 12, r, 0.12);
      // colonne di "muro" che salgono e si perdono nel buio in alto
      for (const fx of [0.06, 0.28, 0.72, 0.94]) {
        blocks(ctx, W * fx - 12, 0, 26, floorY, '#26262c', 10, r, 0.12);
        ctx.fillStyle = 'rgba(10,10,14,.5)'; ctx.fillRect(W * fx - 12, 0, 26, H * 0.30);
      }
      // il buio del soffitto: fasce che si spengono salendo
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(8,8,12,${0.14 + i * 0.10})`;
        ctx.fillRect(0, 0, W, H * 0.28 - i * H * 0.05);
      }
      // LA TV-VETRATA: enorme, verticale, luce grigio-azzurra da cattedrale
      const tx = W * 0.40, tw = W * 0.20, ty = H * 0.10, th = floorY - ty - 30;
      glow(ctx, tx + tw / 2, ty + th / 2, tw * 1.3, th * 0.9, '138,168,190');
      ctx.fillStyle = '#17171c'; ctx.fillRect(tx - 8, ty - 8, tw + 16, th + 16);
      ctx.fillStyle = '#7a94a8'; ctx.fillRect(tx, ty, tw, th);
      // "piombature" da vetrata sopra lo schermo
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(tx, ty + th * 0.33, tw, 4); ctx.fillRect(tx, ty + th * 0.66, tw, 4);
      ctx.fillRect(tx + tw * 0.5 - 2, ty, 4, th);
      // riquadri con toni diversi, come scene di santi
      ctx.fillStyle = '#94aec0'; ctx.fillRect(tx + 4, ty + 4, tw * 0.5 - 8, th * 0.33 - 8);
      ctx.fillStyle = '#5a7486'; ctx.fillRect(tx + tw * 0.5 + 4, ty + th * 0.33 + 6, tw * 0.5 - 8, th * 0.33 - 10);
      ctx.fillStyle = '#a8bcc8'; ctx.fillRect(tx + 4, ty + th * 0.66 + 6, tw * 0.5 - 8, th * 0.33 - 12);
      // il mobile TV sotto: lo schermo POGGIA, non fluttua
      blocks(ctx, tx - 14, floorY - 30, tw + 28, 30, '#3a362f', 8, r, 0.10);
      // IL DIVANO ENORME, di spalle, davanti alla vetrata
      const sx = W * 0.22, sw = W * 0.56, sy2 = floorY - 12;
      blocks(ctx, sx, sy2 - 44, sw, 44, '#4e4e56', 10, r, 0.10);
      blocks(ctx, sx, sy2 - 64, sw, 24, '#46464e', 10, r, 0.08);
      ctx.fillStyle = '#3e3e46';
      ctx.fillRect(sx - 14, sy2 - 54, 18, 54); ctx.fillRect(sx + sw - 4, sy2 - 54, 18, 54);
      ctx.fillStyle = '#585860';
      for (let i = 0; i < 4; i++) ctx.fillRect(sx + 16 + i * sw / 4, sy2 - 60, sw / 4 - 20, 18);
      // l'impronta di CHI ci si è seduto per anni: l'incavo al centro
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx + sw * 0.42, sy2 - 58, sw * 0.16, 40);
      // candele? no: lattine-lumino ai piedi della vetrata, UNA rossa vera
      for (let i = 0; i < 5; i++) {
        const lx2 = tx - 10 + i * (tw + 20) / 4;
        ctx.fillStyle = '#55555c'; ctx.fillRect(lx2, floorY - 11, 6, 10);
      }
      lattina(ctx, tx + tw / 2 - 3, floorY - 12);
      glow(ctx, tx + tw / 2, floorY - 7, 12, 10, '192,36,46');
      // tappeto consumato davanti al divano
      blocks(ctx, W * 0.30, floorY + 6, W * 0.40, H - floorY - 10, '#443f38', 10, r, 0.12);
    },

    biblioteca(ctx, W, H) {
      // scaffali altissimi di libri grigi, scale a pioli, UNA copertina colorata
      const r = rng(2027);
      blocks(ctx, 0, 0, W, H, '#22221f', 16, r, 0.10);
      const floorY = H - 58;
      blocks(ctx, 0, floorY, W, H - floorY, '#3a362e', 12, r, 0.12);
      // tre torri di scaffali che salgono oltre il bordo alto
      for (const [fx, fw] of [[0.03, 0.27], [0.36, 0.28], [0.70, 0.27]]) {
        blocks(ctx, W * fx, 0, W * fw, floorY, '#3a352c', 8, r, 0.10);
        const shelfH = 26;
        for (let sy2 = floorY - shelfH; sy2 > -shelfH; sy2 -= shelfH) {
          ctx.fillStyle = '#2a261f'; ctx.fillRect(W * fx + 2, sy2 + shelfH - 4, W * fw - 4, 4);
          // dorsi grigi fitti, altezze irregolari
          let bx2 = W * fx + 6;
          while (bx2 < W * (fx + fw) - 10) {
            const bw2 = 5 + Math.floor(r() * 4), bh2 = 16 + Math.floor(r() * 6);
            ctx.fillStyle = ['#55554f', '#605e56', '#4a4a46', '#6a6862'][Math.floor(r() * 4)];
            ctx.fillRect(bx2, sy2 + shelfH - 4 - bh2, bw2, bh2);
            bx2 += bw2 + 1;
          }
        }
        // il buio che mangia la cima
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(10,10,10,${0.16 + i * 0.12})`;
          ctx.fillRect(W * fx, 0, W * fw, H * 0.22 - i * H * 0.045);
        }
      }
      // LA copertina colorata: turchese acceso, ad altezza d'occhio, seconda torre
      const cx2 = W * 0.47, cy2 = floorY - 26 * 3 - 4 - 20;
      ctx.fillStyle = '#2aa8a0'; ctx.fillRect(cx2, cy2, 9, 20);
      ctx.fillStyle = '#7ae0d8'; ctx.fillRect(cx2 + 2, cy2 + 3, 5, 3);
      glow(ctx, cx2 + 4, cy2 + 10, 22, 26, '42,168,160');
      // SCALA A PIOLI appoggiata alla seconda torre, fino allo scaffale del libro
      ctx.fillStyle = '#5a5044';
      const lx0 = W * 0.52, ly0 = floorY, lx1 = W * 0.475, ly1 = cy2 - 6;
      // montanti (inclinati a gradini)
      const stepsL = 8;
      for (let i = 0; i <= stepsL; i++) {
        const t = i / stepsL;
        const mx = lx0 + (lx1 - lx0) * t, my = ly0 + (ly1 - ly0) * t;
        ctx.fillRect(mx - 10, my - 4, 4, Math.max(4, (ly0 - ly1) / stepsL + 2));
        ctx.fillRect(mx + 8, my - 4, 4, Math.max(4, (ly0 - ly1) / stepsL + 2));
        if (i < stepsL) { ctx.fillStyle = '#6a5e50'; ctx.fillRect(mx - 10, my - 4, 22, 3); ctx.fillStyle = '#5a5044'; }
      }
      // lampada da lettura a stelo, cerchio di luce sul leggio
      blocks(ctx, W * 0.62, floorY - 34, W * 0.09, 12, '#4a4438', 8, r, 0.10); // tavolo da lettura
      ctx.fillStyle = '#332f28'; ctx.fillRect(W * 0.625, floorY - 22, 5, 22); ctx.fillRect(W * 0.69, floorY - 22, 5, 22);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(W * 0.645, floorY - 62, 3, 28);
      ctx.fillRect(W * 0.635, floorY - 36, 20, 3);
      glow(ctx, W * 0.65, floorY - 60, 20, 14, '216,200,160');
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(W * 0.635, floorY - 66, 16, 8);
      // il libro aperto sul tavolo, nella pozza di luce
      ctx.fillStyle = '#c8c4b8'; ctx.fillRect(W * 0.63, floorY - 40, 22, 7);
      ctx.fillStyle = '#8a867c'; ctx.fillRect(W * 0.64, floorY - 38, 2, 5);
      // pile di libri a terra, appoggiate al pavimento
      for (const [px2, n2] of [[W * 0.10, 4], [W * 0.86, 5]]) {
        for (let i = 0; i < n2; i++) {
          ctx.fillStyle = ['#55554f', '#605e56', '#4a4a46'][i % 3];
          ctx.fillRect(px2 - 12 + (i % 2) * 3, floorY - 6 - i * 6, 26, 6);
        }
      }
    },

    porte(ctx, W, H) {
      // corridoio di porte di colori sbagliati/sbiaditi con targhette
      const r = rng(2029);
      blocks(ctx, 0, 0, W, H, '#2a2a2e', 16, r, 0.10);
      const floorY = H - 62;
      blocks(ctx, 0, floorY, W, H - floorY, '#403c36', 12, r, 0.12);
      // carta da parati a righe stanche
      ctx.fillStyle = 'rgba(170,170,175,.05)';
      for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 8, floorY);
      // LE PORTE: colori che una volta erano vivi, ora anemici
      const cols = ['#6a5a68', '#5a6a5e', '#6e6250', '#50606a', '#6a5250'];
      const tags = ['#b8b4a8', '#a8a89e', '#b0aca0', '#a0a4a8', '#b4aa9c'];
      for (let i = 0; i < 5; i++) {
        const dx = W * 0.045 + i * W * 0.19;
        door(ctx, dx, floorY, W * 0.13, 116, cols[i], '#2e2c2a', tags[i]);
        // ogni targhetta con la sua "scritta"
        ctx.fillStyle = '#4a463e';
        ctx.fillRect(dx + W * 0.065 - 6, floorY - 126, 12, 2);
      }
      // da SOTTO una porta (la terza): un filo di luce calda — l'unico colore vero
      const dx3 = W * 0.045 + 2 * W * 0.19;
      glow(ctx, dx3 + W * 0.065, floorY + 2, W * 0.11, 8, '224,178,96');
      ctx.fillStyle = '#e0b260'; ctx.fillRect(dx3 + 3, floorY - 2, W * 0.13 - 6, 3);
      // e da sotto un'altra (la quinta): un'ombra che passa, buio più buio
      const dx5 = W * 0.045 + 4 * W * 0.19;
      ctx.fillStyle = '#0e0e12'; ctx.fillRect(dx5 + 3, floorY - 2, W * 0.13 - 6, 3);
      // appliques tra le porte, metà spente
      for (let i = 0; i < 4; i++) {
        const ax = W * 0.045 + (i + 1) * W * 0.19 - W * 0.03 + W * 0.065;
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(ax - 4, H * 0.30, 9, 12);
        if (i % 2 === 0) {
          glow(ctx, ax, H * 0.28, 18, 14, '198,198,188');
          ctx.fillStyle = '#c6c6bc'; ctx.fillRect(ax - 3, H * 0.27, 7, 7);
        } else { ctx.fillStyle = '#4a4a50'; ctx.fillRect(ax - 3, H * 0.27, 7, 7); }
      }
      // passatoia sbiadita lungo tutto il corridoio
      blocks(ctx, W * 0.02, floorY + 8, W * 0.96, H - floorY - 12, '#4a4038', 10, r, 0.12);
      ctx.fillStyle = 'rgba(180,176,168,.14)';
      ctx.fillRect(W * 0.02, floorY + 8, W * 0.96, 2); ctx.fillRect(W * 0.02, H - 6, W * 0.96, 2);
    },

    cameretta(ctx, W, H) {
      // cameretta anni '90: letto a castello, poster sbiaditi, pavimento diviso da nastro
      const r = rng(2039);
      blocks(ctx, 0, 0, W, H, '#3e3c42', 16, r, 0.08);
      const floorY = H - 68;
      blocks(ctx, 0, floorY, W, H - floorY, '#565048', 12, r, 0.10);
      // IL NASTRO ADESIVO che divide il pavimento (e sale sul muro): il confine dei gemelli
      ctx.fillStyle = '#8a8578';
      ctx.fillRect(W * 0.5 - 3, floorY, 6, H - floorY);
      ctx.fillRect(W * 0.5 - 3, H * 0.10, 6, floorY - H * 0.10);
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      for (let y = H * 0.12; y < H; y += 18) ctx.fillRect(W * 0.5 - 3, y, 6, 4);
      // LETTO A CASTELLO a sinistra
      const bx = W * 0.06, bw = W * 0.30;
      ctx.fillStyle = '#4a4238';
      ctx.fillRect(bx, floorY - 108, 7, 108); ctx.fillRect(bx + bw - 7, floorY - 108, 7, 108); // montanti a terra
      blocks(ctx, bx + 4, floorY - 96, bw - 8, 14, '#57544e', 8, r, 0.08);  // materasso sopra
      blocks(ctx, bx + 4, floorY - 40, bw - 8, 14, '#57544e', 8, r, 0.08);  // materasso sotto
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(bx + 8, floorY - 100, 22, 8); ctx.fillRect(bx + 8, floorY - 44, 22, 8); // cuscini
      ctx.fillStyle = '#4a4238'; ctx.fillRect(bx + 4, floorY - 82, bw - 8, 4); ctx.fillRect(bx + 4, floorY - 26, bw - 8, 4); // sponde
      // la scaletta del castello, appoggiata a terra
      ctx.fillStyle = '#4a4238';
      ctx.fillRect(bx + bw + 2, floorY - 96, 4, 96); ctx.fillRect(bx + bw + 16, floorY - 96, 4, 96);
      for (let i = 0; i < 6; i++) ctx.fillRect(bx + bw + 2, floorY - 88 + i * 16, 18, 3);
      // POSTER SBIADITI sopra i letti e a destra
      for (const [px2, pw2, ph2] of [[0.10, 0.10, 34], [0.24, 0.08, 28], [0.60, 0.11, 38], [0.76, 0.09, 30]]) {
        ctx.fillStyle = '#55555a'; ctx.fillRect(W * px2 - 2, H * 0.12 - 2, W * pw2 + 4, ph2 + 4);
        ctx.fillStyle = '#66666c'; ctx.fillRect(W * px2, H * 0.12, W * pw2, ph2);
        ctx.fillStyle = '#78787e';
        ctx.fillRect(W * px2 + 4, H * 0.12 + 5, W * pw2 - 8, 6); // titolo scolorito
        ctx.fillRect(W * px2 + 6, H * 0.12 + 16, W * pw2 * 0.5, ph2 - 22);
        // un angolo scollato
        ctx.fillStyle = '#4a4a50'; ctx.fillRect(W * px2 + W * pw2 - 6, H * 0.12, 6, 6);
      }
      // scrivania a destra con la lampada e il vecchio joypad
      blocks(ctx, W * 0.58, floorY - 36, W * 0.28, 10, '#4a4238', 8, r, 0.08);
      ctx.fillStyle = '#3a342c';
      ctx.fillRect(W * 0.59, floorY - 26, 6, 26); ctx.fillRect(W * 0.84, floorY - 26, 6, 26);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(W * 0.60, floorY - 52, 3, 16);
      ctx.fillRect(W * 0.595, floorY - 55, 14, 5);
      glow(ctx, W * 0.605, floorY - 52, 16, 12, '210,196,158');
      // il joypad grigio col filo
      ctx.fillStyle = '#7a7a80'; ctx.fillRect(W * 0.70, floorY - 42, 20, 9);
      ctx.fillStyle = '#c0242e'; ctx.fillRect(W * 0.715, floorY - 40, 3, 3); // il bottone ROSSO: il colore-firma
      ctx.fillStyle = '#55555a'; ctx.fillRect(W * 0.70 - 14, floorY - 37, 14, 2);
      // tappetino da gioco a destra del nastro
      blocks(ctx, W * 0.56, floorY + 8, W * 0.30, H - floorY - 14, '#4e4a42', 8, r, 0.10);
      // giocattoli grigi sparsi (a terra, mai a mezz'aria)
      ctx.fillStyle = '#6a6a70'; ctx.fillRect(W * 0.42, floorY + 10, 12, 8);
      ctx.fillStyle = '#5a5a60'; ctx.fillRect(W * 0.36, H - 16, 16, 8);
      ctx.fillStyle = '#74747a'; ctx.fillRect(W * 0.63, H - 20, 10, 10);
    },

    spiaggia_grigia(ctx, W, H) {
      // spiaggia di cenere, mare FERMO grigio, due racchettoni piantati, ombrellone rotto
      const r = rng(2053);
      skyGradient(ctx, W, H, '#54545a', '#8a8a8e', 10);
      // un sole senza forza dietro il velo
      ctx.fillStyle = 'rgba(200,200,204,.35)'; pixelDisc(ctx, W * 0.72, H * 0.16, 22);
      // IL MARE FERMO: fasce orizzontali immobili, nessuna onda
      const seaY = H * 0.38, shoreY = H * 0.62;
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        ctx.fillStyle = mix('#5e6468', '#787e82', t);
        ctx.fillRect(0, seaY + t * (shoreY - seaY), W, (shoreY - seaY) / 6 + 1);
      }
      // il riflesso del sole: una colonna spenta, FERMA
      ctx.fillStyle = 'rgba(210,210,214,.12)'; ctx.fillRect(W * 0.69, seaY, W * 0.06, shoreY - seaY);
      // la linea di riva: profilo irregolare di cenere bagnata, non una banda netta
      for (let x = 0; x < W; x += 14) {
        const off = Math.round((r() - 0.5) * 8);
        ctx.fillStyle = '#6e6a64'; ctx.fillRect(x, shoreY + off, 14, 8);
      }
      // LA SPIAGGIA DI CENERE
      ground(ctx, W, H, shoreY + 6, '#7a746a', r, 12, 10);
      // mucchietti di cenere e qualche conchiglia grigia
      for (let i = 0; i < 8; i++) {
        const px2 = r() * W, py2 = shoreY + 20 + r() * (H - shoreY - 30);
        ctx.fillStyle = '#68625a'; ctx.fillRect(px2, py2, 10 + r() * 12, 4);
      }
      ctx.fillStyle = '#9a968e';
      for (let i = 0; i < 5; i++) ctx.fillRect(r() * W, shoreY + 24 + r() * (H - shoreY - 36), 4, 3);
      // I DUE RACCHETTONI piantati nella cenere, uno di fronte all'altro:
      // il legno è l'unico colore CALDO rimasto (la firma affettuosa)
      for (const [fx, tilt] of [[0.30, -0.12], [0.44, 0.12]]) {
        ctx.save(); ctx.translate(W * fx, H * 0.80); ctx.rotate(tilt);
        ctx.fillStyle = '#a86a3a'; ctx.fillRect(-4, -26, 8, 26);            // manico piantato
        ctx.fillStyle = '#c08448'; pixelDisc(ctx, 0, -44, 20);              // il piatto
        ctx.fillStyle = '#a86a3a'; pixelDisc(ctx, 0, -44, 14);
        ctx.restore();
      }
      glow(ctx, W * 0.37, H * 0.72, 60, 34, '192,132,72');
      // la pallina, a metà strada, ferma da chissà quanto
      ctx.fillStyle = '#d8d4c8'; ctx.fillRect(W * 0.368, H * 0.83, 5, 5);
      // L'OMBRELLONE ROTTO: palo storto, metà tela crollata
      const ux = W * 0.72, uy = H * 0.86;
      ctx.save(); ctx.translate(ux, uy); ctx.rotate(-0.22);
      ctx.fillStyle = '#6a645c'; ctx.fillRect(-2, -64, 5, 64);
      ctx.restore();
      // la mezza calotta ancora su
      ctx.fillStyle = '#84807a';
      for (let k = 0; k < 4; k++) ctx.fillRect(ux - 40 + k * 3, uy - 66 + k * 4, 40 - k * 5, 5);
      // la mezza tela crollata che TOCCA la sabbia
      ctx.fillStyle = '#74706a';
      for (let k = 0; k < 5; k++) ctx.fillRect(ux + 6 + k * 5, uy - 46 + k * 9, 18 - k * 2, 8);
      ctx.fillRect(ux + 28, uy - 6, 14, 6);
      // stecche nude dove la tela non c'è più
      ctx.fillStyle = '#55524c';
      ctx.fillRect(ux + 4, uy - 60, 26, 3); ctx.fillRect(ux + 8, uy - 52, 30, 3);
      // orme che vanno verso il mare e SI FERMANO
      ctx.fillStyle = 'rgba(0,0,0,.20)';
      for (let i = 0; i < 6; i++) ctx.fillRect(W * 0.54 + i * 12, H * 0.92 - i * ((H * 0.92 - shoreY - 12) / 6), 7, 4);
    },

    cabina(ctx, W, H) {
      // interno aereo infinito: file di sedili con sagome, cappelliere, luce fredda
      const r = rng(2063);
      blocks(ctx, 0, 0, W, H, '#44464c', 16, r, 0.06);
      const floorY = H - 54;
      blocks(ctx, 0, floorY, W, H - floorY, '#35363c', 10, r, 0.08);
      // il tubo della fusoliera: soffitto curvo a fasce
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade('#4e5056', 1 - i * 0.08);
        ctx.fillRect(W * 0.02 * i, 0, W - W * 0.04 * i, 12 - i * 2);
      }
      // CAPPELLIERE lungo i lati, che convergono verso il fondo
      for (const side of [0, 1]) {
        for (let i = 0; i < 5; i++) {
          const t = i / 5;
          const bw = W * 0.15 * (1 - t * 0.55), bh = 22 * (1 - t * 0.5);
          const bx = side ? W * (0.98 - t * 0.36) - bw : W * (0.02 + t * 0.36);
          ctx.fillStyle = shade('#5a5c64', 1 - t * 0.4); ctx.fillRect(bx, 22 + t * 30, bw, bh);
          ctx.fillStyle = shade('#3e4046', 1 - t * 0.4); ctx.fillRect(bx, 22 + t * 30 + bh - 4, bw, 4);
        }
      }
      // la LUCE FREDDA: strisce al neon lungo il corridoio, convergenti
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const lw = W * 0.16 * (1 - t * 0.6);
        glow(ctx, W * 0.5, 16 + t * H * 0.30, lw, 10, '186,198,210');
        ctx.fillStyle = '#bac6d2'; ctx.fillRect(W * 0.5 - lw / 2, 14 + t * H * 0.30, lw, 3);
      }
      // FILE DI SEDILI in prospettiva, dal fondo verso di noi, con sagome
      for (let row = 5; row >= 0; row--) {
        const t = row / 6;                       // row 5 = lontano
        const sy2 = floorY - (floorY - H * 0.40) * t;
        const sh2 = 44 * (1 - t * 0.55), sw2 = W * 0.115 * (1 - t * 0.5);
        for (const side of [0, 1]) {
          for (let k = 0; k < 2; k++) {
            const sx2 = side ? W * (0.60 + t * 0.10) + k * (sw2 + 4) : W * (0.40 - t * 0.10) - (k + 1) * (sw2 + 4);
            // sedile: schienale + seduta appoggiata al pavimento della sua fila
            ctx.fillStyle = shade('#54565e', 1 - t * 0.35);
            ctx.fillRect(sx2, sy2 - sh2, sw2, sh2);
            ctx.fillStyle = shade('#484a52', 1 - t * 0.35);
            ctx.fillRect(sx2, sy2 - sh2, sw2, 6);
            ctx.fillStyle = shade('#3c3e46', 1 - t * 0.35);
            ctx.fillRect(sx2 - 2, sy2 - 4, sw2 + 4, 4);
            // sagome nei sedili: teste immobili, non tutte
            if ((row + k + side) % 2 === 0) {
              ctx.fillStyle = shade('#2c2c32', 1 - t * 0.2);
              ctx.fillRect(sx2 + sw2 * 0.25, sy2 - sh2 - 10 * (1 - t * 0.5), sw2 * 0.5, 12 * (1 - t * 0.5));
            }
          }
        }
      }
      // il fondo del corridoio: NON finisce — solo file sempre più piccole nel chiaro freddo
      ctx.fillStyle = 'rgba(186,198,210,.10)'; ctx.fillRect(W * 0.44, H * 0.30, W * 0.12, H * 0.14);
      ctx.fillStyle = '#6a737e';
      for (let i = 0; i < 3; i++) ctx.fillRect(W * 0.47 + i * 6, H * 0.36 + i * 3, 4, 6);
      // moquette del corridoio
      blocks(ctx, W * 0.42, floorY, W * 0.16, H - floorY, '#3e3a44', 8, r, 0.10);
      // il segnale ALLACCIARE LE CINTURE: acceso, ambra — l'unico punto caldo
      ctx.fillStyle = '#2e3036'; ctx.fillRect(W * 0.47, 26, W * 0.06, 12);
      glow(ctx, W * 0.5, 32, 20, 12, '224,168,72');
      ctx.fillStyle = '#e0a848'; ctx.fillRect(W * 0.482, 29, 8, 6);
      ctx.fillStyle = '#8a8a92'; ctx.fillRect(W * 0.508, 29, 8, 6);
      // finestrini: ovali neri sulla notte, nessuna nuvola
      for (const side of [0, 1]) for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const wx = side ? W * (0.93 - t * 0.30) : W * (0.04 + t * 0.30);
        ctx.fillStyle = '#26262c'; ctx.fillRect(wx, H * 0.34 + t * 16, 12 * (1 - t * 0.4), 16 * (1 - t * 0.4));
      }
    },

    stanza_sommersa(ctx, W, H) {
      // muro d'acqua nera verticale, scogli, UNA luce calda in fondo
      const r = rng(2069);
      blocks(ctx, 0, 0, W, H, '#14161c', 16, r, 0.12);
      const floorY = H - 56;
      // pavimento di roccia bagnata
      ground(ctx, W, H, floorY, '#2a2e34', r, 12, 10);
      ctx.fillStyle = 'rgba(160,180,200,.08)';
      for (let i = 0; i < 10; i++) ctx.fillRect(r() * W, floorY + 4 + r() * (H - floorY - 8), 16, 2);
      // IL MURO D'ACQUA: una parete verticale che occupa il fondo, nera e VIVA
      const wx = W * 0.30, ww = W * 0.70;
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        ctx.fillStyle = mix('#0a0e16', '#131a26', t * 0.7);
        ctx.fillRect(wx + t * ww * 0.04, 0, ww, floorY + 8);
      }
      // il bordo dell'acqua: colonna di schiuma immobile dove il muro incontra l'aria
      for (let y = 0; y < floorY + 6; y += 10) {
        const off = Math.round((r() - 0.5) * 6);
        ctx.fillStyle = 'rgba(178,196,210,.20)'; ctx.fillRect(wx - 3 + off, y, 5, 10);
        if (r() > 0.7) { ctx.fillStyle = 'rgba(210,224,234,.25)'; ctx.fillRect(wx - 6 + off, y + 3, 3, 4); }
      }
      // dentro l'acqua: cose sospese, appena leggibili
      ctx.fillStyle = 'rgba(120,140,158,.18)';
      for (let i = 0; i < 9; i++) ctx.fillRect(wx + 24 + r() * (ww - 60), 20 + r() * (floorY - 40), 8 + r() * 14, 3);
      // una sagoma lunga, in ombra, a mezza altezza (la paura di Claudia)
      ctx.fillStyle = 'rgba(20,26,34,.85)';
      ctx.fillRect(wx + ww * 0.30, H * 0.30, ww * 0.34, 14);
      ctx.fillRect(wx + ww * 0.58, H * 0.30 + 10, ww * 0.10, 8);
      // LA LUCE CALDA in fondo, dentro l'acqua: piccola, ostinata
      const lx2 = wx + ww * 0.72, ly2 = H * 0.56;
      glow(ctx, lx2, ly2, 46, 40, '232,180,96');
      glow(ctx, lx2, ly2, 22, 20, '240,200,120');
      ctx.fillStyle = '#e8b460'; ctx.fillRect(lx2 - 5, ly2 - 5, 10, 10);
      ctx.fillStyle = '#f5d898'; ctx.fillRect(lx2 - 2, ly2 - 2, 4, 4);
      // GLI SCOGLI davanti al muro, appoggiati al pavimento
      for (const [fx, s2] of [[0.12, 34], [0.24, 24], [0.46, 40], [0.68, 28], [0.86, 36]]) {
        const gx = W * fx, gy = floorY + 8;
        blocks(ctx, gx - s2 / 2, gy - s2 * 0.7, s2, s2 * 0.7, '#3a4046', 8, r, 0.20);
        blocks(ctx, gx - s2 * 0.3, gy - s2, s2 * 0.6, s2 * 0.4, '#444a52', 8, r, 0.18);
        // il bagnato che luccica sulla cresta
        ctx.fillStyle = 'rgba(190,206,220,.22)'; ctx.fillRect(gx - s2 * 0.2, gy - s2 + 2, s2 * 0.4, 2);
      }
      // pozze sul pavimento che riflettono la luce calda
      ctx.fillStyle = 'rgba(232,180,96,.10)';
      ctx.fillRect(W * 0.55, floorY + 10, 40, 5); ctx.fillRect(W * 0.72, floorY + 16, 30, 4);
      ctx.fillStyle = 'rgba(140,160,178,.12)';
      ctx.fillRect(W * 0.16, floorY + 14, 34, 4);
    },

    cucina_fredda(ctx, W, H) {
      // cucina industriale fredda, frigo enorme aperto, lattine rosse a FRECCIA
      const r = rng(2081);
      blocks(ctx, 0, 0, W, H, '#3a3e42', 16, r, 0.08);
      const floorY = H - 66;
      // piastrelle grandi da cucina industriale
      blocks(ctx, 0, floorY, W, H - floorY, '#4a4e52', 14, r, 0.08);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      for (let y = floorY; y < H; y += 14) ctx.fillRect(0, y, W, 2);
      for (let x = 0; x < W; x += 26) ctx.fillRect(x, floorY, 2, H - floorY);
      // neon freddi a soffitto
      for (const fx of [0.22, 0.60]) {
        ctx.fillStyle = '#33363a'; ctx.fillRect(W * fx, 10, W * 0.16, 6);
        glow(ctx, W * fx + W * 0.08, 18, W * 0.14, 14, '190,206,216');
        ctx.fillStyle = '#becbd6'; ctx.fillRect(W * fx + 4, 14, W * 0.16 - 8, 3);
      }
      // IL FRIGO ENORME, aperto, con la luce grigia che cola fuori
      const fx2 = W * 0.66, fw2 = W * 0.24, fh2 = H * 0.66;
      blocks(ctx, fx2, floorY - fh2, fw2, fh2, '#7e848a', 8, r, 0.06);
      // l'anta aperta
      ctx.fillStyle = '#8a9096';
      ctx.save(); ctx.translate(fx2, floorY - fh2); ctx.rotate(-0.06);
      ctx.fillRect(-fw2 * 0.55, 0, fw2 * 0.52, fh2 * 0.98); ctx.restore();
      ctx.fillStyle = '#6a7076'; ctx.fillRect(fx2 - fw2 * 0.52, floorY - fh2 + 10, 5, 24); // maniglia
      // l'interno: ripiani e LUCE GRIGIA (non calda: sbagliata)
      glow(ctx, fx2 + fw2 / 2, floorY - fh2 / 2, fw2 * 1.2, fh2 * 0.8, '176,182,190');
      ctx.fillStyle = '#b0b6be'; ctx.fillRect(fx2 + 6, floorY - fh2 + 6, fw2 - 12, fh2 - 12);
      ctx.fillStyle = '#8e949c';
      for (let i = 1; i < 4; i++) ctx.fillRect(fx2 + 6, floorY - fh2 + i * fh2 / 4, fw2 - 12, 4);
      // cibo GRIGIO sui ripiani: forme giuste, colore morto
      ctx.fillStyle = '#9aa0a8';
      ctx.fillRect(fx2 + 12, floorY - fh2 + 14, 14, 12); ctx.fillRect(fx2 + 32, floorY - fh2 + 18, 10, 8);
      ctx.fillStyle = '#878d95';
      ctx.fillRect(fx2 + 14, floorY - fh2 + fh2 / 4 + 8, 20, 10); ctx.fillRect(fx2 + 40, floorY - fh2 + fh2 / 4 + 12, 8, 6);
      ctx.fillStyle = '#a4aab2';
      ctx.fillRect(fx2 + 12, floorY - fh2 + fh2 / 2 + 10, 12, 14);
      // il PIANO D'ACCIAIO al centro
      blocks(ctx, W * 0.10, floorY - 40, W * 0.44, 12, '#8e949a', 8, r, 0.06);
      ctx.fillStyle = '#5a5e64';
      ctx.fillRect(W * 0.12, floorY - 28, 8, 28); ctx.fillRect(W * 0.50, floorY - 28, 8, 28);
      ctx.fillStyle = 'rgba(230,236,240,.20)'; ctx.fillRect(W * 0.10, floorY - 40, W * 0.44, 2);
      // LE LATTINE ROSSE A FRECCIA sul piano: il segnale di Daniele (il colore-firma!)
      const ax = W * 0.20, ay = floorY - 52;
      const arrow = [[0, 0], [1, 0], [2, 0], [3, 0], [2.4, -0.9], [2.4, 0.9], [3, 0]];
      for (const [dx2, dy2] of arrow) lattina(ctx, ax + dx2 * 22, ay + dy2 * 14);
      glow(ctx, ax + 33, ay + 5, 90, 30, '192,36,46');
      // cappa e pentole appese (alla barra della cappa, non a mezz'aria)
      ctx.fillStyle = '#4a4e54'; ctx.fillRect(W * 0.14, H * 0.14, W * 0.36, 16);
      ctx.fillStyle = '#3a3e44'; ctx.fillRect(W * 0.16, H * 0.14 + 16, W * 0.32, 4);
      for (let i = 0; i < 4; i++) {
        const px2 = W * 0.19 + i * W * 0.08;
        ctx.fillStyle = '#5e646a'; ctx.fillRect(px2, H * 0.14 + 20, 3, 8);
        ctx.fillStyle = '#787e86'; ctx.fillRect(px2 - 8, H * 0.14 + 28, 19, 12);
      }
      // lavello con rubinetto che gocciola una goccia FERMA
      blocks(ctx, W * 0.02, floorY - 34, W * 0.07, 34, '#6a7076', 8, r, 0.08);
      ctx.fillStyle = '#8e949a'; ctx.fillRect(W * 0.045, floorY - 48, 4, 14);
      ctx.fillRect(W * 0.045, floorY - 48, 14, 4);
      ctx.fillStyle = '#c8d4dc'; ctx.fillRect(W * 0.055 + 6, floorY - 40, 3, 4);
    },

    sottoscala(ctx, W, H) {
      // intercapedine infernale: tubi che pulsano, scala a pioli, buio denso
      const r = rng(2087);
      blocks(ctx, 0, 0, W, H, '#17151a', 16, r, 0.18);
      const floorY = H - 46;
      blocks(ctx, 0, floorY, W, H - floorY, '#100e12', 12, r, 0.16);
      // le due pareti strette dell'intercapedine
      blocks(ctx, 0, 0, W * 0.14, H, '#221f26', 10, r, 0.14);
      blocks(ctx, W * 0.86, 0, W * 0.14, H, '#221f26', 10, r, 0.14);
      // TUBI verticali e orizzontali, ancorati alle pareti con staffe
      const pipeCols = ['#3a333c', '#443a40', '#332e38'];
      for (const [fx, pw2] of [[0.17, 10], [0.25, 7], [0.78, 12], [0.70, 6]]) {
        ctx.fillStyle = pipeCols[Math.floor(r() * 3)];
        ctx.fillRect(W * fx, 0, pw2, H);
        ctx.fillStyle = '#55505a'; // staffe
        for (let y = 30; y < H; y += 70) ctx.fillRect(W * fx - 3, y, pw2 + 6, 5);
      }
      for (const fy of [0.16, 0.52]) {
        ctx.fillStyle = pipeCols[1]; ctx.fillRect(W * 0.14, H * fy, W * 0.72, 9);
        ctx.fillStyle = '#55505a';
        ctx.fillRect(W * 0.30, H * fy - 2, 6, 13); ctx.fillRect(W * 0.62, H * fy - 2, 6, 13);
      }
      // i tubi PULSANO: giunture che spandono un rosso sordo (l'unico colore)
      for (const [px2, py2] of [[W * 0.19, H * 0.30], [W * 0.80, H * 0.62], [W * 0.46, H * 0.52 + 4], [W * 0.28, H * 0.74]]) {
        glow(ctx, px2, py2, 30, 26, '150,40,44');
        ctx.fillStyle = '#96282c'; ctx.fillRect(px2 - 5, py2 - 5, 10, 10);
        ctx.fillStyle = '#c0453e'; ctx.fillRect(px2 - 2, py2 - 2, 4, 4);
      }
      // LA SCALA A PIOLI, dritta, dal pavimento su nel buio
      const lx2 = W * 0.48;
      ctx.fillStyle = '#4a4238';
      ctx.fillRect(lx2 - 12, 0, 5, floorY + 6); ctx.fillRect(lx2 + 8, 0, 5, floorY + 6);
      ctx.fillStyle = '#5a5044';
      for (let y = 14; y < floorY; y += 20) ctx.fillRect(lx2 - 12, y, 25, 4);
      // il buio DENSO in alto: la scala ci sparisce dentro
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(6,5,8,${0.18 + i * 0.13})`;
        ctx.fillRect(0, 0, W, H * 0.30 - i * H * 0.05);
      }
      // in basso: il passaggio strisciante verso il banco del Mercante, con un lume lontano
      ctx.fillStyle = '#0a090c'; ctx.fillRect(W * 0.30, floorY - 34, W * 0.13, 34);
      glow(ctx, W * 0.365, floorY - 16, 18, 14, '224,178,96');
      ctx.fillStyle = '#e0b260'; ctx.fillRect(W * 0.36, floorY - 18, 4, 4);
      // cavi che corrono lungo la parete, fissati con clip
      ctx.fillStyle = '#26232a';
      for (let i = 0; i < 3; i++) {
        const cy2 = H * 0.82 + i * 5;
        ctx.fillRect(W * 0.14, cy2, W * 0.72, 2);
      }
      ctx.fillStyle = '#3a3640';
      for (let x = W * 0.2; x < W * 0.86; x += W * 0.16) ctx.fillRect(x, H * 0.81, 4, 12);
      // condensa che luccica
      ctx.fillStyle = 'rgba(150,160,180,.10)';
      for (let i = 0; i < 8; i++) ctx.fillRect(W * 0.14 + r() * W * 0.72, r() * H, 2, 6);
    },

    mercante(ctx, W, H) {
      // banco di compensato tra i tubi, lampada da campeggio, merci appese
      const r = rng(2089);
      blocks(ctx, 0, 0, W, H, '#191720', 16, r, 0.16);
      const floorY = H - 56;
      blocks(ctx, 0, floorY, W, H - floorY, '#121016', 12, r, 0.14);
      // tubi di contorno, come nel sottoscala, con staffe
      ctx.fillStyle = '#3a333c'; ctx.fillRect(W * 0.06, 0, 9, H);
      ctx.fillStyle = '#443a40'; ctx.fillRect(W * 0.92, 0, 11, H);
      ctx.fillStyle = '#55505a';
      for (let y = 24; y < H; y += 64) { ctx.fillRect(W * 0.06 - 3, y, 15, 5); ctx.fillRect(W * 0.92 - 3, y, 17, 5); }
      ctx.fillStyle = '#332e38'; ctx.fillRect(W * 0.06, H * 0.14, W * 0.86, 8);
      // IL BANCO DI COMPENSATO: assi diseguali su cavalletti
      const bx = W * 0.28, bw = W * 0.44;
      ctx.fillStyle = '#4a3e30';
      ctx.fillRect(bx + 8, floorY - 32, 10, 32); ctx.fillRect(bx + bw - 18, floorY - 32, 10, 32); // cavalletti
      ctx.fillRect(bx + 4, floorY - 26, 18, 4); ctx.fillRect(bx + bw - 22, floorY - 26, 18, 4);
      blocks(ctx, bx, floorY - 40, bw, 10, '#6a5a42', 8, r, 0.14);
      ctx.fillStyle = '#554836'; ctx.fillRect(bx, floorY - 40, bw, 2);
      ctx.fillStyle = '#3a3228'; ctx.fillRect(bx + bw * 0.35, floorY - 39, 3, 9); // la giuntura tra le assi
      // LA LAMPADA DA CAMPEGGIO sul banco: IL cerchio di luce calda della scena
      const lx2 = bx + bw * 0.5, ly2 = floorY - 54;
      glow(ctx, lx2, ly2, 90, 70, '232,180,96');
      glow(ctx, lx2, ly2, 44, 36, '240,200,120');
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(lx2 - 8, ly2 + 4, 16, 10);      // base sul banco
      ctx.fillStyle = '#f0d090'; ctx.fillRect(lx2 - 6, ly2 - 8, 12, 12);      // il globo
      ctx.fillStyle = '#fae8c0'; ctx.fillRect(lx2 - 3, ly2 - 5, 6, 6);
      ctx.fillStyle = '#55555c'; ctx.fillRect(lx2 - 7, ly2 - 12, 14, 4);      // il manico
      // MERCI APPESE a una corda tesa tra i tubi (mollette comprese)
      ctx.fillStyle = '#6a625a'; ctx.fillRect(W * 0.10, H * 0.30, W * 0.80, 2);
      const wares = [
        ['#7a746a', 12, 16], ['#5c6a5e', 10, 12], ['#6a5a68', 14, 10],
        ['#556066', 9, 14], ['#6e6250', 12, 12], ['#60565e', 10, 16],
      ];
      for (let i = 0; i < wares.length; i++) {
        const [c2, ww2, wh2] = wares[i];
        const wx2 = W * (0.14 + i * 0.13);
        ctx.fillStyle = '#4a4438'; ctx.fillRect(wx2 + ww2 / 2 - 1, H * 0.30 + 2, 2, 8); // gancetto
        ctx.fillStyle = c2; ctx.fillRect(wx2, H * 0.30 + 10, ww2, wh2);
      }
      // sul banco: boccette, un barattolo che CONTIENE colore (rosso: firma)
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(bx + 24, floorY - 52, 8, 12);
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(bx + 38, floorY - 50, 7, 10);
      ctx.fillStyle = '#8a8a92'; ctx.fillRect(bx + bw - 60, floorY - 50, 10, 10);
      ctx.fillStyle = '#c0242e'; ctx.fillRect(bx + bw - 44, floorY - 52, 9, 12); // IL barattolo
      ctx.fillStyle = '#e8646a'; ctx.fillRect(bx + bw - 42, floorY - 50, 5, 4);
      glow(ctx, bx + bw - 40, floorY - 46, 18, 16, '192,36,46');
      // pile di cianfrusaglie ai piedi del banco
      blocks(ctx, bx - 34, floorY - 20, 30, 20, '#3a342c', 8, r, 0.16);
      blocks(ctx, bx + bw + 6, floorY - 26, 34, 26, '#332e28', 8, r, 0.16);
      ctx.fillStyle = '#55505a'; ctx.fillRect(bx + bw + 12, floorY - 32, 14, 6);
      // il buio fitto alle spalle del banco: il Mercante ci vive dentro
      // (cornici concentriche: niente rettangolo netto sospeso sul muro)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(6,5,8,.20)';
        ctx.fillRect(W * (0.30 + i * 0.035), H * (0.16 + i * 0.03), W * (0.40 - i * 0.07), H * (0.22 - i * 0.055));
      }
    },

    galleria(ctx, W, H) {
      // fila di teche di vetro illuminate da TV, sagome in pigiama dentro
      const r = rng(2099);
      blocks(ctx, 0, 0, W, H, '#1a1a1f', 16, r, 0.14);
      const floorY = H - 60;
      blocks(ctx, 0, floorY, W, H - floorY, '#26262c', 12, r, 0.10);
      // corsia lucida al centro, coi riflessi delle teche
      blocks(ctx, W * 0.06, floorY + 6, W * 0.88, H - floorY - 10, '#2e2e36', 10, r, 0.08);
      // LE TECHE: quattro vetrine, ognuna col suo piedistallo e la sua TV
      for (let i = 0; i < 4; i++) {
        const tx = W * (0.06 + i * 0.24), tw = W * 0.17, th = H * 0.56, ty = floorY - th;
        // basamento a terra
        blocks(ctx, tx - 6, floorY - 12, tw + 12, 12, '#3a3a42', 8, r, 0.10);
        // la luce della TV dentro: ogni teca di una gradazione diversa di freddo
        const tones = [['138,168,190', '#8aa8be'], ['150,160,178', '#96a0b2'], ['128,150,164', '#8096a4'], ['160,170,180', '#a0aab4']];
        glow(ctx, tx + tw / 2, ty + th * 0.45, tw * 1.1, th * 0.7, tones[i][0]);
        // l'interno della teca
        ctx.fillStyle = '#22262c'; ctx.fillRect(tx, ty, tw, th - 12);
        // la TV piccola in alto nella teca, fissata a una staffa
        ctx.fillStyle = '#3a3a42'; ctx.fillRect(tx + tw / 2 - 2, ty + 4, 4, 8);
        tvScreen(ctx, tx + tw / 2 - 15, ty + 12, 30, 20, tones[i][0], tones[i][1]);
        // LA SAGOMA IN PIGIAMA: seduta sul suo pouf, faccia allo schermo
        blocks(ctx, tx + tw / 2 - 12, floorY - 26, 24, 14, '#3e3a44', 6, r, 0.10); // il pouf
        sagoma(ctx, tx + tw / 2, floorY - 24, 44, '#55525c', true);
        // le righe del pigiama
        ctx.fillStyle = '#66626e';
        ctx.fillRect(tx + tw / 2 - 7, floorY - 48, 14, 2); ctx.fillRect(tx + tw / 2 - 7, floorY - 42, 14, 2);
        // il vetro: montanti + riflesso diagonale
        ctx.fillStyle = '#4a4e56';
        ctx.fillRect(tx - 2, ty - 4, tw + 4, 5); ctx.fillRect(tx - 2, ty, 3, th - 12); ctx.fillRect(tx + tw - 1, ty, 3, th - 12);
        ctx.fillStyle = 'rgba(210,220,230,.07)';
        for (let k = 0; k < 3; k++) ctx.fillRect(tx + 6 + k * 4, ty + 8 + k * 18, 3, 26);
        // la targhetta d'ottone sul basamento (senza nome leggibile)
        ctx.fillStyle = '#8a8578'; ctx.fillRect(tx + tw / 2 - 10, floorY - 9, 20, 6);
        // il riflesso della teca sulla corsia
        ctx.fillStyle = `rgba(${tones[i][0]},.06)`; ctx.fillRect(tx + 4, floorY + 6, tw - 8, H - floorY - 12);
      }
      // il soffitto se lo mangia il buio
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(8,8,12,${0.16 + i * 0.12})`;
        ctx.fillRect(0, 0, W, H * 0.16 - i * H * 0.032);
      }
    },

    sala_switch(ctx, W, H) {
      // schermo GIGANTE a parete con colori piatti finti, cavi come radici sul pavimento
      const r = rng(2111);
      blocks(ctx, 0, 0, W, H, '#1d1d24', 16, r, 0.12);
      const floorY = H - 62;
      blocks(ctx, 0, floorY, W, H - floorY, '#2a2a30', 12, r, 0.10);
      // LO SCHERMO GIGANTE: quasi tutta la parete
      const sx = W * 0.14, sw = W * 0.72, sy2 = H * 0.08, sh2 = floorY - sy2 - 26;
      glow(ctx, sx + sw / 2, sy2 + sh2 / 2, sw * 0.9, sh2 * 0.9, '150,170,186');
      ctx.fillStyle = '#111116'; ctx.fillRect(sx - 10, sy2 - 10, sw + 20, sh2 + 20);
      // la "vita finta in loop": colori PIATTI, da videogioco allegro ma tutti spenti a metà
      ctx.fillStyle = '#7a9ab0'; ctx.fillRect(sx, sy2, sw, sh2 * 0.55);                 // cielo finto
      ctx.fillStyle = '#7ba078'; ctx.fillRect(sx, sy2 + sh2 * 0.55, sw, sh2 * 0.45);     // prato finto
      ctx.fillStyle = '#b8c8d2'; pixelDisc(ctx, sx + sw * 0.78, sy2 + sh2 * 0.2, 14);    // sole piatto
      // nuvolette a blocchi
      ctx.fillStyle = '#c8d2da';
      ctx.fillRect(sx + sw * 0.16, sy2 + sh2 * 0.14, 34, 8); ctx.fillRect(sx + sw * 0.22, sy2 + sh2 * 0.10, 20, 8);
      ctx.fillRect(sx + sw * 0.50, sy2 + sh2 * 0.22, 28, 8);
      // la casetta finta e l'omino finto: la vita che Eleinad gli proietta
      // (piantata SUL prato finto, non a mezz'aria nel cielo)
      const hy2 = sy2 + sh2 * 0.55 - 26;
      ctx.fillStyle = '#a08468'; ctx.fillRect(sx + sw * 0.30, hy2, 44, 30);
      ctx.fillStyle = '#7a5a46'; for (let i = 0; i < 3; i++) ctx.fillRect(sx + sw * 0.30 - 6 + i * 6, hy2 - 6 - i * 5, 56 - i * 12, 5);
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(sx + sw * 0.345, hy2 + 16, 10, 14);
      // l'omino: fermo a metà passo, DA SEMPRE
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(sx + sw * 0.58, sy2 + sh2 * 0.62, 10, 18); ctx.fillRect(sx + sw * 0.585, sy2 + sh2 * 0.56, 8, 8);
      // glitch: righe orizzontali dove il loop si riavvia
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.fillRect(sx, sy2 + sh2 * 0.33, sw, 3); ctx.fillRect(sx, sy2 + sh2 * 0.78, sw, 2);
      ctx.fillStyle = 'rgba(20,20,28,.18)'; ctx.fillRect(sx + sw * 0.62, sy2, sw * 0.06, sh2);
      // il mobiletto sotto lo schermo con la console: il LED blu acceso
      blocks(ctx, sx + sw * 0.36, floorY - 26, sw * 0.28, 26, '#33333a', 8, r, 0.10);
      ctx.fillStyle = '#26262c'; ctx.fillRect(sx + sw * 0.44, floorY - 20, sw * 0.12, 10);
      ctx.fillStyle = '#4a90c8'; ctx.fillRect(sx + sw * 0.445, floorY - 18, 3, 6); // l'unico colore acceso
      glow(ctx, sx + sw * 0.45, floorY - 15, 12, 10, '74,144,200');
      // I CAVI COME RADICI: dal mobiletto si allargano su tutto il pavimento
      ctx.fillStyle = '#17171c';
      const cx2 = sx + sw * 0.5;
      for (let i = 0; i < 7; i++) {
        let px2 = cx2, py2 = floorY - 2, dirx = (i - 3) * 0.9;
        for (let seg = 0; seg < 7; seg++) {
          const len = 10 + r() * 16;
          ctx.fillRect(Math.min(px2, px2 + dirx * len), py2, Math.abs(dirx * len) + 4, 4);
          px2 += dirx * len; py2 += 5 + r() * 6;
          if (py2 > H - 8) break;
        }
      }
      // nodi/radici più grosse dove i cavi si accavallano
      ctx.fillStyle = '#221f26';
      for (let i = 0; i < 5; i++) ctx.fillRect(W * (0.2 + i * 0.15), floorY + 6 + (i % 3) * 8, 14, 7);
    },

    trono(ctx, W, H) {
      // il Divano-Trono su una pedana, bozzolo di filamenti grigi, cavo HDMI innestato
      const r = rng(2113);
      blocks(ctx, 0, 0, W, H, '#16161c', 16, r, 0.16);
      const floorY = H - 58;
      blocks(ctx, 0, floorY, W, H - floorY, '#26262c', 12, r, 0.12);
      // il buio alto della sala
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(6,6,10,${0.16 + i * 0.13})`;
        ctx.fillRect(0, 0, W, H * 0.24 - i * H * 0.05);
      }
      // LA PEDANA a gradoni, al centro
      for (let i = 0; i < 3; i++) {
        const pw2 = W * (0.62 - i * 0.10);
        blocks(ctx, W * 0.5 - pw2 / 2, floorY - 10 - i * 10, pw2, 12, shade('#3a3a42', 1 + i * 0.06), 8, r, 0.10);
      }
      const topY = floorY - 30; // piano della pedana
      // IL DIVANO-TRONO: schienale altissimo, braccioli come colonne
      const dx = W * 0.32, dw = W * 0.36;
      blocks(ctx, dx, topY - 110, dw, 40, '#4a4a54', 8, r, 0.10);           // cimasa dello schienale
      blocks(ctx, dx + 6, topY - 80, dw - 12, 56, '#42424c', 8, r, 0.10);   // schienale
      blocks(ctx, dx + 8, topY - 30, dw - 16, 30, '#4e4e58', 8, r, 0.10);   // seduta
      blocks(ctx, dx - 16, topY - 64, 22, 64, '#3a3a44', 8, r, 0.10);       // bracciolo-colonna sx
      blocks(ctx, dx + dw - 6, topY - 64, 22, 64, '#3a3a44', 8, r, 0.10);   // bracciolo-colonna dx
      // IL BOZZOLO sul trono: filamenti grigi avvolti, con Daniele dentro
      const bx = W * 0.5, by = topY - 44;
      glow(ctx, bx, by, 60, 60, '150,150,158');
      ctx.fillStyle = '#6a6a72';
      pixelDisc(ctx, bx, by, 30);
      ctx.fillStyle = '#7a7a82'; pixelDisc(ctx, bx - 4, by - 6, 20);
      // i filamenti: fasce che avvolgono il bozzolo e SCENDONO ancorandosi a trono e pedana
      ctx.fillStyle = '#55555e';
      for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.6 + i * 0.3);
        ctx.fillRect(-34, -3 + i, 68, 4); ctx.restore();
      }
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(bx - 34, by + 10, 5, topY - by - 10); ctx.fillRect(bx + 28, by + 4, 5, topY - by - 4);
      ctx.fillRect(bx - 6, by + 24, 4, topY - by - 24);
      // dentro il bozzolo: la sagoma rannicchiata, appena leggibile
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(bx - 10, by - 10, 20, 22);
      // IL CAVO HDMI innestato nel bozzolo, che serpeggia giù dalla pedana fino a fuori scena
      ctx.fillStyle = '#111116';
      ctx.fillRect(bx + 24, by + 2, 26, 5);
      let px2 = bx + 50, py2 = by + 2;
      for (let seg = 0; seg < 6; seg++) {
        ctx.fillRect(px2, py2, 5, 24); py2 += 24;
        ctx.fillRect(px2, py2, 26, 5); px2 += 26;
        if (py2 > H - 14) break;
      }
      // lo spinotto sul bozzolo, con la spia rossa: IL colore della scena
      ctx.fillStyle = '#26262c'; ctx.fillRect(bx + 18, by - 2, 10, 9);
      ctx.fillStyle = '#c0242e'; ctx.fillRect(bx + 20, by, 3, 3);
      glow(ctx, bx + 21, by + 1, 14, 12, '192,36,46');
      // due bracieri ai lati della pedana... spenti; resta un fumo dritto
      for (const fx of [0.16, 0.84]) {
        blocks(ctx, W * fx - 8, floorY - 26, 18, 26, '#33333a', 6, r, 0.12);
        ctx.fillStyle = '#44444c'; ctx.fillRect(W * fx - 11, floorY - 30, 24, 6);
        ctx.fillStyle = 'rgba(150,150,158,.12)';
        for (let k = 0; k < 4; k++) ctx.fillRect(W * fx - 2 + (k % 2) * 3, floorY - 44 - k * 12, 4, 10);
      }
    },

    cattedrale(ctx, W, H) {
      // navata di divani fusi come panche, TV-vetrate, il fondo con una sagoma-buco
      const r = rng(2129);
      blocks(ctx, 0, 0, W, H, '#15151b', 16, r, 0.16);
      const floorY = H - 56;
      blocks(ctx, 0, floorY, W, H - floorY, '#2c2c32', 12, r, 0.10);
      // il buio della volta
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(5,5,9,${0.15 + i * 0.12})`;
        ctx.fillRect(0, 0, W, H * 0.26 - i * H * 0.045);
      }
      // TV-VETRATE lungo le pareti: alte, strette, luce da acquario
      for (const side of [0, 1]) for (let i = 0; i < 3; i++) {
        const t = i / 3;
        const vw2 = W * 0.07 * (1 - t * 0.35), vh2 = H * 0.36 * (1 - t * 0.3);
        const vx2 = side ? W * (0.97 - t * 0.20) - vw2 : W * (0.03 + t * 0.20);
        const vy2 = H * 0.16 + t * H * 0.06;
        glow(ctx, vx2 + vw2 / 2, vy2 + vh2 / 2, vw2 * 2, vh2 * 0.8, '128,158,180');
        ctx.fillStyle = '#17171d'; ctx.fillRect(vx2 - 4, vy2 - 4, vw2 + 8, vh2 + 8);
        ctx.fillStyle = '#7a98ac'; ctx.fillRect(vx2, vy2, vw2, vh2);
        ctx.fillStyle = '#2a2a32';
        ctx.fillRect(vx2, vy2 + vh2 * 0.5, vw2, 3); ctx.fillRect(vx2 + vw2 / 2 - 1, vy2, 3, vh2);
        ctx.fillStyle = '#94b0c2'; ctx.fillRect(vx2 + 2, vy2 + 2, vw2 / 2 - 4, vh2 / 2 - 4);
        // ogni vetrata poggia su una lesena LARGA quanto lei, che scende fino a terra
        const lw3 = Math.max(14, Math.round(vw2 * 0.8));
        blocks(ctx, vx2 + vw2 / 2 - lw3 / 2, vy2 + vh2 + 4, lw3, floorY - vy2 - vh2 - 4, '#2a2a31', 8, r, 0.12);
        ctx.fillStyle = '#34343c'; ctx.fillRect(vx2 - 2, vy2 + vh2 + 4, vw2 + 4, 5); // il davanzale che li unisce
      }
      // LA NAVATA: file di divani-panche fusi, in prospettiva verso il fondo
      for (let row = 4; row >= 0; row--) {
        const t = row / 5;                          // row 4 = lontano
        const py2 = floorY - (floorY - H * 0.46) * t;
        const pw2 = W * (0.56 - t * 0.24), ph2 = 26 * (1 - t * 0.5);
        const px2 = W * 0.5 - pw2 / 2;
        blocks(ctx, px2, py2 - ph2, pw2, ph2, shade('#44444e', 1 - t * 0.3), 8, r, 0.10);
        blocks(ctx, px2, py2 - ph2 - 12 * (1 - t * 0.5), pw2, 13 * (1 - t * 0.5), shade('#3c3c46', 1 - t * 0.3), 8, r, 0.08);
        // braccioli fusi male: gobbe dove i divani si sono saldati
        ctx.fillStyle = shade('#38383f', 1 - t * 0.3);
        for (let k = 1; k < 4; k++) ctx.fillRect(px2 + k * pw2 / 4 - 4, py2 - ph2 - 16 * (1 - t * 0.5), 8, 16 * (1 - t * 0.5));
      }
      // corsia centrale: passatoia grigia che corre verso il fondo
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const cw = W * (0.13 - t * 0.07);
        ctx.fillStyle = shade('#3a3640', 1 - t * 0.3);
        ctx.fillRect(W * 0.5 - cw / 2, floorY - (floorY - H * 0.46) * t - 6, cw, (floorY - H * 0.46) / 6 + 7);
      }
      // IL FONDO: una parete di chiarore freddo... con una SAGOMA-BUCO al centro,
      // la forma di una persona dove la luce semplicemente NON c'è
      const ax = W * 0.5, aw = W * 0.20, ay = H * 0.14, ah = H * 0.34;
      glow(ctx, ax, ay + ah / 2, aw * 1.6, ah, '150,170,186');
      ctx.fillStyle = '#8aa0b2'; ctx.fillRect(ax - aw / 2, ay, aw, ah);
      ctx.fillStyle = '#9db2c2'; ctx.fillRect(ax - aw / 2 + 4, ay + 4, aw - 8, ah * 0.4);
      // la sagoma-buco: nero assoluto, in piedi, ferma
      ctx.fillStyle = '#040406';
      ctx.fillRect(ax - 9, ay + ah * 0.30, 18, ah * 0.70);        // corpo
      ctx.fillRect(ax - 6, ay + ah * 0.16, 12, ah * 0.16);        // testa
      ctx.fillRect(ax - 15, ay + ah * 0.38, 6, ah * 0.36);        // braccia lungo i fianchi
      ctx.fillRect(ax + 9, ay + ah * 0.38, 6, ah * 0.36);
      // e ai piedi della parete, UNA lattina rossa lasciata come un cero votivo
      lattina(ctx, ax - 4, H * 0.46 + 14);
      glow(ctx, ax, H * 0.46 + 19, 14, 12, '192,36,46');
    },

    alba_colori(ctx, W, H) {
      // la strada di casa ALL'ALBA: i colori SATURI che tornano — il painter più caldo del gioco
      const r = rng(2131);
      // cielo che esplode: indaco -> rosa -> oro
      skyGradient(ctx, W, H * 0.55, '#5a6ab8', '#f0907a', 12);
      skyGradient(ctx, W, H * 0.30, '#5a6ab8', '#8a7ac2', 6);
      ctx.fillStyle = 'rgba(255,196,120,.30)'; ctx.fillRect(0, H * 0.34, W, H * 0.20);
      // IL SOLE che sale in fondo alla strada
      glow(ctx, W * 0.5, H * 0.46, 120, 90, '255,200,110');
      ctx.fillStyle = '#ffd878'; pixelDisc(ctx, W * 0.5, H * 0.47, 30);
      ctx.fillStyle = '#fff0b8'; pixelDisc(ctx, W * 0.5, H * 0.47, 18);
      // nuvole accese di rosa e oro
      for (const [fx, fy, fw2] of [[0.12, 0.10, 90], [0.60, 0.07, 70], [0.78, 0.16, 100], [0.30, 0.20, 60]]) {
        ctx.fillStyle = '#f5b088'; ctx.fillRect(W * fx, H * fy, fw2, 10);
        ctx.fillStyle = '#ffd0a0'; ctx.fillRect(W * fx + 10, H * fy - 6, fw2 * 0.6, 8);
      }
      const g = H - 56;
      // le quinte dei palazzi: FACCIATE COLORATE dal sole — ocra, terracotta, salvia
      const palCols = [['#d8a860', '#b8884a'], ['#c86a52', '#a85440'], ['#8aa878', '#6e8a60']];
      for (const side of [0, 1]) {
        for (let i = 0; i < 3; i++) {
          const t = i / 3;
          const pw = W * (0.16 - t * 0.04), ph = H * (0.62 - t * 0.14);
          const px = side ? W - W * (0.02 + i * 0.15) - pw : W * (0.02 + i * 0.15);
          const [wall, roofc] = palCols[(i + side) % 3];
          blocks(ctx, px, g - ph, pw, ph, wall, 9, r, 0.10);
          blocks(ctx, px - 4, g - ph - 8, pw + 8, 9, roofc, 8, r, 0.10);
          // finestre che SPECCHIANO l'alba: oro vivo
          for (let wr = 0; wr < 4; wr++) for (let wc = 0; wc < 2; wc++) {
            const wx = px + 8 + wc * (pw - 26), wy = g - ph + 12 + wr * ph / 4.6;
            ctx.fillStyle = (wr + wc + i) % 2 ? '#ffcc70' : '#f5a860';
            ctx.fillRect(wx, wy, 11, 14);
            ctx.fillStyle = '#c88848'; ctx.fillRect(wx + 5, wy, 2, 14);
          }
          // balconi con gerani ROSSI e panni stesi colorati
          ctx.fillStyle = '#7a5a3a'; ctx.fillRect(px + 4, g - ph + ph / 4.6 + 28, pw - 8, 4);
          ctx.fillStyle = '#e03a3a'; ctx.fillRect(px + 8, g - ph + ph / 4.6 + 24, 8, 5);
          ctx.fillStyle = '#3a9a4a'; ctx.fillRect(px + 9, g - ph + ph / 4.6 + 21, 6, 4);
          if (i === 0) {
            const cy2 = g - ph + 2 * ph / 4.6 + 30;
            ctx.fillStyle = '#5a5a62'; ctx.fillRect(px + 6, cy2, pw - 12, 2);
            for (let k = 0; k < 3; k++) {
              ctx.fillStyle = ['#f0c848', '#4a90c8', '#e06a9a'][k];
              ctx.fillRect(px + 10 + k * (pw - 24) / 3, cy2 + 2, 12, 14);
            }
          }
        }
      }
      // l'asfalto che si scalda di rosa; la mezzeria torna BIANCA
      blocks(ctx, 0, g, W, H - g, '#5a4a52', 12, r, 0.12);
      ctx.fillStyle = 'rgba(240,144,122,.18)'; ctx.fillRect(0, g, W, H - g);
      ctx.fillStyle = '#f0ece0';
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        ctx.fillRect(W * 0.5 - 8 + t * 4, g + 6 + i * (H - g - 10) / 5, 16 - t * 8, 5);
      }
      // marciapiedi caldi
      blocks(ctx, 0, g - 4, W * 0.20, 8, '#c8a878', 8, r, 0.10);
      blocks(ctx, W * 0.80, g - 4, W * 0.20, 8, '#c8a878', 8, r, 0.10);
      // gli alberi del viale: VERDI VERI, accesi dal controluce
      tree(ctx, W * 0.13, g + 2, 58, '#3a9a4a', '#7a5a3a', r);
      tree(ctx, W * 0.87, g + 2, 52, '#4aae56', '#7a5a3a', r);
      // i lampioni ancora accesi, inutili e bellissimi contro l'alba
      for (const fx of [0.24, 0.76]) {
        ctx.fillStyle = '#4a4a52'; ctx.fillRect(W * fx - 2, g - 88, 5, 84);
        ctx.fillRect(W * fx - 10, g - 92, 21, 5);
        glow(ctx, W * fx, g - 84, 22, 16, '255,214,140');
        ctx.fillStyle = '#ffd68c'; ctx.fillRect(W * fx - 5, g - 90, 11, 8);
      }
      // il bar all'angolo che apre: serranda a metà, luce calda, l'insegna rossa
      const bx = W * 0.70, by = g - 4;
      ctx.fillStyle = '#e0b260'; ctx.fillRect(bx, by - 40, 56, 36);
      ctx.fillStyle = '#e03a3a'; ctx.fillRect(bx + 4, by - 52, 48, 12);
      ctx.fillStyle = '#fff0d0'; ctx.fillRect(bx + 8, by - 49, 34, 5);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(bx + 6, by - 36, 44, 4);
      glow(ctx, bx + 28, by - 16, 40, 20, '255,214,140');
      ctx.fillStyle = '#ffedb8'; ctx.fillRect(bx + 8, by - 30, 40, 26);
      ctx.fillStyle = '#3a3a42';
      for (let i = 0; i < 4; i++) ctx.fillRect(bx + 8, by - 30 + i * 7, 40, 2); // la serranda a metà
      // uccellini contro il sole
      ctx.strokeStyle = '#4a3a44'; ctx.lineWidth = 2;
      for (const [ux, uy] of [[W * 0.36, H * 0.20], [W * 0.42, H * 0.14], [W * 0.62, H * 0.18]]) {
        ctx.beginPath(); ctx.moveTo(ux - 7, uy); ctx.lineTo(ux, uy - 5); ctx.lineTo(ux + 7, uy); ctx.stroke();
      }
      // e in fondo, nel sole: CINQUE sagome che tornano a casa, più UNA che li raggiunge
      ctx.fillStyle = '#4a3a44';
      for (let i = 0; i < 5; i++) sagoma(ctx, W * 0.44 + i * 12, g + 2, 26, '#4a3a44');
      sagoma(ctx, W * 0.44 + 5 * 12 + 8, g + 2, 26, '#5a4650');
    },

  };

  /* Disegna una scena, con eventuali eroi e PNG.
     npcKeys accetta stringhe oppure oggetti posizionati:
     { key, x, y, scale, flip } con x/y in frazioni di larghezza/altezza. */
  function paint(canvasId, locationKey, heroKeys = null, npcKeys = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    const painter = painters[locationKey] || painters.corridoio;
    painter(ctx, W, H);
    // il velo del Grigiore avanza con la notte (mai sull'alba)
    if (locationKey !== 'alba_colori') grigiore(ctx, W, H, eclipsePhase);
    if (heroKeys && heroKeys.length) heroesRow(ctx, W, H - 8, heroKeys, 3);
    if (npcKeys && npcKeys.length) drawNpcs(ctx, W, H, npcKeys);
  }

  function drawNpcs(ctx, W, H, npcKeys) {
    const plain = npcKeys.filter(n => typeof n === 'string');
    const placed = npcKeys.filter(n => typeof n === 'object' && n);
    const scale = 5, size = 16 * scale;
    const baseFeet = H - 34;
    let x = Math.floor(W * 0.70 - (plain.length - 1) * (size + 16) / 2);
    for (const key of plain) {
      const def = Sprites.registry[key];
      if (def) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(x + 6, baseFeet - 4, size - 12, 8);
        Sprites.drawSprite(ctx, def.map, def.palette, x, baseFeet - size, scale, true);
      }
      x += size + 16;
    }
    for (const n of placed) {
      const def = Sprites.registry[n.key];
      if (!def) continue;
      const s = n.scale || 5, sz = 16 * s;
      const px = Math.round((n.x != null ? n.x * W : W * 0.7) - sz / 2);
      const finalY = n.y != null ? Math.round(n.y * H) - sz : H - 34 - sz;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(px + 6, finalY + sz - 4, sz - 12, 7);
      Sprites.drawSprite(ctx, def.map, def.palette, px, finalY, s, n.flip !== false);
    }
  }

  return { paint, painters, rng, blocks, shade, heroesRow, tree, willow, house, torch, sign, ground, hills, moon, setEclipse, getEclipse, pixelDisc };
})();
