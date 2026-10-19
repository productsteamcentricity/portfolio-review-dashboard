/* ============================================================================
   KI-063 (audit NEW-17) — "Apply plan to Portfolio Rebalancing" wrote only part
   of the release when a scheme is held in several plans or by several clients.

   The AI Analyst merges a scheme's holdings into ONE position under its vendor
   key (07_engine aiaPositions): the Regular and Direct plans, and the same
   scheme held by several clients. A merged position is named after the vendor
   key, and its releasePct is a share of the merged CMV. The Rebalancing tab has
   one row per holding name (11_app_ui rbFundIndex). The apply looked up only
   the position's own name, so a Direct sibling got no plan, and a merged
   position whose name is no row's name was dropped entirely.

   Known answers, computed here straight from model.holdings and the plan:
     - after the apply, the Rebalancing tab releases, for every acting
       position, each member holding's own CMV x the position's releasePct
       (an Exit: 100%), exactly; and that total equals the AI plan's released
       total to within the plan's own rounding (each release to 0.01 Cr, so an
       Exit, which the tab redeems in full, is up to 0.005 Cr apart; each
       releasePct to 0.01% of the position, so a partial is up to 0.005% of its
       value apart; the total to 0.01 Cr). The redeployed amounts reconcile the
       same way, allowing for the 0.1% rounding of each destination's share.
     - a Partial Rebalance written to several rows states, on each row, that
       row's own release (the CMV of the holdings carrying that row's name x
       releasePct, within the 0.01 display rounding of the file's unit) and its
       %, and the position's release only as "the combined total"; the stated
       row amounts add up to the position's release within display rounding
       plus the plan's releasePct rounding. Every other row keeps the engine's
       text unchanged.
     - the status line counts the rows written (distinct member names) and the
       holdings (positions) they belong to, and the releasing rows and holdings,
       the latter equal to the AI tab's "released across N holdings".

   Cases
     V0  the sample as built (tools/make-sample-base.js): one scheme held by two
         clients under its vendor name (worked before the fix; a control)
     (a) Regular + Direct siblings of four schemes; (a-L) the same book shown
         in Lakh (rationale and status figures in the file's unit)
     (b) a Direct-only scheme held by two clients
     (c) a two-client scheme whose base-file name differs from the vendor key
     (d) a member with no rebalancing row is named in the status line, and the
         released totals are reported as different
     (e) a row narrowed to one client is reset to all clients (the release is a
         share of every client's holding), and the apply asks before doing so
     (f) the reconciliation the "Applied" badge uses notices a later edit,
         including one far below the plan's rounding (it is exact)
     (g) Exit of merged Regular + Direct positions held by two clients, built
         as tools/test-ai-analyst.js builds weak-fund fixtures (real reference
         schemes with the weakest Centricity ranks, XIRR below BMXIRR); the
         rounding gap is larger than the 0.005 Cr base, so the per-Exit term of
         the bounded comparison is exercised

   UI-BLOCK NOTE: aiaApplyToRebal and the Rebalancing tab's row and summary code
   live in the UI script (11_app_ui), which Node cannot load (it needs the DOM).
   This test cuts them out of the SHIPPED index.html by anchor:
     rbNorm .. rbBaseCr       'function rbNorm('          -> 'function rbPerfIndex('
     rbBuildRows, rbSummary   'function rbBuildRows('     -> 'function rbBoxAgg('
     aiaEsc, aiaCr            'function aiaEsc('          -> 'function aiaPP('
     aiaApplyToRebal and the helpers after it (aiaRebalCheck, aiaRowRecText)
                              'function aiaApplyToRebal(' -> 'function renderTaxation('
   and evaluates them with stubs: model (built by the shipped engine), the
   REBAL_* state, renderRebal (rebuilds the fund index and the rows exactly as
   the real one does before it paints), renderAIAnalyst (no-op), setStatus
   (captured) and window.confirm (answers yes, and is recorded).

     node tools/regression/KI-063-apply-plan.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const host = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = host.load();
const { XLSX, E, REF } = H;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const f4 = v => (v == null || isNaN(v)) ? String(v) : Number(v).toFixed(4);

/* ---------------- the shipped UI code, cut out by anchor ---------------- */
const html = fs.readFileSync(path.join(host.ROOT, 'index.html'), 'utf8');
function cut(from, to) {
  const a = html.indexOf(from);
  if (a < 0 || html.indexOf(from, a + 1) >= 0) throw new Error('anchor not found exactly once: ' + from);
  const b = html.indexOf(to, a + from.length);
  if (b < 0) throw new Error('end anchor "' + to + '" not found after "' + from + '"');
  return html.slice(a, b);
}
const SRC = [
  cut('function rbNorm(', 'function rbPerfIndex('),
  cut('function rbBuildRows(', 'function rbBoxAgg('),
  cut('function aiaEsc(', 'function aiaPP('),
  cut('function aiaApplyToRebal(', 'function renderTaxation(')
].join('\n');

