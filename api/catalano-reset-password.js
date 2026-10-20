import {
  applyPasswordReset,
  getPasswordResetToken
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
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#101014;color:#f5f5f5;margin:0;padding:24px}.card{max-width:560px;margin:30px auto;background:#1d1d22;border:1px solid #383842;border-radius:18px;padding:24px;box-shadow:0 16px 48px #0007}h1{font-size:24px;margin-top:0}.note{color:#b8b8c2;font-size:14px}.field{display:grid;gap:6px;margin:16px 0}.field input{box-sizing:border-box;width:100%;background:#111116;color:#fff;border:1px solid #44444f;border-radius:10px;padding:12px 14px;font-size:16px}.btn{border:0;border-radius:10px;padding:12px 18px;font-weight:800;cursor:pointer;background:#22c55e;color:#07140b}.error{background:#3a1717;border:1px solid #7f1d1d;border-radius:10px;padding:12px 14px;color:#fecaca;margin:14px 0}.okbox{background:#12351e;border:1px solid #166534;border-radius:10px;padding:14px 16px;color:#dcfce7}</style></head><body><div class="card">${body}</div></body></html>`
  };
}

function sendPage(res, payload) {
  res.status(payload.status).setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(payload.html);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const source = req.method === "POST" ? parseBody(req) : req.query || {};
  const token = clean(source.token, 128);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return sendPage(res, page("Link non valido", `<h1>⛔ Link non valido</h1><p>Il link di reimpostazione non è valido.</p>`, 400));
  }

  let tokenRecord;
  try {
    tokenRecord = await getPasswordResetToken(token);
  } catch (err) {
    console.error("CATALANO reset password: Redis read error", err);
    return sendPage(res, page("Servizio non disponibile", `<h1>⚠️ Servizio temporaneamente non disponibile</h1><p>Riprova tra poco.</p>`, 503));
  }

  if (!tokenRecord) {
    return sendPage(res, page("Link scaduto", `<h1>⌛ Link non più valido</h1><p>Il link è scaduto oppure è già stato utilizzato.</p><p class="note">Puoi richiedere un nuovo reset dalla schermata di accesso a Catalano.</p>`, 410));
  }

  if (req.method === "GET") {
    return sendPage(res, page("Nuova password Catalano", `
      <h1>🔑 Scegli una nuova password</h1>
      <p>Stai reimpostando la password per l'utente <b>${escapeHtml(tokenRecord.user || tokenRecord.usernameNorm || "")}</b>.</p>
      <form method="post">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <label class="field">Nuova password
          <input type="password" name="password" minlength="4" maxlength="120" autocomplete="new-password" required>
        </label>
        <label class="field">Conferma nuova password
          <input type="password" name="password2" minlength="4" maxlength="120" autocomplete="new-password" required>
        </label>
        <p class="note">Non usare una password che utilizzi per altri servizi.</p>
        <button class="btn" type="submit">SALVA NUOVA PASSWORD</button>
      </form>`));
  }

  const password = String(source.password ?? "").slice(0, 120);
  const password2 = String(source.password2 ?? "").slice(0, 120);

  if (password.length < 4) {
    return sendPage(res, page("Password non valida", `<h1>⚠️ Password non valida</h1><div class="error">La password deve contenere almeno 4 caratteri.</div><p>Riapri il link e riprova.</p>`, 400));
  }
  if (password !== password2) {
    return sendPage(res, page("Password non coincidenti", `<h1>⚠️ Le password non coincidono</h1><div class="error">Inserisci due volte la stessa password.</div><p>Riapri il link e riprova.</p>`, 400));
  }

  try {
    await applyPasswordReset(token, password);
    return sendPage(res, page("Password aggiornata", `
      <h1>✅ Password aggiornata</h1>
      <div class="okbox">La nuova password è stata salvata correttamente.</div>
      <p>Ora puoi tornare a Western Spritz e accedere a Catalano con il tuo username e la nuova password.</p>
      <p class="note">Questo link non può più essere utilizzato.</p>`));
  } catch (err) {
    console.error("CATALANO reset password: apply error", err);
    const invalid = err?.code === "RESET_TOKEN_INVALID";
    return sendPage(res, page("Reset non riuscito", `<h1>⚠️ Reset non riuscito</h1><p>${invalid ? "Il link è scaduto oppure è già stato utilizzato." : "Non è stato possibile aggiornare la password. Riprova."}</p>`, invalid ? 410 : 503));
  }
}
