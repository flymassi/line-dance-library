import {
  inspectCatalanoSession, logoutCatalanoSession, clearAuthCookie
} from "../lib/catalano-access.js";

export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
  if (req.method !== "POST") {
    res.setHeader("Allow","POST");
    return res.status(405).json({ok:false,error:"Metodo non consentito"});
  }
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  if (body.action === "logout") {
    try { await logoutCatalanoSession(req,res); }
    catch (error) {
      console.error("CATALANO session logout",error);
      clearAuthCookie(res);
    }
    return res.status(200).json({ok:true,authenticated:false});
  }
  if (body.action !== "verify") return res.status(400).json({ok:false,error:"Azione non valida"});
  try {
    const result = await inspectCatalanoSession(req,body.deviceId);
    if (!result.session) {
      clearAuthCookie(res);
      const replaced = result.reason === "REPLACED";
      return res.status(401).json({
        ok:false,
        authenticated:false,
        code:replaced ? "SESSION_REPLACED" : "SESSION_INVALID",
        error:replaced
          ? "La tua sessione Catalano è stata disconnessa perché è stato effettuato un nuovo accesso con le stesse credenziali."
          : "Sessione scaduta o non autorizzata."
      });
    }
    return res.status(200).json({ok:true,authenticated:true,...result.session});
  } catch(error) {
    console.error("CATALANO session verification failed",error);
    return res.status(503).json({ok:false,authenticated:false,error:"Impossibile verificare la sessione."});
  }
}
