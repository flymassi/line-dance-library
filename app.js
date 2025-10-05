console.log('[WS] app.js vClean');

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

  // luminanza media su canvas piccola per capire se è “chiaro”
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
      const avg = acc / pixels;        // 0..255
      return avg > 160;                // soglia luce
    }catch(e){
      return false;
    }
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

      const light = isLightImage(img);
      document.body.classList.toggle('bg-light', light);
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
  return {
    small: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    large: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  };
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
      const pair = {
        small: a100,
        large: a100.replace(/100x100bb\.jpg/i,'600x600bb.jpg')
      };
      ART_CACHE.set(key, pair);
      return pair;
    }
  }catch(e){
    console.warn('Artwork iTunes fallita:', e);
  }
  ART_CACHE.set(key, null);
  return null;
}

/* =========================
   DATI + RENDER
   ========================= */
const cards   = document.getElementById('cards');
const fDance  = document.getElementById('fDance');
const fSong   = document.getElementById('fSong');
const clearBt = document.getElementById('clearFilters');
const countEl = document.getElementById('count');
const fxCrack = document.getElementById('fxCrack');

let SONGS = [];
let FILTERS = { dance:'', song:'' };

// Carica dati
fetch('./data/songs.json?v='+Date.now())
  .then(r => r.json())
  .then(json => { SONGS = json; render(); })
  .catch(err => {
    console.error('Errore caricamento songs.json', err);
    cards.innerHTML = `<p style="color:#fff">Errore nel caricamento dei dati.</p>`;
  });

// Filtri
fDance?.addEventListener('input', () => { FILTERS.dance = fDance.value; render(); });
fSong ?.addEventListener('input', () => { FILTERS.song  = fSong.value ; render(); });
clearBt?.addEventListener('click', () => { fDance.value=''; fSong.value=''; FILTERS={dance:'',song:''}; render(); });

// Suono sui link
document.addEventListener('pointerdown', ev => {
  if (ev.target.closest('a.action')) {
    try { fxCrack.cloneNode(true).play().catch(()=>{}); } catch {}
  }
}, {passive:true});

// Utility
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
function matches(it){
  const d=(FILTERS.dance||'').toLowerCase().trim();
  const s=(FILTERS.song ||'').toLowerCase().trim();
  return (!d||(it.danceTitle||'').toLowerCase().includes(d)) &&
         (!s||(it.songTitle ||'').toLowerCase().includes(s));
}

// Render singola card con blur-up
function renderCard(it){
  const coverId = `cov_${Math.random().toString(36).slice(2)}`;
  const videoBtn = it.danceVideoUrl
    ? `<a class="action" href="${esc(it.danceVideoUrl)}" target="_blank" rel="noopener">Apri Ballo</a>` : '';
  const songBtn  = it.songUrl
    ? `<a class="action" href="${esc(it.songUrl)}" target="_blank" rel="noopener">Apri Canzone</a>` : '';
  const year = (it.year ?? '-') + '';

  // blur-up asincrono
  queueMicrotask(async () => {
    let pair = await fetchArtworkPair(it.singerName, it.songTitle);
    if (!pair) pair = youtubeThumbPair(it.songUrl) || youtubeThumbPair(it.danceVideoUrl);

    const imgEl = document.getElementById(coverId);
    if (!imgEl) return;

    if (pair?.small){
      imgEl.src = pair.small;
    }
    if (pair?.large){
      const hi = new Image();
      hi.onload = () => { imgEl.src = pair.large; imgEl.classList.add('is-ready'); };
      hi.src = pair.large;
    } else {
      imgEl.classList.add('is-ready');
    }
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

// --- reveal anim: aggiunge .reveal e attiva .in quando entra a viewport ---
function setupRevealAnimations(){
  const cardsEls = document.querySelectorAll('#cards .card');
  // se l'utente preferisce meno movimento, mostra subito
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !('IntersectionObserver' in window)){
    cardsEls.forEach(el => el.classList.remove('reveal'));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(ent => {
      if (ent.isIntersecting){
        ent.target.classList.add('in');
        obs.unobserve(ent.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

  cardsEls.forEach((el, i) => {
    // aggiungo la classe reveal e una leggera “stagger” con delay inline
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i*40, 240)}ms`;
    io.observe(el);
  });
}



function render(){
  const list = SONGS.filter(matches);
  countEl.textContent = `Brani trovati: ${list.length}`;
  cards.innerHTML = list.map(renderCard).join('') || '<p style="color:#fff">Nessun risultato coi filtri.</p>';

  // attivo animazione reveal per le nuove card
  setupRevealAnimations();
}


/* =========================
   PULSANTE “AGGIORNA APP” (se presente)
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
