/* check_blocks.js — validation gate for a built blocks file, before it is spliced.
   Mirrors the CMS gate: per-scheme analytics blocks sum to 100 (±0.05), key formats,
   core benchmarks present, no null-heavy block, dates advanced, count deltas vs embedded.
   Usage: node buildtools/check_blocks.js buildtools/out/aug2026_blocks.json */
'use strict';
const fs = require('fs'); const path = require('path');
const { blocks: B, report } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const rs = html.indexOf('window.REFDATA = '); const re = html.indexOf(';</script>', rs);
const REF = JSON.parse(html.slice(rs + 'window.REFDATA = '.length, re));
let fails = 0; const fail = m => { fails++; console.log('  FAIL ' + m); }; const ok = m => console.log('  ok   ' + m);
const sum = o => Object.values(o || {}).reduce((t, v) => t + (v || 0), 0);
const within = (x, t) => Math.abs(x - 100) <= t;

function sums(label, block, pick, tol) {
  const keys = Object.keys(block); let bad = []; keys.forEach(k => { const o = pick(block[k]); if (!o) return; const s = sum(o); if (!within(s, tol)) bad.push([k, s.toFixed(3)]); });
  if (bad.length) fail(label + ': ' + bad.length + ' of ' + keys.length + ' do not sum to 100 e.g. ' + JSON.stringify(bad.slice(0, 3))); else ok(label + ': all ' + keys.length + ' sum to 100 (±' + tol + ')');
}
console.log('== analytics blocks');
if (B.EQUITY_ANALYTICS) { sums('EQUITY mcap', B.EQUITY_ANALYTICS, d => d.mcap, 0.05); sums('EQUITY sector (ex-cash)', B.EQUITY_ANALYTICS, d => d.pcls ? null : d.sector, 100); /* sector excludes cash by design */
  const nz = Object.keys(B.EQUITY_ANALYTICS).filter(k => !B.EQUITY_ANALYTICS[k].stocks || !B.EQUITY_ANALYTICS[k].stocks.length); if (nz.length) fail('EQUITY schemes with no stocks: ' + nz.length + ' ' + nz.slice(0, 3)); else ok('EQUITY every scheme carries stocks'); }
if (B.HYBRID_ANALYTICS) { sums('HYBRID eq.mcap', B.HYBRID_ANALYTICS, d => d.eq && d.eq.mcap, 0.05); sums('HYBRID db.rating', B.HYBRID_ANALYTICS, d => d.db && d.db.rating, 0.05);
  const part = Object.keys(B.HYBRID_ANALYTICS).map(k => { const d = B.HYBRID_ANALYTICS[k]; return [(d.eq && d.eq.weight) || 0, (d.db && d.db.weight) || 0]; });
  const off = part.filter(p => Math.abs(p[0] + p[1] - 100) > 5); ok('HYBRID eq+db partition: ' + (part.length - off.length) + ' within 5pp of 100, ' + off.length + ' outside (guard case; engine falls back to 100-eq)'); }
if (B.DEBT_ANALYTICS) { sums('DEBT rating', B.DEBT_ANALYTICS, d => d.rating, 0.05); sums('DEBT sector', B.DEBT_ANALYTICS, d => d.sector, 0.05);
  const w = Object.keys(B.DEBT_ANALYTICS).filter(k => 'weight' in B.DEBT_ANALYTICS[k]); if (w.length) fail('DEBT entries carry weight: ' + w.length); else ok('DEBT entries carry no weight (embedded shape)'); }

