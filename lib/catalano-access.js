import crypto from "node:crypto";
import { redisCommand, normalizeUsername } from "./catalano-store.js";

const PREFIX = "ws:catalano:access:v1:";
const SIX_HOURS = 6 * 60 * 60;
const AUDIT_TTL = 30 * 24 * 60 * 60;
const COOKIE = "ws_catalano_auth";
const adminName = () => normalizeUsername(process.env.CATALANO_ADMIN_USER || "max");
const deviceKey = user => PREFIX + "device:" + normalizeUsername(user);
const activeKey = user => PREFIX + "active:" + normalizeUsername(user);
const metaKey = user => PREFIX + "device-meta:" + normalizeUsername(user);
const versionKey = user => PREFIX + "version:" + normalizeUsername(user);
const auditKey = user => PREFIX + "audit:" + normalizeUsername(user);
const tokenHash = token => crypto.createHash("sha256").update(token).digest("hex");
const sessionKey = token => PREFIX + "session:" + tokenHash(token);

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
// Each successful non-admin login atomically replaces the previous active session.
// The old browser's cookie remains opaque, but fails all subsequent server checks.
export async function createCatalanoSession(res, username, deviceId, admin = false) {
  const name = normalizeUsername(username);
  if (!name) authError("Utente non valido.", "BAD_DEVICE");
  const hash = hashDevice(deviceId);
  const version = String(await redisCommand(["GET", versionKey(name)]) || "0");
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const session = {
    username:name, admin:!!admin, deviceHash:hash, version,
    createdAt:now, expiresAt:now + SIX_HOURS * 1000
  };
  let replaced = false;
  if (admin) {
    // The administrator has independent sessions across all devices.
    await redisCommand(["SET", sessionKey(token), JSON.stringify(session), "EX", String(SIX_HOURS)]);
  } else {
    const previousRaw = await redisCommand(["GET", metaKey(name)]);
    let previous = {};
    try { previous = JSON.parse(previousRaw || "{}") || {}; } catch {}
    const meta = {
      registeredAt:previous.registeredAt || new Date(now).toISOString(),
      lastLoginAt:new Date(now).toISOString(),
      hash
    };
    // Redis script is a single atomic operation, including replacement.
    // Never separately set the new session and the active marker.
    const script = [
      "local prior = redis.call('GET', KEYS[2])",
      "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
      "redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])",
      "redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[2])",
      "redis.call('SET', KEYS[4], ARGV[5])",
      "return prior or ''"
    ].join("\n");
    const prior = await redisCommand([
      "EVAL", script, "4", sessionKey(token), activeKey(name),
      deviceKey(name), metaKey(name),
      JSON.stringify(session), String(SIX_HOURS), tokenHash(token), hash,
      JSON.stringify(meta)
    ]);
    replaced = !!prior;
  }
  setAuthCookie(res, token);
  await auditCatalano(name, replaced ? "login_replaced" : "login", hash);
  return {user:name, admin:!!admin, expiresAt:session.expiresAt};
}
export async function inspectCatalanoSession(req, deviceId) {
  const token = tokenFromRequest(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return {session:null,reason:"NO_SESSION"};
  const raw = await redisCommand(["GET", sessionKey(token)]);
  if (!raw) return {session:null,reason:"NO_SESSION"};
  let session;
  try { session = JSON.parse(raw); } catch { return {session:null,reason:"INVALID_SESSION"}; }
  if (!session?.username || !session?.expiresAt || session.expiresAt <= Date.now()) {
    return {session:null,reason:"EXPIRED"};
  }
  let hash;
  try { hash = hashDevice(deviceId); } catch { return {session:null,reason:"INVALID_DEVICE"}; }
  if (hash !== session.deviceHash) return {session:null,reason:"INVALID_DEVICE"};
  const version = String(await redisCommand(["GET", versionKey(session.username)]) || "0");
  if (version !== String(session.version)) return {session:null,reason:"REVOKED"};
  if (!session.admin) {
    const current = await redisCommand(["GET", activeKey(session.username)]);
    // A newer successful login takes ownership, even from the same device.
    if (current !== tokenHash(token)) return {session:null,reason:"REPLACED"};
  }
  return {
    session:{user:session.username,admin:!!session.admin,expiresAt:session.expiresAt},
    reason:null
  };
}
export async function verifyCatalanoSession(req, deviceId) {
  return (await inspectCatalanoSession(req, deviceId)).session;
}
export async function logoutCatalanoSession(req, res) {
  const token = tokenFromRequest(req);
  if (/^[a-f0-9]{64}$/.test(token)) {
    const key = sessionKey(token);
    const raw = await redisCommand(["GET", key]);
    let session;
    try { session = JSON.parse(raw || "null"); } catch {}
    if (session?.username && !session.admin) {
      // An older logout must never kick out a more recent login.
      const script = [
        "redis.call('DEL', KEYS[1])",
        "if redis.call('GET', KEYS[2]) == ARGV[1] then",
        "  redis.call('DEL', KEYS[2], KEYS[3])",
        "end",
        "return 1"
      ].join("\n");
      await redisCommand([
        "EVAL", script, "3", key, activeKey(session.username),
        deviceKey(session.username), tokenHash(token)
      ]);
    } else {
      await redisCommand(["DEL", key]);
    }
  }
  clearAuthCookie(res);
}
export async function revokeCatalanoAccess(username, {releaseDevice = false} = {}) {
  const name = normalizeUsername(username);
  if (!name || isAdminUsername(name)) authError("Non è possibile modificare la sessione amministratore.", "BAD_INPUT");
  // Invalidate all sessions, including any still held by a previous device.
  await redisCommand(["INCR", versionKey(name)]);
  await redisCommand(["DEL", activeKey(name), deviceKey(name)]);
  if (releaseDevice) {
    // Keep last-access metadata for the administrator's audit view.
    await auditCatalano(name, "session_revoked");
  } else {
    await auditCatalano(name, "sessions_revoked");
  }
}
export async function getCatalanoAccessOverview(username) {
  const name = normalizeUsername(username);
  const [active, metaRaw, events] = await Promise.all([
    isAdminUsername(name) ? Promise.resolve(null) : redisCommand(["GET",activeKey(name)]),
    isAdminUsername(name) ? Promise.resolve(null) : redisCommand(["GET",metaKey(name)]),
    redisCommand(["LRANGE",auditKey(name),"0","9"])
  ]);
  let meta = {};
  try { meta = JSON.parse(metaRaw || "{}") || {}; } catch {}
  return {
    admin:isAdminUsername(name),
    sessionActive:!!active,
    deviceRegistered:!!active,
    registeredAt:String(meta.registeredAt || ""),
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
