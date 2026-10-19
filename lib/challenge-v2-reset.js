import { redisCommand } from "./catalano-store.js";

const DONE_KEY = "ws:challenge:system:v2-reset-done";
const LOCK_KEY = "ws:challenge:system:v2-reset-lock";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function ensureChallengeV2Reset() {
  if (process.env.VERCEL_ENV !== "production") return false;
  if (String(await redisCommand(["GET", DONE_KEY]) || "") === "1") return false;

  const lock = await redisCommand(["SET", LOCK_KEY, "1", "NX", "EX", 30]);
  if (lock !== "OK") {
    for (let i = 0; i < 20; i += 1) {
      await wait(100);
      if (String(await redisCommand(["GET", DONE_KEY]) || "") === "1") return false;
    }
    return false;
  }

  try {
    let cursor = "0";
    const keys = [];
    do {
      const result = await redisCommand(["SCAN", cursor, "MATCH", "ws:challenge:*", "COUNT", "200"]);
      cursor = String(result?.[0] ?? "0");
      const batch = Array.isArray(result?.[1]) ? result[1] : [];
      keys.push(...batch.filter(key => !String(key).startsWith("ws:challenge:system:")));
    } while (cursor !== "0");

    for (let i = 0; i < keys.length; i += 100) {
      await redisCommand(["DEL", ...keys.slice(i, i + 100)]);
    }

    await redisCommand(["SET", DONE_KEY, "1"]);
    return true;
  } finally {
    await redisCommand(["DEL", LOCK_KEY]).catch(() => {});
  }
}
