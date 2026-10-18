/* Western Spritz — Catalano extra v2 · richiesta completa + gestione utenti */
(() => {
  const $ = sel => document.querySelector(sel);
  const S_KEY = 'ws_catalano_token';
  const S_USER_KEY = 'ws_catalano_user';
  let adminPassword = '';

  function getCatalanoUsername(){
    try { return String(sessionStorage.getItem(S_USER_KEY) || '').trim(); }
    catch { return ''; }
  }

  function isCatalanoAdmin(){
    try {
      return !!sessionStorage.getItem(S_KEY) && getCatalanoUsername().toLowerCase() === 'max';
    } catch {
      return false;
    }
  }

  function syncAdminButton(){
    const btn = $('#btnCatalanoAdmin');
    if (btn) btn.classList.toggle('hidden', !isCatalanoAdmin());
  }

  function escapeHtml(value){
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showRequestError(message){
    const err = $('#saggioRequestError');
    if (!err) return;
    err.textContent = message;
    err.classList.remove('hidden');
  }

  function getRequestValues(){
    return {
      name: $('#saggioRequestName')?.value.trim() || '',
      email: $('#saggioRequestEmail')?.value.trim().toLowerCase() || '',
      reason: $('#saggioRequestReason')?.value.trim() || '',
      user: $('#saggioRequestUser')?.value.trim() || '',
      pass: $('#saggioRequestPass')?.value || '',
      pass2: $('#saggioRequestPass2')?.value || ''
    };
  }

  function isRequestFormValid(){
    const form = $('#saggioRequestForm');
    if (!form) return false;
    const { name, email, reason, user, pass, pass2 } = getRequestValues();
    return form.checkValidity()
      && !!name
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      && reason.length >= 1
      && reason.length <= 100
      && user.length >= 3
      && /^[A-Za-z0-9._-]+$/.test(user)
      && pass.length >= 4
      && pass === pass2;
  }

  function syncRequestSubmit(){
    const submitBtn = $('#saggioRequestSubmit');
    const counter = $('#saggioRequestReasonCount');
    const reasonLength = ($('#saggioRequestReason')?.value || '').length;
    if (counter) counter.textContent = `${reasonLength}/100 caratteri`;
    if (submitBtn && submitBtn.dataset.sending !== '1') {
      submitBtn.disabled = !isRequestFormValid();
    }
  }

  const requestForm = $('#saggioRequestForm');
  requestForm?.addEventListener('input', syncRequestSubmit);
  requestForm?.addEventListener('change', syncRequestSubmit);
  requestForm?.addEventListener('reset', () => setTimeout(syncRequestSubmit, 0));
  syncRequestSubmit();

  // Sostituisce il submit originale solo per la richiesta di accredito, mantenendo
  // la logica principale dell'app e validando tutti i campi prima dell'invio.
  requestForm?.addEventListener('submit', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.currentTarget;
    const { name, email, reason, user, pass, pass2 } = getRequestValues();
    const err = $('#saggioRequestError');
    const status = $('#saggioRequestStatus');
    const submitBtn = $('#saggioRequestSubmit');

    err?.classList.add('hidden');
    status?.classList.add('hidden');

    if (!name || !email || !reason || user.length < 3 || pass.length < 4) {
      showRequestError('Compila correttamente tutti i campi. Username minimo 3 caratteri e password minimo 4.');
      syncRequestSubmit();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showRequestError('Inserisci un indirizzo email valido.');
      syncRequestSubmit();
      return;
    }
    if (reason.length > 100) {
      showRequestError('La motivazione può contenere al massimo 100 caratteri.');
      syncRequestSubmit();
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(user)) {
      showRequestError('Lo username può contenere solo lettere, numeri, punto, trattino e underscore.');
      syncRequestSubmit();
      return;
    }
    if (pass !== pass2) {
      showRequestError('Le due password non coincidono.');
      syncRequestSubmit();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      syncRequestSubmit();
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.dataset.sending = '1';
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
        body: JSON.stringify({ name, email, reason, username: user, password: pass })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Invio non riuscito');

      form?.reset();
      status?.classList.add('hidden');
      $('#saggioRequestModal')?.classList.add('hidden');
      $('#catalanoRequestAckModal')?.classList.remove('hidden');
      setTimeout(() => $('#catalanoRequestAckOk')?.focus(), 30);
    } catch (ex) {
      console.error('Errore richiesta accesso Catalano', ex);
      status?.classList.add('hidden');
      showRequestError(ex?.message || 'Non è stato possibile inviare la richiesta. Riprova tra poco.');
    } finally {
      if (submitBtn) {
        submitBtn.textContent = submitBtn.dataset.oldText || 'Invia richiesta';
        delete submitBtn.dataset.oldText;
        delete submitBtn.dataset.sending;
      }
      syncRequestSubmit();
    }
  }, true);

  function closeAdmin(){
    $('#catalanoAdminModal')?.classList.add('hidden');
    const pass = $('#catalanoAdminPass');
    if (pass) pass.value = '';
    adminPassword = '';
  }

  function openAdmin(){
    if (!isCatalanoAdmin()) return;
    const err = $('#catalanoAdminError');
    const list = $('#catalanoAdminList');
    err?.classList.add('hidden');
    if (list) {
      list.classList.add('hidden');
      list.innerHTML = '';
    }
    $('#catalanoAdminModal')?.classList.remove('hidden');
    setTimeout(() => $('#catalanoAdminPass')?.focus(), 30);
  }

  async function adminRequest(action, username = ''){
    const password = adminPassword || ($('#catalanoAdminPass')?.value || '');
    const res = await fetch('/api/catalano-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        adminUser: getCatalanoUsername(),
        adminPassword: password,
        username
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Operazione non riuscita');
    return data;
  }

  function renderUsers(users){
    const list = $('#catalanoAdminList');
    if (!list) return;
    const rows = Array.isArray(users) ? users : [];
    if (!rows.length) {
      list.innerHTML = '<div class="catalano-admin-empty">Nessun utente approvato tramite registrazione.</div>';
    } else {
      list.innerHTML = rows.map(u => {
        const approved = u.approvedAt ? new Date(u.approvedAt).toLocaleString('it-IT') : '—';
        return `<div class="catalano-admin-user">
          <div class="catalano-admin-user-info">
            <b>${escapeHtml(u.name || u.user || '')}</b>
            <span>@${escapeHtml(u.user || '')}</span>
            <small>${escapeHtml(u.email || 'email non disponibile')}</small>
            <small>Approvato: ${escapeHtml(approved)}</small>
          </div>
          <button class="btn ghost catalano-admin-delete" type="button" data-delete-catalano-user="${escapeHtml(u.user || '')}">🗑️ Elimina</button>
        </div>`;
      }).join('');
    }
    list.classList.remove('hidden');
  }

  $('#btnCatalanoAdmin')?.addEventListener('click', openAdmin);
  $('#catalanoAdminClose')?.addEventListener('click', closeAdmin);

  $('#catalanoAdminAuthForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#catalanoAdminError');
    const btn = $('#catalanoAdminLoad');
    const pass = $('#catalanoAdminPass')?.value || '';
    err?.classList.add('hidden');
    if (!pass) return;

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Caricamento…'; }
      adminPassword = pass;
      const data = await adminRequest('list');
      renderUsers(data.users);
    } catch (ex) {
      adminPassword = '';
      if (err) {
        err.textContent = ex?.message || 'Accesso amministratore non riuscito.';
        err.classList.remove('hidden');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Carica utenti'; }
    }
  });

  $('#catalanoAdminList')?.addEventListener('click', async e => {
    const btn = e.target.closest?.('[data-delete-catalano-user]');
    if (!btn) return;
    const username = btn.dataset.deleteCatalanoUser || '';
    if (!username) return;
    if (!confirm(`Cancellare l'utente ${username}? Non potrà più effettuare nuovi accessi. Una sessione già aperta terminerà alla chiusura dell'app.`)) return;

    const err = $('#catalanoAdminError');
    err?.classList.add('hidden');
    try {
      btn.disabled = true;
      btn.textContent = 'Elimino…';
      await adminRequest('delete', username);
      const data = await adminRequest('list');
      renderUsers(data.users);
    } catch (ex) {
      if (err) {
        err.textContent = ex?.message || 'Non è stato possibile cancellare l’utente.';
        err.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.textContent = '🗑️ Elimina';
    }
  });

  const logoutBtn = $('#btnCatalanoLogout');
  if (logoutBtn) {
    new MutationObserver(syncAdminButton).observe(logoutBtn, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('pageshow', syncAdminButton);
  syncAdminButton();
})();
