/* Western Spritz — app.js v40 */
console.log('[WS] app v41');

/*-- VERSIONE ORIGINALE */

// Pulizia vecchi service worker / cache dalle versioni precedenti
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
    console.log('[WS] pulizia vecchie cache completata');
  } catch (err) {
    console.error('[WS] errore pulizia cache', err);
  }
})();


/* ====== BACKGROUND RANDOM ====== */
(function(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');
  const url  = `./assets/images/background/${Math.floor(Math.random()*10)+1}.png`;
  if (blur) blur.style.backgroundImage = `url('${url}')`;
  if (main) main.style.backgroundImage = `url('${url}')`;
})();

/* ====== SPLASH (robusto) ====== */
(function(){
  const splash  = document.getElementById('splash');
  const start   = document.getElementById('startApp');
  const music   = document.getElementById('introMusic');

  // --- 1️⃣ Chiude lo splash e avvia musica
  const hideSplash = ()=>{
    try {
      if (music){
        music.muted = false;
        music.currentTime = 0;
        const p = music.play();
        if (p?.catch) p.catch(()=>{});
      }
    } catch {}
    splash?.classList.add('hidden');
  };
  start?.addEventListener('click', hideSplash, { once:true });
  window.addEventListener('keydown', (e)=>{
    if (e.key==='Enter' || e.key===' ') hideSplash();
  }, { once:true });

  // --- 2️⃣ Avvio silenzioso dell’audio (per sbloccare autoplay)
  try {
    if (music){
      music.muted = true;
      music.volume = 1;
      music.play().catch(()=>{});
    }
  } catch {}

  // --- 3️⃣ Helper: animazione western del contatore
  function animateCount(el, to) {
    const prevStored = Number(localStorage.getItem('ws_last_visits') || 0);
    const from = Number.isFinite(prevStored) && prevStored > 0
      ? prevStored
      : Number(el.textContent.replace(/\D/g,'') || 0);

    const target = Number(to);
    if (!Number.isFinite(target)) {
      el.textContent = '—';
      return;
    }

    const dur = 800; // durata animazione ms
    const t0 = performance.now();

    function step(t){
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.round(from + (target - from) * eased);
      el.textContent = val.toLocaleString('it-IT');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    // Effetto “puff” western
    el.classList.remove('count-pulse','count-shine');
    void el.offsetWidth; // forza reflow per riavviare animazione
    el.classList.add('count-pulse','count-shine');

    // Memorizza ultimo valore locale
    localStorage.setItem('ws_last_visits', String(target));
  }

   // --- 4️⃣ Contatore visite: Upstash via Vercel
  try {
    const el = document.getElementById('visitCounter');
    if (el) {
      // host considerati "sviluppo"
      const devHosts = ['', 'localhost', '127.0.0.1'];

      const isDev = devHosts.includes(location.hostname);

      // 👉 In sviluppo: NON chiamiamo l'API, mostriamo solo "DEV"
      if (isDev) {
        el.textContent = 'DEV';
        console.log('[WS] contatore disattivato in dev (host:', location.hostname, ')');
      } else {
        // 👉 Online (qualsiasi dominio reale): usa sempre /api/visits
        const URL = '/api/visits';
        console.log('[WS] visits endpoint:', URL, 'host:', location.hostname);

        fetch(URL, { cache: 'no-store', credentials: 'omit' })
          .then(r => r.json())
          .then(d => {
            console.log('[WS] visits response:', d);
            const n = Number(d?.value || 0);
            if (Number.isFinite(n)) {
              animateCount(el, n);
            } else {
              el.textContent = '—';
            }
          })
          .catch((err) => {
            console.error('[WS] errore contatore visite', err);
            el.textContent = '—';
          });
      }
    }
  } catch (err) {
    console.error('[WS] errore inizializzazione contatore', err);
  }

})(); // ✅ CHIUSURA DELL'IIFE SPLASH




/* ====== UTIL ====== */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const getYouTubeId = url => {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
  return m ? m[1] : null;
};

/* ====== DATA (brani) ====== */
let SONGS = [];
let FILTER = { dance:'', song:'' };
let PLAYLIST = JSON.parse(localStorage.getItem('ws_playlist') || '[]');

let plIndex = 0;
const plWindowName = 'ws_player';

function openAt(index){
  const item = PLAYLIST[index];
  if (!item) return;
  const url = item.songUrl || item.danceVideoUrl;
  if (!url) return;
  window.open(url, plWindowName);
}

const elCards = $('#cards');
const elCount = $('#count');

/* === Canzone in evidenza: FUN WITH ASIA sempre in cima === */
const FEATURED_KEY = 'FUN WITH ASIA';

function isFeaturedSong(s){
  const up = v => (v || '').toUpperCase().trim();
  return up(s.danceTitle) === FEATURED_KEY || up(s.songTitle) === FEATURED_KEY;
}

function promoteFeaturedSong(list){
  const idx = list.findIndex(isFeaturedSong);
  if (idx > 0){
    const [feat] = list.splice(idx, 1);
    list.unshift(feat);
  }
  return list;
}

/* ====== RENDER CARDS ====== */
function render(){
  if (!elCards || !elCount) return;

  const qd = FILTER.dance.toLowerCase();
  const qs = FILTER.song.toLowerCase();

  const rows = SONGS.filter(s =>
    (!qd || (s.danceTitle||'').toLowerCase().includes(qd)) &&
    (!qs || (s.songTitle||'').toLowerCase().includes(qs))
  );

  elCount.textContent = `Record trovati: ${rows.length}`;

  elCards.innerHTML = rows.map(s=>{
    const vid = getYouTubeId(s.songUrl || s.danceVideoUrl);
    const cover = vid ? `https://img.youtube.com/vi/${vid}/0.jpg` : './assets/images/icon.png';
    const inPl  = PLAYLIST.some(p=>p.songNumber===s.songNumber && p.year===s.year);
    const featured = isFeaturedSong(s);

    if (featured){
      // 🎯 CARD SPECIALE "FUN WITH ASIA"
      return `
      <article class="card card-asia-special">
        <div class="asia-top">
          <a class="asia-btn asia-btn-left"
             href="https://www.youtube.com/@funwithasia"
             target="_blank" rel="noopener">
            Fun with ASIA</span>
          </a>
          <div class="asia-follow">FOLLOW&nbsp;US!</div>
          <a class="asia-btn asia-btn-right"
             href="https://www.youtube.com/@funfamilytravelvlog"
             target="_blank" rel="noopener">
            Fun&nbsp;Family
          </a>
        </div>

        <div class="asia-main">

  <!-- LEFT SIDE -->
  <div class="asia-side">
    <a href="https://www.youtube.com/@funwithasia" target="_blank" rel="noopener">
      <img src="./assets/images/fun-asia-logo.png"
           alt="Fun with Asia"
           class="asia-circle">
    </a>
  </div>

  <!-- CENTER PHOTO -->
  <div class="asia-center">
  <img src="./assets/images/fun-asia-photo.png"
       alt="Fun with Asia Family"
       class="asia-photo">

  <div class="asia-subtext">SUBSCRIBE!!!</div>
</div>


  <!-- RIGHT SIDE -->
  <div class="asia-side">
    <a href="https://www.youtube.com/@funfamilytravelvlog" target="_blank" rel="noopener">
      <img src="./assets/images/fun-family-logo.png"
           alt="Fun Family Travel Vlog"
           class="asia-circle">
    </a>
  </div>

</div>

      </article>
      `;
    }

    // CARD NORMALE
    return `
      <article class="card">
        <div class="card-row">
          <img class="cover" src="${cover}" alt="cover" />
          <div style="flex:1; min-width:0">
            <div class="title">${(s.danceTitle||'').toUpperCase()}</div>
            <div class="meta">${s.singerName||''} — ${s.songTitle||''}</div>
          </div>
          <div class="badges">
            <span class="badge">#${s.songNumber}</span>
            <span class="badge year">ANNO&nbsp;<b>${s.year}</b></span>
          </div>
        </div>
        <div class="actions">
          <a class="action" data-open="dance" data-n="${s.songNumber}" data-y="${s.year}">Apri Ballo</a>
          <a class="action" data-open="song"  data-n="${s.songNumber}" data-y="${s.year}">Apri Canzone</a>
          <button class="action ${inPl?'play-added':''}" data-addpl data-n="${s.songNumber}" data-y="${s.year}">
            ${inPl?'✓ In playlist':'+ Playlist'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

/* ====== OPEN LINKS (frusta) ====== */
(function(){
  document.addEventListener('click', e=>{
    const a = e.target.closest?.('[data-open]');
    if (!a) return;
    const y = +a.dataset.y, n = +a.dataset.n;
    const s = SONGS.find(x=>x.year==y && x.songNumber==n);
    const url = a.dataset.open==='dance' ? s?.danceVideoUrl : s?.songUrl;
    if (!url) return;
    $('#fxWhip')?.play?.();
    setTimeout(()=> window.open(url, '_blank'), 120);
  });
})();

/* ====== PLAYLIST ====== */
function updatePlaylistButton(btn, inPlaylist){
  btn.classList.toggle('play-added', !!inPlaylist);
  btn.textContent = inPlaylist ? '✓ In playlist' : '+ Playlist';
}

document.addEventListener('click', e=>{
  const b = e.target.closest?.('[data-addpl]');
  if (!b) return;
  const y = +b.dataset.y, n = +b.dataset.n;
  const s = SONGS.find(x=>x.year==y && x.songNumber==n);
  if (!s) return;

  const idx = PLAYLIST.findIndex(p=>p.year==y && p.songNumber==n);
  if (idx>=0) PLAYLIST.splice(idx,1); else PLAYLIST.push(s);
  localStorage.setItem('ws_playlist', JSON.stringify(PLAYLIST));
  updatePlaylistButton(b, idx<0);
});

$('#btnPlaylist')?.addEventListener('click', ()=>{
  const modal = $('#plModal');
  const list  = $('#plList');
  if(!modal || !list) return;
  plIndex = 0;
  list.innerHTML = PLAYLIST.length
    ? PLAYLIST.map((s,i)=>`<div class="card" style="margin-top:8px">
        ${i+1}. ${s.danceTitle||''} — <i>${s.singerName||''}</i>
      </div>`).join('')
    : `<div class="card">Nessun brano nella playlist.</div>`;
  modal.classList.remove('hidden');
});

$('#plClose')?.addEventListener('click', ()=> $('#plModal')?.classList.add('hidden'));
$('#plClear')?.addEventListener('click', ()=>{
  PLAYLIST = [];
  localStorage.setItem('ws_playlist','[]');
  $('#plModal')?.classList.add('hidden');
  render();
});
$('#plPlay')?.addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  const ids = PLAYLIST
    .map(s => getYouTubeId(s.songUrl || s.danceVideoUrl))
    .filter(Boolean);
  if (!ids.length) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`;
  window.open(url, '_blank');
});
$('#plPrev')?.addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  plIndex = (plIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
  openAt(plIndex);
});
$('#plNext')?.addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  plIndex = (plIndex + 1) % PLAYLIST.length;
  openAt(plIndex);
});


