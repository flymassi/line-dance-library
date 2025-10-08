/* Western Spritz — app.js v30 */
console.log('[WS] app v30');

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

  // alziamo un po’ il bottone
  start.style.marginTop = '-4px';

  start.addEventListener('click', async ()=>{
    try { await music.play(); } catch(e){}
    splash.classList.add('hidden');
  }, { once:true });
})();

/* ====== UTIL ====== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const getYouTubeId = url => {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
  return m ? m[1] : null;
};

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
  window.open(url, plWindowName); // riusa sempre la stessa scheda
}


const elCards = $('#cards');
const elCount = $('#count');

/* ====== RENDER CARDS ====== */
function render(){
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

/* ====== OPEN LINKS (con frusta) ====== */
(function(){
  document.addEventListener('click', e=>{
    const a = e.target.closest('[data-open]');
    if (!a) return;
    const y = +a.dataset.y, n = +a.dataset.n;
    const s = SONGS.find(x=>x.year==y && x.songNumber==n);
    const url = a.dataset.open==='dance' ? s?.danceVideoUrl : s?.songUrl;
    if (!url) return;
    $('#fxWhip')?.play().catch(()=>{});
    setTimeout(()=> window.open(url, '_blank'), 120);
  });
})();

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

$('#btnPlaylist').addEventListener('click', ()=>{
  const modal = $('#plModal');
  const list  = $('#plList');
  plIndex = 0; // reset
  list.innerHTML = PLAYLIST.length
    ? PLAYLIST.map((s,i)=>`<div class="card" style="margin-top:8px">
        ${i+1}. ${s.danceTitle||''} — <i>${s.singerName||''}</i>
      </div>`).join('')
    : `<div class="card">Nessun brano nella playlist.</div>`;
  modal.classList.remove('hidden');
});

$('#plClose').addEventListener('click', ()=> $('#plModal').classList.add('hidden'));
$('#plClear').addEventListener('click', ()=>{
  PLAYLIST = [];
  localStorage.setItem('ws_playlist','[]');
  $('#plModal').classList.add('hidden');
  render();
});

$('#plPlay').addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  const ids = PLAYLIST
    .map(s => getYouTubeId(s.songUrl || s.danceVideoUrl))
    .filter(Boolean);
  if (!ids.length) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`;
  window.open(url, '_blank'); // YouTube farà auto-next
});
$('#plPrev').addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  plIndex = (plIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
  openAt(plIndex);
});
$('#plNext').addEventListener('click', ()=>{
  if (!PLAYLIST.length) return;
  plIndex = (plIndex + 1) % PLAYLIST.length;
  openAt(plIndex);
});


/* ====== FILTRI ====== */
$('#fDance').addEventListener('input', e=>{ FILTER.dance = e.target.value; render(); });
$('#fSong' ).addEventListener('input', e=>{ FILTER.song  = e.target.value; render(); });
$('#clearFilters').addEventListener('click', ()=>{
  FILTER={dance:'',song:''}; $('#fDance').value=''; $('#fSong').value=''; render();
});

/* ====== PUZZLE ====== */
const PZ = {
  root: $('#pzOverlay'),
  grid: $('#pzGrid'),
  img:  $('#pzImg'),
  q:    $('#pzQuestion'),
  ans:  $('#pzAnswers'),
  score:$('#pzScore'),
  time: $('#pzTime'),
  no:   $('#noImg'),
  size: 4,
  tiles: [],
  timer: null,
  t0: 0
};

// crea griglia n×n
function buildGrid(n){
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

// domande
function randomQuestion(){
  const s = SONGS[Math.floor(Math.random()*SONGS.length)];
  const qType = Math.floor(Math.random()*2); // 0 = cantante, 1 = ballo
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
  options.sort(()=>Math.random()-.5);
  return { s, q, correct, answers:options };
}

let CURRENT_Q = null;

function nextQuestion(){
  CURRENT_Q = randomQuestion();
  PZ.q.textContent = CURRENT_Q.q;
  PZ.ans.innerHTML = '';
  CURRENT_Q.answers.forEach(a=>{
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = a.toUpperCase();
    btn.addEventListener('click', ()=> onAnswer(a));
    PZ.ans.appendChild(btn);
  });
}

function onAnswer(a){
  if (!CURRENT_Q) return;

  if (a === CURRENT_Q.correct){
    $('#fxOk').play().catch(()=>{});
    $('#fxGun').play().catch(()=>{});

    // solo tasselli vivi e non in animazione
    const liveTiles = PZ.tiles.filter(t =>
      document.body.contains(t) && !t.classList.contains('hit')
    );

    if (liveTiles.length){
      const t = liveTiles[Math.floor(Math.random()*liveTiles.length)];
      t.style.willChange = 'transform,opacity';
      t.classList.add('hit');          // parte l’animazione CSS (spinOut)
      t.addEventListener('animationend', ()=>{
        if (t.isConnected) t.remove();  // RIMUOVO ESATTAMENTE QUEL TASSELL0
        checkWin();
      }, { once:true });
    } else {
      checkWin();
    }
  } else {
    $('#fxWrong').play().catch(()=>{});
    PZ.no.classList.remove('hidden');
    PZ.no.classList.add('shake');
    setTimeout(()=>{
      PZ.no.classList.add('hidden');
      PZ.no.classList.remove('shake');
    },700);
  }
}


function checkWin(){
  const remaining = PZ.grid.querySelectorAll('.pz-tile').length;
  if (remaining===0){
    $('#fxVictory').play().catch(()=>{});
    const bravo = document.createElement('div');
    bravo.className = 'bravo';
    bravo.textContent = 'Bravo! Tocca per ricominciare';
    bravo.addEventListener('click', ()=>{
      bravo.remove();
      startPuzzle(); // nuova foto + nuova griglia
    }, { once:true });
    document.body.appendChild(bravo);
  } else {
    nextQuestion(); // nuova domanda
  }
}

function startTimer(){
  clearInterval(PZ.timer);
  PZ.t0 = Date.now();
  PZ.timer = setInterval(()=>{
    const s = Math.floor((Date.now()-PZ.t0)/1000);
    const m = `${Math.floor(s/60)}`.padStart(2,'0');
    const ss= `${s%60}`.padStart(2,'0');
    PZ.time.textContent = `${m}:${ss}`;
  }, 500);
}

function startPuzzle(){
  // immagine casuale
  const pool = Array.from({length:27},(_,i)=>`./assets/images/puzzles/${i+1}.png`);
  PZ.img.src = pool[Math.floor(Math.random()*pool.length)];

  // griglia
  buildGrid(PZ.size);
  PZ.root.classList.remove('hidden');
  nextQuestion();
  startTimer();
}

// UI puzzle
$('#btnPuzzle').addEventListener('click', startPuzzle);
$('#pzClose').addEventListener('click', ()=> PZ.root.classList.add('hidden'));
$('#pzBack').addEventListener('click', ()=> PZ.root.classList.add('hidden'));
$('#pzNext').addEventListener('click', startPuzzle);
$$('.chip-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    $$('.chip-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    PZ.size = +b.dataset.diff;
    buildGrid(PZ.size);
  });
});

/* ====== DATA LOAD ====== */
async function load(){
  try{
    const res = await fetch('./data/songs.json', { cache:'no-store' });
    SONGS = await res.json();
    // Ordine inverso (# più alto -> più in alto)
    SONGS.sort((a,b)=> (b.songNumber||0) - (a.songNumber||0));
    render();
  }catch(e){
    elCards.innerHTML = `<div class="card">Errore nel caricamento dati.</div>`;
  }
}
load();

/* ====== UPDATE (PWA) ====== */
$('#btnUpdate').addEventListener('click', ()=>{
  if ('serviceWorker' in navigator){
    caches.keys().then(keys=> Promise.all(keys.map(k=>caches.delete(k)))).finally(()=>location.reload());
  } else location.reload();
});
