/* Western Spritz — Catalano password reset v1 · approvazione amministratore */
(() => {
  const $ = sel => document.querySelector(sel);

  function emailValid(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
  }

  function userValid(value){
    const user = String(value || '').trim();
    return user.length >= 3 && user.length <= 30 && /^[A-Za-z0-9._-]+$/.test(user);
  }

  function setHidden(el, hidden){
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  const loginForm = $('#saggioLoginForm');
  const loginActions = loginForm?.querySelector('.catalano-auth-actions');
  if (!loginForm || !loginActions || $('#saggioForgotPassword')) return;

  const forgotWrap = document.createElement('div');
  forgotWrap.className = 'catalano-forgot-wrap';
  forgotWrap.innerHTML = '<button id="saggioForgotPassword" type="button" class="catalano-link-button">Password dimenticata?</button>';
  loginActions.before(forgotWrap);

  const modalHtml = `
    <div id="catalanoResetRequestModal" class="overlay hidden" aria-hidden="true">
      <div class="pl-card catalano-auth-card" role="dialog" aria-modal="true" aria-labelledby="catalanoResetTitle">
        <div class="pl-top">
          <h3 id="catalanoResetTitle">🔑 Recupera password Catalano</h3>
          <button id="catalanoResetClose" class="btn ghost" type="button">Chiudi</button>
        </div>
        <p class="saggio-note">
          Inserisci lo username e l'email usati nella registrazione. La password <b>non verrà modificata automaticamente</b>:
          la richiesta dovrà prima essere autorizzata dall'amministratore.
        </p>
        <form id="catalanoResetRequestForm" class="saggio-form">
          <label>
            Username
            <input id="catalanoResetUser" type="text" class="input" autocomplete="username" minlength="3" maxlength="30" pattern="[A-Za-z0-9._-]+" required />
          </label>
          <label>
            Email
            <input id="catalanoResetEmail" type="email" class="input" autocomplete="email" maxlength="254" required />
          </label>
          <p id="catalanoResetError" class="saggio-error hidden"></p>
          <p id="catalanoResetStatus" class="catalano-request-status hidden"></p>
          <div class="catalano-auth-actions">
            <button id="catalanoResetBack" type="button" class="btn ghost">Torna al login</button>
            <button id="catalanoResetSubmit" type="submit" class="btn btn-primary" disabled>Richiedi reset</button>
          </div>
        </form>
      </div>
    </div>

    <div id="catalanoResetAckModal" class="overlay hidden" aria-hidden="true">
      <div class="pl-card catalano-auth-card catalano-ack-card" role="dialog" aria-modal="true" aria-labelledby="catalanoResetAckTitle">
        <div class="pl-top">
          <h3 id="catalanoResetAckTitle">✅ Richiesta reset presa in carico</h3>
          <button id="catalanoResetAckClose" class="btn ghost" type="button">Chiudi</button>
        </div>
        <div class="catalano-ack-box">
          <p>La richiesta di reimpostazione della password è stata inviata all'amministratore.</p>
          <p>La password attuale <b>non è stata modificata</b>. Se la richiesta verrà autorizzata, riceverai dall'amministratore un link temporaneo per sceglierne una nuova.</p>
        </div>
        <div class="catalano-auth-actions">
          <button id="catalanoResetAckOk" type="button" class="btn btn-primary">OK</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const style = document.createElement('style');
  style.textContent = `
    .catalano-forgot-wrap{margin-top:-4px;margin-bottom:4px;text-align:right}
    .catalano-link-button{appearance:none;border:0;background:transparent;color:#facc15;padding:4px 0;font:inherit;font-size:.92rem;text-decoration:underline;cursor:pointer}
    .catalano-link-button:hover{opacity:.85}
    #catalanoResetSubmit:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(.35);box-shadow:none}
  `;
  document.head.appendChild(style);

  const resetModal = $('#catalanoResetRequestModal');
  const resetForm = $('#catalanoResetRequestForm');
  const resetUser = $('#catalanoResetUser');
  const resetEmail = $('#catalanoResetEmail');
  const resetSubmit = $('#catalanoResetSubmit');
  const resetError = $('#catalanoResetError');
  const resetStatus = $('#catalanoResetStatus');
  const ackModal = $('#catalanoResetAckModal');

  function resetFormValid(){
    return !!resetForm?.checkValidity()
      && userValid(resetUser?.value)
      && emailValid(resetEmail?.value);
  }

  function syncResetSubmit(){
    if (resetSubmit && resetSubmit.dataset.sending !== '1') {
      resetSubmit.disabled = !resetFormValid();
    }
  }

  function openReset(){
    setHidden($('#saggioLoginModal'), true);
    resetError?.classList.add('hidden');
    resetStatus?.classList.add('hidden');
    setHidden(resetModal, false);
    setTimeout(() => resetUser?.focus(), 30);
    syncResetSubmit();
  }

  function closeReset(showLogin = false){
    setHidden(resetModal, true);
    resetError?.classList.add('hidden');
    resetStatus?.classList.add('hidden');
    if (showLogin) {
      setHidden($('#saggioLoginModal'), false);
      setTimeout(() => $('#saggioUser')?.focus(), 30);
    }
  }

  function closeAck(){
    setHidden(ackModal, true);
  }

  $('#saggioForgotPassword')?.addEventListener('click', openReset);
  $('#catalanoResetClose')?.addEventListener('click', () => closeReset(true));
  $('#catalanoResetBack')?.addEventListener('click', () => closeReset(true));
  $('#catalanoResetAckClose')?.addEventListener('click', closeAck);
  $('#catalanoResetAckOk')?.addEventListener('click', closeAck);

  resetForm?.addEventListener('input', syncResetSubmit);
  resetForm?.addEventListener('change', syncResetSubmit);
  resetForm?.addEventListener('reset', () => setTimeout(syncResetSubmit, 0));
  syncResetSubmit();

  resetForm?.addEventListener('submit', async e => {
    e.preventDefault();

    const username = resetUser?.value.trim() || '';
    const email = resetEmail?.value.trim().toLowerCase() || '';

    resetError?.classList.add('hidden');
    resetStatus?.classList.add('hidden');

    if (!userValid(username) || !emailValid(email) || !resetForm.checkValidity()) {
      resetForm.reportValidity();
      syncResetSubmit();
      return;
    }

    try {
      if (resetSubmit) {
        resetSubmit.dataset.sending = '1';
        resetSubmit.disabled = true;
        resetSubmit.dataset.oldText = resetSubmit.textContent;
        resetSubmit.textContent = 'Invio…';
      }
      if (resetStatus) {
        resetStatus.textContent = 'Invio della richiesta in corso…';
        resetStatus.classList.remove('hidden');
      }

      const response = await fetch('/api/catalano-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Richiesta reset non riuscita');

      resetForm.reset();
      setHidden(resetModal, true);
      resetStatus?.classList.add('hidden');
      setHidden(ackModal, false);
      setTimeout(() => $('#catalanoResetAckOk')?.focus(), 30);
    } catch (err) {
      resetStatus?.classList.add('hidden');
      if (resetError) {
        resetError.textContent = err?.message || 'Non è stato possibile inviare la richiesta di reset. Riprova tra poco.';
        resetError.classList.remove('hidden');
      }
    } finally {
      if (resetSubmit) {
        resetSubmit.textContent = resetSubmit.dataset.oldText || 'Richiedi reset';
        delete resetSubmit.dataset.oldText;
        delete resetSubmit.dataset.sending;
      }
      syncResetSubmit();
    }
  });
})();
