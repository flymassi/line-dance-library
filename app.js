console.log('[WS] app.js v9');

/* ===== SFONDO ADATTIVO ===== */
(function setAdaptiveBg(){
  const blur = document.getElementById('bg-blur');
  const main = document.getElementById('bg-main');

  function pickUrl(){ return `./assets/images/background/${Math.floor(Math.random()*10)+1}.png`; }
  function isLightImage(img){
    try{
      const w=24,h=24,c=document.createElement('canvas'); c.width=w;c.height=h;
      const g=c.getContext('2d'); g.drawImage(img,0,0,w,h);
      const d=g.getImageData(0,0,w,h).data; let s=0,p=w*h;
      for(let i=0;i<d.length;i+=4){ s+=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }
      return s/p>160;
    }catch{return false}
  }

  const url = pickUrl(), img=new Image();
  img.onload=()=>{
    const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
    function apply(){
      const rImg=iw/ih, rScr=innerWidth/innerHeight;
      const useContain = Math.abs(Math.log(rImg)-Math.log(rScr))>0.35;
      if(blur){ blur.style.backgroundImage=`url('${url}')`; blur.style.backgroundSize='cover'; }
      if(main){ main.style.backgroundImage=`url('${url}')`; main.style.backgroundSize=useContain?'contain':'cover'; }
      document.body.classList.toggle('bg-light', isLightImage(img));
    }
    apply(); addEventListener('resize',apply); addEventListener('orientationchange',apply);
  };
  img.src=url;
})();

/* ===== COPERTINE ===== */
const ART_CACHE = new Map();
const ytIdFromUrl=u=>{try{const x=new URL(u);if(x.hostname.includes('youtube.com'))return x.searchParams.get('v');if(x.hostname.includes('youtu.be'))return x.pathname.slice(1);}catch{}return null}
const youtubeThumbPair=u=>{const id=ytIdFromUrl(u);return id?{small:`https://img.youtube.com/vi/${id}/mqdefault.jpg`,large:`https://img.youtube.com/vi/${id}/hqdefault.jpg`}:null}
async function fetchArtworkPair(singer,song){
  const key=`${singer}|||${song}`.toLowerCase(); if(ART_CACHE.has(key)) return ART_CACHE.get(key);
  const url=`https://itunes.apple.com/search?term=${encodeURIComponent(`${singer} ${song}`)}&country=IT&media=music&entity=song&limit=1`;
  try{
    const r=await fetch(url,{mode:'cors'}), j=await r.json(); const a=j?.results?.[0]?.artworkUrl100;
    if(a){ const pair={small:a,large:a.replace(/100x100bb\.jpg/i,'600x600bb.jpg')}; ART_CACHE.set(key,pair); return pair; }
  }catch(e){ console.warn('Artwork iTunes fallita:',e); }
  ART_CACHE.set(key,null); return null;
}

/* ===== LISTA BRANI ===== */
const cards=document.getElementById('cards'), fDance=document.getElementById('fDance'),
      fSong=document.getElementById('fSong'), clearBt=document.getElementById('clearFilters'),
      countEl=document.getElementById('count'), fxCrack=document.getElementById('fxCrack');

let SONGS=[], FILTERS={dance:'',song:''};

fetch('./data/songs.json?v='+Date.now())
  .then(r=>r.json()).then(j=>{SONGS=j; render();})
  .catch(e=>{console.error('Errore JSON',e); cards.innerHTML='<p style="color:#fff">Errore nel caricamento dei dati.</p>';});

fDance?.addEventListener('input',()=>{FILTERS.dance=fDance.value; render();});
fSong ?.addEventListener('input',()=>{FILTERS.song =fSong.value ; render();});
clearBt?.addEventListener('click',()=>{fDance.value=''; fSong.value=''; FILTERS={dance:'',song:''}; render();});

addEventListener('pointerdown',e=>{ if(e.target.closest('a.action')){ try{fxCrack.cloneNode(true).play().catch(()=>{});}catch{} } },{passive:true});

