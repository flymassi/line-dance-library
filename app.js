console.log('[WS] app.js v5');

/* =========================
   SFONDO ADATTIVO + OMBRA TESTO
   ========================= */
(function setAdaptiveBg(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');

  function pickUrl(){
    const n = Math.floor(Math.random()*10)+1;
    return `./assets/images/background/${n}.png`;
  }

  function isLightImage(imgEl){
    try{
      const w = 24, h = 24;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, w, h);
      const data = ctx.getImageData(0,0,w,h).data;
      let acc = 0, pixels = w*h;
      for (let i=0;i<data.length;i+=4){
        const r=data[i], g=data[i+1], b=data[i+2];
        const Y = 0.2126*r + 0.7152*g + 0.0722*b;
        acc += Y;
      }
      const avg = acc / pixels;
      return avg > 160;
    }catch(e){ return false; }
  }

  const url = pickUrl();
  const img = new Image();
  img.onload = () => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    function apply() {
      const sw = window.innerWidth, sh = window.innerHeight;
      const rImg = iw/ih, rScr = sw/sh;
      const diff = Math.abs(Math.log(rImg) - Math.log(rScr));
      const useContain = diff > 0.35;

      if (blur) {
        blur.style.backgroundImage = `url('${url}')`;
        blur.style.filter = 'blur(22px) brightness(0.6)';
        blur.style.backgroundSize = 'cover';
      }
      if (main) {
        main.style.backgroundImage = `url('${url}')`;
        main.style.backgroundSize  = useContain ? 'contain' : 'cover';
      }

      document.body.classList.toggle('bg-light', isLightImage(img));
    }
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
  };
  img.src = url;
})();

/* =========================
   ARTWORK (iTunes + YouTube) con BLUR-UP
   ========================= */
const ART_CACHE = new Map();

function ytIdFromUrl(u){
  try{
    const url = new URL(u);
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
  }catch{}
  return null;
}
function youtubeThumbPair(u){
  const id = ytIdFromUrl(u);
  if (!id) return null;
  return { small:`https://img.youtube.com/vi/${id}/mqdefault.jpg`, large:`https://img.youtube.com/vi/${id}/hqdefault.jpg` };
}
async function fetchArtworkPair(singerName, songTitle){
  const key = `${singerName}|||${songTitle}`.toLowerCase();
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);

  const term = encodeURIComponent(`${singerName} ${songTitle}`.trim());
  const url  = `https://itunes.apple.com/search?term=${term}&country=IT&media=music&entity=song&limit=1`;
  try{
    const res = await fetch(url, {mode:'cors'});
    const data = await res.json();
    const a100 = data?.results?.[0]?.artworkUrl100 || null;
    if (a100){
      const pair = { small:a100, large:a100.replace(/100x100bb\.jpg/i,'600x600bb.jpg') };
      ART_CACHE.set(key, pair);
      return pair;
    }
  }catch(e){ console.warn('Artwork iTunes fallita:', e); }
  ART_CACHE.set(key, null);
  return null;
}

/* =========================
   DATI + LISTA
   ========================= */
const cards   = document.getElementById('cards');
const fDance  = document.getElementById('fDance');
const fSong   = document.getElementById('fSong');
const clearBt = document.getElementById('clearFilters');
const countEl = document.getElementById('count');
const fxCrack = document.getElementById('fxCrack');

let SONGS = [];
let FILTERS = { dance:'', song:'' };

fetch('./data/songs.json?v='+Date.now())
  .then(r => r.json())
  .then(json => { SONGS = json; render(); })
  .catch(err => { console.error('Errore caricamento songs.json', err); cards.innerHTML = `<p style="color:#fff">Errore nel caricamento dei dati.</p>`; });

fDance?.addEventListener('input', () => { FILTERS.dance = fDance.value; render(); });
fSong ?.addEventListener('input', () => { FILTERS.song  = fSong.value ; render(); });
clearBt?.addEventListener('click', () => { fDance.value=''; fSong.value=''; FILTERS={dance:'',song:''}; render(); });

document.addEventListener('pointerdown', ev => {
  if (ev.target.closest('a.action')) {
    try { fxCrack.cloneNode(true).play().catch(()=>{}); } catch {}
  }
}, {passive:true});

const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
function matches(it){
  const d=(FILTERS.dance||'').toLowerCase().trim();
  const s=(FILTERS.song ||'').toLowerCase().trim();
  return (!d||(it.danceTitle||'').toLowerCase().includes(d)) &&
         (!s||(it.songTitle ||'').toLowerCase().includes(s));
}

