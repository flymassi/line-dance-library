import { redisCommand } from "../lib/catalano-store.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.VERCEL_ENV !== "preview") return res.status(404).json({ ok: false });
  if (process.env.VERCEL_GIT_COMMIT_REF !== "western-spritz-challenge-v2-20261019") return res.status(404).json({ ok: false });
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  if (String(req.query?.confirm || "") !== "RESET_CHALLENGE") return res.status(403).json({ ok: false });

  let cursor = "0";
  const keys = [];
  do {
    const result = await redisCommand(["SCAN", cursor, "MATCH", "ws:challenge:*", "COUNT", "200"]);
    cursor = String(result?.[0] ?? "0");
    if (Array.isArray(result?.[1])) keys.push(...result[1]);
  } while (cursor !== "0");

  for (let i = 0; i < keys.length; i += 100) {
    await redisCommand(["DEL", ...keys.slice(i, i + 100)]);
  }

  return res.status(200).json({ ok: true, deleted: keys.length });
}
