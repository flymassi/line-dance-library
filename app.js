/* Western Spritz — app.js v40 */
console.log('[WS] app v40');

/* ====== BACKGROUND RANDOM ====== */
(function(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');
  const url  = `./assets/images/background/${Math.floor(Math.random()*10)+1}.png`;
  if (blur) blur.style.backgroundImage = `url('${url}')`;
  if (main) main.style.backgroundImage = `url('${url}')`;
})();

/* ====== SPLASH ====== */
(function(){
  const splash = document.getElementById('splash');
  const start  = document.getElementById('startApp');
  const music  = document.getElementById('introMusic');
  if (!splash || !start || !music) return;

  try { start.style.transform = 'translateY(-90px)'; } catch {}

  try {
    music.muted = true;
    music.volume = 1;
    music.play().catch(()=>{});
  } catch {}

  function unlockAudioOnce(){
    try {
      music.muted = false;
      music.currentTime = 0;
      const p = music.play();
      if (p?.catch) p.catch(()=>{});
    } catch {}
    window.removeEventListener('touchstart', unlockAudioOnce);
    window.removeEventListener('mousedown', unlockAudioOnce);
    window.removeEventListener('keydown',   unlockAudioOnce);
  }
  window.addEventListener('touchstart', unlockAudioOnce, {passive:true, once:true});
  window.addEventListener('mousedown',   unlockAudioOnce, {once:true});
  window.addEventListener('keydown',     unlockAudioOnce, {once:true});

  start.addEventListener('click', ()=>{
    unlockAudioOnce();
    splash.classList.add('hidden');
  }, { once:true });
})();

/* ====== UTIL ====== */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const getYouTubeId = url => {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
  return m ? m[1] : null;
};
function hasSongs(){ return Array.isArray(SONGS) && SONGS.length > 0; }

/* ====== DATA ====== */
let SONGS = [];
let FILTER = { dance:'', song:'' };
let PLAYLIST = JSON.parse(localStorage.getItem('ws_playlist') || '[]');

let plIndex = 0;
let plWindowName = 'ws_player';
function openAt(index){
  const item = PLAYLIST[index];
  if (!item) return;
  const url = item.songUrl || item.danceVideoUrl;
  if (!url) return;
  window.open(url, plWindowName);
}

const elCards = $('#cards');
const elCount = $('#count');

