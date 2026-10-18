import {
  checkRateLimit,
  createPendingRequest,
  deletePendingRequest,
  getPendingRequest,
  getStoredUser,
  isLegacyUser,
  normalizeUsername,
  signApprovalId
} from "../lib/catalano-store.js";

const ADMIN_EMAIL_DEFAULT = "flymassi@hotmail.com";

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function getBaseUrl(req) {
  const proto = clean(req.headers?.["x-forwarded-proto"] || "https", 10).split(",")[0];
  const host = clean(req.headers?.["x-forwarded-host"] || req.headers?.host || "", 200).split(",")[0];
  if (!host) throw new Error("Host non disponibile");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("CATALANO request: missing RESEND_API_KEY");
    return res.status(503).json({ ok: false, error: "Servizio email non configurato" });
  }

  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 254).toLowerCase();
  const username = clean(req.body?.username, 30);
  const password = String(req.body?.password ?? "").slice(0, 120);
  const usernameNorm = normalizeUsername(username);

  if (!name || !email || username.length < 3 || password.length < 4) {
    return res.status(400).json({ ok: false, error: "Dati incompleti" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Email non valida" });
  }

  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Username non valido" });
  }

  try {
    const ip = String(req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown").split(",")[0].trim();
    if (!(await checkRateLimit(ip))) {
      return res.status(429).json({ ok: false, error: "Troppe richieste. Riprova più tardi." });
    }

    if (await isLegacyUser(username) || await getStoredUser(usernameNorm)) {
      return res.status(409).json({ ok: false, error: "Username già utilizzato" });
    }
  } catch (err) {
    console.error("CATALANO request: Redis check failed", err);
    return res.status(503).json({ ok: false, error: "Archivio utenti temporaneamente non disponibile" });
  }

  const requestedAtIso = new Date().toISOString();
  let requestId;

  try {
    requestId = await createPendingRequest({
      name,
      email,
      username,
      usernameNorm,
      password,
      requestedAt: requestedAtIso
    });
  } catch (err) {
    if (err?.code === "PENDING_EXISTS") {
      return res.status(409).json({ ok: false, error: "Esiste già una richiesta in attesa per questo username" });
    }
    console.error("CATALANO request: cannot store pending request", err);
    return res.status(503).json({ ok: false, error: "Impossibile registrare la richiesta" });
  }

  const adminEmail = process.env.CATALANO_ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const fromEmail = process.env.CATALANO_FROM_EMAIL || "Western Spritz <onboarding@resend.dev>";
  const requestedAt = new Date(requestedAtIso).toLocaleString("it-IT", { timeZone: "Europe/Rome" });

  let manageUrl;
  try {
    const sig = signApprovalId(requestId);
    manageUrl = `${getBaseUrl(req)}/api/catalano-approval?id=${encodeURIComponent(requestId)}&sig=${encodeURIComponent(sig)}`;
  } catch (err) {
    const pending = await getPendingRequest(requestId).catch(() => null);
    await deletePendingRequest(pending).catch(() => {});
    console.error("CATALANO request: cannot build approval URL", err);
    return res.status(500).json({ ok: false, error: "Configurazione approvazione non disponibile" });
  }

  const text = [
    "Nuova richiesta di accesso all'area Catalano di Western Spritz.",
    "",
    `Nome e cognome: ${name}`,
    `Email: ${email}`,
    `Username scelto: ${username}`,
    `Password scelta: ${password}`,
    `Data richiesta: ${requestedAt}`,
    "",
    "GESTISCI LA RICHIESTA:",
    manageUrl,
    "",
    "Da questa pagina puoi APPROVARE o RIFIUTARE la richiesta.",
    "Se approvi, l'utente potrà accedere subito: NON serve modificare SAGGIO_USERS e NON serve fare un redeploy."
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#202124;max-width:640px;margin:auto">
      <h2 style="margin-bottom:8px">🇪🇸 Nuova richiesta Catalano</h2>
      <p><b>Nome e cognome:</b> ${escapeHtml(name)}<br>
      <b>Email:</b> ${escapeHtml(email)}<br>
      <b>Username:</b> ${escapeHtml(username)}<br>
      <b>Password scelta:</b> ${escapeHtml(password)}<br>
      <b>Data richiesta:</b> ${escapeHtml(requestedAt)}</p>
      <p style="margin:26px 0">
        <a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">GESTISCI RICHIESTA</a>
      </p>
      <p>Aprendo il link potrai <b>approvare</b> oppure <b>rifiutare</b> la richiesta.</p>
      <p style="font-size:13px;color:#5f6368">Dopo l'approvazione l'accesso è immediato: non devi modificare SAGGIO_USERS e non devi fare alcun redeploy.</p>
    </div>`;

  try {
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `Richiesta accesso Catalano - ${name}`,
        text,
        html
      })
    });

    const data = await mailRes.json().catch(() => ({}));

    if (!mailRes.ok) {
      console.error("CATALANO request: Resend error", mailRes.status, data);
      const pending = await getPendingRequest(requestId).catch(() => null);
      await deletePendingRequest(pending).catch(() => {});
      return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("CATALANO request: email exception", err);
    const pending = await getPendingRequest(requestId).catch(() => null);
    await deletePendingRequest(pending).catch(() => {});
    return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
