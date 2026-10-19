import crypto from "crypto";
import fs from "fs";
import { redisCommand, redisPipeline } from "./catalano-store.js";

const TIME_ZONE = "Europe/Rome";
const QUESTION_COUNT = 10;
const QUESTION_SECONDS = 15;
const QUESTION_GRACE_MS = 2000;
const SESSION_TTL_SECONDS = 6 * 60 * 60;
const ATTEMPT_TTL_SECONDS = 36 * 60 * 60;
const DAILY_TTL_SECONDS = 60 * 24 * 60 * 60;
const WEEKLY_TTL_SECONDS = 28 * 24 * 60 * 60;
const PROFILE_TTL_SECONDS = 400 * 24 * 60 * 60;
const START_RATE_PREFIX = "ws:challenge:rate:";
const SESSION_PREFIX = "ws:challenge:session:";
const ATTEMPT_PREFIX = "ws:challenge:attempt:";
const DAILY_PREFIX = "ws:challenge:daily:";
const DAILY_ENTRY_PREFIX = "ws:challenge:entry:";
const WEEKLY_PREFIX = "ws:challenge:weekly:";
const WEEKLY_GAMES_PREFIX = "ws:challenge:weekly-games:";
const HALL_KEY = "ws:challenge:hall";
const HALL_GAMES_KEY = "ws:challenge:hall-games";
const PROFILE_PREFIX = "ws:challenge:profile:";
const ANSWER_LOCK_PREFIX = "ws:challenge:answer-lock:";

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

  if (songCache.length < 20) throw new Error("Brani insufficienti per la sfida");
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
  const distractors = shuffle(
    uniqueValues(pool).filter(value => String(value).toLocaleLowerCase("it") !== String(correctValue).toLocaleLowerCase("it")),
    random
  ).slice(0, 3);
  const options = shuffle([correctValue, ...distractors], random);
  if (options.length !== 4) throw new Error("Opzioni insufficienti per la sfida");
  return { options, correctIndex: options.indexOf(correctValue) };
}

export function getRomeDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
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

export function buildDailyQuestions(dayKey = getRomeDayKey()) {
  const songs = loadSongs();
  const random = seededRandom(`western-spritz-challenge:${dayKey}:v1`);
  const selected = shuffle(songs, random).slice(0, QUESTION_COUNT);
  const songTitles = songs.map(song => song.songTitle);
  const danceTitles = songs.map(song => song.danceTitle);
  const singers = songs.map(song => song.singerName);
  const types = shuffle([
    "song-for-dance",
    "artist-for-song",
    "dance-for-song",
    "year-for-dance",
    "song-for-dance",
    "artist-for-song",
    "dance-for-song",
    "year-for-dance",
    "song-for-dance",
    "artist-for-song"
  ], random);

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
    } else {
      prompt = `A quale anno del corso appartiene “${song.danceTitle}”?`;
      options = shuffle(["1° ANNO", "2° ANNO", "3° ANNO", "4° ANNO"], random);
      correctIndex = options.indexOf(`${song.year}° ANNO`);
    }

    return {
      id: `${dayKey}:${index + 1}:${song.songNumber}:${type}`,
      prompt,
      options,
      correctIndex
    };
  });
}

function sessionKey(id) { return `${SESSION_PREFIX}${id}`; }
function attemptKey(dayKey, hash) { return `${ATTEMPT_PREFIX}${dayKey}:${hash}`; }
function dailyKey(dayKey) { return `${DAILY_PREFIX}${dayKey}`; }
function dailyEntryKey(dayKey, hash) { return `${DAILY_ENTRY_PREFIX}${dayKey}:${hash}`; }
function weeklyKey(weekKey) { return `${WEEKLY_PREFIX}${weekKey}`; }
function weeklyGamesKey(weekKey) { return `${WEEKLY_GAMES_PREFIX}${weekKey}`; }
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
  const [count] = await redisPipeline([
    ["INCR", key],
    ["EXPIRE", key, 3600, "NX"]
  ]);
  return Number(count || 0) <= 60;
}

