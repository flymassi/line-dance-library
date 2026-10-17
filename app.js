/* Western Spritz — app.js v53 · Halloween 2026 */
console.log('[WS] app v53 · Halloween 2026');

/*-- VERSIONE OTTIMIZZATA */
const S_KEY = 'ws_saggio_token';


/* ====== HALLOWEEN 2026 · 17 ottobre → 2 novembre ====== */
function isHalloweenPeriod(date = new Date()){
  const start = new Date(2026, 9, 17, 0, 0, 0, 0); // 17 ottobre, ora locale
  const end   = new Date(2026, 10, 3, 0, 0, 0, 0); // 3 novembre escluso
  return date >= start && date < end;
}

const WS_HALLOWEEN_ACTIVE = isHalloweenPeriod();


/* ====== RIPRISTINO MUSICA HALLOWEEN DOPO LINK ESTERNO ====== */
let WS_HALLOWEEN_BG_RETURN_PENDING = false;
let WS_HALLOWEEN_BG_RESUME_NOT_BEFORE = 0;
let WS_HALLOWEEN_BG_RESUME_TIMER = null;

function pauseHalloweenBackgroundForExternalMedia(){
  if (!WS_HALLOWEEN_ACTIVE) return false;

  const bgMusic = document.getElementById('halloweenBgMusic');
  if (!bgMusic || bgMusic.paused || bgMusic.ended) return false;

  try {
    // Conserva currentTime: al ritorno la musica riprende dal punto interrotto.
    bgMusic.pause();
    WS_HALLOWEEN_BG_RETURN_PENDING = true;
    // Evita che un focus/visibilitychange immediato faccia ripartire l'audio
    // prima che la nuova scheda abbia avuto il tempo di aprirsi.
    WS_HALLOWEEN_BG_RESUME_NOT_BEFORE = Date.now() + 1000;
    return true;
  } catch {
    return false;
  }
}

function resumeHalloweenBackgroundAfterReturn(){
  WS_HALLOWEEN_BG_RESUME_TIMER = null;

  if (!WS_HALLOWEEN_ACTIVE || !WS_HALLOWEEN_BG_RETURN_PENDING) return;
  if (document.hidden) return;

  const splash = document.getElementById('splash');
  if (!document.body.classList.contains('ws-started')) return;
  if (splash && !splash.classList.contains('hidden')) return;

  // Non sovrapporre il sottofondo all'urlo di apertura se l'utente torna subito.
  const scream = document.getElementById('fxOpenScream');
  if (scream && !scream.paused && !scream.ended){
    scream.addEventListener('ended', resumeHalloweenBackgroundAfterReturn, { once:true });
    return;
  }

  const bgMusic = document.getElementById('halloweenBgMusic');
  if (!bgMusic) {
    WS_HALLOWEEN_BG_RETURN_PENDING = false;
    return;
  }

  try {
    bgMusic.loop = true;
    bgMusic.volume = 0.22;
    bgMusic.muted = false;
    const p = bgMusic.play();

    if (p?.then) {
      p.then(()=>{
        WS_HALLOWEEN_BG_RETURN_PENDING = false;
      }).catch(()=>{
        // Mantiene pending=true: un successivo focus/visibilitychange ritenterà.
      });
    } else {
      WS_HALLOWEEN_BG_RETURN_PENDING = false;
    }
  } catch {}
}

function scheduleHalloweenBackgroundResume(delay = 120){
  if (!WS_HALLOWEEN_BG_RETURN_PENDING) return;

  const waitForArm = Math.max(0, WS_HALLOWEEN_BG_RESUME_NOT_BEFORE - Date.now());
  const wait = Math.max(delay, waitForArm);

  clearTimeout(WS_HALLOWEEN_BG_RESUME_TIMER);
  WS_HALLOWEEN_BG_RESUME_TIMER = setTimeout(resumeHalloweenBackgroundAfterReturn, wait);
}

window.addEventListener('focus', ()=> scheduleHalloweenBackgroundResume());
document.addEventListener('visibilitychange', ()=>{
  if (!document.hidden) scheduleHalloweenBackgroundResume();
});
window.addEventListener('pageshow', ()=> scheduleHalloweenBackgroundResume());

