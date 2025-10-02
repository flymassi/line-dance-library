// tools/xlsx-to-json.js
// Uso: node tools\xlsx-to-json.js "line.xlsx" "data/songs.json"

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function norm(s) { return String(s || "").trim().toLowerCase().replace(/’/g, "'"); }
function toInt(s) {
  try { return parseInt(parseFloat(String(s).replace(",", "."))); }
  catch { return -1; }
}

const inFile = process.argv[2];
const outFile = process.argv[3] || path.join("data", "songs.json");

if (!inFile) {
  console.error('USO: node tools\\xlsx-to-json.js "line.xlsx" "data\\songs.json"');
  process.exit(1);
}
if (!fs.existsSync(inFile)) {
  console.error("ERRORE: non trovo il file:", inFile);
  process.exit(1);
}

console.log("📄 Leggo:", inFile);
const wb = XLSX.readFile(inFile, { cellStyles: true, cellHTML: true, cellNF: true });
const ws = wb.Sheets[wb.SheetNames[0]];
if (!ws) { console.error("ERRORE: nessun foglio trovato nel file."); process.exit(1); }

const ref = ws["!ref"];
if (!ref) { console.error("ERRORE: intervallo vuoto (!ref)."); process.exit(1); }

const range = XLSX.utils.decode_range(ref);

// header
const headers = [];
for (let C = range.s.c; C <= range.e.c; ++C) {
  const a = XLSX.utils.encode_cell({ r: range.s.r, c: C });
  headers.push((ws[a]?.v || "").toString().trim());
}
console.log("🧭 Intestazioni:", headers.join(" | "));

// mappa intestazioni → indice colonna
const map = {}; headers.forEach((h, i) => (map[norm(h)] = i));
function idx(list) { for (const n of list) { const i = map[norm(n)]; if (i != null) return i; } return -1; }

const Ianno   = idx(["Anno"]);
const Inum    = idx(["#","Nr. canzone","N° canzone","Numero canzone"]);
const Idance  = idx(["Titolo del Ballo"]);
const Ivideo  = idx(["Video del ballo (hyperlink)","Video del ballo"]);
const Isinger = idx(["Nome del cantante","Cantante"]);
const Isongt  = idx(["Nome della canzone","Titolo della canzone"]);
const Isongu  = idx(["Canzone del ballo (hyperlink)","Canzone del ballo"]);

console.log("🔗 Mappa colonne:", { Ianno, Inum, Idance, Ivideo, Isinger, Isongt, Isongu });

function cell(r, c) {
  if (c < 0) return "";
  const a = XLSX.utils.encode_cell({ r, c });
  const o = ws[a];
  return o?.v ?? "";
}
function link(r, c) {
  if (c < 0) return "";
  const a = XLSX.utils.encode_cell({ r, c });
  const o = ws[a];
  const L = o?.l;
  if (L && (L.Target || L.target)) return String(L.Target || L.target).trim();
  const v = o?.v;
  if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  return "";
}

const out = [];
let total = 0, kept = 0;

for (let R = range.s.r + 1; R <= range.e.r; ++R) {
  total++;
  const item = {
    year: cell(R, Ianno),
    songNumber: cell(R, Inum),
    danceTitle: cell(R, Idance),
    danceVideoUrl: link(R, Ivideo),
    singerName: cell(R, Isinger),
    songTitle: cell(R, Isongt),
    songUrl: link(R, Isongu),
  };
  if (item.danceVideoUrl || item.songUrl) { out.push(item); kept++; }
}

out.sort((a, b) => (toInt(b.songNumber) || 0) - (toInt(a.songNumber) || 0));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");

console.log(`✅ OK: creato ${outFile} con ${out.length} righe (letta tabella: ${total} righe).`);
