/* Western Spritz — Catalano authentication: server-verified, device-bound 6-hour sessions. */
(() => {
  const DEVICE_KEY = "ws_catalano_device_v1";
  const LEGACY_KEYS = ["ws_catalano_token","ws_catalano_user","ws_catalano_expires_at"];
  let authenticated = false, admin = false, username = "", expiresAt = 0;
  let requestInFlight = null, expiryTimer = null;

  // Old unverified tokens must never grant access after this upgrade.
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }
  function getDeviceId() {
    let device = "";
    try { device = String(localStorage.getItem(DEVICE_KEY) || ""); } catch {}
    if (/^[a-f0-9]{32,64}$/.test(device)) return device;
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    device = Array.from(bytes, v=>v.toString(16).padStart(2,"0")).join("");
    try { localStorage.setItem(DEVICE_KEY,device); } catch {}
    return device;
  }
  function isAuthenticated() {
    return authenticated && Date.now() < expiresAt;
  }
  function isAdmin() { return isAuthenticated() && admin; }
  function getUsername() { return isAuthenticated() ? username : ""; }
  function clearLocal() {
    authenticated = false; admin = false; username = ""; expiresAt = 0;
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  }
  function updateInterface(wasAuthenticated) {
    try {
      if (!isAuthenticated() && wasAuthenticated && typeof window.logoutCatalano === "function") {
        window.logoutCatalano();
      } else {
        if (typeof window.syncCourseFilterUI === "function") window.syncCourseFilterUI();
        if (typeof window.render === "function") window.render();
      }
    } catch (error) { console.error("CATALANO refresh UI",error); }
  }
  function expire() {
    const previous = authenticated;
    clearLocal();
    updateInterface(previous);
  }
  function storeSession(value) {
    authenticated = true;
    admin = !!value.admin;
    username = String(value.user || "");
    expiresAt = Number(value.expiresAt || 0);
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(expire, Math.max(0,expiresAt-Date.now()) + 25);
  }
  async function refresh() {
    if (requestInFlight) return requestInFlight;
    requestInFlight = (async () => {
      const previous = authenticated;
      try {
        const res = await fetch("/api/catalano-session",{
          method:"POST",credentials:"same-origin",cache:"no-store",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"verify",deviceId:getDeviceId()})
        });
        const payload = await res.json().catch(()=>({}));
        if (!res.ok || !payload?.ok || !payload?.authenticated) {
          clearLocal();
          updateInterface(previous);
          return false;
        }
        storeSession(payload);
        updateInterface(previous);
        return true;
      } catch (error) {
        // Fail closed when the server cannot be reached.
        console.error("CATALANO session validation",error);
        clearLocal();
        updateInterface(previous);
        return false;
      }
    })();
    try { return await requestInFlight; }
    finally { requestInFlight = null; }
  }
  async function logout() {
    const previous = authenticated;
    clearLocal();
    updateInterface(previous);
    try {
      await fetch("/api/catalano-session",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"logout",deviceId:getDeviceId()})
      });
    } catch (error) { console.error("CATALANO logout request",error); }
  }
  async function whenReady() {
    if (requestInFlight) await requestInFlight;
  }
  window.WSCatalanoSession = {
    getDeviceId, isAuthenticated, isAdmin, getUsername, refresh, logout, clearLocal, whenReady
  };
  // Restore access only after server verification; older localStorage tokens are ignored.
  refresh();
  window.addEventListener("focus",()=>{ if (!document.hidden) refresh(); });
  window.addEventListener("pageshow",()=>{ if (!document.hidden) refresh(); });
  document.addEventListener("visibilitychange",()=>{ if (!document.hidden) refresh(); });
  setInterval(()=>{ if (!document.hidden && authenticated) refresh(); },60000);
})();

/* ====== CARICAMENTO WESTERN SPRITZ CHALLENGE ====== */
(() => {
  if (document.querySelector('script[data-ws-challenge-loader]')) return;
  const script = document.createElement('script');
  script.src = './challenge.js?v=2';
  script.dataset.wsChallengeLoader = '1';
  document.head.appendChild(script);
})();
