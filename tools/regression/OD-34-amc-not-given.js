/* ============================================================================
   OD-34 (owner decision of 21 Oct 2026; fix batch 2a; KI-112) — mutual-fund rows
   with no AMC label are "AMC not given", outside every fund house's 20% cap.

   Before: the blank label was one unnamed house. It had its own AMC-tab row with
   no name (and could be a "breach"), it could head the AI Analyst's largest AMC
   before / after with no name, and its cap was half enforced: a top-up of a
   blank-AMC fund was tested against the whole blank group but never booked to
   it, and its impact signal claimed to relieve "  concentration".
   Now: those rows are shown as "AMC not given", with a count and a footnote, on
   the AMC tab, the AMC slide, the XLSX "AMC Allocation" sheet and the AI
   Analyst (each such row's AMC, and a caveat). They stay in the mutual-fund
   book (every house's % is still of the whole book), but they are never a house:
   not a row of the house table, not a breach, not the largest AMC, not tested
   or booked in the greedy fill, the final cap or the summary.
   A label with no letter or digit ("", "  ", "-") gives no AMC, and so does a
   placeholder label (lead decision of 22 Oct 2026): "NA", "N/A", "N.A.", "Not
   Available", "Unknown", "Others", "Other", "-", "--", whatever the case.
   With such holdings, the Observations' AMC sentence and the AMC slide's insight
   state their share and call the book well diversified only when that holds
   whichever house they belong to (financial review of fix batch 2a).

   Known answers (written here, independent of the engine's AMC keys):
     1. A 10.00 Cr all-mutual-fund book: six 0.50 Cr funds with no AMC (3.00 Cr),
        "Synthetic House Alpha" 5 x 0.50 = 2.50 Cr, "Synthetic House Beta" 2.50
        Cr, "Synthetic House Gamma" 4 x 0.50 = 2.00 Cr. The AMC tab: Alpha 25.00%
        and Beta 25.00% (breaches), Gamma 20.00% (not a breach); AMC not given
        6 holdings, 3.00 Cr, 30.00%, no breach; the four shares sum to 100%.
     1b. A "-" label is not given; a PMS with no label is outside the book and
        keeps its blank label.
     2. AI Analyst on that book: the largest AMC before is Alpha 25.00% (Alpha
        and Beta tie; alphabetical, as always), never the 30.00% with no AMC; the
        largest after is a named house, recomputed here from the plan's own
        releases; a caveat gives the count and the share.
     3. The greedy fill: a strong fund held at 2.00% of a 10.00 Cr book with no
        AMC, beside 1.75 Cr of other funds with no AMC (19.50% in all), receives a
        top-up of its full room to the 10% fund cap, (10% - 2%) x 10.00 Cr =
        0.80 Cr, when a weak fund of its category releases more than every
        destination can take. Before, the 19.50% blank group left it 0.50% of
        room, under the 2% minimum ticket, so it got nothing. Its impact signal
        carries no house figure; the destination is shown as "AMC not given".
     4. Exports and the AMC tab: the XLSX "AMC Allocation" sheet has an "AMC not
        given" row (30.00%, "Outside cap") and the footnote; the AMC slide's
        chart has an "AMC not given" bar and the footer gives the count; the AMC
        tab's chart has a grey "AMC not given" bar and the note gives the count;
        the XLSX "AI Analyst" sheet shows the row's AMC and the caveat.
     5. The AMC sentence and the AMC-slide insight, each book written here:
        (i)   10.00 Cr: four funds with no AMC, 1.00 Cr each (40.00%), and four
              named houses at 1.50 Cr (15.00%) each. Both texts give 40.00%; neither
              says "well diversified", since the largest house plus the 40.00% with
              no AMC could reach 55.00%, past the 20% cap. No en or em dash.
        (ii)  every mutual fund without an AMC (1.00 + 2.00 + 1.00 Cr): the insight
              does not say "well diversified", and the slide's chart is one grey
              (#BFBFBF) "AMC not given" bar at 100%. The Observations give the
              count (3) and 100.00%.
        (iii) 2.00% with no AMC (one 0.20 Cr fund): beside seven houses at 14.00%
              each, 14.00 + 2.00 = 16.00% stays within the cap, so both texts say
              well diversified and give 2.00%; beside a largest house at 19.00%,
              19.00 + 2.00 = 21.00% could pass it, so neither says it. No en or em
              dash in either text.
        (iv)  the boundary, on the breach test's own arithmetic (a house is a breach
              above 20.0%, so a house at exactly 20.00% is not): 12.50 Cr, the
              largest house 2.25 Cr (18.00%), five houses at 2.00 Cr (16.00%), one
              0.25 Cr fund with no AMC (2.00%): 18.00 + 2.00 = 20.00%, so
              amc.notGiven.capSafe is true and both texts say well diversified; the
              same book with that fund in the largest house has it at 20.00%, not a
              breach. 10.00 Cr with the largest house at 1.81 Cr (18.10%) and 2.00%
              with no AMC: 20.10%, so capSafe is false, neither text says well
              diversified and both say diversification cannot be confirmed; with
              that fund in the largest house it is at 20.10%, a breach.
        (v)   wording on books where every mutual fund names its house: one house at
              2.50 Cr of 10.00 Cr (25.00%), the rest 15.00%: the insight opens
              "Synthetic House A (25.00%) breaches the 20% per-AMC cap." (one house
              "breaches"), and the Observations say "breaches" too; no breach, the
              largest house at 18.00%: the Observations sentence is main's, word for
              word, and the insight has no en or em dash.
     6. Placeholder labels: ENGINE.amcKey gives no house for each of them (in any
        case); labels that only contain such a word ("Unknown Opportunities",
        "Other Distributor") or real houses ("Navi", "NJ", "Union") keep a key.
        A book with one 0.50 Cr mutual fund under each of the nine placeholders
        and Alpha at 0.50 Cr: "AMC not given" 9 holdings, 90.00%; Alpha 10.00% is
        the only house row; a PMS labelled "N/A" keeps its label, outside the book.

   UI-BLOCK NOTE: renderAMC lives in the UI script (11_app_ui), which Node cannot
   load. It is cut out of the SHIPPED index.html by anchor
     '  function renderAMC(){' -> '  function ctxLine('
   and run on a fake #s-amc element with a stub Chart that records its data.
   Synthetic rows only; real scheme names come from the embedded reference data.
     node tools/regression/OD-34-amc-not-given.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const host = require('../engine-host.js');
const { E, REF, XLSX, Ppt } = host.load();
const FR = REF.FUND_RANKS || {}, MP = REF.MF_PERF || {};

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const pre = (c, m) => { console.log((c ? 'PRE   ' : 'FAIL  precondition: ') + m); if (!c) fail++; };
const r2 = v => Math.round(v * 100) / 100;
const J = x => JSON.stringify(x);
const NG = 'AMC not given';

function row(o) {
  return Object.assign({
    client: 'Test Client', name: '', amc: '', product: 'Mutual Funds', asset: 'Equity',
    category: 'Flexi Cap', distributor: 'Centricity', folio: '1', units: 1000,
    invR: 10000000, mvR: 12000000, glR: 2000000, invCr: 1, cmvCr: 1.2, glCr: 0.2,
    xirrFrac: 0.12, bmxirrFrac: 0.10, days: 900
  }, o);
}
const review = rows => E.computeReview(rows, REF, { familyName: 'OD-34', asOnDate: '30 Sep 2026' });
const amcRows = m => (m.amc && m.amc.rows) || [];
const showRows = m => amcRows(m).map(r => '"' + r.amc + '" ' + r2(r.pct).toFixed(2) + '%' + (r.breach ? ' (breach)' : '')).join(' | ');

/* ---------- 1. the AMC tab ---------- */
console.log('--- 1. AMC Allocation tab ---');
const HOUSES = { 'Synthetic House Alpha': 5, 'Synthetic House Beta': 5, 'Synthetic House Gamma': 4 };
const BLANKS = ['', '', '', '', '', '  '];
const book1 = BLANKS.map((a, i) => row({ name: 'Synthetic No-AMC Fund ' + (i + 1), amc: a, cmvCr: 0.5, invCr: 0.45 }));
Object.keys(HOUSES).forEach(h => { for (let i = 0; i < HOUSES[h]; i++)
  book1.push(row({ name: h.replace('House', 'Fund') + ' ' + (i + 1), amc: h, cmvCr: 0.5, invCr: 0.45 })); });