const esc=s=>(s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
function matches(it){
  const d=(FILTERS.dance||'').toLowerCase().trim(), s=(FILTERS.song||'').toLowerCase().trim();
  return (!d||(it.danceTitle||'').toLowerCase().includes(d)) && (!s||(it.songTitle||'').toLowerCase().includes(s));
}

function setupRevealAnimations(){
  const els=document.querySelectorAll('#cards .card');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!('IntersectionObserver'in window)){ els.forEach(el=>el.classList.remove('reveal')); return; }
  const io=new IntersectionObserver((ents,obs)=>{ents.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in'); obs.unobserve(en.target);}})},{rootMargin:'0px 0px -10% 0px',threshold:.05});
  els.forEach((el,i)=>{el.classList.add('reveal'); el.style.transitionDelay=`${Math.min(i*40,240)}ms`; io.observe(el);});
}

function renderCard(it){
  const id=`cov_${Math.random().toString(36).slice(2)}`;
  const video = it.danceVideoUrl?`<a class="action" href="${esc(it.danceVideoUrl)}" target="_blank" rel="noopener">Apri Ballo</a>`:'';
  const song  = it.songUrl      ?`<a class="action" href="${esc(it.songUrl)}"       target="_blank" rel="noopener">Apri Canzone</a>`:'';
  const year=(it.year??'-')+'';

  queueMicrotask(async()=>{
    let pair=await fetchArtworkPair(it.singerName,it.songTitle);
    if(!pair) pair=youtubeThumbPair(it.songUrl)||youtubeThumbPair(it.danceVideoUrl);
    const img=document.getElementById(id); if(!img) return;
    if(pair?.small) img.src=pair.small;
    if(pair?.large){ const hi=new Image(); hi.onload=()=>{img.src=pair.large; img.classList.add('is-ready');}; hi.src=pair.large; }
    else img.classList.add('is-ready');
  });

  return `
  <article class="card">
    <div class="card-row">
      <img id="${id}" class="card-cover" alt="Copertina" src="" />
      <div class="card-col">
        <h3 class="card-title">${esc(it.danceTitle)}</h3>
        <div class="card-meta">${esc(it.singerName)} — ${esc(it.songTitle)}</div>
      </div>
      <div class="year-badge" aria-label="Anno">
        <div class="yb-label">Anno</div>
        <div class="yb-num">${esc(year)}</div>
      </div>
    </div>
    <div class="actions">${video}${song}</div>
  </article>`;
}

function render(){
  const list=SONGS.filter(matches);
  countEl.textContent=`Brani trovati: ${list.length}`;
  cards.innerHTML=list.map(renderCard).join('')||'<p style="color:#fff">Nessun risultato coi filtri.</p>';
  setupRevealAnimations();
}

/* ===== AGGIORNA APP ===== */
document.getElementById('updateApp')?.addEventListener('click', async ()=>{
  try{
    if('serviceWorker'in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches'in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(e){console.warn('Reset cache errore:',e)}
  location.href=location.pathname+'?fresh='+Date.now();
});

/* ===== PUZZLE ===== */
const pzOverlay=document.getElementById('puzzleOverlay');
const pzGrid   =document.getElementById('pzGrid');
const pzImg    =document.getElementById('pzImg');
const pzBlur   =document.getElementById('pzBlur');
const pzQuestion=document.getElementById('pzQuestion');
const pzAnswers =document.getElementById('pzAnswers');
const pzNo      =document.getElementById('pzNo');
const pzBravo   =document.getElementById('pzBravo');
const pzQuit    =document.getElementById('pzQuit');
const pzCloseTop=document.getElementById('pzClose');
const pzTime    =document.getElementById('pzTime');
const pzProgress=document.getElementById('pzProgress');
const diffBtns  =Array.from(document.querySelectorAll('.diff-btn'));

document.getElementById('openPuzzle')?.addEventListener('click', openPuzzle);
pzCloseTop?.addEventListener('click', closePuzzle);
pzQuit?.addEventListener('click', closePuzzle);
addEventListener('keydown',e=>{ if(e.key==='Escape'&&!pzOverlay.classList.contains('hidden')) closePuzzle(); });

const fxCorrect=document.getElementById('fxCorrect');
const fxWrong  =document.getElementById('fxWrong');
const fxWin    =document.getElementById('fxWin');

let GRID=4;
let PZ={order:[],revealed:new Set()};
let timerId=null, tStart=0, revealedCount=0;

const rint=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

function pickImage(){
  const idx=rint(1,27); const url=`./assets/images/puzzles/${idx}.png`;
  if(pzImg)  pzImg.src=url;
  if(pzBlur) pzBlur.style.backgroundImage=`url('${url}')`;
}
function buildTiles(){
  pzGrid.innerHTML=''; PZ.revealed.clear(); revealedCount=0;
  const tot=GRID*GRID; PZ.order=shuffle([...Array(tot).keys()]);
  for(let i=0;i<tot;i++){ const d=document.createElement('div'); d.className='pz-tile'; d.dataset.id=i; pzGrid.appendChild(d); }
  updateProgress();
}
function revealOne(){
  const next=PZ.order.find(id=>!PZ.revealed.has(id)); if(next==null) return;
  PZ.revealed.add(next); revealedCount++;
  pzGrid.querySelector(`.pz-tile[data-id="${next}"]`)?.classList.add('revealed');
  updateProgress();
  if(revealedCount>=GRID*GRID) onWin();
}
function updateProgress(){ if(pzProgress) pzProgress.textContent = `${revealedCount}/${GRID*GRID}`; }
function startTimer(){
  stopTimer(); tStart=Date.now();
  timerId=setInterval(()=>{ const s=Math.floor((Date.now()-tStart)/1000);
    const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0');
    pzTime.textContent=`${mm}:${ss}`; },250);
}
function stopTimer(){ if(timerId){clearInterval(timerId); timerId=null;} }

function makeQuestion(){
  if(!SONGS.length) return {text:'Dati non disponibili',choices:['-','-','-','-'],ok:0};
  const right=SONGS[rint(0,SONGS.length-1)];
  const type=Math.random()<0.5?'singerName':'danceTitle';
  const text= type==='singerName' ? `Chi è il cantante di “${right.songTitle}”?`
                                   : `Qual è il titolo del ballo per “${right.songTitle}”?`;
  const correct=right[type]||'-';
  const used=new Set([(correct||'').toLowerCase()]); const opts=[correct];
  shuffle(SONGS.slice()).some(it=>{
    const v=(it[type]||'').toString().trim(); if(!v) return false;
    const k=v.toLowerCase(); if(used.has(k)) return false;
    used.add(k); opts.push(v); return opts.length>=4;
  });
  while(opts.length<4) opts.push('—');
  const choices=shuffle(opts.slice(0,4)); const ok=choices.findIndex(x=>x===correct);
  return {text,choices,ok};
}
function renderQuestion(){
  const q=makeQuestion(); pzQuestion.textContent=q.text; pzAnswers.innerHTML='';
  q.choices.forEach((label,idx)=>{
    const b=document.createElement('button'); b.className='btn'; b.style.background='var(--brand)'; b.style.color='#fff';
    b.textContent=label||'—';
    b.addEventListener('click',()=>{ if(idx===q.ok){ try{fxCorrect.play().catch(()=>{});}catch{} revealOne(); } else { showNo(); }
      setTimeout(renderQuestion,550); });
    pzAnswers.appendChild(b);
  });
}
function showNo(){ pzNo.classList.remove('hidden'); try{fxWrong.play().catch(()=>{});}catch{} setTimeout(()=>pzNo.classList.add('hidden'),900); }
function onWin(){ stopTimer(); try{fxWin.play().catch(()=>{});}catch{} pzImg?.classList.add('pz-complete'); setTimeout(()=>pzImg?.classList.remove('pz-complete'),1000); pzBravo.classList.remove('hidden'); }
function startGame(){
  pzBravo.classList.add('hidden'); pickImage();
  pzGrid.style.gridTemplateColumns=`repeat(${GRID},1fr)`; pzGrid.style.gridTemplateRows=`repeat(${GRID},1fr)`;
  buildTiles(); renderQuestion(); updateProgress(); startTimer();
}
function openPuzzle(){ const active=document.querySelector('.diff-btn.active'); GRID=Number(active?.dataset.grid||'4'); startGame(); pzOverlay.classList.remove('hidden'); pzOverlay.setAttribute('aria-hidden','false'); }
function closePuzzle(){ stopTimer(); pzOverlay.classList.add('hidden'); pzOverlay.setAttribute('aria-hidden','true'); }

diffBtns.forEach(btn=>{
  btn.addEventListener('click',()=>{
    diffBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    if(!pzOverlay.classList.contains('hidden')){ GRID=Number(btn.dataset.grid||'4'); startGame(); }
  });
});
