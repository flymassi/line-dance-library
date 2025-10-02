// ==== Selettori base ====
const cards   = document.getElementById('cards');
const fDance  = document.getElementById('fDance');
const fSong   = document.getElementById('fSong');
const onlyFavs= document.getElementById('onlyFavs');
const clearBtn= document.getElementById('clearFilters');
const countEl = document.getElementById('count');

const splash      = document.getElementById('splash');
const startBtn    = document.getElementById('startBtn');
const introMusic  = document.getElementById('introMusic');
const sfx         = document.getElementById('sfx');

// Install UI
const installBanner = document.getElementById('installBanner');
const iosHint = document.getElementById('iosHint');
const installBtn = document.getElementById('installBtn');
const closeInstall = document.getElementById('closeInstall');
const closeIos = document.getElementById('closeIos');

// Stato dati
let DATA = [];
let FILTERS = { dance: '', song: '' };

// Preferiti (persistenza locale)
const FAV_KEY = 'lds:favorites';
let FAVORITES = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
function saveFavs(){ localStorage.setItem(FAV_KEY, JSON.stringify([...FAVORITES])); }

// iOS detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// ==== Sfondo casuale all'avvio ====
function setRandomBackground() {
  const n = Math.floor(Math.random() * 10) + 1; // 1..10
  const bases = [
    './assets/images/background',  // percorso consigliato
    './images/backgound',          // typo storico (fallback)
    './images/background'          // fallback
  ];
  function trySrc(i=0) {
    if (i >= bases.length) return;
    const url = `${bases[i]}/${n}.png`;
    const img = new Image();
    img.onload  = () => { document.body.style.backgroundImage = `url('${url}')`; };
    img.onerror = () => trySrc(i+1);
    img.src = url;
  }
  trySrc();
}
document.addEventListener('DOMContentLoaded', setRandomBackground);

// ==== Reset service worker & cache via ?reset-sw=1 ====
(function(){
  const qp = new URLSearchParams(location.search);
  if (!qp.has('reset-sw')) return;
  (async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } finally {
      location.replace(location.origin + location.pathname);
    }
  })();
})();

// ==== Carica i dati (con anti-cache) ====
fetch('./data/songs.json?v=' + Date.now())
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(json => {
    console.log('✅ Dati caricati:', json.length, 'righe');
    DATA = json;
    render();
  })
  .catch(err => {
    console.error('❌ Errore nel caricamento di data/songs.json:', err);
    cards.innerHTML = '<p style="color:white;padding:12px">Errore nel caricamento di <code>data/songs.json</code>. Controlla il percorso e ricarica con CTRL+F5.</p>';
  });

// ==== Filtraggio ====
function matches(it) {
  const d = (FILTERS.dance || '').trim().toLowerCase();
  const s = (FILTERS.song  || '').trim().toLowerCase();

  const okDance = !d || (it.danceTitle || '').toLowerCase().includes(d);
  const okSong  = !s || (it.songTitle  || '').toLowerCase().includes(s);
  const okFav   = !onlyFavs?.checked || FAVORITES.has(String(it.songNumber));

  return okDance && okSong && okFav;
}

// ==== Rendering ====
function render() {
  const items = DATA.filter(matches);
  countEl.textContent = `Brani trovati: ${items.length}`;
  cards.innerHTML = items.map(renderCard).join('') 
                 || '<p style="color:white;padding:12px">Nessun risultato coi filtri attuali.</p>';
}

function renderCard(it) {
  const safe = str => (str || '').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const isFav = FAVORITES.has(String(it.songNumber));

  const vBtn = it.danceVideoUrl ? 
    `<a href="${safe(it.danceVideoUrl)}" class="action primary yt-link" data-kind="video" target="_blank" rel="noopener external">Apri Ballo</a>` 
    : '';
  const sBtn = it.songUrl ? 
    `<a href="${safe(it.songUrl)}" class="action secondary yt-link" data-kind="song" target="_blank" rel="noopener external">Apri Canzone</a>` 
    : '';
  const shareBtn =
    `<button class="action neutral share-btn" data-share="${safe(it.danceVideoUrl || it.songUrl || '')}" data-title="${safe(it.danceTitle)}">Condividi</button>`;
  const favBtn =
    `<button class="fav-btn ${isFav ? 'active' : ''}" title="Aggiungi ai preferiti" data-num="${safe(it.songNumber)}">★</button>`;

  return `
    <article class="card">
      <div class="card-head">
        <div class="badges">
          <span class="badge">#${safe(it.songNumber)}</span>
          <span class="badge year">${safe(it.year)}</span>
        </div>
        <div>
          <h3 class="title">${safe(it.danceTitle)}</h3>
          <div class="singer">${safe(it.singerName)}</div>
          <div class="song">${safe(it.songTitle)}</div>
        </div>
        <div>${favBtn}</div>
      </div>
      <div class="actions">
        ${vBtn}
        ${sBtn}
        ${shareBtn}
      </div>
    </article>
  `;
}

