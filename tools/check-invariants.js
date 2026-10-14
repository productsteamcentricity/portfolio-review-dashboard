/* ============================================================================
   check-invariants.js — the structural and compliance invariants index.html
   must keep through every code change and every monthly data refresh.

     node tools/check-invariants.js [--expect-md5 <hash>]

   FAIL (exit 1)
     - naive "<script" count is 14 (13 real blocks + 1 literal in PptxGenJS)
     - the file tail is unchanged, trailing newline included
     - each of the 13 script blocks is found by its marker, exactly once
     - no network API and no remote URL in the application code or the page
       shell (compliance: client holdings never leave the browser)
     - the engine loads headlessly and exposes the documented ENGINE surface
     - every REFDATA block is present and non-empty; DATA_DATES has 7 dates
     - a market-cap / sector / rating look-through is off 100 by more than 0.5
   WARN (reported, exit 0)
     - a look-through is off 100 by more than 0.05 (the handover tolerance).
       Issuer blocks are top-30 lists by design and are not summed.
   INFO
     - size, MD5 and the record count of every block, for the refresh log
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'index.html');
const TAIL = '})();\n})();</script>\n</body>\n</html>\n';
const MARKERS = [                                   /* the same markers tools/engine-host.js uses */
  ['chartjs', b => /^\/\*!\s*\n \* Chart\.js v/.test(b.slice(0, 40))],
  ['datalabels', b => /chartjs-plugin-datalabels/.test(b.slice(0, 120))],
  ['sheetjs', b => /xlsx\.js \(C\) 2013-present SheetJS/.test(b.slice(0, 200))],
  ['pptxgenjs', b => /PptxGenJS 3\.\d/.test(b.slice(0, 200))],
  ['refdata', b => /^\s*window\.REFDATA\s*=/.test(b.slice(0, 60))],
  ['dividers', b => /^\s*var DIVIDERS=/.test(b.slice(0, 40))],
  ['logos', b => /^\s*var BRAND_LOGOS=/.test(b.slice(0, 40))],
  ['engine', b => /Pure compute \+ PPTX\/XLSX builders/.test(b.slice(0, 900))],
  ['exporters', b => /EXPORTERS \(PPTX via PptxGenJS/.test(b.slice(0, 900))],
  ['parsers', b => /RUNTIME REFERENCE PARSERS/.test(b.slice(0, 900))],
  ['er_table', b => /^\s*window\.MF_ER_TABLE=/.test(b.slice(0, 40))],
  ['app_ui', b => /^\s*\(function\(\)\{\s*\n\s*var REF = window\.REFDATA, E = window\.ENGINE;/.test(b.slice(0, 80))],
  ['boot', b => /^\(function\(\)\{\s*\nfunction setLogo\(/.test(b.slice(0, 40))]
];
const APP_BLOCKS = ['engine', 'exporters', 'parsers', 'app_ui', 'boot'];
const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /\bEventSource\b/, /sendBeacon/, /\bimport\s*\(/,
  /https?:\/\//, /navigator\.serviceWorker/, /\bnew\s+Worker\s*\(/];
const ENGINE_KEYS = ['palette', 'FONT', 'amcDisplay', 'normalize', 'matchInstrument', 'matchPMS', 'resolveBench',
  'benchmarkFor', 'bucketDefs', 'parseBaseRows', 'computeReview', 'computeTaxation', 'taxClassOf', 'aiaCompute',
  'aiaWeights', 'aiaAmcCap', 'aiaOvBands', 'fmt', 'buildPPTX', 'buildXLSX', 'parsers'];
const PARSER_KEYS = ['parseEquitySide', 'parseDebtSide', 'parseMonitor', 'parseSIF', 'parsePMS', 'parseIRR', 'fmtDate',
  'parseAdditionalDebt', 'parseSOA'];
const REF_KEYS = ['FUND_RANKS', 'FUND_RANKS_META', 'FUND_MGR', 'FUND_MGR_META', 'TAX_RULES', 'DATA_DATES',
  'EQUITY_ANALYTICS', 'HYBRID_ANALYTICS', 'DEBT_ANALYTICS', 'MF_PERF', 'MF_PERF_DIRECT', 'PMS_PERF', 'AIF_PERF',
  'BENCHMARKS', 'BENCH_RET', 'STOCK_INFO', 'STOCK_RET', 'MF_RISK', 'MF_BENCHMARKS', 'MF_CAT_BM', 'SIF_PERF'];
const DATE_KEYS = ['analytics', 'performance', 'direct', 'ranks', 'fmgr', 'sif', 'risk'];

let fails = 0, warns = 0;
const pass = m => console.log('  PASS  ' + m);
const fail = m => { console.log('  FAIL  ' + m); fails++; };
const warn = m => { console.log('  WARN  ' + m); warns++; };
const check = (c, m) => (c ? pass(m) : fail(m));

const buf = fs.readFileSync(FILE);
const text = buf.toString('utf8');
console.log('\n=== file ===');
console.log('  INFO  ' + path.basename(FILE) + '  ' + buf.length.toLocaleString() + ' bytes  MD5 ' +
  crypto.createHash('md5').update(buf).digest('hex').toUpperCase());
const ei = process.argv.indexOf('--expect-md5');
if (ei >= 0) {
  const want = String(process.argv[ei + 1] || '').toUpperCase();
  check(crypto.createHash('md5').update(buf).digest('hex').toUpperCase() === want, 'MD5 equals the expected ' + want);
}
check(text.split('<script').length - 1 === 14, 'naive "<script" count is 14 (got ' + (text.split('<script').length - 1) + ')');
check(text.endsWith(TAIL), 'file tail and trailing newline preserved');
check(buf.indexOf(Buffer.from('\r\n')) < 0, 'no CRLF line endings (a line-ending conversion would change the file)');
check(!(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF), 'no UTF-8 byte-order mark');

/* ---- blocks, located exactly as engine-host.js locates them ---- */
const blocks = [];
{ const re = /<script([^>]*)>/g; let m;
  while ((m = re.exec(text))) { const e = text.indexOf('</script>', m.index); if (e < 0) break;
    blocks.push({ start: m.index, body: text.slice(m.index + m[0].length, e), end: e + 9 }); re.lastIndex = e; } }
console.log('\n=== script blocks ===');
check(blocks.length === 13, '13 real script blocks (got ' + blocks.length + ')');
const byName = {};
MARKERS.forEach(([name, test]) => {
  const hits = blocks.filter(b => test(b.body));
  check(hits.length === 1, 'block "' + name + '" found by its marker exactly once' + (hits.length === 1 ? '' : ' (found ' + hits.length + ')'));
  byName[name] = hits[0];
});

/* ---- compliance: no network in application code or page shell ---- */
console.log('\n=== no network calls (compliance) ===');
APP_BLOCKS.forEach(name => {
  const b = byName[name]; if (!b) return;
  const hits = NETWORK.filter(re => re.test(b.body)).map(String);
  check(hits.length === 0, name + ': no network API or remote URL' + (hits.length ? ' — found ' + hits.join(', ') : ''));
});
let shell = '', pos = 0;
blocks.forEach(b => { shell += text.slice(pos, b.start); pos = b.end; }); shell += text.slice(pos);
const remote = shell.match(/(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\/[^"'\s>]+|@import|url\(\s*["']?(?:https?:)?\/\//gi) || [];
check(remote.length === 0, 'page shell: no remote src / href / @import / url()' + (remote.length ? ' — found ' + remote.slice(0, 5).join(', ') : ''));

/* ---- engine surface ---- */
console.log('\n=== engine ===');
let H = null;
try { H = require('./engine-host.js').load(); pass('engine loads headlessly from index.html'); }
catch (e) { fail('engine loads headlessly: ' + (e && e.message)); }
if (H) {
  const miss = ENGINE_KEYS.filter(k => !(k in H.E));
  check(miss.length === 0, 'ENGINE exposes the documented surface' + (miss.length ? ' — missing ' + miss.join(', ') : ''));
  const pmiss = PARSER_KEYS.filter(k => typeof (H.E.parsers || {})[k] !== 'function');
  check(pmiss.length === 0, 'ENGINE.parsers exposes the documented parsers' + (pmiss.length ? ' — missing ' + pmiss.join(', ') : ''));
  check(H.E.aiaAmcCap === 20, 'AI Analyst AMC cap is 20 (got ' + H.E.aiaAmcCap + ')');
  check(H.E.FONT === 'Cambria', 'house font is Cambria (got ' + H.E.FONT + ')');
}

/* ---- reference data ---- */
console.log('\n=== reference data ===');
if (H) {
  const R = H.REF;
  const counts = REF_KEYS.map(k => {
    const v = R[k]; const n = v == null ? -1 : (Array.isArray(v) ? v.length : Object.keys(v).length);
    if (!(n > 0)) fail('REFDATA.' + k + ' present and non-empty (got ' + n + ')');
    return k + ' ' + n;
  });
  console.log('  INFO  ' + counts.join(' · '));
  const er = global.MF_ER_TABLE ? Object.keys(global.MF_ER_TABLE).length : 0;
  check(er > 10000, 'MF_ER_TABLE present (' + er + ' keys)');
  const dd = R.DATA_DATES || {};
  const bad = DATE_KEYS.filter(k => !/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d$/.test(dd[k] || ''));
  check(bad.length === 0 && Object.keys(dd).length === 7, 'DATA_DATES holds 7 dates' + (bad.length ? ' — bad: ' + bad.join(', ') : ''));
  console.log('  INFO  DATA_DATES ' + JSON.stringify(dd));

  /* look-through mixes: each must sum to 100 */
  const offs = [];
  const sumOf = o => Object.values(o || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
  const test = (blk, key, part, obj) => { if (!obj || !Object.keys(obj).length) return;
    const s = sumOf(obj); if (Math.abs(s - 100) > 0.05) offs.push({ where: blk + '.' + (part ? part + '.' : '') + key, s, name: obj.__n }); };
  Object.entries(R.EQUITY_ANALYTICS || {}).forEach(([n, e]) => ['mcap', 'sector'].forEach(k => e[k] && test('EQUITY_ANALYTICS', k, '', Object.assign(Object.create({ __n: n }), e[k]))));
  Object.entries(R.HYBRID_ANALYTICS || {}).forEach(([n, e]) => {
    ['mcap', 'sector'].forEach(k => e.eq && e.eq[k] && test('HYBRID_ANALYTICS', k, 'eq', Object.assign(Object.create({ __n: n }), e.eq[k])));
    ['sector', 'rating'].forEach(k => e.db && e.db[k] && test('HYBRID_ANALYTICS', k, 'db', Object.assign(Object.create({ __n: n }), e.db[k])));
  });
  Object.entries(R.DEBT_ANALYTICS || {}).forEach(([n, e]) => ['sector', 'rating'].forEach(k => e[k] && test('DEBT_ANALYTICS', k, '', Object.assign(Object.create({ __n: n }), e[k]))));
  const hard = offs.filter(o => Math.abs(o.s - 100) > 0.5);
  check(hard.length === 0, 'market-cap / sector / rating look-throughs sum to 100 (none off by more than 0.5)' +
    (hard.length ? ' — ' + hard.slice(0, 5).map(o => o.where + ' ' + o.s.toFixed(3) + ' [' + o.name + ']').join('; ') : ''));
  offs.filter(o => Math.abs(o.s - 100) <= 0.5).forEach(o => warn(o.where + ' sums to ' + o.s.toFixed(3) + ' [' + o.name + ']'));
}

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'all invariants hold') + (warns ? ', ' + warns + ' warning(s)' : ''));
process.exit(fails ? 1 : 0);
