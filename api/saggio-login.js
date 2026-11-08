import crypto from "node:crypto";
import { getStoredUser, normalizeUsername, verifyPassword } from "../lib/catalano-store.js";
import {
  createCatalanoSession, checkCatalanoLoginRate,
  isAdminUsername, auditCatalano
} from "../lib/catalano-access.js";

function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function validLegacyUser(username, password) {
  try {
    const users = JSON.parse(process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]");
    return Array.isArray(users) && users.some(u =>
      timingSafeEqual(normalizeUsername(u?.user), normalizeUsername(username)) &&
      timingSafeEqual(u?.pass, password)
    );
  } catch (error) {
    console.error("CATALANO login: legacy config invalid", error);
    return false;
  }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ok:false,error:"Metodo non consentito"});
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const deviceId = String(req.body?.deviceId || "");
  if (!username || username.length > 60 || !password || password.length > 120 || !/^[a-f0-9]{32,64}$/i.test(deviceId)) {
    return res.status(400).json({ok:false,error:"Credenziali o dispositivo mancanti. Aggiorna la pagina."});
  }
  try {
    const ip = String(req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown").split(",")[0].trim();
    if (!await checkCatalanoLoginRate(ip, username)) {
      return res.status(429).json({ok:false,error:"Troppi tentativi di accesso. Riprova tra 15 minuti."});
    }
    const legacy = validLegacyUser(username,password);
    let storedValid = false;
    if (!legacy) {
      const stored = await getStoredUser(username);
      storedValid = !!stored && verifyPassword(password,stored);
    }
    if (!legacy && !storedValid) {
      await auditCatalano(username,"login_failed");
      return res.status(401).json({ok:false,error:"Credenziali non valide o account non approvato."});
    }
    // Admin is verified against the configured legacy administrator credentials,
    // not merely against a claimed name supplied by the browser.
    const admin = legacy && isAdminUsername(username);
    const result = await createCatalanoSession(res,username,deviceId,admin);
    return res.status(200).json({ok:true,...result});
  } catch (error) {
    if (error.code==="DEVICE_LIMIT") return res.status(409).json({ok:false,code:error.code,error:error.message});
    if (error.code==="BAD_DEVICE") return res.status(400).json({ok:false,error:error.message});
    console.error("CATALANO login unavailable",error);
    return res.status(503).json({ok:false,error:"Autenticazione temporaneamente non disponibile. Riprova."});
  }
}
