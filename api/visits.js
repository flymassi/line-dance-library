// /api/visits.js — versione Upstash
export default async function handler(req, res) {
  try {
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/ws:visits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    const data = await r.json(); // { result: numero }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({ value: data.result });
  } catch (e) {
    res.status(500).json({ error: 'Upstash error', detail: String(e) });
  }
}