const m1 = review(book1);
console.log('  AMC rows: ' + showRows(m1) + '; not given: ' + J(m1.amc.notGiven && { count: m1.amc.notGiven.count, cmv: r2(m1.amc.notGiven.cmv), pct: r2(m1.amc.notGiven.pct) }));
const rs = amcRows(m1);
ok(rs.length === 3 && rs.every(r => r.amc && String(r.amc).trim() && r.amc !== NG),
   'the house table holds the three named houses only: no unnamed or "AMC not given" house (got ' + rs.length + ' rows)');
const byName = n => rs.filter(r => r.amc === n)[0];
ok(!!byName('Synthetic House Alpha') && Math.abs(byName('Synthetic House Alpha').pct - 25) < 1e-9 && byName('Synthetic House Alpha').breach &&
   !!byName('Synthetic House Beta') && Math.abs(byName('Synthetic House Beta').pct - 25) < 1e-9 && byName('Synthetic House Beta').breach &&
   !!byName('Synthetic House Gamma') && Math.abs(byName('Synthetic House Gamma').pct - 20) < 1e-9 && !byName('Synthetic House Gamma').breach,
   'Alpha 25.00% and Beta 25.00% are breaches, Gamma 20.00% is not: every house % is of the whole 10.00 Cr book');
const ng = m1.amc.notGiven;
ok(!!ng && ng.amc === NG && ng.count === 6 && Math.abs(ng.cmv - 3) < 1e-9 && Math.abs(ng.pct - 30) < 1e-9,
   '"AMC not given": 6 holdings, 3.00 Cr, 30.00% of the mutual-fund book (got ' + J(ng && { amc: ng.amc, count: ng.count, cmv: ng.cmv, pct: ng.pct }) + ')');
ok((m1.amc.breaches || []).map(b => b.amc).join(',') === 'Synthetic House Alpha,Synthetic House Beta',
   'the breaches are Alpha and Beta only (got ' + J((m1.amc.breaches || []).map(b => b.amc + ' ' + r2(b.pct))) + ')');
ok(!!m1.amc.max && m1.amc.max.amc === 'Synthetic House Alpha' && Math.abs(m1.amc.max.pct - 25) < 1e-9,
   'the largest house is Alpha 25.00%, not the 30.00% with no AMC (got ' + J(m1.amc.max && [m1.amc.max.amc, r2(m1.amc.max.pct)]) + ')');
