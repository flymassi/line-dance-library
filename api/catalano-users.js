import crypto from "node:crypto";
import {
  deleteStoredUser, listStoredUsers, normalizeUsername, getStoredUser
} from "../lib/catalano-store.js";
import {
  verifyCatalanoSession, getCatalanoAccessOverview,
  isAdminUsername, revokeCatalanoAccess
} from "../lib/catalano-access.js";

function timingSafeEqual(a,b) {
  const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function validAdmin(username,password) {
  const required=normalizeUsername(process.env.CATALANO_ADMIN_USER || "max");
  if (normalizeUsername(username)!==required) return false;
  try {
    const users=JSON.parse(process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]");
    return Array.isArray(users) && users.some(u=>
      normalizeUsername(u?.user)===required && timingSafeEqual(u?.pass,password)
    );
  } catch { return false; }
}
function legacyUsers() {
  try {
    const users=JSON.parse(process.env.CATALANO_USERS || process.env.SAGGIO_USERS || "[]");
    return Array.isArray(users) ? users.flatMap(u=>{
      const name=normalizeUsername(u?.user);
      return name ? [{user:name,name:String(u?.user||name),email:"",approvedAt:"",source:"legacy"}] : [];
    }) : [];
  } catch { return []; }
}
async function allUsers() {
  const stored=await listStoredUsers();
  const map=new Map();
  for (const user of legacyUsers()) map.set(normalizeUsername(user.user),user);
  for (const user of stored) map.set(normalizeUsername(user.user),{...user,source:"registered"});
  return Array.from(map.values())
    .sort((a,b)=>String(a.user).localeCompare(String(b.user),"it",{sensitivity:"base"}));
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method!=="POST") return res.status(405).json({ok:false,error:"Metodo non consentito"});
  const body=req.body && typeof req.body==="object" && !Array.isArray(req.body) ? req.body : {};
  const action=String(body.action||"").trim().toLowerCase();
  const username=String(body.adminUser||"").trim();
  const password=String(body.adminPassword||"");
  try {
    const session=await verifyCatalanoSession(req,body.deviceId);
    if (!session?.admin || !validAdmin(username,password) || normalizeUsername(session.user)!==normalizeUsername(username)) {
      return res.status(401).json({ok:false,error:"Sessione o credenziali amministratore non valide"});
    }
    if (action==="list") {
      const users=await allUsers();
      const results=await Promise.all(users.map(async user=>({
        ...user,
        access:await getCatalanoAccessOverview(user.user)
      })));
      return res.status(200).json({ok:true,users:results});
    }
    const target=normalizeUsername(body.username);
    if (!target) return res.status(400).json({ok:false,error:"Username mancante"});
    if (isAdminUsername(target)) return res.status(403).json({ok:false,error:"L'amministratore non può essere modificato da questo pannello"});
    const users=await allUsers();
    const targetUser=users.find(u=>normalizeUsername(u.user)===target);
    if (!targetUser) return res.status(404).json({ok:false,error:"Utente non trovato"});
    if (action==="resetdevice") {
      await revokeCatalanoAccess(target,{releaseDevice:true});
      return res.status(200).json({ok:true,reset:true,username:target});
    }
    if (action==="delete") {
      if (targetUser.source!=="registered") {
        return res.status(400).json({ok:false,error:"Per eliminare un utente storico modifica le impostazioni Vercel; puoi comunque sbloccarne il dispositivo."});
      }
      const deleted=await deleteStoredUser(target);
      if (!deleted) return res.status(404).json({ok:false,error:"Utente non trovato"});
      await revokeCatalanoAccess(target,{releaseDevice:true});
      return res.status(200).json({ok:true,deleted:true,username:target});
    }
    return res.status(400).json({ok:false,error:"Azione non valida"});
  } catch(error) {
    console.error("CATALANO users admin",error);
    return res.status(503).json({ok:false,error:"Gestione utenti temporaneamente non disponibile"});
  }
}
