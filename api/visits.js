// api/visits.js
import { kv } from "@vercel/kv";

const WINDOW_HOURS = 6;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

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
    const ip = getClientIp(req);

    const globalKey = "ws_visits";
    const lastKey   = `ws_ip_last:${ip}`;
    const countKey  = `ws_ip_visits:${ip}`;

    const now = Date.now();

    const lastTsRaw = await kv.get(lastKey);
    const lastTs    = lastTsRaw ? Number(lastTsRaw) : 0;

    let counted = false;
    let globalValue;
    let perIpValue;

    // Se mai visto o sono passate > 6 ore → conteggia
    if (!lastTs || (now - lastTs) > WINDOW_MS) {
      globalValue = await kv.incr(globalKey);       // contatore globale
      perIpValue  = await kv.incr(countKey);        // contatore di questo IP

      // salviamo l'istante dell'ultima visita conteggiata (TTL opzionale per pulizia)
      await kv.set(lastKey, now, { ex: WINDOW_HOURS * 2 * 60 * 60 }); // ~12 ore

      counted = true;
    } else {
      // entro 6 ore → NON incrementiamo, leggiamo solo i valori attuali
      const g = await kv.get(globalKey);
      const p = await kv.get(countKey);
      globalValue = Number(g || 0);
      perIpValue  = Number(p || 1);
    }

    return res.status(200).json({
      value: globalValue,   // usato dal frontend per lo splash
      byIp: perIpValue,     // quante "visite valide" ha fatto questo IP
      counted,              // true se questa chiamata ha incrementato il contatore
    });

  } catch (err) {
    console.error("KV error", err);
    return res.status(500).json({ error: "KV error" });
  }
}
