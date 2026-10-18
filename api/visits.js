import crypto from "crypto";
import { kv } from "@vercel/kv";

const WINDOW_HOURS = 6;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const ipHash = hashIp(getClientIp(req));
    const globalKey = "ws_visits";
    const lastKey = `ws_ip_last:${ipHash}`;
    const countKey = `ws_ip_visits:${ipHash}`;
    const now = Date.now();

    const lastTs = Number(await kv.get(lastKey) || 0);
    let counted = false;
    let globalValue = 0;
    let perIpValue = 0;

    if (!lastTs || (now - lastTs) > WINDOW_MS) {
      globalValue = Number(await kv.incr(globalKey));
      perIpValue = Number(await kv.incr(countKey));
      await kv.set(lastKey, now, { ex: WINDOW_HOURS * 2 * 60 * 60 });
      counted = true;
    } else {
      globalValue = Number(await kv.get(globalKey) || 0);
      perIpValue = Number(await kv.get(countKey) || 1);
    }

    return res.status(200).json({ value: globalValue, byIp: perIpValue, counted });
  } catch (err) {
    console.error("KV error", err);
    return res.status(500).json({ error: "KV error" });
  }
}
