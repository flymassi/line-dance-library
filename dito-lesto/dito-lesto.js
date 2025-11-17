// Dito Lesto — v4.1 (random sprites + preload + no-repeat)
(()=>{
  const arena   = document.getElementById('arena');
  const target  = document.getElementById('target');
  const sprite  = document.getElementById('sprite');
  const toast   = document.getElementById('toast');
  const sScore  = document.getElementById('score');
  const sLives  = document.getElementById('lives');
  const sRound  = document.getElementById('round');
  const selDiff = document.getElementById('difficulty');
  const sfxShot = document.getElementById('sfxShot');
  const sfxOk   = document.getElementById('sfxOk');
  const sfxWrong= document.getElementById('sfxWrong');

  // --- IMMAGINI (percorso reale che mi hai dato) ---
  const SPRITES = [
    './img/luca.png',
    './img/alessia.png',
    './img/mg.png',
    './img/western-spritz.png',
    './img/mascotte.png'
  ];

  // Verrà riempito solo con quelle che esistono davvero
  let AVAILABLE_SPRITES = [];

  // --- stato ---
  const state = {
    playing:false, score:0, round:1, lives:4,
    showMs:1000, spawnDelayMin:450, spawnDelayMax:1200,
  };
  let hideT=null, spawnT=null;
  let lastSprites=[]; // evita ripetizioni nelle ultime 2

  // --- util ---
  const rnd=(min,max)=> Math.random()*(max-min)+min;
  const irnd=(min,max)=> Math.floor(rnd(min,max+1));
  const clamp=(v,min,max)=> Math.max(min, Math.min(max,v));

  function updateHud(){
    if (sScore) sScore.textContent = String(state.score);
    if (sLives) sLives.textContent = String(Math.max(0,state.lives));
    if (sRound) sRound.textContent = String(state.round);
  }

  function applyDiff(){
    const d = selDiff?.value || 'normal';
    if (d==='easy'){ state.showMs=1300; state.spawnDelayMin=600; state.spawnDelayMax=1400; state.lives=5; }
    else if (d==='hard'){ state.showMs=800; state.spawnDelayMin=300; state.spawnDelayMax=900; state.lives=3; }
    else { state.showMs=1000; state.spawnDelayMin=450; state.spawnDelayMax=1200; state.lives=4; }
    updateHud();
  }
  selDiff?.addEventListener('change', applyDiff);

  function flash(msg){
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toast.hidden = true, 850);
  }

  function clearTimers(){ clearTimeout(hideT); hideT=null; clearTimeout(spawnT); spawnT=null; }

  function hideTarget(){
    clearTimers();
    if (!target) return;
    target.hidden = true;
    target.classList.remove('spinning');
  }

  // --- PRELOAD: carica tutte le immagini e usa solo quelle che esistono ---
  function preloadSprites(urls){
    return new Promise((resolve)=>{
      if (!urls || !urls.length) return resolve([]);
      let left = urls.length;
      const ok = [];
      urls.forEach(u=>{
        const im = new Image();
        im.onload  = ()=>{ ok.push(u); if(--left===0) resolve(ok); };
        im.onerror = ()=>{ console.warn('[DL] sprite NOT found:', u); if(--left===0) resolve(ok); };
        // cache-busting leggero per evitare SW cache vecchia
        im.src = u + ((u.includes('?')?'&':'?') + 'v=' + Date.now());
      });
    });
  }

  // --- scelta immagine: random + non ripetere ultime 2 ---
  function pickSprite(){
    const base = AVAILABLE_SPRITES.length ? AVAILABLE_SPRITES : SPRITES;
    const avoid = new Set(lastSprites);
    const candidates = base.filter(u => !avoid.has(u));
    const pool = candidates.length ? candidates : base; // se restano <2, rilassiamo il vincolo
    const url = pool[ irnd(0, pool.length-1) ];

    sprite.onerror = () => { sprite.src = '../assets/images/icon.png'; };
    sprite.src = url;

    lastSprites.push(url);
    if (lastSprites.length > 2) lastSprites = lastSprites.slice(-2);
  }

  function placeTarget(){
    const rect = arena.getBoundingClientRect();
    const size = 64, padX=18, padY=30;
    const x = rnd(padX, rect.width - size - padX);
    const y = rnd(padY, rect.height - size - padY);
    target.style.left = x+'px';
    target.style.top  = y+'px';
  }

  function playVar(audio, a=0.92, b=1.18){
    if (!audio) return;
    try{
      audio.pause(); audio.currentTime=0;
      audio.playbackRate=rnd(a,b);
      audio.volume=clamp((audio.volume||1)*rnd(.92,1),0,1);
      audio.play().catch(()=>{});
    }catch{}
  }

  function showTarget(){
    pickSprite();
    placeTarget();
    target.hidden = false;
    target.classList.add('spinning');
    clearTimeout(hideT);
    hideT = setTimeout(()=>{ if (!target.hidden) miss(); }, state.showMs);
  }

  function spawnLoop(){
    if(!state.playing) return;
    hideTarget();
    const delay = rnd(state.spawnDelayMin, state.spawnDelayMax);
    clearTimeout(spawnT);
    spawnT = setTimeout(showTarget, delay);
  }

  function hit(){
    if (target.hidden) return;
    state.score += 1;
    state.round++;
    updateHud();
    playVar(sfxShot, .9, 1.2); playVar(sfxOk, .95, 1.25);
    state.showMs = clamp(state.showMs - 12, 550, 2000);
    state.spawnDelayMax = clamp(state.spawnDelayMax - 8, 600, 2000);
    spawnLoop();
  }

  function miss(){
    hideTarget();
    state.lives--;
    updateHud();
    playVar(sfxWrong, .9, 1.1);
    flash('Mancato!');
    if (state.lives<=0) return gameOver();
    spawnLoop();
  }

  function gameOver(){
    state.playing=false;
    hideTarget();
    const overlay = document.createElement('div');
    overlay.className='toast';
    overlay.style.padding='16px 18px';
    overlay.innerHTML = `<strong>Game Over</strong><br>⭐ Punteggio: ${state.score}`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', ()=>{ overlay.remove(); showStart(); }, { once:true });
  }

  function showCountdown(done){
    hideTarget();
    const old = document.getElementById('dlCountdown'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id='dlCountdown';
    const b = document.createElement('div'); b.className='bubble'; wrap.appendChild(b);
    document.body.appendChild(wrap);
    const steps = ['Pronti', '3', '2', '1', 'VIA!'];
    let i=0;
    const tick=()=>{ b.textContent = steps[i++]; (i<steps.length) ? setTimeout(tick,650) : setTimeout(()=>{ wrap.remove(); done&&done(); },300); };
    tick();
  }

  function start(){
    if (state.playing) return;
    state.playing=true; state.score=0; state.round=1; lastSprites=[];
    applyDiff(); updateHud();
    const cta = document.getElementById('cta'); if (cta) cta.remove();

    // PRELOAD, poi countdown e avvio
    preloadSprites(SPRITES).then(ok=>{
      AVAILABLE_SPRITES = ok;
      if (!AVAILABLE_SPRITES.length){
        console.warn('[DL] Nessuna immagine caricata: controllo i percorsi! Uso lista completa senza preload.');
      } else {
        console.log('[DL] Sprites caricati:', AVAILABLE_SPRITES);
      }
      showCountdown(()=> spawnLoop());
    });
  }

  function bindStart(){
    const btn = document.getElementById('start');
    if (btn && !btn.__dlBound){
      btn.__dlBound = true;
      btn.addEventListener('click', start, { once:true });
    }
  }

  // eventi
  target.addEventListener('click', hit);
  document.getElementById('btnHelp')?.addEventListener('click', ()=> flash('Tocca il bersaglio appena compare. Fai in fretta!'));

  // boot
  hideTarget();
  bindStart();
  document.addEventListener('DOMContentLoaded', bindStart);
  console.log('[DL] boot ok');
})();
