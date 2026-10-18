import crypto from "crypto";

const USER_PREFIX = "ws:catalano:user:";
const REQUEST_PREFIX = "ws:catalano:request:";
const PENDING_USER_PREFIX = "ws:catalano:pending-user:";
const RATE_PREFIX = "ws:catalano:rate:";
const REQUEST_TTL_SECONDS = 7 * 24 * 60 * 60;

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getRedisConfig() {
  const url = String(
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ""
  ).replace(/\/$/, "");

  const token = String(
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ""
  );

  if (!url || !token) {
    throw new Error("Redis/Upstash non configurato");
  }
  return { url, token };
}

export async function redisCommand(command) {
  const { url, token } = getRedisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error || `Redis HTTP ${response.status}`);
  }
  return data?.result;
}

export async function redisPipeline(commands) {
  const { url, token } = getRedisConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`Redis pipeline HTTP ${response.status}`);
  }
  const failed = data.find(item => item?.error);
  if (failed) throw new Error(failed.error);
  return data.map(item => item?.result);
}

export function userKey(username) {
  return `${USER_PREFIX}${normalizeUsername(username)}`;
}

export function requestKey(id) {
  return `${REQUEST_PREFIX}${id}`;
}

export function pendingUserKey(username) {
  return `${PENDING_USER_PREFIX}${normalizeUsername(username)}`;
}

export async function getStoredUser(username) {
  const raw = await redisCommand(["GET", userKey(username)]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function isLegacyUser(username) {
  try {
    const raw = process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]";
    const users = JSON.parse(raw);
    return Array.isArray(users) && users.some(u => normalizeUsername(u?.user) === normalizeUsername(username));
  } catch {
    return false;
  }
}

export async function createPendingRequest(payload) {
  const id = crypto.randomUUID();
  const username = normalizeUsername(payload.username);
  const lockKey = pendingUserKey(username);
  const lockResult = await redisCommand(["SET", lockKey, id, "NX", "EX", REQUEST_TTL_SECONDS]);
  if (lockResult !== "OK") {
    const err = new Error("Esiste già una richiesta in attesa per questo username");
    err.code = "PENDING_EXISTS";
    throw err;
  }

  try {
    await redisCommand([
      "SET",
      requestKey(id),
      JSON.stringify({ ...payload, id, usernameNorm: username }),
      "EX",
      REQUEST_TTL_SECONDS
    ]);
  } catch (err) {
    await redisCommand(["DEL", lockKey]).catch(() => {});
    throw err;
  }

  return id;
}

export async function getPendingRequest(id) {
  const raw = await redisCommand(["GET", requestKey(id)]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deletePendingRequest(request) {
  if (!request) return;
  await redisPipeline([
    ["DEL", requestKey(request.id)],
    ["DEL", pendingUserKey(request.usernameNorm || request.username)]
  ]);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  try {
    const actual = crypto.scryptSync(String(password), stored.salt, 64);
    const expected = Buffer.from(stored.hash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function approvePendingRequest(request) {
  const normalized = normalizeUsername(request.usernameNorm || request.username);
  if (!normalized) throw new Error("Username non valido");

  if (await isLegacyUser(request.username)) {
    const err = new Error("Username già presente tra gli utenti esistenti");
    err.code = "USER_EXISTS";
    throw err;
  }

  const existing = await getStoredUser(normalized);
  if (existing) {
    const err = new Error("Username già approvato");
    err.code = "USER_EXISTS";
    throw err;
  }

  const { salt, hash } = hashPassword(request.password);
  const record = {
    user: request.username,
    usernameNorm: normalized,
    name: request.name,
    email: request.email || '',
    salt,
    hash,
    approvedAt: new Date().toISOString()
  };

  const result = await redisCommand(["SET", userKey(normalized), JSON.stringify(record), "NX"]);
  if (result !== "OK") {
    const err = new Error("Username già approvato");
    err.code = "USER_EXISTS";
    throw err;
  }

  await deletePendingRequest(request);
  return record;
}

export function approvalSecret() {
  const secret =
    process.env.CATALANO_APPROVAL_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";
  if (!secret) throw new Error("Segreto approvazione non configurato");
  return secret;
}

export function signApprovalId(id) {
  return crypto.createHmac("sha256", approvalSecret()).update(String(id)).digest("hex");
}

export function validApprovalSignature(id, signature) {
  const expected = Buffer.from(signApprovalId(id));
  const actual = Buffer.from(String(signature || ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function checkRateLimit(ip) {
  const safeIp = String(ip || "unknown").replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 100);
  const key = `${RATE_PREFIX}${safeIp}`;
  const [count] = await redisPipeline([
    ["INCR", key],
    ["EXPIRE", key, 3600, "NX"]
  ]);
  return Number(count || 0) <= 5;
}


export async function listStoredUsers() {
  let cursor = "0";
  const keys = [];

  do {
    const result = await redisCommand(["SCAN", cursor, "MATCH", `${USER_PREFIX}*`, "COUNT", "100"]);
    if (!Array.isArray(result) || result.length < 2) break;
    cursor = String(result[0] ?? "0");
    const batch = Array.isArray(result[1]) ? result[1] : [];
    keys.push(...batch);
  } while (cursor !== "0" && keys.length < 5000);

  if (!keys.length) return [];

  const users = [];
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    const values = await redisPipeline(batch.map(key => ["GET", key]));
    values.forEach(raw => {
      if (!raw) return;
      try {
        const user = JSON.parse(raw);
        if (user && user.user) {
          users.push({
            user: String(user.user),
            name: String(user.name || ""),
            email: String(user.email || ""),
            approvedAt: String(user.approvedAt || "")
          });
        }
      } catch {}
    });
  }

  users.sort((a, b) => a.user.localeCompare(b.user, "it", { sensitivity: "base" }));
  return users;
}

export async function deleteStoredUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return 0;
  return Number(await redisCommand(["DEL", userKey(normalized)]) || 0);
}
