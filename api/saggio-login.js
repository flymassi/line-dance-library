// api/saggio-login.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body || {};

  // username e password "vere" dalle variabili d'ambiente (non nel JS pubblico)
  const ADMIN_USER = process.env.SAGGIO_USER;
  const ADMIN_PASS = process.env.SAGGIO_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    console.error('Missing SAGGIO_USER / SAGGIO_PASS env vars');
    return res.status(500).json({ error: 'Server config error' });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // token semplice per segnare che l'utente è dentro
    const token = 'saggio-2026-ok';
    return res.status(200).json({ ok: true, token });
  }

  return res.status(401).json({ ok: false });
}
