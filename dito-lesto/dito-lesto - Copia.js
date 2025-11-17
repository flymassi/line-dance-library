// Dito Lesto — v2: immagini random + suoni variabili
(() => {
  const arena = document.getElementById('arena');
  const target = document.getElementById('target');
  const sprite = document.getElementById('sprite');
  const startBtn = document.getElementById('start');
  const toast = document.getElementById('toast');
  const sScore = document.getElementById('score');
  const sLives = document.getElementById('lives');
  const sRound = document.getElementById('round');
  const selDiff = document.getElementById('difficulty');

  const sfxShot = document.getElementById('sfxShot');
  const sfxOk = document.getElementById('sfxOk');
  const sfxWrong = document.getElementById('sfxWrong');

  // Cartella immagini: \line-dance-library\dito-lesto\img -> percorso relativo dal file
  // Esempi attesi: ./img/luca.png, ./img/alessia.png
  const SPRITES = [
    './img/luca.png',
    './img/alessia.png',
    './img/mg.png',
    './img/mascotte.png',
    './img/western-spritz.png'
  ];

  const state = {
    playing: false,
    score: 0,
    round: 1,
    lives: 4,
    showMs: 1000,     // tempo utile per clic (ms) — normale
    spawnDelayMin: 450,
    spawnDelayMax: 1200,
    t0: 0,
    timer: null,
    hideTimer: null,
  };

  // Difficoltà
  function applyDiff() {
    const d = selDiff?.value || 'normal';
    if (d === 'easy') {
      state.showMs = 1300; state.spawnDelayMin = 600; state.spawnDelayMax = 1400;
      state.lives = 5;
    } else if (d === 'hard') {
      state.showMs = 800; state.spawnDelayMin = 300; state.spawnDelayMax = 900;
      state.lives = 3;
    } else {
      state.showMs = 1000; state.spawnDelayMin = 450; state.spawnDelayMax = 1200;
      state.lives = 4;
    }
    updateHud();
  }
  selDiff?.addEventListener('change', applyDiff);

  function rnd(min, max){ return Math.random()*(max-min)+min; }
  function irnd(min, max){ return Math.floor(rnd(min,max+1)); }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function pickSprite(){
    const i = irnd(0, SPRITES.length-1);
    const url = SPRITES[i];
    // fallback: se immagine non carica, usa icona di progetto
    sprite.onerror = () => { sprite.src = '../assets/images/icon.png'; };
    sprite.src = url;
  }

  function placeTarget(){
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
    const size = 64;
    const paddingX = 18;
    const paddingY = 30; // un po' più alto per non sovrapporsi alla CTA
    const x = rnd(paddingX, rect.width - size - paddingX);
    const y = rnd(paddingY, rect.height - size - paddingY);
    target.style.left = x + 'px';
    target.style.top  = y + 'px';
  }

  function showTarget(){
    pickSprite();
    placeTarget();
    target.hidden = false;
    // Sblocco suoni su mobile
    try{ sfxShot.volume = 1; sfxShot.muted = false; }catch{}
    state.t0 = performance.now();
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(()=> miss(), state.showMs);
  }

  function hideTarget(){
    target.hidden = true;
    clearTimeout(state.hideTimer);
  }

  function spawnLoop(){
    if(!state.playing) return;
    hideTarget();
    const delay = rnd(state.spawnDelayMin, state.spawnDelayMax);
    clearTimeout(state.timer);
    state.timer = setTimeout(showTarget, delay);
  }

  function playVaried(audio, min=0.92, max=1.18){
    if (!audio) return;
    try{
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = rnd(min, max);
      // piccolo random sul volume per varietà
      audio.volume = clamp((audio.volume || 1) * rnd(0.92, 1.0), 0, 1);
      audio.play().catch(()=>{});
    }catch{}
  }

  function hit(){
    if (target.hidden) return;
    const dt = performance.now() - state.t0;
    state.score += Math.max(1, Math.round((state.showMs - dt)/40)); // premio velocità
    state.round++;
    updateHud();
    playVaried(sfxShot, 0.9, 1.2);
    playVaried(sfxOk, 0.95, 1.25);
    flash(`Bravo! ${Math.round(dt)} ms`);
    // aumenta difficoltà gradualmente
    state.showMs = clamp(state.showMs - 12, 550, 2000);
    state.spawnDelayMax = clamp(state.spawnDelayMax - 8, 600, 2000);
    spawnLoop();
  }

  function miss(){
    if (target.hidden) return;
    hideTarget();
    state.lives--;
    updateHud();
    playVaried(sfxWrong, 0.9, 1.1);
    flash('Mancato!');
    if (state.lives <= 0) {
      gameOver();
    } else {
      spawnLoop();
    }
  }

  function updateHud(){
    if (sScore) sScore.textContent = String(state.score);
    if (sLives) sLives.textContent = String(Math.max(0, state.lives));
    if (sRound) sRound.textContent = String(state.round);
  }

  function flash(msg){
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toast.hidden = true, 800);
  }

  function gameOver(){
    state.playing = false;
    hideTarget();
    clearTimeout(state.timer);
    const overlay = document.createElement('div');
    overlay.className = 'toast';
    overlay.style.padding = '16px 18px';
    overlay.innerHTML = `<strong>Game Over</strong><br>⭐ Punteggio: ${state.score}`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', ()=> {
      overlay.remove();
      showStart();
    }, { once:true });
  }

  function start(){
    state.playing = true;
    state.score = 0;
    state.round = 1;
    applyDiff();
    updateHud();
    const cta = document.getElementById('cta');
    if (cta) cta.remove();
    spawnLoop();
  }

  function showStart(){
    // se esiste già, collega solo l'evento
    const existing = document.getElementById('cta');
    if (existing && existing.querySelector('#start')){
      existing.querySelector('#start').addEventListener('click', start, { once:true });
      return;
    }
    const cta = document.createElement('div');
    cta.id = 'cta';
    cta.className = 'cta';
    cta.innerHTML = `
      <h2>Pronto a sparare?</h2>
      <p>Tocca il bersaglio appena compare. Più veloce sei, più punti fai!</p>
      <button id="start" class="btn primary">Avvia</button>
    `;
    arena.appendChild(cta);
    cta.querySelector('#start')?.addEventListener('click', start, { once:true });
  }

  // Eventi
  target.addEventListener('click', hit);
  document.getElementById('btnHelp')?.addEventListener('click', () => {
    flash('Tocca il bersaglio appena compare. Fai in fretta!');
  });

  // Avvio: collega il pulsante se già presente, altrimenti crea
  const existingCta = document.getElementById('cta');
  if (existingCta && existingCta.querySelector('#start')){
    existingCta.querySelector('#start').addEventListener('click', start, { once:true });
  } else {
    showStart();
  }
})();
