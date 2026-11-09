import crypto from "node:crypto";
import {normalizeUsername} from "../lib/catalano-store.js";
import {verifyCatalanoSession} from "../lib/catalano-access.js";
import {lineAdminOverview,revokeLineUser,normalizeLineUsername,validLineUsername} from "../lib/line-access.js";

function equal(a,b) {
  const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function validAdmin(username,password) {
  const required=normalizeUsername(process.env.CATALANO_ADMIN_USER||"max");
  if (normalizeUsername(username)!==required||!password) return false;
  try {
    const configured=JSON.parse(process.env.CATALANO_USERS||process.env.SAGGIO_USERS||"[]");
    return Array.isArray(configured)&&configured.some(item=>
      normalizeUsername(item?.user)===required&&equal(item?.pass,password)
    );
  } catch {return false;}
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Metodo non consentito"});
  const body=req.body && typeof req.body==="object" && !Array.isArray(req.body)?req.body:{};
  const action=String(body.action||"").trim().toLowerCase();
  try {
    // Username alone NEVER gives administrative privileges.
    // Require the existing server-verified Catalano administrator session
    // AND a fresh check against the configured admin password.
    const session=await verifyCatalanoSession(req,body.deviceId);
    if(!session?.admin||normalizeUsername(session.user)!==normalizeUsername(body.adminUser)||
       !validAdmin(body.adminUser,String(body.adminPassword||""))) {
      return res.status(401).json({ok:false,error:"Autorizzazione amministratore non valida"});
    }
    if(action==="list") {
      return res.status(200).json({ok:true,...await lineAdminOverview()});
    }
    if(action==="revoke") {
      const target=normalizeLineUsername(body.username);
      if(!validLineUsername(target)) return res.status(400).json({ok:false,error:"Username non valido"});
      const revoked=await revokeLineUser(target);
      return res.status(200).json({ok:true,revoked,username:target});
    }
    return res.status(400).json({ok:false,error:"Azione non valida"});
  } catch(error) {
    console.error("LINE admin error",error);
    return res.status(503).json({ok:false,error:"Statistiche Line Dance temporaneamente non disponibili"});
  }
}