/* Western Spritz — app.js v40 */
console.log('[WS] app v44');

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
  lbModal: $('#pzLbModal'),
  lbList: $('#pzLbList'),
  lbWeek: $('#pzLbWeek'),
  lbPlayer: $('#pzLbPlayer'),
  size:  3,
  timer: null,
  t0: 0,
  lives: 7,
  errors: 0,
  won: false
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


/* --- leaderboard puzzle V1 --- */
function getPuzzleDifficultyLabel(){
  return `${PZ.size}x${PZ.size}`;
}
function getPuzzleElapsedSeconds(){
  return Math.max(1, Math.floor((Date.now() - PZ.t0) / 1000));
}
function getPuzzleBaseScore(size){
  return ({ 3: 180, 4: 360, 5: 620 })[size] || 180;
}
function getPuzzlePreviewScore(){
  const score = getPuzzleBaseScore(PZ.size) + (PZ.lives * 45) - (PZ.errors * 25) - (getPuzzleElapsedSeconds() * 2);
  return Math.max(1, score);
}
function refreshPuzzleScore(){
  if (PZ.score) PZ.score.textContent = String(getPuzzlePreviewScore());
}
function normalizePlayerName(name){
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18);
}
function getPuzzlePlayerName(){
  const KEY = 'ws_puzzle_player_name';
  let name = normalizePlayerName(localStorage.getItem(KEY) || '');
  while (!name){
    name = normalizePlayerName(window.prompt('Inserisci il tuo nome per la classifica settimanale') || '');
    if (!name) alert('Serve un nome per entrare in classifica.');
  }
  localStorage.setItem(KEY, name);
  return name;
}
function formatPuzzleTime(totalSeconds){
  const s = Math.max(0, Number(totalSeconds) || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
async function fetchPuzzleLeaderboard(){
  const res = await fetch('/api/puzzle-leaderboard', { cache:'no-store' });
  if (!res.ok) throw new Error('leaderboard fetch failed');
  return await res.json();
}
function renderPuzzleLeaderboard(data){
  if (PZ.lbWeek) PZ.lbWeek.textContent = `Settimana ${data?.weekKey || 'corrente'}`;

  const me = normalizePlayerName(localStorage.getItem('ws_puzzle_player_name') || '');
  if (PZ.lbPlayer){
    const rank = Number(data?.myRank || 0);
    const myBest = Number(data?.myBest || 0);
    if (me && rank > 0){
      PZ.lbPlayer.textContent = `${me} · posizione #${rank} · miglior punteggio ${myBest}`;
      PZ.lbPlayer.classList.remove('hidden');
    } else if (me && myBest > 0){
      PZ.lbPlayer.textContent = `${me} · miglior punteggio ${myBest}`;
      PZ.lbPlayer.classList.remove('hidden');
    } else {
      PZ.lbPlayer.classList.add('hidden');
      PZ.lbPlayer.textContent = '';
    }
  }

  if (!PZ.lbList) return;
  const top = Array.isArray(data?.top) ? data.top : [];
  if (!top.length){
    PZ.lbList.innerHTML = '<div class="card">Nessun risultato questa settimana. Sii il primo a giocare!</div>';
    return;
  }

  PZ.lbList.innerHTML = top.map((row, idx) => {
  const pos = idx + 1;
  const medal =
    pos === 1 ? '🥇' :
    pos === 2 ? '🥈' :
    pos === 3 ? '🥉' : '';

  const topClass =
    pos === 1 ? ' top1' :
    pos === 2 ? ' top2' :
    pos === 3 ? ' top3' : '';

  const meClass =
    me && normalizePlayerName(row.name) === me ? ' me' : '';

  return `
    <div class="pz-lb-row${topClass}${meClass}">
      <div class="pz-lb-rank">
        ${medal ? `<span class="pz-medal" aria-hidden="true">${medal}</span>` : `#${pos}`}
      </div>
      <div class="pz-lb-main">
        <div class="pz-lb-name">${row.name || 'Giocatore'}</div>
        <div class="pz-lb-meta">${row.difficulty || '-'} · ${formatPuzzleTime(row.timeSeconds)} · errori ${row.errors ?? 0} · vite ${row.livesLeft ?? 0}</div>
      </div>
      <div class="pz-lb-score">${row.score ?? 0}</div>
    </div>
  `;
}).join('');
}
async function openPuzzleLeaderboard(){
  PZ.lbModal?.classList.remove('hidden');
  if (PZ.lbList) PZ.lbList.innerHTML = '<div class="card">Caricamento classifica…</div>';
  try {
    const me = normalizePlayerName(localStorage.getItem('ws_puzzle_player_name') || '');
    const url = me ? `/api/puzzle-leaderboard?name=${encodeURIComponent(me)}` : '/api/puzzle-leaderboard';
    const res = await fetch(url, { cache:'no-store' });
    const data = await res.json();
    renderPuzzleLeaderboard(data);
  } catch (err){
    console.error('Errore classifica puzzle', err);
    if (PZ.lbList) PZ.lbList.innerHTML = '<div class="card">Classifica momentaneamente non disponibile.</div>';
  }
}
async function submitPuzzleScore(){
  const name = getPuzzlePlayerName();
  const payload = {
    name,
    difficulty: getPuzzleDifficultyLabel(),
    timeSeconds: getPuzzleElapsedSeconds(),
    livesLeft: PZ.lives,
    errors: PZ.errors
  };
  const res = await fetch('/api/puzzle-score', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('score submit failed');
  return await res.json();
}
async function showPuzzleVictoryCard(){
  let result = null;
  try {
    result = await submitPuzzleScore();
  } catch (err){
    console.error('Errore salvataggio score puzzle', err);
  }

  const bravo = document.createElement('div');
  bravo.className = 'bravo';

  const time = formatPuzzleTime(getPuzzleElapsedSeconds());
  const score = Number(result?.score || getPuzzlePreviewScore());
  const rank = Number(result?.rank || 0);

  bravo.innerHTML = `
    <div class="bravo-card">
      <div class="bravo-title">Bravo!</div>
      <div class="bravo-lines">
        Tempo: <b>${time}</b><br>
        Difficoltà: <b>${getPuzzleDifficultyLabel()}</b><br>
        Errori: <b>${PZ.errors}</b> · Vite rimaste: <b>${PZ.lives}</b><br>
        Punteggio settimanale: <b>${score}</b>${rank ? `<br>Posizione attuale: <b>#${rank}</b>` : ''}
      </div>
      <div class="bravo-hint">Tocca per ricominciare · usa “🏆 Classifica” per confrontarti con tutti</div>
    </div>
  `;

  const restart = ()=>{
    bravo.remove();
    startPuzzle(true);
  };
  bravo.addEventListener('click', restart, { once:true });
  document.body.appendChild(bravo);
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
      clearInterval(PZ.timer);
      if (!PZ.won){
        PZ.won = true;
        setTimeout(()=>{ showPuzzleVictoryCard(); }, 300);
      }
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
  refreshPuzzleScore();
  PZ.timer = setInterval(()=>{
    const s = Math.floor((Date.now()-PZ.t0)/1000);
    const m = `${Math.floor(s/60)}`.padStart(2,'0');
    const ss= `${s%60}`.padStart(2,'0');
    if (PZ.time) PZ.time.textContent = `${m}:${ss}`;
    refreshPuzzleScore();
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
    PZ.errors += 1;
    setLives(PZ.lives - 1);
    refreshPuzzleScore();
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
  getPuzzlePlayerName();
  PZ.root?.classList.remove('hidden');
  updateTopbarHeight();

  PZ.won = false;
  PZ.errors = 0;
  loadNewPuzzleImage();
  buildGrid(PZ.size);
  const max = PZ_CFG.livesByGrid[PZ.size] ?? 5;
  setLives(max);
  refreshPuzzleScore();

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
$('#pzClose' )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); PZ.lbModal?.classList.add('hidden'); clearInterval(PZ.timer); stopBg(); });
$('#pzBack'  )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); PZ.lbModal?.classList.add('hidden'); clearInterval(PZ.timer); stopBg(); });
$('#pzNext'  )?.addEventListener('click', ()=>{ loadNewPuzzleImage(); buildGrid(PZ.size); updateTopbarHeight(); refreshPuzzleScore(); });
$('#pzLeaderboard')?.addEventListener('click', ()=> openPuzzleLeaderboard());
$('#pzLbClose')?.addEventListener('click', ()=> PZ.lbModal?.classList.add('hidden'));

$$('.chip-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    $$('.chip-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    PZ.size = +b.dataset.diff;
    buildGrid(PZ.size);
    const max = PZ_CFG.livesByGrid[PZ.size] ?? 5;
    setLives(max);
    refreshPuzzleScore();
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