function publicSessionPayload(session, resumed = false) {
  const elapsed = Math.max(0, Date.now() - Number(session.questionStartedAt || session.startedAt || Date.now()));
  const remainingMs = Math.max(0, QUESTION_SECONDS * 1000 - elapsed);
  return {
    sessionId: session.id,
    official: !!session.official,
    training: !session.official,
    resumed,
    dayKey: session.dayKey,
    currentIndex: Number(session.currentIndex || 0),
    score: Number(session.score || 0),
    correct: Number(session.correct || 0),
    questionCount: session.questions.length,
    secondsPerQuestion: QUESTION_SECONDS,
    remainingMs,
    questions: session.questions.map(({ id, prompt, options }) => ({ id, prompt, options }))
  };
}

export async function startChallenge({ nickname, deviceId }) {
  const cleanNickname = sanitizeNickname(nickname);
  const cleanDeviceId = normalizeDeviceId(deviceId);
  if (!cleanNickname || !cleanDeviceId) {
    const err = new Error("Nickname o dispositivo non validi");
    err.code = "BAD_INPUT";
    throw err;
  }

  const dayKey = getRomeDayKey();
  const hash = deviceHash(cleanDeviceId);
  const aKey = attemptKey(dayKey, hash);
  const existingAttempt = String(await redisCommand(["GET", aKey]) || "");

  if (existingAttempt && existingAttempt !== "done") {
    const existingSession = await readJson(sessionKey(existingAttempt));
    if (existingSession && existingSession.deviceHash === hash && existingSession.official) {
      existingSession.nickname = cleanNickname;
      await writeSession(existingSession);
      return publicSessionPayload(existingSession, true);
    }
  }

  const questions = buildDailyQuestions(dayKey);
  const id = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const session = {
    id,
    dayKey,
    weekKey: getIsoWeekKey(dayKey),
    deviceHash: hash,
    nickname: cleanNickname,
    official: false,
    startedAt: now,
    questionStartedAt: now,
    currentIndex: 0,
    score: 0,
    correct: 0,
    questions
  };

  if (!existingAttempt) {
    const claim = await redisCommand(["SET", aKey, id, "NX", "EX", ATTEMPT_TTL_SECONDS]);
    session.official = claim === "OK";
  }

  await writeSession(session);
  return publicSessionPayload(session, false);
}

async function getProfile(hash) {
  return (await readJson(profileKey(hash))) || null;
}

async function writeProfile(hash, profile) {
  await redisCommand(["SET", profileKey(hash), JSON.stringify(profile), "EX", PROFILE_TTL_SECONDS]);
}

async function recordOfficialResult(session, durationMs) {
  const hash = session.deviceHash;
  const dayKey = session.dayKey;
  const weekKey = session.weekKey;
  const entry = {
    nickname: session.nickname,
    score: Number(session.score || 0),
    correct: Number(session.correct || 0),
    durationMs,
    playedAt: new Date().toISOString()
  };

  const previousProfile = (await getProfile(hash)) || {};
  const previousLastDay = String(previousProfile.lastDay || "");
  const streak = previousLastDay === shiftDayKey(dayKey, -1)
    ? Number(previousProfile.streak || 0) + 1
    : previousLastDay === dayKey
      ? Number(previousProfile.streak || 1)
      : 1;
  const profile = {
    nickname: session.nickname,
    streak,
    bestStreak: Math.max(Number(previousProfile.bestStreak || 0), streak),
    lastDay: dayKey,
    games: Number(previousProfile.games || 0) + (previousLastDay === dayKey ? 0 : 1),
    updatedAt: new Date().toISOString()
  };

  await redisPipeline([
    ["ZADD", dailyKey(dayKey), session.score, hash],
    ["SET", dailyEntryKey(dayKey, hash), JSON.stringify(entry), "EX", DAILY_TTL_SECONDS],
    ["EXPIRE", dailyKey(dayKey), DAILY_TTL_SECONDS],
    ["ZINCRBY", weeklyKey(weekKey), session.score, hash],
    ["HINCRBY", weeklyGamesKey(weekKey), hash, 1],
    ["EXPIRE", weeklyKey(weekKey), WEEKLY_TTL_SECONDS],
    ["EXPIRE", weeklyGamesKey(weekKey), WEEKLY_TTL_SECONDS],
    ["ZINCRBY", HALL_KEY, session.score, hash],
    ["HINCRBY", HALL_GAMES_KEY, hash, 1]
  ]);
  await writeProfile(hash, profile);

  const [rank, participants] = await redisPipeline([
    ["ZREVRANK", dailyKey(dayKey), hash],
    ["ZCARD", dailyKey(dayKey)]
  ]);

  return {
    entry,
    streak: profile.streak,
    bestStreak: profile.bestStreak,
    rank: rank == null ? null : Number(rank) + 1,
    participants: Number(participants || 0)
  };
}