// reveal anim
function setupRevealAnimations(){
  const cardsEls = document.querySelectorAll('#cards .card');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)){
    cardsEls.forEach(el => el.classList.remove('reveal'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(ent => { if (ent.isIntersecting){ ent.target.classList.add('in'); obs.unobserve(ent.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  cardsEls.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${Math.min(i*40, 240)}ms`; io.observe(el); });
}

function renderCard(it){
  const coverId = `cov_${Math.random().toString(36).slice(2)}`;
  const videoBtn = it.danceVideoUrl ? `<a class="action" href="${esc(it.danceVideoUrl)}" target="_blank" rel="noopener">Apri Ballo</a>` : '';
  const songBtn  = it.songUrl       ? `<a class="action" href="${esc(it.songUrl)}"       target="_blank" rel="noopener">Apri Canzone</a>` : '';
  const year = (it.year ?? '-') + '';

  // blur-up asincrono
  queueMicrotask(async () => {
    let pair = await fetchArtworkPair(it.singerName, it.songTitle);
    if (!pair) pair = youtubeThumbPair(it.songUrl) || youtubeThumbPair(it.danceVideoUrl);
    const imgEl = document.getElementById(coverId);
    if (!imgEl) return;
    if (pair?.small) imgEl.src = pair.small;
    if (pair?.large){
      const hi = new Image();
      hi.onload = () => { imgEl.src = pair.large; imgEl.classList.add('is-ready'); };
      hi.src = pair.large;
    } else { imgEl.classList.add('is-ready'); }
  });

  return `
    <article class="card">
      <div class="card-row">
        <img id="${coverId}" class="card-cover" alt="Copertina" src="" />
        <div class="card-col">
          <h3 class="card-title">${esc(it.danceTitle)}</h3>
          <div class="card-meta">${esc(it.singerName)} — ${esc(it.songTitle)}</div>
        </div>
        <div class="year-badge" aria-label="Anno">
          <div class="yb-label">Anno</div>
          <div class="yb-num">${esc(year)}</div>
        </div>
      </div>
      <div class="actions">${videoBtn}${songBtn}</div>
    </article>`;
}

function render(){
  const list = SONGS.filter(matches);
  countEl.textContent = `Brani trovati: ${list.length}`;
  cards.innerHTML = list.map(renderCard).join('') || '<p style="color:#fff">Nessun risultato coi filtri.</p>';
  setupRevealAnimations();
}

/* =========================
   PULSANTE “AGGIORNA APP”
   ========================= */
document.getElementById('updateApp')?.addEventListener('click', async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e) { console.warn('Reset cache errore:', e); }
  location.href = location.pathname + '?fresh=' + Date.now();
});

/* =========================
   PUZZLE: logica completa
   ========================= */
const pzOverlay = document.getElementById('puzzleOverlay');
const pzGrid    = document.getElementById('pzGrid');
const pzQuestion= document.getElementById('pzQuestion');
const pzAnswers = document.getElementById('pzAnswers');
const pzNo      = document.getElementById('pzNo');
const pzBravo   = document.getElementById('pzBravo');
const pzQuit    = document.getElementById('pzQuit');
document.getElementById('openPuzzle')?.addEventListener('click', openPuzzle);

const pzCloseTop = document.getElementById('pzClose'); // la X in alto (vedi HTML sotto)
pzCloseTop?.addEventListener('click', closePuzzle);

// ESC per uscire
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pzOverlay.classList.contains('hidden')) closePuzzle();
});





const fxCorrect = document.getElementById('fxCorrect');
const fxWrong   = document.getElementById('fxWrong');

const GRID = 4; // 4x4
let PZ = { order: [], revealed: new Set() };

function rint(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

function pickImage(){
  const idx = rint(1,27);
  const pzImg = document.getElementById('pzImg');
  if (pzImg) {
    pzImg.src = `./assets/images/puzzles/${idx}.png`;
  }
}
function buildTiles(){
  pzGrid.innerHTML=''; PZ.revealed.clear();
  const tot = GRID*GRID; PZ.order = shuffle([...Array(tot).keys()]);
  for (let i=0;i<tot;i++){ const d=document.createElement('div'); d.className='pz-tile'; d.dataset.id=i; pzGrid.appendChild(d); }
}
function revealOne(){
  const next = PZ.order.find(id => !PZ.revealed.has(id));
  if (next==null) return;
  PZ.revealed.add(next);
  pzGrid.querySelector(`.pz-tile[data-id="${next}"]`)?.classList.add('revealed');
  if (PZ.revealed.size >= GRID*GRID) pzBravo.classList.remove('hidden');
}
function showNo(){
  pzNo.classList.remove('hidden');
  try { fxWrong.play().catch(()=>{}); } catch {}
  setTimeout(()=> pzNo.classList.add('hidden'), 900);
}
function makeQuestion(){
  if (!SONGS.length) return {text:'Dati non disponibili', choices:['-','-','-','-'], ok:0};
  const right = SONGS[rint(0, SONGS.length-1)];
  const type  = Math.random() < 0.5 ? 'singerName' : 'danceTitle';
  const text  = type==='singerName'
      ? `Chi è il cantante di “${right.songTitle}”?`
      : `Qual è il titolo del ballo per “${right.songTitle}”?`;
  const correct = right[type] || '-';
  const used = new Set([(correct||'').toLowerCase()]);
  const opts = [correct];
  shuffle(SONGS.slice()).some(it=>{
    const v=(it[type]||'').toString().trim(); if(!v) return false;
    const k=v.toLowerCase(); if(used.has(k)) return false;
    used.add(k); opts.push(v); return opts.length>=4;
  });
  while (opts.length<4) opts.push('—');
  const choices = shuffle(opts.slice(0,4));
  const ok = choices.findIndex(x=>x===correct);
  return {text, choices, ok};
}
function renderQuestion(){
  const q = makeQuestion();
  pzQuestion.textContent = q.text;
  pzAnswers.innerHTML = '';
  q.choices.forEach((label, idx)=>{
    const b=document.createElement('button');
    b.className='btn'; b.style.background='var(--brand)'; b.style.color='#fff';
    b.textContent = label || '—';
    b.addEventListener('click', ()=>{
      if (idx===q.ok){ try{fxCorrect.play().catch(()=>{});}catch{} revealOne(); }
      else { showNo(); }
      setTimeout(renderQuestion, 700);
    });
    pzAnswers.appendChild(b);
  });
}
function openPuzzle(){
  pickImage(); buildTiles(); pzBravo.classList.add('hidden'); renderQuestion();
  pzOverlay.classList.remove('hidden'); pzOverlay.setAttribute('aria-hidden','false');
}
function closePuzzle(){
  pzOverlay.classList.add('hidden'); pzOverlay.setAttribute('aria-hidden','true');
}
pzQuit?.addEventListener('click', closePuzzle);
pzBravo?.addEventListener('click', openPuzzle);
