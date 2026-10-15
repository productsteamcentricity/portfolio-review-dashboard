/* ============================================================================
   refresh_pms_perf.js — PMS_PERF (and AIF_PERF, when a file carries it) from the
   vendor's monthly "PMS_Scheme Performance_<date>.xlsx".

   Port of refresh_scripts/refresh_pms_perf.js (the 31 Jul 2026 refresh) with the
   merge rules unchanged — they were measured on that issue:
     - match on a whitespace/punctuation/filler-normalised key; the display name
       stays the embedded one, so ALIASES and match caches keep working;
     - returns are replaced WHOLESALE per scheme, never field-by-field, so a row
       is one vintage throughout;
     - mcap / category / inception are carried from the embedded record when the
       file is silent on them (silent is not zero);
     - AUM is stated in rupees and stored in crore, rounded as before;
     - a strategy absent from this issue is kept at its prior vintage, not
       deleted; a new one is added with blank category/inception;
     - embedded spellings that collapse onto one key are one strategy filed
       twice: merged, the file's current spelling kept, the rest reported.
   Differences: parameterised --src, reads with the dashboard's own SheetJS, and
   writes a blocks file for splice_refresh.js (standard three-copy assertions)
   instead of patching the HTML itself. Adds a staleness diagnostic: how many
   rows the vendor re-issued with every return identical to the embedded block.

     node buildtools/refresh_pms_perf.js --src "<xlsx>" [--out <json>]
   ========================================================================== */
'use strict';
const fs = require('fs'); const path = require('path');
const X = require('./xlsx-embedded.js');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SRC = arg('--src'); const OUT_FILE = arg('--out', path.join(__dirname, 'out', 'pms_perf_blocks.json'));
if (!SRC) throw new Error('--src <xlsx> is required');

function nkey(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/aplhasense/g, 'alphasense')
    .replace(/[‘’']/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\b(securities|portfolio|pms)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function num(v) { if (v == null || v === '') return null; const n = Number(String(v).replace(/,/g, '').trim()); return isFinite(n) ? n : null; }

/* ---------- embedded blocks ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rs = html.indexOf('window.REFDATA = '), re = html.indexOf(';</script>', rs);
const REF = JSON.parse(html.slice(rs + 'window.REFDATA = '.length, re));
const OLD = REF.PMS_PERF, AIF = REF.AIF_PERF || {};

/* ---------- source ---------- */
const wb = X.read(fs.readFileSync(SRC), { type: 'buffer', raw: true });
const dataSheet = wb.SheetNames.find(n => ((X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null })[0]) || [])
  .map(x => String(x == null ? '' : x).trim()).includes('Scheme Name'));
if (!dataSheet) throw new Error('no sheet with a "Scheme Name" header');
const rows = X.utils.sheet_to_json(wb.Sheets[dataSheet], { defval: null });
const RET = { '1M': 'Scheme Return 1 Month', '3M': 'Scheme Return 3 Month', '6M': 'Scheme Return 6 Month',
  '1Y': 'Scheme Return 1 Year', '2Y': 'Scheme Return 2 Year', '3Y': 'Scheme Return 3 Year',
  '5Y': 'Scheme Return 5 Year', 'SI': 'Scheme Return Since Inception' };
const hdr = Object.keys(rows[0] || {});
Object.values(RET).concat(['AUM']).forEach(h => { if (hdr.indexOf(h) < 0) throw new Error('column missing: ' + h); });
const MCAPCOLS = ['Large Cap', 'Mid Cap', 'Small Cap'];
const mcapFilled = rows.filter(r => MCAPCOLS.some(c => num(r[c]) != null)).length;

const file = new Map(); const dupes = [];
for (const row of rows) {
  const name = String(row['Scheme Name'] == null ? '' : row['Scheme Name']).replace(/\s+/g, ' ').trim();
  if (!name) continue;
  const k = nkey(name);
  const r = {}; for (const f of Object.keys(RET)) r[f] = num(row[RET[f]]);
  const aumRaw = num(row['AUM']);
  const rec = { name, r, aum: aumRaw == null ? null : Math.round(aumRaw / 1e7) };
  if (file.has(k)) { dupes.push(name); const p = file.get(k); if (Object.values(p.r).every(v => v == null)) file.set(k, rec); }
  else file.set(k, rec);
}