/* ====== RENDER CARDS ====== */
function render(){
  if (!elCards || !elCount) return;

  const qd = FILTER.dance.toLowerCase();
  const qs = FILTER.song.toLowerCase();

  const rows = SONGS.filter(s =>
    (!qd || (s.danceTitle||'').toLowerCase().includes(qd)) &&
    (!qs || (s.songTitle||'').toLowerCase().includes(qs))
  );

  elCount.textContent = `Brani trovati: ${rows.length}`;

  elCards.innerHTML = rows.map(s=>{
    const vid = getYouTubeId(s.songUrl || s.danceVideoUrl);
    const cover = vid ? `https://img.youtube.com/vi/${vid}/0.jpg` : './assets/images/icon.png';
    const inPl  = PLAYLIST.some(p=>p.songNumber===s.songNumber && p.year===s.year);

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
document.addEventListener('click', e=>{
  const a = e.target.closest('[data-open]');
  if (!a) return;
  const y = +a.dataset.y, n = +a.dataset.n;
  const s = SONGS.find(x=>x.year==y && x.songNumber==n);
  const url = a.dataset.open==='dance' ? s?.danceVideoUrl : s?.songUrl;
  if (!url) return;
  $('#fxWhip')?.play?.();
  setTimeout(()=> window.open(url, '_blank'), 120);
});

/* ====== PLAYLIST ====== */
function updatePlaylistButton(btn, inPlaylist){
  btn.classList.toggle('play-added', !!inPlaylist);
  btn.textContent = inPlaylist ? '✓ In playlist' : '+ Playlist';
}

document.addEventListener('click', e=>{
  const b = e.target.closest('[data-addpl]');
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
  plIndex = 0;
  if (!modal || !list) return;
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

/* ====== FILTRI ====== */
$('#fDance')?.addEventListener('input', e=>{ FILTER.dance = e.target.value; render(); });
$('#fSong' )?.addEventListener('input', e=>{ FILTER.song  = e.target.value; render(); });
$('#clearFilters')?.addEventListener('click', ()=>{
  FILTER={dance:'',song:''}; const d=$('#fDance'), s=$('#fSong'); if(d) d.value=''; if(s) s.value=''; render();
});

/* ====== PUZZLE ====== */
const PZ = {
  root:  $('#pzOverlay'),
  grid:  $('#pzGrid'),
  img:   $('#pzImg'),
  q:     $('#pzQuestion'),
  ans:   $('#pzAnswers'),
  score: $('#pzScore'),
  time:  $('#pzTime'),
  no:    $('#noImg'),
  size:  4,
  tiles: [],
  timer: null,
  t0: 0,
  lives: 3,
};

/* show/hide overlay */
function showPuzzleOverlay(){
  if (!PZ.root) return;
  PZ.root.classList.remove('hidden');
  PZ.root.setAttribute('aria-hidden','false');
  fitTopbar();
}
function hidePuzzleOverlay(){
  if (!PZ.root) return;
  PZ.root.classList.add('hidden');
  PZ.root.setAttribute('aria-hidden','true');
  stopBg();
}
document.addEventListener('DOMContentLoaded', hidePuzzleOverlay);

/* BG MUSIC */
function playBg(){
  const bg = document.getElementById('fxBg');
  if (!bg) return;
  try { bg.volume = 0.6; bg.currentTime = 0; bg.play().catch(()=>{}); } catch {}
}
function stopBg(){
  const bg = document.getElementById('fxBg');
  if (!bg) return;
  try { bg.pause(); } catch {}
}

/* vite */
function setLives(n){
  PZ.lives = n;
  const el = document.getElementById('pzLives');
  if (el) el.textContent = String(Math.max(0, n));
}
function gameOver(){
  const over = document.createElement('div');
  over.className = 'bravo';
  over.textContent = 'Peccato! Tocca per riprovare';
  const restart = ()=>{
    over.remove();
    loadNewPuzzleImage();
    buildGrid(PZ.size);
    setLives(3);
    nextQuestion();
    startTimer();
    playBg();
    fitTopbar();
  };
  over.addEventListener('click', restart, { once:true });
  document.body.appendChild(over);
}

/* foto */
let pzLastIndex = -1;
function pickRandomPuzzleSrc(){
  const MAX = 27;
  let i;
  do { i = Math.floor(Math.random()*MAX)+1; } while (MAX>1 && i===pzLastIndex);
  pzLastIndex = i;
  return `./assets/images/puzzles/${i}.png`;
}
function loadNewPuzzleImage(){ if (PZ.img) PZ.img.src = pickRandomPuzzleSrc(); }

/* griglia */
function buildGrid(n){
  if (!PZ.grid) return;
  PZ.size = n;
  PZ.grid.innerHTML = '';
  PZ.grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  PZ.grid.style.gridTemplateRows    = `repeat(${n}, 1fr)`;
  const total = n*n;
  PZ.tiles = [];
  for(let i=0;i<total;i++){
    const div = document.createElement('div');
    div.className = 'pz-tile';
    PZ.grid.appendChild(div);
    PZ.tiles.push(div);
  }
}

/* domande */
function randomQuestion(){
  if (!hasSongs()) return { q: 'Caricamento canzoni…', correct: null, answers: [] };

  const s = SONGS[Math.floor(Math.random()*SONGS.length)];
  const qType = Math.floor(Math.random()*2);
  let q, correct, options = [];

  if (qType===0){
    q = `Chi è il cantante di “${s.songTitle}”?`;
    correct = s.singerName;
    options = [correct];
    while(options.length<4){
      const o = SONGS[Math.floor(Math.random()*SONGS.length)].singerName;
      if (o && !options.includes(o)) options.push(o);
    }
  } else {
    q = `Qual è il titolo del ballo per “${s.songTitle}”?`;
    correct = s.danceTitle;
    options = [correct];
    while(options.length<4){
      const o = SONGS[Math.floor(Math.random()*SONGS.length)].danceTitle;
      if (o && !options.includes(o)) options.push(o);
    }
  }
  options = options.filter(Boolean);
  options.sort(()=>Math.random()-.5);
  return { s, q, correct, answers:options };
}
let CURRENT_Q = null;

function nextQuestion(){
  if (!PZ.q || !PZ.ans) return;
  CURRENT_Q = randomQuestion();
  PZ.q.textContent = CURRENT_Q.q || 'Domanda…';
  PZ.ans.innerHTML = '';

  if (!CURRENT_Q.answers || CURRENT_Q.answers.length === 0){
    const info = document.createElement('div');
    info.className = 'card';
    info.style.margin = '8px';
    info.textContent = 'Attendi caricamento dei brani…';
    PZ.ans.appendChild(info);
    return;
  }

  CURRENT_Q.answers.forEach(a=>{
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = String(a).toUpperCase();
    btn.addEventListener('click', ()=> onAnswer(a));
    PZ.ans.appendChild(btn);
  });
}

/* risposta */
function onAnswer(a){
  if (!CURRENT_Q) return;

  if (a === CURRENT_Q.correct){
    try { document.getElementById('fxOk')?.play?.(); } catch {}
    try { const gun = document.getElementById('fxGun'); if (gun){ gun.currentTime = 0; gun.play().catch(()=>{}); } } catch {}

    const tiles = Array.from(PZ.grid.querySelectorAll('.pz-tile'));
    const live  = tiles.filter(t => !t.classList.contains('hit') && !t.classList.contains('cleared'));

    if (live.length){
      const t = live[Math.floor(Math.random() * live.length)];
      t.classList.remove('hit'); t.style.animation='none'; t.offsetHeight; t.style.animation='';
      t.classList.add('hit');

      const onEnd = (ev)=>{
        if (ev.target !== t || ev.animationName !== 'tileFlip') return;
        t.removeEventListener('animationend', onEnd);
        t.classList.remove('hit');
        t.classList.add('cleared');

        try {
          const wrap = PZ.grid.parentElement;
          const tr = t.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          const puff = document.createElement('div');
          puff.className = 'puff';
          puff.style.left = (tr.left + tr.width/2 - wr.left) + 'px';
          puff.style.top  = (tr.top  + tr.height/2 - wr.top)  + 'px';
          wrap.appendChild(puff);
          puff.addEventListener('animationend', ()=>puff.remove(), { once:true });
        } catch {}

        const remaining = PZ.grid.querySelectorAll('.pz-tile:not(.cleared)').length;
        if (remaining === 0) {
          try { document.getElementById('fxVictory')?.play?.(); } catch {}
          stopBg();
          setTimeout(()=>{
            const bravo = document.createElement('div');
            bravo.className = 'bravo';
            bravo.textContent = 'Bravo! Tocca per ricominciare';
            const restart = ()=>{
              bravo.remove();
              loadNewPuzzleImage();
              buildGrid(PZ.size);
              setLives(3);
              nextQuestion();
              startTimer();
              playBg();
              fitTopbar();
            };
            bravo.addEventListener('click', restart, { once:true });
            document.body.appendChild(bravo);
          }, 3000);
        } else {
          nextQuestion();
        }
      };
      t.addEventListener('animationend', onEnd);
    } else {
      try { document.getElementById('fxVictory')?.play?.(); } catch {}
      stopBg();
      setTimeout(()=>{
        const bravo = document.createElement('div');
        bravo.className = 'bravo';
        bravo.textContent = 'Bravo! Tocca per ricominciare';
        const restart = ()=>{
          bravo.remove();
          loadNewPuzzleImage();
          buildGrid(PZ.size);
          setLives(3);
          nextQuestion();
          startTimer();
          playBg();
          fitTopbar();
        };
        bravo.addEventListener('click', restart, { once:true });
        document.body.appendChild(bravo);
      }, 3000);
    }
    return;
  }

  // wrong
  try { document.getElementById('fxWrong')?.play?.(); } catch {}
  const no = PZ.no;
  if (no){ no.classList.remove('hidden'); no.classList.add('shake'); }
  setTimeout(()=>{
    if (no){ no.classList.add('hidden'); no.classList.remove('shake'); }
    setLives(PZ.lives - 1);
    if (PZ.lives <= 0){ stopBg(); gameOver(); } else { nextQuestion(); }
  }, 700);
}

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

/* ====== FIT TOPBAR (centra/scala) ====== */
function fitTopbar() {
  const tb = document.querySelector('.pz-topbar');
  if (!tb) return;
  tb.style.setProperty('--pz-scale', 1);
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const available = vw - 12;
  const needed = tb.scrollWidth + 4;
  const scale = Math.min(1, available / needed);
  tb.style.setProperty('--pz-scale', scale);
}
window.addEventListener('resize', fitTopbar, { passive: true });
window.addEventListener('orientationchange', fitTopbar);

/* ====== AVVIO PUZZLE ====== */
function startPuzzle(){
  if (!hasSongs()){
    load().then(()=>{
      if (!hasSongs()){
        alert('Sto caricando i brani… riprova tra un attimo o usa “Aggiorna app”.');
        return;
      }
      startPuzzle();
    });
    return;
  }
  loadNewPuzzleImage();
  buildGrid(PZ.size);
  setLives(3);
  showPuzzleOverlay();
  nextQuestion();
  startTimer();
  playBg();
}

/* UI puzzle */
$('#btnPuzzle')?.addEventListener('click', startPuzzle);
$('#pzClose')?.addEventListener('click', hidePuzzleOverlay);
$('#pzNext' )?.addEventListener('click', ()=>{ startPuzzle(); fitTopbar(); });
$$('.chip-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    $$('.chip-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    PZ.size = +b.dataset.diff;
    buildGrid(PZ.size);
    fitTopbar();
  });
});

/* ====== DATA LOAD ====== */
async function load(){
  try{
    const url = `./data/songs.json?v=${Date.now()}`;
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    SONGS = await res.json();
    SONGS.sort((a,b)=> (b.songNumber||0) - (a.songNumber||0));
    render();
    console.log(`[WS] songs.json OK (${SONGS.length})`);
  }catch(e){
    console.error('[WS] Errore caricamento songs.json:', e);
    if (elCards){
      elCards.innerHTML = `<div class="card">Errore nel caricamento dati.<br><small>Prova “Aggiorna app”.</small></div>`;
    }
  }
}
load();

/* ====== UPDATE (PWA) ====== */
$('#btnUpdate')?.addEventListener('click', async ()=>{
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}
  location.reload(true);
});