/* ====== AREA RISERVATA: SAGGIO 2026 ====== */

function isSaggioAuth(){
  try {
    return sessionStorage.getItem(S_KEY) === 'saggio-2026-ok';
  } catch {
    return false;
  }
}

function openSaggioArea(){
  $('#saggioLoginModal')?.classList.add('hidden');
  $('#saggioArea')?.classList.remove('hidden');
}

$('#btnSaggio')?.addEventListener('click', ()=>{
  if (isSaggioAuth()){
    openSaggioArea();
  } else {
    $('#saggioLoginModal')?.classList.remove('hidden');
  }
});

$('#saggioCloseLogin')?.addEventListener('click', ()=>{
  $('#saggioLoginModal')?.classList.add('hidden');
});

$('#saggioCloseArea')?.addEventListener('click', ()=>{
  $('#saggioArea')?.classList.add('hidden');
});

$('#saggioLoginForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  const u = $('#saggioUser')?.value.trim() || '';
  const p = $('#saggioPass')?.value || '';
  const err = $('#saggioError');

  try {
    const res = await fetch('/api/saggio-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await res.json();

    if (res.ok && data?.ok && data?.token) {
        sessionStorage.setItem(S_KEY, data.token);
    if (err) err.classList.add('hidden');
        openSaggioArea();
    } 
    else {
      if (err) err.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Errore login saggio', e);
    if (err) err.classList.remove('hidden');
  }
});



/* ===========================================================
   PUZZLE / QUIZ — domanda casuale; esatto: rivela + nuova domanda; errato: non cambia
   =========================================================== */
const PZ_CFG = { livesByGrid: { 3: 7, 4: 5, 5: 4 } };

const TILE_COVERS = [
  './assets/images/covers/stivali.png',
  './assets/images/covers/luca_1.png',
  './assets/images/covers/ws_logo.png'
];


const PZ = {
  root:  $('#pzOverlay'),
  grid:  $('#pzGrid'),
  img:   $('#pzImg'),
  q:     $('#pzQuestion'),
  ans:   $('#pzAnswers'),
  score: $('#pzScore'),
  time:  $('#pzTime'),
  livesEl: $('#pzLives'),
  no:    $('#noImg'),
  size:  3,
  timer: null,
  t0: 0,
  lives: 7
};

/* --- musica puzzle --- */
function playBg(){
  const bg = document.getElementById('bgPuzzle');
  if (!bg) return;
  try { bg.volume = 0.6; bg.currentTime = 0; bg.play().catch(()=>{}); } catch {}
}
function stopBg(){
  const bg = document.getElementById('bgPuzzle');
  if (!bg) return;
  try { bg.pause(); } catch {}
}

/* --- vite --- */
function setLives(n){
  PZ.lives = n;
  if (PZ.livesEl) PZ.livesEl.textContent = String(Math.max(0, n));
}
function gameOver(){
  const over = document.createElement('div');
  over.className = 'bravo';
  over.textContent = 'Peccato! Tocca per riprovare';
  const restart = ()=>{
    over.remove();
    startPuzzle(true);
  };
  over.addEventListener('click', restart, { once:true });
  document.body.appendChild(over);
}

/* --- immagine casuale evitando ripetizione --- */
let pzLastIndex = -1;
function pickRandomPuzzleSrc(){
  const MAX = 27;
  let i;
  do { i = Math.floor(Math.random()*MAX)+1; } while (MAX>1 && i===pzLastIndex);
  pzLastIndex = i;
  return `./assets/images/puzzles/${i}.png`;
}
function loadNewPuzzleImage(){
  if (PZ.img) PZ.img.src = pickRandomPuzzleSrc();
}

/* --- griglia n×n --- */
function buildGrid(n){
  PZ.size = n;
  if (!PZ.grid) return;

  PZ.grid.innerHTML = '';
  PZ.grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  PZ.grid.style.gridTemplateRows    = `repeat(${n}, 1fr)`;

  // matrice copertine scelte
  const coverAt = Array.from({length:n}, ()=> Array(n).fill(null));

  for (let r = 0; r < n; r++){
    for (let c = 0; c < n; c++){
      const ban = new Set();
      if (c > 0) ban.add(coverAt[r][c-1]); // vieta la stessa della tessera a sinistra
      if (r > 0) ban.add(coverAt[r-1][c]); // vieta la stessa della tessera sopra

      const choices = TILE_COVERS.filter(u => !ban.has(u));
      const pick = choices[Math.floor(Math.random() * choices.length)];
      coverAt[r][c] = pick;

      const tile = document.createElement('div');
      tile.className = 'pz-tile';
      tile.style.setProperty('--cover-url', `url("${pick}")`);
      PZ.grid.appendChild(tile);
    }
  }
}

function livingTiles(){
  return PZ.grid ? Array.from(PZ.grid.querySelectorAll('.pz-tile:not(.cleared)')) : [];
}

/* --- rivela un tassello e verifica vittoria --- */
function revealRandomTileAndCheckWin(){
  const live = livingTiles();
  if (!live.length) return;

  const t = live[Math.floor(Math.random()*live.length)];

  // reset + avvio animazione
  t.classList.remove('hit');
  t.style.animation = 'none';
  t.offsetHeight; // reflow
  t.style.animation = '';
  t.classList.add('hit');

  let finalized = false;
  const finalize = ()=>{
    if (finalized) return;
    finalized = true;

    t.classList.remove('hit');
    t.classList.add('cleared');
    // fallback visivo inline
    t.style.opacity = '0';
    t.style.visibility = 'hidden';
    t.style.pointerEvents = 'none';

    // puff
    try {
      const wrap = PZ.grid?.parentElement;
      if (wrap){
        const tr = t.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();
        const puff = document.createElement('div');
        puff.className = 'puff';
        puff.style.left = (tr.left + tr.width/2 - wr.left) + 'px';
        puff.style.top  = (tr.top  + tr.height/2 - wr.top)  + 'px';
        wrap.appendChild(puff);
        puff.addEventListener('animationend', ()=>puff.remove(), { once:true });
      }
    } catch {}

    // vittoria?
    if (!livingTiles().length){
      try { $('#fxVictory')?.play(); } catch {}
      stopBg();
      setTimeout(()=>{
        const bravo = document.createElement('div');
        bravo.className = 'bravo';
        bravo.textContent = 'Bravo! Tocca per ricominciare';
        const restart = ()=>{
          bravo.remove();
          startPuzzle(true);
        };
        bravo.addEventListener('click', restart, { once:true });
        document.body.appendChild(bravo);
      }, 300);
    }
  };

  // standard: quando l'animazione finisce
  const onEnd = ()=>{ t.removeEventListener('animationend', onEnd); finalize(); };
  t.addEventListener('animationend', onEnd);

  // fallback temporale
  setTimeout(finalize, 700);
}

/* --- timer --- */
function startTimer(){
  clearInterval(PZ.timer);
  PZ.t0 = Date.now();
  PZ.timer = setInterval(()=>{
    const s = Math.floor((Date.now()-PZ.t0)/1000);
    const m = `${Math.floor(s/60)}`.padStart(2,'0');
    const ss= `${s%60}`.padStart(2,'0');
    if (PZ.time) PZ.time.textContent = `${m}:${ss}`;
  }, 500);
}

/* ====================== QUIZ ENGINE (random vero) ====================== */
const Quiz = (function(){
  let pool = [];        // tutte le chiavi disponibili
  let deck = [];        // mazzo rimanente (SEMpre mescolato)
  let current = null;   // { q, correct, answers }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function buildPool(){
    // Costruisci l’elenco delle possibili domande dal database
    pool = SONGS.flatMap(s=>{
      const keys = [];
      if (s?.singerName && s?.songTitle) keys.push({ type:'SINGER', year:s.year, num:s.songNumber });
      if (s?.danceTitle  && s?.songTitle) keys.push({ type:'DANCE',  year:s.year, num:s.songNumber });
      return keys;
    });
    // Prepara un mazzo iniziale già mescolato
    deck = shuffle([...pool]);
  }

  function ensureDeck(){
    if (!deck.length) {
      // quando finisce, ricrea un mazzo nuovo e mescolato
      deck = shuffle([...pool]);
    }
  }

  function pickOptions(correct, field){
    const uniq = new Set([correct]);
    let guard = 0;
    while(uniq.size<4 && guard<800){
      guard++;
      const o = SONGS[Math.floor(Math.random()*SONGS.length)]?.[field];
      if(o) uniq.add(o);
    }
    return shuffle([...uniq]);
  }

  function makeQuestion(key){
    const s = SONGS.find(x=> x.year==key.year && x.songNumber==key.num);
    if(!s) return { q:'Domanda non disponibile', correct:'', answers:[] };

    if(key.type==='SINGER'){
      return {
        q: `Chi è il cantante di “${s.songTitle}”?`,
        correct: s.singerName,
        answers: pickOptions(s.singerName, 'singerName')
      };
    } else {
      return {
        q: `Qual è il titolo del ballo per “${s.songTitle}”?`,
        correct: s.danceTitle,
        answers: pickOptions(s.danceTitle, 'danceTitle')
      };
    }
  }

  function next(){
    ensureDeck();
    const k = deck.pop();              // preleva dall’estremità del mazzo mescolato
    current = makeQuestion(k);
    return current;
  }

  function get(){ return current; }

  const norm = v => String(v??'').trim().toLowerCase();
  function isCorrect(ans){ return norm(ans) === norm(current?.correct); }

  function init(){ buildPool(); }                // costruisce pool + deck mescolato
  function reset(){ deck = shuffle([...pool]); } // <<< ora reset mescola SEMPRE

  return { init, next, get, isCorrect, reset };
})();


