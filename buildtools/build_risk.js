/* ============================================================================
   build_risk.js — MF_RISK from "Fund Risk Ratios & 3Y Rolling - All Funds".

   The vendor sheet is the MF Analysis tab's whole input: nine metrics per fund
   plus the 3Y rolling average. It carries NO category column, and `cat` drives
   the tab's universe averages and the AI Analyst's peer tables — so `cat` is
   carried forward from the embedded block and 100% coverage is asserted, not
   assumed. A fund the embedded block does not know would be dropped rather
   than given a guessed category; the count is reported either way.

   Units: every metric is stored exactly as published except `3Y Rolling`,
   which the sheet states in percent while the tab renders `r3y` through
   pct() (= v*100). It is divided by 100 here. A "-" is a real absence
   (fewer than 250 NAV days in the window) and becomes null, never 0.

     node buildtools/build_risk.js --src "<xlsx>" [--out <json>] [--report]
   ========================================================================== */
'use strict';
const fs = require('fs'); const path = require('path');
const X = require('./xlsx-embedded.js');
const ROOT = path.join(__dirname, '..');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SRC = arg('--src'); const OUT = arg('--out', path.join(__dirname, 'out', 'mf_risk_aug2026.json'));
if (!SRC) throw new Error('--src <xlsx> is required');

/* ---------- embedded block (source of `cat`, and the before/after basis) ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rs = html.indexOf('window.REFDATA = '); const re = html.indexOf(';</script>', rs);
const REF = JSON.parse(html.slice(rs + 'window.REFDATA = '.length, re));
const OLD = REF.MF_RISK || {};

/* ---------- read ---------- */
const wb = X.read(fs.readFileSync(SRC), { type: 'buffer', cellDates: true });
const SH = 'Risk Ratios & 3Y Rolling', FL = 'Data Flags';
if (wb.SheetNames.indexOf(SH) < 0) throw new Error('sheet "' + SH + '" not found; got ' + wb.SheetNames.join(' | '));
const aoa = X.utils.sheet_to_json(wb.Sheets[SH], { header: 1, raw: true });

/* header by name, never by index — the vendor has moved columns before */
const hRow = aoa.findIndex(r => String((r || [])[0] || '').trim().toLowerCase() === 'fund name');
if (hRow < 0) throw new Error('no "Fund Name" header row');
const hdr = aoa[hRow].map(c => String(c == null ? '' : c).trim().toLowerCase());
const col = (...names) => { for (const n of names) { const i = hdr.indexOf(n.toLowerCase()); if (i >= 0) return i; } throw new Error('column not found: ' + names[0]); };
const C = { beta: col('Beta'), sd: col('SD (Ann.)', 'SD'), alpha: col('Alpha'), sortino: col('Sortino'), sharpe: col('Sharpe'), corr: col('Corr.', 'Corr'), ir: col('Info Ratio'), dc: col('Down Cap.', 'Down Cap'), r3y: col('3Y Rolling') };

/* the as-on date is stated in the title row; parsed, never assumed from the filename */
const title = String((aoa[0] || [])[0] || '');
const mDate = /\(AS ON\s+(\d{1,2})-([A-Za-z]{3})-(\d{4})\)/i.exec(title);
const asOn = mDate ? (mDate[1] + ' ' + mDate[2].charAt(0).toUpperCase() + mDate[2].slice(1).toLowerCase() + ' ' + mDate[3]) : '';
if (!asOn) throw new Error('could not read the as-on date from the title row: ' + title);

const isDash = v => v === '-' || v === '—' || (typeof v === 'string' && !v.trim());
const num = v => { if (v == null || isDash(v)) return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? null : n; };
const r6 = v => v == null ? null : Math.round(v * 1e6) / 1e6;

/* ---------- build ---------- */
const MF_RISK = {}, rep = { asOn, rows: 0, dropped: [], noCat: [], metrics: {}, r3y: 0 };
for (let i = hRow + 1; i < aoa.length; i++) {
  const r = aoa[i] || []; const name = String(r[0] == null ? '' : r[0]).trim();
  if (!name) continue;
  rep.rows++;
  const prev = OLD[name];
  if (!prev || !prev.cat) { (prev ? rep.noCat : rep.dropped).push(name); if (!prev) continue; }
  const rec = { cat: prev.cat };
  for (const k of ['beta', 'sd', 'alpha', 'sortino', 'sharpe', 'corr', 'ir', 'dc']) {
    const v = num(r[C[k]]); rec[k] = v; if (v != null) rep.metrics[k] = (rep.metrics[k] || 0) + 1;
  }
  const roll = num(r[C.r3y]);                       /* stated in percent; the tab renders v*100 */
  rec.r3y = roll == null ? null : r6(roll / 100);
  if (rec.r3y != null) rep.r3y++;
  MF_RISK[name] = rec;
}