ok(Math.abs(rs.reduce((a, r) => a + r.pct, 0) + (ng ? ng.pct : 0) - 100) < 1e-9 && Math.abs(m1.amc.mfTotal - 10) < 1e-9,
   'the houses and "AMC not given" sum to 100% of the 10.00 Cr book');
const blankShown = m1.holdings.filter(h => /^Synthetic No-AMC/.test(h.name)).map(h => h.amcDisplay);
ok(blankShown.length === 6 && blankShown.every(a => a === NG), 'each of those rows is shown as "AMC not given" (got ' + J(Array.from(new Set(blankShown))) + ')');

console.log('--- 1b. a "-" label; a PMS with no label ---');
{
  const m = review([
    row({ name: 'Synthetic Dash Fund', amc: '-', cmvCr: 1.0 }),
    row({ name: 'Synthetic Blank Fund', amc: '', cmvCr: 1.0 }),
    row({ name: 'Synthetic Alpha Fund', amc: 'Synthetic House Alpha', cmvCr: 2.0 }),
    row({ name: 'Synthetic Unlabelled Portfolio', amc: '', product: 'PMS', category: 'Multi Cap', cmvCr: 1.0 })
  ]);
  const n = m.amc.notGiven, r = amcRows(m);
  console.log('  AMC rows: ' + showRows(m) + '; not given: ' + J(n && { count: n.count, cmv: n.cmv, pct: n.pct }));
  ok(r.length === 1 && r[0].amc === 'Synthetic House Alpha' && Math.abs(r[0].pct - 50) < 1e-9 && !!n && n.count === 2 && Math.abs(n.pct - 50) < 1e-9,
     '"-" and "" are both "AMC not given" (2 holdings, 50.00% of the 4.00 Cr book); Alpha is 50.00%');
  const pms = m.holdings.filter(h => h.name === 'Synthetic Unlabelled Portfolio')[0];
  ok(!!pms && pms.amcDisplay === '' && Math.abs(m.amc.mfTotal - 4) < 1e-9, 'the PMS with no label is outside the book and keeps its blank label (got ' + J(pms && pms.amcDisplay) + ')');
  ok(E.amcKey('-') === '' && E.amcKey('  ') === '' && E.amcKey('') === '', 'ENGINE.amcKey gives no house for "", "  " or "-"');
}

console.log('--- 1c. placeholder labels mean "AMC not given" (lead decision, 22 Oct 2026) ---');
{
  const PH = ['NA', 'N/A', 'N.A.', 'Not Available', 'Unknown', 'Others', 'Other', '-', '--'];
  const variants = PH.concat(['na', 'n/a', 'n.a.', 'N. A.', 'NOT AVAILABLE', 'not available', 'UNKNOWN', 'unknown', 'OTHERS', 'other', ' N/A ']);
  const keyed = variants.map(l => [l, E.amcKey(l)]);
  ok(keyed.every(([, k]) => k === ''), 'ENGINE.amcKey gives no house for each placeholder label, whatever the case (got ' +
     J(keyed.filter(([, k]) => k !== '')) + ' with a key)');
  const REAL = ['Navi', 'NJ Mutual Fund', 'Union', 'Unknown Opportunities', 'Other Distributor', 'Nippon India'];
  const kept = REAL.map(l => [l, E.amcKey(l)]);
  ok(kept.every(([, k]) => k !== ''), 'a label that only contains such a word, or a real house, keeps a key (got ' + J(kept) + ')');
  const rowsP = PH.map((a, i) => row({ name: 'Synthetic Placeholder Fund ' + (i + 1), amc: a, cmvCr: 0.5 }));
  rowsP.push(row({ name: 'Synthetic Alpha Fund', amc: 'Synthetic House Alpha', cmvCr: 0.5 }));
  rowsP.push(row({ name: 'Synthetic NA Portfolio', amc: 'N/A', product: 'PMS', category: 'Multi Cap', cmvCr: 1.0 }));
  const m = review(rowsP);
  /* independent: nine 0.50 Cr placeholders and one 0.50 Cr Alpha fund; the PMS is outside the book */
  const ngWant = PH.length * 0.5, bookWant = ngWant + 0.5;
  const n = m.amc.notGiven, r = amcRows(m);
  console.log('  AMC rows: ' + showRows(m) + '; not given: ' + J(n && { count: n.count, cmv: r2(n.cmv), pct: r2(n.pct) }));
  ok(!!n && n.count === PH.length && Math.abs(n.cmv - ngWant) < 1e-9 && Math.abs(n.pct - ngWant / bookWant * 100) < 1e-9 &&
     r.length === 1 && r[0].amc === 'Synthetic House Alpha' && Math.abs(r[0].pct - 0.5 / bookWant * 100) < 1e-9,
     '"AMC not given" ' + PH.length + ' holdings, ' + (ngWant / bookWant * 100).toFixed(2) + '% of the ' + bookWant.toFixed(2) +
     ' Cr book; Alpha ' + (0.5 / bookWant * 100).toFixed(2) + '% is the only house row');
  const shown = m.holdings.filter(h => /^Synthetic Placeholder Fund/.test(h.name)).map(h => h.amcDisplay);
  ok(shown.length === PH.length && shown.every(a => a === NG), 'each placeholder row is shown as "AMC not given" (got ' + J(Array.from(new Set(shown))) + ')');
  const pms = m.holdings.filter(h => h.name === 'Synthetic NA Portfolio')[0];
  ok(!!pms && pms.amcDisplay === 'N/A' && Math.abs(m.amc.mfTotal - bookWant) < 1e-9,
     'a PMS labelled "N/A" keeps its label and is outside the book (got ' + J(pms && pms.amcDisplay) + ')');
}