/* --- render domanda --- */
function renderQuestion(){
  const q = Quiz.get() || Quiz.next();
  if (!PZ.q || !PZ.ans) return;
  PZ.q.textContent = q.q;
  PZ.ans.innerHTML = '';
  q.answers.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = String(opt).toUpperCase();
    btn.dataset.raw = String(opt);
    btn.addEventListener('click', ()=> onAnswer(btn.dataset.raw));
    PZ.ans.appendChild(btn);
  });
}

/* --- gestione risposta --- */
function onAnswer(val){
  if(!Quiz.get()) return;

  if(Quiz.isCorrect(val)){
    try{ $('#fxOk')?.play(); }catch{}
    try{ const gun=$('#fxGun'); if(gun){ gun.currentTime=0; gun.play().catch(()=>{});} }catch{}
    revealRandomTileAndCheckWin();
    Quiz.next();
    renderQuestion();
    return;
  }

  // errata → non cambiare domanda
  try{ $('#fxWrong')?.play(); }catch{}
  const no = PZ.no;
  if(no){ no.classList.remove('hidden'); no.classList.add('shake'); }
  setTimeout(()=>{
    if(no){ no.classList.add('hidden'); no.classList.remove('shake'); }
    setLives(PZ.lives - 1);
    if(PZ.lives <= 0){ stopBg(); gameOver(); }
  }, 700);
}

