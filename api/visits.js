// /api/visits.js — versione Upstash con inizializzazione temporanea
export default async function handler(req, res) {
  try {
    // 🔹 IMPOSTA VALORE INIZIALE UNA SOLA VOLTA
    // Modifica il numero qui sotto se vuoi far partire il contatore da un altro valore
    const INITIAL_VALUE = 126;

    // Imposta manualmente il valore iniziale (solo se non esiste già)
    // Puoi rimuovere questo blocco dopo la prima esecuzione
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/setnx/ws:visits/${INITIAL_VALUE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });

    // 🔹 Incrementa il contatore ad ogni visita
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/ws:visits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });

    const data = await r.json(); // { result: numero attuale }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({ value: data.result });

  } catch (e) {
    res.status(500).json({ error: 'Upstash error', detail: String(e) });
  }
}
