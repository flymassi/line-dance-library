import crypto from "node:crypto";
import { redisCommand } from "./catalano-store.js";
import { buildDuelQuestions, sanitizeNickname, normalizeDeviceId, deviceHash } from "./challenge-store.js";

// Dedicated namespace: open challenges do not change Duel, Arena or daily Challenge data.
const PREFIX = "ws:open-challenge:v1:";
const OPEN_SECONDS = 7 * 24 * 60 * 60;
const RETAIN_SECONDS = 45 * 24 * 60 * 60;
const QUESTION_SECONDS = 15;
const QUESTION_MS = QUESTION_SECONDS * 1000;
const GRACE_MS = 2000;
const TOP_COUNT = 30;

function failure(message, code = "BAD_INPUT") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function validId(value) {
  const id = String(value || "");
  if (!/^[a-f0-9]{20}$/.test(id)) failure("Link della Sfida Aperta non valido.");
  return id;
}
function validPlayer(nickname, deviceId) {
  const name = sanitizeNickname(nickname);
  const device = normalizeDeviceId(deviceId);
  if (!name || !device) failure("Nickname non valido (2-18 caratteri) oppure dispositivo non riconosciuto.");
  return { nickname: name, hash: deviceHash(device) };
}
const metaKey = id => PREFIX + "meta:" + id;
const playerKey = (id, hash) => PREFIX + "player:" + id + ":" + hash;
const membersKey = id => PREFIX + "members:" + id;
const scoresKey = id => PREFIX + "scores:" + id;
const entriesKey = id => PREFIX + "entries:" + id;
const lockKey = (id, hash) => PREFIX + "lock:" + id + ":" + hash;

