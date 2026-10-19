/* Western Spritz Challenge v1 */
const BUTTON_HTML = `
<button id="btnChallenge" class="btn btn-glass btn-amber btn-slim challenge-btn-featured" type="button">
  <span class="btn-icon">🏆</span>
  <span class="btn-label">Sfida</span>
</button>`;

const MODAL_HTML = `
<div id="challengeModal" class="overlay hidden" aria-hidden="true">
  <div class="pl-card challenge-card" role="dialog" aria-modal="true" aria-labelledby="challengeTitle">
    <div class="pl-top challenge-top">
      <div>
        <h3 id="challengeTitle">🏆 Western Spritz Challenge</h3>
        <p class="challenge-subtitle">10 domande • 15 secondi ciascuna • classifica condivisa</p>
      </div>
      <button id="challengeClose" class="btn ghost" type="button">Chiudi</button>
    </div>

    <section id="challengeHome">
      <div class="challenge-home-grid">
        <div class="challenge-panel">
          <div class="challenge-hero-row">
            <div>
              <h4>🤠 Sfida del giorno</h4>
              <p class="challenge-note">Una sola partita ufficiale al giorno per dispositivo. Dopo puoi allenarti quanto vuoi.</p>
            </div>
            <div class="challenge-count">
              <small>Partecipanti oggi</small>
              <strong id="challengePlayersToday">—</strong>
            </div>
          </div>

          <div class="challenge-stat-grid">
            <div class="challenge-stat">
              <small>🥇 Sceriffo del giorno</small>
              <strong id="challengeSheriff">Caricamento…</strong>
              <span id="challengeSheriffScore" class="challenge-note">—</span>
            </div>
            <div class="challenge-stat">
              <small>🏆 Campione settimana</small>
              <strong id="challengeWeekChampion">Caricamento…</strong>
              <span id="challengeWeekScore" class="challenge-note">—</span>
            </div>
            <div class="challenge-stat">
              <small>⚡ Punteggio</small>
              <strong>Precisione + velocità</strong>
              <span class="challenge-note">Calcolato sul server</span>
            </div>
          </div>

          <div class="challenge-start-row">
            <input id="challengeNickname" class="input" type="text" maxlength="18" autocomplete="nickname" placeholder="Come vuoi comparire? Es. Max" />
            <button id="challengeStart" class="btn btn-primary" type="button">Inizia / Riprendi</button>
          </div>
          <p id="challengeError" class="challenge-error hidden"></p>
          <p class="challenge-note">Il nickname resta sul tuo dispositivo. Non servono email o password.</p>
        </div>

        <div class="challenge-panel">
          <strong>Classifica di oggi</strong>
          <ol id="challengeMiniBoard" class="challenge-mini-board">
            <li><span>Caricamento…</span><strong>—</strong></li>
          </ol>
          <button id="challengeViewBoard" class="btn ghost challenge-board-link" type="button">Vedi classifica completa</button>
        </div>
      </div>
    </section>

    <section id="challengeQuiz" class="challenge-panel hidden" style="margin-top:14px">
      <div class="challenge-quiz-head">
        <div>
          <span id="challengeModeBadge" class="challenge-mode-badge">🏆 Tentativo ufficiale</span>
          <div id="challengeProgress" class="challenge-progress" style="margin-top:8px">Domanda 1 di 10</div>
          <div id="challengeQuestion" class="challenge-question">Caricamento domanda…</div>
        </div>
        <div class="challenge-score-boxes">
          <div class="challenge-score-box"><small>Tempo</small><strong id="challengeTimer">15</strong>s</div>
          <div class="challenge-score-box"><small>Punti</small><strong id="challengeScore">0</strong></div>
        </div>
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
          <div class="challenge-actions">
            <button id="challengeTraining" class="btn btn-primary" type="button">Gioca allenamento</button>
            <button id="challengeResultBoard" class="btn ghost" type="button">Vai alla classifica</button>
            <button id="challengeBackHome" class="btn ghost" type="button">Home sfida</button>
          </div>
        </div>
        <div>
          <strong>Premi e progressi</strong>
          <div class="challenge-awards">
            <div class="challenge-award"><div class="emoji">🎯</div><strong id="challengeResultAccuracy">0%</strong><small>Precisione</small></div>
            <div class="challenge-award"><div class="emoji">⏱️</div><strong id="challengeResultTime">0:00</strong><small>Tempo totale</small></div>
            <div class="challenge-award"><div class="emoji">🔥</div><strong id="challengeResultStreak">—</strong><small>Serie attiva</small></div>
          </div>
        </div>
      </div>
    </section>

    <section id="challengeBoard" class="challenge-panel hidden" style="margin-top:14px">
      <div class="pl-top">
        <strong>🏆 Classifica Western Spritz</strong>
        <button id="challengeBoardBack" class="btn ghost" type="button">Indietro</button>
      </div>
      <div class="challenge-tabs" role="tablist" aria-label="Periodo classifica">
        <button class="challenge-tab active" type="button" data-challenge-period="today">Oggi</button>
        <button class="challenge-tab" type="button" data-challenge-period="week">Settimana</button>
        <button class="challenge-tab" type="button" data-challenge-period="hall">Hall of Fame</button>
      </div>
      <div class="challenge-table-wrap">
        <table class="challenge-table">
          <thead id="challengeBoardHead"><tr><th>Pos.</th><th>Giocatore</th><th>Punti</th><th>Corrette</th><th>Tempo</th></tr></thead>
          <tbody id="challengeBoardBody"><tr><td colspan="5" class="challenge-loading">Caricamento…</td></tr></tbody>
        </table>
      </div>
    </section>
  </div>
</div>`;

