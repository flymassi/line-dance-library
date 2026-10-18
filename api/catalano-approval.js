import {
  approvePendingRequest,
  deletePendingRequest,
  getPendingRequest,
  validApprovalSignature
} from "../lib/catalano-store.js";

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const params = new URLSearchParams(String(req.body || ""));
  return Object.fromEntries(params.entries());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title, body, status = 200) {
  return {
    status,
    html: `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#101014;color:#f5f5f5;margin:0;padding:24px}.card{max-width:620px;margin:30px auto;background:#1d1d22;border:1px solid #383842;border-radius:18px;padding:24px;box-shadow:0 16px 48px #0007}h1{font-size:24px;margin-top:0}.meta{background:#151519;border-radius:12px;padding:14px 16px;line-height:1.6}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}button,.btn{border:0;border-radius:10px;padding:12px 18px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}.ok{background:#22c55e;color:#07140b}.no{background:#ef4444;color:white}.back{background:#3f3f46;color:white}.note{color:#b8b8c2;font-size:14px}form{margin:0}</style></head><body><div class="card">${body}</div></body></html>`
  };
}

function sendPage(res, payload) {
  res.status(payload.status).setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(payload.html);
}

function getBaseUrl(req) {
  const proto = clean(req.headers?.["x-forwarded-proto"] || "https", 10).split(",")[0];
  const host = clean(req.headers?.["x-forwarded-host"] || req.headers?.host || "", 200).split(",")[0];
  if (!host) return "https://western-spritz.vercel.app";
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

async function sendApprovalEmail(req, request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = clean(request?.email, 254).toLowerCase();
  if (!apiKey || !to) return { sent: false, skipped: true };

  const fromEmail = process.env.CATALANO_FROM_EMAIL || "Western Spritz <onboarding@resend.dev>";
  const appUrl = getBaseUrl(req);
  const text = [
    `Ciao ${request.name || ""},`,
    "",
    "la tua richiesta di accesso all'area Catalano di Western Spritz è stata approvata.",
    `Username: ${request.username}`,
    "Puoi accedere usando la password che hai scelto durante la registrazione.",
    "",
    `Apri Western Spritz: ${appUrl}`,
    "",
    "Per sicurezza la password non viene riportata in questa email."
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#202124;max-width:640px;margin:auto">
      <h2>✅ Accesso Catalano approvato</h2>
      <p>Ciao <b>${escapeHtml(request.name || "")}</b>,</p>
      <p>la tua richiesta di accesso all’area <b>Catalano</b> di Western Spritz è stata approvata.</p>
      <p><b>Username:</b> ${escapeHtml(request.username)}</p>
      <p>Puoi accedere usando la password che hai scelto durante la registrazione.</p>
      <p style="margin:24px 0"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">APRI WESTERN SPRITZ</a></p>
      <p style="font-size:13px;color:#5f6368">Per sicurezza la password non viene riportata in questa email.</p>
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
        to: [to],
        subject: "Accesso Catalano approvato - Western Spritz",
        text,
        html
      })
    });
    const data = await mailRes.json().catch(() => ({}));
    if (!mailRes.ok) {
      console.error("CATALANO approval: confirmation email error", mailRes.status, data);
      return { sent: false, error: data?.message || `HTTP ${mailRes.status}` };
    }
    return { sent: true, id: data?.id || null };
  } catch (err) {
    console.error("CATALANO approval: confirmation email exception", err);
    return { sent: false, error: err?.message || "email exception" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const source = req.method === "POST" ? parseBody(req) : req.query || {};
  const id = clean(source.id, 100);
  const sig = clean(source.sig, 200);

  if (!id || !sig || !validApprovalSignature(id, sig)) {
    return sendPage(res, page("Link non valido", `<h1>⛔ Link non valido</h1><p>Il collegamento di approvazione non è valido.</p>`, 403));
  }

  let request;
  try {
    request = await getPendingRequest(id);
  } catch (err) {
    console.error("CATALANO approval: Redis error", err);
    return sendPage(res, page("Servizio non disponibile", `<h1>⚠️ Servizio temporaneamente non disponibile</h1><p>Riprova tra poco.</p>`, 503));
  }

  if (!request) {
    return sendPage(res, page("Richiesta già gestita", `<h1>ℹ️ Richiesta non più disponibile</h1><p>Questa richiesta è già stata gestita oppure è scaduta.</p>`));
  }

  if (req.method === "GET") {
    const html = `
      <h1>🇪🇸 Gestione richiesta Catalano</h1>
      <div class="meta">
        <b>Nome:</b> ${escapeHtml(request.name)}<br>
        <b>Email:</b> ${escapeHtml(request.email || "—")}<br>
        <b>Username:</b> ${escapeHtml(request.username)}<br>
        <b>Richiesta:</b> ${escapeHtml(new Date(request.requestedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }))}
      </div>
      <p class="note">L'azione diventa effettiva solo quando premi uno dei pulsanti qui sotto.</p>
      <div class="actions">
        <form method="post">
          <input type="hidden" name="id" value="${escapeHtml(id)}">
          <input type="hidden" name="sig" value="${escapeHtml(sig)}">
          <input type="hidden" name="decision" value="approve">
          <button class="ok" type="submit">✅ APPROVA ACCESSO</button>
        </form>
        <form method="post">
          <input type="hidden" name="id" value="${escapeHtml(id)}">
          <input type="hidden" name="sig" value="${escapeHtml(sig)}">
          <input type="hidden" name="decision" value="reject">
          <button class="no" type="submit">❌ RIFIUTA</button>
        </form>
      </div>`;
    return sendPage(res, page("Gestione richiesta Catalano", html));
  }

  const decision = clean(source.decision, 20);

  if (decision === "approve") {
    try {
      await approvePendingRequest(request);
      const mail = await sendApprovalEmail(req, request);
      const mailStatus = request.email
        ? (mail.sent
          ? `<p>📧 Email di conferma inviata a <b>${escapeHtml(request.email)}</b>.</p>`
          : `<p style="color:#fbbf24">⚠️ Accesso approvato, ma la mail di conferma non è stata inviata. L'utente può comunque accedere subito.</p>`)
        : `<p class="note">Questa richiesta non conteneva un indirizzo email (utente registrato con la versione precedente).</p>`;
      return sendPage(res, page("Accesso approvato", `
        <h1>✅ Accesso approvato</h1>
        <p>L'utente <b>${escapeHtml(request.username)}</b> è stato abilitato.</p>
        <p><b>Può accedere immediatamente a Catalano.</b></p>
        ${mailStatus}
        <p class="note">Non devi modificare SAGGIO_USERS e non devi fare alcun redeploy.</p>`));
    } catch (err) {
      console.error("CATALANO approval: approve error", err);
      const message = err?.code === "USER_EXISTS"
        ? "Questo username risulta già abilitato o già utilizzato."
        : "Non è stato possibile approvare la richiesta. Riprova.";
      return sendPage(res, page("Approvazione non riuscita", `<h1>⚠️ Approvazione non riuscita</h1><p>${escapeHtml(message)}</p>`, 409));
    }
  }

  if (decision === "reject") {
    try {
      await deletePendingRequest(request);
      return sendPage(res, page("Richiesta rifiutata", `
        <h1>❌ Richiesta rifiutata</h1>
        <p>La richiesta di <b>${escapeHtml(request.username)}</b> è stata eliminata.</p>
        <p class="note">L'utente non è stato abilitato.</p>`));
    } catch (err) {
      console.error("CATALANO approval: reject error", err);
      return sendPage(res, page("Operazione non riuscita", `<h1>⚠️ Operazione non riuscita</h1><p>Riprova tra poco.</p>`, 503));
    }
  }

  return sendPage(res, page("Azione non valida", `<h1>⛔ Azione non valida</h1>`, 400));
}
