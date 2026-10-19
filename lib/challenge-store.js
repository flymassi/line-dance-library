import crypto from "crypto";
import fs from "fs";
import { redisCommand, redisPipeline } from "./catalano-store.js";

const TIME_ZONE = "Europe/Rome";
const DAILY_QUESTION_COUNT = 10;
const DAILY_QUESTION_SECONDS = 15;
const WEEKEND_QUESTION_COUNT = 15;
const WEEKEND_QUESTION_SECONDS = 12;
const QUESTION_GRACE_MS = 2000;
const SESSION_TTL_SECONDS = 6 * 60 * 60;
const DAILY_ATTEMPT_TTL_SECONDS = 36 * 60 * 60;
const WEEKEND_ATTEMPT_TTL_SECONDS = 10 * 24 * 60 * 60;
const DAILY_TTL_SECONDS = 60 * 24 * 60 * 60;
const WEEKLY_TTL_SECONDS = 28 * 24 * 60 * 60;
const WEEKEND_TTL_SECONDS = 70 * 24 * 60 * 60;
const PROFILE_TTL_SECONDS = 400 * 24 * 60 * 60;

const START_RATE_PREFIX = "ws:challenge:rate:";
const SESSION_PREFIX = "ws:challenge:session:";
const ATTEMPT_PREFIX = "ws:challenge:attempt:";
const DAILY_PREFIX = "ws:challenge:daily:";
const DAILY_ENTRY_PREFIX = "ws:challenge:entry:";
const WEEKLY_PREFIX = "ws:challenge:weekly:";
const WEEKLY_GAMES_PREFIX = "ws:challenge:weekly-games:";
const WEEKEND_PREFIX = "ws:challenge:weekend:";
const WEEKEND_ENTRY_PREFIX = "ws:challenge:weekend-entry:";
const WEEKEND_ATTEMPT_PREFIX = "ws:challenge:weekend-attempt:";
const HALL_KEY = "ws:challenge:hall";
const HALL_GAMES_KEY = "ws:challenge:hall-games";
const PROFILE_PREFIX = "ws:challenge:profile:";
const ANSWER_LOCK_PREFIX = "ws:challenge:answer-lock:";

const LEVELS = [
  { key: "rookie", label: "Rookie", emoji: "🌵", min: 0 },
  { key: "cowboy", label: "Cowboy", emoji: "🤠", min: 25000 },
  { key: "outlaw", label: "Outlaw", emoji: "💀", min: 75000 },
  { key: "sheriff", label: "Sheriff", emoji: "⭐", min: 150000 },
  { key: "legend", label: "Legend", emoji: "🏆", min: 300000 }
];

let songCache = null;

