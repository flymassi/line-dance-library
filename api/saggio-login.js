import crypto from "crypto";

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { username, password } = req.body || {};

  try {
    const raw = process.env.SAGGIO_USERS || "[]";
    const users = JSON.parse(raw);
    const found = users.find(u => timingSafeEqual(u.user, username) && timingSafeEqual(u.pass, password));

    if (!found) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
