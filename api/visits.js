// /api/visits.js — Upstash Redis con logica "una visita per IP al giorno"
export default async function handler(req, res) {
  try {
    // Pulizia delle variabili d’ambiente (in caso abbiano virgolette)
    const BASE  = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/^["']|["']$/g, '');
    const TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().replace(/^["']|["']$/g, '');

    if (!BASE || !TOKEN) {
      return res.status(500).json({ error: 'Missing Upstash env vars' });
    }

    // === 1️⃣ Estrai IP visitatore ===
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';
    const ipKey = ip.replace(/[^0-9a-f:.]/gi, '_');

    // === 2️⃣ Calcola la data (es. 20251105) ===
    const today = new Date();
    const dateKey = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

    // === 3️⃣ Chiave combinata per IP + data ===
    const visitKey = `visits:ip:${ipKey}:${dateKey}`;

    // === 4️⃣ Controlla se è già stato contato oggi ===
    const check = await fetch(`${BASE}/get/${visitKey}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const { result: already } = await check.json();

    let currentCount = 0;

    if (!already) {
      // 5️⃣ IP nuovo per oggi → incrementa e salva chiave per 24 ore
      await fetch(`${BASE}/incr/ws:visits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      // Scadenza 24 ore (86400 secondi)
      await fetch(`${BASE}/setex/${visitKey}/43200/1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    }

    // === 6️⃣ Leggi il valore attuale del contatore ===
    const r = await fetch(`${BASE}/get/ws:visits`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await r.json();
    currentCount = Number(data.result || 0);

    // === 7️⃣ Risposta finale ===
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({
      value: currentCount,
      countedToday: !already,
      ip,
      date: dateKey
    });

  } catch (e) {
    res.status(500).json({ error: 'Upstash error', detail: String(e) });
  }
}

