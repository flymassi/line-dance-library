/* Western Spritz — Duello tra Cowboy v1 */
(() => {
  const BUTTON = `<button id="btnDuel" class="btn btn-glass btn-amber btn-slim duel-trigger" type="button" aria-label="Duello tra Cowboy"><span class="btn-icon">⚔️</span><span class="btn-label">Duello</span></button>`;
  const ARENA_BUTTON = `<button id="btnDuelArena" class="btn btn-glass btn-slim duel-arena-trigger" type="button" aria-label="Apri Arena dei Cowboy"><span class="btn-icon">🏟️</span><span class="btn-label">Arena</span></button>`;
  const MODAL = `
  <div id="duelModal" class="overlay hidden" aria-hidden="true">
    <div class="pl-card duel-card" role="dialog" aria-modal="true" aria-labelledby="duelTitle">
      <div class="pl-top duel-top">
        <div><span class="duel-eyebrow">WESTERN SPRITZ • HEAD TO HEAD</span><h3 id="duelTitle">⚔️ Duello tra Cowboy</h3><p>Due cowboy. Stesse cinque domande. Un solo vincitore.</p></div>
        <button id="duelClose" class="btn ghost" type="button">Chiudi</button>
      </div>
      <div class="duel-top-tabs"><button id="duelTabGame" class="duel-top-tab active" type="button">⚔️ Duello</button><button id="duelTabArena" class="duel-top-tab" type="button">🏆 Arena dei Cowboy</button></div>
      <div id="duelError" class="duel-error hidden" role="alert"></div>
      <section id="duelWelcome" class="duel-panel">
        <div class="duel-welcome-icon" aria-hidden="true">🤠 ⚡ 🤠</div>
        <h4>Sfida un amico!</h4>
        <p>Una partita per ciascuno, cinque domande sui balli Western Spritz e 15 secondi per risposta. Vince chi conquista più punti.</p>
        <fieldset class="duel-privacy-choices"><legend>Chi potrà vedere il risultato?</legend>
          <label class="duel-privacy-option"><input type="radio" name="duelVisibility" value="private" checked /><span><strong>🔒 Privato</strong><small>Risultato consultabile solo dai due partecipanti, su questo dispositivo.</small></span></label>
          <label class="duel-privacy-option"><input type="radio" name="duelVisibility" value="public" /><span><strong>🏆 Pubblico</strong><small>Al termine, nickname e punteggi nell'Arena; vittorie nella classifica.</small></span></label>
        </fieldset>
        <label class="duel-label" for="duelNickname">Come vuoi comparire?</label>
        <div class="duel-form-row"><input id="duelNickname" class="input" type="text" maxlength="18" autocomplete="nickname" placeholder="Il tuo nickname"/><button id="duelCreate" class="btn btn-primary" type="button">Crea duello ⚔️</button></div>
        <p class="duel-muted">Riceverai un link da inviare su WhatsApp. Non serve registrarsi.</p>
      </section>
      <section id="duelInvite" class="duel-panel hidden">
        <div class="duel-kicker">📨 HAI RICEVUTO UNA SFIDA</div>
        <h4 id="duelInviteTitle">Un cowboy ti aspetta!</h4>
        <p>Accetta il duello: giocherai le stesse domande del tuo avversario.</p>
        <p id="duelInvitePrivacy" class="duel-privacy-notice"></p>
        <div id="duelGuestForm">
        <label class="duel-label" for="duelGuestNickname">Il tuo nickname</label>
        <div class="duel-form-row"><input id="duelGuestNickname" class="input" maxlength="18" autocomplete="nickname" placeholder="Il tuo nickname"/><button id="duelJoin" class="btn btn-primary" type="button">Accetta il duello</button></div>
        <p class="duel-muted">Il link può essere utilizzato solo da un secondo giocatore. Puoi riprendere il duello da questo dispositivo.</p>
        </div>
      </section>
      <section id="duelLobby" class="duel-panel hidden">
        <div class="duel-kicker" id="duelLobbyKicker">🤠 SFIDA CREATA!</div>
        <div id="duelLobbyPrivacy" class="duel-privacy-notice"></div>
        <div class="duel-vs"><div><span>🤠</span><strong id="duelHostName">Cowboy 1</strong><small id="duelHostStatus">Pronto</small></div><b>VS</b><div><span>🤠</span><strong id="duelGuestName">In attesa…</strong><small id="duelGuestStatus">Invita un amico</small></div></div>
        <div id="duelShareArea" class="duel-share">
          <label class="duel-label" for="duelLink">Il link del tuo duello</label>
          <input id="duelLink" class="input duel-link" type="text" readonly aria-label="Link da condividere" />
          <div class="duel-buttons"><button id="duelCopy" class="btn ghost" type="button">📋 Copia link</button><button id="duelWhatsApp" class="btn btn-primary" type="button">🟢 Sfida su WhatsApp</button></div>
        </div>
        <p class="duel-muted">Puoi giocare subito oppure aspettare il tuo amico. Il duello resta disponibile per sette giorni.</p>
        <div class="duel-buttons"><button id="duelStart" class="btn btn-primary" type="button">🎯 Inizia le 5 domande</button><button id="duelRefresh" class="btn ghost" type="button">↻ Aggiorna</button><button id="duelLobbyNew" class="btn ghost" type="button">Nuovo duello</button></div>
      </section>
      <section id="duelQuiz" class="duel-panel hidden">
        <div class="duel-quiz-bar"><span id="duelProgress">DOMANDA 1 / 5</span><div><strong id="duelTimer">15</strong><small> secondi</small></div><div><strong id="duelScore">0</strong><small> punti</small></div></div>
        <div class="duel-clock-track"><div id="duelClockFill"></div></div>
        <h4 id="duelQuestion">Pronto?</h4>
        <div id="duelAnswers" class="duel-answers"></div>
        <div id="duelFeedback" class="duel-feedback" aria-live="polite"></div>
      </section>
      <section id="duelResults" class="duel-panel hidden">
        <div id="duelResultKicker" class="duel-kicker">RISULTATI</div>
        <div id="duelResultPrivacy" class="duel-privacy-notice"></div>
        <h4 id="duelResultHeading">Duello completato</h4>
        <div class="duel-vs duel-results-vs"><div><span>🤠</span><strong id="duelResultHost">Cowboy 1</strong><b id="duelResultHostScore">—</b></div><b>VS</b><div><span>🤠</span><strong id="duelResultGuest">Cowboy 2</strong><b id="duelResultGuestScore">—</b></div></div>
        <p id="duelResultNote" class="duel-result-note">In attesa del secondo giocatore.</p>
        <div id="duelResultInviteArea" class="duel-share hidden">
          <label class="duel-label" for="duelResultLink">Invita ora il tuo avversario</label>
          <input id="duelResultLink" class="input duel-link" readonly />
          <div class="duel-buttons"><button id="duelResultCopy" class="btn ghost" type="button">📋 Copia link</button><button id="duelResultWhatsApp" class="btn btn-primary" type="button">🟢 Sfida su WhatsApp</button></div>
        </div>
        <div class="duel-buttons"><button id="duelResultRefresh" class="btn ghost" type="button">↻ Aggiorna risultati</button><button id="duelShareResult" class="btn btn-primary hidden" type="button">🟢 Condividi risultato</button><button id="duelNew" class="btn ghost" type="button">Nuovo duello</button></div>
      </section>
      <section id="duelArena" class="duel-panel hidden" aria-label="Arena dei Cowboy">
        <div class="duel-kicker">🏆 WESTERN SPRITZ ARENA</div>
        <h4>La gloria del West!</h4>
        <p>Qui compaiono <strong>solo i duelli pubblici conclusi</strong>. I duelli privati e le statistiche della Challenge giornaliera rimangono separati.</p>
        <div class="duel-arena-grid">
          <div class="duel-arena-box"><div class="duel-arena-title">🥇 Classifica delle vittorie</div><div id="duelArenaLeaders" class="duel-arena-list"><p class="duel-muted">Caricamento…</p></div></div>
          <div class="duel-arena-box"><div class="duel-arena-title">⚔️ Ultimi duelli pubblici</div><div id="duelArenaRecent" class="duel-arena-list"><p class="duel-muted">Caricamento…</p></div></div>
        </div>
        <p class="duel-muted">I risultati pubblici recenti restano nell'Arena per 45 giorni. La classifica delle vittorie è cumulativa. In caso di parità si confrontano risposte corrette e tempo.</p>
        <div class="duel-buttons"><button id="duelArenaReload" class="btn ghost" type="button">↻ Aggiorna Arena</button><button id="duelArenaBack" class="btn btn-primary" type="button">⚔️ Torna al duello</button></div>
      </section>
    </div>
  </div>`;

  const css = document.createElement('link'); css.rel='stylesheet'; css.href='./duel.css?v=3'; css.dataset.wsDuelCss='1';
  if (!document.querySelector('link[data-ws-duel-css]')) document.head.appendChild(css);
  const actions=document.querySelector('.actions-top');
  if (actions && !document.getElementById('btnDuel')) {
    const holder=document.createElement('div');holder.innerHTML=BUTTON.trim();
    actions.insertBefore(holder.firstElementChild,document.getElementById('btnPlaylist')||null);
  }
  if (actions && !document.getElementById('btnDuelArena')) {
    const holder=document.createElement('div');holder.innerHTML=ARENA_BUTTON.trim();
    actions.insertBefore(holder.firstElementChild,document.getElementById('btnPlaylist')||null);
  }
  if (!document.getElementById('duelModal')) {
    const holder=document.createElement('div');holder.innerHTML=MODAL.trim();document.body.appendChild(holder.firstElementChild);
  }
  const $=id=>document.getElementById(id);
  const modal=$('duelModal'); if(!modal) return;
  const KEY='ws_challenge_device_v1',NICK='ws_challenge_nickname_v1',LAST='ws_duel_last_id_v2';
  let duelId='',info=null,submitting=false,timer=null,poller=null,deadline=0,active=false;
  const fmt=n=>Math.round(Number(n||0)).toLocaleString('it-IT');
  const text=(id,value)=>{const e=$(id);if(e)e.textContent=String(value??'');};
  const show=(id,on)=>$(id)?.classList.toggle('hidden',!on);
  function nickname(){return String($('duelNickname').value||'').trim();}
  function validNick(value){return value.length>=2 && value.length<=18;}
  function saveNickname(value){try{localStorage.setItem(NICK,value);}catch{}}
  function getNickname(){try{return localStorage.getItem(NICK)||'';}catch{return '';}}
  function saveLastId(id){try{localStorage.setItem(LAST,id);}catch{}}
  function getLastId(){try{return localStorage.getItem(LAST)||'';}catch{return '';}}
  function clearLastId(){try{localStorage.removeItem(LAST);}catch{}}
  function deviceId(){
    let id='';try{id=localStorage.getItem(KEY)||'';}catch{}
    if(/^[a-f0-9]{32,64}$/.test(id))return id;
    const values=new Uint8Array(20);crypto.getRandomValues(values);
    id=[...values].map(x=>x.toString(16).padStart(2,'0')).join('');
    try{localStorage.setItem(KEY,id);}catch{}
    return id;
  }
  function error(message){text('duelError',message);show('duelError',!!message);}
  function stopTimer(){if(timer){clearInterval(timer);timer=null;}}
  function stopPoll(){if(poller){clearInterval(poller);poller=null;}}
  function panels(section){
    for(const id of ['duelWelcome','duelInvite','duelLobby','duelQuiz','duelResults','duelArena'])show(id,id===section);
    $('duelTabGame').classList.toggle('active',section!=='duelArena');
    $('duelTabArena').classList.toggle('active',section==='duelArena');
    error('');
  }
  function isPublic(){return info?.duel?.visibility === 'public';}
  function privacyText(){return isPublic()
    ? '🏆 PUBBLICO — Accettando, autorizzi la pubblicazione di nickname, punteggi e vincitore nell’Arena al termine del duello.'
    : '🔒 PRIVATO — Il risultato sarà visibile soltanto ai due giocatori dal proprio dispositivo.';}
  function item(tag,className,value){const el=document.createElement(tag);if(className)el.className=className;el.textContent=String(value??'');return el;}
  async function loadArena(){
    try {
      const data=await request('/api/duel?action=arena');
      const leaders=$('duelArenaLeaders'),recent=$('duelArenaRecent');
      leaders.replaceChildren();recent.replaceChildren();
      if(!data.leaderboard?.length) leaders.appendChild(item('p','duel-muted','Ancora nessun campione. Apri le danze!'));
      else data.leaderboard.forEach(row=>{
        const div=item('div','duel-arena-entry','');
        const title=item('span','',''+(row.rank===1?'🥇':row.rank===2?'🥈':row.rank===3?'🥉':row.rank+'.')+' '+row.nickname);
        const value=item('strong','',row.wins+' '+(row.wins===1?'vittoria':'vittorie'));
        div.append(title,value);leaders.appendChild(div);
      });
      if(!data.recent?.length) recent.appendChild(item('p','duel-muted','Nessun duello pubblico concluso.'));
      else data.recent.forEach(row=>{
        const div=item('div','duel-arena-match','');
        const winner=row.winner==='tie'?'🤝 Pareggio':`🏆 Vince ${(row.winner==='host'?row.host:row.guest)?.nickname||'Cowboy'}`;
        const main=item('strong','',`${row.host.nickname} ${fmt(row.host.score)} — ${fmt(row.guest.score)} ${row.guest.nickname}`);
        const detail=item('small','',winner);
        div.append(main,detail);recent.appendChild(div);
      });
    } catch(e){error(e.message);}
  }
  function openArena(){
    active=true;stopTimer();stopPoll();modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
    panels('duelArena');loadArena();
  }
  function backFromArena(){
    const id=duelId||getLastId();if(/^[a-f0-9]{20}$/.test(id))open(id);
    else {panels('duelWelcome');$('duelNickname').value=getNickname();}
  }
  function shareUrl(){const url=new URL(location.href);url.searchParams.set('duel',duelId);url.hash='';return url.toString();}
  async function request(url,params){const r=await fetch(url,{cache:'no-store',...(params?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}:{})});let d={};try{d=await r.json();}catch{}if(!r.ok||!d.ok)throw new Error(d.error||'Impossibile contattare il server.');return d;}
  async function post(action,extra={}){return request('/api/duel',{action,id:duelId,deviceId:deviceId(),...extra});}
  function publicStatus(player){return !player?'In attesa':player.status==='finished'?'Ha completato':player.status==='playing'?'Sta giocando':'Pronto';}
  function updateVersus(){
    if(!info)return;
    text('duelHostName',info.duel.host?.nickname||'Cowboy 1');text('duelGuestName',info.duel.guest?.nickname||'In attesa…');
    text('duelHostStatus',publicStatus(info.duel.host));text('duelGuestStatus',info.duel.guest?publicStatus(info.duel.guest):'Invita un amico');
  }
  function enterWelcome(){stopTimer();stopPoll();clearLastId();duelId='';info=null;const url=new URL(location.href);url.searchParams.delete('duel');history.replaceState({},'',url.toString());$('duelNickname').value=getNickname();panels('duelWelcome');}
  function renderQuiz(){
    const me=info.me,q=me?.question;
    if(!q){render();return;}
    panels('duelQuiz');
    text('duelProgress',`DOMANDA ${me.currentIndex+1} / ${info.duel.questionCount}`);
    text('duelQuestion',q.prompt);text('duelScore',fmt(me.score));text('duelFeedback','');
    const answers=$('duelAnswers');answers.replaceChildren();
    q.options.forEach((option,index)=>{
      const b=document.createElement('button');b.type='button';b.className='duel-answer';b.textContent=option;
      b.addEventListener('click',()=>answer(index));answers.appendChild(b);
    });
    stopTimer();deadline=Date.now()+Number(me.remainingMs||0);
    const tick=()=>{
      const remaining=Math.max(0,deadline-Date.now());
      text('duelTimer',Math.ceil(remaining/1000));
      $('duelClockFill').style.width=`${100*remaining/(info.duel.questionSeconds*1000)}%`;
      if(remaining<=0){stopTimer();answer(null);}
    };
    tick();if(deadline>Date.now())timer=setInterval(tick,200);
  }
  function renderResults(){
    const {duel,me}=info;
    panels('duelResults');
    const complete=duel.status==='finished';
    text('duelResultPrivacy',privacyText());
    text('duelResultHost',duel.host?.nickname||'Cowboy 1');
    text('duelResultGuest',duel.guest?.nickname||'In attesa…');
    text('duelResultHostScore',complete?fmt(duel.host.score):me?.role==='host'?fmt(me.score):'—');
    text('duelResultGuestScore',complete?fmt(duel.guest.score):me?.role==='guest'?fmt(me.score):'—');
    if(complete){
      const winner=duel.winner;
      text('duelResultKicker',winner==='tie'?'🤝 PARITÀ':'🏆 DUELLO CONCLUSO');
      text('duelResultHeading',winner==='tie'?'Pareggio!':`${(winner==='host'?duel.host:duel.guest).nickname} conquista il West!`);
      const time=winner==='tie'?'Punteggio, risposte corrette e tempo identici.':'In caso di pari punti, contano risposte corrette e tempo.';
      text('duelResultNote',`${duel.host.correct}/5 corrette contro ${duel.guest.correct}/5. ${time}`);
    }else{
      text('duelResultKicker','⏳ IN ATTESA');text('duelResultHeading','Hai concluso il tuo duello!');
      text('duelResultNote',`Il tuo risultato: ${fmt(me?.score)} punti, ${me?.correct||0}/5 corrette. ${!duel.guest?'Invita un amico per completare la sfida.':'L’avversario deve ancora terminare la propria partita.'}`);
    }
    show('duelResultInviteArea',!complete&&me?.role==='host'&&!duel.guest);
    if(!complete&&me?.role==='host'&&!duel.guest)$('duelResultLink').value=shareUrl();
    show('duelShareResult',complete);
    show('duelResultRefresh',!complete);
    stopPoll();if(!complete)poller=setInterval(()=>{if(active)refresh(false);},9000);
  }
  function render(){
    stopTimer();stopPoll();if(!info){enterWelcome();return;}
    const {duel,me}=info;
    if(!me && duel.visibility==='public' && duel.status==='finished') {renderResults();return;}
    if(!me){
      text('duelInvitePrivacy',privacyText());
      show('duelGuestForm',duel.status!=='full');
      text('duelInviteTitle',duel.status==='full'?'Questo duello ha già due partecipanti.':`${duel.host?.nickname||'Un cowboy'} ti sfida!`);
      $('duelGuestNickname').value=getNickname();panels('duelInvite');return;
    }
    if(me.status==='playing'){renderQuiz();return;}
    if(me.status==='finished'){renderResults();return;}
    panels('duelLobby');updateVersus();
    text('duelLobbyKicker',me.role==='host'?'🤠 DUELLO CREATO!':'⚔️ SFIDA ACCETTATA!');
    text('duelLobbyPrivacy',privacyText());
    $('duelLink').value=shareUrl();show('duelShareArea',me.role==='host');
    text('duelStart', '🎯 Inizia le 5 domande');
    poller=setInterval(()=>{if(active)refresh(false);},11000);
  }
  async function refresh(showErrors=true){
    if(!duelId||submitting)return;
    try{const next=await request(`/api/duel?id=${encodeURIComponent(duelId)}&deviceId=${encodeURIComponent(deviceId())}`);
      if(!active)return;
      const old=info?.duel?.status;
      info=next;
      // Non interrompere il timer durante il semplice polling delle domande.
      if(info.me?.status==='playing'&&$('duelQuiz')&&!$('duelQuiz').classList.contains('hidden'))return;
      if(info.me?.status==='ready'&&old===info.duel.status&&!$('duelLobby').classList.contains('hidden')){updateVersus();return;}
      render();
    }catch(e){
      if(/non è più disponibile|non valido/.test(e.message)){enterWelcome();error(e.message);}
      else if(showErrors)error(e.message);
    }
  }
  function open(id=''){
    active=true;
    if(!id&&!duelId){const last=getLastId();if(/^[a-f0-9]{20}$/.test(last))id=last;}modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
    if(id){duelId=id;info=null;panels('duelLobby');text('duelLobbyKicker','Caricamento duello…');refresh();}
    else if(duelId)refresh();
    else enterWelcome();
  }
  function close(){active=false;stopTimer();stopPoll();modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');}
  async function create(){const name=nickname();if(!validNick(name))return error('Inserisci un nickname di 2–18 caratteri.');
    const button=$('duelCreate');button.disabled=true;error('');
    try{saveNickname(name);const visibility=document.querySelector('input[name=duelVisibility]:checked')?.value||'private';info=await post('create',{nickname:name,visibility});duelId=info.duel.id;saveLastId(duelId);render();}
    catch(e){error(e.message);}finally{button.disabled=false;}
  }
  async function join(){const name=String($('duelGuestNickname').value||'').trim();if(!validNick(name))return error('Inserisci un nickname di 2–18 caratteri.');
    const button=$('duelJoin');button.disabled=true;error('');
    try{saveNickname(name);info=await post('join',{nickname:name});saveLastId(duelId);render();}
    catch(e){error(e.message);}finally{button.disabled=false;}
  }
  async function start(){const button=$('duelStart');button.disabled=true;error('');
    try{info=await post('start');render();}
    catch(e){error(e.message);}finally{button.disabled=false;}
  }
  async function answer(index){
    if(submitting||!info?.me?.question)return;
    submitting=true;stopTimer();
    $('duelAnswers').querySelectorAll('button').forEach(b=>b.disabled=true);
    const questionId=info.me.question.id;
    text('duelFeedback','Risposta inviata…');
    try{
      const next=await post('answer',{questionId,answerIndex:index});
      info=next;
      const note=next.notice||{};
      text('duelFeedback',note.correct?`✅ Corretto! +${fmt(note.gained)} punti`:`❌ Risposta corretta: ${note.correctAnswer||'—'}`);
      setTimeout(()=>{submitting=false;if(active)render();},850);
    }catch(e){submitting=false;error(e.message);await refresh(false);}
  }
  async function copyLink(resultMode=false){const url=shareUrl(),id=resultMode?'duelResultCopy':'duelCopy';try{await navigator.clipboard.writeText(url);text(id,'✅ Copiato!');setTimeout(()=>text(id,'📋 Copia link'),1600);}catch{const input=$(resultMode?'duelResultLink':'duelLink');input.focus();input.select();try{document.execCommand('copy');text(id,'✅ Copiato!');}catch{error('Seleziona e copia il link qui sopra.');}}}
  function openWhatsApp(value){window.open(`https://wa.me/?text=${encodeURIComponent(value)}`,'_blank','noopener,noreferrer');}
  function shareInvite(){if(!duelId)return;openWhatsApp(`⚔️ Ti sfido a un duello su Western Spritz! 🤠 5 domande, stesso quiz e un vincitore. Accetta qui: ${shareUrl()}`);}
  function shareResult(){if(info?.duel?.status!=='finished')return;
    const d=info.duel,winner=d.winner==='tie'?'Pareggio!':`Vince ${d.winner==='host'?d.host.nickname:d.guest.nickname}!`;
    openWhatsApp(`⚔️ DUELLO WESTERN SPRITZ 🤠\n${d.host.nickname}: ${fmt(d.host.score)} punti\n${d.guest.nickname}: ${fmt(d.guest.score)} punti\n🏆 ${winner}\n${shareUrl()}`);
  }
  $('btnDuel')?.addEventListener('click',()=>open(duelId));
  $('btnDuelArena')?.addEventListener('click',openArena);
  $('duelTabArena').addEventListener('click',openArena);
  $('duelTabGame').addEventListener('click',backFromArena);
  $('duelArenaReload').addEventListener('click',loadArena);
  $('duelArenaBack').addEventListener('click',backFromArena);
  $('duelClose').addEventListener('click',close);
  $('duelModal').addEventListener('click',e=>{if(e.target===modal)close();});
  $('duelCreate').addEventListener('click',create);
  $('duelJoin').addEventListener('click',join);
  $('duelStart').addEventListener('click',start);
  $('duelRefresh').addEventListener('click',()=>refresh());
  $('duelResultRefresh').addEventListener('click',()=>refresh());
  $('duelCopy').addEventListener('click',()=>copyLink(false));
  $('duelResultCopy').addEventListener('click',()=>copyLink(true));
  $('duelResultWhatsApp').addEventListener('click',shareInvite);
  $('duelLobbyNew').addEventListener('click',enterWelcome);
  $('duelWhatsApp').addEventListener('click',shareInvite);
  $('duelShareResult').addEventListener('click',shareResult);
  $('duelNew').addEventListener('click',enterWelcome);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden||!active)return; if(!$('duelArena').classList.contains('hidden'))loadArena();else if(duelId)refresh(false);});
  const initialId=new URL(location.href).searchParams.get('duel')||'';
  if(/^[a-f0-9]{20}$/.test(initialId)){
    const launch=()=>setTimeout(()=>{if(!active)open(initialId);},100);
    $('startApp')?.addEventListener('click',launch,{once:true});
    $('startApp')?.addEventListener('pointerup',launch,{once:true});
    if(document.body.classList.contains('ws-started'))launch();
  }
})();