export async function answerChallenge({ sessionId, deviceId, questionIndex, answerIndex }) {
  const cleanSessionId = String(sessionId || "");
  const cleanDeviceId = normalizeDeviceId(deviceId);
  if (!/^[a-f0-9]{48}$/.test(cleanSessionId) || !cleanDeviceId) {
    const err = new Error("Sessione non valida");
    err.code = "BAD_SESSION";
    throw err;
  }

  const lockKey = answerLockKey(cleanSessionId);
  const lock = await redisCommand(["SET", lockKey, "1", "NX", "EX", 5]);
  if (lock !== "OK") {
    const err = new Error("Risposta già in elaborazione");
    err.code = "ANSWER_BUSY";
    throw err;
  }

  try {
    const session = await readJson(sessionKey(cleanSessionId));
    if (!session || session.deviceHash !== deviceHash(cleanDeviceId)) {
      const err = new Error("Sfida scaduta o non disponibile");
      err.code = "SESSION_EXPIRED";
      throw err;
    }

    const expectedIndex = Number(session.currentIndex || 0);
    const requestedIndex = Number(questionIndex);
    if (!Number.isInteger(requestedIndex) || requestedIndex !== expectedIndex) {
      const err = new Error("Domanda non valida");
      err.code = "QUESTION_MISMATCH";
      throw err;
    }

    const question = session.questions[expectedIndex];
    if (!question) {
      const err = new Error("Sfida già conclusa");
      err.code = "ALREADY_FINISHED";
      throw err;
    }

    const elapsedMs = Math.max(0, Date.now() - Number(session.questionStartedAt || Date.now()));
    const timedOut = elapsedMs > QUESTION_SECONDS * 1000 + QUESTION_GRACE_MS;
    const requestedAnswer = answerIndex == null
      ? -1
      : Number.isInteger(Number(answerIndex)) ? Number(answerIndex) : -1;
    const validAnswer = requestedAnswer >= 0 && requestedAnswer < question.options.length ? requestedAnswer : -1;
    const correct = !timedOut && validAnswer === question.correctIndex;
    const speedElapsed = Math.max(2000, Math.min(QUESTION_SECONDS * 1000, elapsedMs));
    const speedRatio = Math.max(0, 1 - speedElapsed / (QUESTION_SECONDS * 1000));
    const points = correct ? 1000 + Math.round(200 * speedRatio) : 0;

    session.score = Number(session.score || 0) + points;
    session.correct = Number(session.correct || 0) + (correct ? 1 : 0);
    session.currentIndex = expectedIndex + 1;
    session.questionStartedAt = Date.now();

    const response = {
      ok: true,
      correct,
      timedOut,
      correctAnswer: question.options[question.correctIndex],
      points,
      score: session.score,
      correctCount: session.correct,
      currentIndex: session.currentIndex,
      finished: session.currentIndex >= session.questions.length
    };

    if (!response.finished) {
      await writeSession(session);
      return response;
    }

    const totalDurationMs = Math.max(0, Date.now() - Number(session.startedAt || Date.now()));
    let official = false;
    let result = {
      rank: null,
      participants: null,
      streak: 0,
      bestStreak: 0
    };

    if (session.official) {
      const aKey = attemptKey(session.dayKey, session.deviceHash);
      const attemptValue = String(await redisCommand(["GET", aKey]) || "");
      if (attemptValue === session.id) {
        result = await recordOfficialResult(session, totalDurationMs);
        official = true;
        await redisCommand(["SET", aKey, "done", "EX", ATTEMPT_TTL_SECONDS]);
      }
    }

    await redisCommand(["DEL", sessionKey(session.id)]).catch(() => {});
    return {
      ...response,
      official,
      training: !official,
      result: {
        score: session.score,
        correct: session.correct,
        total: session.questions.length,
        durationMs: totalDurationMs,
        rank: result.rank,
        participants: result.participants,
        streak: result.streak,
        bestStreak: result.bestStreak
      }
    };
  } finally {
    await redisCommand(["DEL", lockKey]).catch(() => {});
  }
}

