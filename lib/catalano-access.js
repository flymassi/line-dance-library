import crypto from "node:crypto";
import { redisCommand, normalizeUsername } from "./catalano-store.js";

const PREFIX = "ws:catalano:access:v1:";
const SIX_HOURS = 6 * 60 * 60;
const AUDIT_TTL = 30 * 24 * 60 * 60;
const COOKIE = "ws_catalano_auth";
const adminName = () => normalizeUsername(process.env.CATALANO_ADMIN_USER || "max");
const deviceKey = user => PREFIX + "device:" + normalizeUsername(user);
const metaKey = user => PREFIX + "device-meta:" + normalizeUsername(user);
const versionKey = user => PREFIX + "version:" + normalizeUsername(user);
const auditKey = user => PREFIX + "audit:" + normalizeUsername(user);
const sessionKey = token => PREFIX + "session:" + crypto.createHash("sha256").update(token).digest("hex");

function authError(message, code = "UNAUTHORIZED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function hashDevice(deviceId) {
  const clean = String(deviceId || "").trim().toLowerCase();
  if (!/^[a-f0-9]{32,64}$/.test(clean)) authError("Identificativo dispositivo mancante. Aggiorna la pagina.", "BAD_DEVICE");
  return crypto.createHash("sha256").update(clean).digest("hex");
}
function tokenFromRequest(req) {
  const header = String(req.headers?.cookie || "");
  for (const entry of header.split(";")) {
    const [name, ...value] = entry.trim().split("=");
    if (name === COOKIE) return value.join("=") || "";
  }
  return "";
}
export function setAuthCookie(res, token) {
  res.setHeader("Set-Cookie", COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + SIX_HOURS);
}
export function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}
export function isAdminUsername(username) {
  return normalizeUsername(username) === adminName();
}
export async function auditCatalano(username, action, hash = "") {
  const name = normalizeUsername(username);
  if (!name) return;
  const event = JSON.stringify({
    at:new Date().toISOString(),
    event:String(action || "").slice(0,30),
    device:hash ? String(hash).slice(-6) : ""
  });
  try {
    await redisCommand(["LPUSH", auditKey(name), event]);
    await redisCommand(["LTRIM", auditKey(name), "0", "29"]);
    await redisCommand(["EXPIRE", auditKey(name), String(AUDIT_TTL)]);
  } catch (error) {
    console.error("CATALANO audit unavailable", error);
  }
}
export async function registerCatalanoDevice(username, deviceId, admin = false) {
  const name = normalizeUsername(username);
  if (!name) authError("Utente non valido.", "BAD_DEVICE");
  const hash = hashDevice(deviceId);
  if (!admin) {
    // Atomic first-device claim prevents two concurrent first logins from binding different devices.
    const reserved = await redisCommand(["SET", deviceKey(name), hash, "NX"]);
    if (reserved !== "OK") {
      const existing = await redisCommand(["GET", deviceKey(name)]);
      if (existing !== hash) {
        await auditCatalano(name, "device_denied", hash);
        authError("Account già associato a un altro dispositivo. Chiedi all'amministratore lo sblocco del dispositivo precedente.", "DEVICE_LIMIT");
      }
    }
  }
  const now = new Date().toISOString();
  const previousRaw = await redisCommand(["GET", metaKey(name)]);
  let previous = {};
  try { previous = JSON.parse(previousRaw || "{}") || {}; } catch {}
  if (!admin) {
    await redisCommand(["SET", metaKey(name), JSON.stringify({
      registeredAt: previous.hash === hash ? previous.registeredAt || now : now,
      lastLoginAt: now, hash
    })]);
  }
  await auditCatalano(name, "login", hash);
  return hash;
}
export async function createCatalanoSession(res, username, deviceId, admin = false) {
  const name = normalizeUsername(username);
  const hash = await registerCatalanoDevice(name, deviceId, admin);
  const version = String(await redisCommand(["GET", versionKey(name)]) || "0");
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const session = {
    username:name, admin:!!admin, deviceHash:hash, version,
    createdAt:now, expiresAt:now + SIX_HOURS * 1000
  };
  await redisCommand(["SET", sessionKey(token), JSON.stringify(session), "EX", String(SIX_HOURS)]);
  setAuthCookie(res, token);
  return {user:name, admin:!!admin, expiresAt:session.expiresAt};
}
export async function verifyCatalanoSession(req, deviceId) {
  const token = tokenFromRequest(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const raw = await redisCommand(["GET", sessionKey(token)]);
  if (!raw) return null;
  let session;
  try { session = JSON.parse(raw); } catch { return null; }
  if (!session?.username || !session?.expiresAt || session.expiresAt <= Date.now()) return null;
  let hash;
  try { hash = hashDevice(deviceId); } catch { return null; }
  if (hash !== session.deviceHash) return null;
  const version = String(await redisCommand(["GET", versionKey(session.username)]) || "0");
  if (version !== String(session.version)) return null;
  if (!session.admin) {
    const registered = await redisCommand(["GET", deviceKey(session.username)]);
    if (registered !== hash) return null;
  }
  return {
    user:session.username, admin:!!session.admin, expiresAt:session.expiresAt
  };
}
export async function logoutCatalanoSession(req, res) {
  const token = tokenFromRequest(req);
  if (/^[a-f0-9]{64}$/.test(token)) {
    await redisCommand(["DEL", sessionKey(token)]);
  }
  clearAuthCookie(res);
}
export async function revokeCatalanoAccess(username, {releaseDevice = false} = {}) {
  const name = normalizeUsername(username);
  if (!name || isAdminUsername(name)) authError("Non è possibile modificare il dispositivo amministratore.", "BAD_INPUT");
  // Version invalidates all existing session cookies for this account.
  await redisCommand(["INCR", versionKey(name)]);
  if (releaseDevice) {
    await redisCommand(["DEL", deviceKey(name), metaKey(name)]);
    await auditCatalano(name, "device_released");
  } else {
    await auditCatalano(name, "sessions_revoked");
  }
}
export async function getCatalanoAccessOverview(username) {
  const name = normalizeUsername(username);
  const [device, metaRaw, events] = await Promise.all([
    isAdminUsername(name) ? Promise.resolve(null) : redisCommand(["GET",deviceKey(name)]),
    isAdminUsername(name) ? Promise.resolve(null) : redisCommand(["GET",metaKey(name)]),
    redisCommand(["LRANGE",auditKey(name),"0","9"])
  ]);
  let meta = {};
  try { meta = JSON.parse(metaRaw || "{}") || {}; } catch {}
  return {
    admin:isAdminUsername(name),
    deviceRegistered:!!device,
    registeredAt:device ? String(meta.registeredAt || "") : "",
    lastLoginAt:String(meta.lastLoginAt || ""),
    accessEvents:(Array.isArray(events) ? events : []).flatMap(event=>{
      try {
        const value=JSON.parse(event);
        return value?.at && value?.event ? [value] : [];
      } catch { return []; }
    })
  };
}
export async function checkCatalanoLoginRate(ip, username) {
  const safeIp = crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0,24);
  const safeUser = crypto.createHash("sha256").update(normalizeUsername(username)).digest("hex").slice(0,24);
  const keys=[PREFIX+"rate:ip:"+safeIp,PREFIX+"rate:user:"+safeUser];
  const [byIp,byUser]=await Promise.all(keys.map(async key=>{
    const count = Number(await redisCommand(["INCR",key]));
    await redisCommand(["EXPIRE",key,"900","NX"]);
    return count;
  }));
  return byIp<=40 && byUser<=15;
}