const PRELUDE = [
  'var model = null, REBAL_STATE = {}, REBAL_FUNDS = null, REBAL_ROWS = [], REBAL_TAG = null, REBAL_NEW = [];',
  'var _aiaSyncing = false, STATUS = [], CONFIRMS = [];',
  'var window = { confirm: function(m){ CONFIRMS.push(m); return true; } };',
  'function setStatus(msg, warn){ STATUS.push({ msg: String(msg), warn: !!warn }); }',
  'function renderAIAnalyst(){}',
  '/* what the real renderRebal does before it paints (11_app_ui renderRebal) */',
  'function renderRebal(){',
  '  var tag = rbTag();',
  '  if (tag !== REBAL_TAG){ REBAL_TAG = tag; REBAL_STATE = {}; REBAL_NEW = []; }',
  '  REBAL_FUNDS = rbFundIndex(); REBAL_ROWS = rbBuildRows();',
  '}'
].join('\n');
const API = [
  'return {',
  '  load: function(m){ model = m; REBAL_STATE = {}; REBAL_FUNDS = null; REBAL_ROWS = []; REBAL_TAG = null;',
  '                     REBAL_NEW = []; STATUS.length = 0; CONFIRMS.length = 0; window.__AIA_APPLIED = null; },',
  '  apply: function(P){ aiaApplyToRebal(P); },',
  '  render: function(){ renderRebal(); },',
  '  state: function(){ return REBAL_STATE; },',
  '  funds: function(){ return REBAL_FUNDS; },',
  '  rows: function(){ return rbBuildRows(); },',
  '  summary: function(){ return rbSummary(rbBuildRows()); },',
  '  key: function(name){ return rbKey({ name: name }); },',
  '  lastStatus: function(){ return STATUS.length ? STATUS[STATUS.length - 1] : null; },',
  '  confirms: function(){ return CONFIRMS.length; },',
  '  check: (typeof aiaRebalCheck === "function") ? function(P){ return aiaRebalCheck(P); } : null',
  '};'
].join('\n');
const UI = new Function(PRELUDE + '\n' + SRC + '\n' + API)();

/* ---------------- the synthetic book and its variants ---------------- */
const fx = build(H);
const wb = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
const BASE = XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true });
const HDR = BASE[0], C = n => HDR.indexOf(n);
const META = { familyName: 'Probe Family', asOnDate: '30 Sep 2026' };
const A = 'Sample Client A', B = 'Sample Client B';
const clone = a => a.map(r => r.slice());
const rowOf = (aoa, cli, nm) => aoa.findIndex((r, i) => i && r[C('Client Name')] === cli && r[C('Instrument Name')] === nm);

/* the scheme the book holds for both clients (its vendor name), and three more held once */
const counts = {}; fx.book.forEach(h => { counts[h.name] = (counts[h.name] || 0) + 1; });
const SHARED = Object.keys(counts).find(n => counts[n] === 2 && fx.book.some(h => h.name === n && h.product === 'Mutual Funds'));
const byIdx = i => fx.book[i].name;                       /* 1 = flexi (A), 2 = debt (A), 9 = debt (B) */
const stem = n => String(n).replace(/-Reg\(G\)\s*$/i, '').replace(/\(G\)\s*$/i, '');
const directOf = n => stem(n) + '(G)-Direct Plan';
const longOf = n => stem(n) + ' - Regular Plan - Growth';