/* --- misura topbar per safe-area iOS e centratura --- */
function updateTopbarHeight(){
  const tb = document.querySelector('.pz-topbar');
  if (!tb) return;
  document.documentElement.style.setProperty('--pz-topbar-h', tb.offsetHeight + 'px');
}

/* --- avvio / UI puzzle --- */
function startPuzzle(){
  PZ.root?.classList.remove('hidden');
  updateTopbarHeight();

  loadNewPuzzleImage();
  buildGrid(PZ.size);
  const max = PZ_CFG.livesByGrid[PZ.size] ?? 5;
  setLives(max);

  Quiz.reset();
  Quiz.next();
  renderQuestion();

  startTimer();
  playBg();
}

// Effetto "liquid light" che segue il dito/mouse
(function attachLiquidFollow(){
  const grid = PZ.grid;
  if (!grid || grid.__liquidBound) return;
  grid.__liquidBound = true;

  const move = (e)=>{
    const r = grid.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    grid.style.setProperty('--mx', x.toFixed(1) + '%');
    grid.style.setProperty('--my', y.toFixed(1) + '%');
  };
  grid.addEventListener('pointermove', move);
  grid.addEventListener('pointerleave', ()=> {
    grid.style.setProperty('--mx', '50%');
    grid.style.setProperty('--my', '40%');
  });
})();