if (WS_HALLOWEEN_ACTIVE){
  document.body.classList.add('halloween-mode');

  const intro = document.getElementById('introMusic');
  const introSource = intro?.querySelector('source');
  if (intro && introSource){
    introSource.src = './assets/audio/disturbing-halloween.mp3';
    introSource.type = 'audio/mpeg';
    intro.load();
  }

  const tip = document.querySelector('.splash-tip');
  if (tip) tip.textContent = 'Tocca “Avvia”… se hai coraggio 🎃';

  const startBtn = document.getElementById('startApp');
  if (startBtn) startBtn.textContent = '🎃 Avvia';

  // Decorazioni leggere e non interattive: pipistrelli e teschi vaganti.
  // Vengono create solo durante il periodo Halloween.
  const scenery = document.querySelector('.ws-scenery');
  if (scenery && !scenery.dataset.halloweenFloaters){
    scenery.dataset.halloweenFloaters = '1';

    const specs = [
      ...Array.from({ length: 9 }, (_, i) => ({ icon:'🦇', kind:'bat', i })),
      ...Array.from({ length: 5 }, (_, i) => ({ icon:'💀', kind:'skull', i }))
    ];

    specs.forEach((item, idx)=>{
      const el = document.createElement('span');
      el.className = `halloween-floater halloween-${item.kind}`;
      el.textContent = item.icon;
      el.setAttribute('aria-hidden', 'true');

      // Valori deterministici: effetto vario senza dipendere da timer o librerie esterne.
      const top = 8 + ((idx * 17 + (item.kind === 'skull' ? 9 : 0)) % 78);
      const duration = item.kind === 'bat' ? 14 + (idx % 6) * 2.1 : 19 + (idx % 5) * 2.8;
      const delay = -((idx * 3.7) % duration);
      const size = item.kind === 'bat' ? 18 + (idx % 4) * 5 : 20 + (idx % 3) * 6;
      const wave1 = ((idx % 2 ? -1 : 1) * (18 + (idx % 5) * 7));
      const wave2 = -wave1 * 0.65;
      const endY = ((idx % 3) - 1) * 14;
      const opacity = item.kind === 'bat' ? 0.30 + (idx % 4) * 0.06 : 0.22 + (idx % 3) * 0.06;

      el.style.setProperty('--hf-top', `${top}%`);
      el.style.setProperty('--hf-duration', `${duration.toFixed(1)}s`);
      el.style.setProperty('--hf-delay', `${delay.toFixed(1)}s`);
      el.style.setProperty('--hf-size', `${size}px`);
      el.style.setProperty('--hf-wave1', `${wave1}px`);
      el.style.setProperty('--hf-wave2', `${wave2.toFixed(1)}px`);
      el.style.setProperty('--hf-end-y', `${endY}px`);
      el.style.setProperty('--hf-opacity', opacity.toFixed(2));
      scenery.appendChild(el);
    });
  }
}

/* ====== BACKGROUND RANDOM ====== */
(function(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');
  const url  = `./assets/images/background/${Math.floor(Math.random()*10)+1}.png`;
  if (blur) blur.style.backgroundImage = `url('${url}')`;
  if (main) main.style.backgroundImage = `url('${url}')`;
})();