function parseZSetRows(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (let i = 0; i < raw.length; i += 2) {
    if (raw[i] == null) continue;
    rows.push({ member: String(raw[i]), score: Number(raw[i + 1] || 0) });
  }
  return rows;
}

async function getProfiles(hashes) {
  if (!hashes.length) return new Map();
  const values = await redisPipeline(hashes.map(hash => ["GET", profileKey(hash)]));
  const map = new Map();
  hashes.forEach((hash, index) => {
    try {
      const profile = values[index] ? JSON.parse(values[index]) : null;
      if (profile) map.set(hash, profile);
    } catch {}
  });
  return map;
}

export async function getChallengeLeaderboard(period = "today", limit = 50) {
  const dayKey = getRomeDayKey();
  const weekKey = getIsoWeekKey(dayKey);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const mode = ["today", "week", "hall"].includes(period) ? period : "today";
  const key = mode === "today" ? dailyKey(dayKey) : mode === "week" ? weeklyKey(weekKey) : HALL_KEY;
  const raw = await redisCommand(["ZREVRANGE", key, 0, safeLimit - 1, "WITHSCORES"]);
  const baseRows = parseZSetRows(raw);
  const profiles = await getProfiles(baseRows.map(row => row.member));

  let dailyEntries = new Map();
  if (mode === "today" && baseRows.length) {
    const values = await redisPipeline(baseRows.map(row => ["GET", dailyEntryKey(dayKey, row.member)]));
    dailyEntries = new Map(baseRows.map((row, index) => {
      try { return [row.member, values[index] ? JSON.parse(values[index]) : null]; }
      catch { return [row.member, null]; }
    }));
  }

  let games = new Map();
  if (mode !== "today" && baseRows.length) {
    const gamesKey = mode === "week" ? weeklyGamesKey(weekKey) : HALL_GAMES_KEY;
    const values = await redisPipeline(baseRows.map(row => ["HGET", gamesKey, row.member]));
    games = new Map(baseRows.map((row, index) => [row.member, Number(values[index] || 0)]));
  }

  const rows = baseRows.map((row, index) => {
    const profile = profiles.get(row.member) || {};
    const daily = dailyEntries.get(row.member) || {};
    return {
      rank: index + 1,
      nickname: String(daily.nickname || profile.nickname || "Cowboy"),
      score: Math.round(row.score),
      correct: mode === "today" ? Number(daily.correct || 0) : undefined,
      durationMs: mode === "today" ? Number(daily.durationMs || 0) : undefined,
      games: mode === "today" ? undefined : Number(games.get(row.member) || 0),
      streak: Number(profile.streak || 0)
    };
  });

  const participants = Number(await redisCommand(["ZCARD", dailyKey(dayKey)]) || 0);
  const sheriff = mode === "today" && rows[0] ? rows[0] : null;
  return { mode, dayKey, weekKey, participants, sheriff, rows };
}

export const challengeConfig = {
  questionCount: QUESTION_COUNT,
  questionSeconds: QUESTION_SECONDS
};
