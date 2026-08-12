/* ============ SPRITES — pixel art procedurale ============
   Ogni sprite è una mappa di caratteri 16x16 o 32x32. Ogni carattere è un
   colore nella palette dello sprite. '.' = trasparente.                   */

const Sprites = (() => {

  function drawSprite(ctx, map, palette, x, y, scale, flip = false) {
    const h = map.length, w = map[0].length;
    // 'scale' è la dimensione della cella di una griglia 16: mappe a risoluzione
    // doppia (32x32) occupano lo STESSO ingombro con il doppio del dettaglio.
    const px = scale * 16 / h;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const ch = map[r][flip ? w - 1 - c : c];
        if (ch === '.') continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        // ceil per evitare cuciture tra celle non intere
        ctx.fillRect(x + c * px, y + r * px, Math.ceil(px), Math.ceil(px));
      }
    }
  }

  function renderToCanvas(canvas, spriteDef, bg = '#1a1114') {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width, canvas.height) / 16;
    const off = Math.floor((canvas.width - scale * 16) / 2);
    drawSprite(ctx, spriteDef.map, spriteDef.palette, off, off, scale);
  }

  /* ---------- I SEI AMICI ---------- */

// Gaetano — l'ingegnere satellitare: occhiali, polo blu col badge, multimetro (32x32)
  const gaetano = {
    palette: { s:'#e0b090', h:'#2a2018', e:'#2a2a35', o:'#4a4a55', p:'#2a4a7a', P:'#1d3558', d:'#3a3a45', w:'#fff', k:'#8a5a48', n:'#c89878', K:'#1a1a22', y:'#e8c840', G:'#7ae0a8', B:'#d85040' },
    map: [
      '................................',
      '................................',
      '..........hhhhhhhhhhhh..........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhshhhsshhhshh.........',
      '.........hhswwwsswwwshh.........',
      '.........hhswewsswewshh.........',
      '.........ssssssnnssssss.........',
      '..........sssskkkkssss..........',
      '..........ssssssssssss..........',
      '..............ssss..............',
      '..............ssss..............',
      '.........ppppPPPPPPpppp.........',
      '.......pppppBBppppppppppp.......',
      '.......ppppPBBPPPPPPPpppp.......',
      '.......ppppPPPPPPPPPPpppp.......',
      '.......ppppPPPPPPPPPPpppyyyyyy..',
      '.......ppppPPPPPPPPPPpppyGGGGy..',
      '.......ppppPPPPPPPPPPpppyGGGGy..',
      '.......ssppPPPPPPPPPPppssGGGGy..',
      '.......ssppppppppppppppssyyyyy..',
      '...........dddd..dddd...yyKyKy..',
      '...........dddd..dddd...yyyyyy..',
      '...........dddd..dddd...yyyyyy..',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

// Natalino — il parrucchiere: ciuffo scolpito, orecchino, forbicione d'argento (32x32)
  const natalino = {
    palette: { s:'#e2b28e', h:'#1d1812', H:'#3a2c1c', e:'#2a2a35', c:'#7a2432', C:'#5a1a26', d:'#2a2a32', w:'#fff', k:'#8a5a48', n:'#c89878', K:'#1a1a22', m:'#d8dce8', M:'#9aa0b0', g:'#e8c840' },
    map: [
      '...........HHHHHHHHH............',
      '...........HhhhhhhHH............',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhshhhsshhhshh.........',
      '.........hhswwwsswwwshh.........',
      '..........sswewsswewss..........',
      '..........sssssnnsssssg.........',
      '..........sssskkkkssss..........',
      '..........ssssssssssss..........',
      '..............ssss..............',
      '..............ssss......mm..mm..',
      '.........ccccCCccCCcccc.mm..mm..',
      '.......ccccccccggcccccccc.mmm...',
      '.......ccccCCCCCCCCCCcccc.wMm...',
      '.......ccccCCCCCCCCCCcccc.mmm...',
      '.......ccccCCCCCCCCCCccccmm.mm..',
      '.......ccccCCCCCCCCCCccccgg.gg..',
      '.......ccccCCCCCCCCCCccssgg.gg..',
      '.......ssccCCCCCCCCCCccss.......',
      '.......ssccccccccccccccss.......',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

// Claudia — l'immagine è SUA: telefono alzato col flash, top magenta (32x32)
  const claudia = {
    palette: { s:'#e8bc98', h:'#241a14', e:'#3a2a20', t:'#a83a6a', T:'#7a2848', D:'#2e2e3a', w:'#fff', k:'#a06a58', n:'#d0a080', K:'#1a1a22', f:'#1a1a22', F:'#5ad8e0', r:'#b04858' },
    map: [
      '................................',
      '..........hhhhhhhhhhhh...w......',
      '.........hhhhhhhhhhhhhh.w.w.....',
      '.........hhhhhhhhhhhhhhfffff....',
      '........hhhhhhhhhhhhhhhfFFFf....',
      '........hhhsssssssssshhfFFFf....',
      '........hhhshhhsshhhshhfFFFf....',
      '........hhhswwwsswwwshhfFFFf....',
      '........hhhswewsswewshhfffff....',
      '........hhhssssnnsssshhhss......',
      '........hhhsssrrrrssshhhss......',
      '........hhhsssssssssshhhss......',
      '........hhh...ssss...hhhss......',
      '........hhh...ssss...hhhss......',
      '........hhhtttttttttthhhss......',
      '.......thhhtttttttttthh.........',
      '.......ttttTTTTTTTTTTtt.........',
      '.......ttttTTTTTTTTTTtt.........',
      '.......ttttTTTTTTTTTTtt.........',
      '.......ttttTTTTTTTTTTtt.........',
      '.......ttttTTTTTTTTTTtt.........',
      '.......ssttTTTTTTTTTTtt.........',
      '.......sstttttttttttttt.........',
      '..........DDDDDDDDDDDD..........',
      '..........DDDDDDDDDDDD..........',
      '..........DDDDDDDDDDDD..........',
      '...........ssss..ssss...........',
      '...........ssss..ssss...........',
      '...........ssss..ssss...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

// Federico — il persuasore: giacca sui revers, svapo coi cerchi, birra al limone (32x32)
  const federico = {
    palette: { s:'#e0b090', h:'#33261a', b:'#4a3826', e:'#2a3a4a', c:'#5a88b0', C:'#3d6890', j:'#2c2c38', d:'#3a3a45', w:'#fff', k:'#1d1812', n:'#c89878', K:'#1a1a22', v:'#b8bcd0', y:'#e8c840', Y:'#f8f4d8', L:'#c8a020', Q:'#2e6a3e' },
    map: [
      '................................',
      '................................',
      '..........hhhhhhhhhhhh..........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '..........sshhhsshhhss.......vvv',
      '..........sswwwsswwwss.......v.v',
      '..........sswewsswewss.......vvv',
      '..........sssssnnsssss..........',
      '..........bbsskkkkssbb......vv..',
      '......KK..bbbbkkkkbbbb......vv..',
      '......QQ...bbbbbbbbbb...........',
      '.....wQQ......ssss..............',
      '......QQ.jjjjjccccjjjjj.....v...',
      '......QQjjjjjjccccjjjjjjj.......',
      '.....QQQQjjjjjCCCCjjjjjjj.......',
      '.....QQQQjjjjjCwCCjjjjjjj..v....',
      '.....QQQQjjjCCCCCCCCjjjjj.......',
      '.....QQQQjjjCCCCCCCCjjjjj.......',
      '.....YYYYjjjCCCwCCCCjjjjvvvv....',
      '.....YLssjjjCCCCCCCCjjjsvvvv....',
      '.....YYssjjjccccccccjjjss.......',
      '.....QQQQ..dddd..dddd...........',
      '.....QQQQ..dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

// Emanuela — la guaritrice: chignon, phon da 2200 watt, borsa con la croce (32x32)
  const emanuela = {
    palette: { s:'#ecc2a0', h:'#8a6238', H:'#6e4c28', e:'#3a2a20', t:'#3d8a80', T:'#2a655e', D:'#2e2e3a', w:'#fff', k:'#a06a58', n:'#d0a080', K:'#1a1a22', f:'#8a92b8', F:'#5a628a', r:'#b05858', b:'#8a5a35' },
    map: [
      '............HHHHHHHH............',
      '............HhhhhhhH............',
      '............HHHHHHHH............',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhshhhsshhhshh.........',
      '.........hhswwwsswwwshh.........',
      '.........hhswewsswewshh.........',
      '.........hhssssnnsssshh.........',
      '..........ssssrrrrssss..........',
      '..........ssssssssssss..........',
      '..............ssss..............',
      '..............ssss..............',
      '.........tttttttttttttt.........',
      '.......tttttttttttttttttt......w',
      '.......ttttTTTTTTTTTTtttfffff...',
      '.....bbbtttTTTTTTTTTTtttfffffFF.',
      '.....bbbtttTTTTTTTTTTtttfffffFFw',
      '....bbbbbttTTTTTTTTTTtttfffff...',
      '....bbwbbttTTTTTTTTTTttssFF.....',
      '....bwwwbttTTTTTTTTTTttssFF....w',
      '....bbwbbttttttttttttttssFF.....',
      '....bbbbb..DDDD..DDDD...........',
      '...........DDDD..DDDD...........',
      '...........DDDD..DDDD...........',
      '...........DDDD..DDDD...........',
      '...........DDDD..DDDD...........',
      '...........DDDD..DDDD...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

// Daniele — il dialettico: gemello di Federico (stessa faccia), capelli più scuri
// e coi lati lunghi, maglietta scura da casa, Coca Zero in mano (32x32)
  const daniele = {
    palette: { s:'#e0b090', h:'#2a1f12', b:'#4a3826', e:'#2a3a4a', t:'#34343e', T:'#26262e', d:'#3a3a45', w:'#fff', k:'#1d1812', n:'#c89878', K:'#1a1a22', Z:'#111116', R:'#c8102e' },
    map: [
      '................................',
      '................................',
      '..........hhhhhhhhhhhh..........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhshhhsshhhshh.........',
      '.........hhswwwsswwwshh.........',
      '.........hhswewsswewshh.........',
      '..........sssssnnsssss..........',
      '..........bbsskkkkssbb..........',
      '..........bbbbkkkkbbbb..........',
      '...........bbbbbbbbbb...........',
      '..............ssss..............',
      '..............ssss..............',
      '.........ttttTTTTTTtttt.........',
      '.......ttttttTTTTTTtttttt.......',
      '.......ttttTTTTTTTTTTttttZZZZ...',
      '.......ttttTTTTTTTTTTttttZRRZ...',
      '.......ttttTTTTTTTTTTttttZRRZ...',
      '.......ttttTTTTTTTTTTttssZZZZ...',
      '.......ssttTTTTTTTTTTttssZZZZ...',
      '.......ssttttttttttttttss.......',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

  /* ---------- LE CREATURE DELLA CASA ---------- */

  // Eleinad, il Volto Rubato — la faccia di Daniele portata come una maschera:
  // stessa mappa, palette spenta dal Grigiore, e un sorriso largo un volto intero
  const eleinad = {
    palette: { s:'#b8b0a6', h:'#3c3a34', b:'#6e6a60', e:'#5a5a62', t:'#4a4a52', T:'#3a3a42', d:'#46464e', w:'#dedcd4', k:'#161616', n:'#a29a90', K:'#26262c', Z:'#3a3a40', R:'#6a6a72' },
    map: daniele.map.map((row, i) => {
      if (i === 10) return '.........kwkwkwkwkwkwkw.........';
      if (i === 11) return '..........kkkkkkkkkkkk..........';
      return row;
    }),
  };

  // ELEINAD — sotto la maschera: un buco a forma di persona, il bordo che sfrigola
  const eleinadVero = {
    palette: { v:'#0b0b10', V:'#191920', z:'#8a8a96' },
    map: [
      '..............z.................',
      '............zvvvvvvz............',
      '...........vvvvvvvvvv...........',
      '..........zvVVVVVVVVvz..........',
      '...........vVVVVVVVVv...........',
      '...........vVVVVVVVVv..........z',
      '..........zvVVVVVVVVvz..........',
      '...........vVVVVVVVVv...........',
      '...........vvvvvvvvvv...........',
      '.............vvvvvv.............',
      '..........zvvvvvvvvvvz..........',
      '........zvvvVVVVVVVVvvvz........',
      '.......vvvvVVVVVVVVVVvvvv.......',
      '......zvvvVVVVVVVVVVVVvvvz......',
      '......vvvvVVVVVVVVVVVVvvvv......',
      '.....zvvvVVVVVVVVVVVVVVvvvz.....',
      '.....vvvvVVVVVVVVVVVVVVvvvv.....',
      '.....vvvvVVVVVVVVVVVVVVvvvvz....',
      '....zvvvvVVVVVVVVVVVVVVvvvv.....',
      '.....vvvvVVVVVVVVVVVVVVvvvv.....',
      '.....vvvvVVVVVVVVVVVVVVvvvvz....',
      '.....vvvvVVVVVVVVVVVVVVvvvv.....',
      '....zvvvvVVVVVVVVVVVVVVvvvv.....',
      '.....vvvvVVVVVVVVVVVVVVvvvv.....',
      '......vvvvVVVVVVVVVVVVvvvvz.....',
      '......vvvvvvvvvvvvvvvvvvvv......',
      '.......vvvvvv......vvvvvv.......',
      '.......vvvvvv..z...vvvvvv.......',
      '.......vvvvvv......vvvvvv.......',
      '......zvvvvvv......vvvvvvz......',
      '.......vvvvv........vvvvv.......',
      '........z..............z........',
    ],
  };

  // Topo del Grigiore: grosso come un gatto, grigio cenere, occhi spenti (16x16)
  const topoGrigio = {
    palette: { g:'#8a8a90', G:'#66666e', e:'#3c3c42', p:'#a89ea0', t:'#77777e' },
    map: [
      '................',
      '....gg....gg....',
      '...gppg..gppg...',
      '...gppg..gppg...',
      '...gggggggggg...',
      '..gggggggggggg..',
      '..ggeggggggegg..',
      '..gggggggggggg..',
      '..ggggGGGGgggg..',
      '.ggggGGGGGGgggg.',
      '.gggGGGGGGGGggg.',
      '.gggGGGGGGGGggg.',
      '..gggggggggggg.t',
      '...gg..gg..gg..t',
      '..............t.',
      '.............t..',
    ],
  };

  // Comparsa della Vita Finta: sagoma di cartone col sorriso stampato (16x16)
  const manichinoVita = {
    palette: { c:'#c8a25a', C:'#a8843e', k:'#2a2a2e', d:'#6a6a72', D:'#55555e' },
    map: [
      '.....cccccc.....',
      '....cccccccc....',
      '....ckccccck....',
      '....cccccccc....',
      '....kcccccck....',
      '....ckkkkkkc....',
      '.....cccccc.....',
      '...dddddddddd...',
      '..dddddddddddd..',
      '..dddDDDDDDddd..',
      '..dddDDDDDDddd..',
      '...dddddddddd...',
      '....cccccccc....',
      '.....cc..cc.....',
      '....CCCCCCCC....',
      '................',
    ],
  };

  // Il Divorente: divano a tre posti, coi denti dentro i cuscini (32x32)
  const divorente = {
    palette: { u:'#5c5460', U:'#453e4a', m:'#160c10', t:'#e8e0d0', r:'#6a1420', k:'#241c22' },
    map: [
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '...uuuuuuuuuuuuuuuuuuuuuuuuuu...',
      '..uuuuuuuuuuuuuuuuuuuuuuuuuuuu..',
      '..uUUUUUUUUUUUUUUUUUUUUUUUUUUu..',
      '..uUUUUUUUUUUUUUUUUUUUUUUUUUUu..',
      '..uUUUUUUUUUUUUUUUUUUUUUUUUUUu..',
      '..uUUUUUUUUUUUUUUUUUUUUUUUUUUu..',
      '.uuuUUUUUUUUUUUUUUUUUUUUUUUUuuu.',
      '.uuuUmmmmmmUUmmmmmmUUmmmmmmUuuu.',
      '.uuuUmtmtmtUUmtmtmtUUmtmtmtUuuu.',
      '.uuuUmrrrrmUUmrrrrmUUmrrrrmUuuu.',
      '.uuuUtmtmtmUUtmtmtmUUtmtmtmUuuu.',
      '.uuuUmmmmmmUUmmmmmmUUmmmmmmUuuu.',
      '.uuuUUUUUUUUUUUUUUUUUUUUUUUUuuu.',
      '.uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu.',
      '..uuuuuuuuuuuuuuuuuuuuuuuuuuuu..',
      '...kk.....kk......kk.....kk.....',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  };

  // Sciame di Bollette: vortice di buste bianche con la finestrella (16x16)
  const sciameBollette = {
    palette: { w:'#e8e6de', W:'#c0beb6', f:'#a8b4bc' },
    map: [
      '................',
      '...www....www...',
      '...wfw....wfw...',
      '.......www......',
      '..www..wfw..www.',
      '..wfw.......wfw.',
      '......wwww......',
      '.WWW..wffw..www.',
      '.WfW..wwww..wfw.',
      '................',
      '...www....WWW...',
      '...wfw....WfW...',
      '.......www......',
      '.......wfw......',
      '................',
      '................',
    ],
  };

  // Il Monologante: un tizio in polo con la bocca ENORME aperta (16x16)
  const monologante = {
    palette: { s:'#c9b09a', h:'#55504a', e:'#3a3a40', m:'#2a1216', t:'#e8e0d4', p:'#7a8a94', P:'#5d6a74', d:'#3a3a42', K:'#1a1a22' },
    map: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hssssssh....',
      '....sesssses....',
      '...smmmmmmmms...',
      '...smtmmmmtms...',
      '...smmmmmmmms...',
      '...ssmmmmmmss...',
      '.....ssssss.....',
      '....pppppppp....',
      '..sppPPPPPPpps..',
      '..sppPPPPPPpps..',
      '...pppppppppp...',
      '....dd....dd....',
      '....dd....dd....',
      '....KK....KK....',
    ],
  };

  // La Hostess del Volo Fermo: divisa, sorriso con troppi denti (16x16)
  const hostess = {
    palette: { s:'#d0b4a0', h:'#4a3826', e:'#3a3a40', k:'#1d1016', w:'#f0ece4', u:'#5a6a86', U:'#44506a', r:'#8a3038', K:'#1a1a22' },
    map: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....ssssssss....',
      '....sesssses....',
      '....ssssssss....',
      '...skwwwwwwks...',
      '....skwwwwks....',
      '.....ssssss.....',
      '....rruuuurr....',
      '...uuuUUUUuuu...',
      '..suuUUUUUUuus..',
      '..suuUUUUUUuus..',
      '...uuuuuuuuuu...',
      '....uuuuuuuu....',
      '.....ss..ss.....',
      '....KK....KK....',
    ],
  };

  // Luca Giunti delle 21:00: zaino enorme, libro chiuso, aureola di "21:00" (32x32)
  const lucaGiunti = {
    palette: { y:'#e8c840', s:'#d8b294', h:'#3a2c1e', e:'#33333a', w:'#fff', n:'#c89878', k:'#1d1812', g:'#607080', G:'#4a5666', z:'#6e5a46', Z:'#584634', b:'#7a3a44', d:'#3a3a45', K:'#1a1a22' },
    map: [
      '.......yyy..y....yyy.yyy........',
      '.........y..y..y.y.y.y.y........',
      '.......yyy..y....y.y.y.y........',
      '.......y....y..y.y.y.y.y........',
      '.......yyy..y....yyy.yyy........',
      '................................',
      '..........hhhhhhhhhhhh..........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhhhhhhhhhhhhh.........',
      '.........hhshhhsshhhshh.........',
      '.........hhswwwsswwwshh.........',
      '.........hhswewsswewshh.........',
      '..........sssssnnsssss..........',
      '..........sssskkkkssss..........',
      '..........ssssssssssss..........',
      '..............ssss..............',
      '...zz....gggggggggggg....zz.....',
      '..zzzz.gggggggggggggggg.zzzz....',
      '..zzzzggggGGGGGGGGGGggggzzzz....',
      '..zZzzggggGGGGGGGGGGggggzzZz....',
      '..zzzzggggGGbbbbbbGGggggzzzz....',
      '..zzzzggggGGbwwwwbGGggggzzzz....',
      '..zzzzggggGGbbbbbbGGggggzzzz....',
      '..zzzzssggGGGGGGGGGGggsszzzz....',
      '...zzzgggggggggggggggggg.zzz....',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '...........dddd..dddd...........',
      '..........KKKKK..KKKKK..........',
      '..........KKKKK..KKKKK..........',
      '................................',
    ],
  };

  // La Cosa tra gli Scogli: massa scura, dita lunghe d'alga, tra le rocce (32x32)
  const cosaSommersa = {
    palette: { v:'#10161a', V:'#1e2a30', a:'#3a5648', A:'#28403a', r:'#4e5058', R:'#383a42', w:'#5a7078', e:'#9aa848' },
    map: [
      '....a......a.......a............',
      '....a......a.......a......a.....',
      '....A..a...a...a...a......a.....',
      '....A..a...A...a...A......a.....',
      '....A..a...A...a...A...a..A.....',
      '....A..A...A...A...A...a..A.....',
      '...AA..A...AA..A...AA..a..AA....',
      '...AA.AA...AA..AA..AA..A..AA....',
      '..AAA.AA..AAA..AA..AAa.A.AAA....',
      '..AAA.AAA.AAA..AAA.AAa.AAAAA....',
      '..AAAAAAA.AAAA.AAAAAAA.AAAAA....',
      '..wAAAAAAwAAAAwAAAAAAAwAAAAAw...',
      '.wwvvvvvvvvvvvvvvvvvvvvvvvvww...',
      '..vvvvvvvvvvvvvvvvvvvvvvvvvv....',
      '..vvVVVVVVVVVVVVVVVVVVVVVVvv....',
      '.vvvVVVVVVVVVVVVVVVVVVVVVVvvv...',
      '.vvVVVVeVVVVVVVVVVVeVVVVVVVvv...',
      '.vvVVVVVVVVVVVVVVVVVVVVVVVVvv...',
      'rvvVVVVVVVVVVVVVVVVVVVVVVVVvvr..',
      'rrvvVVVVVVVVVVVVVVVVVVVVVVvvrr..',
      'rrvvvVVVVVVVVVVVVVVVVVVVvvvrrr..',
      'rRrvvvvvvvvvvvvvvvvvvvvvvvrrRr..',
      'rRrrvvvvvvvvvvvvvvvvvvvvvrrrRr..',
      'rrRrr...vvv...vvv...vvv..rrRrr..',
      'rrrrr....a.....a.....a...rrrrr..',
      'rRrrr....a.....a.....a...rrRrr..',
      'rrrr.....A.....A.....A....rrrr..',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  };

  // Il Bibliotecario: una figura fatta di dorsi di libri impilati (32x32)
  const bibliotecario = {
    palette: { a:'#6e4a3a', b:'#4a5668', c:'#6a6a4e', q:'#5a4a66', g:'#c0b49a', t:'#c8a032' },
    map: [
      '................................',
      '................................',
      '............bbbbbbbb............',
      '............bbtbbbbb............',
      '............cccccccc............',
      '............cccttccc............',
      '............aaaaaaaa............',
      '............aataaaaa............',
      '........qqqqqqqqqqqqqqqq........',
      '........qqttqqqqqqqqqqqq........',
      '.......aaaaaaaaaaaaaaaaaa.......',
      '.......aaaattaaaaaaaaaaaa.......',
      '.......bbbbbbbbbbbbbbbbbb.......',
      '.......bbbbbbbbttbbbbbbbb.......',
      '.......cccccccccccccccccc.......',
      '.......ccttcccccccccccccc.......',
      '.......qqqqqqqqqqqqqqqqqq.......',
      '.......qqqqqqqqqqttqqqqqq.......',
      '.......aaaaaaaaaaaaaaaaaa.......',
      '.......aaaaattaaaaaaaaaaa.......',
      '.......bbbbbbbbbbbbbbbbbb.......',
      '.......bbbbbbbbbbbbttbbbb.......',
      '.......gggggggggggggggggg.......',
      '........ccccccc..ccccccc........',
      '........cctcccc..ccccctc........',
      '........aaaaaaa..aaaaaaa........',
      '........aaaaaaa..aataaaa........',
      '........bbbbbbb..bbbbbbb........',
      '........btbbbbb..bbbbbbb........',
      '........ggggggg..ggggggg........',
      '................................',
      '................................',
    ],
  };

  // Il Gemello Sbagliato: metà Federico, metà Daniele — e le metà non combaciano
  // (la metà destra è la mappa di Daniele, slittata di una riga verso il basso)
  const gemelloSbagliato = {
    palette: { s:'#e0b090', h:'#33261a', b:'#4a3826', e:'#2a3a4a', c:'#5a88b0', C:'#3d6890', j:'#2c2c38', d:'#3a3a45', w:'#fff', k:'#1d1812', n:'#c89878', K:'#1a1a22', t:'#34343e', T:'#26262e', Z:'#111116', R:'#6a6a72' },
    map: federico.map.map((row, i) => {
      let left = row.slice(0, 16).replace(/[QYLv]/g, '.');
      if (i === 11) left = left.replace('KK', '..');
      const right = (i > 0 ? daniele.map[i - 1] : daniele.map[31]).slice(16);
      return left + right;
    }),
  };

  // Sonnambulo del Grigiore: pigiama, gli occhi come schermi spenti (16x16)
  const sonnambulo = {
    palette: { p:'#8a8aa0', P:'#6a6a84', s:'#c4ac9c', h:'#4a4038', e:'#101216', g:'#343a44' },
    map: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....ssssssss....',
      '...seegsseegs...',
      '...seegsseegs...',
      '....ssssssss....',
      '.....ssssss.....',
      '....pppppppp....',
      '..sppPPPPPPpps..',
      '..sppPPPPPPpps..',
      '...pppppppppp...',
      '...pppppppppp...',
      '....pp....pp....',
      '....pp....pp....',
      '....ss....ss....',
      '................',
    ],
  };

  // Riscossore del Mercante: un contratto arrotolato, verticale, con le gambe (16x16)
  const mercanteGuardia = {
    palette: { c:'#d8d0c0', C:'#b0a896', t:'#4a4a52', g:'#a08a4a', k:'#26222a' },
    map: [
      '....cccccccc....',
      '...cCCCCCCCCc...',
      '...cCccccccCc...',
      '....ctttttcc....',
      '....cccccccc....',
      '....ctttttcc....',
      '....cccccccc....',
      '....cttttccc....',
      '....ccggggcc....',
      '....ccggggcc....',
      '....ctttttcc....',
      '....cccccccc....',
      '...cCCCCCCCCc...',
      '....cccccccc....',
      '.....kk..kk.....',
      '....kkk..kkk....',
    ],
  };

  // Guardiano del Bozzolo: il telecomando gigante con un solo tasto rosso (32x32)
  const bozzoloGuardiano = {
    palette: { k:'#2e2e36', K:'#1c1c24', g:'#55555e', R:'#d43030', r:'#7a1414', f:'#8a8a96', w:'#b8b8c0' },
    map: [
      '.............ff.....f...........',
      '....f...........................',
      '..........KKKKKKKKKKKK.....f....',
      '..........KkkkkkkkkkkK..........',
      '..........KkkwwkkkkkkK..........',
      '..........KkkkkkkkkkkK..........',
      '..f.......KkkkkkkkkkkK.....f....',
      '..........KkkRRRRRRkkK..........',
      '..........KkRRRRRRRRkK..........',
      '..........KkRRRRRRRRkK..........',
      '..........KkRRRRRRRRkK.......f..',
      '..........KkRRRRrrRRkK..........',
      '..........KkkrrrrrrkkK..........',
      '..........KkkkkkkkkkkK..........',
      '..f.......KkggkggkggkK..........',
      '..........KkkkkkkkkkkK..........',
      '..........KkggkggkggkK.......f..',
      '..........KkkkkkkkkkkK..........',
      '..........KkggkggkggkK..........',
      '.f........KkkkkkkkkkkK..........',
      '..........KkggkggkggkK..........',
      '..........KkkkkkkkkkkK......f...',
      '..........KkggkggkggkK..........',
      '..........KkkkkkkkkkkK..........',
      '...f......KkggkggkggkK..........',
      '..........KkkkkkkkkkkK..........',
      '..........KkkkkkkkkkkK....f.....',
      '..........KkkkkkkkkkkK..........',
      '..........KKKKKKKKKKKK..........',
      '.......f.....ff....f............',
      '................................',
      '................................',
    ],
  };

  // Il Mercante Grigio: gilet da ferramenta su qualcosa di indefinito,
  // lampada da campeggio appesa al fianco (16x16)
  const mercante = {
    palette: { v:'#26222c', V:'#17141c', m:'#a8842a', M:'#7a5e18', e:'#b8b8c4', l:'#e8d878', L:'#6a6a72' },
    map: [
      '.....vvvvvv.....',
      '....vvvvvvvv....',
      '....vveVVevv....',
      '....vvvvvvvv....',
      '...mmvvvvvvmm...',
      '..mmmVVVVVVmmm..',
      '..mMmVVVVVVmMm..',
      '..mMmVVVVVVmMmL.',
      '..mmmVVVVVVmmmLL',
      '..vvvVVVVVVvvvLl',
      '..vvvVVVVVVvvvLl',
      '...vvVVVVVVvv.LL',
      '...vvvVVVVvvv...',
      '....vvvvvvvv....',
      '.....vv..vv.....',
      '......v..v......',
    ],
  };

  const registry = {
    gaetano, natalino, claudia, federico, emanuela, daniele,
    eleinad, eleinad_vero: eleinadVero,
    topo_grigio: topoGrigio, manichino_vita: manichinoVita, divorente,
    sciame_bollette: sciameBollette, monologante, hostess,
    luca_giunti: lucaGiunti, cosa_sommersa: cosaSommersa, bibliotecario,
    gemello_sbagliato: gemelloSbagliato, sonnambulo,
    mercante_guardia: mercanteGuardia, bozzolo_guardiano: bozzoloGuardiano,
    mercante,
  };

  return { drawSprite, renderToCanvas, registry };
})();
