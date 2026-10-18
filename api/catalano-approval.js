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
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#101014;color:#f5f5f5;margin:0;padding:24px}.card{max-width:620px;margin:30px auto;background:#1d1d22;border:1px solid #383842;border-radius:18px;padding:24px;box-shadow:0 16px 48px #0007}h1{font-size:24px;margin-top:0}.meta{background:#151519;border-radius:12px;padding:14px 16px;line-height:1.6}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}button,.btn{border:0;border-radius:10px;padding:12px 18px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}.ok{background:#22c55e;color:#07140b}.no{background:#ef4444;color:white}.back{background:#3f3f46;color:white}.mail{background:#2563eb;color:white}.note{color:#b8b8c2;font-size:14px}form{margin:0}.draft{margin-top:16px;background:#151519;border:1px solid #34343d;border-radius:12px;padding:14px 16px;color:#e8e8ee;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;line-height:1.45}details{margin-top:14px}summary{cursor:pointer;color:#c7d2fe;font-weight:700}</style></head><body><div class="card">${body}</div></body></html>`
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

function buildManualEmailDraft(req, request) {
  const to = clean(request?.email, 254).toLowerCase();
  if (!to) return null;

  const appUrl = getBaseUrl(req);
  const subject = "Accesso Catalano approvato - Western Spritz";
  const body = [
    `Ciao ${request.name || ""},`,
    "",
    "la tua richiesta di accesso all'area Catalano di Western Spritz è stata approvata.",
    "",
    `Username: ${request.username}`,
    "Puoi accedere usando la password che hai scelto durante la registrazione.",
    "",
    `Apri Western Spritz: ${appUrl}`,
    "",
    "Per sicurezza la password non viene riportata in questa email.",
    "",
    "A presto,",
    "Western Spritz"
  ].join("\n");

  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to, subject, body, href };
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
      const draft = buildManualEmailDraft(req, request);
      const mailStatus = draft
        ? `<p>✉️ La mail di conferma è pronta. Premi il pulsante qui sotto: si aprirà il tuo programma di posta con destinatario, oggetto e testo già compilati. Dovrai solo controllarla e premere <b>Invia</b>.</p>
           <p><a class="btn mail" href="${escapeHtml(draft.href)}">✉️ PREPARA EMAIL DI CONFERMA</a></p>
           <details><summary>Mostra il testo della mail</summary><div class="draft"><b>A:</b> ${escapeHtml(draft.to)}\n<b>Oggetto:</b> ${escapeHtml(draft.subject)}\n\n${escapeHtml(draft.body)}</div></details>`
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