/* ====== SPLASH + AUDIO ====== */
(function(){
  const splash  = document.getElementById('splash');
  const start   = document.getElementById('startApp');
  const music   = document.getElementById('introMusic');
  const bgMusic = document.getElementById('halloweenBgMusic');

  let entering = false;
  let halloweenBgPrimed = false;

  function primeHalloweenBackground(){
    if (!WS_HALLOWEEN_ACTIVE || !bgMusic || halloweenBgPrimed) return;

    try {
      bgMusic.loop = true;
      bgMusic.muted = true;
      bgMusic.volume = 0.22;
      bgMusic.currentTime = 0;
      const p = bgMusic.play();
      halloweenBgPrimed = true;
      if (p?.catch) {
        p.catch(()=>{
          halloweenBgPrimed = false;
        });
      }
    } catch {
      halloweenBgPrimed = false;
    }
  }

  function startHalloweenBackground(){
    if (!WS_HALLOWEEN_ACTIVE || !bgMusic) return;

    try {
      bgMusic.loop = true;
      bgMusic.currentTime = 0;
      bgMusic.volume = 0.22;
      bgMusic.muted = false;
      const p = bgMusic.play();
      if (p?.catch) p.catch(()=>{});
    } catch {}
  }

  function revealApp(){
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    document.body.classList.add('ws-started');
    startHalloweenBackground();
  }

  // Halloween: il click su “Avvia” fa partire il brano disturbante
  // mantenendo visibile lo splash. Solo alla fine entra nell'app e
  // parte in loop la musica di sottofondo.
  const hideSplash = ()=>{
    if (!splash || splash.classList.contains('hidden') || entering) return;
    entering = true;

    if (WS_HALLOWEEN_ACTIVE){
      if (start){
        start.disabled = true;
        start.textContent = '😱 ...';
      }

      // Avvia il background già durante il gesto utente ma silenziato:
      // al termine dello splash potrà essere reso udibile in modo affidabile
      // anche sui browser mobili con restrizioni sull'autoplay.
      primeHalloweenBackground();

      if (music){
        let finished = false;
        const finishHalloweenIntro = ()=>{
          if (finished) return;
          finished = true;
          music.removeEventListener('ended', finishHalloweenIntro);
          music.removeEventListener('error', finishHalloweenIntro);
          revealApp();
        };

        try {
          music.muted = false;
          music.volume = 1;
          music.addEventListener('ended', finishHalloweenIntro, { once:true });
          music.addEventListener('error', finishHalloweenIntro, { once:true });

          // Se il browser ha consentito l'autoplay, il brano sta già suonando
          // sullo splash: non lo riavviamo da capo al tocco su “Avvia”.
          if (music.ended){
            finishHalloweenIntro();
          } else if (music.paused){
            music.currentTime = 0;
            const p = music.play();
            if (p?.catch) p.catch(finishHalloweenIntro);
          }
        } catch {
          finishHalloweenIntro();
        }
        return;
      }

      revealApp();
      return;
    }

    // Fuori dal periodo Halloween: mantiene il comportamento storico.
    try {
      if (music){
        music.muted = false;
        music.currentTime = 0;
        const p = music.play();
        if (p?.catch) p.catch(()=>{});
      }
    } catch {}

    revealApp();
  };

  if (start) {
    start.addEventListener('click', hideSplash, { once:true });
    start.addEventListener('pointerup', hideSplash, { once:true });
    start.addEventListener('touchend', hideSplash, { once:true, passive:true });
    start.onclick = hideSplash;
  }

  splash?.addEventListener('dblclick', hideSplash);

  window.addEventListener('keydown', (e)=>{
    if (e.key==='Enter' || e.key===' ') hideSplash();
  }, { once:true });

  // Durante Halloween proviamo a far partire subito il brano disturbante
  // mentre lo splash è visibile. I browser mobili possono bloccare l'audio
  // automatico: in quel caso partirà dal primo tocco su “Avvia”.
  if (WS_HALLOWEEN_ACTIVE){
    try {
      if (music){
        music.muted = false;
        music.volume = 1;
        music.currentTime = 0;
        const p = music.play();
        if (p?.catch) {
          p.catch(()=>{
            try { music.pause(); music.currentTime = 0; } catch {}
          });
        }
      }
    } catch {}
  } else {
    // Fuori da Halloween conserva il pre-avvio silenzioso del jingle normale.
    try {
      if (music){
        music.muted = true;
        music.volume = 1;
        music.play().catch(()=>{});
      }
    } catch {}
  }

  // --- Contatore visite
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

    const dur = 800;
    const t0 = performance.now();

    function step(t){
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (target - from) * eased);
      el.textContent = val.toLocaleString('it-IT');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    el.classList.remove('count-pulse','count-shine');
    void el.offsetWidth;
    el.classList.add('count-pulse','count-shine');
    localStorage.setItem('ws_last_visits', String(target));
  }

  try {
    const el = document.getElementById('visitCounter');
    if (el) {
      const devHosts = ['', 'localhost', '127.0.0.1'];
      const isDev = devHosts.includes(location.hostname);

      if (isDev) {
        el.textContent = 'DEV';
        console.log('[WS] contatore disattivato in dev (host:', location.hostname, ')');
      } else {
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

})();

/* ====== UTIL ====== */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const getYouTubeId = url => {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
  return m ? m[1] : null;
};
const debounce = (fn, delay = 120) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

/* ====== DATA (brani) ====== */
let SONGS = [];
let FILTER = { dance:'', song:'', course:'line', year:'all' };
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

/* === Canzone in evidenza: FUN WITH ASIA sempre in cima === */
const FEATURED_KEY = 'FUN WITH ASIA';


function hasSweatDustBg(s){
  const up = v => (v || '').toUpperCase().trim();
  const title = up(s.danceTitle);

  return (
    title === 'UNITED COUNTRIES 2026' ||
    title === 'VALCENO 2026' ||
    title === 'OVER1325 SWEAT AND DUST 2026' ||
    title === 'SECOND TIME (OVER 1008 - 2025)' ||
    title === 'ONE (OVER 1000 - 2025)'
  );
}

function getCardWatermark(s){
  const title = String(s?.danceTitle || '').toUpperCase().trim();

  if (title === 'UNITED COUNTRIES 2026 - TIME KILLER') {
    return './assets/images/logo_united_countries.png';
  }
  if (title === 'VALCENO 2026 - JUST ANOTHER DAY') {
    return './assets/images/valceno.png';
  }
  if (title === 'MARSHALL COUNTY MAN (VALCENO 2025)') {
    return './assets/images/valceno.png';
  }
  return '';
}

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

/* ====== CORSI / ANNI ====== */
const CATALANO_YEAR = 10;

function isCatalanoSong(s){
  return Number(s?.year) === CATALANO_YEAR;
}

function matchesCourseAndYear(s){
  if (FILTER.course === 'catalano') return isCatalanoSong(s);
  if (isCatalanoSong(s)) return false;
  if (FILTER.year === 'all') return true;
  return Number(s?.year) === Number(FILTER.year);
}

function yearBadgeText(s){
  return isCatalanoSong(s) ? '🇪🇸 CATALANO' : `ANNO&nbsp;<b>${s.year}</b>`;
}

function syncCourseFilterUI(){
  $$('.course-tab').forEach(btn => {
    const active = btn.dataset.course === FILTER.course;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const yearFilters = $('#yearFilters');
  if (yearFilters) yearFilters.classList.toggle('hidden', FILTER.course === 'catalano');

  $$('.year-chip').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.year) === String(FILTER.year));
  });
}

