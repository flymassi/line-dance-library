// api/visits.js
import { kv } from "@vercel/kv";

function getClientIp(req) {
  // header standard dietro proxy / su Vercel
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    // può essere "ip1, ip2, ip3" → prendiamo il primo
    return xff.split(",")[0].trim();
  }
  // fallback
  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // 1) contatore globale (come prima)
    const globalValue = await kv.incr("ws_visits");

    // 2) contatore per IP
    const ip = getClientIp(req);
    const ipKey = `ws_visits_ip:${ip}`;
    const perIpValue = await kv.incr(ipKey);

    // mantengo "value" = globale, così il frontend continua a funzionare
    return res.status(200).json({
      value: globalValue,   // usato dallo splash "Sei il visitatore"
      byIp: perIpValue,     // quante volte QUESTO IP ha visitato
    });
  } catch (err) {
    console.error("KV error", err);
    return res.status(500).json({ error: "KV error" });
  }
}