/* Western Spritz — Line Dance username-only 8-hour access + administrator statistics. */
(() => {
  const DEVICE_KEY="ws_line_device_v1";
  const NAME_KEY="ws_line_last_username_v1";
  const CONFIRMED_KEY="ws_line_device_confirmed_v1";
  const $=id=>document.getElementById(id);
  let authenticated=false, username="", expiresAt=0, timer=null;
  let inFlight=null, generation=0, loginPending=false, logoutPending=null;
  let adminPassword="";

  function getDeviceId() {
    let id="";
    try {id=localStorage.getItem(DEVICE_KEY)||"";} catch {}
    if(/^[a-f0-9]{32,64}$/.test(id))return id;
    const bytes=new Uint8Array(20);
    crypto.getRandomValues(bytes);
    id=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
    try {localStorage.setItem(DEVICE_KEY,id);} catch {}
    return id;
  }
  function rememberedUsername() {
    try {
      const name=String(localStorage.getItem(NAME_KEY)||"").trim().replace(/\s+/g," ");
      return name.length>=2&&name.length<=30&&/^[\p{L}\p{N}][\p{L}\p{N}._ -]*$/u.test(name)?name:"";
    }catch{return "";}
  }
  function remember(value) {
    try{
      localStorage.setItem(NAME_KEY,String(value||""));
      localStorage.setItem(CONFIRMED_KEY,"1");
    }catch{}
  }
  function forget() {
    try{
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(CONFIRMED_KEY);
    }catch{}
  }
  function deviceConfirmed() {
    try{return localStorage.getItem(CONFIRMED_KEY)==="1";}catch{return false;}
  }
  function isAuthenticated(){return authenticated&&Date.now()<expiresAt;}
  function getUsername(){return isAuthenticated()?username:"";}
  function showError(id,message) {
    const element=$(id);
    if(!element)return;
    element.textContent=String(message||"");
    element.classList.toggle("hidden",!message);
  }
  function syncUI() {
    if(typeof window.syncCourseFilterUI==="function")window.syncCourseFilterUI();
    if(typeof window.render==="function")window.render();
  }
  function clearLocal() {
    authenticated=false;username="";expiresAt=0;
    if(timer){clearTimeout(timer);timer=null;}
  }
  function openLogin(message="") {
    if(isAuthenticated())return;
    const modal=$("lineLoginModal");
    const input=$("lineUsername");
    if(input&&!input.value) {
      try{input.value=localStorage.getItem(NAME_KEY)||"";}catch{}
    }
    showError("lineLoginError",message);
    modal?.classList.remove("hidden");
    modal?.setAttribute("aria-hidden","false");
    setTimeout(()=>input?.focus(),40);
  }
  function closeLogin() {
    $("lineLoginModal")?.classList.add("hidden");
    $("lineLoginModal")?.setAttribute("aria-hidden","true");
  }
  function store(value) {
    authenticated=true;
    username=String(value.user||"");
    expiresAt=Number(value.expiresAt||0);
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!authenticated)return;
      // Eight-hour sessions still expire; renewal is automatic only on the
      // authorized device. Do not count idle background tabs as new visits.
      if(!document.hidden) {
        refresh();
      } else {
        clearLocal();
        syncUI();
      }
    },Math.max(0,expiresAt-Date.now())+30);
  }
  async function requestSession(action,extras={}) {
    const response=await fetch("/api/line-session",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action,deviceId:getDeviceId(),...extras})
    });
    const data=await response.json().catch(()=>({}));
    return {response,data};
  }
  function onLineCourse() {
    return document.querySelector(".course-tab.active")?.dataset.course==="line";
  }
  async function refresh() {
    if(inFlight)return inFlight;
    const currentGeneration=generation;
    inFlight=(async()=>{
      const previous=authenticated, oldUsername=username;
      let reason="", message="";
      try {
        // Existing valid sessions require no new login and no new statistics event.
        const {response,data}=await requestSession("verify",{
          rememberDevice:!deviceConfirmed()
        });
        if(currentGeneration!==generation)return false;
        if(response.ok&&data.ok&&data.authenticated){
          store(data);
          remember(data.user);
          closeLogin();
          if(!previous||oldUsername!==username)syncUI();
          return true;
        }
        reason=String(data.code||"");
        if(reason==="SESSION_EXPIRED"&&rememberedUsername()) {
          // Renew only if Redis still associates this exact browser device
          // with the username. It cannot reclaim a newer device's session.
          const resumed=await requestSession("resume",{username:rememberedUsername()});
          if(currentGeneration!==generation)return false;
          if(resumed.response.ok&&resumed.data.ok&&resumed.data.authenticated){
            store(resumed.data);
            remember(resumed.data.user);
            closeLogin();
            if(!previous||oldUsername!==username)syncUI();
            return true;
          }
          reason=String(resumed.data.code||"");
          message=String(resumed.data.error||"");
        } else {
          message=String(data.error||"");
        }
        const replaced=["SESSION_REPLACED","SESSION_REVOKED","DEVICE_CHANGED"].includes(reason);
        if(replaced)forget();
        clearLocal();
        if(previous)syncUI();
        if(onLineCourse()&&(previous||replaced||!!rememberedUsername())){
          openLogin(replaced
            ? "🔒 Un altro dispositivo ha utilizzato questo username oppure la sessione è stata terminata dall'amministratore. Inserisci lo username per accedere nuovamente."
            : (message||"Accesso temporaneamente non disponibile. Riprova."));
        }
        return false;
      }catch(err){
        if(currentGeneration!==generation)return false;
        console.error("[WS Line Dance] Verifica sessione non disponibile",err);
        clearLocal();
        if(previous)syncUI();
        if(onLineCourse()&&(previous||!!rememberedUsername())){
          openLogin("Impossibile verificare la sessione. Controlla la connessione e riprova.");
        }
        return false;
      }
    })();
    try{return await inFlight;}
    finally{inFlight=null;}
  }
  async function login(user) {
    if(logoutPending)await logoutPending;
    if(inFlight)await inFlight;
    if(loginPending)return;
    loginPending=true;
    const button=$("lineLoginSubmit");
    if(button){button.disabled=true;button.textContent="Accesso…";}
    showError("lineLoginError","");
    try{
      const name=String(user||"").trim().replace(/\s+/g," ");
      if(name.length<2||name.length>30||!/^[\p{L}\p{N}][\p{L}\p{N}._ -]*$/u.test(name)){
        throw new Error("Username di 2-30 caratteri: lettere, numeri, spazi, punto, trattino o underscore.");
      }
      const epoch=++generation;
      const response=await fetch("/api/line-session",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"login",username:name,deviceId:getDeviceId()})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||"Accesso non riuscito.");
      if(epoch!==generation)return;
      store(data);
      remember(data.user);
      closeLogin();
      syncUI();
    }catch(err){
      showError("lineLoginError",err?.message||"Accesso temporaneamente non disponibile.");
    }finally{
      loginPending=false;
      if(button){button.disabled=false;button.textContent="🤠 Entra nella libreria";}
    }
  }
  async function logout() {
    if(logoutPending)return logoutPending;
    const earlierVerification=inFlight;
    generation++;
    forget(); // Explicit logout also forgets the name on this device.
    clearLocal();
    syncUI();
    logoutPending=(async()=>{
      try{
        if(earlierVerification)await earlierVerification;
        await fetch("/api/line-session",{
          method:"POST",credentials:"same-origin",cache:"no-store",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"logout",deviceId:getDeviceId()})
        });
      }catch(err){console.warn("[WS Line Dance] Logout server",err);}
    })();
    try{await logoutPending;}
    finally{logoutPending=null;}
  }
  function requireAccess() {
    if(isAuthenticated())return true;
    if(inFlight||rememberedUsername()) {
      refresh().then(ok=>{
        if(!ok&&!isAuthenticated()&&$("lineLoginModal")?.classList.contains("hidden")){
          openLogin();
        }
      });
      return false;
    }
    openLogin();
    return false;
  }
  function escapeHtml(value) {
    return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }
  function dateText(value) {
    if(!value)return "—";
    const d=new Date(value);
    return Number.isFinite(d.valueOf())?d.toLocaleString("it-IT"):"—";
  }
  const eventTitles={
    login:"✅ Accesso",login_replaced:"🔁 Accesso da nuovo dispositivo",
    auto_resume:"🔄 Accesso automatico dopo 8 ore",
    logout:"🚪 Uscita",admin_revoked:"⛔ Disconnessione amministratore"
  };
  function renderAdmin(data) {
    const stats=data.stats||{};
    const items=[
      [stats.activeSessions,"Sessioni attive"],
      [stats.usersTracked,"Username utilizzati"],
      [stats.loginsToday,"Accessi oggi"],
      [stats.logins30days,"Accessi ultimi 30 gg"]
    ];
    $("lineAdminStats").innerHTML=items.map(([n,title])=>
      '<div class="line-admin-stat"><strong>'+Number(n||0).toLocaleString("it-IT")+
      '</strong><span>'+escapeHtml(title)+'</span></div>').join("");
    const last30=Array.isArray(data.daily)?data.daily:[];
    const last14=last30.slice(-14), max=Math.max(1,...last14.map(d=>Number(d.logins||0)));
    $("lineAdminTrend").innerHTML=last14.map(d=>
      '<div class="line-admin-day" style="height:'+Math.max(3,Math.round(Number(d.logins||0)/max*100))+
      '%" title="'+escapeHtml(d.day+': '+Number(d.logins||0)+' login')+'"></div>').join("");
    const users=Array.isArray(data.users)?data.users:[];
    $("lineAdminUsers").innerHTML=users.length?users.map(u=>{
      const state=u.sessionActive?'🟢 Sessione attiva':'⚪ Non collegato';
      const history=(Array.isArray(u.events)?u.events:[]).map(item=>
        '<div>'+escapeHtml(dateText(item.at))+' · '+escapeHtml(eventTitles[item.event]||item.event)+'</div>').join("");
      return '<div class="line-admin-user"><div class="line-admin-user-info">'+
        '<b>'+escapeHtml(u.user)+'</b>'+
        '<small>'+state+' · '+Number(u.totalLogins||0)+' accessi totali · '+Number(u.todayLogins||0)+' oggi</small>'+
        '<small>Ultimo accesso: '+escapeHtml(dateText(u.lastLoginAt))+'</small>'+
        (history?'<details><summary>Ultimi eventi</summary>'+history+'</details>':'')+
        '</div>'+
        (u.sessionActive?'<button class="btn ghost btn-slim" data-line-revoke="'+escapeHtml(u.user)+
          '" type="button">⛔ Disconnetti</button>':'')+
        '</div>';
    }).join(""):'<div class="line-admin-empty">Non ci sono ancora accessi Line Dance.</div>';
    $("lineAdminContent")?.classList.remove("hidden");
  }
  async function adminRequest(action,name="") {
    const session=window.WSCatalanoSession;
    if(!session?.isAdmin())throw new Error("Accedi come amministratore Catalano per consultare questo pannello.");
    const response=await fetch("/api/line-session",{
      method:"POST",cache:"no-store",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"admin-"+action,username:name,adminUser:session.getUsername(),
        deviceId:session.getDeviceId(),adminPassword
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||"Operazione non riuscita.");
    return data;
  }
  function openAdmin() {
    if(!window.WSCatalanoSession?.isAdmin())return;
    adminPassword="";
    $("lineAdminPass").value="";
    $("lineAdminContent").classList.add("hidden");
    showError("lineAdminError","");
    $("lineAdminModal").classList.remove("hidden");
    $("lineAdminModal").setAttribute("aria-hidden","false");
    setTimeout(()=>$("lineAdminPass")?.focus(),40);
  }
  function closeAdmin() {
    adminPassword="";
    $("lineAdminPass").value="";
    $("lineAdminModal").classList.add("hidden");
    $("lineAdminModal").setAttribute("aria-hidden","true");
  }
  async function loadAdmin() {
    showError("lineAdminError","");
    const button=$("lineAdminLoad");
    button.disabled=true;button.textContent="Caricamento…";
    try{renderAdmin(await adminRequest("list"));}
    catch(err){showError("lineAdminError",err?.message||"Errore di caricamento.");}
    finally{button.disabled=false;button.textContent="Carica statistiche";}
  }

  window.WSLineAccess={getDeviceId,isAuthenticated,getUsername,refresh,login,logout,requireAccess};

  $("lineLoginForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    login($("lineUsername")?.value);
  });
  $("lineCloseLogin")?.addEventListener("click",closeLogin);
  $("lineGoCatalano")?.addEventListener("click",()=>{
    closeLogin();
    $("courseCatalano")?.click();
  });
  $("btnLineLogout")?.addEventListener("click",()=>{
    logout();
  });
  document.addEventListener("click",e=>{
    if(e.target?.closest?.("#lineOpenAccess"))requireAccess();
  });
  $("btnLineAdmin")?.addEventListener("click",openAdmin);
  $("lineAdminClose")?.addEventListener("click",closeAdmin);
  $("lineAdminAuthForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    adminPassword=$("lineAdminPass")?.value||"";
    if(adminPassword)loadAdmin();
  });
  $("lineAdminRefresh")?.addEventListener("click",loadAdmin);
  $("lineAdminUsers")?.addEventListener("click",async e=>{
    const button=e.target.closest?.("[data-line-revoke]");
    if(!button)return;
    const user=button.dataset.lineRevoke;
    if(!confirm("Disconnettere la sessione Line Dance di "+user+"? L'utente potrà rientrare subito usando il suo username."))return;
    button.disabled=true;
    showError("lineAdminError","");
    try{
      await adminRequest("revoke",user);
      renderAdmin(await adminRequest("list"));
    }catch(err){
      showError("lineAdminError",err?.message||"Impossibile disconnettere.");
      button.disabled=false;
    }
  });
  // Revalidate sessions when returning to the app; otherwise every 30 seconds.
  refresh();
  window.addEventListener("focus",()=>{if(!document.hidden&&(authenticated||rememberedUsername()))refresh();});
  window.addEventListener("pageshow",()=>{if(!document.hidden&&(authenticated||rememberedUsername()))refresh();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&(authenticated||rememberedUsername()))refresh();});
  setInterval(()=>{if(!document.hidden&&(authenticated||rememberedUsername()))refresh();},30000);
})();
