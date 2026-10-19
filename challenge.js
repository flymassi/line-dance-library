/* Western Spritz Challenge v2 */
const BUTTON_HTML = `
<button id="btnChallenge" class="btn btn-glass btn-amber btn-slim challenge-btn-featured" type="button" aria-label="Apri Western Spritz Challenge">
  <span class="btn-icon">🏆</span><span class="btn-label">Sfida</span>
</button>`;

const MODAL_HTML = `
<div id="challengeModal" class="overlay hidden" aria-hidden="true">
  <div class="pl-card challenge-card" role="dialog" aria-modal="true" aria-labelledby="challengeTitle">
    <div class="pl-top challenge-top">
      <div><h3 id="challengeTitle">🏆 Western Spritz Challenge</h3><p class="challenge-subtitle">Gioca, scala i livelli e conquista i trofei</p></div>
      <button id="challengeClose" class="btn ghost" type="button">Chiudi</button>
    </div>

    <section id="challengeHome">
      <div class="challenge-home-grid">
        <div class="challenge-panel">
          <div class="challenge-hero-row">
            <div><h4>🤠 Sfida del giorno</h4><p class="challenge-note">10 domande • 15 secondi • un tentativo ufficiale al giorno</p></div>
            <div class="challenge-count"><small>Partecipanti oggi</small><strong id="challengePlayersToday">—</strong></div>
          </div>
          <div class="challenge-stat-grid">
            <div class="challenge-stat"><small>🥇 Sceriffo del giorno</small><strong id="challengeSheriff">—</strong><span id="challengeSheriffScore" class="challenge-note">—</span></div>
            <div class="challenge-stat"><small>🏆 Campione settimana</small><strong id="challengeWeekChampion">—</strong><span id="challengeWeekScore" class="challenge-note">—</span></div>
            <div class="challenge-stat"><small>🔥 La tua serie</small><strong id="challengeMyStreak">0 giorni</strong><span class="challenge-note">Sfide giornaliere</span></div>
          </div>
          <div class="challenge-start-row">
            <input id="challengeNickname" class="input" type="text" maxlength="18" autocomplete="nickname" placeholder="Nickname (es. Max)" />
            <button id="challengeStart" class="btn btn-primary" type="button">Inizia / Riprendi</button>
          </div>
          <p id="challengeHomeError" class="challenge-error hidden"></p>
        </div>

        <div class="challenge-panel challenge-profile-panel">
          <div class="challenge-section-head"><strong>⭐ Il mio profilo</strong><span id="challengeProfileLevel" class="challenge-level-pill">🌵 Rookie</span></div>
          <div class="challenge-level-track" aria-label="Progresso livello"><span id="challengeLevelFill"></span></div>
          <div class="challenge-level-copy"><span id="challengeProfilePoints">0 punti</span><span id="challengeLevelNext">Prossimo: Cowboy</span></div>
          <div class="challenge-profile-stats">
            <div><strong id="challengeProfileGames">0</strong><small>Partite</small></div>
            <div><strong id="challengeProfileAccuracy">0%</strong><small>Precisione</small></div>
            <div><strong id="challengeProfileBest">0</strong><small>Record</small></div>
            <div><strong id="challengeProfileStreak">0</strong><small>Best streak</small></div>
          </div>
          <div class="challenge-section-head challenge-badge-head"><strong>Trofei</strong><span id="challengeBadgeCount" class="challenge-note">0/8</span></div>
          <div id="challengeBadges" class="challenge-badges"></div>
        </div>
      </div>

      <div id="challengeWeekendPanel" class="challenge-panel challenge-weekend-panel">
        <div>
          <span class="challenge-special-kicker">🔥 SFIDA SPECIALE</span>
          <h4>Weekend Showdown</h4>
          <p id="challengeWeekendStatus" class="challenge-note">Disponibile sabato e domenica: 15 domande, 12 secondi ciascuna.</p>
        </div>
        <button id="challengeWeekendStart" class="btn btn-primary" type="button">Weekend Showdown</button>
      </div>

      <div class="challenge-panel" style="margin-top:14px">
        <div class="challenge-section-head"><strong>Classifica di oggi</strong><button id="challengeShowLeaderboard" class="btn ghost btn-slim" type="button">Vedi completa</button></div>
        <div id="challengeMiniBoard" class="challenge-mini-board"><div class="challenge-empty">Nessun risultato ancora. Apri le danze!</div></div>
      </div>
    </section>

    <section id="challengeQuiz" class="challenge-panel hidden" style="margin-top:14px">
      <div class="challenge-quiz-head">
        <div><span id="challengeModeBadge" class="challenge-mode-badge">🤠 Sfida del giorno</span><div id="challengeProgress" class="challenge-progress">Domanda 1 di 10</div><div id="challengeQuestion" class="challenge-question">Caricamento…</div></div>
        <div class="challenge-score-boxes"><div class="challenge-score-box"><small>Tempo</small><strong id="challengeTimer">15</strong>s</div><div class="challenge-score-box"><small>Punti</small><strong id="challengeScore">0</strong></div></div>
      </div>
      <div id="challengeAnswers" class="challenge-answers"></div>
      <div id="challengeFeedback" class="challenge-feedback" aria-live="polite"></div>
    </section>

    <section id="challengeResult" class="challenge-panel hidden" style="margin-top:14px">
      <div class="challenge-result-grid">
        <div>
          <span id="challengeResultMode" class="challenge-mode-badge">🏆 Risultato ufficiale</span>
          <div id="challengeResultScore" class="challenge-result-score">0 punti</div>
          <div id="challengeResultCorrect">0/10 risposte corrette</div>
          <div id="challengePlacement" class="challenge-placement">—</div>
          <div class="challenge-actions"><button id="challengeTraining" class="btn btn-primary" type="button">Gioca allenamento</button><button id="challengeResultBoard" class="btn ghost" type="button">Classifica</button><button id="challengeBackHome" class="btn ghost" type="button">Home sfida</button></div>
        </div>
        <div>
          <div class="challenge-result-level"><small>Livello</small><strong id="challengeResultLevel">🌵 Rookie</strong></div>
          <div class="challenge-awards">
            <div class="challenge-award"><div class="emoji">🎯</div><strong id="challengeResultAccuracy">0%</strong><small>Precisione</small></div>
            <div class="challenge-award"><div class="emoji">⏱️</div><strong id="challengeResultTime">0:00</strong><small>Tempo</small></div>
            <div class="challenge-award"><div class="emoji">🔥</div><strong id="challengeResultStreak">0</strong><small>Serie</small></div>
          </div>
          <div id="challengeResultBadges" class="challenge-new-badges"></div>
        </div>
      </div>
    </section>

    <section id="challengeLeaderboard" class="challenge-panel hidden" style="margin-top:14px">
      <div class="challenge-section-head"><div><strong>🏆 Classifica Western Spritz</strong><div class="challenge-note">Aggiornata in tempo reale</div></div><button id="challengeBoardClose" class="btn ghost btn-slim" type="button">Chiudi classifica</button></div>
      <div class="challenge-tabs" role="tablist">
        <button class="challenge-tab active" data-period="today" type="button">Oggi</button><button class="challenge-tab" data-period="week" type="button">Settimana</button><button class="challenge-tab" data-period="weekend" type="button">Weekend</button><button class="challenge-tab" data-period="hall" type="button">Hall of Fame</button>
      </div>
      <div class="challenge-table-wrap"><table class="challenge-table"><thead><tr><th>Pos.</th><th>Giocatore</th><th>Livello</th><th>Punti</th><th id="challengeBoardExtraHead">Corrette</th></tr></thead><tbody id="challengeBoardBody"></tbody></table></div>
    </section>
  </div>
</div>`;