/* --- bindings UI puzzle --- */
$('#btnPuzzle')?.addEventListener('click', ()=> startPuzzle());
$('#pzClose' )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); stopBg(); });
$('#pzBack'  )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); stopBg(); });
$('#pzNext'  )?.addEventListener('click', ()=>{ loadNewPuzzleImage(); buildGrid(PZ.size); updateTopbarHeight(); });

$$('.chip-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    $$('.chip-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    PZ.size = +b.dataset.diff;
    buildGrid(PZ.size);
    const max = PZ_CFG.livesByGrid[PZ.size] ?? 5;
    setLives(max);
  });
});

addEventListener('resize', updateTopbarHeight);
addEventListener('orientationchange', updateTopbarHeight);

/* ====== FILTRI ====== */
$('#fDance')?.addEventListener('input', e=>{ FILTER.dance = e.target.value; render(); });
$('#fSong' )?.addEventListener('input', e=>{ FILTER.song  = e.target.value; render(); });
$('#clearFilters')?.addEventListener('click', ()=>{
  FILTER={dance:'',song:''};
  const fd = $('#fDance'), fs = $('#fSong');
  if (fd) fd.value='';
  if (fs) fs.value='';
  render();
});

/* ====== DATA LOAD ====== */
async function load(){
  try{
    const res = await fetch('./data/songs.json', { cache:'no-store' });
    SONGS = await res.json();
    SONGS.sort((a,b)=> (b.songNumber||0) - (a.songNumber||0)); // ordine inverso

    // spinge "FUN WITH ASIA" in cima
    promoteFeaturedSong(SONGS);

    Quiz.init();   // prepara pool domande

    render();
  }catch(e){
    if (elCards) elCards.innerHTML = `<div class="card">Errore nel caricamento dati.</div>`;
    console.error('Errore caricamento songs.json', e);
  }
}
load();

