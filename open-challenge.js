/* Western Spritz - Sfida Aperta, asynchronous one-to-many multiplayer. */
(() => {
  const HTML = [
    "<div id='ocModal' class='overlay hidden' aria-hidden='true'>",
    "<div class='pl-card oc-card' role='dialog' aria-modal='true' aria-labelledby='ocTitle'>",
    "<div class='pl-top oc-header'><div><span class='oc-kicker'>WESTERN SPRITZ · MULTIPLAYER</span><h3 id='ocTitle'>🏁 Sfida Aperta</h3>",
    "<p>Un solo link, tanti cowboy. Stesse 5 domande e una classifica comune!</p></div>",
    "<button id='ocClose' class='btn ghost' type='button'>Chiudi</button></div>",
    "<div class='oc-tabbar'><button id='ocTabGame' class='oc-tab active' type='button'>🎯 Sfida</button>",
    "<button id='ocTabBoard' class='oc-tab' type='button'>🏆 Classifica</button></div>",
    "<div id='ocError' class='oc-error hidden' role='alert'></div>",
    "<section id='ocWelcome' class='oc-panel'>",
    "<div class='oc-hero' aria-hidden='true'>🤠 ⚡ 🤠 🤠 🤠</div><h4>Lancia una Sfida Aperta!</h4>",
    "<p>Crea una sfida e condividi il link con tutti gli amici. Ognuno partecipa quando vuole, fino alla scadenza.</p>",
    "<div class='oc-rule'>🎯 Cinque domande identiche per tutti · ⏱️ 15 secondi per domanda · 🏆 Classifica pubblica per punteggio, risposte esatte e velocità. La sfida rimane aperta 7 giorni; la classifica è consultabile per 45 giorni dalla creazione. Ogni dispositivo può giocare una sola volta per sfida.</div>",
    "<label class='oc-label' for='ocNickname'>Il tuo nickname pubblico</label>",
    "<div class='oc-form'><input id='ocNickname' class='input' maxlength='18' autocomplete='nickname' placeholder='Il tuo nickname' />",
    "<button id='ocCreate' class='btn btn-primary' type='button'>🏁 Crea Sfida Aperta</button></div>",
    "<p class='oc-muted'>Non serve registrarsi. Partecipando autorizzi la pubblicazione del nickname e del risultato nella classifica della sfida.</p>",
    "</section>",
    "<section id='ocInvite' class='oc-panel hidden'>",
    "<span class='oc-kicker'>📨 SEI STATO SFIDATO!</span><h4 id='ocInviteTitle'>Un cowboy ti invita!</h4>",
    "<p id='ocInviteInfo'>Partecipa con le stesse domande di tutti.</p>",
    "<div class='oc-rule'>🏆 Questa è una sfida pubblica: nickname, punteggio e posizione in classifica sono visibili a chi ha il link. Una partecipazione per dispositivo.</div>",
    "<div id='ocJoinForm'><label class='oc-label' for='ocJoinNickname'>Come vuoi comparire?</label>",
    "<div class='oc-form'><input id='ocJoinNickname' class='input' maxlength='18' autocomplete='nickname' placeholder='Il tuo nickname' />",
    "<button id='ocJoin' class='btn btn-primary' type='button'>🤠 Partecipa</button></div></div>",
    "<div class='oc-actions'><button id='ocInviteBoard' class='btn ghost' type='button'>🏆 Vedi la classifica</button></div>",
    "</section>",
    "<section id='ocLobby' class='oc-panel hidden'>",
    "<span class='oc-kicker'>🎉 ISCRIZIONE CONFERMATA</span><h4 id='ocLobbyTitle'>Pronto alla sfida?</h4>",
    "<p id='ocLobbyDescription'>Condividi il link con tutti i cowboy che vuoi.</p>",
    "<div class='oc-stats'><div class='oc-stat'><strong id='ocLobbyMembers'>0</strong><small>Partecipanti</small></div>",
    "<div class='oc-stat'><strong id='ocLobbyFinished'>0</strong><small>Hanno finito</small></div>",
    "<div class='oc-stat'><strong id='ocLobbyDeadline'>—</strong><small>Termine iscrizioni e gioco</small></div></div>",
    "<div class='oc-share'><label class='oc-label' for='ocLink'>Link da condividere</label>",
    "<input id='ocLink' class='input' type='text' readonly aria-label='Link della Sfida Aperta' />",
    "<div class='oc-actions'><button id='ocCopy' class='btn ghost' type='button'>📋 Copia link</button>",
    "<button id='ocWhatsApp' class='btn btn-primary' type='button'>🟢 Invita su WhatsApp</button></div></div>",
    "<p class='oc-rule'>Ogni giocatore ha una sola partita. Il tempo parte per ciascuno quando inizia: non serve giocare contemporaneamente.</p>",
    "<div class='oc-actions'><button id='ocStart' class='btn btn-primary' type='button'>🎯 Inizia le 5 domande</button>",
    "<button id='ocLobbyBoard' class='btn ghost' type='button'>🏆 Classifica</button>",
    "<button id='ocLobbyNew' class='btn ghost' type='button'>Nuova sfida</button></div>",
    "</section>",
    "<section id='ocQuiz' class='oc-panel hidden'>",
    "<div class='oc-clockbar'><span id='ocProgress'>DOMANDA 1 / 5</span><span><strong id='ocTimer'>15</strong> s</span>",
    "<span><strong id='ocScore'>0</strong> punti</span></div>",
    "<div class='oc-track'><div id='ocTrackFill'></div></div>",
    "<h4 id='ocQuestion'>Pronto?</h4><div id='ocAnswers' class='oc-answers'></div>",
    "<div id='ocFeedback' class='oc-feedback' aria-live='polite'></div>",
    "<p class='oc-muted'>Non chiudere la pagina durante la partita: il cronometro continua sul server.</p>",
    "</section>",
    "<section id='ocResults' class='oc-panel hidden'>",
    "<span class='oc-kicker' id='ocResultKicker'>🏆 SFIDA COMPLETATA</span><h4 id='ocResultTitle'>Ottimo lavoro!</h4>",
    "<div class='oc-highlight'><strong id='ocResultScore'>0 punti</strong>",
    "<div id='ocResultDetail' class='oc-finish-text'>Il tuo risultato</div></div>",
    "<p id='ocResultNote'></p>",
    "<div class='oc-actions'><button id='ocResultBoard' class='btn btn-primary' type='button'>🏆 Classifica aggiornata</button>",
    "<button id='ocResultShare' class='btn ghost' type='button'>🟢 Condividi</button>",
    "<button id='ocResultNew' class='btn ghost' type='button'>Nuova sfida</button></div>",
    "</section>",
    "<section id='ocBoard' class='oc-panel hidden'>",
    "<span class='oc-kicker'>🏆 CLASSIFICA SFIDA APERTA</span><h4 id='ocBoardTitle'>La corsa al primo posto!</h4>",
    "<p id='ocBoardStatus'>La classifica si aggiorna al completamento delle partite.</p>",
    "<div class='oc-stats'><div class='oc-stat'><strong id='ocBoardMembers'>0</strong><small>Partecipanti</small></div>",
    "<div class='oc-stat'><strong id='ocBoardFinished'>0</strong><small>Risultati finali</small></div>",
    "<div class='oc-stat'><strong id='ocBoardClose'>—</strong><small>Chiusura sfida</small></div></div>",
    "<div id='ocRanking' class='oc-ranking' aria-live='polite'></div>",
    "<p class='oc-muted'>Sono mostrati i primi 30 risultati. In caso di pari punti prevalgono le risposte corrette, poi il tempo minore. I risultati sono pubblici per chiunque abbia il link.</p>",
    "<div class='oc-actions'><button id='ocBoardReload' class='btn ghost' type='button'>↻ Aggiorna</button>",
    "<button id='ocBoardBack' class='btn btn-primary' type='button'>🎯 Torna alla sfida</button>",
    "<button id='ocBoardShare' class='btn ghost' type='button'>🟢 Invita amici</button></div>",
    "</section>",
    "</div></div>"
  ].join("");
  const BUTTON = "<button id='btnOpenChallenge' class='btn btn-glass btn-slim' type='button' aria-label='Sfida Aperta multiplayer'><span class='btn-icon'>🏁</span><span class='btn-label'>Sfida Aperta</span></button>";
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "./open-challenge.css?v=1";
  css.dataset.wsOpenChallengeCss = "1";
  if (!document.querySelector("link[data-ws-open-challenge-css]")) document.head.appendChild(css);
  const actions = document.querySelector(".actions-top");
  if (actions && !document.getElementById("btnOpenChallenge")) {
    const holder = document.createElement("div");
    holder.innerHTML = BUTTON;
    actions.insertBefore(holder.firstElementChild, document.getElementById("btnPlaylist") || null);
  }
  if (!document.getElementById("ocModal")) {
    const holder = document.createElement("div");
    holder.innerHTML = HTML;
    document.body.appendChild(holder.firstElementChild);
  }
  const $ = id => document.getElementById(id);
  const modal = $("ocModal");
  if (!modal) return;
  const DEVICE_KEY = "ws_challenge_device_v1";
  const NAME_KEY = "ws_challenge_nickname_v1";
  const LAST_KEY = "ws_open_challenge_last_v1";
  let challengeId = "", data = null, active = false, pending = false;
  let tickId = null, pollId = null, deadline = 0, boardView = false;
  const formatScore = n => Math.round(Number(n || 0)).toLocaleString("it-IT");
  const writeText = (id, value) => { const element = $(id); if (element) element.textContent = String(value ?? ""); };
  const show = (id, yes) => $(id)?.classList.toggle("hidden", !yes);
  function deviceId() {
    let value = "";
    try { value = localStorage.getItem(DEVICE_KEY) || ""; } catch {}
    if (/^[a-f0-9]{32,64}$/.test(value)) return value;
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    value = [...bytes].map(x => x.toString(16).padStart(2,"0")).join("");
    try { localStorage.setItem(DEVICE_KEY, value); } catch {}
    return value;
  }
  function nickname() { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } }
  function saveNickname(value) { try { localStorage.setItem(NAME_KEY,value); } catch {} }
  function getLastId() { try { return localStorage.getItem(LAST_KEY) || ""; } catch { return ""; } }
  function saveLastId(id) { try { localStorage.setItem(LAST_KEY,id); } catch {} }
  function clearLastId() { try { localStorage.removeItem(LAST_KEY); } catch {} }
  function validNickname(value) { return value.length >= 2 && value.length <= 18; }
  function italianDate(value) {
    return new Intl.DateTimeFormat("it-IT",{
      timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",
      hour:"2-digit",minute:"2-digit"
    }).format(new Date(value));
  }
  function setError(message) { writeText("ocError",message); show("ocError",!!message); }
  function stopTimer() { if (tickId) { clearInterval(tickId); tickId = null; } }
  function stopPoll() { if (pollId) { clearInterval(pollId); pollId = null; } }
  function panel(id) {
    for (const item of ["ocWelcome","ocInvite","ocLobby","ocQuiz","ocResults","ocBoard"]) show(item,item===id);
    $("ocTabGame").classList.toggle("active",id!=="ocBoard");
    $("ocTabBoard").classList.toggle("active",id==="ocBoard");
    setError("");
  }
  function shareUrl() {
    const url = new URL(location.href);
    url.searchParams.delete("duel");
    url.searchParams.set("openChallenge",challengeId);
    url.hash = "";
    return url.toString();
  }
  async function api(path,body) {
    const response = await fetch(path,{
      cache:"no-store",
      ...(body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {})
    });
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok || !result.ok) throw new Error(result.error || "Impossibile contattare il server.");
    return result;
  }
  function post(action,other = {}) {
    return api("/api/open-challenge",{action,id:challengeId,deviceId:deviceId(),...other});
  }
  function enterWelcome() {
    stopTimer(); stopPoll(); data = null; challengeId = ""; boardView = false; clearLastId();
    const url = new URL(location.href);
    url.searchParams.delete("openChallenge");
    history.replaceState({}, "", url.toString());
    $("ocNickname").value = nickname();
    panel("ocWelcome");
  }
  function updateStats(prefix) {
    if (!data) return;
    writeText(prefix+"Members",formatScore(data.challenge.participants));
    writeText(prefix+"Finished",formatScore(data.challenge.finished));
  }
  function renderBoard() {
    if (!data) { enterWelcome(); return; }
    stopTimer(); stopPoll(); boardView = true; panel("ocBoard");
    writeText("ocBoardTitle","Sfida di "+data.challenge.hostNickname);
    writeText("ocBoardStatus",data.challenge.status==="closed"
      ? "🔒 Sfida terminata: iscrizioni e partite chiuse. La classifica rimane consultabile."
      : "🔥 Sfida ancora aperta! Condividi il link e supera gli altri cowboy.");
    updateStats("ocBoard");
    writeText("ocBoardClose",italianDate(data.challenge.closesAt));
    const box = $("ocRanking");
    box.replaceChildren();
    if (!data.leaderboard?.length) {
      const empty = document.createElement("p");
      empty.className = "oc-muted";
      empty.style.padding = "14px";
      empty.textContent = "Ancora nessun risultato. Il primo cowboy può conquistare la vetta!";
      box.appendChild(empty);
    } else data.leaderboard.forEach((player,index) => {
      const row = document.createElement("div");
      row.className = "oc-rank-row";
      if (data.me?.status==="finished" && data.me.rank===player.rank) row.classList.add("oc-own");
      const rank = document.createElement("span"); rank.className = "oc-rank-no";
      rank.textContent = player.rank===1 ? "🥇" : player.rank===2 ? "🥈" : player.rank===3 ? "🥉" : String(player.rank)+".";
      const who = document.createElement("span"); who.className = "oc-rank-name";
      who.textContent = player.nickname;
      const detail = document.createElement("small"); detail.textContent = String(player.correct)+"/5 corrette"; who.appendChild(detail);
      const points = document.createElement("span"); points.className = "oc-rank-score";
      points.textContent = formatScore(player.score);
      const duration = document.createElement("small"); duration.textContent = (Number(player.durationMs || 0)/1000).toFixed(1)+" s"; points.appendChild(duration);
      row.append(rank,who,points); box.appendChild(row);
    });
    if (data.me?.status==="finished" && data.me.rank>data.leaderboard.length) {
      const note = document.createElement("p");
      note.className = "oc-muted"; note.style.padding = "12px";
      note.textContent = "La tua posizione è "+data.me.rank+"° · "+formatScore(data.me.score)+" punti.";
      box.appendChild(note);
    }
  }
  function render() {
    stopTimer(); stopPoll();
    if (!data) { enterWelcome(); return; }
    if (boardView) { renderBoard(); return; }
    const challenge = data.challenge, me = data.me;
    if (!me) {
      panel("ocInvite");
      writeText("ocInviteTitle",challenge.hostNickname+" ti invita alla Sfida Aperta!");
      writeText("ocInviteInfo",formatScore(challenge.participants)+" iscritti · "+
        formatScore(challenge.finished)+" risultati · chiude il "+italianDate(challenge.closesAt)+".");
      $("ocJoinNickname").value = nickname();
      show("ocJoinForm",challenge.status==="open");
      return;
    }
    if (me.status==="playing" && challenge.status==="open" && me.question) {
      panel("ocQuiz");
      const q = me.question;
      writeText("ocProgress","DOMANDA "+(me.currentIndex+1)+" / "+challenge.questionCount);
      writeText("ocScore",formatScore(me.score));
      writeText("ocQuestion",q.prompt);
      writeText("ocFeedback","");
      const box = $("ocAnswers"); box.replaceChildren();
      q.options.forEach((option,index) => {
        const button = document.createElement("button");
        button.type = "button"; button.className = "oc-answer";
        button.textContent = option;
        button.addEventListener("click",() => answer(index));
        box.appendChild(button);
      });
      deadline = Date.now() + Number(me.remainingMs || 0);
      const tick = () => {
        const remaining = Math.max(0,deadline-Date.now());
        writeText("ocTimer",Math.ceil(remaining/1000));
        $("ocTrackFill").style.width = String(100*remaining/(challenge.questionSeconds*1000))+"%";
        if (!remaining) { stopTimer(); answer(null); }
      };
      tick();
      if (deadline>Date.now()) tickId = setInterval(tick,200);
      return;
    }
    if (me.status==="finished" || challenge.status==="closed") {
      panel("ocResults");
      const finished = me.status==="finished";
      writeText("ocResultKicker",finished?"🏆 SFIDA COMPLETATA":"🔒 SFIDA TERMINATA");
      writeText("ocResultTitle",finished?"Bravo, "+me.nickname+"!":"Il tempo è scaduto");
      writeText("ocResultScore",formatScore(me.score)+" punti");
      writeText("ocResultDetail",me.correct+"/"+challenge.questionCount+
        " risposte corrette · "+(Number(me.durationMs||0)/1000).toFixed(1)+" secondi");
      writeText("ocResultNote",finished
        ? "La tua posizione attuale è "+(me.rank || "—")+
          "°. La classifica potrebbe cambiare finché la sfida resta aperta."
        : "La sfida è chiusa e non puoi più completare la partita. Puoi consultare i risultati degli altri cowboy.");
      show("ocResultShare",finished);
      return;
    }
    panel("ocLobby");
    writeText("ocLobbyTitle","In bocca al lupo, "+me.nickname+"!");
    writeText("ocLobbyDescription","Sfida creata da "+challenge.hostNickname+
      ". Condividi il link: possono partecipare tutti i cowboy che vuoi.");
    updateStats("ocLobby");
    writeText("ocLobbyDeadline",italianDate(challenge.closesAt));
    $("ocLink").value = shareUrl();
    pollId = setInterval(() => { if (active && !boardView) refresh(false); },13000);
  }
  async function refresh(showError = true) {
    if (!challengeId || pending || !active) return;
    try {
      const next = await api("/api/open-challenge?id="+encodeURIComponent(challengeId)+
        "&deviceId="+encodeURIComponent(deviceId()));
      if (!active) return;
      data = next;
      if (boardView) { renderBoard(); return; }
      // Polling never interrupts an active timed question.
      if (data.me?.status==="playing" && !$("ocQuiz").classList.contains("hidden") &&
          data.challenge.status==="open") return;
      render();
    } catch (error) {
      if (showError) setError(error.message);
    }
  }
  function open(id = "") {
    active = true; boardView = false; stopTimer(); stopPoll();
    modal.classList.remove("hidden"); modal.setAttribute("aria-hidden","false");
    challengeId = /^[a-f0-9]{20}$/.test(id) ? id : "";
    if (challengeId) {
      data = null;
      saveLastId(challengeId);
      panel("ocWelcome");
      writeText("ocError","Caricamento della Sfida Aperta…");
      show("ocError",true);
      refresh();
    } else {
      enterWelcome();
    }
  }
  function close() {
    active = false; stopTimer(); stopPoll();
    modal.classList.add("hidden"); modal.setAttribute("aria-hidden","true");
  }
  async function run(task) {
    if (pending) return;
    pending = true; setError("");
    try { await task(); } catch (error) { setError(error.message); }
    finally { pending = false; }
  }
  function startNew() { enterWelcome(); }
  function shareOnWhatsApp(text) {
    window.open("https://wa.me/?text="+encodeURIComponent(text)," _blank".trim(),"noopener,noreferrer");
  }
  async function copyLink() {
    if (!challengeId) return;
    try {
      await navigator.clipboard.writeText(shareUrl());
      setError("");
      const label = $("ocCopy"); label.textContent = "✅ Copiato!";
      setTimeout(() => { label.textContent = "📋 Copia link"; },1500);
    } catch {
      $("ocLink").select();
      setError("Seleziona e copia il link nel campo qui sopra.");
    }
  }
  function invite() {
    if (!challengeId) return;
    shareOnWhatsApp("🏁 Sfida Aperta Western Spritz! 🤠 5 domande, 15 secondi ciascuna e una classifica per tutti. Accetta: "+shareUrl());
  }
  function shareResult() {
    if (!data?.me || !challengeId) return;
    shareOnWhatsApp("🏆 Sfida Aperta Western Spritz! 🤠 Ho fatto "+formatScore(data.me.score)+
      " punti e sono al posto "+(data.me.rank || "—")+". Riesci a battermi? "+shareUrl());
  }
  function showBoard() {
    if (data?.me?.status==="playing" && data.challenge.status==="open") {
      setError("Concludi prima le cinque domande: il tempo continua a scorrere.");
      return;
    }
    if (!data) { setError("Crea o apri prima una Sfida Aperta."); return; }
    boardView = true; renderBoard();
  }
  function backToGame() {
    boardView = false;
    if (!data) { enterWelcome(); return; }
    render();
  }
  async function create() {
    const name = String($("ocNickname").value || "").trim();
    if (!validNickname(name)) { setError("Inserisci un nickname da 2 a 18 caratteri."); return; }
    await run(async () => {
      saveNickname(name);
      data = await post("create",{nickname:name});
      challengeId = data.challenge.id;
      saveLastId(challengeId);
      boardView = false;
      render();
    });
  }
  async function join() {
    const name = String($("ocJoinNickname").value || "").trim();
    if (!validNickname(name)) { setError("Inserisci un nickname da 2 a 18 caratteri."); return; }
    await run(async () => {
      saveNickname(name);
      data = await post("join",{nickname:name});
      saveLastId(challengeId);
      boardView = false;
      render();
    });
  }
  async function start() {
    await run(async () => {
      data = await post("start");
      boardView = false; render();
    });
  }
  async function answer(index) {
    if (!data?.me?.question || pending) return;
    const questionId = data.me.question.id;
    stopTimer();
    for (const button of $("ocAnswers").children) button.disabled = true;
    await run(async () => {
      const next = await post("answer",{questionId,answerIndex:index});
      data = next;
      render();
      if (next.notice && !$("ocQuiz").classList.contains("hidden")) {
        writeText("ocFeedback",next.notice.correct ? "✅ +"+next.notice.gained+" punti!" : "❌ Nessun punto per la domanda precedente.");
      }
    });
  }
  $("btnOpenChallenge")?.addEventListener("click",() => open(challengeId || getLastId()));
  $("ocClose").addEventListener("click",close);
  $("ocTabBoard").addEventListener("click",showBoard);
  $("ocTabGame").addEventListener("click",backToGame);
  $("ocCreate").addEventListener("click",create);
  $("ocJoin").addEventListener("click",join);
  $("ocStart").addEventListener("click",start);
  $("ocCopy").addEventListener("click",copyLink);
  $("ocWhatsApp").addEventListener("click",invite);
  $("ocLobbyNew").addEventListener("click",startNew);
  $("ocResultNew").addEventListener("click",startNew);
  $("ocLobbyBoard").addEventListener("click",showBoard);
  $("ocInviteBoard").addEventListener("click",showBoard);
  $("ocResultBoard").addEventListener("click",showBoard);
  $("ocBoardBack").addEventListener("click",backToGame);
  $("ocBoardReload").addEventListener("click",() => refresh());
  $("ocBoardShare").addEventListener("click",invite);
  $("ocResultShare").addEventListener("click",shareResult);
  document.addEventListener("keydown",event => {
    if (event.key==="Escape" && active) close();
  });
  document.addEventListener("visibilitychange",() => {
    if (!document.hidden && active && challengeId) refresh(false);
  });
  const initial = new URL(location.href).searchParams.get("openChallenge") || "";
  if (/^[a-f0-9]{20}$/.test(initial)) open(initial);
})();
