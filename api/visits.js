// api/visits.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  // accettiamo solo GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // incrementa e restituisce il contatore
    const value = await kv.incr("ws_visits");
    return res.status(200).json({ value });
  } catch (err) {
    console.error("KV error", err);
    return res.status(500).json({ error: "KV error" });
  }
}
