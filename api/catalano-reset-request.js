import {
  checkPasswordResetRateLimit,
  createPasswordResetRequest,
  deletePasswordResetRequest,
  getStoredUser,
  normalizeUsername,
  signResetId
} from "../lib/catalano-store.js";

const ADMIN_EMAIL_DEFAULT = "flymassi@hotmail.com";

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    console.error("CATALANO reset request: missing RESEND_API_KEY");
    return res.status(503).json({ ok: false, error: "Servizio email non configurato" });
  }

  const username = clean(req.body?.username, 30);
  const email = clean(req.body?.email, 254).toLowerCase();
  const usernameNorm = normalizeUsername(username);

  if (username.length < 3 || !/^[A-Za-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Username non valido" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Email non valida" });
  }

  let user;
  try {
    const ip = String(req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown").split(",")[0].trim();
    if (!(await checkPasswordResetRateLimit(ip))) {
      return res.status(429).json({ ok: false, error: "Troppe richieste. Riprova più tardi." });
    }

    user = await getStoredUser(usernameNorm);
  } catch (err) {
    console.error("CATALANO reset request: Redis check failed", err);
    return res.status(503).json({ ok: false, error: "Archivio utenti temporaneamente non disponibile" });
  }

  const storedEmail = String(user?.email || "").trim().toLowerCase();
  if (!user || !storedEmail || storedEmail !== email) {
    return res.status(404).json({
      ok: false,
      error: "Username ed email non corrispondono a un utente registrato. Contatta l'amministratore se hai bisogno di assistenza."
    });
  }

  let request;
  try {
    request = await createPasswordResetRequest(user);
  } catch (err) {
    if (err?.code === "RESET_PENDING_EXISTS") {
      return res.status(409).json({ ok: false, error: "Esiste già una richiesta di reset in attesa per questo utente." });
    }
    console.error("CATALANO reset request: cannot store request", err);
    return res.status(503).json({ ok: false, error: "Impossibile registrare la richiesta di reset" });
  }

  let manageUrl;
  try {
    const sig = signResetId(request.id);
    manageUrl = `${getBaseUrl(req)}/api/catalano-reset-admin?id=${encodeURIComponent(request.id)}&sig=${encodeURIComponent(sig)}`;
  } catch (err) {
    await deletePasswordResetRequest(request).catch(() => {});
    console.error("CATALANO reset request: cannot build manage URL", err);
    return res.status(500).json({ ok: false, error: "Configurazione reset non disponibile" });
  }

  const requestedAt = new Date(request.requestedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const adminEmail = process.env.CATALANO_ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const fromEmail = process.env.CATALANO_FROM_EMAIL || "Western Spritz <onboarding@resend.dev>";

  const text = [
    "Richiesta di reset password per l'area Catalano di Western Spritz.",
    "",
    `Nome: ${request.name || "—"}`,
    `Email: ${request.email}`,
    `Username: ${request.user}`,
    `Data richiesta: ${requestedAt}`,
    "",
    "GESTISCI IL RESET:",
    manageUrl,
    "",
    "La password NON verrà modificata finché non approverai tu la richiesta."
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#202124;max-width:640px;margin:auto">
      <h2>🔑 Richiesta reset password Catalano</h2>
      <p><b>Nome:</b> ${escapeHtml(request.name || "—")}<br>
      <b>Email:</b> ${escapeHtml(request.email)}<br>
      <b>Username:</b> ${escapeHtml(request.user)}<br>
      <b>Data richiesta:</b> ${escapeHtml(requestedAt)}</p>
      <p style="margin:26px 0">
        <a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">GESTISCI RESET</a>
      </p>
      <p>La password <b>non verrà modificata</b> finché non approverai tu la richiesta.</p>
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
        subject: `Reset password Catalano - ${request.user}`,
        text,
        html
      })
    });

    const data = await mailRes.json().catch(() => ({}));
    if (!mailRes.ok) {
      console.error("CATALANO reset request: Resend error", mailRes.status, data);
      await deletePasswordResetRequest(request).catch(() => {});
      return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("CATALANO reset request: email exception", err);
    await deletePasswordResetRequest(request).catch(() => {});
    return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
  }
}