/* ====== RENDER CARDS ====== */
function render(){
  if (!elCards) return;

  const qd = FILTER.dance.toLowerCase().trim();
  const qs = FILTER.song.toLowerCase().trim();
  const playlistKeys = new Set(PLAYLIST.map(p => `${p.year}-${p.songNumber}`));

  const rows = SONGS.filter(s =>
    matchesCourseAndYear(s) &&
    (!qd || (s.danceTitle||'').toLowerCase().includes(qd)) &&
    (!qs || (s.songTitle||'').toLowerCase().includes(qs))
  );

  elCards.innerHTML = rows.map(s=>{
    const vid = getYouTubeId(s.songUrl || s.danceVideoUrl);
    const cover = vid ? `https://img.youtube.com/vi/${vid}/0.jpg` : './assets/images/icon.png';
    const inPl  = playlistKeys.has(`${s.year}-${s.songNumber}`);
    const featured = isFeaturedSong(s);
const sweatBg = hasSweatDustBg(s);
    const cardWatermark = getCardWatermark(s);

    if (featured){
      return `
      <article class="card card-asia-special">
        <div class="asia-top">
          <a class="asia-btn asia-btn-left"
             href="https://www.youtube.com/@funwithasia"
             target="_blank" rel="noopener">
            Fun with ASIA
          </a>
          <div class="asia-follow">FOLLOW&nbsp;US!</div>
          <a class="asia-btn asia-btn-right"
             href="https://www.youtube.com/@funfamilytravelvlog"
             target="_blank" rel="noopener">
            Fun&nbsp;Family
          </a>
        </div>

<div class="asia-main">
  <div class="asia-side">
    <a href="https://www.youtube.com/@funwithasia" target="_blank" rel="noopener">
      <img src="./assets/images/fun-asia-logo.png" alt="Fun with Asia" class="asia-circle">
    </a>
  </div>

  <div class="asia-center">
    <img src="./assets/images/fun-asia-photo.png" alt="Fun with Asia Family" class="asia-photo">
  </div>

  <div class="asia-side">
    <a href="https://www.youtube.com/@funfamilytravelvlog" target="_blank" rel="noopener">
      <img src="./assets/images/fun-family-logo.png" alt="Fun Family Travel Vlog" class="asia-circle">
    </a>
  </div>
</div>

<div class="asia-subtext">
  ATTENZIONE!!! ATTENZIONE!!!!<br>
  se non fai SUBSCRIBE ai nostri due canali<br>
  andrai incontro a RESTART e TAG ERRATI tutto l'anno!!!
</div>


      </article>
      `;
    }


    return `
     <article class="card ${sweatBg ? 'card-sweat-bg' : ''} ${cardWatermark ? 'card-event-watermark' : ''}">
        ${cardWatermark ? `<img class="card-watermark-img" src="${cardWatermark}" alt="" aria-hidden="true" loading="lazy" />` : ''}
        <div class="card-row">
          <img class="cover" src="${cover}" alt="cover" loading="lazy" />
          <div style="flex:1; min-width:0">
            <div class="title">${(s.danceTitle||'').toUpperCase()}</div>
            <div class="meta">${s.singerName||''} — ${s.songTitle||''}</div>
          </div>
          <div class="badges">
            <span class="badge">#${s.songNumber}</span>
            <span class="badge year">${yearBadgeText(s)}</span>
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

  initAsiaBoom();
}

/* ===== FUN WITH ASIA: BOOM ON SCROLL EXIT ===== */
let asiaBoomDone = false;
let asiaBoomTicking = false;

function initAsiaBoom(){
  // La card viene ricreata dal render(): resettiamo stato e visibility sul nuovo nodo.
  const card = document.querySelector('.card-asia-special');
  if (!card) return;

  card.classList.remove('asia-boom');
  card.style.visibility = '';
  asiaBoomDone = false;
  checkAsiaBoom();
}

function checkAsiaBoom(){
  asiaBoomTicking = false;

  const card = document.querySelector('.card-asia-special');
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const goingOutTop = rect.bottom < 120;
  const visibleAgain = rect.top > 20 && rect.top < window.innerHeight;

  if (goingOutTop && !asiaBoomDone){
    asiaBoomDone = true;

    card.style.visibility = '';
    card.classList.remove('asia-boom');
    void card.offsetWidth; // riavvia animazione
    card.classList.add('asia-boom');

    setTimeout(()=>{
      if (asiaBoomDone) card.style.visibility = 'hidden';
    }, 650);
  }

  if (visibleAgain){
    asiaBoomDone = false;
    card.classList.remove('asia-boom');
    card.style.visibility = '';
  }
}

function requestAsiaBoomCheck(){
  if (asiaBoomTicking) return;
  asiaBoomTicking = true;
  requestAnimationFrame(checkAsiaBoom);
}

window.addEventListener('scroll', requestAsiaBoomCheck, { passive:true });
window.addEventListener('resize', requestAsiaBoomCheck);

/* ====== OPEN LINKS (urlo Halloween) ====== */
(function(){
  document.addEventListener('click', e=>{
    const a = e.target.closest?.('[data-open]');
    if (!a) return;
    const y = +a.dataset.y, n = +a.dataset.n;
    const s = SONGS.find(x=>x.year==y && x.songNumber==n);
    const url = a.dataset.open==='dance' ? s?.danceVideoUrl : s?.songUrl;
    if (!url) return;
    // Quando si apre un ballo o una canzone, interrompi il sottofondo.
    // Se era in riproduzione, verrà ripreso automaticamente quando l'utente
    // torna alla scheda dell'app.
    pauseHalloweenBackgroundForExternalMedia();

    const scream = $('#fxOpenScream');
    if (scream){
      try {
        scream.currentTime = 0;
        const p = scream.play();
        if (p?.catch) p.catch(()=>{});
      } catch {}
    }
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
    return !!sessionStorage.getItem(S_KEY);
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


/* ====== FILTRI ====== */
$('#fDance')?.addEventListener('input', debounce(e=>{ FILTER.dance = e.target.value; render(); }));
$('#fSong' )?.addEventListener('input', debounce(e=>{ FILTER.song  = e.target.value; render(); }));

$$('.course-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const course = btn.dataset.course;
    if (course !== 'line' && course !== 'catalano') return;
    FILTER.course = course;
    FILTER.year = 'all';
    syncCourseFilterUI();
    render();
  });
});

$$('.year-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    if (FILTER.course !== 'line') return;
    const year = btn.dataset.year;
    if (year !== 'all' && !['1','2','3','4'].includes(year)) return;
    FILTER.year = year;
    syncCourseFilterUI();
    render();
  });
});

$('#clearFilters')?.addEventListener('click', ()=>{
  FILTER.dance = '';
  FILTER.song = '';
  FILTER.year = 'all';
  const fd = $('#fDance'), fs = $('#fSong');
  if (fd) fd.value='';
  if (fs) fs.value='';
  syncCourseFilterUI();
  render();
});

syncCourseFilterUI();

/* ====== DATA LOAD ====== */
function normalizeSongRow(row){
  return {
    ...row,
    year: Number.isFinite(Number(row?.year)) ? Number(row.year) : 0,
    songNumber: Number.isFinite(Number(row?.songNumber)) ? Number(row.songNumber) : 0,
    danceTitle: String(row?.danceTitle || '').trim(),
    singerName: String(row?.singerName || '').trim(),
    songTitle: String(row?.songTitle || '').trim(),
    danceVideoUrl: String(row?.danceVideoUrl || '').trim(),
    songUrl: String(row?.songUrl || '').trim()
  };
}

async function load(){
  const candidates = ['./data/songs.json', './songs.json'];
  try{
    let data = null;
    for (const path of candidates){
      try {
        const res = await fetch(path, { cache:'no-store' });
        if (!res.ok) continue;
        data = await res.json();
        break;
      } catch {}
    }

    if (!Array.isArray(data)) throw new Error('songs.json non valido');

    SONGS = data.map(normalizeSongRow);
    SONGS.sort((a,b)=> (b.songNumber||0) - (a.songNumber||0));
    promoteFeaturedSong(SONGS);
    render();
  }catch(e){
    if (elCards) elCards.innerHTML = `<div class="card">Errore nel caricamento dati.</div>`;
    console.error('Errore caricamento songs.json', e);
  }
}
load();

/* ====== Aggiorna app (semplice reload pulito) ====== */
$('#btnUpdate')?.addEventListener('click', async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
  } catch (err) {
    console.error('[WS] errore pulizia cache manuale', err);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('refresh', Date.now().toString());
  window.location.replace(url.toString());
});


function syncHeroHeight(){
  const hero = document.querySelector('.hero');
  if (!hero) return;
  document.documentElement.style.setProperty('--hero-h', `${hero.offsetHeight}px`);
}
window.addEventListener('load', syncHeroHeight);
window.addEventListener('resize', syncHeroHeight);
if ('ResizeObserver' in window) {
  const hero = document.querySelector('.hero');
  if (hero) new ResizeObserver(syncHeroHeight).observe(hero);
}

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

/* ===== HERO PREMIUM ON SCROLL ===== */
(function () {
  const heroSticky = document.querySelector('.hero-sticky');
  if (!heroSticky) return;

  let ticking = false;

  function updateHeroShrink() {
    const y = window.scrollY || window.pageYOffset || 0;
    heroSticky.classList.toggle('is-shrunk', y > 20);
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateHeroShrink);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', updateHeroShrink);
  updateHeroShrink();
})();

const hero = document.querySelector('.hero-sticky');

let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;

  if (currentScroll > 10) {
    hero.classList.add('is-shrunk');
  } else {
    hero.classList.remove('is-shrunk');
  }

  lastScroll = currentScroll;
});