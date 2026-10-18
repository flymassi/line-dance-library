const ADMIN_EMAIL_DEFAULT = "flymassi@hotmail.com";

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
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
  const username = clean(req.body?.username, 30);
  const password = String(req.body?.password ?? "").slice(0, 120);

  if (!name || username.length < 3 || password.length < 4) {
    return res.status(400).json({ ok: false, error: "Dati incompleti" });
  }

  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Username non valido" });
  }

  const adminEmail = process.env.CATALANO_ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const fromEmail = process.env.CATALANO_FROM_EMAIL || "Western Spritz <onboarding@resend.dev>";
  const jsonEntry = JSON.stringify({ user: username, pass: password });
  const requestedAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });

  const text = [
    "Nuova richiesta di accesso all'area Catalano di Western Spritz.",
    "",
    `Nome e cognome: ${name}`,
    `Username scelto: ${username}`,
    `Password scelta: ${password}`,
    `Data richiesta: ${requestedAt}`,
    "",
    "Voce pronta da aggiungere a SAGGIO_USERS se APPROVI la richiesta:",
    jsonEntry,
    "",
    "Per NON approvare la richiesta non aggiungere la voce a SAGGIO_USERS."
  ].join("\n");

  try {
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `Richiesta accesso Catalano - ${name}`,
        text
      })
    });

    const data = await mailRes.json().catch(() => ({}));

    if (!mailRes.ok) {
      console.error("CATALANO request: Resend error", mailRes.status, data);
      return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("CATALANO request: email exception", err);
    return res.status(502).json({ ok: false, error: "Invio email non riuscito" });
  }
}
