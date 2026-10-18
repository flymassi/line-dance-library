import crypto from "crypto";
import { getStoredUser, verifyPassword } from "../lib/catalano-store.js";

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function validLegacyUser(username, password) {
  try {
    const raw = process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]";
    const users = JSON.parse(raw);
    return Array.isArray(users) && users.some(u =>
      timingSafeEqual(u?.user, username) && timingSafeEqual(u?.pass, password)
    );
  } catch (err) {
    console.error("CATALANO login: legacy users parse error", err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Missing credentials" });
  }

  try {
    // Nuovi utenti: archivio Redis/Upstash, attivo subito dopo l'approvazione.
    try {
      const stored = await getStoredUser(username);
      if (stored && verifyPassword(password, stored)) {
        return res.status(200).json({
          ok: true,
          token: crypto.randomBytes(32).toString("hex"),
          user: stored.user || username
        });
      }
    } catch (redisErr) {
      // Mantiene compatibilità con gli utenti storici anche se Redis ha un problema.
      console.error("CATALANO login: Redis unavailable", redisErr);
    }

    // Utenti storici già presenti in SAGGIO_USERS/CATALANO_USERS.
    if (validLegacyUser(username, password)) {
      return res.status(200).json({
        ok: true,
        token: crypto.randomBytes(32).toString("hex"),
        user: username
      });
    }

    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  } catch (err) {
    console.error("CATALANO login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
