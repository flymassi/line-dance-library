/* Western Spritz — Catalano session persistence v1 · 6 ore */
(() => {
  const TOKEN_KEY = 'ws_catalano_token';
  const USER_KEY = 'ws_catalano_user';
  const EXPIRES_KEY = 'ws_catalano_expires_at';
  const SESSION_MS = 6 * 60 * 60 * 1000;

  let expiryTimer = null;

  function clearTimer(){
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function clearAuthStorage(){
    clearTimer();
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    } catch {}
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {}
  }

  function readPersistentSession(){
    try {
      return {
        token: String(localStorage.getItem(TOKEN_KEY) || ''),
        user: String(localStorage.getItem(USER_KEY) || ''),
        expiresAt: Number(localStorage.getItem(EXPIRES_KEY) || 0)
      };
    } catch {
      return { token: '', user: '', expiresAt: 0 };
    }
  }

  function restoreSessionStorage(token, user){
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (user) sessionStorage.setItem(USER_KEY, user);
      else sessionStorage.removeItem(USER_KEY);
      return true;
    } catch {
      return false;
    }
  }

  const originalLogoutCatalano = typeof window.logoutCatalano === 'function'
    ? window.logoutCatalano
    : null;

  function expireSession(){
    const current = readPersistentSession();
    if (current.token && Number.isFinite(current.expiresAt) && current.expiresAt > Date.now()) {
      scheduleExpiry(current.expiresAt);
      return;
    }

    clearAuthStorage();
    if (originalLogoutCatalano) {
      try { originalLogoutCatalano(); } catch {}
    } else {
      try {
        if (typeof window.syncCourseFilterUI === 'function') window.syncCourseFilterUI();
        if (typeof window.render === 'function') window.render();
      } catch {}
    }
  }

  function scheduleExpiry(expiresAt){
    clearTimer();
    const delay = Number(expiresAt) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      expireSession();
      return;
    }
    expiryTimer = setTimeout(expireSession, delay);
  }

  function persistSession(token, user){
    if (!token) return false;
    const expiresAt = Date.now() + SESSION_MS;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, user || '');
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));
      scheduleExpiry(expiresAt);
      return true;
    } catch {
      return false;
    }
  }

  function persistCurrentSession(){
    try {
      const token = String(sessionStorage.getItem(TOKEN_KEY) || '');
      const user = String(sessionStorage.getItem(USER_KEY) || '');
      return persistSession(token, user);
    } catch {
      return false;
    }
  }

  function restoreOrMigrateSession(){
    const saved = readPersistentSession();

    if (saved.token || saved.expiresAt) {
      if (
        saved.token &&
        Number.isFinite(saved.expiresAt) &&
        saved.expiresAt > Date.now()
      ) {
        restoreSessionStorage(saved.token, saved.user);
        scheduleExpiry(saved.expiresAt);
        return true;
      }

      clearAuthStorage();
      return false;
    }

    return persistCurrentSession();
  }

  function validateSession(){
    const saved = readPersistentSession();

    if (!saved.token || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) {
      if (saved.token || saved.expiresAt) expireSession();
      return false;
    }

    restoreSessionStorage(saved.token, saved.user);
    scheduleExpiry(saved.expiresAt);
    return true;
  }

  const originalActivateCatalanoCourse = typeof window.activateCatalanoCourse === 'function'
    ? window.activateCatalanoCourse
    : null;

  if (originalActivateCatalanoCourse) {
    window.activateCatalanoCourse = function(...args){
      persistCurrentSession();
      return originalActivateCatalanoCourse.apply(this, args);
    };
  }

  if (originalLogoutCatalano) {
    window.logoutCatalano = function(...args){
      clearAuthStorage();
      return originalLogoutCatalano.apply(this, args);
    };
  }

  const restored = restoreOrMigrateSession();
  if (restored) {
    try {
      if (typeof window.syncCourseFilterUI === 'function') window.syncCourseFilterUI();
      if (typeof window.render === 'function') window.render();
    } catch {}
  }

  window.addEventListener('focus', validateSession);
  window.addEventListener('pageshow', validateSession);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) validateSession();
  });
})();

/* ====== CARICAMENTO WESTERN SPRITZ CHALLENGE ====== */
(() => {
  if (document.querySelector('script[data-ws-challenge-loader]')) return;
  const script = document.createElement('script');
  script.src = './challenge.js?v=2';
  script.dataset.wsChallengeLoader = '1';
  document.head.appendChild(script);
})();