/* ====== Aggiorna app (semplice reload pulito) ====== */
$('#btnUpdate')?.addEventListener('click', () => {
  // forziamo una nuova richiesta ignorando ogni cache
  const url = new URL(window.location.href);
  url.searchParams.set('refresh', Date.now().toString());
  window.location.replace(url.toString());
});


/* === WS v41.2 Cinematic Pack hooks === */
(function(){
  // Ensure scroll-reveal observer
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let io = null;
  function ensureObserver(){
    if(REDUCED || io) return;
    io = new IntersectionObserver((entries)=>{
      for(const e of entries){ if(e.isIntersecting){ e.target.classList.add('ws-in'); io.unobserve(e.target); } }
    }, { threshold: 0.15 });
  }
  function observeAll(){
    if(REDUCED) return;
    ensureObserver();
    document.querySelectorAll('.ws-reveal').forEach(el=>{ if(!el.__wsObserved){ io.observe(el); el.__wsObserved=true; } });
  }
  // Apply vintage frame + ws-reveal and stagger to cards
  function styleCards(){
    const cards = document.querySelectorAll('article.card');
    let i = 0;
    cards.forEach(c=>{
      c.classList.remove('vintage');     // ← via il frame vintage
      c.classList.add('ws-reveal');      // keep reveal
      c.style.setProperty('--ws-stagger', Math.min(i*30, 450)+'ms');
      // bind liquid follow
      if (!c.__liquidBound){
        c.__liquidBound = true;
        const move = (e)=>{
          const r = c.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100;
          const y = ((e.clientY - r.top) / r.height) * 100;
          c.style.setProperty('--mx', x.toFixed(1) + '%');
          c.style.setProperty('--my', y.toFixed(1) + '%');
        };
        c.addEventListener('pointermove', move);
        c.addEventListener('pointerleave', ()=>{
          c.style.setProperty('--mx','50%');
          c.style.setProperty('--my','30%');
        });
      }
      i++;
    });
    observeAll();
  }
  // Hook into render() if exists, else run on DOM ready
  try{
    const _render = render;
    render = function(){ _render.apply(this, arguments); styleCards(); };
  }catch(e){
    document.addEventListener('DOMContentLoaded', styleCards);
  }
  // Run once if DOM is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(styleCards, 0);
  }
})();


