import {
  createOpenChallenge, joinOpenChallenge, readOpenChallenge, startOpenChallenge,
  answerOpenChallenge, rateOpenChallenge
} from "../lib/open-challenge-store.js";

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}
function statusFor(code) {
  if (["BAD_INPUT", "BAD_STATE", "QUESTION_MISMATCH", "NOT_JOINED"].includes(code)) return 400;
  if (code === "BUSY") return 409;
  if (["NOT_FOUND", "CLOSED", "FINISHED"].includes(code)) return 410;
  return 503;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ok:false,error:"Metodo non consentito"});
  }
  try {
    if (req.method === "GET") {
      return res.status(200).json(await readOpenChallenge({
        id:req.query?.id, deviceId:req.query?.deviceId
      }));
    }
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const action = String(body.action || "");
    if (["create", "join"].includes(action)) {
      if (!await rateOpenChallenge(clientIp(req), action)) {
        return res.status(429).json({ok:false,error:"Troppe richieste, riprova tra poco."});
      }
    }
    if (action === "create") return res.status(200).json(await createOpenChallenge(body));
    if (action === "join") return res.status(200).json(await joinOpenChallenge(body));
    if (action === "start") return res.status(200).json(await startOpenChallenge(body));
    if (action === "answer") return res.status(200).json(await answerOpenChallenge(body));
    return res.status(400).json({ok:false,error:"Operazione non riconosciuta"});
  } catch (error) {
    if (!error.code) console.error("[WS Open Challenge]", error);
    return res.status(statusFor(error.code)).json({
      ok:false, error:error.code ? error.message : "Sfida Aperta temporaneamente non disponibile"
    });
  }
}
