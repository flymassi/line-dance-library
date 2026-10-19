import {
  answerChallenge,
  challengeConfig,
  checkChallengeStartRateLimit,
  getChallengeLeaderboard,
  startChallenge
} from "../lib/challenge-store.js";

function getClientIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function statusFor(error) {
  switch (error?.code) {
    case "BAD_INPUT":
    case "BAD_SESSION":
    case "QUESTION_MISMATCH": return 400;
    case "ANSWER_BUSY": return 409;
    case "SESSION_EXPIRED": return 410;
    case "ALREADY_FINISHED": return 409;
    default: return 500;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method === "GET") {
      const period = String(req.query?.period || "today");
      const leaderboard = await getChallengeLeaderboard(period, 50);
      return res.status(200).json({ ok: true, config: challengeConfig, ...leaderboard });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Metodo non consentito" });
    }

    const body = parseBody(req);
    const action = String(body?.action || "");

    if (action === "start") {
      const allowed = await checkChallengeStartRateLimit(getClientIp(req));
      if (!allowed) return res.status(429).json({ ok: false, error: "Troppe richieste. Riprova tra qualche minuto." });
      const session = await startChallenge({ nickname: body.nickname, deviceId: body.deviceId });
      return res.status(200).json({ ok: true, ...session });
    }

    if (action === "answer") {
      const result = await answerChallenge({
        sessionId: body.sessionId,
        deviceId: body.deviceId,
        questionIndex: body.questionIndex,
        answerIndex: body.answerIndex
      });
      return res.status(200).json(result);
    }

    return res.status(400).json({ ok: false, error: "Azione non valida" });
  } catch (error) {
    console.error("[WS Challenge]", error);
    const status = statusFor(error);
    const message = status >= 500
      ? "Sfida temporaneamente non disponibile. Riprova tra poco."
      : error?.message || "Operazione non riuscita";
    return res.status(status).json({ ok: false, error: message });
  }
}