// ==== Eventi filtri ====
[fDance, fSong].forEach(inp => inp?.addEventListener('input', () => {
  FILTERS.dance = fDance.value;
  FILTERS.song  = fSong.value;
  render();
}));
onlyFavs?.addEventListener('change', render);

clearBtn?.addEventListener('click', () => {
  if (fDance) fDance.value = '';
  if (fSong)  fSong.value  = '';
  if (onlyFavs) onlyFavs.checked = false;
  FILTERS = { dance:'', song:'' };
  render();
});

// ==== Suono + apertura link (compatibile iPhone) ====
// riproduci "frusta" immediata al gesto (iOS ok)
function playCrack() {
  try {
    const clone = sfx.cloneNode(true);
    clone.play().catch(()=>{});
  } catch {}
}

// iOS: su pointerdown riproduci suono e NON bloccare i link (si aprono da soli)
document.addEventListener('pointerdown', (ev) => {
  const a = ev.target.closest('a.yt-link');
  if (!a) return;
  playCrack();
}, { passive: true });

// Desktop/Android: apri in nuova scheda, con fallback
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a.yt-link');
  if (!a) return;

  if (isIOS) return; // su iOS non fermiamo l'azione del link

  ev.preventDefault();
  const href = a.getAttribute('href');
  playCrack();
  setTimeout(() => {
    const w = window.open(href, '_blank', 'noopener');
    if (!w) location.href = href;
  }, 0);
});

// ==== Avvio con splash ====
window.startApp = async function () {
  try { await introMusic.play(); } catch (e) { console.warn('Audio non partito (ok):', e); }
  setTimeout(() => splash && splash.classList.add('hidden'), 3000);
};
if (startBtn) startBtn.addEventListener('click', window.startApp);

// ==== Condividi ====
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.share-btn');
  if (!btn) return;

  const url = btn.getAttribute('data-share') || location.href;
  const title = btn.getAttribute('data-title') || 'Line Dance';
  const text = `${title} — ${url}`;

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Copiato!';
      setTimeout(()=>btn.textContent='Condividi', 1200);
    } else {
      window.prompt('Copia questo link:', url);
    }
  } catch { /* annullato dall'utente: ok */ }
});

// ==== Preferiti ====
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.fav-btn');
  if (!btn) return;
  const num = btn.getAttribute('data-num');
  if (FAVORITES.has(num)) FAVORITES.delete(num); else FAVORITES.add(num);
  saveFavs();
  render();
});

// ==== Install banner / A2HS ====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isIOS && !isStandalone) {
    installBanner?.classList.remove('hidden');
  }
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner?.classList.add('hidden');
});
closeInstall?.addEventListener('click', () => installBanner?.classList.add('hidden'));
if (isIOS && !isStandalone) iosHint?.classList.remove('hidden');
closeIos?.addEventListener('click', () => iosHint?.classList.add('hidden'));
if (new URLSearchParams(location.search).has('install')) {
  if (deferredPrompt && !isIOS && !isStandalone) installBanner?.classList.remove('hidden');
  if (isIOS && !isStandalone) iosHint?.classList.remove('hidden');
}

/* =========================================================================
   PUZZLE QUIZ
   ====================================================================== */
// Selettori gioco
const openPuzzle = document.getElementById('openPuzzle');
const pzOverlay = document.getElementById('puzzleOverlay');
const pzImage   = document.getElementById('pzImage');
const pzTiles   = document.getElementById('pzTiles');
const pzQuestion= document.getElementById('pzQuestion');
const pzChoices = document.getElementById('pzChoices');
const pzBravo   = document.getElementById('pzBravo');
const pzQuit    = document.getElementById('pzQuit');
const pzNext    = document.getElementById('pzNext');
const pzNo      = document.getElementById('pzNo');

const audioCorrect = document.getElementById('audioCorrect');
const audioWrong   = document.getElementById('audioWrong');

const GRID_N = 5; // 5x5 = 25 tasselli
let pzState = {
  imgIndex: 1,
  hiddenOrder: [],
  revealed: new Set(),
  currentQuestion: null
};

function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

// scegli una delle 27 immagini
function pickPuzzleImage(){
  pzState.imgIndex = randInt(1,27);
  pzImage.src = `./assets/images/puzzles/${pzState.imgIndex}.png`;
}