function sibling(row, newName, scale) {
  const r = row.slice(); r[C('Instrument Name')] = newName;
  ['Units', 'Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)', 'Invested Value (Cr.)',
    'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)', 'Allocation (%)']
    .forEach(n => { const i = C(n); if (i >= 0 && typeof r[i] === 'number') r[i] = Math.round(r[i] * scale * 1e4) / 1e4; });
  r[C('Folio No')] = String(r[C('Folio No')]) + '-D';
  return r;
}
function variantA() {
  const a = clone(BASE);
  [[A, SHARED], [A, byIdx(2)], [B, byIdx(9)], [A, byIdx(1)]].forEach(([cli, nm]) => {
    const i = rowOf(a, cli, nm); if (i < 0) throw new Error('fixture: no row ' + cli + ' / ' + nm);
    a.push(sibling(a[i], directOf(nm), 0.5));
  });
  return a;
}
function renamed(newName) {
  const a = clone(BASE);
  a.forEach((r, i) => { if (i && r[C('Instrument Name')] === SHARED) r[C('Instrument Name')] = newName; });
  return a;
}
/* unitHint: the display unit of the model ('L' shows the same Cr arithmetic in Lakh) */
function review(aoa, unitHint) {
  const rows = E.parseBaseRows(aoa);
  if (unitHint) rows.unitHint = unitHint;
  const model = E.computeReview(rows, REF, META);
  const P = E.aiaCompute(model, REF, {});
  return { model, P };
}

/* ---------------- the independent answers ---------------- */
const ACTING = r => r.action === 'Exit' || r.action === 'Partial Rebalance' || r.action === 'Top-Up';
const memCmv = (model, r) => {
  const mine = new Set(r.members.map(m => m.client + '\u0001' + m.name));
  return model.holdings.filter(h => mine.has(h.client + '\u0001' + h.name)).reduce((s, h) => s + (h.cmvCr || 0), 0);
};
function expected(model, P) {
  let tab = 0, tol = 0.005 + 1e-9, tolDep = 0.005 + 1e-9, relSum = 0;
  P.recs.forEach(r => {
    if (!ACTING(r)) return;
    const pct = r.action === 'Exit' ? 100 : r.releasePct;
    tab += memCmv(model, r) * pct / 100;
    relSum += r.release;
    const t = r.action === 'Exit' ? 0.005 : ((r.cmv || 0) + 0.005) * 0.00005;
    tol += t;
    tolDep += t * 1.01 + ((r.release || 0) + t) * 0.0005 * (r.destinations || []).length;
  });
  return { tab, tol, tolDep, relSum };
}
/* the rows a position is written to: its members' distinct names, as the tab keys them */
const rowKeys = r => Array.from(new Set((r.members.length ? r.members : [{ name: r.name }]).map(m => UI.key(m.name))));
function rowsWithoutPlan(P) {
  const st = UI.state(), bad = [];
  P.recs.forEach(r => (r.members.length ? r.members : [{ name: r.name, client: r.client }]).forEach(m => {
    const s = st[UI.key(m.name)];
    const pct = r.action === 'Retain' ? 0 : Math.max(0, Math.min(100, r.releasePct));
    if (!s || s.action !== r.action || s.pctAlloc !== pct || s.client != null) bad.push(m.client + ': ' + m.name);
  }));
  return bad;
}
/* the status line's counts: rows written (distinct member names) for holdings (positions),
   and the releasing ones, which must equal the AI tab's "released across N holdings" */
