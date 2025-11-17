// /api/visits.js — una visita per dispositivo/giorno (hash IP + user-agent)
import crypto from "crypto";

export default async function handler(req, res) {
  try {
    const BASE  = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/^["']|["']$/g, '');
    const TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().replace(/^["']|["']$/g, '');
    if (!BASE || !TOKEN) {
      return res.status(500).json({ error: 'Missing Upstash env vars' });
    }

    // === 1️⃣ Determina identificatore "dispositivo" ===
    const rawIP =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    // === 2️⃣ Data corrente (es. 20251105)
    const today = new Date();
    const dateKey = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

    // === 3️⃣ Calcola un hash anonimo (IP + UA + data)
    const hash = crypto
      .createHash('sha256')
      .update(`${rawIP}|${ua}|${dateKey}`)
      .digest('hex')
      .slice(0, 20); // chiave compatta

    const visitKey = `visits:hash:${hash}`;

    // === 4️⃣ Verifica se è già stato conteggiato oggi ===
    const check = await fetch(`${BASE}/get/${visitKey}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const { result: already } = await check.json();

    if (!already) {
      // Nuovo hash (dispositivo/giorno) → incrementa
      await fetch(`${BASE}/incr/ws:visits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      // TTL 1 giorno
      await fetch(`${BASE}/setex/${visitKey}/86400/1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    }

    // === 5️⃣ Leggi il valore totale ===
    const r = await fetch(`${BASE}/get/ws:visits`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await r.json();
    const total = Number(data.result || 0);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({
      value: total,
      countedToday: !already,
      hash,
    });

  } catch (e) {
    res.status(500).json({ error: 'Upstash error', detail: String(e) });
  }
}