/* ---------- 2. the AI Analyst on book 1 ---------- */
console.log('--- 2. AI Analyst: the largest AMC and the caveat ---');
{
  const P = E.aiaCompute(m1, REF, {});
  const sm = P.summary || {};
  ok(sm.amcBeforeWho === 'Synthetic House Alpha' && sm.amcBefore === 25,
     'largest AMC before: Alpha 25.00% (got ' + J(sm.amcBeforeWho) + ' ' + sm.amcBefore + '%)');
  /* independent: each named house after the plan, from its own rows' releases and any
     destination into them (MF book = total CMV here, so both bases agree) */
  const own = {}; m1.holdings.forEach(h => { if (HOUSES[h.amc]) own[h.name] = h.amc; });
  const aft = {}; Object.keys(HOUSES).forEach(h => { aft[h] = HOUSES[h] * 0.5; });
  P.recs.forEach(r => {
    if (own[r.name]) aft[own[r.name]] -= (r.release || 0);
    (r.destinations || []).forEach(d => { if (own[d.name]) aft[own[d.name]] += d.amount; });
  });
  let who = null, val = null;
  Object.keys(aft).sort().forEach(h => { const v = aft[h] / 10 * 100; if (val == null || v > val) { val = v; who = h; } });
  console.log('  plan: ' + P.recs.filter(r => r.release > 0).map(r => r.name + ' ' + r.action + ' ' + r.release).join('; ') +
    '; houses after ' + Object.keys(aft).map(h => h + ' ' + (aft[h] / 10 * 100).toFixed(2) + '%').join(', '));
  ok(sm.amcAfterWho === who && Math.abs(sm.amcAfter - r2(val)) < 0.006,
     'largest AMC after: ' + who + ' ' + r2(val).toFixed(2) + '% (got ' + J(sm.amcAfterWho) + ' ' + sm.amcAfter + '%)');
  const cav = (P.caveats || []).filter(c => c.indexOf(NG) >= 0);
  ok(cav.length === 1 && /\b6 mutual-fund holdings\b/.test(cav[0]) && cav[0].indexOf('30.00%') >= 0 && /outside every fund house/.test(cav[0]),
     'a caveat gives the count and the share: ' + J(cav[0] || null));
  const blankRecs = P.recs.concat(P.notAssessed).filter(r => /^Synthetic No-AMC/.test(r.name));
  ok(blankRecs.length === 6 && blankRecs.every(r => r.amc === NG), 'the AI Analyst shows those rows\' AMC as "AMC not given" (got ' +
     J(Array.from(new Set(blankRecs.map(r => r.amc)))) + ')');
}

/* ---------- 3. the greedy fill ---------- */
console.log('--- 3. AI Analyst greedy fill: a fund with no AMC is outside every house cap ---');
const assetOf = k => (MP[k] && MP[k].type === 'debt') ? 'Debt' : (MP[k] && MP[k].type === 'hybrid') ? 'Hybrid' : 'Equity';
function fillFixture(cat) {
  const ks = Object.keys(FR).filter(k => FR[k].cat === cat && MP[k] && FR[k].rank != null && FR[k].score != null);
  const top = ks.filter(k => FR[k].rank === 1).sort()[0];
  const weak = ks.slice().sort((a, b) => (FR[b].rank - FR[a].rank) || (a < b ? -1 : 1))[0];
  if (!top || !weak || top === weak || assetOf(top) !== assetOf(weak)) return null;
  const asset = assetOf(top);
  /* 10.00 Cr, all mutual funds: the weak fund 4.00 Cr (its own house); the strong fund 0.20 Cr
     (2.00%) with no AMC; 1.75 Cr of other no-AMC funds and six 0.675 Cr houses in another
     asset class (Debt), so the weak fund's destinations are its category's schemes only */
  const rows = [
    row({ name: weak, amc: weak.split(' ')[0], category: cat, asset, cmvCr: 4.0, invCr: 3.6, xirrFrac: 0.05, bmxirrFrac: 0.09 }),
    row({ name: top, amc: '', category: cat, asset, cmvCr: 0.2, invCr: 0.15 }),
    row({ name: 'Synthetic No-AMC Debt Fund 1', amc: '', asset: 'Debt', category: 'Other', cmvCr: 0.6 }),
    row({ name: 'Synthetic No-AMC Debt Fund 2', amc: '', asset: 'Debt', category: 'Other', cmvCr: 0.6 }),
    row({ name: 'Synthetic No-AMC Debt Fund 3', amc: '', asset: 'Debt', category: 'Other', cmvCr: 0.55 })
  ];
  ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].forEach(n =>
    rows.push(row({ name: 'Synthetic ' + n + ' Debt Fund', amc: 'Synthetic House ' + n, asset: 'Debt', category: 'Other', cmvCr: 0.675 })));
  const m = review(rows);
  const P = E.aiaCompute(m, REF, {});
  return { cat, top, weak, m, P, rT: P.recs.filter(r => r.name === top)[0], rW: P.recs.filter(r => r.name === weak)[0] };
}
/* the first category (alphabetical) where the fixture is what it says: the strong fund is a
   Retain with composite >= 70 (so a top-up candidate), and the weak fund releases more than
   every destination can take (two new top-3 schemes at 1.00 Cr each, plus the top-up) */