function statusCounts(label, P, st) {
  const all = new Set(), rel = new Set();
  P.recs.forEach(r => rowKeys(r).forEach(k => { all.add(k); if (ACTING(r)) rel.add(k); }));
  const nRelPos = P.recs.filter(ACTING).length;
  const m1 = st ? /<b>(\d+)<\/b> rows? written for <b>(\d+)<\/b> holdings?/.exec(st.msg) : null;
  const m2 = st ? /\(<b>(\d+)<\/b> rows? for the <b>(\d+)<\/b> holdings? that releases? money\)/.exec(st.msg) : null;
  ok(!!(m1 && +m1[1] === all.size && +m1[2] === P.recs.length),
    label + ': the status line counts ' + all.size + ' rows written for ' + P.recs.length + ' holdings' +
    (m1 ? ' (says ' + m1[1] + ' for ' + m1[2] + ')' : ' (no count in "' + (st ? st.msg : '') + '")'));
  ok(!!(m2 && +m2[1] === rel.size && +m2[2] === nRelPos && nRelPos === P.summary.sources),
    label + ': ...and ' + rel.size + ' releasing rows for the ' + P.summary.sources + ' holdings the AI tab says release' +
    (m2 ? ' (says ' + m2[1] + ' for ' + m2[2] + ')' : ' (not stated)'));
}
function reconcile(label, model, P) {
  const x = expected(model, P), s = UI.summary(), sm = P.summary, st = UI.lastStatus();
  ok(Math.abs(x.relSum - sm.released) <= 1e-6,
    label + ': the plan\'s positions release its stated total (' + f4(x.relSum) + ' vs ' + f4(sm.released) + ' Cr)');
  const bad = rowsWithoutPlan(P);
  ok(bad.length === 0, label + ': every member holding\'s own row carries its position\'s action and release %, for all clients' +
    (bad.length ? ' — missing: ' + bad.join(' | ') : ''));
  ok(Math.abs(s.released - x.tab) <= 1e-9,
    label + ': tab released = sum of member CMV x releasePct (' + f4(s.released) + ' vs ' + f4(x.tab) + ' Cr)');
  ok(Math.abs(s.released - sm.released) <= x.tol,
    label + ': tab released reconciles with the AI plan within rounding (' + f4(s.released) + ' vs ' + f4(sm.released) +
    ' Cr, |diff| ' + f4(Math.abs(s.released - sm.released)) + ' <= ' + f4(x.tol) + ')');
  ok(Math.abs(s.proposed - sm.deployed) <= x.tolDep,
    label + ': tab proposed reconciles with the AI plan\'s redeployed total (' + f4(s.proposed) + ' vs ' + f4(sm.deployed) +
    ' Cr, |diff| ' + f4(Math.abs(s.proposed - sm.deployed)) + ' <= ' + f4(x.tolDep) + ')');
  ok(st && st.warn === false && !/no rebalancing row/.test(st.msg),
    label + ': the status line reports a clean apply' + (st ? '' : ' (no status line)') + (st && st.warn ? ' — "' + st.msg + '"' : ''));
  statusCounts(label, P, st);
  const c = UI.check ? UI.check(P) : null;
  ok(!!(c && c.ok === true && c.agrees === true), label + ': the reconciliation the "Applied" badge uses agrees, exactly and to rounding' +
    (UI.check ? (c ? ' (tab ' + f4(c.tab) + ', rows written ' + f4(c.want) + ', plan ' + f4(c.ai) + ')' : ' (returned null)') :
      ' (aiaRebalCheck is not in the build)'));
}