/* ---------- Data Flags: cross-check the carried category, carry nothing else ---------- */
const flags = { rows: 0, catAgree: 0, catDisagree: [], kinds: {}, unreliable: [] };
if (wb.SheetNames.indexOf(FL) >= 0) {
  const g = X.utils.sheet_to_json(wb.Sheets[FL], { header: 1, raw: true });
  const gh = g.findIndex(r => String((r || [])[0] || '').trim().toLowerCase() === 'fund name');
  for (let i = gh + 1; i < g.length; i++) {
    const r = g[i] || []; const n = String(r[0] == null ? '' : r[0]).trim(); if (!n) continue;
    flags.rows++;
    const cat = String(r[1] == null ? '' : r[1]).trim(), kind = String(r[4] == null ? '' : r[4]).trim();
    if (kind) flags.kinds[kind] = (flags.kinds[kind] || 0) + 1;
    if (MF_RISK[n] && cat) { if (MF_RISK[n].cat === cat) flags.catAgree++; else flags.catDisagree.push(n + ': file "' + cat + '" vs carried "' + MF_RISK[n].cat + '"'); }
    /* a flagged fund that still carries numbers — published, so kept, but worth naming */
    if (MF_RISK[n] && MF_RISK[n].beta != null && !/<250 days/.test(kind)) flags.unreliable.push(n + ' — ' + kind);
  }
}

/* ---------- assertions ---------- */
const keys = Object.keys(MF_RISK);
if (!keys.length) throw new Error('no fund rows parsed');
if (rep.dropped.length) throw new Error(rep.dropped.length + ' fund(s) are not in the embedded block, so have no category: ' + rep.dropped.slice(0, 5).join(' | '));
if (rep.noCat.length) throw new Error(rep.noCat.length + ' fund(s) carried no category');
if (flags.catDisagree.length) throw new Error('Data Flags category disagrees with the carried category:\n  ' + flags.catDisagree.slice(0, 5).join('\n  '));
const counts = Object.keys(rep.metrics).map(k => rep.metrics[k]);
if (new Set(counts).size !== 1) console.warn('  note: metric coverage is uneven across columns: ' + JSON.stringify(rep.metrics));
keys.forEach(k => { const o = MF_RISK[k];
  if (o.r3y != null && Math.abs(o.r3y) > 1.5) throw new Error('r3y out of fraction range for ' + k + ': ' + o.r3y);
  if (o.corr != null && Math.abs(o.corr) > 1.0001) throw new Error('corr out of range for ' + k + ': ' + o.corr);
  if (o.sd != null && o.sd <= 0) throw new Error('non-positive SD for ' + k); });

/* ---------- report against the embedded block ---------- */
const onlyNew = keys.filter(k => !OLD[k]), onlyOld = Object.keys(OLD).filter(k => !MF_RISK[k]);
const M = ['beta', 'sd', 'alpha', 'sortino', 'sharpe', 'corr', 'ir', 'dc', 'r3y'];
const delta = {}; M.forEach(m => { let gained = 0, lost = 0, same = 0, moved = 0, big = [];
  keys.forEach(k => { if (!OLD[k]) return; const a = OLD[k][m], b = MF_RISK[k][m];
    if (a == null && b != null) gained++; else if (a != null && b == null) lost++;
    else if (a != null && b != null) { if (a === b) same++; else { moved++; const d = Math.abs(a - b); if (d > (m === 'r3y' ? 0.05 : m === 'dc' ? 15 : m === 'alpha' || m === 'ir' ? 5 : 0.5)) big.push(k + ' ' + a + '->' + b); } } });
  delta[m] = { gained, lost, unchanged: same, changed: moved, large: big.length, egLarge: big.slice(0, 2) }; });

console.log('source      : ' + path.basename(SRC));
console.log('as on       : ' + asOn + '   (from the sheet title)');
console.log('rows        : ' + rep.rows + ' -> ' + keys.length + ' records   onlyNew ' + onlyNew.length + '  onlyOld(dropped) ' + onlyOld.length);
console.log('coverage    : ' + JSON.stringify(rep.metrics) + '  r3y ' + rep.r3y);
console.log('was         : ' + JSON.stringify(M.reduce((a, m) => (a[m] = Object.keys(OLD).filter(k => OLD[k][m] != null).length, a), {})));
console.log('flags       : ' + flags.rows + ' rows, category agrees on ' + flags.catAgree + ', disagrees on ' + flags.catDisagree.length);
Object.keys(flags.kinds).forEach(k => console.log('              ' + String(flags.kinds[k]).padStart(4) + '  ' + k));
console.log('per-metric change vs embedded:');
M.forEach(m => console.log('  ' + m.padEnd(8) + JSON.stringify(delta[m])));
if (process.argv.indexOf('--report') >= 0) {
  console.log('\nflagged funds that still carry numbers (published as-is, shown on the tab):');
  flags.unreliable.forEach(u => console.log('  ' + u));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
/* `blocks` is what splice_refresh.js reads. DATA_DATES.risk captions the MF Analysis tab, which
   used to borrow DATA_DATES.performance and so labelled last month's ratios with the monitor date
   whenever the two issues arrived at different vintages (Sep 2026: monitor 30 Sep, ratios 31 Aug). */
const DATA_DATES = Object.assign({}, REF.DATA_DATES, { risk: asOn });
fs.writeFileSync(OUT, JSON.stringify({ asOn, MF_RISK, blocks: { MF_RISK, DATA_DATES }, report: { rep, flags, delta } }, null, 0));
console.log('\nwrote ' + path.relative(ROOT, OUT) + ' (' + fs.statSync(OUT).size.toLocaleString() + ' bytes)');