/* ---------- merge (rules unchanged from the July refresh) ---------- */
const groups = new Map();
for (const [name, rec] of Object.entries(OLD)) { const k = nkey(name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([name, rec]); }
const hasR = rec => rec && rec.r && Object.values(rec.r).some(v => v != null);
const droppedDupes = [], OUT = {};
let updated = 0, addedNew = 0, keptStale = 0, aumKept = 0, lostVals = 0, gainedVals = 0, unchanged = 0;
let sameAsBefore = 0, sameAsBeforeWithData = 0;
const lostDetail = {}, staleList = [], newList = [], lostRows = [];
for (const [k, members] of groups) {
  let name, rec;
  if (members.length === 1) [name, rec] = members[0];
  else {
    const f0 = file.get(k); const chosen = members.find(([, r]) => hasR(r)) || members[0];
    name = f0 ? f0.name : chosen[0]; rec = Object.assign({}, chosen[1]);
    for (const [, r] of members) {
      if (!rec.category && r.category) rec.category = r.category;
      if (!rec.inception && r.inception) rec.inception = r.inception;
      if (rec.aum == null && r.aum != null) rec.aum = r.aum;
      if (!rec.mcap && r.mcap) rec.mcap = r.mcap;
    }
    members.forEach(([n]) => { if (n !== name) droppedDupes.push(n + '  (kept as: ' + name + ')'); });
  }
  const f = file.get(k);
  if (!f) { OUT[name] = rec; keptStale++; staleList.push(name); continue; }
  const before = rec.r || {};
  const out = { category: rec.category || '', inception: rec.inception || '', aum: f.aum == null ? rec.aum : f.aum, r: f.r };
  if (f.aum == null && rec.aum != null) aumKept++;
  if (rec.mcap) out.mcap = rec.mcap;
  OUT[name] = out;
  let l = 0, g = 0, same = true;
  for (const t of Object.keys(RET)) {
    const a = before[t], b = f.r[t];
    if (a != null && b == null) { l++; lostDetail[t] = (lostDetail[t] || 0) + 1; }
    if (a == null && b != null) g++;
    if (!(a === b || (a != null && b != null && Math.abs(a - b) < 1e-9))) same = false;
  }
  if (same) { sameAsBefore++; if (hasR(out)) sameAsBeforeWithData++; }
  if (l) lostRows.push(name + ' (' + l + ')');
  lostVals += l; gainedVals += g; if (!l && !g) unchanged++; updated++;
}
const embIdx = new Set(Object.keys(OLD).map(nkey));
for (const [k, f] of file) { if (embIdx.has(k)) continue; OUT[f.name] = { category: '', inception: '', aum: f.aum, r: f.r }; addedNew++; newList.push(f.name); }

/* ---------- AIF: does this issue carry any of the embedded AIF strategies? ---------- */
const aifHits = Object.keys(AIF).filter(n => file.has(nkey(n)));

/* ---------- report ---------- */
const has = o => o && Object.values(o).some(v => v != null);
const cov = (B, f) => Object.values(B).filter(f).length;
console.log('source      : ' + path.basename(SRC) + '  sheet "' + dataSheet + '"');
console.log('rows        : ' + rows.length + '  distinct schemes ' + file.size + (dupes.length ? '  (dup names collapsed ' + dupes.length + ')' : ''));
console.log('mcap cells  : ' + mcapFilled + ' rows carry a Large/Mid/Small value' + (mcapFilled ? '' : ' (file silent — carried forward)'));
console.log('\nPMS_PERF ' + Object.keys(OLD).length + ' -> ' + Object.keys(OUT).length);
console.log('  refreshed from file     ' + updated);
console.log('  added (new schemes)     ' + addedNew);
console.log('  kept, absent from file  ' + keptStale);
console.log('  aum kept (file blank)   ' + aumKept);
console.log('  duplicate spellings     ' + droppedDupes.length);
console.log('\nreturn cells: gained ' + gainedVals + ', lost ' + lostVals + ', rows with no gain/loss ' + unchanged + '   lost by tenor ' + JSON.stringify(lostDetail));
console.log('STALENESS  : ' + sameAsBeforeWithData + ' of ' + updated + ' refreshed rows carry every return IDENTICAL to the embedded block (' + (sameAsBefore - sameAsBeforeWithData) + ' more are empty in both)');
console.log('\ncoverage  any return : ' + cov(OLD, v => has(v.r)) + ' -> ' + cov(OUT, v => has(v.r)));
console.log('coverage  1Y return  : ' + cov(OLD, v => v.r && v.r['1Y'] != null) + ' -> ' + cov(OUT, v => v.r && v.r['1Y'] != null));
console.log('coverage  3Y return  : ' + cov(OLD, v => v.r && v.r['3Y'] != null) + ' -> ' + cov(OUT, v => v.r && v.r['3Y'] != null));
console.log('coverage  mcap       : ' + cov(OLD, v => has(v.mcap)) + ' -> ' + cov(OUT, v => has(v.mcap)));
console.log('coverage  category   : ' + cov(OLD, v => v.category) + ' -> ' + cov(OUT, v => v.category));
console.log('coverage  inception  : ' + cov(OLD, v => v.inception) + ' -> ' + cov(OUT, v => v.inception));
console.log('coverage  aum        : ' + cov(OLD, v => v.aum != null) + ' -> ' + cov(OUT, v => v.aum != null));
console.log('\nAIF_PERF    : ' + Object.keys(AIF).length + ' embedded strategies; found in this file: ' + aifHits.length + (aifHits.length ? ' — ' + aifHits.join(' | ') : ' (no AIF source in this issue)'));
if (droppedDupes.length) { console.log('\nduplicate spellings collapsed:'); droppedDupes.forEach(n => console.log('   ' + n)); }
console.log('\nkept, absent from this issue (' + staleList.length + '):'); staleList.forEach(n => console.log('   ' + n));
console.log('\nnew schemes (' + newList.length + '):'); newList.forEach(n => console.log('   ' + n + (has(OUT[n].r) ? '' : '   [name only, no data]')));
if (lostRows.length) { console.log('\nrows that lost a return they had (' + lostRows.length + '):'); lostRows.slice(0, 40).forEach(n => console.log('   ' + n)); }

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ blocks: { PMS_PERF: OUT } }));
console.log('\nwrote ' + path.relative(ROOT, OUT_FILE) + ' (' + fs.statSync(OUT_FILE).size.toLocaleString() + ' bytes)');