/* ---- the rationale written to each row ----
   Display rounding of the file's unit: U.m shows 0.01 of the unit, i.e. 0.005 Cr or 0.005 L. */
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function money(model, cr) {                       /* how the file's unit writes an amount, built here */
  const L = model.unit && model.unit.code === 'L';
  return '₹' + (Math.round(cr * (L ? 100 : 1) * 100) / 100).toFixed(2) + (L ? ' L' : ' Cr');
}
function rationaleChecks(label, model, P, needMulti) {
  const L = model.unit && model.unit.code === 'L', half = (L ? 0.005 / 100 : 0.005) + 1e-9;
  const st = UI.state(), unchanged = [];
  let multi = 0;
  P.recs.forEach(r => {
    const keys = rowKeys(r);
    const kept = r.rationale.filter(x => x.kind !== 'destination');
    const orig = kept.map(x => x.text).join(' ');
    if (!(r.action === 'Partial Rebalance' && keys.length > 1)) {
      keys.forEach(k => { if (!st[k] || st[k].rationale !== orig) unchanged.push(r.name + ' / ' + k); });
      return;
    }
    multi++;
    if (multi === 1) keys.forEach(k => console.log('      ' + k + ': "' + (st[k] ? String(st[k].rationale).slice(0, 260) : '(no row)') + '"'));
    const rec = kept.find(x => x.kind === 'recommendation');
    const rest = kept.filter(x => x !== rec).map(x => x.text).join(' ');
    const relTxt = money(model, r.release);
    let stated = 0;
    const bad = [];
    keys.forEach(k => {
      const t = st[k] ? String(st[k].rationale) : '';
      const want = model.holdings.filter(h => UI.key(h.name) === k).reduce((s, h) => s + (h.cmvCr || 0), 0) * r.releasePct / 100;
      const m = /^Reduce by ₹([\d.]+) (Cr|L) \(([\d.]+)% of this holding\)\. /.exec(t);
      if (!m) { bad.push(k + ': does not open with its own release ("' + t.slice(0, 80) + '")'); return; }
      const amtCr = Number(m[1]) / (m[2] === 'L' ? 100 : 1);
      stated += amtCr;
      if ((m[2] === 'L') !== L) bad.push(k + ': amount in ' + m[2] + ', the file is in ' + (L ? 'L' : 'Cr'));
      if (Math.abs(amtCr - want) > half) bad.push(k + ': states ' + f4(amtCr) + ' Cr, its own release is ' + f4(want) + ' Cr');
      if (Math.abs(Number(m[3]) - r.releasePct) > 1e-9) bad.push(k + ': states ' + m[3] + '%, the row\'s % is ' + r.releasePct);
      if (rec && t.indexOf(rec.text) >= 0) bad.push(k + ': still carries the position\'s clause "' + rec.text + '"');
      if (new RegExp('Reduce by ' + reEsc(relTxt) + '\\b').test(t) || new RegExp('Reduce by ' + reEsc(money({ unit: { code: 'Cr' } }, r.release)) + '\\b').test(t))
        bad.push(k + ': presents the position\'s ' + relTxt + ' as its own');
      const ci = t.indexOf('combined total reduction is ' + relTxt);
      if (ci < 0) bad.push(k + ': does not give ' + relTxt + ' as the combined total');
      if (t.split(relTxt).length - 1 !== (ci >= 0 ? 1 : 0)) bad.push(k + ': states ' + relTxt + ' other than as the combined total');
      if (rest && !t.endsWith(' ' + rest)) bad.push(k + ': the other clauses are not carried over unchanged');
    });
    ok(bad.length === 0, label + ': ' + r.name + ' (' + keys.length + ' rows): each row states its own release and %, and ' +
      relTxt + ' only as the combined total' + (bad.length ? ' — ' + bad.join(' | ') : ''));
    const bound = keys.length * half + ((r.cmv || 0) + 0.005) * 0.00005 + 1e-9;
    ok(Math.abs(stated - r.release) <= bound, label + ': ' + r.name + ': the rows\' stated releases add up to the position\'s (' +
      f4(stated) + ' vs ' + f4(r.release) + ' Cr, |diff| ' + f4(Math.abs(stated - r.release)) + ' <= ' + f4(bound) + ')');
  });
  if (needMulti) ok(multi >= 1, label + ': fixture: at least one Partial Rebalance is written to more than one row (' + multi + ')');
  ok(unchanged.length === 0, label + ': single-row, Exit and Retain rows keep the engine\'s rationale unchanged' +
    (unchanged.length ? ' — changed: ' + unchanged.join(' | ') : ''));
}
function findRec(P, pred) { return P.recs.find(r => (r.members || []).some(pred)); }

/* ---------------- V0: control ---------------- */
console.log('\n=== V0 the sample as built: ' + SHARED + ' held by both clients ===');
{
  const { model, P } = review(clone(BASE));
  const r = findRec(P, m => m.name === SHARED);
  ok(!!(r && r.merged && ACTING(r) && r.members.length === 2),
    'fixture: the two-client position is merged and acted on (' + (r ? r.action + ', ' + r.members.length + ' members' : 'not found') + ')');
  UI.load(model); UI.apply(P);
  reconcile('V0', model, P);
  rationaleChecks('V0', model, P, false);
}

/* ---------------- (a) Regular + Direct siblings ---------------- */
[['(a)', 'Cr', null], ['(a-L)', 'Lakh', 'L']].forEach(([lab, unitName, hint]) => {
  console.log('\n=== ' + lab + ' Regular + Direct siblings at half the CMV, shown in ' + unitName + ' ===');
  const { model, P } = review(variantA(), hint);
  const r = findRec(P, m => m.name === directOf(SHARED));
  ok(!!(r && r.merged && ACTING(r) && r.members.some(m => m.name === SHARED)) && model.unit.code === (hint || 'Cr'),
    'fixture: ' + directOf(SHARED) + ' merges with its Regular plan into an acting position (' +
    (r ? r.action + ', ' + r.members.length + ' members' : 'not found') + '), unit ' + model.unit.code);
  UI.load(model); UI.apply(P);
  reconcile(lab, model, P);
  rationaleChecks(lab, model, P, true);
});

