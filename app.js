/* Western Spritz — Line Dance Library + Catalano + Challenge */
console.log('[WS] app · Western Spritz');

/*-- VERSIONE OTTIMIZZATA */
const S_KEY = 'ws_catalano_token';
const S_USER_KEY = 'ws_catalano_user';


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
  const splash = document.getElementById('splash');
  const start = document.getElementById('startApp');
  const music = document.getElementById('introMusic');
  let entering = false;
  function revealApp(){
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    document.body.classList.add('ws-started');
  }
  const hideSplash = ()=>{
    if (!splash || splash.classList.contains('hidden') || entering) return;
    entering = true;
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
  // Pre-avvio silenzioso del jingle normale.
  try {
    if (music){
      music.muted = true;
      music.volume = 1;
      const p = music.play();
      if (p?.catch) p.catch(()=>{});
    }
  } catch {}

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
  const items = getAccessiblePlaylist();
  const item = items[index];
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

function isCatalanoAuth(){
  return window.WSCatalanoSession?.isAuthenticated() === true;
}

function matchesCourseAndYear(s){
  if (FILTER.course === 'catalano') return isCatalanoAuth() && isCatalanoSong(s);
  if (isCatalanoSong(s)) return false;
  if (FILTER.year === 'all') return true;
  return Number(s?.year) === Number(FILTER.year);
}

function yearBadgeText(s){
  return isCatalanoSong(s) ? '🇪🇸 CATALANO' : `ANNO&nbsp;<b>${s.year}</b>`;
}

function getAccessiblePlaylist(){
  if (isCatalanoAuth()) return PLAYLIST;
  return PLAYLIST.filter(s => !isCatalanoSong(s));
}

function syncCourseFilterUI(){
  const authed = isCatalanoAuth();

  $$('.course-tab').forEach(btn => {
    const active = btn.dataset.course === FILTER.course;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const catalanoLabel = $('#catalanoTabLabel');
  if (catalanoLabel) catalanoLabel.textContent = authed ? '🇪🇸 CATALANO ✓' : '🇪🇸 CATALANO 🔒';

  const logoutBtn = $('#btnCatalanoLogout');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !authed);

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
  ATTENZIONE!!! - SUBSCRIBE - ATTENZIONE!!!!<br>
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

/* ====== OPEN LINKS ====== */
(function(){
  document.addEventListener('click', e=>{
    const a = e.target.closest?.('[data-open]');
    if (!a) return;
    const y = +a.dataset.y, n = +a.dataset.n;
    const s = SONGS.find(x=>x.year==y && x.songNumber==n);
    if (s && isCatalanoSong(s) && !isCatalanoAuth()) {
      openCatalanoLogin();
      return;
    }
    const url = a.dataset.open==='dance' ? s?.danceVideoUrl : s?.songUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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
  if (isCatalanoSong(s) && !isCatalanoAuth()) {
    openCatalanoLogin();
    return;
  }

  const idx = PLAYLIST.findIndex(p=>p.year==y && p.songNumber==n);
  if (idx>=0) PLAYLIST.splice(idx,1); else PLAYLIST.push(s);
  localStorage.setItem('ws_playlist', JSON.stringify(PLAYLIST));
  updatePlaylistButton(b, idx<0);
});

$('#btnPlaylist')?.addEventListener('click', ()=>{
  const modal = $('#plModal');
  const list  = $('#plList');
  if(!modal || !list) return;
  const items = getAccessiblePlaylist();
  plIndex = 0;
  list.innerHTML = items.length
    ? items.map((s,i)=>`<div class="card" style="margin-top:8px">
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
  const items = getAccessiblePlaylist();
  if (!items.length) return;
  const ids = items
    .map(s => getYouTubeId(s.songUrl || s.danceVideoUrl))
    .filter(Boolean);
  if (!ids.length) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`;
  window.open(url, '_blank');
});
$('#plPrev')?.addEventListener('click', ()=>{
  const items = getAccessiblePlaylist();
  if (!items.length) return;
  plIndex = (plIndex - 1 + items.length) % items.length;
  openAt(plIndex);
});
$('#plNext')?.addEventListener('click', ()=>{
  const items = getAccessiblePlaylist();
  if (!items.length) return;
  plIndex = (plIndex + 1) % items.length;
  openAt(plIndex);
});


/* ====== ACCESSO CATALANO ====== */

function openCatalanoLogin(){
  $('#saggioRequestModal')?.classList.add('hidden');
  $('#saggioLoginModal')?.classList.remove('hidden');
  const err = $('#saggioError');
  if (err) err.classList.add('hidden');
  setTimeout(()=> $('#saggioUser')?.focus(), 30);
}

function closeCatalanoLogin(){
  $('#saggioLoginModal')?.classList.add('hidden');
}

function activateCatalanoCourse(){
  FILTER.course = 'catalano';
  FILTER.year = 'all';
  closeCatalanoLogin();
  syncCourseFilterUI();
  render();
}

function logoutCatalano(){
  window.WSCatalanoSession?.clearLocal();
  FILTER.course = 'line';
  FILTER.year = 'all';
  syncCourseFilterUI();
  render();
}

$('#saggioCloseLogin')?.addEventListener('click', closeCatalanoLogin);

$('#btnCatalanoLogout')?.addEventListener('click', ()=>{
  logoutCatalano();
  window.WSCatalanoSession?.logout();
});

$('#saggioLoginForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  const u = $('#saggioUser')?.value.trim() || '';
  const p = $('#saggioPass')?.value || '';
  const err = $('#saggioError');

  if (!u || !p) {
    if (err) {
      err.textContent = 'Inserisci username e password.';
      err.classList.remove('hidden');
    }
    return;
  }

  try {
    const deviceId = window.WSCatalanoSession?.getDeviceId();
    if (!deviceId) throw new Error('Impossibile riconoscere il dispositivo. Aggiorna la pagina.');
    const res = await fetch('/api/saggio-login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, deviceId })
    });
    const data = await res.json().catch(()=> ({}));
    if (res.ok && data?.ok) {
      const verified = await window.WSCatalanoSession.refresh();
      if (!verified) throw new Error('Sessione non verificata dal server. Riprova.');
      $('#saggioPass').value = '';
      if (err) err.classList.add('hidden');
      activateCatalanoCourse();
    } else if (err) {
      err.textContent = data?.error || 'Credenziali non valide oppure richiesta non ancora approvata.';
      err.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Errore login Catalano', e);
    if (err) {
      err.textContent = 'Impossibile verificare le credenziali. Riprova tra poco.';
      err.classList.remove('hidden');
    }
  }
});

function openCatalanoRequest(){
  closeCatalanoLogin();
  const modal = $('#saggioRequestModal');
  const err = $('#saggioRequestError');
  const status = $('#saggioRequestStatus');
  if (err) err.classList.add('hidden');
  if (status) status.classList.add('hidden');
  modal?.classList.remove('hidden');
  setTimeout(()=> $('#saggioRequestName')?.focus(), 30);
}

function closeCatalanoRequest(){
  $('#saggioRequestModal')?.classList.add('hidden');
}

$('#saggioRequestAccess')?.addEventListener('click', openCatalanoRequest);
$('#saggioCloseRequest')?.addEventListener('click', closeCatalanoRequest);
$('#saggioBackToLogin')?.addEventListener('click', ()=>{
  closeCatalanoRequest();
  openCatalanoLogin();
});

function openCatalanoRequestAck(){
  $('#catalanoRequestAckModal')?.classList.remove('hidden');
  setTimeout(()=> $('#catalanoRequestAckOk')?.focus(), 30);
}

function closeCatalanoRequestAck(){
  $('#catalanoRequestAckModal')?.classList.add('hidden');
}

$('#catalanoRequestAckOk')?.addEventListener('click', closeCatalanoRequestAck);
$('#catalanoRequestAckClose')?.addEventListener('click', closeCatalanoRequestAck);

$('#saggioRequestForm')?.addEventListener('submit', async e=>{
  e.preventDefault();

  const form = e.currentTarget;
  const name = $('#saggioRequestName')?.value.trim() || '';
  const user = $('#saggioRequestUser')?.value.trim() || '';
  const pass = $('#saggioRequestPass')?.value || '';
  const pass2 = $('#saggioRequestPass2')?.value || '';
  const err = $('#saggioRequestError');
  const status = $('#saggioRequestStatus');
  const submitBtn = $('#saggioRequestSubmit');

  if (err) err.classList.add('hidden');
  if (status) status.classList.add('hidden');

  if (!name || user.length < 3 || pass.length < 4) {
    if (err) {
      err.textContent = 'Compila tutti i campi. Username minimo 3 caratteri e password minimo 4.';
      err.classList.remove('hidden');
    }
    return;
  }

  if (!/^[A-Za-z0-9._-]+$/.test(user)) {
    if (err) {
      err.textContent = 'Lo username può contenere solo lettere, numeri, punto, trattino e underscore.';
      err.classList.remove('hidden');
    }
    return;
  }

  if (pass !== pass2) {
    if (err) {
      err.textContent = 'Le due password non coincidono.';
      err.classList.remove('hidden');
    }
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.oldText = submitBtn.textContent;
      submitBtn.textContent = 'Invio…';
    }
    if (status) {
      status.textContent = 'Invio della richiesta in corso…';
      status.classList.remove('hidden');
    }

    const res = await fetch('/api/catalano-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username: user, password: pass })
    });

    const data = await res.json().catch(()=> ({}));

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Invio non riuscito');
    }

    form?.reset();
    if (status) status.classList.add('hidden');
    closeCatalanoRequest();
    openCatalanoRequestAck();
  } catch (ex) {
    console.error('Errore richiesta accesso Catalano', ex);
    if (status) status.classList.add('hidden');
    if (err) {
      err.textContent = ex?.message || 'Non è stato possibile inviare la richiesta. Riprova tra poco.';
      err.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.oldText || 'Invia richiesta';
      delete submitBtn.dataset.oldText;
    }
  }
});

/* ====== FILTRI ====== */
$('#fDance')?.addEventListener('input', debounce(e=>{ FILTER.dance = e.target.value; render(); }));
$('#fSong' )?.addEventListener('input', debounce(e=>{ FILTER.song  = e.target.value; render(); }));

$('.course-tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const course = btn.dataset.course;
    if (course !== 'line' && course !== 'catalano') return;
    if (course === 'catalano') {
      // Validate against Redis before every entrance, not only local browser state.
      const verified = await window.WSCatalanoSession?.refresh();
      if (!verified) {
        openCatalanoLogin();
        return;
      }
    }
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