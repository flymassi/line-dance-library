export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { username, password } = req.body || {};

  try {
    // Leggiamo la lista utenti dalle variabili ENV
    const raw = process.env.SAGGIO_USERS || "[]";
    const users = JSON.parse(raw);

    // Cerchiamo una coppia user/pass valida
    const found = users.find(
      u => u.user === username && u.pass === password
    );

    if (!found) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    // Generiamo token
    const token = Buffer.from(
      `${username}:${Date.now()}`
    ).toString("base64");

    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

