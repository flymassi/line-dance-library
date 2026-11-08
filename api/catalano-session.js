import {
  verifyCatalanoSession, logoutCatalanoSession, clearAuthCookie
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
    const session = await verifyCatalanoSession(req,body.deviceId);
    if (!session) {
      clearAuthCookie(res);
      return res.status(401).json({ok:false,authenticated:false,error:"Sessione scaduta o dispositivo non autorizzato."});
    }
    return res.status(200).json({ok:true,authenticated:true,...session});
  } catch(error) {
    console.error("CATALANO session verification failed",error);
    return res.status(503).json({ok:false,authenticated:false,error:"Impossibile verificare la sessione."});
  }
}