/* ---------------- (b) Direct only, two clients ---------------- */
console.log('\n=== (b) a Direct-only scheme held by two clients ===');
{
  const D = directOf(SHARED);
  const { model, P } = review(renamed(D));
  const r = findRec(P, m => m.name === D);
  ok(!!(r && r.merged && ACTING(r) && r.members.length === 2 && r.members.every(m => m.name === D) && r.name !== D),
    'fixture: the position is named by its vendor key, which is no row\'s name (' + (r ? '"' + r.name + '", ' + r.action : 'not found') + ')');
  UI.load(model); UI.apply(P);
  reconcile('(b)', model, P);
  rationaleChecks('(b)', model, P, false);
}

/* ---------------- (c) two clients, name differs from the vendor key ---------------- */
console.log('\n=== (c) a two-client scheme whose base-file name differs from the vendor key ===');
{
  const L = longOf(SHARED);
  const { model, P } = review(renamed(L));
  const r = findRec(P, m => m.name === L);
  ok(!!(r && r.merged && ACTING(r) && r.members.length === 2 && r.name !== L),
    'fixture: "' + L + '" resolves to the vendor key and is merged (' + (r ? '"' + r.name + '", ' + r.action : 'not found') + ')');
  UI.load(model); UI.apply(P);
  reconcile('(c)', model, P);
}

/* ---------------- (d) a member with no row ---------------- */
console.log('\n=== (d) a member with no rebalancing row (stale fund index) ===');
{
  const D = directOf(SHARED);
  const { model, P } = review(variantA());
  UI.load(model); UI.render();
  const k = UI.key(D);
  ok(!!UI.funds().byKey[k], 'fixture: the Direct row exists before it is removed from the index');
  delete UI.funds().byKey[k];                       /* the tab's index lacks this row */
  UI.apply(P);
  const st = UI.lastStatus() || { msg: '', warn: false };
  ok(st.warn === true && st.msg.indexOf(D) >= 0 && /no rebalancing row/.test(st.msg),
    '(d): the status line names the member with no row as a warning — "' + st.msg + '"');
  const s = UI.summary(), x = expected(model, P);
  ok(s.released < P.summary.released - x.tol, '(d): the tab really is short of the plan (' + f4(s.released) + ' vs ' + f4(P.summary.released) + ' Cr)');
  ok(/Rebalancing tab releases/.test(st.msg) && st.msg.indexOf(money(model, s.released)) >= 0 && st.msg.indexOf(money(model, P.summary.released)) >= 0,
    '(d): the status line warns that the two released totals differ, with both figures');
  const c = UI.check ? UI.check(P) : null;
  /* the apply re-renders the tab, which rebuilds the index: the Direct row is back, without a plan */
  ok(!!(c && c.ok === false && c.agrees === false && c.want - c.tab > x.tol),
    '(d): the reconciliation the "Applied" badge uses reports the gap, exactly and to rounding' +
    (c ? ' (tab ' + f4(c.tab) + ', rows of the plan ' + f4(c.want) + ', plan ' + f4(c.ai) + ')' : ''));
  const reg = UI.state()[UI.key(SHARED)], r = findRec(P, m => m.name === D);
  ok(!!(reg && r && reg.action === r.action && reg.pctAlloc === r.releasePct), '(d): the members that do have a row are still written');
}

/* ---------------- (e) a row narrowed to one client ---------------- */
console.log('\n=== (e) a row narrowed to one client before the apply ===');
{
  const { model, P } = review(clone(BASE));
  UI.load(model); UI.render();
  const k = UI.key(SHARED);
  UI.state()[k] = { action: 'Retain', client: A, pctAlloc: 100, proposed: [], rationale: '', rationaleEdited: false };
  UI.apply(P);
  ok(UI.confirms() === 1, '(e): the apply asks before overwriting a client choice (' + UI.confirms() + ' confirmation(s))');
  ok(UI.state()[k] && UI.state()[k].client === null, '(e): the row is reset to all clients');
  reconcile('(e)', model, P);
}