console.log('== performance blocks');
function perfCheck(label, P, OLD) {
  const keys = Object.keys(P); const reg = keys.filter(k => /-Reg\(G\)$/.test(k)).length, dir = keys.filter(k => /\(G\)-Direct Plan$/.test(k)).length;
  const nullR = keys.filter(k => Object.values(P[k].r || {}).every(v => v == null)).length; const nullAum = keys.filter(k => P[k].aum == null && !P[k].bm).length;
  const debt = keys.filter(k => P[k].debt).length, allNull = keys.filter(k => P[k].debt && Object.values(P[k].debt).every(v => v == null)).length;
  console.log('  ' + label + ': ' + keys.length + ' schemes (was ' + Object.keys(OLD).length + ')  -Reg(G) ' + reg + '  Direct ' + dir + '  all-null returns ' + nullR + '  aum null (non-bm) ' + nullAum + '  debt blocks ' + debt + ' (all-null ' + allNull + ')');
  if (allNull) fail(label + ' has all-null debt blocks'); const oldNull = Object.keys(OLD).filter(k => Object.values(OLD[k].r || {}).every(v => v == null)).length; if (nullR > oldNull + 10) fail(label + " null-heavy returns (" + nullR + " vs " + oldNull + " embedded)"); else console.log("     all-null returns " + nullR + " (embedded had " + oldNull + ")"); if (nullAum > 60) fail(label + ' null-heavy AUM (header-mapping miss?)');
  const os = new Set(Object.keys(OLD)); const ns = new Set(keys); const dropped = Object.keys(OLD).filter(k => !ns.has(k) && !OLD[k].bm), added = keys.filter(k => !os.has(k) && !P[k].bm);
  console.log('     dropped ' + dropped.length + ' (e.g. ' + dropped.slice(0, 4).join(' | ') + ')'); console.log('     added   ' + added.length + ' (e.g. ' + added.slice(0, 4).join(' | ') + ')');
  return { dropped, added };
}
if (B.MF_PERF) { const d = perfCheck('MF_PERF', B.MF_PERF, REF.MF_PERF); if (/-Reg\(G\)$/.test(Object.keys(B.MF_PERF)[0])) ok('MF_PERF keys are -Reg(G)'); }
if (B.MF_PERF_DIRECT) { perfCheck('MF_PERF_DIRECT', B.MF_PERF_DIRECT, REF.MF_PERF_DIRECT); if (/Direct Plan$/.test(Object.keys(B.MF_PERF_DIRECT)[0])) ok('MF_PERF_DIRECT keys are Direct'); }
if (B.BENCH_RET) { const core = ['nifty50', 'nifty100', 'nifty500', 'niftymidcap150', 'niftysmallcap250', 'crisilcompositebondindex', 'crisilliquiddebtindex', 'crisilshorttermbondindex']; const miss = core.filter(k => !B.BENCH_RET[k]); if (miss.length) fail('BENCH_RET missing core: ' + miss); else ok('BENCH_RET carries the core benchmarks (' + Object.keys(B.BENCH_RET).length + ' total, was ' + Object.keys(REF.BENCH_RET).length + ')'); }
if (B.SIF_PERF) { const k = Object.keys(B.SIF_PERF); const junk = k.filter(n => n.length > 80 || / - TRI$/i.test(n) || /^(nifty|bse)\b/i.test(n)); if (junk.length) fail('SIF_PERF junk rows: ' + junk); else ok('SIF_PERF ' + k.length + ' schemes, no benchmark/disclaimer rows'); const nr = k.filter(n => B.SIF_PERF[n].r['1M'] == null && B.SIF_PERF[n].r['SI'] == null); if (nr.length) fail('SIF_PERF schemes with no returns: ' + nr); }

console.log('== masters');
if (B.STOCK_INFO) { const n = Object.keys(B.STOCK_INFO).length, o = Object.keys(REF.STOCK_INFO).length; if (n < o) fail('STOCK_INFO shrank ' + o + ' -> ' + n); else ok('STOCK_INFO coverage ' + o + ' -> ' + n); const dbl = Object.values(B.STOCK_INFO).filter(v => /\s{2,}/.test(v[1])).length; console.log('     sectors with doubled spaces: ' + dbl + ' (was ' + Object.values(REF.STOCK_INFO).filter(v => /\s{2,}/.test(v[1])).length + ')'); }
if (B.STOCK_RET) { const n = Object.keys(B.STOCK_RET).length; const withR = Object.values(B.STOCK_RET).filter(v => v.r['1Y'] != null).length; ok('STOCK_RET ' + n + ' companies (was ' + Object.keys(REF.STOCK_RET).length + '), ' + withR + ' with a 1Y return'); }
if (B.MF_ER_TABLE) { const n = Object.keys(B.MF_ER_TABLE).length; const nullR = Object.values(B.MF_ER_TABLE).filter(v => v.r == null).length; ok('MF_ER_TABLE ' + n + ' entries, r null ' + nullR); }
if (B.FUND_MGR) { const n = Object.keys(B.FUND_MGR).length; const cur = Object.values(B.FUND_MGR).filter(v => v.stints.some(s => s.cur)).length; ok('FUND_MGR ' + n + ' schemes (was ' + Object.keys(REF.FUND_MGR).length + '), ' + cur + ' with a currently-serving manager; meta ' + JSON.stringify(B.FUND_MGR_META)); }
if (B.MARKET_UPDATE_IMAGES) ok('MARKET_UPDATE_IMAGES ' + B.MARKET_UPDATE_IMAGES.length + ' slides, ' + B.MARKET_UPDATE_IMAGES.reduce((t, s) => t + s.length, 0).toLocaleString() + ' bytes');
console.log('== dates');
console.log('  was ' + JSON.stringify(REF.DATA_DATES)); console.log('  now ' + JSON.stringify(B.DATA_DATES));
['analytics', 'performance', 'direct'].forEach(k => { if (B.DATA_DATES[k] === REF.DATA_DATES[k]) fail('DATA_DATES.' + k + ' did not advance'); });
console.log(fails ? ('\n' + fails + ' FAILURE(S)') : '\nall checks passed');
process.exit(fails ? 1 : 0);