// costruisci i tasselli
function buildTiles(){
  pzTiles.innerHTML = '';
  pzState.revealed.clear();
  const total = GRID_N * GRID_N;
  const ids = [...Array(total).keys()]; // 0..24
  pzState.hiddenOrder = shuffle(ids.slice());
  for (let i=0;i<total;i++){
    const d = document.createElement('div');
    d.className = 'pz-tile';
    d.dataset.id = String(i);
    pzTiles.appendChild(d);
  }
}

// scopri un tassello
function revealOne(){
  const nextId = pzState.hiddenOrder.find(id => !pzState.revealed.has(id));
  if (nextId == null) return;
  pzState.revealed.add(nextId);
  const el = pzTiles.querySelector(`.pz-tile[data-id="${nextId}"]`);
  if (el) el.classList.add('revealed');

  const total = GRID_N * GRID_N;
  if (pzState.revealed.size >= total){
    setTimeout(()=> pzBravo.classList.remove('hidden'), 300);
  }
}

// mostra alessia "no" che oscilla per la durata dell'audio
function showNoWobble(){
  pzNo.classList.remove('hidden');
  pzNo.classList.add('wobble');
  const dur = (audioWrong?.duration && isFinite(audioWrong.duration)) ? audioWrong.duration : 1.0;
  setTimeout(()=>{
    pzNo.classList.add('hidden');
    pzNo.classList.remove('wobble');
  }, Math.round(dur*1000));
}

// domanda dal DB (due tipi)
function buildQuestionFromData() {
  if (!Array.isArray(DATA) || DATA.length < 4) {
    return { text:'Dati insufficienti', choices:[], correctIndex:0 };
  }
  const pool = DATA.slice();
  const correct = pool[randInt(0, pool.length-1)];
  const type = Math.random() < 0.5 ? 'singer' : 'dance';

  let text, correctText, key;
  if (type === 'singer'){
    text = `Chi è il cantante di “${correct.songTitle}”?`;
    correctText = correct.singerName;
    key = 'singerName';
  } else {
    text = `Qual è il titolo del ballo per “${correct.songTitle}”?`;
    correctText = correct.danceTitle;
    key = 'danceTitle';
  }

  const distractors = [];
  const used = new Set([ (correctText||'').toLowerCase() ]);
  shuffle(pool);
  for (const it of pool) {
    const val = (it[key]||'').toString().trim();
    if (!val) continue;
    const low = val.toLowerCase();
    if (used.has(low)) continue;
    used.add(low);
    distractors.push(val);
    if (distractors.length >= 3) break;
  }
  while (distractors.length < 3) distractors.push('—');

  const choices = shuffle([correctText, ...distractors]).slice(0,4);
  const correctIndex = choices.findIndex(x => x === correctText);

  return { text, choices, correctIndex };
}

function renderQuestion(){
  pzState.currentQuestion = buildQuestionFromData();
  pzQuestion.textContent = pzState.currentQuestion.text;
  pzChoices.innerHTML = '';
  pzNext.disabled = true;

  pzState.currentQuestion.choices.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = 'pz-choice';
    btn.textContent = label || '—';
    btn.addEventListener('click', async () => {
      [...pzChoices.children].forEach(b => b.disabled = true);

      if (idx === pzState.currentQuestion.correctIndex){
        btn.classList.add('correct');
        try { await audioCorrect.play(); } catch {}
        revealOne();
      } else {
        btn.classList.add('wrong');
        try { await audioWrong.play(); } catch {}
        showNoWobble();
      }
      pzNext.disabled = false;
    });
    pzChoices.appendChild(btn);
  });
}

function startPuzzle(){
  pickPuzzleImage();
  buildTiles();
  pzBravo.classList.add('hidden');
  renderQuestion();
  pzOverlay.classList.remove('hidden');
  pzOverlay.setAttribute('aria-hidden', 'false');
}
function closePuzzle(){
  pzOverlay.classList.add('hidden');
  pzOverlay.setAttribute('aria-hidden', 'true');
}

document.getElementById('openPuzzle')?.addEventListener('click', startPuzzle);
document.getElementById('pzQuit')?.addEventListener('click', closePuzzle);
document.getElementById('pzNext')?.addEventListener('click', renderQuestion);
document.getElementById('pzBravo')?.addEventListener('click', startPuzzle);

// Apri il puzzle automaticamente se l'URL ha ?puzzle=1
if (new URLSearchParams(location.search).get('puzzle') === '1') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof startPuzzle === 'function') startPuzzle();
  });
}