/* ====== Snow (Splash) ====== */
(function initSplashSnow(){
  const canvas = document.getElementById('snowCanvas');
  if (!canvas) return;

  // rispetta "Riduci animazioni"
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0, raf = 0;
  const flakes = [];
  const FLAKES = 90; // aumenta/diminuisci densità

  function resize(){
    const rect = canvas.parentElement?.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect?.width || window.innerWidth));
    H = Math.max(1, Math.floor(rect?.height || window.innerHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnFlake(){
    return {
      x: Math.random() * W,
      y: -10 - Math.random() * H,
      r: 1 + Math.random() * 2.2,
      vx: -0.35 + Math.random() * 0.7,
      vy: 0.6 + Math.random() * 1.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02
    };
  }

  function fill(){
    flakes.length = 0;
    for (let i=0;i<FLAKES;i++) flakes.push(spawnFlake());
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.beginPath();
    for (const f of flakes){
      f.wobble += f.wobbleSpeed;
      f.x += f.vx + Math.sin(f.wobble) * 0.25;
      f.y += f.vy;

      if (f.y > H + 12) {
        // ricicla dall’alto
        f.y = -12;
        f.x = Math.random() * W;
      }
      if (f.x < -20) f.x = W + 20;
      if (f.x > W + 20) f.x = -20;

      ctx.moveTo(f.x + f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();

    raf = requestAnimationFrame(draw);
  }

  // avvia solo se splash visibile
  function start(){
    stop();
    resize();
    fill();
    raf = requestAnimationFrame(draw);
  }
  function stop(){
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // quando lo splash si mostra/nasconde (adatta questi selettori se diversi)
  const splash = canvas.parentElement; // tipicamente il container splash
  start();

  window.addEventListener('resize', resize);

  // se il tuo splash viene "chiuso" (display:none), fermiamo l’animazione automaticamente
  const obs = new MutationObserver(()=>{
    const hidden = splash && (getComputedStyle(splash).display === 'none' || getComputedStyle(splash).visibility === 'hidden');
    if (hidden) stop(); else if (!raf) start();
  });
  if (splash) obs.observe(splash, { attributes:true, attributeFilter:['style','class'] });
})();

/* ====== Snow (APP – schede, vento + stelline oro + micro-trail ghiaccio) ====== */
(function initAppSnow(){
  const canvas = document.getElementById('snowCanvasApp');
  if (!canvas) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext('2d', { alpha:true });
  let W=0, H=0, raf=0;

  const flakes=[];
  const sparkles=[];

  const FLAKES = 80;          // densità neve
  const SPARKLE_RATE = 0.014; // 1 ogni ~1-2s
  const MAX_SPARKLES = 5;

  // vento: dolce oscillazione + micro raffiche
  let windT = 0;

  function resize(){
    const rect = canvas.parentElement?.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect?.width || window.innerWidth));
    H = Math.max(1, Math.floor(rect?.height || window.innerHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W+'px';
    canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function spawnFlake(){
    return {
      x: Math.random()*W,
      y: Math.random()*H,
      r: 0.8 + Math.random()*1.6,
      vy: 0.35 + Math.random()*0.85,
      drift: -0.15 + Math.random()*0.3,
      wobble: Math.random()*Math.PI*2,
      wobbleSpeed: 0.008 + Math.random()*0.015
    };
  }

  function fill(){
    flakes.length=0;
    for(let i=0;i<FLAKES;i++) flakes.push(spawnFlake());
  }

  // stellina 5 punte
  function drawStar(cx, cy, spikes, outerR, innerR){
    let rot = Math.PI / 2 * 3;
    let x = cx, y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++){
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  }

  function spawnSparkle(){
    const size = 5 + Math.random()*4;
    return {
      x: Math.random()*W,
      y: -18,
      vy: 0.9 + Math.random()*1.2,
      vx: -0.12 + Math.random()*0.24,
      spin: Math.random()*Math.PI*2,
      spinSpeed: 0.03 + Math.random()*0.05,
      life: 0,
      maxLife: 220 + Math.random()*140,
      size,

      // micro-trail: memorizzo un po' di posizioni recenti
      trail: [],
      trailMax: 14 + Math.floor(Math.random()*6) // scia corta
    };
  }

  function alphaLife(life, maxLife){
    const fadeIn = Math.min(1, life / 28);
    const fadeOut = Math.min(1, (maxLife - life) / 45);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // vento orizzontale
    windT += 0.01;
    const baseWind = Math.sin(windT) * 0.35;
    const gust = Math.sin(windT * 0.37) * 0.12;
    const wind = baseWind + gust;

    // NEVE
    ctx.beginPath();
    for(const f of flakes){
      f.wobble += f.wobbleSpeed;
      f.y += f.vy;
      f.x += f.drift + wind + Math.sin(f.wobble) * 0.2;

      if (f.y > H + 10){
        f.y = -10;
        f.x = Math.random()*W;
      }
      if (f.x < -20) f.x = W + 20;
      if (f.x > W + 20) f.x = -20;

      ctx.moveTo(f.x+f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    }
    ctx.fillStyle='rgba(255,255,255,.72)';
    ctx.fill();

    // genera stelline
    if (sparkles.length < MAX_SPARKLES && Math.random() < SPARKLE_RATE){
      sparkles.push(spawnSparkle());
    }

    // STELLINE + TRAIL
    for(let i=sparkles.length-1; i>=0; i--){
      const s = sparkles[i];
      s.life++;

      // aggiorna posizione
      s.spin += s.spinSpeed;
      s.y += s.vy;
      s.x += s.vx + wind * 0.9;

      // trail: salva posizione corrente (testa trail)
      s.trail.unshift({ x: s.x, y: s.y });
      if (s.trail.length > s.trailMax) s.trail.pop();

      const a = alphaLife(s.life, s.maxLife);
      const pulse = 0.86 + 0.14 * Math.sin(s.life * 0.08); // lieve pulsazione premium
      const starAlpha = a * pulse;

      // --- MICRO-TRAIL (ghiaccio) ---
      // scia con piccoli segmenti, più trasparente verso il fondo
      for(let t=0; t<s.trail.length-1; t++){
        const p0 = s.trail[t];
        const p1 = s.trail[t+1];
        const ta = starAlpha * (1 - t / s.trail.length);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, (s.size * 0.20) * (1 - t / s.trail.length));

        // glow ghiaccio (bianco/azzurro)
        ctx.shadowColor = 'rgba(210,245,255,0.9)';
        ctx.shadowBlur = 10;

        const icy = `rgba(225, 250, 255, ${0.25 * ta})`;
        ctx.strokeStyle = icy;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();
      }

      // --- STELLA ORO (più luminosa) ---
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);

      // glow oro forte ma pulito
      ctx.shadowColor = 'rgba(255, 215, 120, 0.95)';
      ctx.shadowBlur = 20;

      // oro brillante
      ctx.fillStyle = `rgba(255, 220, 130, ${0.95 * starAlpha})`;
      drawStar(0, 0, 5, s.size, s.size * 0.45);

      // core bianco caldo per "sparkle" premium
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * starAlpha})`;
      drawStar(0, 0, 5, s.size * 0.7, s.size * 0.33);

      ctx.restore();

      // riciclo
      if (s.life >= s.maxLife || s.y > H + 40){
        sparkles.splice(i, 1);
      } else {
        // wrap laterale
        if (s.x < -30) s.x = W + 30;
        if (s.x > W + 30) s.x = -30;
      }
    }

    raf=requestAnimationFrame(draw);
  }

  resize();
  fill();
  raf=requestAnimationFrame(draw);
  window.addEventListener('resize', resize);
})();