/* ---------------- (f) a later edit on the tab ---------------- */
console.log('\n=== (f) the badge reconciliation notices a later edit ===');
{
  const { model, P } = review(clone(BASE));
  UI.load(model); UI.apply(P);
  const c0 = UI.check ? UI.check(P) : null;
  ok(!!(c0 && c0.ok), '(f): agrees straight after the apply');
  const st = UI.state()[UI.key(SHARED)];
  const keep = st ? st.pctAlloc : null;
  if (st) st.pctAlloc = keep / 2;
  UI.render();
  const c1 = UI.check ? UI.check(P) : null;
  ok(!!(c1 && c1.ok === false && c1.tab < c1.ai), '(f): reports the gap once a row is halved on the tab' +
    (c1 ? ' (tab ' + f4(c1.tab) + ' vs plan ' + f4(c1.ai) + ')' : ''));
  /* one hundredth of a percentage point on one row: far below the plan's rounding */
  const fe = UI.funds().byKey[UI.key(SHARED)];
  if (st) st.pctAlloc = keep - 0.01;
  UI.render();
  const c2 = UI.check ? UI.check(P) : null;
  const moved = fe ? fe.totalCmvCr * 0.0001 : NaN;
  ok(!!(c2 && c2.ok === false && c2.agrees === true && Math.abs((c2.want - c2.tab) - moved) <= 1e-9),
    '(f): the badge is exact: a 0.01-point edit (' + f4(moved) + ' Cr) turns it off, though the rounding-bounded comparison still agrees' +
    (c2 ? ' (ok ' + c2.ok + ', agrees ' + c2.agrees + ')' : ''));
  if (st) st.pctAlloc = keep;
  UI.render();
  const c3 = UI.check ? UI.check(P) : null;
  ok(!!(c3 && c3.ok), '(f): agrees again once the edit is undone');
}

