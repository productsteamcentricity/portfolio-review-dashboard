/* ============================================================================
   build_other_funds.js — one-off October 2026 step (CR-0010, A1).

   The vendor's October Hybrid file left out 40 children's and retirement funds,
   so the October refresh carried their 30 Sep 2026 look-through forward, tagged
   `vintage: "30 Sep 2026"` (build_refresh.js, carryForwardLookThroughs). The
   vendor's "Other Funds Analytics" file has the same 24 columns as the main
   analytics files, three rows above the header, and holds those 40 funds as on
   31 Oct 2026 (Oct-26 columns) next to their 30 Sep 2026 holdings (Sep-26).

   This step runs that sheet through the EXISTING hybrid route (hybridFromAoa,
   the same code as the monthly Hybrid build) and replaces exactly the carried
   keys, in place (key order kept), without the vintage tag. It writes a blocks
   file holding HYBRID_ANALYTICS only, so splice_refresh.js --data-only changes
   that block and nothing else (DATA_DATES stays as embedded). The other 304
   schemes in the file are NOT loaded: only keys already carried are replaced.

   Hard stops (nothing is written):
     - more than one sheet; the header or the two month columns not where the
       layout says (Oct-26 in columns 3..7, Sep-26 in 19..23);
     - the carried-key count is not --expect (default 40);
     - a carried key is missing from the file by exact name, or its equity plus
       debt weight is not 100 +/- 0.5;
     - any key other than the carried ones would change;
     - the known-answer check fails: the file's Sep-26 columns, through the same
       route, must reproduce the embedded 30 Sep entries (debt side all funds;
       equity side all funds except those listed in SEP_EQ_EXCEPTIONS, each with
       its reason).

   Row 0 of the sheet is a title line, never data: both parsers start at row 1,
   so the whole sheet is passed unsliced (the header row parses to nothing).

   Usage:
     node --max-old-space-size=8192 buildtools/build_other_funds.js
          --src "<...>/Analytics/Other Funds Analytics.xlsx"
          --out buildtools/out/2026-10/other-funds/blocks.json
          [--vintage "30 Sep 2026"] [--expect 40] [--report <file.json>]
   ========================================================================== */
'use strict';
const fs = require('fs');
const { load } = require('../tools/engine-host.js');
const { aoaOf, hybridFromAoa, clean, normco } = require('./build_refresh.js');

/* Funds whose Sep-26 equity side may differ from the embedded 30 Sep entry, with the reason. */
const SEP_EQ_EXCEPTIONS = {
  'PGIM India Retirement Fund-Reg(G)': 'one holding renamed by the vendor between the two issues (same company)'
};

function argv(name, dflt){ const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt; }
const r4 = x => x == null ? null : Math.round(x * 1e4) / 1e4;
const stop = msg => { console.error('HARD STOP: ' + msg); process.exit(1); };
/* month label of a header date cell, independent of the process time zone (the cell is the
   1st of the month; SheetJS returns it a few seconds before local midnight) */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = d => { if (!(d instanceof Date)) return ''; const t = new Date(d.getTime() + 12 * 3600 * 1000); return MON[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); };
function maxDiff(a, b){ a = a || {}; b = b || {}; let m = 0; new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => { m = Math.max(m, Math.abs((a[k] || 0) - (b[k] || 0))); }); return m; }
const stockMap = list => { const m = {}; (list || []).forEach(s => { m[s[0]] = (m[s[0]] || 0) + s[1]; }); return m; };
const eqSame = (p, n) => { if (!p && !n) return true; if (!p || !n) return false; return p.weight === n.weight && maxDiff(stockMap(p.stocks), stockMap(n.stocks)) < 0.001 && maxDiff(p.sector, n.sector) < 0.001 && maxDiff(p.mcap, n.mcap) < 0.001; };
const dbSame = (p, n) => { if (!p && !n) return true; if (!p || !n) return false; return p.weight === n.weight && maxDiff(p.rating, n.rating) < 0.001 && maxDiff(p.issuer, n.issuer) < 0.001 && maxDiff(p.sector, n.sector) < 0.001; };

