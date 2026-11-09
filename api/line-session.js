import {
  loginLine,inspectLineSession,logoutLine,limitLineLogin,
  normalizeLineUsername,validLineUsername
} from "../lib/line-access.js";

export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
  if (req.method!=="POST") {
    res.setHeader("Allow","POST");
    return res.status(405).json({ok:false,error:"Metodo non consentito"});
  }
  const body=req.body && typeof req.body==="object" && !Array.isArray(req.body) ? req.body : {};
  const action=String(body.action||"");
  try {
    if (action==="login") {
      const username=normalizeLineUsername(body.username);
      if (!validLineUsername(username)) {
        return res.status(400).json({ok:false,error:"Inserisci uno username di 2-30 caratteri (lettere, numeri, spazi, punto, trattino o underscore)."});
      }
      const ip=String(req.headers?.["x-forwarded-for"]||req.headers?.["x-real-ip"]||"unknown").split(",")[0].trim();
      if (!await limitLineLogin(ip,username)) {
        return res.status(429).json({ok:false,error:"Troppi accessi ravvicinati. Riprova tra 15 minuti."});
      }
      const session=await loginLine(res,username,body.deviceId);
      return res.status(200).json({ok:true,authenticated:true,...session});
    }
    if (action==="verify") {
      const result=await inspectLineSession(req,body.deviceId);
      if (!result.session) {
        const code=result.reason==="REPLACED" ? "SESSION_REPLACED" :
          result.reason==="REVOKED" ? "SESSION_REVOKED" : "SESSION_EXPIRED";
        return res.status(401).json({ok:false,authenticated:false,code,
          error:code==="SESSION_REPLACED"
            ? "Un altro dispositivo ha effettuato l'accesso con lo stesso username."
            : "Sessione non attiva. Inserisci nuovamente lo username."});
      }
      return res.status(200).json({ok:true,authenticated:true,...result.session});
    }
    if (action==="logout") {
      await logoutLine(req,res);
      return res.status(200).json({ok:true,authenticated:false});
    }
    return res.status(400).json({ok:false,error:"Azione non valida"});
  } catch(error) {
    if (error.code==="BAD_USER"||error.code==="BAD_DEVICE") {
      return res.status(400).json({ok:false,error:error.message});
    }
    console.error("LINE access error",error);
    return res.status(503).json({ok:false,error:"Servizio di accesso Line Dance momentaneamente non disponibile."});
  }
}