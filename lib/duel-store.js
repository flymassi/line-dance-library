import crypto from "node:crypto";
import { redisCommand } from "./catalano-store.js";
import { buildDuelQuestions, sanitizeNickname, normalizeDeviceId, deviceHash } from "./challenge-store.js";

const TTL_SECONDS = 7 * 24 * 60 * 60;
const QUESTION_SECONDS = 15;
const QUESTION_MS = QUESTION_SECONDS * 1000;
const GRACE_MS = 2000;
const PREFIX = "ws:duel:v1:";

function err(message, code = "BAD_INPUT") {
  const e = new Error(message);
  e.code = code;
  throw e;
}
function validId(value) {
  return /^[0-9a-f]{20}$/.test(String(value || "")) ? String(value) : "";
}
function validPlayer(nickname, deviceId) {
  const name = sanitizeNickname(nickname);
  const device = normalizeDeviceId(deviceId);
  if (!name || !device) err("Inserisci un nickname valido (2–18 caratteri).", "BAD_INPUT");
  return { nickname: name, deviceHash: deviceHash(device) };
}
const metaKey = id => `${PREFIX}meta:${id}`;
const playerKey = (id, role) => `${PREFIX}player:${id}:${role}`;
const lockKey = (id, role) => `${PREFIX}lock:${id}:${role}`;
async function readJson(key) {
  const raw = await redisCommand(["GET", key]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function requireMeta(id) {
  const valid = validId(id);
  if (!valid) err("Link del duello non valido.", "BAD_INPUT");
  const meta = await readJson(metaKey(valid));
  if (!meta || meta.expiresAt <= Date.now()) err("Questo duello non è più disponibile (durata: 7 giorni).", "NOT_FOUND");
  return meta;
}
function newPlayer({nickname, deviceHash}) {
  return {
    nickname, deviceHash, joinedAt: Date.now(), startedAt: 0,
    questionStartedAt: 0, currentIndex: 0,
    score: 0, correct: 0, durationMs: 0, finishedAt: 0
  };
}
async function withPlayerLock(id, role, task) {
  const key = lockKey(id, role), token = crypto.randomBytes(12).toString("hex");
  const acquired = await redisCommand(["SET", key, token, "NX", "EX", "12"]);
  if (acquired !== "OK") err("Operazione già in corso, riprova.", "BUSY");
  try { return await task(); }
  finally {
    // Rilascio condizionale atomico: non elimina il lock preso da un'altra richiesta.
    try {
      await redisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", "1", key, token]);
    } catch (error) { console.error("[WS Duel lock release]", error); }
  }
}
async function readPlayers(id) {
  const [host, guest] = await Promise.all([
    readJson(playerKey(id, "host")),
    readJson(playerKey(id, "guest"))
  ]);
  return { host, guest };
}
function roleFor(players, deviceId) {
  const device = normalizeDeviceId(deviceId);
  if (!device) return "";
  const hash = deviceHash(device);
  return players.host?.deviceHash === hash ? "host" : players.guest?.deviceHash === hash ? "guest" : "";
}
function publicPlayer(player, revealScore = false) {
  if (!player) return null;
  return {
    nickname: player.nickname,
    status: player.finishedAt ? "finished" : player.startedAt ? "playing" : "ready",
    ...(revealScore ? {score:player.score,correct:player.correct,durationMs:player.durationMs} : {})
  };
}
function outcome(players) {
  if (!players.host?.finishedAt || !players.guest?.finishedAt) return null;
  const a=players.host,b=players.guest;
  const by = a.score-b.score || a.correct-b.correct || b.durationMs-a.durationMs;
  return by > 0 ? "host" : by < 0 ? "guest" : "tie";
}
function publicDuel(meta, players, deviceId, notice = null) {
  const role=roleFor(players,deviceId);
  const me=role ? players[role] : null;
  const bothFinished=!!(players.host?.finishedAt && players.guest?.finishedAt);
  const mineFinished=!!me?.finishedAt;
  const showScores=bothFinished;
  const q=me?.startedAt && !me.finishedAt ? meta.questions[me.currentIndex] : null;
  const remainingMs=q ? Math.max(0,QUESTION_MS - (Date.now()-me.questionStartedAt)) : 0;
  return {
    ok:true,
    duel:{
      id:meta.id, createdAt:meta.createdAt, expiresAt:meta.expiresAt,
      questionCount:meta.questions.length, questionSeconds:QUESTION_SECONDS,
      status:bothFinished?"finished":!players.guest?"waiting": "active",
      host:publicPlayer(players.host,showScores),
      guest:publicPlayer(players.guest,showScores),
      winner:outcome(players)
    },
    me:me?{
      role,nickname:me.nickname,status:me.finishedAt?"finished":me.startedAt?"playing":"ready",
      score:me.score, correct:me.correct, durationMs:me.durationMs,
      currentIndex:me.currentIndex, remainingMs,
      question:q?{id:q.id,prompt:q.prompt,options:q.options}:null
    }:null,
    ...(notice?{notice}:{})
  };
}
async function current(id, deviceId, notice = null) {
  const meta=await requireMeta(id);
  const players=await readPlayers(meta.id);
  if (!players.host) err("Duello non disponibile.", "NOT_FOUND");
  return publicDuel(meta,players,deviceId,notice);
}
export async function readDuel({id,deviceId}) { return current(id,deviceId); }

export async function rateDuelRequest(ip, action) {
  const bucket = crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0,24);
  const key=`${PREFIX}rate:${action}:${bucket}`;
  const count=Number(await redisCommand(["INCR",key]));
  await redisCommand(["EXPIRE",key,"3600","NX"]);
  return count <= (action === "create" ? 12 : 48);
}
export async function createDuel({nickname,deviceId}) {
  const player=validPlayer(nickname,deviceId);
  const id=crypto.randomBytes(10).toString("hex");
  const now=Date.now();
  const meta={id,createdAt:now,expiresAt:now+TTL_SECONDS*1000,questions:buildDuelQuestions(id)};
  // Creazione isolata, senza toccare i dati della Challenge ufficiale.
  await redisCommand(["SET",metaKey(id),JSON.stringify(meta),"EX",String(TTL_SECONDS)]);
  await redisCommand(["SET",playerKey(id,"host"),JSON.stringify(newPlayer(player)),"EX",String(TTL_SECONDS)]);
  return current(id,deviceId);
}
export async function joinDuel({id,nickname,deviceId}) {
  const meta=await requireMeta(id);
  const player=validPlayer(nickname,deviceId);
  const host=await readJson(playerKey(meta.id,"host"));
  if (!host) err("Duello non disponibile.","NOT_FOUND");
  if (host.deviceHash===player.deviceHash) return current(meta.id,deviceId);
  const guestKey=playerKey(meta.id,"guest");
  const guest=await readJson(guestKey);
  if (guest) {
    if (guest.deviceHash!==player.deviceHash) err("Il duello ha già due partecipanti.","FULL");
    return current(meta.id,deviceId);
  }
  const remaining=Math.max(1,Math.ceil((meta.expiresAt-Date.now())/1000));
  const ok=await redisCommand(["SET",guestKey,JSON.stringify(newPlayer(player)),"NX","EX",String(remaining)]);
  if (ok!=="OK") {
    const claimed=await readJson(guestKey);
    if (claimed?.deviceHash!==player.deviceHash) err("Il duello ha già due partecipanti.","FULL");
  }
  return current(meta.id,deviceId);
}
export async function startDuel({id,deviceId}) {
  const meta=await requireMeta(id);
  const players=await readPlayers(meta.id);
  const role=roleFor(players,deviceId);
  if (!role) err("Devi prima accettare il duello.","NOT_JOINED");
  return withPlayerLock(meta.id,role,async()=>{
    const key=playerKey(meta.id,role);
    const player=await readJson(key);
    if (!player || player.deviceHash!==deviceHash(deviceId)) err("Sessione non valida.","NOT_JOINED");
    if (!player.startedAt) {
      player.startedAt=Date.now();
      player.questionStartedAt=player.startedAt;
      const remaining=Math.max(1,Math.ceil((meta.expiresAt-Date.now())/1000));
      await redisCommand(["SET",key,JSON.stringify(player),"EX",String(remaining)]);
    }
    return current(meta.id,deviceId);
  });
}
export async function answerDuel({id,deviceId,questionId,answerIndex}) {
  const meta=await requireMeta(id);
  const players=await readPlayers(meta.id);
  const role=roleFor(players,deviceId);
  if (!role) err("Non partecipi a questo duello.","NOT_JOINED");
  if (answerIndex!==null && (!Number.isInteger(answerIndex) || answerIndex<0 || answerIndex>3)) err("Risposta non valida.","BAD_INPUT");
  return withPlayerLock(meta.id,role,async()=>{
    const key=playerKey(meta.id,role);
    const player=await readJson(key);
    if (!player || player.deviceHash!==deviceHash(deviceId)) err("Sessione non valida.","NOT_JOINED");
    if (!player.startedAt) err("Inizia prima il duello.","BAD_STATE");
    if (player.finishedAt) err("Hai già concluso il duello.","FINISHED");
    const q=meta.questions[player.currentIndex];
    if (!q || q.id!==questionId) err("Questa domanda è già stata elaborata.","QUESTION_MISMATCH");
    const elapsed=Math.max(0,Date.now()-player.questionStartedAt);
    const correct=answerIndex===q.correctIndex && elapsed<=QUESTION_MS+GRACE_MS;
    const remaining=Math.max(0,Math.ceil((QUESTION_MS-elapsed)/1000));
    const gained=correct?1500+remaining*30:0;
    player.score+=gained;
    if (correct) player.correct++;
    player.durationMs+=Math.min(QUESTION_MS,elapsed);
    player.currentIndex++;
    const finished=player.currentIndex>=meta.questions.length;
    if (finished) player.finishedAt=Date.now();
    else player.questionStartedAt=Date.now();
    const remainingTtl=Math.max(1,Math.ceil((meta.expiresAt-Date.now())/1000));
    await redisCommand(["SET",key,JSON.stringify(player),"EX",String(remainingTtl)]);
    return current(meta.id,deviceId,{correct,gained,correctAnswer:q.options[q.correctIndex]});
  });
}
