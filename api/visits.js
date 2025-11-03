// /api/visits.js — Upstash Redis (con sanitizzazione variabili + init una volta)
export default async function handler(req, res) {
  try {
    // Pulizia nel caso le env avessero virgolette/spazi
    const BASE  = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/^["']|["']$/g, '');
    const TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().replace(/^["']|["']$/g, '');

    if (!BASE || !TOKEN) {
      return res.status(500).json({ error: 'Missing Upstash env vars' });
    }

    // Inizializza solo se non esiste (puoi cambiare il valore iniziale)
    const INITIAL_VALUE = 126; // <— cambia qui se vuoi
    await fetch(`${BASE}/setnx/ws:visits/${INITIAL_VALUE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    // Incrementa e ritorna il valore
    const r = await fetch(`${BASE}/incr/ws:visits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const data = await r.json(); // { result: <numero> }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ value: data.result });
  } catch (e) {
    return res.status(500).json({ error: 'Upstash error', detail: String(e) });
  }
}