function main(){
  const SRC = argv('src'), OUT = argv('out'), VINT = argv('vintage', '30 Sep 2026'), EXPECT = parseInt(argv('expect', '40'), 10), REPORT = argv('report');
  if (!SRC || !OUT) throw new Error('usage: --src <Other Funds Analytics.xlsx> --out <blocks.json> [--vintage "30 Sep 2026"] [--expect 40] [--report <json>]');
  const H = load(); const X = H.XLSX, E = H.E, REF = H.REF;
  const HY = REF.HYBRID_ANALYTICS || {};

  /* ---------- layout ---------- */
  const wb = X.read(fs.readFileSync(SRC), { type: 'buffer', cellDates: true });
  if (wb.SheetNames.length !== 1) stop('expected one sheet, got ' + wb.SheetNames.join(' | '));
  const aoa = aoaOf(X, SRC);
  const h = aoa.findIndex((r, i) => i < 10 && r && clean(r[0]) === 'Scheme Name');
  if (h < 1) stop('header row "Scheme Name" not found in rows 1..9 (row 0 must be a non-data row)');
  const hdr = aoa[h].map(clean), dates = aoa[h - 1] || [];
  const want = { 0: 'Scheme Name', 1: 'Company Name', 2: 'In/Out', 3: 'Holding(%)', 8: 'Sector', 9: 'Asset', 10: 'Asset Type', 11: 'Rating', 13: 'Rate Basket', 15: 'Issuer Name', 18: 'SEBI MCAP Type', 19: 'Holding(%)' };
  Object.keys(want).forEach(c => { if (hdr[c] !== want[c]) stop('column ' + c + ' is "' + hdr[c] + '", expected "' + want[c] + '"'); });
  const mNew = monthOf(dates[3]), mOld = monthOf(dates[19]);
  if (mNew !== 'Oct 2026' || mOld !== 'Sep 2026') stop('month columns are "' + mNew + '" (3) and "' + mOld + '" (19), expected Oct 2026 and Sep 2026');
  console.log('source      : ' + SRC.split(/[\\/]/).pop() + '  (' + aoa.length + ' rows; header row ' + h + '; columns 3..7 ' + mNew + ', 19..23 ' + mOld + ')');

  /* ---------- targets: the keys carried at the given vintage ---------- */
  const targets = Object.keys(HY).filter(k => HY[k].vintage === VINT);
  if (targets.length !== EXPECT) stop(targets.length + ' HYBRID_ANALYTICS keys carry vintage "' + VINT + '", expected ' + EXPECT);
  const T = new Set(targets);

  /* ---------- the October build through the hybrid route ---------- */
  const built = hybridFromAoa(E, aoa, null);
  const report = { source: SRC.split(/[\\/]/).pop(), vintage: VINT, targets: targets.length, schemesInFile: Object.keys(built).length, funds: {}, stockInfoGaps: [], sepCheck: {} };
  targets.forEach(k => {
    const b = built[k]; if (!b) stop('carried key not in the file by exact name: ' + k);
    const eqW = (b.eq && b.eq.weight) || 0, dbW = (b.db && b.db.weight) || 0;
    if (Math.abs(eqW + dbW - 100) > 0.5) stop(k + ': equity ' + eqW + ' + debt ' + dbW + ' is not 100 +/- 0.5');
    const p = HY[k];
    const ms = maxDiff(stockMap(p.eq && p.eq.stocks), stockMap(b.eq && b.eq.stocks));
    report.funds[k] = { eqW: [p.eq ? p.eq.weight : null, b.eq ? b.eq.weight : null], dbW: [p.db ? p.db.weight : null, b.db ? b.db.weight : null],
      stocks: [p.eq ? p.eq.stocks.length : 0, b.eq ? b.eq.stocks.length : 0], maxStockMove: r4(ms) };
    (b.eq ? b.eq.stocks : []).forEach(s => { const key = normco(s[0]); if (key && !(REF.STOCK_INFO || {})[key]) report.stockInfoGaps.push([k, s[0], s[1], s[2]]); });
  });

  /* ---------- the new block: carried keys replaced in place, nothing else ---------- */
  const NEW = {};
  Object.keys(HY).forEach(k => { NEW[k] = T.has(k) ? built[k] : HY[k]; });
  const changed = Object.keys(NEW).filter(k => JSON.stringify(NEW[k]) !== JSON.stringify(HY[k]));
  const stray = changed.filter(k => !T.has(k));
  if (stray.length) stop('keys other than the carried ones would change: ' + stray.join(' | '));
  if (Object.keys(NEW).length !== Object.keys(HY).length) stop('key count changed');
  if (targets.some(k => NEW[k].vintage)) stop('a replaced key still carries a vintage tag');
  report.changed = changed.length;

  /* ---------- known answer: Sep-26 columns reproduce the embedded 30 Sep entries ---------- */
  const sepAoa = aoa.map((r, j) => { if (j <= h || !r) return r; const c = r.slice(); c[2] = ''; for (let q = 0; q < 5; q++) c[3 + q] = r[19 + q]; return c; });
  const S = hybridFromAoa(E, sepAoa, null);
  const eqBad = [], dbBad = [];
  targets.forEach(k => { const p = Object.assign({}, HY[k]); delete p.vintage; const s = S[k] || {};
    if (!eqSame(p.eq, s.eq)) eqBad.push(k); if (!dbSame(p.db, s.db)) dbBad.push(k); });
  const eqUnexplained = eqBad.filter(k => !SEP_EQ_EXCEPTIONS[k]);
  report.sepCheck = { eqExact: targets.length - eqBad.length, dbExact: targets.length - dbBad.length, eqExceptions: eqBad.map(k => [k, SEP_EQ_EXCEPTIONS[k] || 'UNEXPLAINED']) };
  console.log('sep check   : Sep-26 columns vs the embedded 30 Sep entries: equity exact ' + report.sepCheck.eqExact + '/' + targets.length + ', debt exact ' + report.sepCheck.dbExact + '/' + targets.length);
  eqBad.forEach(k => { const a = stockMap(HY[k].eq && HY[k].eq.stocks), b = stockMap(S[k] && S[k].eq && S[k].eq.stocks);
    console.log('  equity differs: ' + k + ' — ' + (SEP_EQ_EXCEPTIONS[k] || 'UNEXPLAINED') + '; only embedded: ' + JSON.stringify(Object.keys(a).filter(x => !(x in b))) + '; only rebuilt: ' + JSON.stringify(Object.keys(b).filter(x => !(x in a)))); });
  if (dbBad.length) stop('Sep-26 debt side differs from the embedded 30 Sep entry for: ' + dbBad.join(' | '));
  if (eqUnexplained.length) stop('Sep-26 equity side differs, unexplained, for: ' + eqUnexplained.join(' | '));

  /* ---------- report ---------- */
  console.log('targets     : ' + targets.length + ' keys at vintage "' + VINT + '"; all found by exact name; ' + changed.length + ' change; no other key changes');
  console.log('file        : ' + report.schemesInFile + ' schemes parsed; only the ' + targets.length + ' carried keys are used');
  console.log('per fund    : equity weight Sep -> Oct | debt weight Sep -> Oct | stocks Sep -> Oct | largest single-stock move (points)');
  targets.forEach(k => { const f = report.funds[k]; console.log('  ' + k.padEnd(62).slice(0, 62) + ' ' + String(f.eqW[0]).padStart(8) + ' -> ' + String(f.eqW[1]).padEnd(8) + ' | ' + String(f.dbW[0]).padStart(8) + ' -> ' + String(f.dbW[1]).padEnd(8) + ' | ' + String(f.stocks[0]).padStart(3) + ' -> ' + String(f.stocks[1]).padEnd(3) + ' | ' + f.maxStockMove); });
  console.log('STOCK_INFO  : ' + report.stockInfoGaps.length + ' October stock rows of these funds have no STOCK_INFO entry (STOCK_INFO is read only for direct-equity holdings; not changed here)');
  report.stockInfoGaps.forEach(g => console.log('  ' + g[0] + ' | ' + g[1] + ' | ' + g[2] + '% | ' + g[3]));
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ blocks: { HYBRID_ANALYTICS: NEW }, report }));
  console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size.toLocaleString() + ' bytes); blocks: HYBRID_ANALYTICS only (DATA_DATES unchanged)');
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
}
if (require.main === module) main();
module.exports = { SEP_EQ_EXCEPTIONS };
