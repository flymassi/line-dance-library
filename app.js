/* Western Spritz — app.js v32 */
console.log('[WS] app v32');

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

  // alza il bottone (valori più negativi = più in alto)
  start.style.transform = 'translateY(-90px)';

  // tenta di partire SUBITO (muted) quando la pagina si apre
  try {
    music.muted = true;         // parte silenzioso
    music.volume = 1;
    music.play().catch(()=>{});
  } catch {}

  // sblocca audio al primo gesto utente
  function unlockAudioOnce(){
    try {
      music.muted = false;
      music.currentTime = 0;
      const p = music.play();
      if (p?.catch) p.catch(()=>{});
    } catch {}
    window.removeEventListener('touchstart', unlockAudioOnce, {passive:true});
    window.removeEventListener('mousedown', unlockAudioOnce);
    window.removeEventListener('keydown',   unlockAudioOnce);
  }
  window.addEventListener('touchstart', unlockAudioOnce, {passive:true, once:true});
  window.addEventListener('mousedown',   unlockAudioOnce, {once:true});
  window.addEventListener('keydown',     unlockAudioOnce, {once:true});

  // al tap su "Avvia" chiudi splash e garantisci l’audio
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
  plIndex = 0;
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
  window.open(url, '_blank');
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
  lives: 3,             // ❤️ vite
};

/* --- BG MUSIC helpers --- */
function playBg(){
  const bg = document.getElementById('fxBg');
  if (!bg) return;
  try {
    bg.volume = 0.6;
    bg.currentTime = 0;
    bg.play().catch(()=>{});
  } catch {}
}
function stopBg(){
  const bg = document.getElementById('fxBg');
  if (!bg) return;
  try { bg.pause(); } catch {}
}

/* --- vite (❤️) --- */
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
  };
  over.addEventListener('click', restart, { once:true });
  document.body.appendChild(over);
}

/* --- foto casuale evitando ripetizione --- */
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

/* --- domande --- */
function randomQuestion(){
  const s = SONGS[Math.floor(Math.random()*SONGS.length)];
  const qType = Math.floor(Math.random()*2); // 0 cantante, 1 ballo
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

/* --- risposta --- */
function onAnswer(a){
  if (!CURRENT_Q) return;

  // ===== risposta corretta =====
  if (a === CURRENT_Q.correct){
    try { document.getElementById('fxOk')?.play(); } catch {}
    try { const gun = document.getElementById('fxGun'); if (gun){ gun.currentTime = 0; gun.play().catch(()=>{}); } } catch {}

    // prendo tasselli non animati e non già svelati
    const tiles = Array.from(PZ.grid.querySelectorAll('.pz-tile'));
    const live  = tiles.filter(t => !t.classList.contains('hit') && !t.classList.contains('cleared'));

    if (live.length){
      // scelgo IL tassello che verrà animato e "scoperto"
      const t = live[Math.floor(Math.random() * live.length)];

      // reset animazione (trucco reflow)
      t.classList.remove('hit');
      t.style.animation = 'none'; t.offsetHeight; t.style.animation = '';

      // avvio l’animazione SOLO su questo tassello
      t.classList.add('hit');

      // quando finisce 'tileFlip', marchio come cleared (non rimuovo il nodo)
      const onEnd = (ev)=>{
        if (ev.target !== t) return;
        if (ev.animationName !== 'tileFlip') return;
        t.removeEventListener('animationend', onEnd);

        t.classList.remove('hit');
        t.classList.add('cleared'); // invisibile, mantiene spazio

        // puff grafico
        try {
          const wrap = PZ.grid.parentElement; // .pz-img-wrap
          const tr = t.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          const puff = document.createElement('div');
          puff.className = 'puff';
          puff.style.left = (tr.left + tr.width/2 - wr.left) + 'px';
          puff.style.top  = (tr.top  + tr.height/2 - wr.top)  + 'px';
          wrap.appendChild(puff);
          puff.addEventListener('animationend', ()=>puff.remove(), { once:true });
        } catch {}

        // controlla se è finito
        const remaining = PZ.grid.querySelectorAll('.pz-tile:not(.cleared)').length;
        if (remaining === 0) {
          try { document.getElementById('fxVictory')?.play(); } catch {}
          stopBg(); // ferma musica alla vittoria

          // attesa 3s, poi "Bravo!"
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
      // edge-case: nessun tassello vivo
      try { document.getElementById('fxVictory')?.play(); } catch {}
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
        };
        bravo.addEventListener('click', restart, { once:true });
        document.body.appendChild(bravo);
      }, 3000);
    }
    return;
  }

  // ===== risposta sbagliata =====
  try { document.getElementById('fxWrong')?.play(); } catch {}
  const no = PZ.no; // <img id="noImg" class="no-img">
  if (no){
    no.classList.remove('hidden');
    no.classList.add('shake');
  }
  // dopo il tremolio: nascondi Alessia, scala vita, check game over o nuova domanda
  setTimeout(()=>{
    if (no){
      no.classList.add('hidden');
      no.classList.remove('shake');
    }
    setLives(PZ.lives - 1);
    if (PZ.lives <= 0){
      stopBg();
      gameOver();
    } else {
      nextQuestion();
    }
  }, 700);
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
  loadNewPuzzleImage();
  buildGrid(PZ.size);
  setLives(3);              // reset vite
  PZ.root.classList.remove('hidden');
  nextQuestion();
  startTimer();
  playBg();                 // musica di sottofondo ON
}

/* --- UI puzzle --- */
$('#btnPuzzle').addEventListener('click', startPuzzle);
$('#pzClose').addEventListener('click', ()=>{ PZ.root.classList.add('hidden'); stopBg(); });
$('#pzBack' ).addEventListener('click', ()=>{ PZ.root.classList.add('hidden'); stopBg(); });
$('#pzNext' ).addEventListener('click', startPuzzle);
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