let F = null;
for (const cat of Array.from(new Set(Object.keys(FR).map(k => FR[k].cat).filter(Boolean))).sort()) {
  const f = fillFixture(cat);
  if (f && f.rT && f.rT.action === 'Retain' && f.rT.composite >= 70 && Math.abs(f.rT.wt - 2) < 1e-9 && f.rW && f.rW.release >= 2.8 - 1e-9) { F = f; break; }
}
pre(!!F, 'a category gives a strong rank-1 fund and a weak fund releasing at least 2.80 Cr' + (F ? ' (' + F.cat + ': ' + F.top + ', composite ' +
  F.rT.composite + '; ' + F.weak + ' ' + F.rW.action + ' ' + F.rW.release + ' Cr)' : ''));
if (F) {
  const ngF = F.m.amc.notGiven;
  ok(!!ngF && ngF.count === 4 && Math.abs(ngF.pct - 19.5) < 1e-9, 'the funds with no AMC are "AMC not given": 4 holdings, 19.50% of the book');
  const tu = (F.rW.destinations || []).filter(d => d.name === F.top);
  const amt = tu.reduce((a, d) => a + d.amount, 0);
  console.log('  ' + F.weak + ' -> ' + (F.rW.destinations || []).map(d => d.kind + ' ' + d.name + ' ' + d.amount + ' Cr [' + d.amc + ']').join('; ') + '; unplaced ' + F.rW.unfunded);
  ok(Math.abs(amt - 0.8) < 0.005, 'the strong fund with no AMC is topped up by its full room to the 10% fund cap, (10% - 2%) x 10.00 Cr = 0.80 Cr (got ' + r2(amt).toFixed(2) + ' Cr)');
  ok(tu.length > 0 && tu.every(d => d.amc === NG && !d.amcKey), 'that top-up is shown as "AMC not given" and booked to no house (got ' + J(tu.map(d => [d.amc, d.amcKey])) + ')');
  const imp = (F.rT.signals || []).filter(s => s.id === 'impact')[0];
  ok(!!imp && imp.evidence && imp.evidence.amcBefore == null, 'the strong fund\'s impact signal carries no house figure (got ' + J(imp && imp.evidence && imp.evidence.amcBefore) + ')');
  const sm = F.P.summary;
  ok(!!sm.amcAfterWho && sm.amcAfterWho !== NG && !!sm.amcBeforeWho && sm.amcBeforeWho !== NG,
     'the largest AMC before and after are named houses (got ' + J(sm.amcBeforeWho) + ' ' + sm.amcBefore + '% -> ' + J(sm.amcAfterWho) + ' ' + sm.amcAfter + '%)');
  /* the XLSX AI Analyst sheet: the row's AMC and the caveat */
  global.__AIA_DATA = F.P;                       /* window === global under engine-host */
  const wb = E.buildXLSX(F.m, XLSX);
  global.__AIA_DATA = null;
  const ai = XLSX.utils.sheet_to_json(wb.Sheets['AI Analyst'] || {}, { header: 1, raw: true });
  const hd = ai[0] || [], cH = hd.indexOf('Holding'), cA = hd.indexOf('AMC');
  const topRow = ai.filter(r => r && r[cH] === F.top)[0];
  ok(!!topRow && topRow[cA] === NG, 'XLSX "AI Analyst": the strong fund\'s AMC is "AMC not given" (got ' + J(topRow && topRow[cA]) + ')');
  ok(ai.some(r => r && typeof r[1] === 'string' && r[1].indexOf(NG + ': 4 mutual-fund holdings') === 0),
     'XLSX "AI Analyst": the caveat with the count is in "Method and caveats"');
}

/* ---------- 4. exports and the AMC tab ---------- */
console.log('--- 4. exports and the AMC tab ---');
{
  const wb = E.buildXLSX(m1, XLSX);
  const am = XLSX.utils.sheet_to_json(wb.Sheets['AMC Allocation'], { header: 1, raw: true });
  const data = am.slice(1).filter(r => r && r.length && typeof r[1] === 'number');
  console.log('  XLSX AMC Allocation: ' + J(am.slice(1)));
  const ngr = data.filter(r => r[0] === NG)[0];
  ok(!!ngr && Math.abs(ngr[1] - 30) < 1e-9 && ngr[3] === 'Outside cap', 'XLSX: an "AMC not given" row, 30.00%, "Outside cap" (got ' + J(ngr || null) + ')');
  ok(data.every(r => r[0] && String(r[0]).trim()) && data.filter(r => r[3] === 'YES').length === 2, 'XLSX: no unnamed row; two breaches (Alpha, Beta)');
  ok(am.some(r => r && typeof r[0] === 'string' && r[0].indexOf(NG + ': 6 mutual-fund holdings') === 0), 'XLSX: the footnote with the count');
}
async function slideChecks() {
  const buf = await E.buildPPTX(m1, Ppt, 'amc').write({ outputType: 'nodebuffer', compression: false });
  const s = Buffer.from(buf).toString('utf8');
  const cats = (s.match(/<c:pt idx="\d+"><c:v>[^<]*<\/c:v><\/c:pt>/g) || []).map(x => x.replace(/^.*<c:v>|<\/c:v>.*$/g, ''));
  ok(s.indexOf('<c:v>' + NG + '</c:v>') >= 0, 'AMC slide: the chart has an "AMC not given" bar (chart points ' + J(cats.slice(0, 12)) + ')');
  ok(/AMC not given \(grey\): 6 mutual-fund holdings/.test(s), 'AMC slide: the footer gives the count ("AMC not given (grey): 6 mutual-fund holdings …")');
}
function screenChecks() {
  const html = fs.readFileSync(path.join(host.ROOT, 'index.html'), 'utf8');
  const a = html.indexOf('  function renderAMC(){'), b = html.indexOf('  function ctxLine(', a);
  if (a < 0 || b < 0 || html.indexOf('  function renderAMC(){', a + 1) >= 0) throw new Error('renderAMC not found exactly once');
  const PRE = [
    'var el = { innerHTML: "" };',
    'var document = { getElementById: function(id){ return id === "s-amc" ? el : {}; } };',
    'var model = null, charts = [], cfg = null;',
    'function Chart(c, o){ cfg = o; }'
  ].join('\n');
  const UI = new Function(PRE + '\n' + html.slice(a, b) + '\nreturn function(m){ model = m; renderAMC(); return { html: el.innerHTML, cfg: cfg }; };')();
  const r = UI(m1);
  const d = r.cfg && r.cfg.data, lab = d ? d.labels : [], ds = d ? d.datasets[0] : {};
  const i = lab.indexOf(NG);
  ok(i === lab.length - 1 && ds.data[i] === 30 && ds.backgroundColor[i] === '#BFBFBF' && lab.filter(x => !x || !String(x).trim()).length === 0,
     'AMC tab: the chart ends with a grey "AMC not given" bar at 30.00% and has no unnamed bar (labels ' + J(lab) + ')');
  const text = r.html.replace(/<[^>]+>/g, ' ');
  ok(text.indexOf(NG + ': 6 mutual-fund holdings') >= 0 && text.indexOf(' (30.00%)') < 0,
     'AMC tab: the note gives the count, and no breach is listed for the funds with no AMC');
}