/* ---------------- (g) Exit of merged Regular + Direct positions, two clients ---------------- */
console.log('\n=== (g) Exit of merged Regular + Direct positions held by two clients ===');
{
  /* built the way tools/test-ai-analyst.js builds its fixtures: holding rows straight into
     computeReview, on real reference schemes. The weakest Centricity ranks in a category of
     8 or more (bottom quarter, then lowest score), each with XIRR well below BMXIRR; a
     '(G)-Direct Plan' sibling held by the other client; the first also held in its Regular
     plan by both clients. Four top-ranked schemes are the funded destinations. CMVs are
     chosen so each merged position rounds UP by 0.0044 Cr in the plan. */
  const FR = REF.FUND_RANKS;
  const row = o => Object.assign({
    client: 'Exit Client A', name: '', amc: '', product: 'Mutual Funds', asset: 'Equity',
    category: 'Flexi Cap', distributor: 'Centricity', folio: '1', units: 1000,
    invR: 10000000, mvR: 12000000, glR: 2000000, invCr: 1, cmvCr: 1.2, glCr: 0.2,
    xirrFrac: 0.12, bmxirrFrac: 0.10, days: 900 }, o);
  const dOf = n => String(n).replace(/-Reg\(G\)\s*$/i, '') + '(G)-Direct Plan';
  const weak = Object.keys(FR).filter(k => /-Reg\(G\)$/.test(k) && FR[k].rank != null && FR[k].of >= 8 &&
      FR[k].rank / FR[k].of >= 0.75 && REF.MF_PERF[k] && REF.MF_RISK[k])
    .sort((a, b) => (FR[b].rank / FR[b].of) - (FR[a].rank / FR[a].of) || (FR[a].score || 0) - (FR[b].score || 0) || (a < b ? -1 : 1))
    .slice(0, 3);
  const strong = Object.keys(FR).filter(k => /-Reg\(G\)$/.test(k) && FR[k].rank === 1 && FR[k].of >= 8 &&
      REF.MF_PERF[k] && REF.MF_RISK[k]).sort().slice(0, 4);
  const XA = 'Exit Client A', XB = 'Exit Client B';
  const amc = k => k.split(' ')[0];
  const weakRow = (cli, name, k, cmv, f) => row({ client: cli, name: name, amc: amc(k), cmvCr: cmv, invCr: cmv * 0.9,
    glCr: cmv * 0.1, xirrFrac: 0.04, bmxirrFrac: 0.14, folio: f });
  const rows = [];
  if (weak[0]) rows.push(weakRow(XA, weak[0], weak[0], 1.2346, '11'), weakRow(XB, weak[0], weak[0], 0.4123, '12'),
                         weakRow(XB, dOf(weak[0]), weak[0], 0.5987, '13'));   /* 2.2456 -> 2.25 */
  if (weak[1]) rows.push(weakRow(XA, weak[1], weak[1], 1.1046, '21'), weakRow(XB, dOf(weak[1]), weak[1], 0.5410, '22'));  /* 1.6456 -> 1.65 */
  if (weak[2]) rows.push(weakRow(XA, weak[2], weak[2], 0.9846, '31'), weakRow(XB, dOf(weak[2]), weak[2], 0.4910, '32'));  /* 1.4756 -> 1.48 */
  strong.forEach((k, i) => rows.push(row({ client: XA, name: k, amc: amc(k), cmvCr: 0.6, invCr: 0.5, glCr: 0.1,
    xirrFrac: 0.18, bmxirrFrac: 0.12, folio: '4' + i })));
  rows.unitHint = 'Cr';
  const model = E.computeReview(rows, REF, { familyName: 'Exit Probe', asOnDate: '30 Sep 2026' });
  const P = E.aiaCompute(model, REF, {});

  const exits = (P.recs || []).filter(r => r.action === 'Exit');
  const twoPlanTwoClient = exits.filter(r => r.merged &&
    r.members.some(m => m.plan === 'Regular') && r.members.some(m => m.plan === 'Direct') &&
    new Set(r.members.map(m => m.client)).size >= 2);
  const multiClientRow = exits.find(r => r.members.filter(m => m.plan === 'Regular').length >= 2);
  const exitCmv = exits.reduce((s, r) => s + memCmv(model, r), 0);
  ok(weak.length === 3 && strong.length === 4 && exits.length === 3 && twoPlanTwoClient.length === 3 && !!multiClientRow &&
     P.recs.filter(ACTING).every(r => r.action === 'Exit'),
    'fixture: the three weak schemes are exited as merged Regular + Direct positions of two clients, one with a two-client ' +
    'Regular row, and nothing else releases (' + exits.length + ' exits: ' + exits.map(r => r.name).join('; ') + ')');
  ok(Math.abs(exitCmv - P.summary.released) > 0.005 + 1e-9,
    'fixture: the plan\'s rounding of the exits (' + f4(exitCmv) + ' vs ' + f4(P.summary.released) +
    ' Cr) is wider than the 0.005 Cr base, so the per-Exit term is needed');

  UI.load(model); UI.apply(P);
  const st = UI.state(), bad = [];
  exits.forEach(r => r.members.forEach(m => {
    const s = st[UI.key(m.name)];
    if (!s || s.action !== 'Exit' || s.pctAlloc !== 100 || s.client !== null) bad.push(m.client + ': ' + m.name +
      (s ? ' (' + s.action + ', ' + s.pctAlloc + '%, client ' + s.client + ')' : ' (no row)'));
  }));
  ok(bad.length === 0, '(g): every member row of every Exit is written as Exit, 100%, all clients' + (bad.length ? ' — ' + bad.join(' | ') : ''));
  const s = UI.summary();
  ok(Math.abs(s.released - exitCmv) <= 1e-9,
    '(g): tab released = sum of the exited members\' CMV, exactly (' + f4(s.released) + ' vs ' + f4(exitCmv) + ' Cr)');
  const exitTol = 0.005 + 0.005 * exits.length + 1e-9;
  ok(Math.abs(s.released - P.summary.released) <= exitTol,
    '(g): tab released agrees with the AI plan within 0.005 Cr per Exit plus 0.005 on the total (' + f4(s.released) + ' vs ' +
    f4(P.summary.released) + ' Cr, |diff| ' + f4(Math.abs(s.released - P.summary.released)) + ' <= ' + f4(exitTol) + ')');
  reconcile('(g)', model, P);
  rationaleChecks('(g)', model, P, false);
  const exitRat = exits.every(r => rowKeys(r).every(k => st[k] && /^Redeem 100%/.test(st[k].rationale)));
  ok(exitRat, '(g): every Exit row\'s rationale opens with the engine\'s "Redeem 100%" clause');
}

console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
