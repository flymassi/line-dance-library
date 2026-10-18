import crypto from "crypto";
import { redisCommand } from "../lib/catalano-store.js";

const WINDOW_HOURS = 6;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const DEFAULT_START = 99;

function getClientIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(String(ip)).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const ipHash = hashIp(getClientIp(req));
    const globalKey = "ws_visits";
    const lastKey = `ws_ip_last:${ipHash}`;
    const countKey = `ws_ip_visits:${ipHash}`;
    const now = Date.now();

    const currentGlobal = await redisCommand(["GET", globalKey]);
    if (currentGlobal === null || currentGlobal === undefined) {
      await redisCommand(["SET", globalKey, String(DEFAULT_START), "NX"]);
    }

    const lastTs = Number(await redisCommand(["GET", lastKey]) || 0);
    let counted = false;
    let globalValue;
    let perIpValue;

    if (!lastTs || (now - lastTs) > WINDOW_MS) {
      globalValue = Number(await redisCommand(["INCR", globalKey]));
      perIpValue = Number(await redisCommand(["INCR", countKey]));
      await redisCommand(["SET", lastKey, String(now), "EX", String(WINDOW_HOURS * 2 * 60 * 60)]);
      counted = true;
    } else {
      globalValue = Number(await redisCommand(["GET", globalKey]) || DEFAULT_START);
      perIpValue = Number(await redisCommand(["GET", countKey]) || 1);
    }

    return res.status(200).json({ value: globalValue, byIp: perIpValue, counted });
  } catch (err) {
    console.error("VISITS Redis error", err);
    return res.status(500).json({ error: "Visits storage error" });
  }
}
