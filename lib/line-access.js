import crypto from "node:crypto";
import {redisCommand, redisPipeline, normalizeUsername} from "./catalano-store.js";

const PREFIX = "ws:line:access:v1:";
const SESSION_SECONDS = 8 * 60 * 60;
const HISTORY_SECONDS = 45 * 24 * 60 * 60;
const COOKIE = "ws_line_auth";
const usersKey = PREFIX + "users";
const activeKey = name => PREFIX + "active:" + name;
const profileKey = name => PREFIX + "profile:" + name;
const historyKey = name => PREFIX + "events:" + name;
const dailyKey = day => PREFIX + "daily:" + day;
const userDailyKey = (name,day) => PREFIX + "user-daily:" + name + ":" + day;
const digest = input => crypto.createHash("sha256").update(String(input)).digest("hex");
const sessionKey = token => PREFIX + "session:" + digest(token);

export function normalizeLineUsername(input) {
  return normalizeUsername(String(input || "").replace(/\s+/g," "));
}
export function validLineUsername(value) {
  const name = normalizeLineUsername(value);
  return name.length >= 2 && name.length <= 30 &&
    /^[\p{L}\p{N}][\p{L}\p{N}._ -]*$/u.test(name);
}
function deviceHash(input) {
  const value = String(input || "").toLowerCase();
  if (!/^[a-f0-9]{32,64}$/.test(value)) {
    const error = new Error("Identificativo dispositivo mancante. Ricarica la pagina.");
    error.code = "BAD_DEVICE";
    throw error;
  }
  return digest(value);
}
function cookieToken(req) {
  const cookies = String(req?.headers?.cookie || "").split(";");
  for (const pair of cookies) {
    const [key,...parts] = pair.trim().split("=");
    if (key===COOKIE) return parts.join("=");
  }
  return "";
}
function setCookie(res, token, age = SESSION_SECONDS) {
  res.setHeader("Set-Cookie",COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+age);
}
function romeDay(date) {
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const field=t=>parts.find(p=>p.type===t)?.value||"";
  return field("year")+"-"+field("month")+"-"+field("day");
}
function previousRomeDays(count=30) {
  const today=romeDay(new Date());
  const start=new Date(today+"T12:00:00Z");
  return Array.from({length:count},(_,i)=>{
    const d=new Date(start);
    d.setUTCDate(d.getUTCDate()-i);
    return d.toISOString().slice(0,10);
  });
}
function eventJson(action,at,device="") {
  return JSON.stringify({event:action,at,device:device ? device.slice(-6) : ""});
}
async function appendEvent(name,action,device="") {
  const key=historyKey(name),at=new Date().toISOString();
  await redisCommand(["LPUSH",key,eventJson(action,at,device)]);
  await redisCommand(["LTRIM",key,"0","29"]);
  await redisCommand(["EXPIRE",key,String(HISTORY_SECONDS)]);
}
function getProfileObject(value) {
  if (Array.isArray(value)) {
    const o={};
    for(let i=0;i<value.length-1;i+=2)o[String(value[i])]=value[i+1];
    return o;
  }
  return value && typeof value==="object" ? value : {};
}
function parseEvents(value) {
  return (Array.isArray(value)?value:[]).flatMap(item=>{
    try {
      const e=JSON.parse(item);
      return e && e.at && e.event ? [e] : [];
    } catch { return []; }
  });
}
export async function limitLineLogin(ip,name) {
  const keys=[PREFIX+"ratelimit:ip:"+digest(ip||"unknown").slice(0,20),
    PREFIX+"ratelimit:user:"+digest(name).slice(0,20)];
  const counts=await Promise.all(keys.map(async(key)=>{
    const n=Number(await redisCommand(["INCR",key]));
    await redisCommand(["EXPIRE",key,"900","NX"]);
    return n;
  }));
  return counts[0]<=100 && counts[1]<=25;
}
export async function loginLine(res, username, deviceId) {
  const name=normalizeLineUsername(username);
  if (!validLineUsername(name)) {
    const e=new Error("Usa uno username di 2-30 caratteri: lettere, numeri, spazi, punto, trattino o underscore.");
    e.code="BAD_USER";throw e;
  }
  const device=deviceHash(deviceId);
  const token=crypto.randomBytes(32).toString("hex");
  const now=Date.now(), at=new Date(now).toISOString(), day=romeDay(new Date(now));
  const session={user:name,device,createdAt:now,expiresAt:now+SESSION_SECONDS*1000};
  // All login changes happen in a single Redis atomic script. The last login wins.
  const script=[
    "local previous = redis.call('GET',KEYS[2])",
    "redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[3])",
    "redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3])",
    "redis.call('HSET',KEYS[3],'lastLoginAt',ARGV[4])",
    "redis.call('HSETNX',KEYS[3],'firstLoginAt',ARGV[4])",
    "redis.call('HINCRBY',KEYS[3],'totalLogins',1)",
    "redis.call('ZADD',KEYS[4],ARGV[5],ARGV[6])",
    "redis.call('INCR',KEYS[5])",
    "redis.call('EXPIRE',KEYS[5],ARGV[7])",
    "redis.call('INCR',KEYS[6])",
    "redis.call('EXPIRE',KEYS[6],ARGV[7])",
    "redis.call('LPUSH',KEYS[7],previous and ARGV[9] or ARGV[8])",
    "redis.call('LTRIM',KEYS[7],0,29)",
    "redis.call('EXPIRE',KEYS[7],ARGV[7])",
    "return previous or ''"
  ].join("\n");
  const previous=await redisCommand([
    "EVAL",script,"7",sessionKey(token),activeKey(name),profileKey(name),
    usersKey,dailyKey(day),userDailyKey(name,day),historyKey(name),
    JSON.stringify(session),digest(token),String(SESSION_SECONDS),
    at,String(now),name,String(HISTORY_SECONDS),
    eventJson("login",at,device),eventJson("login_replaced",at,device)
  ]);
  setCookie(res,token);
  return {user:name,expiresAt:session.expiresAt,replaced:!!previous};
}
export async function inspectLineSession(req, deviceId) {
  const token=cookieToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return {session:null,reason:"NO_SESSION"};
  const raw=await redisCommand(["GET",sessionKey(token)]);
  if (!raw) return {session:null,reason:"EXPIRED"};
  let record;
  try {record=JSON.parse(raw);}catch{return{session:null,reason:"EXPIRED"};}
  if (!record?.user||record.expiresAt<=Date.now()) return{session:null,reason:"EXPIRED"};
  let device;
  try {device=deviceHash(deviceId);}catch{return{session:null,reason:"BAD_DEVICE"};}
  if (device!==record.device) return{session:null,reason:"BAD_DEVICE"};
  const active=await redisCommand(["GET",activeKey(record.user)]);
  if (active!==digest(token)) return {session:null,reason:active?"REPLACED":"REVOKED"};
  return {session:{user:record.user,expiresAt:record.expiresAt},reason:null};
}
export async function logoutLine(req,res) {
  const token=cookieToken(req);
  if (/^[a-f0-9]{64}$/.test(token)) {
    const raw=await redisCommand(["GET",sessionKey(token)]);
    let record;
    try {record=JSON.parse(raw||"null");}catch{}
    if (record?.user) {
      const script=[
        "redis.call('DEL',KEYS[1])",
        "if redis.call('GET',KEYS[2]) == ARGV[1] then",
        " redis.call('DEL',KEYS[2])",
        " return 1",
        "end",
        "return 0"
      ].join("\n");
      const wasActive=await redisCommand([
        "EVAL",script,"2",sessionKey(token),activeKey(record.user),digest(token)
      ]);
      if (wasActive===1) await appendEvent(record.user,"logout",record.device);
    } else await redisCommand(["DEL",sessionKey(token)]);
  }
  setCookie(res,"",0);
}
export async function revokeLineUser(username) {
  const name=normalizeLineUsername(username);
  if (!validLineUsername(name)) return false;
  const prior=await redisCommand(["DEL",activeKey(name)]);
  if (Number(prior)>0) await appendEvent(name,"admin_revoked");
  return Number(prior)>0;
}
export async function lineAdminOverview() {
  const days=previousRomeDays(30);
  const [names, daily]=await Promise.all([
    redisCommand(["ZREVRANGE",usersKey,"0","199"]),
    redisPipeline(days.map(day=>["GET",dailyKey(day)]))
  ]);
  const entries=Array.isArray(names)?names:[];
  const today=days[0], users=[];
  for(let i=0;i<entries.length;i+=10) {
    const batch=entries.slice(i,i+10);
    const records=await Promise.all(batch.map(async name=>{
      const [raw,active,todayRaw,events]=await Promise.all([
        redisCommand(["HGETALL",profileKey(name)]),
        redisCommand(["GET",activeKey(name)]),
        redisCommand(["GET",userDailyKey(name,today)]),
        redisCommand(["LRANGE",historyKey(name),"0","9"])
      ]);
      const profile=getProfileObject(raw);
      return {user:name,sessionActive:!!active,totalLogins:Number(profile.totalLogins||0),
        todayLogins:Number(todayRaw||0),
        firstLoginAt:String(profile.firstLoginAt||""),
        lastLoginAt:String(profile.lastLoginAt||""),
        events:parseEvents(events)};
    }));
    users.push(...records);
  }
  const timeline=days.map((day,i)=>({day,logins:Number(daily[i]||0)})).reverse();
  return {
    users,
    stats:{
      activeSessions:users.filter(u=>u.sessionActive).length,
      usersTracked:users.length,
      loginsToday:Number(daily[0]||0),
      logins30days:timeline.reduce((sum,d)=>sum+d.logins,0)
    },
    daily:timeline,
    period:"Europe/Rome",
    historyDays:30
  };
}
