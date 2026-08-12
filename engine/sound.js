/* ============ SOUND — effetti chiptune via WebAudio (zero asset) ============ */

const Sound = (() => {

  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('relais-muted') === '1'; } catch (e) {}

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // nota singola stile chip: onda quadra con decadimento
  function blip(freq, dur = 0.08, type = 'square', vol = 0.12, when = 0) {
    const a = ac();
    if (!a || muted) return;
    const t = a.currentTime + when;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(a.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur = 0.15, vol = 0.1, when = 0) {
    const a = ac();
    if (!a || muted) return;
    const t = a.currentTime + when;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.setValueAtTime(vol, t);
    src.connect(gain); gain.connect(a.destination);
    src.start(t);
  }

  const effects = {
    click()   { blip(660, 0.05, 'square', 0.06); },
    dice()    { for (let i = 0; i < 6; i++) blip(300 + Math.random() * 500, 0.04, 'square', 0.05, i * 0.05); },
    success() { blip(523, 0.09, 'square', 0.1); blip(659, 0.09, 'square', 0.1, 0.09); blip(784, 0.16, 'square', 0.12, 0.18); },
    crit()    { blip(523, 0.08, 'square', 0.1); blip(659, 0.08, 'square', 0.1, 0.08); blip(784, 0.08, 'square', 0.1, 0.16); blip(1047, 0.25, 'square', 0.13, 0.24); },
    fail()    { blip(220, 0.12, 'sawtooth', 0.1); blip(165, 0.22, 'sawtooth', 0.1, 0.12); },
    hit()     { noise(0.12, 0.12); blip(140, 0.1, 'sawtooth', 0.1); },
    heal()    { blip(392, 0.08, 'triangle', 0.12); blip(523, 0.08, 'triangle', 0.12, 0.08); blip(659, 0.14, 'triangle', 0.12, 0.16); },
    victory() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => blip(f, 0.12, 'square', 0.11, i * 0.12)); },
    gold()    { blip(1319, 0.05, 'square', 0.1); blip(1760, 0.09, 'square', 0.1, 0.06); },
    item()    { blip(659, 0.07, 'triangle', 0.11); blip(880, 0.07, 'triangle', 0.11, 0.08); blip(1319, 0.12, 'triangle', 0.12, 0.16); },
    defeat()  { [392, 330, 262, 196].forEach((f, i) => blip(f, 0.2, 'sawtooth', 0.1, i * 0.18)); },
    combat()  { blip(196, 0.1, 'sawtooth', 0.12); blip(196, 0.1, 'sawtooth', 0.12, 0.14); blip(233, 0.25, 'sawtooth', 0.13, 0.28); },
    jumpscare() { noise(0.3, 0.22); blip(880, 0.05, 'sawtooth', 0.2); blip(92, 0.5, 'sawtooth', 0.18, 0.05); blip(87, 0.6, 'sawtooth', 0.14, 0.2); },
    campana()  { for (let i = 0; i < 3; i++) { blip(220, 1.1, 'triangle', 0.16, i * 1.2); blip(331, 0.9, 'sine', 0.08, i * 1.2 + 0.02); } },
    // la penna che si spezza: uno SCROCCO secco, poi il patto che si slega — una scala che scende e si apre
    penna()    { noise(0.06, 0.2); blip(1200, 0.03, 'square', 0.14); blip(880, 0.04, 'square', 0.1, 0.04);
                 [659, 523, 392, 330, 262].forEach((f, i) => blip(f, 0.22, 'triangle', 0.1, 0.15 + i * 0.13));
                 blip(523, 1.4, 'sine', 0.07, 0.85); blip(659, 1.2, 'sine', 0.05, 0.9); },
    // la risata di Ada: giovane, roca, fuori orario — terzine di campanelle che salgono e inciampano
    risata()   { [523, 659, 587, 784, 698, 880, 1047].forEach((f, i) => blip(f, 0.09, 'triangle', 0.11, i * 0.09));
                 blip(784, 0.3, 'sine', 0.08, 0.66); blip(392, 0.5, 'triangle', 0.06, 0.7); },
  };

  function play(name) {
    try { if (effects[name]) effects[name](); } catch (e) { /* audio non disponibile: pazienza */ }
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('relais-muted', muted ? '1' : '0'); } catch (e) {}
    return muted;
  }

  function isMuted() { return muted; }

  /* ================= MUSICA DI SOTTOFONDO =================
     Piccolo sequencer chiptune: basso a onda triangolare + melodia quadra,
     tracce componibili come array di semitoni (null = pausa).          */

  let musicMuted = false;
  try { musicMuted = localStorage.getItem('relais-music-muted') === '1'; } catch (e) {}

  const NOTE = st => 440 * Math.pow(2, (st - 57) / 12); // semitono -> Hz (57 = LA4)

  /* Tracce tematiche horror: { bpm, vol, bass, lead, hat? } — step da 1/8.
     Poco volume, molte pause: nella casa che non finisce è il silenzio a suonare. */
  const TRACKS = {
    // Il titolo: un carillon davanti alla TV spenta — casa, ma sbagliata
    title: {
      bpm: 52, vol: 0.045,
      bass: [33, null, null, null, null, null, null, null, 32, null, null, null, null, null, null, null],
      lead: [69, null, 72, null, 76, null, 72, null, 69, null, 68, null, 64, null, null, null],
    },
    // In macchina verso il palazzo: movimento, ma qualcosa non torna
    viaggio: {
      bpm: 96, vol: 0.04,
      bass: [38, null, 38, null, 45, null, 44, null, 38, null, 38, null, 43, null, 41, null],
      lead: [null, 62, null, null, 65, null, 64, null, null, 62, null, null, 60, null, null, null],
    },
    // L'appartamento: la quiete sbagliata — note rade, ovattate, nessuno risponde
    appartamento: {
      bpm: 54, vol: 0.035,
      bass: [31, null, null, null, null, null, null, null, null, null, null, null, 38, null, null, null],
      lead: [null, null, null, null, 58, null, null, null, null, null, null, null, null, null, 57, null],
    },
    // Il corridoio che non c'era: il basso pulsa come passi dietro di voi
    corridoio: {
      bpm: 88, vol: 0.045,
      bass: [29, null, 29, null, 29, null, 29, null, 28, null, 28, null, 28, null, 30, null],
      lead: [null, null, null, null, 60, null, null, null, null, null, null, null, 59, null, null, null],
    },
    // Il Salotto-Cattedrale: ampio, riverberato, un coro che esce da una TV
    salotto: {
      bpm: 58, vol: 0.045,
      bass: [26, null, null, null, 33, null, null, null, 24, null, null, null, 31, null, null, null],
      lead: [57, null, null, 60, null, null, 62, null, 55, null, null, 58, null, null, 60, null],
    },
    // La biblioteca che sussurra: arpeggi minimi acuti su un bordone dal profondo
    biblioteca: {
      bpm: 76, vol: 0.04,
      bass: [24, null, null, null, null, null, null, null, 24, null, null, null, null, null, null, null],
      lead: [null, 72, 74, null, null, 71, null, null, null, 72, 75, null, null, 70, null, null],
    },
    // Il corridoio delle porte sbagliate: un carillon storto, le note sbagliano di un semitono
    porte: {
      bpm: 82, vol: 0.042,
      bass: [33, null, null, null, 40, null, null, null, 32, null, null, null, 39, null, null, null],
      lead: [69, null, 72, null, 76, null, 73, null, 69, null, 68, null, 75, null, 70, null],
    },
    // La Stanza Sommersa: basso profondissimo, note lente che affogano
    sommersa: {
      bpm: 48, vol: 0.05,
      bass: [22, null, null, null, null, null, null, null, 29, null, null, null, null, null, null, null],
      lead: [null, null, null, 58, null, 57, null, null, null, null, null, 55, null, 53, null, null],
    },
    // La cucina: freddo industriale — il ronzio del frigo e le gocce nel lavello
    cucina: {
      bpm: 70, vol: 0.038,
      bass: [26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 25, 25, 25, 25],
      lead: [null, null, null, 79, null, null, null, null, null, null, 77, null, null, null, null, null],
      hat:  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    },
    // Il sottoscala: gli inferi domestici — quasi solo basso, lentissimo, minaccioso
    sottoscala: {
      bpm: 44, vol: 0.05,
      bass: [24, null, null, 23, null, null, null, null, 24, null, null, 22, null, null, null, null],
      lead: [null, null, null, null, null, null, null, null, null, null, null, null, 50, null, null, null],
    },
    // La Switch nel bozzolo: chiptune FINTO-allegro, un loop corto che non smette MAI
    switch: {
      bpm: 140, vol: 0.05,
      bass: [36, 36, 43, 43, 36, 36, 43, 43],
      lead: [72, null, 76, null, 79, null, 76, 72],
      hat:  [1, 0, 1, 0, 1, 0, 1, 0],
    },
    // La sala del trono: la stessa allegria, ma degradata — più lenta, le note si spengono
    trono: {
      bpm: 92, vol: 0.045,
      bass: [36, null, null, null, 43, null, null, null, 35, null, null, null, 42, null, null, null],
      lead: [72, null, 75, null, 79, null, null, null, 71, null, 74, null, null, null, null, null],
    },
    // Scontro: la casa mostra i denti
    combat: {
      bpm: 126, vol: 0.05,
      bass: [33, 33, null, 33, 39, null, 33, null, 32, 32, null, 32, 38, null, 36, null],
      lead: [null, null, 60, null, null, 63, 60, null, null, null, 59, null, 62, null, null, null],
      hat:  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    // Eleinad: il boss, mille voci e un passo lentissimo
    boss: {
      bpm: 138, vol: 0.055,
      bass: [28, 28, 34, 28, 28, 35, 28, 34, 27, 27, 33, 27, 27, 34, 27, 33],
      lead: [57, null, null, 57, 58, null, 57, null, 56, null, null, 56, 57, null, 56, null],
      hat:  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    },
    // L'alba: la liberazione — maggiore, calda, che si apre
    alba: {
      bpm: 92, vol: 0.048,
      bass: [36, null, 43, null, 48, null, 43, null, 41, null, 45, null, 48, null, 50, null],
      lead: [60, null, 64, 67, 72, null, 76, null, 77, null, 76, 72, 79, null, null, null],
    },
  };

  let music = { track: null, timer: null, step: 0, nextTime: 0 };

  function stopMusic() {
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    music.track = null;
  }

  function scheduleNote(freq, t, dur, type, vol) {
    const a = ac();
    if (!a) return;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(a.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  function playMusic(name) {
    if (music.track === name) return;      // già in riproduzione
    stopMusic();
    if (muted || musicMuted) { music.track = name; return; } // ricorda la traccia per il toggle
    const a = ac();
    const tr = TRACKS[name];
    if (!a || !tr) { music.track = name; return; }
    music.track = name;
    music.step = 0;
    music.nextTime = a.currentTime + 0.06;
    const stepDur = 60 / tr.bpm / 2; // ottavi
    music.timer = setInterval(() => {
      if (muted || musicMuted) return;
      const ahead = a.currentTime + 0.25;
      while (music.nextTime < ahead) {
        const i = music.step % tr.bass.length;
        const b = tr.bass[i], l = tr.lead[i];
        if (b != null) scheduleNote(NOTE(b), music.nextTime, stepDur * 0.9, 'triangle', tr.vol * 1.15);
        if (l != null) scheduleNote(NOTE(l), music.nextTime, stepDur * 0.75, 'square', tr.vol * 0.7);
        if (tr.hat && tr.hat[i % tr.hat.length]) scheduleNote(NOTE(93 + (i % 2)), music.nextTime, 0.03, 'square', tr.vol * 0.25);
        music.nextTime += stepDur;
        music.step++;
      }
    }, 100);
  }

  function toggleMusicMute() {
    musicMuted = !musicMuted;
    try { localStorage.setItem('relais-music-muted', musicMuted ? '1' : '0'); } catch (e) {}
    const cur = music.track;
    stopMusic();
    if (!musicMuted && cur) playMusic(cur);
    else music.track = cur;
    return musicMuted;
  }

  // le AudioContext partono "suspended" finché l'utente non interagisce:
  // al primo gesto riavviamo la traccia richiesta
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => {
      const a = ac();
      if (a && music.track && !music.timer && !muted && !musicMuted) {
        const cur = music.track; music.track = null; playMusic(cur);
      }
    });
  }

  return { play, toggleMute, isMuted, music: playMusic, toggleMusicMute, isMusicMuted: () => musicMuted };
})();
