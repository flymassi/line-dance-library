console.log('[WS] app.js v1');

// --- Cache artwork in memoria per evitare richieste duplicate ---
const ART_CACHE = new Map();

// Estrae ID video da una URL YouTube (per fallback thumbnail)
function ytIdFromUrl(u){
  try{
    const url = new URL(u);
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
  }catch{}
  return null;
}

// Costruisce una thumbnail YouTube se disponibile
function youtubeThumb(u){
  const id = ytIdFromUrl(u);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// Chiede copertina ad iTunes Search API (country IT, media=music, entity=song, limit=1)
// Docs Apple: artworkUrl100 in risposta, ampliabile a 600px+ (vedi ref) 
async function fetchArtwork(singerName, songTitle){
  const key = `${singerName}|||${songTitle}`.toLowerCase();
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);

  // Query più robusta: artista + titolo
  const term = encodeURIComponent(`${singerName} ${songTitle}`.trim());
  const url  = `https://itunes.apple.com/search?term=${term}&country=IT&media=music&entity=song&limit=1`;

  try{
    const res = await fetch(url, {mode:'cors'});
    const data = await res.json();
    let art = data?.results?.[0]?.artworkUrl100 || null;
    // Trucco comune: richiediamo una risoluzione più alta rimpiazzando 100x100 → 600x600
    if (art) art = art.replace(/100x100bb\.jpg/i, '600x600bb.jpg');
    ART_CACHE.set(key, art || null);
    return art;
  }catch(e){
    console.warn('Artwork iTunes fallita:', e);
    ART_CACHE.set(key, null);
    return null;
  }
}



// ---------- sfondo random 1..10 ----------
(function setAdaptiveBg(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');

  function pickUrl(){
    const n = Math.floor(Math.random()*10)+1;
    return `./assets/images/background/${n}.png`;
  }

  const url = pickUrl();
  const img = new Image();
  img.onload = () => {
    // salva dimensioni immagine
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    function apply() {
      const sw = window.innerWidth;
      const sh = window.innerHeight;

      const rImg = iw / ih;
      const rScr = sw / sh;
      const diff = Math.abs(Math.log(rImg) - Math.log(rScr)); 
      // euristica: se la differenza di rapporto è alta → contain (mostra tutta l’immagine)
      // se è bassa → cover (riempie bene con poco crop)
      const useContain = diff > 0.35; // ~35% di differenza di aspect ratio

      if (blur) {
        blur.style.backgroundImage = `url('${url}')`;
        blur.style.filter = 'blur(22px) brightness(0.6)';
        blur.style.backgroundSize = 'cover';
      }
      if (main) {
        main.style.backgroundImage = `url('${url}')`;
        main.style.backgroundSize  = useContain ? 'contain' : 'cover';
      }
    }

    apply();
    // ricalcola su resize/orientamento
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
  };
  img.src = url;
})();



// ---------- riferimenti ----------
const cards   = document.getElementById('cards');
const fDance  = document.getElementById('fDance');
const fSong   = document.getElementById('fSong');
const clearBt = document.getElementById('clearFilters');
const countEl = document.getElementById('count');
const fxCrack = document.getElementById('fxCrack');

// ---------- dati ----------
let SONGS = [];
let FILTERS = { dance:'', song:'' };

fetch('./data/songs.json?v='+Date.now())
  .then(r => r.json())
  .then(json => { SONGS = json; render(); })
  .catch(err => {
    console.error('Errore caricamento songs.json', err);
    cards.innerHTML = `<p style="color:#fff">Errore nel caricamento dei dati.</p>`;
  });

// ---------- lista ----------
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');

function matches(it){
  const d=(FILTERS.dance||'').toLowerCase().trim();
  const s=(FILTERS.song ||'').toLowerCase().trim();
  return (!d||(it.danceTitle||'').toLowerCase().includes(d)) &&
         (!s||(it.songTitle ||'').toLowerCase().includes(s));
}

function renderCard(it){
  const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // segnaposto iniziale (riempito poi in asincrono)
  const coverId = `cov_${Math.random().toString(36).slice(2)}`;

  const videoBtn = it.danceVideoUrl
    ? `<a class="action" href="${esc(it.danceVideoUrl)}" target="_blank" rel="noopener">Apri Ballo</a>` : '';
  const songBtn  = it.songUrl
    ? `<a class="action" href="${esc(it.songUrl)}" target="_blank" rel="noopener">Apri Canzone</a>` : '';
  const year = (it.year ?? '-') + '';

  // Avvio fetch artwork in background e aggiorno l’img appena arriva
  queueMicrotask(async () => {
    // 1) prova iTunes
    let art = await fetchArtwork(it.singerName, it.songTitle);
    // 2) fallback: thumb di YouTube dalla canzone (se disponibile)
    if (!art && it.songUrl) art = youtubeThumb(it.songUrl);
    // 3) fallback finale: dalla URL del video del ballo
    if (!art && it.danceVideoUrl) art = youtubeThumb(it.danceVideoUrl);

    const img = document.getElementById(coverId);
    if (img && art) img.src = art;
  });

  return `
    <article class="card">
      <div class="card-row">
        <img id="${coverId}" class="card-cover" alt="Copertina" src="" />
        <div class="card-col">
          <h3 class="card-title">${esc(it.danceTitle)}</h3>
          <div class="card-meta">${esc(it.singerName)} — ${esc(it.songTitle)}</div>
        </div>
        <div class="year-badge" aria-label="Anno">${esc(year)}</div>
      </div>
      <div class="actions">${videoBtn}${songBtn}</div>
    </article>`;
}


function render(){
  const list = SONGS.filter(matches);
  countEl.textContent = `Brani trovati: ${list.length}`;
  cards.innerHTML = list.map(renderCard).join('') || '<p style="color:#fff">Nessun risultato coi filtri.</p>';
}

// filtri
fDance?.addEventListener('input', () => { FILTERS.dance = fDance.value; render(); });
fSong ?.addEventListener('input', () => { FILTERS.song  = fSong.value ; render(); });
clearBt?.addEventListener('click', () => { fDance.value=''; fSong.value=''; FILTERS={dance:'',song:''}; render(); });

// suono sui link YouTube
document.addEventListener('pointerdown', ev => {
  if (ev.target.closest('a.action')) {
    try { fxCrack.cloneNode(true).play().catch(()=>{}); } catch {}
  }
}, {passive:true});

// ---------- pulsante "Aggiorna app" (reset cache + SW) ----------
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