/* ---------- 5. the AMC sentence and the AMC-slide insight ---------- */
const XENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = t => String(t).replace(/&(amp|lt|gt|quot|apos);/g, (x, e) => XENT[e]);
/* the AMC slide alone: the insight's text (the run after "INSIGHT") and the bar chart */
async function amcSlide(m) {
  const buf = await E.buildPPTX(m, Ppt, 'amc').write({ outputType: 'nodebuffer', compression: false });
  const s = Buffer.from(buf).toString('utf8');
  const ins = s.match(/<a:t>INSIGHT\s*<\/a:t><\/a:r>[\s\S]*?<a:t>([^<]*)<\/a:t>/);
  const a = s.indexOf('<c:barChart>'), b = s.indexOf('</c:barChart>', a);
  const bc = a >= 0 && b > a ? s.slice(a, b) : '';
  const lv = t => (t.match(/<c:pt idx="\d+"><c:v>[^<]*<\/c:v><\/c:pt>/g) || []).map(x => x.replace(/^.*<c:v>|<\/c:v>.*$/g, ''));
  const cat = bc.match(/<c:cat>[\s\S]*?<\/c:cat>/), val = bc.match(/<c:val>[\s\S]*?<\/c:val>/);
  /* a point's colour: its own <c:dPt> fill if any, else the series fill */
  const serFill = (bc.match(/<c:ser>[\s\S]*?<c:spPr>\s*<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1] || null;
  const dpt = {}; (bc.match(/<c:dPt>[\s\S]*?<\/c:dPt>/g) || []).forEach(d => {
    const i = (d.match(/<c:idx val="(\d+)"/) || [])[1], c = (d.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1];
    if (i != null && c) dpt[i] = c; });
  const cats = cat ? lv(cat[0]).map(unxml) : [], vals = val ? lv(val[0]).map(Number) : [];
  return { insight: ins ? unxml(ins[1]) : null, cats, vals, colors: cats.map((c, i) => (dpt[i] || serFill || '').toUpperCase()) };
}
const obsAmc = m => ((m.observations && m.observations.currentPortfolio && m.observations.currentPortfolio.amcAllocation) || []).join(' ');
const WELL = /well[- ]diversified/i, DASH = /[–—]/;
const mixBook = (houses, blanks) => houses.map((c, i) => row({ name: 'Synthetic Mix Fund H' + (i + 1), amc: 'Synthetic House ' + String.fromCharCode(65 + i), cmvCr: c }))
  .concat(blanks.map((c, i) => row({ name: 'Synthetic Mix Fund N' + (i + 1), amc: ['', '  ', '-', ''][i % 4], cmvCr: c })));
/* independent: the share with no AMC, the largest house, and the largest house's share if it held all of them */
function want(houses, blanks) {
  const tot = houses.concat(blanks).reduce((a, c) => a + c, 0), ng = blanks.reduce((a, c) => a + c, 0), top = Math.max.apply(null, houses.concat([0]));
  return { ngS: (ng / tot * 100).toFixed(2) + '%', topS: (top / tot * 100).toFixed(2) + '%', worst: (top + ng) / tot * 100, n: blanks.length };
}
async function sentenceChecks() {
  console.log('--- 5. the AMC sentence (Observations) and the AMC-slide insight ---');
  /* (i) 40% with no AMC, four named houses at 15% each */
  {
    const H = [1.5, 1.5, 1.5, 1.5], N = [1, 1, 1, 1], w = want(H, N);
    const m = review(mixBook(H, N)), sl = await amcSlide(m), ob = obsAmc(m);
    console.log('  (i) not given ' + w.ngS + ', largest ' + w.topS + ', largest plus not given ' + w.worst.toFixed(2) + '%');
    console.log('      Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(w.ngS === '40.00%' && w.worst > 20 && ob.indexOf(w.ngS) >= 0 && !WELL.test(ob) && !DASH.test(ob) &&
       !!sl.insight && sl.insight.indexOf(w.ngS) >= 0 && !WELL.test(sl.insight) && !DASH.test(sl.insight),
       '(i) 40.00% with no AMC beside four houses at 15.00%: the Observations sentence and the AMC-slide insight give 40.00%, ' +
       'neither says "well diversified" (15.00 + 40.00 = 55.00% could pass the cap), no en or em dash');
  }
  /* (ii) every mutual fund without an AMC */
  {
    const H = [], N = [1, 2, 1], w = want(H, N);
    const m = review(mixBook(H, N)), sl = await amcSlide(m), ob = obsAmc(m);
    console.log('  (ii) chart ' + J({ cats: sl.cats, vals: sl.vals, colors: sl.colors }));
    console.log('      Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(!!sl.insight && !WELL.test(sl.insight) && !DASH.test(sl.insight) &&
       J(sl.cats) === J([NG]) && J(sl.vals) === J([100]) && J(sl.colors) === J(['BFBFBF']),
       '(ii) no AMC on any mutual fund: the insight does not say "well diversified", and the slide shows a single grey (#BFBFBF) "AMC not given" bar at 100%');
    ok(w.ngS === '100.00%' && ob.indexOf(w.ngS) >= 0 && ob.indexOf(String(w.n)) >= 0 && !WELL.test(ob) && !DASH.test(ob),
       '(ii) the Observations give the count (3) and 100.00% with no AMC, and do not say "well diversified"');
  }
  /* (iii) 2% with no AMC: "well diversified" depends on the largest house plus that share */
  {
    const H = [1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4], N = [0.2], w = want(H, N);
    const m = review(mixBook(H, N)), sl = await amcSlide(m), ob = obsAmc(m);
    console.log('  (iii) seven houses at ' + w.topS + ', not given ' + w.ngS + ', largest plus not given ' + w.worst.toFixed(2) + '%');
    console.log('      Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(w.ngS === '2.00%' && w.worst <= 20 && ob.indexOf(w.ngS) >= 0 && WELL.test(ob) && !!sl.insight && sl.insight.indexOf(w.ngS) >= 0 && WELL.test(sl.insight) &&
       !DASH.test(ob) && !DASH.test(sl.insight),
       '(iii) 2.00% with no AMC beside houses at 14.00%: 14.00 + 2.00 = 16.00% stays within the cap, so both texts say well diversified and give 2.00%');
  }
  {
    const H = [1.9, 1.9, 1.9, 1.9, 1.9, 0.3], N = [0.2], w = want(H, N);
    const m = review(mixBook(H, N)), sl = await amcSlide(m), ob = obsAmc(m);
    console.log('  (iii) largest house ' + w.topS + ', not given ' + w.ngS + ', largest plus not given ' + w.worst.toFixed(2) + '%');
    console.log('      Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(w.ngS === '2.00%' && w.worst > 20 && (m.amc.breaches || []).length === 0 && ob.indexOf(w.ngS) >= 0 && !WELL.test(ob) &&
       !!sl.insight && sl.insight.indexOf(w.ngS) >= 0 && !WELL.test(sl.insight),
       '(iii) the same 2.00% beside a largest house at 19.00%: 19.00 + 2.00 = 21.00% could pass the cap, so neither text says well diversified');
    ok(!DASH.test(ob) && !!sl.insight && !DASH.test(sl.insight),
       '(iii) 19.00% + 2.00%: no en or em dash in the Observations sentence or the insight');
  }
  /* (iv) the capSafe boundary. Known answer: a house is a breach above 20.0% (a house at exactly
     20.00% is not), so the book is cap-safe when the largest house plus the share with no AMC is at
     most 20.00%. Cross-check on the engine's own breach test: the same book with the holdings with
     no AMC labelled as the largest house must show that house as a breach exactly when capSafe is false. */
  async function capCase(H, N) {
    const w = want(H, N), m = review(mixBook(H, N)), sl = await amcSlide(m), ob = obsAmc(m);
    const topName = 'Synthetic House ' + String.fromCharCode(65 + H.indexOf(Math.max.apply(null, H)));
    const merged = review(mixBook(H, []).concat(N.map((c, i) => row({ name: 'Synthetic Mix Fund N' + (i + 1), amc: topName, cmvCr: c }))));
    const mTop = amcRows(merged).filter(r => r.amc === topName)[0] || null;
    console.log('  (iv) largest house ' + topName + ' ' + w.topS + ', not given ' + w.ngS + ', largest plus not given ' + w.worst.toFixed(2) + '%' +
      '; capSafe ' + J(m.amc.notGiven ? m.amc.notGiven.capSafe : undefined) + '; merged ' + J(mTop && { pct: r2(mTop.pct), breach: mTop.breach }));
    console.log('      Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    return { w, m, sl, ob, ng: m.amc.notGiven || null, mTop, topName };
  }
  {
    const H = [2.25, 2, 2, 2, 2, 2], N = [0.25], c = await capCase(H, N), w = c.w;
    pre(w.topS === '18.00%' && w.ngS === '2.00%' && w.worst === 20,
        '(iv) the fixture sits on the boundary: ' + w.topS + ' + ' + w.ngS + ' = ' + w.worst.toFixed(2) + '% exactly (no rounding), from the rows (12.50 Cr book)');
    ok(!!c.ng && c.ng.capSafe === true && (c.m.amc.breaches || []).length === 0 && !!c.mTop && c.mTop.pct === 20 && c.mTop.breach === false,
       '(iv) 18.00% + 2.00% = 20.00%: model.amc.notGiven.capSafe === true, and with that 2.00% in ' + c.topName + ' it is at 20.00%, not a breach (got capSafe ' +
       J(c.ng ? c.ng.capSafe : undefined) + ')');
    ok(WELL.test(c.ob) && c.ob.indexOf(w.ngS) >= 0 && !!c.sl.insight && WELL.test(c.sl.insight) && c.sl.insight.indexOf(w.ngS) >= 0 &&
       !DASH.test(c.ob) && !DASH.test(c.sl.insight),
       '(iv) 18.00% + 2.00% = 20.00%: the Observations sentence and the AMC-slide insight both say well diversified and give 2.00%; no en or em dash');
  }
  {
    const H = [1.81, 1.6, 1.6, 1.6, 1.6, 1.59], N = [0.2], c = await capCase(H, N), w = c.w;
    pre(w.topS === '18.10%' && w.ngS === '2.00%' && w.worst > 20 && w.worst.toFixed(2) === '20.10',
        '(iv) the fixture sits just above the boundary: ' + w.topS + ' + ' + w.ngS + ' = ' + w.worst.toFixed(2) + '%, from the rows (10.00 Cr book)');
    ok(!!c.ng && c.ng.capSafe === false && (c.m.amc.breaches || []).length === 0 && !!c.mTop && c.mTop.breach === true && r2(c.mTop.pct) === 20.1,
       '(iv) 18.10% + 2.00% = 20.10%: model.amc.notGiven.capSafe === false, and with that 2.00% in ' + c.topName + ' it is at 20.10%, a breach (got capSafe ' +
       J(c.ng ? c.ng.capSafe : undefined) + ')');
    const CANNOT = /cannot be confirmed/;
    ok(!WELL.test(c.ob) && c.ob.indexOf(w.ngS) >= 0 && CANNOT.test(c.ob) && !!c.sl.insight && !WELL.test(c.sl.insight) &&
       c.sl.insight.indexOf(w.ngS) >= 0 && CANNOT.test(c.sl.insight) && !DASH.test(c.ob) && !DASH.test(c.sl.insight),
       '(iv) 18.10% + 2.00% = 20.10%: neither text says well diversified; both give 2.00% and say diversification cannot be confirmed; no en or em dash');
  }
  /* (v) wording where every mutual fund names its house */
  {
    const H = [2.5, 1.5, 1.5, 1.5, 1.5, 1.5], w = want(H, []);
    const m = review(mixBook(H, [])), sl = await amcSlide(m), ob = obsAmc(m);
    const lead = 'Synthetic House A (' + w.topS + ') breaches the 20% per-AMC cap.';
    console.log('  (v) one breach, ' + w.topS + '; Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(w.topS === '25.00%' && (m.amc.breaches || []).length === 1 && !!sl.insight && sl.insight.indexOf(lead) === 0 && !DASH.test(sl.insight),
       '(v) a single breaching house: the insight reads ' + J(lead) + ' with no en or em dash');
    ok(ob.indexOf('Synthetic House A (' + w.topS + ') breaches Centricity\'s 20% per-AMC cap of the mutual-fund book.') === 0 && !DASH.test(ob),
       '(v) a single breaching house: the Observations sentence says "breaches" too, with no en or em dash');
  }
  {
    const H = [1.8, 1.7, 1.7, 1.6, 1.6, 1.6], w = want(H, []);
    const m = review(mixBook(H, [])), sl = await amcSlide(m), ob = obsAmc(m);
    /* main's sentence (EF2FF4F1), word for word, with the largest house and its share from the rows */
    const mainSays = 'No single fund house exceeds Centricity\'s 20% per-AMC cap (largest is Synthetic House A at ' + w.topS +
      '), indicating well-diversified AMC exposure across the mutual-fund book.';
    console.log('  (v) no breach, largest ' + w.topS + '; Observations: ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(w.topS === '18.00%' && !m.amc.notGiven && (m.observations.currentPortfolio.amcAllocation || []).length === 1 && ob === mainSays,
       '(v) every fund names its house, no breach: the Observations sentence is unchanged from main: ' + J(mainSays));
    ok(!!sl.insight && !DASH.test(sl.insight) && WELL.test(sl.insight) && sl.insight.indexOf('Synthetic House A at ' + w.topS) >= 0,
       '(v) every fund names its house, no breach: the insight says well diversified, names Synthetic House A at ' + w.topS + ', and has no en or em dash');
  }
  /* a book with breaches: both texts still give the share with no AMC (book 1: 30.00%) */
  {
    const sl = await amcSlide(m1), ob = obsAmc(m1);
    console.log('  breaches, book 1: Observations ' + J(ob));
    console.log('      insight     : ' + J(sl.insight));
    ok(ob.indexOf('30.00%') >= 0 && !!sl.insight && sl.insight.indexOf('30.00%') >= 0 && sl.insight.indexOf('Synthetic House Alpha (25.00%)') >= 0 &&
       !DASH.test(ob) && !DASH.test(sl.insight),
       'book 1 (Alpha and Beta breach): the Observations and the insight name the breaches and give the 30.00% with no AMC');
  }
}

slideChecks().then(sentenceChecks).then(() => {
  screenChecks();
  console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all OD-34 checks passed'));
  process.exit(fail ? 1 : 0);
}).catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