(() => {
  if (!document.querySelector('link[data-ws-challenge-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './challenge.css?v=1';
    link.dataset.wsChallengeCss = '1';
    document.head.appendChild(link);
  }

  if (!document.getElementById('btnChallenge')) {
    const playlist = document.getElementById('btnPlaylist');
    const actions = playlist?.parentElement || document.querySelector('.actions-top');
    if (actions) {
      const holder = document.createElement('div');
      holder.innerHTML = BUTTON_HTML.trim();
      const button = holder.firstElementChild;
      if (button) actions.insertBefore(button, playlist || null);
    }
  }

  if (!document.getElementById('challengeModal')) {
    const anchor = document.getElementById('saggioLoginModal');
    const holder = document.createElement('div');
    holder.innerHTML = MODAL_HTML.trim();
    const challenge = holder.firstElementChild;
    if (challenge) {
      if (anchor?.parentNode) anchor.parentNode.insertBefore(challenge, anchor);
      else document.body.appendChild(challenge);
    }
  }

  const $ = sel => document.querySelector(sel);
  const modal = $('#challengeModal');
  const openBtn = $('#btnChallenge');
  const closeBtn = $('#challengeClose');
  if (!modal || !openBtn || !closeBtn) return;

  const NICK_KEY = 'ws_challenge_nickname';
  const DEVICE_KEY = 'ws_challenge_device';
  const API = '/api/challenge';
  let session = null;
  let timerId = null;
  let deadlineAt = 0;
  let answering = false;

  const home = $('#challengeHome');
  const quiz = $('#challengeQuiz');
  const result = $('#challengeResult');
  const board = $('#challengeBoard');
  const nicknameInput = $('#challengeNickname');
  const startBtn = $('#challengeStart');
  const errorEl = $('#challengeError');
  const feedback = $('#challengeFeedback');

  function makeDeviceId(){
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let out = '';
      for (let i = 0; i < 32; i += 1) out += Math.floor(Math.random() * 16).toString(16);
      return out;
    }
  }

  function getDeviceId(){
    try {
      let value = String(localStorage.getItem(DEVICE_KEY) || '');
      if (!/^[a-f0-9]{32,64}$/.test(value)) {
        value = makeDeviceId();
        localStorage.setItem(DEVICE_KEY, value);
      }
      return value;
    } catch {
      return makeDeviceId();
    }
  }

  function getSavedNickname(){
    try { return String(localStorage.getItem(NICK_KEY) || ''); } catch { return ''; }
  }

  function saveNickname(value){
    try { localStorage.setItem(NICK_KEY, value); } catch {}
  }

  function showOnly(target){
    [home, quiz, result, board].forEach(section => section?.classList.add('hidden'));
    target?.classList.remove('hidden');
  }

  function setError(message = ''){
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
  }

  function formatScore(value){
    return Number(value || 0).toLocaleString('it-IT');
  }

  function formatDuration(ms){
    const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  async function apiGet(period = 'today'){
    const res = await fetch(`${API}?period=${encodeURIComponent(period)}`, { cache:'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Classifica non disponibile');
    return data;
  }

  async function apiPost(payload){
    const res = await fetch(API, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload),
      cache:'no-store'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Operazione non riuscita');
    return data;
  }

  function renderMiniBoard(rows){
    const list = $('#challengeMiniBoard');
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(rows) || !rows.length) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const right = document.createElement('strong');
      left.textContent = 'Ancora nessun punteggio.';
      right.textContent = '—';
      li.append(left, right);
      list.appendChild(li);
      return;
    }
    rows.slice(0,5).forEach(row => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const right = document.createElement('strong');
      const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}.`;
      left.textContent = `${medal} ${row.nickname}`;
      right.textContent = formatScore(row.score);
      li.append(left, right);
      list.appendChild(li);
    });
  }

  async function loadHome(){
    const count = $('#challengePlayersToday');
    const sheriff = $('#challengeSheriff');
    const sheriffScore = $('#challengeSheriffScore');
    const weekChampion = $('#challengeWeekChampion');
    const weekScore = $('#challengeWeekScore');
    try {
      const [today, week] = await Promise.all([apiGet('today'), apiGet('week')]);
      if (count) count.textContent = String(today.participants || 0);
      if (sheriff) sheriff.textContent = today.rows?.[0]?.nickname || 'Da conquistare';
      if (sheriffScore) sheriffScore.textContent = today.rows?.[0] ? `${formatScore(today.rows[0].score)} punti` : 'Nessun punteggio';
      if (weekChampion) weekChampion.textContent = week.rows?.[0]?.nickname || 'Da conquistare';
      if (weekScore) weekScore.textContent = week.rows?.[0] ? `${formatScore(week.rows[0].score)} punti` : 'Nessun punteggio';
      renderMiniBoard(today.rows || []);
    } catch {
      if (count) count.textContent = '—';
      renderMiniBoard([]);
    }
  }

  function clearTimer(){
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function openModal(){
    clearTimer();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    showOnly(home);
    setError('');
    if (nicknameInput && !nicknameInput.value) nicknameInput.value = getSavedNickname();
    loadHome();
    setTimeout(() => nicknameInput?.focus(), 30);
  }

  function closeModal(){
    clearTimer();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function updateTimer(){
    const timer = $('#challengeTimer');
    if (!timer) return;
    const ms = Math.max(0, deadlineAt - Date.now());
    const seconds = Math.ceil(ms / 1000);
    timer.textContent = String(seconds);
    timer.parentElement?.classList.toggle('challenge-timer-danger', seconds <= 5);
    if (ms <= 0 && !answering) {
      clearTimer();
      submitAnswer(null);
    }
  }

  function startTimer(remainingMs){
    clearTimer();
    deadlineAt = Date.now() + Math.max(0, Number(remainingMs || 0));
    updateTimer();
    timerId = setInterval(updateTimer, 200);
  }

  function renderQuestion(remainingMs = null){
    if (!session) return;
    const index = Number(session.currentIndex || 0);
    const question = session.questions?.[index];
    if (!question) return;
    const progress = $('#challengeProgress');
    const questionEl = $('#challengeQuestion');
    const scoreEl = $('#challengeScore');
    const mode = $('#challengeModeBadge');
    const answers = $('#challengeAnswers');
    if (progress) progress.textContent = `Domanda ${index + 1} di ${session.questionCount}`;
    if (questionEl) questionEl.textContent = question.prompt;
    if (scoreEl) scoreEl.textContent = formatScore(session.score);
    if (mode) mode.textContent = session.official ? '🏆 Tentativo ufficiale' : '🎯 Allenamento';
    if (feedback) {
      feedback.textContent = '';
      feedback.className = 'challenge-feedback';
    }
    if (answers) {
      answers.innerHTML = '';
      question.options.forEach((text, answerIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'challenge-answer';
        button.textContent = text;
        button.addEventListener('click', () => submitAnswer(answerIndex));
        answers.appendChild(button);
      });
    }
    const duration = remainingMs == null ? Number(session.secondsPerQuestion || 15) * 1000 : Number(remainingMs);
    startTimer(duration);
  }

  async function startChallenge(){
    const nickname = String(nicknameInput?.value || '').replace(/\s+/g,' ').trim();
    if (nickname.length < 2 || nickname.length > 18) {
      setError('Inserisci un nickname da 2 a 18 caratteri.');
      nicknameInput?.focus();
      return;
    }
    setError('');
    saveNickname(nickname);
    const oldText = startBtn?.textContent;
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = 'Avvio…';
    }
    try {
      session = await apiPost({ action:'start', nickname, deviceId:getDeviceId() });
      showOnly(quiz);
      renderQuestion(session.remainingMs);
    } catch (err) {
      setError(err?.message || 'Sfida non disponibile.');
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = oldText || 'Inizia / Riprendi';
      }
    }
  }

  async function submitAnswer(answerIndex){
    if (!session || answering) return;
    answering = true;
    clearTimer();
    const answerButtons = Array.from(document.querySelectorAll('#challengeAnswers .challenge-answer'));
    answerButtons.forEach(btn => { btn.disabled = true; });
    try {
      const data = await apiPost({
        action:'answer',
        sessionId:session.sessionId,
        deviceId:getDeviceId(),
        questionIndex:session.currentIndex,
        answerIndex:Number.isInteger(answerIndex) ? answerIndex : null
      });
      session.score = data.score;
      session.correct = data.correctCount;
      session.currentIndex = data.currentIndex;
      const scoreEl = $('#challengeScore');
      if (scoreEl) scoreEl.textContent = formatScore(session.score);
      if (feedback) {
        feedback.className = `challenge-feedback ${data.correct ? 'challenge-good' : 'challenge-bad'}`;
        feedback.textContent = data.correct
          ? `✅ Corretta! +${formatScore(data.points)} punti`
          : data.timedOut
            ? `⏱️ Tempo scaduto. Risposta: ${data.correctAnswer}`
            : `❌ Risposta corretta: ${data.correctAnswer}`;
      }
      await new Promise(resolve => setTimeout(resolve, 750));
      if (data.finished) {
        showResult(data);
      } else {
        renderQuestion(Number(session.secondsPerQuestion || 15) * 1000);
      }
    } catch (err) {
      if (feedback) {
        feedback.className = 'challenge-feedback challenge-bad';
        feedback.textContent = err?.message || 'Errore. Tocca una risposta per riprovare.';
      }
      answerButtons.forEach(btn => { btn.disabled = false; });
      startTimer(Math.max(0, deadlineAt - Date.now()));
    } finally {
      answering = false;
    }
  }

  function showResult(data){
    clearTimer();
    const r = data.result || {};
    showOnly(result);
    $('#challengeResultMode').textContent = data.official ? '🏆 Risultato ufficiale' : '🎯 Allenamento';
    $('#challengeResultScore').textContent = `${formatScore(r.score)} punti`;
    $('#challengeResultCorrect').textContent = `${r.correct}/${r.total} risposte corrette`;
    $('#challengeResultAccuracy').textContent = `${Math.round((Number(r.correct || 0) / Math.max(1, Number(r.total || 1))) * 100)}%`;
    $('#challengeResultTime').textContent = formatDuration(r.durationMs);
    $('#challengeResultStreak').textContent = data.official ? `${Number(r.streak || 1)} giorn${Number(r.streak || 1) === 1 ? 'o' : 'i'}` : '—';
    const placement = $('#challengePlacement');
    if (placement) {
      placement.textContent = data.official && r.rank
        ? `Sei ${r.rank}º su ${r.participants} giocatori di oggi.`
        : 'Partita di allenamento: il risultato non modifica la classifica.';
    }
    loadHome();
  }

  async function showBoard(mode = 'today'){
    showOnly(board);
    const body = $('#challengeBoardBody');
    const head = $('#challengeBoardHead');
    if (body) body.innerHTML = '<tr><td colspan="5" class="challenge-loading">Caricamento classifica…</td></tr>';
    document.querySelectorAll('.challenge-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.challengePeriod === mode));
    try {
      const data = await apiGet(mode);
      if (head) {
        head.innerHTML = mode === 'today'
          ? '<tr><th>Pos.</th><th>Giocatore</th><th>Punti</th><th>Corrette</th><th>Tempo</th></tr>'
          : '<tr><th>Pos.</th><th>Giocatore</th><th>Punti</th><th>Partite</th><th>Serie</th></tr>';
      }
      if (!body) return;
      body.innerHTML = '';
      if (!data.rows?.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'challenge-empty';
        td.textContent = 'La classifica è ancora vuota.';
        tr.appendChild(td);
        body.appendChild(tr);
        return;
      }
      data.rows.forEach(row => {
        const tr = document.createElement('tr');
        const cells = mode === 'today'
          ? [row.rank, row.nickname, formatScore(row.score), `${row.correct}/${data.config.questionCount}`, formatDuration(row.durationMs)]
          : [row.rank, row.nickname, formatScore(row.score), row.games, `${row.streak || 0} gg`];
        cells.forEach((value, index) => {
          const td = document.createElement('td');
          td.textContent = index === 0 && row.rank <= 3 ? `${['🥇','🥈','🥉'][row.rank - 1]} ${row.rank}` : String(value);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    } catch (err) {
      if (body) {
        body.innerHTML = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'challenge-empty';
        td.textContent = String(err?.message || 'Classifica non disponibile');
        tr.appendChild(td);
        body.appendChild(tr);
      }
    }
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  startBtn?.addEventListener('click', startChallenge);
  nicknameInput?.addEventListener('keydown', e => { if (e.key === 'Enter') startChallenge(); });
  nicknameInput?.addEventListener('input', () => setError(''));
  $('#challengeViewBoard')?.addEventListener('click', () => showBoard('today'));
  $('#challengeResultBoard')?.addEventListener('click', () => showBoard('today'));
  $('#challengeBackHome')?.addEventListener('click', () => { showOnly(home); loadHome(); });
  $('#challengeBoardBack')?.addEventListener('click', () => { showOnly(home); loadHome(); });
  $('#challengeTraining')?.addEventListener('click', () => { showOnly(home); startChallenge(); });
  document.querySelectorAll('.challenge-tab').forEach(btn => {
    btn.addEventListener('click', () => showBoard(btn.dataset.challengePeriod || 'today'));
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  if (nicknameInput) nicknameInput.value = getSavedNickname();
})();
