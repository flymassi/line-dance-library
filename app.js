/* Western Spritz — app.js v38 */
console.log('[WS] app v38');

/* ====== BACKGROUND RANDOM ====== */
(function(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');
  const url  = `./assets/images/background/${Math.floor(Math.random()*10)+1}.png`;
  if (blur) blur.style.backgroundImage = `url('${url}')`;
  if (main) main.style.backgroundImage = `url('${url}')`;
})();

/* ====== SPLASH (robusto, con contatore globale) ====== */
(function(){
  const splash = document.getElementById('splash');
  const start  = document.getElementById('startApp');
  const music  = document.getElementById('introMusic');
  const visitEl= document.getElementById('visitCounter');

  // --- handler che NASCONDE lo splash (prima di tutto: non viene mai bloccato)
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
  // fallback tastiera
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') hideSplash();
  }, { once:true });

  // UI: alza il bottone
  if (start) start.style.transform = 'translateY(-90px)';

  // autoplay silenzioso (non blocca nulla)
  try {
    if (music){
      music.muted = true;
      music.volume = 1;
      music.play().catch(()=>{});
    }
  } catch {}

  // --- Contatore visite globale (isolato: non può bloccare la UI)
  try {
    const NS  = 'western-spritz'; // personalizza se vuoi dev/prod diversi
    const KEY = 'visits';

    const setCounter = (n)=>{
      if (!visitEl) return;
      const v = Number(n);
      visitEl.textContent = Number.isFinite(v) ? v.toLocaleString('it-IT') : '—';
    };

    // JSONP per bypass CORS/caching
    const cbName = 'wsCountCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `https://api.countapi.xyz/hit/${encodeURIComponent(NS)}/${encodeURIComponent(KEY)}?callback=${cbName}&_=${Date.now()}`;

    const cleanup = ()=>{
      try { delete window[cbName]; } catch {}
      try { script.remove(); } catch {}
    };

    let got = false;
    window[cbName] = (data)=>{
      got = true;
      setCounter(data?.value ?? 1);
      cleanup();
    };

    script.onerror = ()=>{
      cleanup();
      // Fallback fetch (create → update → get), sempre no-store
      (async()=>{
        try{
          await fetch(`https://api.countapi.xyz/create?namespace=${encodeURIComponent(NS)}&key=${encodeURIComponent(KEY)}&value=0`, { cache:'no-store', credentials:'omit', mode:'cors' }).catch(()=>{});
          await fetch(`https://api.countapi.xyz/update/${encodeURIComponent(NS)}/${encodeURIComponent(KEY)}?amount=1`, { cache:'no-store', credentials:'omit', mode:'cors' }).catch(()=>{});
          const r = await fetch(`https://api.countapi.xyz/get/${encodeURIComponent(NS)}/${encodeURIComponent(KEY)}?${Date.now()}`, { cache:'no-store', credentials:'omit', mode:'cors' });
          const d = await r.json();
          setCounter(d?.value ?? 1);
        } catch {
          setCounter('—');
        }
      })();
    };

    script.onload = ()=>{ setTimeout(()=>{ if (!got) setCounter('—'); cleanup(); }, 200); };
    document.head.appendChild(script);
  } catch {
    if (visitEl) visitEl.textContent = '—';
  }
})();

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

/* ===========================================================
   PUZZLE / QUIZ — domanda casuale; esatto: rivela + nuova domanda; errato: non cambia
   =========================================================== */
const PZ_CFG = { livesByGrid: { 3: 7, 4: 5, 5: 4 } };

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
  size:  4,
  timer: null,
  t0: 0,
  lives: 5
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
  const total = n*n;
  for(let i=0;i<total;i++){
    const div = document.createElement('div');
    div.className = 'pz-tile';
    PZ.grid.appendChild(div);
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
    // fallback visivo inline (anche senza CSS)
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

/* ====================== QUIZ ENGINE ====================== */
const Quiz = (function(){
  let pool = [];        // tutte le chiavi disponibili
  let deck = [];        // mazzo rimanente
  let current = null;   // { q, correct, answers }

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  function buildPool(){
    pool = SONGS.flatMap(s=>{
      const keys = [];
      if (s?.singerName && s?.songTitle) keys.push({ type:'SINGER', year:s.year, num:s.songNumber });
      if (s?.danceTitle  && s?.songTitle) keys.push({ type:'DANCE',  year:s.year, num:s.songNumber });
      return keys;
    });
    deck = shuffle([...pool]);
  }

  function ensureDeck(){ if(!deck.length) deck = shuffle([...pool]); }

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
    const k = deck.pop();
    current = makeQuestion(k);
    return current;
  }

  function get(){ return current; }
  const norm = v => String(v??'').trim().toLowerCase();
  function isCorrect(ans){ return norm(ans) === norm(current?.correct); }

  function init(){ buildPool(); }
  function reset(){ deck = [...pool]; }

  return { init, next, get, isCorrect, reset };
})();

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
addEventListener('resize', updateTopbarHeight);
addEventListener('orientationchange', updateTopbarHeight);

/* --- bindings UI puzzle --- */
$('#btnPuzzle')?.addEventListener('click', ()=> startPuzzle());
$('#pzClose' )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); stopBg(); });
$('#pzBack'  )?.addEventListener('click', ()=>{ PZ.root?.classList.add('hidden'); stopBg(); });
$('#pzNext'  )?.addEventListener('click', ()=>{ loadNewPuzzleImage(); buildGrid(PZ.size); });

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

    Quiz.init();   // prepara pool domande

    render();
  }catch(e){
    if (elCards) elCards.innerHTML = `<div class="card">Errore nel caricamento dati.</div>`;
    console.error('Errore caricamento songs.json', e);
  }
}
load();

/* ====== UPDATE (PWA) molto aggressivo ====== */
$('#btnUpdate')?.addEventListener('click', async ()=>{
  try{
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=> r.unregister().catch(()=>{})));
    }
    if (window.caches){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=> caches.delete(k).catch(()=>{})));
    }
  }catch{}
  location.reload(true);
});

function updateTopbarHeight(){
  const tb = document.querySelector('.pz-topbar');
  if (!tb) return;
  document.documentElement.style.setProperty('--pz-topbar-h', tb.offsetHeight + 'px');
}
