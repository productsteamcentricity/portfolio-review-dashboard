/* ============================================================================
   KI-062 (audit 2026-10-19, NEW-16) — a degraded Exit keeps its bookkeeping.

   HARD RULE 2: an Exit with no funded destination is reduced to a Partial
   Rebalance (or to Retain). The fill had already booked the FULL exit as
   unfunded and taken the full exit off the house's running AMC figure; the
   degrade lowered the release but left both, so "unplaced" exceeded "released"
   (KPI "Rs 7.50 Cr released ... Rs 7.80 Cr unplaced") and the "largest AMC
   after" named the wrong house (Invesco 10% when Union was 12.09%).
   Bookkeeping only: whether a degraded Exit should release money at all is the
   owner's decision (OD-14); this test does not assert that behaviour.

   Fixture A (synthetic, 11.00 Cr, all mutual funds so the MF book = total CMV):
     the category's top-3 funds at 1.20 Cr each (12%: overweight, so trimmed and
     never a destination), its worst-ranked fund at 6.40 Cr under a synthetic house
     label (an Exit with no destination -> degraded), and a 1.00 Cr synthetic debt
     fund of the same house (retained; another asset class, so never a
     destination). Known answers, from the band rule (composite < 50 -> 3% target):
       degraded release = 6.40 - 3% x 11.00 = 6.07 Cr, and it is all unplaced;
       that house after the plan = (6.40 - 6.07 + 1.00) / 11.00 = 12.09%, the
       largest of all houses, recomputed here from the holdings and the plan, by
       the test's own labels and scheme-name brands (never engine AMC names).
   Fixture B: the worst fund is only 2.5% of the book, so the degrade drops it to
     Retain: release 0 and unplaced 0.
   Every rec, and the summary: release = destinations + unplaced; unplaced <= released.
     node tools/regression/KI-062-degraded-exit.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF } = load();
const FR = REF.FUND_RANKS || {}, MP = REF.MF_PERF || {};

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const r2 = v => Math.round(v * 100) / 100;
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 0.0051 : t);

function row(o) {
  return Object.assign({
    client: 'Test Client', name: '', amc: '', product: 'Mutual Funds', asset: 'Equity',
    category: 'Flexi Cap', distributor: 'Centricity', folio: '1', units: 1000,
    invR: 10000000, mvR: 12000000, glR: 2000000, invCr: 1, cmvCr: 1.2, glCr: 0.2,
    xirrFrac: 0.12, bmxirrFrac: 0.10, days: 900
  }, o);
}
const CATS = ['Large Cap', 'Flexi Cap', 'Mid Cap', 'Small Cap', 'Focused', 'Value-Contra'];

/* the first category (in the order above) whose worst-ranked fund is exited and degraded */
function fixture(topCr, worstCr, debtCr) {
  for (const cat of CATS) {
    const funds = Object.keys(FR).filter(k => FR[k].cat === cat && FR[k].rank != null && MP[k])
      .sort((a, b) => (FR[a].rank - FR[b].rank) || (a < b ? -1 : 1));
    if (funds.length < 4) continue;
    const top3 = funds.slice(0, 3), W = funds[funds.length - 1];
    const house = 'Synthetic House W';
    const rows = top3.map((k, i) => row({ name: k, amc: 'Synthetic House T' + i, category: cat, cmvCr: topCr, invCr: topCr * 0.85 }))
      .concat([row({ name: W, amc: house, category: cat, cmvCr: worstCr, invCr: worstCr * 1.1, glCr: -worstCr * 0.1,
                    xirrFrac: 0.04, bmxirrFrac: 0.12 })]);
    if (debtCr) rows.push(row({ name: 'Synthetic Short Duration Fund', amc: house, asset: 'Debt', category: 'Short Duration',
                                cmvCr: debtCr, invCr: debtCr * 0.95, glCr: debtCr * 0.05 }));
    const input = rows.map(r => ({ name: r.name, amc: r.amc, cmvCr: r.cmvCr }));   /* the test's own view of the book */
    const m = E.computeReview(rows, REF, { familyName: 'KI-062', asOnDate: '30 Sep 2026' });
    const P = E.aiaCompute(m, REF, {});
    const w = P.recs.filter(r => r.name === W)[0];
    if (w && w.degraded) return { cat, W, house, m, P, w, rows: input };
  }
  return null;
}

