import {answerDuel,createDuel,getDuelArena,joinDuel,rateDuelRequest,readDuel,startDuel} from "../lib/duel-store.js";

function clientIp(req) {
  const forwarded=req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}
function statusFor(code) {
  if (["BAD_INPUT","BAD_STATE","QUESTION_MISMATCH","NOT_JOINED"].includes(code)) return 400;
  if (["FULL","BUSY"].includes(code)) return 409;
  if (["NOT_FOUND","FINISHED"].includes(code)) return 410;
  return 503;
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
  res.setHeader("Pragma","no-cache");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"Metodo non consentito"});
  }
  try {
    if (req.method === "GET") {
      if (req.query?.action === "arena") return res.status(200).json(await getDuelArena());
      return res.status(200).json(await readDuel({id:req.query?.id,deviceId:req.query?.deviceId}));
    }
    const body=req.body && typeof req.body==="object" && !Array.isArray(req.body) ? req.body : {};
    const action=String(body.action || "");
    if (["create","join"].includes(action)) {
      if (!await rateDuelRequest(clientIp(req),action)) return res.status(429).json({ok:false,error:"Troppe richieste, riprova più tardi."});
    }
    if (action==="create") return res.status(200).json(await createDuel(body));
    if (action==="join") return res.status(200).json(await joinDuel(body));
    if (action==="start") return res.status(200).json(await startDuel(body));
    if (action==="answer") return res.status(200).json(await answerDuel(body));
    return res.status(400).json({ok:false,error:"Operazione non riconosciuta"});
  } catch(error) {
    if (!error.code) console.error("[WS Duel]",error);
    return res.status(statusFor(error.code)).json({ok:false,error:error.code?error.message:"Duello temporaneamente non disponibile"});
  }
}
