import crypto from "crypto";
import { deleteStoredUser, listStoredUsers, normalizeUsername } from "../lib/catalano-store.js";

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function validAdmin(username, password) {
  const requiredAdmin = normalizeUsername(process.env.CATALANO_ADMIN_USER || "max");
  if (normalizeUsername(username) !== requiredAdmin) return false;

  try {
    const raw = process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]";
    const users = JSON.parse(raw);
    return Array.isArray(users) && users.some(u =>
      normalizeUsername(u?.user) === requiredAdmin && timingSafeEqual(u?.pass, password)
    );
  } catch (err) {
    console.error("CATALANO users: admin users parse error", err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const action = String(req.body?.action || "").trim().toLowerCase();
  const adminUser = String(req.body?.adminUser || "").trim();
  const adminPassword = String(req.body?.adminPassword || "");

  if (!validAdmin(adminUser, adminPassword)) {
    return res.status(401).json({ ok: false, error: "Credenziali amministratore non valide" });
  }

  try {
    if (action === "list") {
      const users = await listStoredUsers();
      return res.status(200).json({ ok: true, users });
    }

    if (action === "delete") {
      const username = String(req.body?.username || "").trim();
      if (!username) return res.status(400).json({ ok: false, error: "Username mancante" });
      const deleted = await deleteStoredUser(username);
      if (!deleted) return res.status(404).json({ ok: false, error: "Utente non trovato" });
      return res.status(200).json({ ok: true, deleted: true, username });
    }

    return res.status(400).json({ ok: false, error: "Azione non valida" });
  } catch (err) {
    console.error("CATALANO users: storage error", err);
    return res.status(503).json({ ok: false, error: "Archivio utenti temporaneamente non disponibile" });
  }
}