(() => {
  if (!document.querySelector('link[data-ws-challenge-css]')) {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href='./challenge.css?v=2'; link.dataset.wsChallengeCss='1'; document.head.appendChild(link);
  }
  if (!document.getElementById('btnChallenge')) {
    const playlist=document.getElementById('btnPlaylist'), actions=playlist?.parentElement||document.querySelector('.actions-top');
    if(actions){const holder=document.createElement('div');holder.innerHTML=BUTTON_HTML.trim();const button=holder.firstElementChild;if(button)actions.insertBefore(button,playlist||null);}
  }
  if (!document.getElementById('challengeModal')) {
    const anchor=document.getElementById('saggioLoginModal'),holder=document.createElement('div');holder.innerHTML=MODAL_HTML.trim();const challenge=holder.firstElementChild;
    if(challenge){if(anchor?.parentNode)anchor.parentNode.insertBefore(challenge,anchor);else document.body.appendChild(challenge);}
  }

  const $=sel=>document.querySelector(sel), $$=sel=>[...document.querySelectorAll(sel)];
  const modal=$('#challengeModal'); if(!modal)return;

  function fixFunWithAsiaText(){
    const el=document.querySelector('.asia-subtext');
    if(el && el.textContent.trim()!=='ATTENZIONE!!! - SUBSCRIBE - ATTENZIONE!!!!') {
      el.textContent='ATTENZIONE!!! - SUBSCRIBE - ATTENZIONE!!!!';
    }
  }
  fixFunWithAsiaText();
  const cards=document.getElementById('cards');
  if(cards && !cards.dataset.challengeAsiaObserver){
    cards.dataset.challengeAsiaObserver='1';
    new MutationObserver(fixFunWithAsiaText).observe(cards,{childList:true,subtree:true});
  }

  const DEVICE_KEY='ws_challenge_device_v1', NICK_KEY='ws_challenge_nickname_v1';
  let session=null,timerId=null,timerDeadline=0,submitting=false,lastMode='daily',lastProfile=null;

  function randomHex(bytes=20){const arr=new Uint8Array(bytes);crypto.getRandomValues(arr);return [...arr].map(v=>v.toString(16).padStart(2,'0')).join('');}
  function getDeviceId(){let value='';try{value=localStorage.getItem(DEVICE_KEY)||'';}catch{} if(!/^[a-f0-9]{32,64}$/i.test(value)){value=randomHex(20);try{localStorage.setItem(DEVICE_KEY,value);}catch{}} return value.toLowerCase();}
  function fmt(value){return Number(value||0).toLocaleString('it-IT');}
  function fmtTime(ms){const total=Math.max(0,Math.round(Number(ms||0)/1000)),min=Math.floor(total/60),sec=total%60;return `${min}:${String(sec).padStart(2,'0')}`;}
  function show(el,yes=true){if(!el)return;el.classList.toggle('hidden',!yes);}
  function setText(sel,value){const el=$(sel);if(el)el.textContent=String(value??'');}
  async function api(url,options){const r=await fetch(url,options);let data={};try{data=await r.json();}catch{} if(!r.ok||data?.ok===false)throw new Error(data?.error||`Errore ${r.status}`);return data;}
  function nickname(){return String($('#challengeNickname')?.value||'').trim();}
  function saveNickname(){try{localStorage.setItem(NICK_KEY,nickname());}catch{}}
  function closeModal(){clearInterval(timerId);modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');}
  function openModal(){modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');loadHome();}
  function showHome(){show($('#challengeHome'),true);show($('#challengeQuiz'),false);show($('#challengeResult'),false);show($('#challengeLeaderboard'),false);loadHome();}

  function renderProfile(profile){
    lastProfile=profile||null;const p=profile||{games:0,totalScore:0,avgAccuracy:0,bestScore:0,bestStreak:0,streak:0,earnedBadges:0,totalBadges:8,level:{emoji:'🌵',label:'Rookie',progress:0,next:{label:'Cowboy'},pointsToNext:25000},badges:[]};
    setText('#challengeProfileLevel',`${p.level?.emoji||'🌵'} ${p.level?.label||'Rookie'}`);setText('#challengeProfilePoints',`${fmt(p.totalScore)} punti`);
    const fill=$('#challengeLevelFill');if(fill)fill.style.width=`${Math.max(0,Math.min(100,Number(p.level?.progress||0)))}%`;
    setText('#challengeLevelNext',p.level?.next?`Mancano ${fmt(p.level.pointsToNext)} a ${p.level.next.label}`:'Livello massimo raggiunto');
    setText('#challengeProfileGames',p.games||0);setText('#challengeProfileAccuracy',`${p.avgAccuracy||0}%`);setText('#challengeProfileBest',fmt(p.bestScore));setText('#challengeProfileStreak',p.bestStreak||0);setText('#challengeMyStreak',`${p.streak||0} ${Number(p.streak||0)===1?'giorno':'giorni'}`);setText('#challengeBadgeCount',`${p.earnedBadges||0}/${p.totalBadges||8}`);
    const box=$('#challengeBadges');if(box){box.innerHTML='';const badges=Array.isArray(p.badges)?p.badges:[];if(!badges.length){box.textContent='I trofei si sbloccano giocando.';}else badges.forEach(b=>{const d=document.createElement('div');d.className=`challenge-badge ${b.earned?'earned':'locked'}`;d.title=b.description||'';const em=document.createElement('span');em.className='challenge-badge-emoji';em.textContent=b.emoji;const tx=document.createElement('span');tx.textContent=b.name;d.append(em,tx);box.appendChild(d);});}
  }

  function renderMini(rows){const box=$('#challengeMiniBoard');if(!box)return;box.innerHTML='';if(!rows?.length){const e=document.createElement('div');e.className='challenge-empty';e.textContent='Nessun risultato ancora. Apri le danze!';box.appendChild(e);return;}rows.slice(0,5).forEach(row=>{const d=document.createElement('div');d.className='challenge-mini-row';const left=document.createElement('span');left.textContent=`${row.rank===1?'🥇':row.rank===2?'🥈':row.rank===3?'🥉':row.rank+'.'} ${row.nickname}`;const right=document.createElement('strong');right.textContent=fmt(row.score);d.append(left,right);box.appendChild(d);});}

  async function loadHome(){
    const error=$('#challengeHomeError');show(error,false);
    try{
      const device=getDeviceId();
      const [today,week]=await Promise.all([api(`/api/challenge?period=today&deviceId=${encodeURIComponent(device)}`),api('/api/challenge?period=week')]);
      setText('#challengePlayersToday',today.todayParticipants??today.participants??0);const sheriff=today.rows?.[0];setText('#challengeSheriff',sheriff?.nickname||'Ancora nessuno');setText('#challengeSheriffScore',sheriff?`${fmt(sheriff.score)} punti`:'—');
      const champ=week.rows?.[0];setText('#challengeWeekChampion',champ?.nickname||'Ancora nessuno');setText('#challengeWeekScore',champ?`${fmt(champ.score)} punti`:'—');renderMini(today.rows||[]);renderProfile(today.profile);
      const weekend=!!today.config?.weekend?.active,button=$('#challengeWeekendStart');if(button){button.disabled=!weekend;button.textContent=weekend?'🔥 Gioca adesso':'Torna nel weekend';}
      setText('#challengeWeekendStatus',weekend?'È aperto! 15 domande, 12 secondi ciascuna e classifica speciale.':'Disponibile sabato e domenica: 15 domande, 12 secondi ciascuna.');$('#challengeWeekendPanel')?.classList.toggle('active',weekend);
    }catch(err){if(error){error.textContent=String(err.message||err);show(error,true);}}
  }

  function stopTimer(){clearInterval(timerId);timerId=null;}
  function startTimer(ms){stopTimer();timerDeadline=Date.now()+Math.max(0,Number(ms||session?.secondsPerQuestion*1000||15000));const tick=()=>{const left=Math.max(0,Math.ceil((timerDeadline-Date.now())/1000));setText('#challengeTimer',left);if(left<=0){stopTimer();submitAnswer(null);}};tick();timerId=setInterval(tick,200);}
  function renderQuestion(){if(!session)return;const i=Number(session.currentIndex||0),q=session.questions?.[i];if(!q)return;show($('#challengeHome'),false);show($('#challengeResult'),false);show($('#challengeLeaderboard'),false);show($('#challengeQuiz'),true);setText('#challengeModeBadge',session.modeLabel||'🤠 Sfida del giorno');setText('#challengeProgress',`Domanda ${i+1} di ${session.questionCount}`);setText('#challengeQuestion',q.prompt);setText('#challengeScore',fmt(session.score));setText('#challengeFeedback','');const answers=$('#challengeAnswers');answers.innerHTML='';q.options.forEach((text,index)=>{const b=document.createElement('button');b.type='button';b.className='challenge-answer';b.textContent=text;b.addEventListener('click',()=>submitAnswer(index));answers.appendChild(b);});startTimer(i===Number(session.initialIndex||0)&&session.remainingMs!=null?session.remainingMs:session.secondsPerQuestion*1000);session.remainingMs=null;}

  async function start(mode='daily'){
    const error=$('#challengeHomeError');show(error,false);const nick=nickname();if(nick.length<2){error.textContent='Inserisci un nickname di almeno 2 caratteri.';show(error,true);$('#challengeNickname')?.focus();return;}saveNickname();
    try{const data=await api('/api/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',nickname:nick,deviceId:getDeviceId(),mode})});session={...data,initialIndex:data.currentIndex};lastMode=mode;renderQuestion();}catch(err){error.textContent=String(err.message||err);show(error,true);}
  }

  async function submitAnswer(answerIndex){if(submitting||!session)return;submitting=true;stopTimer();$$('#challengeAnswers button').forEach(b=>b.disabled=true);try{const i=Number(session.currentIndex||0);const data=await api('/api/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'answer',sessionId:session.sessionId,deviceId:getDeviceId(),questionIndex:i,answerIndex})});session.score=data.score;session.correct=data.correctCount;session.currentIndex=data.currentIndex;setText('#challengeScore',fmt(data.score));const feedback=$('#challengeFeedback');feedback.textContent=data.correct?`✅ Corretta! +${fmt(data.points)} punti`:data.timedOut?`⏱️ Tempo scaduto. Risposta: ${data.correctAnswer}`:`❌ Risposta corretta: ${data.correctAnswer}`;feedback.className=`challenge-feedback ${data.correct?'ok':'bad'}`;await new Promise(r=>setTimeout(r,650));if(data.finished){finish(data);}else renderQuestion();}catch(err){setText('#challengeFeedback',String(err.message||err));$('#challengeFeedback').className='challenge-feedback bad';}finally{submitting=false;}}

  function finish(data){stopTimer();show($('#challengeQuiz'),false);show($('#challengeResult'),true);const r=data.result||{},profile=r.profile||lastProfile;setText('#challengeResultMode',data.official?(data.mode==='weekend'?'🔥 Weekend Showdown • ufficiale':'🏆 Risultato ufficiale'):'🎯 Allenamento');setText('#challengeResultScore',`${fmt(r.score)} punti`);setText('#challengeResultCorrect',`${r.correct||0}/${r.total||session?.questionCount||0} risposte corrette`);setText('#challengeResultAccuracy',`${r.total?Math.round((r.correct/r.total)*100):0}%`);setText('#challengeResultTime',fmtTime(r.durationMs));setText('#challengeResultStreak',r.streak||0);setText('#challengeResultLevel',profile?.level?`${profile.level.emoji} ${profile.level.label}`:'🌵 Rookie');
    setText('#challengePlacement',data.official&&r.rank?`${r.rank}º posto su ${r.participants||r.rank} partecipanti${data.mode==='weekend'?' al Weekend Showdown':' oggi'}.`:'Questa partita era di allenamento e non modifica la classifica.');
    const rb=$('#challengeResultBadges');if(rb){rb.innerHTML='';const earned=profile?.badges?.filter(b=>b.earned)||[];if(earned.length){const title=document.createElement('strong');title.textContent='Trofei conquistati: ';rb.appendChild(title);earned.slice(-4).forEach(b=>{const s=document.createElement('span');s.textContent=`${b.emoji} ${b.name}`;rb.appendChild(s);});}}
    if(profile)renderProfile(profile);session=null;loadHome();}

  function boardExtra(period,row){if(period==='today'||period==='weekend')return `${row.correct||0} • ${fmtTime(row.durationMs)}`;return `${row.games||0} partite`;}
  async function loadBoard(period='today'){
    show($('#challengeLeaderboard'),true);show($('#challengeHome'),false);show($('#challengeResult'),false);const body=$('#challengeBoardBody');body.innerHTML='';$$('.challenge-tab').forEach(b=>b.classList.toggle('active',b.dataset.period===period));setText('#challengeBoardExtraHead',(period==='today'||period==='weekend')?'Corrette • Tempo':'Partite');
    try{const data=await api(`/api/challenge?period=${encodeURIComponent(period)}`);if(!data.rows?.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='challenge-empty';td.textContent=period==='weekend'&&!data.weekendActive?'Il Weekend Showdown apre sabato.':'Nessun risultato ancora.';tr.appendChild(td);body.appendChild(tr);return;}data.rows.forEach(row=>{const tr=document.createElement('tr');const vals=[row.rank,row.nickname,row.level?`${row.level.emoji} ${row.level.label}`:'🌵 Rookie',fmt(row.score),boardExtra(period,row)];vals.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===1)td.className='challenge-player';tr.appendChild(td);});body.appendChild(tr);});}catch(err){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='challenge-empty';td.textContent=String(err.message||err);tr.appendChild(td);body.appendChild(tr);}
  }

  try{$('#challengeNickname').value=localStorage.getItem(NICK_KEY)||'';}catch{}
  $('#btnChallenge')?.addEventListener('click',openModal);$('#challengeClose')?.addEventListener('click',closeModal);modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  $('#challengeStart')?.addEventListener('click',()=>start('daily'));$('#challengeWeekendStart')?.addEventListener('click',()=>start('weekend'));$('#challengeShowLeaderboard')?.addEventListener('click',()=>loadBoard('today'));$('#challengeResultBoard')?.addEventListener('click',()=>loadBoard(lastMode==='weekend'?'weekend':'today'));$('#challengeBoardClose')?.addEventListener('click',showHome);$('#challengeBackHome')?.addEventListener('click',showHome);$('#challengeTraining')?.addEventListener('click',()=>start(lastMode));$$('.challenge-tab').forEach(b=>b.addEventListener('click',()=>loadBoard(b.dataset.period)));
  $('#challengeNickname')?.addEventListener('input',()=>{const e=$('#challengeHomeError');show(e,false);});
})();