function conservation(f, tag) {
  const bad = [];
  f.P.recs.forEach(r => {
    const d = r.destinations.reduce((a, x) => a + x.amount, 0);
    if (!near(d + (r.unfunded || 0), r.release)) bad.push(r.name + ': release ' + r.release + ', destinations ' + r2(d) + ', unplaced ' + r.unfunded);
  });
  ok(bad.length === 0, tag + ': every recommendation\'s release = destinations + unplaced' + (bad.length ? ' — ' + bad.join('; ') : ''));
  const S = f.P.summary;
  ok(near(S.deployed + S.unfunded, S.released), tag + ': summary released ' + S.released + ' = redeployed ' + S.deployed + ' + unplaced ' + S.unfunded);
  ok(S.unfunded <= S.released + 0.005, tag + ': unplaced (' + S.unfunded + ') does not exceed released (' + S.released + ')');
}

/* ---------- Fixture A: degraded to a Partial Rebalance ---------- */
console.log('--- A. a large weak holding: Exit -> no destination -> Partial Rebalance ---');
const A = fixture(1.2, 6.4, 1.0);
ok(!!A, 'fixture A produces a degraded Exit in one of: ' + CATS.join(', '));
if (A) {
  const tot = A.m.totalCMV, w = A.w;
  console.log('  ' + A.cat + ': worst ' + A.W + ' (' + FR[A.W].rank + '/' + FR[A.W].of + '), composite ' + w.composite + ', total ' + r2(tot));
  ok(near(tot, 11.0, 1e-9), 'total CMV is 11.00 Cr');
  ok(w.action === 'Partial Rebalance' && w.composite < 50, 'the degraded Exit is now a Partial Rebalance on a composite under 50 (' + w.action + ', ' + w.composite + ')');
  ok(near(w.release, 6.07, 1e-9), 'its release is 6.40 - 3% x 11.00 = 6.07 Cr (got ' + w.release + ')');
  ok(w.destinations.length === 0 && near(w.unfunded, 6.07, 1e-9), 'it has no destination and its unplaced amount is the 6.07 Cr it releases (got ' + w.unfunded + ')');
  conservation(A, 'A');

  /* largest AMC after the plan, recomputed from the holdings, the final releases and the
     destinations (all mutual funds, so this is the same figure on either cap basis). The
     houses are the test's own: a holding's house is the label this test gave it, and a new
     destination's house is the brand (first word) of its scheme name, never an engine name. */
  const cmv = {}, houseOf = {};
  A.rows.forEach(r => { houseOf[r.name] = r.amc; cmv[r.amc] = (cmv[r.amc] || 0) + r.cmvCr; });
  const destHouse = n => houseOf[n] || String(n).split(' ')[0];
  A.P.recs.forEach(r => { cmv[houseOf[r.name]] -= r.release;
    r.destinations.forEach(d => { const k = destHouse(d.name); cmv[k] = (cmv[k] || 0) + d.amount; }); });
  let mx = -1, who = '';
  Object.keys(cmv).sort().forEach(k => { const p = cmv[k] / tot * 100; if (p > mx + 1e-12) { mx = p; who = k; } });
  console.log('  recomputed: ' + Object.keys(cmv).sort().map(k => k + ' ' + (cmv[k] / tot * 100).toFixed(2) + '%').join(' | '));
  ok(near(cmv[A.house] / tot * 100, (6.4 - 6.07 + 1.0) / 11 * 100, 1e-9), A.house + ' after the plan is (6.40 - 6.07 + 1.00) / 11.00 = 12.09%');
  ok(who === A.house, 'the largest house after the plan is ' + A.house + ' (recomputed: ' + who + ' ' + r2(mx) + '%)');
  ok(near(A.P.summary.amcAfter, r2(mx), 0.0001) && A.P.summary.amcAfterWho === who,
     'the summary\'s largest AMC after is ' + r2(mx) + '% (' + who + '); got ' + A.P.summary.amcAfter + '% (' + A.P.summary.amcAfterWho + ')');
  ok(!A.P.caveats.some(c => /RAISES/.test(c)), 'no "plan RAISES the largest AMC concentration" caveat: 67.27% -> 12.09% is a fall');
}

/* ---------- Fixture B: degraded to Retain ---------- */
console.log('--- B. a small weak holding: Exit -> no destination -> Retain ---');
const B = fixture(3.25, 0.25, 0);
ok(!!B, 'fixture B produces a degraded Exit in one of: ' + CATS.join(', '));
if (B) {
  const w = B.w;
  console.log('  ' + B.cat + ': worst ' + B.W + ', composite ' + w.composite + ', weight ' + w.wt + '%');
  ok(w.action === 'Retain' && w.release === 0, 'the degraded Exit (2.50% of the book, under its 3% target) is now Retain with no release');
  ok(w.unfunded === 0, 'a Retain carries no unplaced amount (got ' + w.unfunded + ')');
  conservation(B, 'B');
}

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all KI-062 checks passed'));
process.exit(fail ? 1 : 0);
