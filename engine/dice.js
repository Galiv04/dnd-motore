/* ============ DICE — tiri di dado con animazione ============ */

const Dice = (() => {

  function roll(sides) {
    return 1 + Math.floor(Math.random() * sides);
  }

  function rollDice(n, sides) {
    let total = 0;
    const rolls = [];
    for (let i = 0; i < n; i++) { const r = roll(sides); rolls.push(r); total += r; }
    return { total, rolls };
  }

  // Disegna un d20 pixeloso sul canvas
  function drawD20(ctx, value, color = '#f5c542') {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, r = W * 0.42;
    // esagono stile d20
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.stroke();
    // triangolo interno
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.74, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.74, cy + r * 0.45); ctx.closePath(); ctx.stroke();
    // numero
    ctx.fillStyle = '#1a1428';
    ctx.font = `bold ${Math.floor(W * 0.3)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(value), cx, cy + 4);
  }

  /* Mostra l'overlay del dado, anima il tiro, restituisce (via callback) il risultato.
     opts: { title, mod, dc, advantage, disadvantage, onDone(result) }
     result: { die, die2, total, success, crit, fumble }                       */
  function showRoll(opts) {
    const overlay = document.getElementById('dice-overlay');
    const titleEl = document.getElementById('dice-title');
    const resultEl = document.getElementById('dice-result');
    const detailEl = document.getElementById('dice-detail');
    const btn = document.getElementById('btn-dice-continue');
    const canvas = document.getElementById('dice-canvas');
    const ctx = canvas.getContext('2d');

    overlay.classList.remove('hidden');
    titleEl.innerHTML = opts.title || 'Tiro di dado';
    resultEl.textContent = '';
    resultEl.className = 'dice-result';
    detailEl.textContent = '';
    btn.classList.add('hidden');

    // valori finali
    let die = roll(20), die2 = null;
    if (opts.advantage) { die2 = roll(20); if (die2 > die) [die, die2] = [die2, die]; }
    if (opts.disadvantage) { die2 = roll(20); if (die2 < die) [die, die2] = [die2, die]; }
    const mod = opts.mod || 0;
    const total = die + mod;
    const crit = die === 20, fumble = die === 1;
    let success = null;
    if (typeof opts.dc === 'number') {
      success = crit ? true : fumble ? false : total >= opts.dc;
    }

    if (typeof Sound !== 'undefined') Sound.play('dice');

    // animazione: numeri casuali che rallentano
    let frame = 0;
    const frames = 18;
    function tick() {
      frame++;
      drawD20(ctx, roll(20));
      if (frame < frames) {
        setTimeout(tick, 30 + frame * 12);
      } else {
        drawD20(ctx, die, crit ? '#5fca6a' : fumble ? '#e05252' : '#f5c542');
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        if (typeof opts.dc === 'number') {
          detailEl.textContent = (opts.advantage ? `Vantaggio (${die} e ${die2}) → ` : opts.disadvantage ? `Svantaggio (${die} e ${die2}) → ` : '') +
            `${die} ${modStr} = ${total}  (serviva ${opts.dc})`;
          if (crit) { resultEl.textContent = 'CRITICO! ★'; resultEl.classList.add('crit'); }
          else if (fumble) { resultEl.textContent = 'FALLIMENTO CRITICO!'; resultEl.classList.add('fail'); }
          else if (success) { resultEl.textContent = 'SUCCESSO!'; resultEl.classList.add('success'); }
          else { resultEl.textContent = 'FALLITO...'; resultEl.classList.add('fail'); }
          if (typeof Sound !== 'undefined') Sound.play(crit ? 'crit' : success ? 'success' : 'fail');
        } else {
          detailEl.textContent = (opts.advantage ? `Vantaggio (${die} e ${die2}) → ` : opts.disadvantage ? `Svantaggio (${die} e ${die2}) → ` : '') + `${die} ${modStr} = ${total}`;
          resultEl.textContent = String(total);
        }
        btn.classList.remove('hidden');
        btn.onclick = () => {
          overlay.classList.add('hidden');
          opts.onDone && opts.onDone({ die, die2, total, success, crit, fumble });
        };
      }
    }
    tick();
  }

  return { roll, rollDice, showRoll, drawD20 };
})();
