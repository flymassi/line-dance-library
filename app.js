// ==== Selettori base ====
const cards   = document.getElementById('cards');
const fDance  = document.getElementById('fDance');
const fSong   = document.getElementById('fSong');
const clearBtn= document.getElementById('clearFilters');
const countEl = document.getElementById('count');

const splash      = document.getElementById('splash');
const startBtn    = document.getElementById('startBtn');
const introMusic  = document.getElementById('introMusic');
const sfx         = document.getElementById('sfx');

let DATA = [];
let FILTERS = { dance: '', song: '' };

// ==== Sfondo casuale all'avvio ====
function setRandomBackground() {
  const n = Math.floor(Math.random() * 10) + 1; // 1..10
  const bases = [
    './assets/images/background',  // percorso consigliato
    './images/backgound',          // (typo voluto, se li hai già qui)
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
  const d = FILTERS.dance.trim().toLowerCase();
  const s = FILTERS.song.trim().toLowerCase();
  const okDance = !d || (it.danceTitle || '').toLowerCase().includes(d);
  const okSong  = !s || (it.songTitle  || '').toLowerCase().includes(s);
  return okDance && okSong;
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
  const vBtn = it.danceVideoUrl ? 
    `<a href="${safe(it.danceVideoUrl)}" class="action primary yt-link" data-kind="video" target="_blank" rel="noopener">Apri Ballo</a>` 
    : '';
  const sBtn = it.songUrl ? 
    `<a href="${safe(it.songUrl)}" class="action secondary yt-link" data-kind="song" target="_blank" rel="noopener">Apri Canzone</a>` 
    : '';
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
        <div></div>
      </div>
      <div class="actions">
        ${vBtn}
        ${sBtn}
      </div>
    </article>
  `;
}

// ==== Eventi filtri ====
if (fDance && fSong) {
  [fDance, fSong].forEach(inp => inp.addEventListener('input', () => {
    FILTERS.dance = fDance.value;
    FILTERS.song  = fSong.value;
    render();
  }));
}
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    fDance.value = ''; fSong.value = '';
    FILTERS = { dance:'', song:'' };
    render();
  });
}

// ==== Suono e apertura link YouTube ====
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a.yt-link');
  if (!a) return;
  ev.preventDefault();
  const href = a.getAttribute('href');
  try {
    const clone = sfx.cloneNode(true);
    const p = clone.play();
    if (p && p.then) {
      p.finally(() => setTimeout(() => window.open(href, '_blank', 'noopener'), 120));
    } else {
      window.open(href, '_blank', 'noopener');
    }
  } catch {
    window.open(href, '_blank', 'noopener');
  }
});

// ==== Avvio con splash ====
window.startApp = async function () {
  try { await introMusic.play(); } catch (e) { console.warn('Audio non partito (ok):', e); }
  setTimeout(() => splash && splash.classList.add('hidden'), 3000);
};
if (startBtn) startBtn.addEventListener('click', window.startApp);