function loadSongs() {
  if (songCache) return songCache;
  const paths = [
    new URL("../data/songs.json", import.meta.url),
    new URL(`file://${process.cwd().replace(/\\/g, "/")}/data/songs.json`)
  ];
  let raw = "";
  let lastError = null;
  for (const path of paths) {
    try {
      raw = fs.readFileSync(path, "utf8");
      if (raw) break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!raw) throw lastError || new Error("Archivio brani non disponibile");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Archivio brani non valido");
  songCache = parsed
    .map(row => ({
      year: Number(row?.year),
      songNumber: Number(row?.songNumber),
      danceTitle: String(row?.danceTitle || "").trim(),
      singerName: String(row?.singerName || "").trim(),
      songTitle: String(row?.songTitle || "").trim()
    }))
    .filter(row => [1, 2, 3, 4].includes(row.year))
    .filter(row => row.danceTitle && row.singerName && row.songTitle);
  if (songCache.length < WEEKEND_QUESTION_COUNT + 4) throw new Error("Brani insufficienti per la sfida");
  return songCache;
}

function hashToUint32(value) {
  const digest = crypto.createHash("sha256").update(String(value)).digest();
  return digest.readUInt32BE(0) || 0x6d2b79f5;
}

function seededRandom(seedText) {
  let state = hashToUint32(seedText);
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = String(value).trim().toLocaleLowerCase("it");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeOptions(correctValue, pool, random) {
  const correctKey = String(correctValue).toLocaleLowerCase("it");
  const distractors = shuffle(
    uniqueValues(pool).filter(value => String(value).toLocaleLowerCase("it") !== correctKey),
    random
  ).slice(0, 3);
  const options = shuffle([correctValue, ...distractors], random);
  if (options.length !== 4) throw new Error("Opzioni insufficienti per la sfida");
  return { options, correctIndex: options.indexOf(correctValue) };
}

export function getRomeDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getIsoWeekKey(dayKey) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNumber + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((date - firstThursday) / 604800000);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function shiftDayKey(dayKey, deltaDays) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isWeekendDay(dayKey) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function sanitizeNickname(value) {
  const nickname = String(value ?? "").replace(/\s+/g, " ").trim();
  if (nickname.length < 2 || nickname.length > 18) return "";
  if (!/^[\p{L}\p{N} ._'’\-]+$/u.test(nickname)) return "";
  return nickname;
}

export function normalizeDeviceId(value) {
  const deviceId = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{32,64}$/.test(deviceId) ? deviceId : "";
}

export function deviceHash(deviceId) {
  return crypto.createHash("sha256").update(normalizeDeviceId(deviceId)).digest("hex");
}

function buildQuestions(seed, count) {
  const songs = loadSongs();
  const random = seededRandom(seed);
  const selected = shuffle(songs, random).slice(0, count);
  const songTitles = songs.map(song => song.songTitle);
  const danceTitles = songs.map(song => song.danceTitle);
  const singers = songs.map(song => song.singerName);
  const typesPool = ["song-for-dance", "artist-for-song", "dance-for-song", "year-for-dance", "artist-for-dance"];
  const types = shuffle(Array.from({ length: count }, (_, index) => typesPool[index % typesPool.length]), random);
  return selected.map((song, index) => {
    const type = types[index];
    let prompt = "";
    let options = [];
    let correctIndex = 0;
    if (type === "song-for-dance") {
      prompt = `Quale canzone è associata al ballo “${song.danceTitle}”?`;
      ({ options, correctIndex } = makeOptions(song.songTitle, songTitles, random));
    } else if (type === "artist-for-song") {
      prompt = `Chi canta “${song.songTitle}”?`;
      ({ options, correctIndex } = makeOptions(song.singerName, singers, random));
    } else if (type === "dance-for-song") {
      prompt = `A quale ballo appartiene la canzone “${song.songTitle}”?`;
      ({ options, correctIndex } = makeOptions(song.danceTitle, danceTitles, random));
    } else if (type === "artist-for-dance") {
      prompt = `Qual è l'artista della canzone associata a “${song.danceTitle}”?`;
      ({ options, correctIndex } = makeOptions(song.singerName, singers, random));
    } else {
      prompt = `A quale anno del corso appartiene “${song.danceTitle}”?`;
      options = shuffle(["1° ANNO", "2° ANNO", "3° ANNO", "4° ANNO"], random);
      correctIndex = options.indexOf(`${song.year}° ANNO`);
    }
    return { id: `${seed}:${index + 1}:${song.songNumber}:${type}`, prompt, options, correctIndex };
  });
}

export function buildDailyQuestions(dayKey = getRomeDayKey()) {
  return buildQuestions(`daily:${dayKey}:v2`, DAILY_QUESTION_COUNT);
}
export function buildWeekendQuestions(weekKey = getIsoWeekKey(getRomeDayKey())) {
  return buildQuestions(`weekend:${weekKey}:v1`, WEEKEND_QUESTION_COUNT);
}

function sessionKey(id) { return `${SESSION_PREFIX}${id}`; }
function attemptKey(dayKey, hash) { return `${ATTEMPT_PREFIX}${dayKey}:${hash}`; }
function dailyKey(dayKey) { return `${DAILY_PREFIX}${dayKey}`; }
function dailyEntryKey(dayKey, hash) { return `${DAILY_ENTRY_PREFIX}${dayKey}:${hash}`; }
function weeklyKey(weekKey) { return `${WEEKLY_PREFIX}${weekKey}`; }
function weeklyGamesKey(weekKey) { return `${WEEKLY_GAMES_PREFIX}${weekKey}`; }
function weekendKey(weekKey) { return `${WEEKEND_PREFIX}${weekKey}`; }
function weekendEntryKey(weekKey, hash) { return `${WEEKEND_ENTRY_PREFIX}${weekKey}:${hash}`; }
function weekendAttemptKey(weekKey, hash) { return `${WEEKEND_ATTEMPT_PREFIX}${weekKey}:${hash}`; }
function profileKey(hash) { return `${PROFILE_PREFIX}${hash}`; }
function answerLockKey(id) { return `${ANSWER_LOCK_PREFIX}${id}`; }

async function readJson(key) {
  const raw = await redisCommand(["GET", key]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function writeSession(session) {
  await redisCommand(["SET", sessionKey(session.id), JSON.stringify(session), "EX", SESSION_TTL_SECONDS]);
}

export async function checkChallengeStartRateLimit(ip) {
  const safeIp = String(ip || "unknown").replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 100);
  const key = `${START_RATE_PREFIX}${safeIp}`;
  const [count] = await redisPipeline([["INCR", key], ["EXPIRE", key, 3600, "NX"]]);
  return Number(count || 0) <= 60;
}

function publicSessionPayload(session, resumed = false) {
  const seconds = Number(session.questionSeconds || DAILY_QUESTION_SECONDS);
  const elapsed = Math.max(0, Date.now() - Number(session.questionStartedAt || session.startedAt || Date.now()));
  return {
    sessionId: session.id,
    official: !!session.official,
    training: !session.official,
    resumed,
    mode: session.mode || "daily",
    modeLabel: session.modeLabel || "🤠 Sfida del giorno",
    dayKey: session.dayKey,
    weekKey: session.weekKey,
    currentIndex: Number(session.currentIndex || 0),
    score: Number(session.score || 0),
    correct: Number(session.correct || 0),
    questionCount: session.questions.length,
    secondsPerQuestion: seconds,
    remainingMs: Math.max(0, seconds * 1000 - elapsed),
    questions: session.questions.map(({ id, prompt, options }) => ({ id, prompt, options }))
  };
}

export async function startChallenge({ nickname, deviceId, mode = "daily", dayKeyOverride = "" }) {
  const cleanNickname = sanitizeNickname(nickname);
  const cleanDeviceId = normalizeDeviceId(deviceId);
  if (!cleanNickname || !cleanDeviceId) {
    const err = new Error("Nickname o dispositivo non validi"); err.code = "BAD_INPUT"; throw err;
  }
  const requestedMode = mode === "weekend" ? "weekend" : "daily";
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(dayKeyOverride) ? dayKeyOverride : getRomeDayKey();
  const weekKey = getIsoWeekKey(dayKey);
  if (requestedMode === "weekend" && !isWeekendDay(dayKey)) {
    const err = new Error("Il Weekend Showdown è disponibile solo sabato e domenica"); err.code = "WEEKEND_CLOSED"; throw err;
  }
  const hash = deviceHash(cleanDeviceId);
  const aKey = requestedMode === "weekend" ? weekendAttemptKey(weekKey, hash) : attemptKey(dayKey, hash);
  const attemptTtl = requestedMode === "weekend" ? WEEKEND_ATTEMPT_TTL_SECONDS : DAILY_ATTEMPT_TTL_SECONDS;
  const existingAttempt = String(await redisCommand(["GET", aKey]) || "");
  if (existingAttempt && existingAttempt !== "done") {
    const existingSession = await readJson(sessionKey(existingAttempt));
    if (existingSession && existingSession.deviceHash === hash && existingSession.official && String(existingSession.mode || "daily") === requestedMode) {
      existingSession.nickname = cleanNickname;
      await writeSession(existingSession);
      return publicSessionPayload(existingSession, true);
    }
  }
  const isWeekend = requestedMode === "weekend";
  const id = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const session = {
    id, mode: requestedMode, modeLabel: isWeekend ? "🔥 Weekend Showdown" : "🤠 Sfida del giorno",
    dayKey, weekKey, deviceHash: hash, nickname: cleanNickname, official: false,
    startedAt: now, questionStartedAt: now, currentIndex: 0, score: 0, correct: 0,
    questionSeconds: isWeekend ? WEEKEND_QUESTION_SECONDS : DAILY_QUESTION_SECONDS,
    questions: isWeekend ? buildWeekendQuestions(weekKey) : buildDailyQuestions(dayKey)
  };
  if (!existingAttempt) {
    const claim = await redisCommand(["SET", aKey, id, "NX", "EX", attemptTtl]);
    session.official = claim === "OK";
  }
  await writeSession(session);
  return publicSessionPayload(session, false);
}

function blankProfile() {
  return { nickname:"", streak:0, bestStreak:0, lastDay:"", games:0, dailyGames:0, weekendGames:0,
    totalScore:0, dailyScore:0, weekendScore:0, totalCorrect:0, totalQuestions:0, totalDurationMs:0,
    bestScore:0, bestCorrect:0, perfectGames:0, fastestPerfectMs:0, bestRank:0, weekendBestRank:0, updatedAt:"" };
}
function normalizeProfile(profile = {}) {
  const out = { ...blankProfile(), ...profile };
  for (const key of ["streak","bestStreak","games","dailyGames","weekendGames","totalScore","dailyScore","weekendScore","totalCorrect","totalQuestions","totalDurationMs","bestScore","bestCorrect","perfectGames","fastestPerfectMs","bestRank","weekendBestRank"]) out[key] = Number(out[key] || 0);
  out.nickname = String(out.nickname || ""); out.lastDay = String(out.lastDay || ""); out.updatedAt = String(out.updatedAt || "");
  return out;
}
async function getProfile(hash) { return normalizeProfile((await readJson(profileKey(hash))) || {}); }
async function writeProfile(hash, profile) { await redisCommand(["SET", profileKey(hash), JSON.stringify(profile), "EX", PROFILE_TTL_SECONDS]); }

function getLevel(totalScore) {
  const points = Math.max(0, Number(totalScore || 0));
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (points >= LEVELS[i].min) index = i;
  const current = LEVELS[index], next = LEVELS[index + 1] || null;
  const progress = next ? Math.max(0, Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100))) : 100;
  return { ...current, totalScore: points, next: next ? { ...next } : null, progress, pointsToNext: next ? Math.max(0, next.min - points) : 0 };
}
function buildBadges(profile) {
  const p = normalizeProfile(profile), level = getLevel(p.totalScore);
  return [
    {id:"first-ride",emoji:"🤠",name:"Primo Rodeo",description:"Completa la prima sfida ufficiale",earned:p.games>=1},
    {id:"perfect",emoji:"🎯",name:"Occhio di Falco",description:"Ottieni tutte le risposte corrette",earned:p.perfectGames>=1},
    {id:"speed",emoji:"⚡",name:"Pistola Fumante",description:"Partita perfetta in 90 secondi o meno",earned:p.fastestPerfectMs>0&&p.fastestPerfectMs<=90000},
    {id:"streak3",emoji:"🔥",name:"Fuoco di Fila",description:"Raggiungi una serie di 3 giorni",earned:p.bestStreak>=3},
    {id:"veteran10",emoji:"🐎",name:"Veterano",description:"Completa 10 sfide ufficiali",earned:p.games>=10},
    {id:"sheriff",emoji:"⭐",name:"Sceriffo",description:"Raggiungi il 1° posto giornaliero",earned:p.bestRank===1},
    {id:"weekend",emoji:"🔥",name:"Weekend Warrior",description:"Completa un Weekend Showdown ufficiale",earned:p.weekendGames>=1},
    {id:"legend",emoji:"🏆",name:"Leggenda",description:"Raggiungi il livello Legend",earned:level.key==="legend"}
  ];
}
function publicProfile(profile) {
  const p=normalizeProfile(profile), badges=buildBadges(p);
  return { nickname:p.nickname,games:p.games,dailyGames:p.dailyGames,weekendGames:p.weekendGames,totalScore:p.totalScore,dailyScore:p.dailyScore,weekendScore:p.weekendScore,totalCorrect:p.totalCorrect,totalQuestions:p.totalQuestions,
    avgAccuracy:p.totalQuestions>0?Math.round((p.totalCorrect/p.totalQuestions)*100):0, avgScore:p.games>0?Math.round(p.totalScore/p.games):0, avgDurationMs:p.games>0?Math.round(p.totalDurationMs/p.games):0,
    bestScore:p.bestScore,bestCorrect:p.bestCorrect,perfectGames:p.perfectGames,fastestPerfectMs:p.fastestPerfectMs,streak:p.streak,bestStreak:p.bestStreak,bestRank:p.bestRank||null,weekendBestRank:p.weekendBestRank||null,
    level:getLevel(p.totalScore),badges,earnedBadges:badges.filter(b=>b.earned).length,totalBadges:badges.length };
}

async function updateProfileAfterResult(session, durationMs, rank) {
  const previous=await getProfile(session.deviceHash), mode=session.mode==="weekend"?"weekend":"daily";
  const score=Number(session.score||0), correct=Number(session.correct||0), total=Number(session.questions?.length||0), perfect=total>0&&correct===total;
  let streak=previous.streak,lastDay=previous.lastDay;
  if(mode==="daily") { streak=previous.lastDay===shiftDayKey(session.dayKey,-1)?previous.streak+1:previous.lastDay===session.dayKey?Math.max(1,previous.streak):1; lastDay=session.dayKey; }
  const profile=normalizeProfile({ ...previous,nickname:session.nickname,streak,bestStreak:Math.max(previous.bestStreak,streak),lastDay,
    games:previous.games+1,dailyGames:previous.dailyGames+(mode==="daily"?1:0),weekendGames:previous.weekendGames+(mode==="weekend"?1:0),
    totalScore:previous.totalScore+score,dailyScore:previous.dailyScore+(mode==="daily"?score:0),weekendScore:previous.weekendScore+(mode==="weekend"?score:0),
    totalCorrect:previous.totalCorrect+correct,totalQuestions:previous.totalQuestions+total,totalDurationMs:previous.totalDurationMs+durationMs,bestScore:Math.max(previous.bestScore,score),bestCorrect:Math.max(previous.bestCorrect,correct),
    perfectGames:previous.perfectGames+(perfect?1:0),fastestPerfectMs:perfect?(previous.fastestPerfectMs>0?Math.min(previous.fastestPerfectMs,durationMs):durationMs):previous.fastestPerfectMs,
    bestRank:mode==="daily"&&rank?(previous.bestRank>0?Math.min(previous.bestRank,rank):rank):previous.bestRank,
    weekendBestRank:mode==="weekend"&&rank?(previous.weekendBestRank>0?Math.min(previous.weekendBestRank,rank):rank):previous.weekendBestRank,updatedAt:new Date().toISOString() });
  await writeProfile(session.deviceHash,profile); return profile;
}

async function recordDailyResult(session,durationMs){
  const hash=session.deviceHash,entry={nickname:session.nickname,score:Number(session.score||0),correct:Number(session.correct||0),durationMs,playedAt:new Date().toISOString()};
  await redisPipeline([["ZADD",dailyKey(session.dayKey),session.score,hash],["SET",dailyEntryKey(session.dayKey,hash),JSON.stringify(entry),"EX",DAILY_TTL_SECONDS],["EXPIRE",dailyKey(session.dayKey),DAILY_TTL_SECONDS],["ZINCRBY",weeklyKey(session.weekKey),session.score,hash],["HINCRBY",weeklyGamesKey(session.weekKey),hash,1],["EXPIRE",weeklyKey(session.weekKey),WEEKLY_TTL_SECONDS],["EXPIRE",weeklyGamesKey(session.weekKey),WEEKLY_TTL_SECONDS],["ZINCRBY",HALL_KEY,session.score,hash],["HINCRBY",HALL_GAMES_KEY,hash,1]]);
  const [rankRaw,participantsRaw]=await redisPipeline([["ZREVRANK",dailyKey(session.dayKey),hash],["ZCARD",dailyKey(session.dayKey)]]),rank=rankRaw==null?null:Number(rankRaw)+1;
  return {rank,participants:Number(participantsRaw||0),profile:await updateProfileAfterResult(session,durationMs,rank)};
}
async function recordWeekendResult(session,durationMs){
  const hash=session.deviceHash,entry={nickname:session.nickname,score:Number(session.score||0),correct:Number(session.correct||0),durationMs,playedAt:new Date().toISOString()};
  await redisPipeline([["ZADD",weekendKey(session.weekKey),session.score,hash],["SET",weekendEntryKey(session.weekKey,hash),JSON.stringify(entry),"EX",WEEKEND_TTL_SECONDS],["EXPIRE",weekendKey(session.weekKey),WEEKEND_TTL_SECONDS],["ZINCRBY",HALL_KEY,session.score,hash],["HINCRBY",HALL_GAMES_KEY,hash,1]]);
  const [rankRaw,participantsRaw]=await redisPipeline([["ZREVRANK",weekendKey(session.weekKey),hash],["ZCARD",weekendKey(session.weekKey)]]),rank=rankRaw==null?null:Number(rankRaw)+1;
  return {rank,participants:Number(participantsRaw||0),profile:await updateProfileAfterResult(session,durationMs,rank)};
}

export async function answerChallenge({sessionId,deviceId,questionIndex,answerIndex}){
  const cleanSessionId=String(sessionId||""),cleanDeviceId=normalizeDeviceId(deviceId);
  if(!/^[a-f0-9]{48}$/.test(cleanSessionId)||!cleanDeviceId){const e=new Error("Sessione non valida");e.code="BAD_SESSION";throw e;}
  const lockKey=answerLockKey(cleanSessionId),lock=await redisCommand(["SET",lockKey,"1","NX","EX",5]);
  if(lock!=="OK"){const e=new Error("Risposta già in elaborazione");e.code="ANSWER_BUSY";throw e;}
  try{
    const session=await readJson(sessionKey(cleanSessionId));
    if(!session||session.deviceHash!==deviceHash(cleanDeviceId)){const e=new Error("Sfida scaduta o non disponibile");e.code="SESSION_EXPIRED";throw e;}
    const expectedIndex=Number(session.currentIndex||0),requestedIndex=Number(questionIndex);
    if(!Number.isInteger(requestedIndex)||requestedIndex!==expectedIndex){const e=new Error("Domanda non valida");e.code="QUESTION_MISMATCH";throw e;}
    const question=session.questions[expectedIndex];if(!question){const e=new Error("Sfida già conclusa");e.code="ALREADY_FINISHED";throw e;}
    const seconds=Number(session.questionSeconds||DAILY_QUESTION_SECONDS),elapsedMs=Math.max(0,Date.now()-Number(session.questionStartedAt||Date.now())),timedOut=elapsedMs>seconds*1000+QUESTION_GRACE_MS;
    const requestedAnswer=answerIndex==null?-1:Number.isInteger(Number(answerIndex))?Number(answerIndex):-1,validAnswer=requestedAnswer>=0&&requestedAnswer<question.options.length?requestedAnswer:-1;
    const correct=!timedOut&&validAnswer===question.correctIndex,speedElapsed=Math.max(2000,Math.min(seconds*1000,elapsedMs)),speedRatio=Math.max(0,1-speedElapsed/(seconds*1000)),points=correct?1000+(session.mode==="weekend"?50:0)+Math.round(200*speedRatio):0;
    session.score=Number(session.score||0)+points;session.correct=Number(session.correct||0)+(correct?1:0);session.currentIndex=expectedIndex+1;session.questionStartedAt=Date.now();
    const response={ok:true,correct,timedOut,correctAnswer:question.options[question.correctIndex],points,score:session.score,correctCount:session.correct,currentIndex:session.currentIndex,finished:session.currentIndex>=session.questions.length};
    if(!response.finished){await writeSession(session);return response;}
    const totalDurationMs=Math.max(0,Date.now()-Number(session.startedAt||Date.now()));let official=false,result={rank:null,participants:null,profile:await getProfile(session.deviceHash)};
    if(session.official){const weekend=session.mode==="weekend",aKey=weekend?weekendAttemptKey(session.weekKey,session.deviceHash):attemptKey(session.dayKey,session.deviceHash),ttl=weekend?WEEKEND_ATTEMPT_TTL_SECONDS:DAILY_ATTEMPT_TTL_SECONDS,attemptValue=String(await redisCommand(["GET",aKey])||"");
      if(attemptValue===session.id){result=weekend?await recordWeekendResult(session,totalDurationMs):await recordDailyResult(session,totalDurationMs);official=true;await redisCommand(["SET",aKey,"done","EX",ttl]);}}
    await redisCommand(["DEL",sessionKey(session.id)]).catch(()=>{});const profile=publicProfile(result.profile||await getProfile(session.deviceHash));
    return {...response,official,training:!official,mode:session.mode||"daily",modeLabel:session.modeLabel||"🤠 Sfida del giorno",result:{score:session.score,correct:session.correct,total:session.questions.length,durationMs:totalDurationMs,rank:result.rank,participants:result.participants,streak:profile.streak,bestStreak:profile.bestStreak,profile}};
  }finally{await redisCommand(["DEL",lockKey]).catch(()=>{});}
}

function parseZSetRows(raw){if(!Array.isArray(raw))return[];const rows=[];for(let i=0;i<raw.length;i+=2)if(raw[i]!=null)rows.push({member:String(raw[i]),score:Number(raw[i+1]||0)});return rows;}
async function getProfiles(hashes){if(!hashes.length)return new Map();const values=await redisPipeline(hashes.map(hash=>["GET",profileKey(hash)])),map=new Map();hashes.forEach((hash,index)=>{try{const p=values[index]?JSON.parse(values[index]):null;if(p)map.set(hash,normalizeProfile(p));}catch{}});return map;}

export async function getChallengeLeaderboard(period="today",limit=50){
  const dayKey=getRomeDayKey(),weekKey=getIsoWeekKey(dayKey),safeLimit=Math.max(1,Math.min(100,Number(limit)||50)),mode=["today","week","weekend","hall"].includes(period)?period:"today";
  const key=mode==="today"?dailyKey(dayKey):mode==="week"?weeklyKey(weekKey):mode==="weekend"?weekendKey(weekKey):HALL_KEY,baseRows=parseZSetRows(await redisCommand(["ZREVRANGE",key,0,safeLimit-1,"WITHSCORES"])),profiles=await getProfiles(baseRows.map(r=>r.member));
  let entries=new Map();if((mode==="today"||mode==="weekend")&&baseRows.length){const values=await redisPipeline(baseRows.map(r=>["GET",mode==="today"?dailyEntryKey(dayKey,r.member):weekendEntryKey(weekKey,r.member)]));entries=new Map(baseRows.map((r,i)=>{try{return[r.member,values[i]?JSON.parse(values[i]):null]}catch{return[r.member,null]}}));}
  let games=new Map();if((mode==="week"||mode==="hall")&&baseRows.length){const gKey=mode==="week"?weeklyGamesKey(weekKey):HALL_GAMES_KEY,values=await redisPipeline(baseRows.map(r=>["HGET",gKey,r.member]));games=new Map(baseRows.map((r,i)=>[r.member,Number(values[i]||0)]));}
  const rows=baseRows.map((row,index)=>{const profile=profiles.get(row.member)||blankProfile(),entry=entries.get(row.member)||{},level=getLevel(profile.totalScore);return{rank:index+1,nickname:String(entry.nickname||profile.nickname||"Cowboy"),score:Math.round(row.score),correct:(mode==="today"||mode==="weekend")?Number(entry.correct||0):undefined,durationMs:(mode==="today"||mode==="weekend")?Number(entry.durationMs||0):undefined,games:(mode==="week"||mode==="hall")?Number(games.get(row.member)||0):undefined,streak:Number(profile.streak||0),level:{key:level.key,label:level.label,emoji:level.emoji}}});
  const participants=Number(await redisCommand(["ZCARD",key])||0),todayParticipants=mode==="today"?participants:Number(await redisCommand(["ZCARD",dailyKey(dayKey)])||0);
  return{period:mode,dayKey,weekKey,participants,todayParticipants,weekendActive:isWeekendDay(dayKey),sheriff:mode==="today"?(rows[0]||null):null,rows};
}

export async function getChallengeProfile(deviceId){const clean=normalizeDeviceId(deviceId);if(!clean)return null;return publicProfile(await getProfile(deviceHash(clean)));}
export function getChallengeConfig(){const dayKey=getRomeDayKey();return{daily:{questionCount:DAILY_QUESTION_COUNT,questionSeconds:DAILY_QUESTION_SECONDS},weekend:{active:isWeekendDay(dayKey),questionCount:WEEKEND_QUESTION_COUNT,questionSeconds:WEEKEND_QUESTION_SECONDS,label:"Weekend Showdown"},levels:LEVELS.map(level=>({...level}))};}
