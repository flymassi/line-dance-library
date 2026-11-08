/* Western Spritz — Catalano authentication: one active session per user, admin exempt. */
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
  function showReplacedNotice() {
    // A visible notice, even if the old tab is restored after being in background.
    if (document.getElementById("wsCatalanoReplaced")) return;
    const notice = document.createElement("div");
    notice.id = "wsCatalanoReplaced";
    notice.className = "catalano-disconnect-notice";
    notice.setAttribute("role","alert");
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "🔒 Sessione Catalano terminata";
    const message = document.createElement("p");
    message.textContent = "Un altro dispositivo ha effettuato l'accesso con lo stesso username e password. Per sicurezza questa sessione è stata disconnessa.";
    body.append(title, message);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.textContent = "Ho capito";
    button.addEventListener("click",()=>notice.remove());
    notice.append(body,button);
    document.body.appendChild(notice);
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
          const replaced = payload?.code === "SESSION_REPLACED";
          clearLocal();
          updateInterface(previous);
          if (replaced) showReplacedNotice();
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
  // Periodic checks evict replaced accounts while their page is still open.
  // A hidden/background tab is checked as soon as the user returns.
  setInterval(()=>{ if (!document.hidden && authenticated) refresh(); },30000);
})();

/* ====== CARICAMENTO WESTERN SPRITZ CHALLENGE ====== */
(() => {
  if (document.querySelector('script[data-ws-challenge-loader]')) return;
  const script = document.createElement('script');
  script.src = './challenge.js?v=2';
  script.dataset.wsChallengeLoader = '1';
  document.head.appendChild(script);
})();
