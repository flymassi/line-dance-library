// api/visits.js
import { kv } from "@vercel/kv";

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // contatore globale
    const globalValue = await kv.incr("ws_visits");

    // contatore per IP (può anche non servirci, ma lo teniamo)
    const ip = getClientIp(req);
    const ipKey = `ws_visits_ip:${ip}`;
    const perIpValue = await kv.incr(ipKey);

    return res.status(200).json({
      value: globalValue,
      byIp: perIpValue,
    });
  } catch (err) {
    console.error("KV error", err);

    // 🔍 QUI: mandiamo fuori il messaggio reale
    return res.status(500).json({
      error: "KV error",
      message: err?.message || null,
      code: err?.code || null,
    });
  }
}