async function readJson(key) {
  const raw = await redisCommand(["GET", key]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function ttlLeft(meta) {
  return Math.max(1, Math.ceil((meta.retainedUntil - Date.now()) / 1000));
}
async function getMeta(id) {
  const meta = await readJson(metaKey(validId(id)));
  if (!meta || Date.now() >= meta.retainedUntil) failure("Questa Sfida Aperta non e piu disponibile.", "NOT_FOUND");
  return meta;
}
function ensureOpen(meta) {
  if (Date.now() >= meta.closesAt) failure("Questa Sfida Aperta e terminata. Puoi ancora consultare la classifica.", "CLOSED");
}
async function withLock(id, hash, fn) {
  const key = lockKey(id, hash);
  const token = crypto.randomBytes(12).toString("hex");
  if (await redisCommand(["SET", key, token, "NX", "EX", "15"]) !== "OK") {
    failure("Operazione gia in corso. Riprova.", "BUSY");
  }
  try { return await fn(); }
  finally {
    try {
      await redisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", "1", key, token]);
    } catch (error) { console.error("[WS Open Challenge lock]", error); }
  }
}
function newPlayer(name) {
  return { nickname:name, joinedAt:Date.now(), startedAt:0, questionStartedAt:0,
    currentIndex:0, score:0, correct:0, durationMs:0, finishedAt:0 };
}
async function readPlayer(meta, deviceId) {
  const device = normalizeDeviceId(deviceId);
  if (!device) return { hash:"", player:null };
  const hash = deviceHash(device);
  return { hash, player:await readJson(playerKey(meta.id, hash)) };
}
function publicMe(meta, player, rank) {
  if (!player) return null;
  const playing = !!player.startedAt && !player.finishedAt;
  const question = playing && Date.now() < meta.closesAt ? meta.questions[player.currentIndex] : null;
  return {
    nickname:player.nickname,
    status:player.finishedAt ? "finished" : player.startedAt ? "playing" : "ready",
    score:player.score, correct:player.correct, durationMs:player.durationMs,
    currentIndex:player.currentIndex,
    remainingMs: question ? Math.max(0, QUESTION_MS - (Date.now() - player.questionStartedAt)) : 0,
    question: question ? { id:question.id, prompt:question.prompt, options:question.options } : null,
    rank
  };
}
async function snapshot(meta, deviceId, notice = null) {
  const { hash, player } = await readPlayer(meta, deviceId);
  const [members, finished, topHashes] = await Promise.all([
    redisCommand(["SCARD", membersKey(meta.id)]),
    redisCommand(["ZCARD", scoresKey(meta.id)]),
    redisCommand(["ZREVRANGE", scoresKey(meta.id), "0", String(TOP_COUNT - 1)])
  ]);
  const hashes = Array.isArray(topHashes) ? topHashes : [];
  const [rows, ownRank] = await Promise.all([
    hashes.length ? redisCommand(["HMGET", entriesKey(meta.id), ...hashes]) : Promise.resolve([]),
    player?.finishedAt ? redisCommand(["ZREVRANK", scoresKey(meta.id), hash]) : Promise.resolve(null)
  ]);
  const leaderboard = [];
  for (let index = 0; index < hashes.length; index++) {
    try {
      const value = JSON.parse(rows?.[index] || "null");
      if (value && typeof value.nickname === "string") leaderboard.push({
        rank:index + 1, nickname:value.nickname, score:value.score,
        correct:value.correct, durationMs:value.durationMs
      });
    } catch {}
  }
  return {
    ok:true,
    challenge:{
      id:meta.id, hostNickname:meta.hostNickname,
      createdAt:meta.createdAt, closesAt:meta.closesAt, retainedUntil:meta.retainedUntil,
      status:Date.now() >= meta.closesAt ? "closed" : "open",
      questionCount:meta.questions.length, questionSeconds:QUESTION_SECONDS,
      participants:Number(members || 0), finished:Number(finished || 0)
    },
    me:publicMe(meta, player, ownRank == null ? null : Number(ownRank) + 1),
    leaderboard,
    ...(notice ? {notice} : {})
  };
}
export async function readOpenChallenge({ id, deviceId }) {
  return snapshot(await getMeta(id), deviceId);
}
export async function rateOpenChallenge(ip, action) {
  const hash = crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0,24);
  const key = PREFIX + "rate:" + action + ":" + hash;
  const count = Number(await redisCommand(["INCR", key]));
  await redisCommand(["EXPIRE", key, "3600", "NX"]);
  return count <= (action === "create" ? 12 : 200);
}
export async function createOpenChallenge({ nickname, deviceId }) {
  const player = validPlayer(nickname, deviceId);
  const id = crypto.randomBytes(10).toString("hex");
  const now = Date.now();
  const meta = {
    id, hostNickname:player.nickname, createdAt:now,
    closesAt:now + OPEN_SECONDS * 1000,
    retainedUntil:now + RETAIN_SECONDS * 1000,
    questions:buildDuelQuestions("open:" + id)
  };
  await redisCommand(["SET", metaKey(id), JSON.stringify(meta), "EX", String(RETAIN_SECONDS)]);
  await redisCommand(["SET", playerKey(id, player.hash), JSON.stringify(newPlayer(player.nickname)), "EX", String(RETAIN_SECONDS)]);
  await redisCommand(["SADD", membersKey(id), player.hash]);
  await redisCommand(["EXPIRE", membersKey(id), String(RETAIN_SECONDS)]);
  return snapshot(meta, deviceId);
}
export async function joinOpenChallenge({ id, nickname, deviceId }) {
  const meta = await getMeta(id);
  const contestant = validPlayer(nickname, deviceId);
  const key = playerKey(meta.id, contestant.hash);
  const existing = await readJson(key);
  if (existing) return snapshot(meta, deviceId);
  ensureOpen(meta);
  const result = await redisCommand(["SET", key, JSON.stringify(newPlayer(contestant.nickname)), "NX", "EX", String(ttlLeft(meta))]);
  if (result === "OK") {
    await redisCommand(["SADD", membersKey(meta.id), contestant.hash]);
    await redisCommand(["EXPIRE", membersKey(meta.id), String(ttlLeft(meta))]);
  }
  return snapshot(meta, deviceId);
}
export async function startOpenChallenge({ id, deviceId }) {
  const meta = await getMeta(id);
  const device = normalizeDeviceId(deviceId);
  if (!device) failure("Dispositivo non riconosciuto.");
  const hash = deviceHash(device);
  return withLock(meta.id, hash, async () => {
    const key = playerKey(meta.id, hash);
    const player = await readJson(key);
    if (!player) failure("Prima devi partecipare alla Sfida Aperta.", "NOT_JOINED");
    if (!player.startedAt) {
      ensureOpen(meta);
      player.startedAt = Date.now();
      player.questionStartedAt = player.startedAt;
      await redisCommand(["SET", key, JSON.stringify(player), "EX", String(ttlLeft(meta))]);
    }
    return snapshot(meta, deviceId);
  });
}
export async function answerOpenChallenge({ id, deviceId, questionId, answerIndex }) {
  const meta = await getMeta(id);
  const device = normalizeDeviceId(deviceId);
  if (!device) failure("Dispositivo non riconosciuto.");
  if (answerIndex !== null && (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3)) {
    failure("Risposta non valida.");
  }
  const hash = deviceHash(device);
  return withLock(meta.id, hash, async () => {
    const key = playerKey(meta.id, hash);
    const player = await readJson(key);
    if (!player) failure("Non partecipi a questa Sfida Aperta.", "NOT_JOINED");
    if (!player.startedAt) failure("Devi iniziare prima di rispondere.", "BAD_STATE");
    if (player.finishedAt) failure("Hai gia terminato la Sfida Aperta.", "FINISHED");
    ensureOpen(meta);
    const question = meta.questions[player.currentIndex];
    if (!question || question.id !== questionId) failure("Questa domanda e gia stata elaborata.", "QUESTION_MISMATCH");
    const elapsed = Math.max(0, Date.now() - player.questionStartedAt);
    const correct = answerIndex === question.correctIndex && elapsed <= QUESTION_MS + GRACE_MS;
    const remainingSeconds = Math.max(0, Math.ceil((QUESTION_MS - elapsed) / 1000));
    const gained = correct ? 1500 + remainingSeconds * 30 : 0;
    player.score += gained;
    if (correct) player.correct++;
    player.durationMs += Math.min(QUESTION_MS, elapsed);
    player.currentIndex++;
    if (player.currentIndex >= meta.questions.length) player.finishedAt = Date.now();
    else player.questionStartedAt = Date.now();
    const ttl = String(ttlLeft(meta));
    if (player.finishedAt) {
      // One atomic transaction makes the completed player and ranked result consistent.
      // The composite ZSET value orders by points, then correct answers, then faster time.
      const rankScore = player.score * 1000000000 + player.correct * 1000000 - player.durationMs;
      const entry = JSON.stringify({
        nickname:player.nickname, score:player.score, correct:player.correct,
        durationMs:player.durationMs, finishedAt:player.finishedAt
      });
      const script = [
        "redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2])",
        "redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4])",
        "redis.call('HSET',KEYS[3],ARGV[4],ARGV[5])",
        "redis.call('EXPIRE',KEYS[2],ARGV[2])",
        "redis.call('EXPIRE',KEYS[3],ARGV[2])",
        "return 1"
      ].join("\n");
      await redisCommand(["EVAL", script, "3", key, scoresKey(meta.id), entriesKey(meta.id),
        JSON.stringify(player), ttl, String(rankScore), hash, entry]);
    } else {
      await redisCommand(["SET", key, JSON.stringify(player), "EX", ttl]);
    }
    return snapshot(meta, deviceId, {correct, gained, correctAnswer:question.options[question.correctIndex]});
  });
}
