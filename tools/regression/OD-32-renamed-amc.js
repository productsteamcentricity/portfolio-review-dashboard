/* ============================================================================
   OD-32 (owner decision of 21 Oct 2026; fix batch 2a) — renamed fund houses
   count as their current house.

   The KI-061 house key knew each house only by its current name, so a base file
   that still carries a former name split one house in two: "IDFC" beside
   "Bandhan", "L&T" beside "HSBC", "Reliance" beside "Nippon India", "DSP
   BlackRock" beside "DSP", "Birla Sun Life" beside "Aditya Birla Sun Life",
   "IIFL" beside "360 ONE". Each part was measured against the 20% cap on its
   own, and a destination named off its scheme ("Bandhan Small Cap Fund ...")
   never met the house held as "IDFC". The former names are now aliases of the
   current house, and a mutual-fund row under a former name shows the current
   house's name. Rows outside the mutual-fund book (a "Larsen & Toubro Ltd." or
   "IDFC First Bank Ltd." stock, a PMS) are never renamed or counted (as KI-061).

   Known answers (independent of the engine's AMC keys):
     1. ENGINE.amcKey gives a former name the key of its current house; other
        names that merely start alike stay apart ("IDFC First Bank", "Reliance
        Industries", "IIFL Finance"). It also pins the spellings the lead approved
        on 22 Oct 2026 ("L and T", "Larsen and Toubro", "Reliance Nippon",
        "Reliance Nippon Life", "Birla SL"); "IIFL Wealth" is not 360 ONE.
     2. AMC tab, a 10.00 Cr mutual-fund book written here: Bandhan 1.00 ("IDFC")
        + 1.50 ("Bandhan Mutual Fund") = 2.50 Cr 25.00% (a breach); Aditya Birla
        Sun Life 1.00 ("Birla Sun Life") + 1.00 ("ABSL") = 20.00% (not a breach:
        the cap is "above 20%"); HSBC 0.50 ("L&T") + 0.25 ("L and T Mutual Fund")
        + 0.25 ("Larsen & Toubro MF") + 0.50 ("HSBC Mutual Fund") = 15.00%; Nippon
        India ("Reliance"), DSP ("DSP BlackRock"), 360 ONE ("IIFL") and "Axis
        Mutual Fund" 10.00% each. Seven rows; the only breach is Bandhan. The
        stocks and the PMS (3.50 Cr) are outside the book.
     3. Every mutual-fund row shows its current house's name; the stock and PMS
        rows keep their own labels ("Larsen & Toubro Ltd", "IDFC First Bank",
        "L&T", "IIFL").
     4. AI Analyst: a house held at 19.00% of CMV under its FORMER name stays at
        or under the 20% cap when the plan's destinations include its current
        top-3 schemes (the house's exposure is recomputed here from the scheme
        names' brand prefix and the test's own rows). A house at 5.00% under
        "IDFC" takes at most 15% of CMV in all (top-ups of its own funds plus any
        new Bandhan scheme), every such destination named "Bandhan"; counted as
        two houses it went 5% -> 30%.
     5. The AI Analyst's largest AMC before the plan is Bandhan, 25.00%.
     6. Exports: the XLSX "AMC Allocation" sheet lists the current names; the
        "Base File" sheet keeps each row's uploaded label (as on main, KI-061 §8).

   Synthetic rows built here; the scheme names of real funds come from the
   embedded reference data (FUND_RANKS / MF_PERF), never from client data.
     node tools/regression/OD-32-renamed-amc.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF, XLSX } = load();
const FR = REF.FUND_RANKS || {}, MP = REF.MF_PERF || {};

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const r2 = v => Math.round(v * 100) / 100;
const J = x => JSON.stringify(x);

function row(o) {
  return Object.assign({
    client: 'Test Client', name: '', amc: '', product: 'Mutual Funds', asset: 'Equity',
    category: 'Flexi Cap', distributor: 'Centricity', folio: '1', units: 1000,
    invR: 10000000, mvR: 12000000, glR: 2000000, invCr: 1, cmvCr: 1.2, glCr: 0.2,
    xirrFrac: 0.12, bmxirrFrac: 0.10, days: 900
  }, o);
}
const review = rows => E.computeReview(rows, REF, { familyName: 'OD-32', asOnDate: '30 Sep 2026' });

/* ---------- 1. the key ---------- */
console.log('--- 1. ENGINE.amcKey: a former name is its current house ---');
const K = E.amcKey;
function same(labels, house) {
  const ks = labels.map(K);
  ok(ks[0] !== '' && ks.every(k => k === ks[0]), house + ': ' + labels.map(l => '"' + l + '"').join(', ') +
     ' share one key (got ' + Array.from(new Set(ks)).join(' | ') + ')');
}
function differ(a, b) { ok(K(a) !== K(b), '"' + a + '" and "' + b + '" are different houses (' + K(a) + ' / ' + K(b) + ')'); }
same(['Bandhan', 'Bandhan Mutual Fund', 'IDFC', 'IDFC Mutual Fund', 'IDFC MF', 'idfc'], 'Bandhan');
/* the extra spellings the lead approved on 22 Oct 2026: "L and T", "Larsen and Toubro", "Reliance Nippon",
   "Reliance Nippon Life", "Birla SL"; "IIFL Wealth" stays out (below) */
same(['HSBC', 'HSBC Mutual Fund', 'L&T', 'L&T Mutual Fund', 'L & T', 'L and T', 'L and T Mutual Fund', 'Larsen & Toubro MF',
      'Larsen and Toubro', 'Larsen and Toubro Mutual Fund', 'L&T Investment Management'], 'HSBC');
same(['Nippon India', 'Nippon India Mutual Fund', 'Reliance', 'Reliance Mutual Fund', 'Reliance MF', 'Reliance Nippon',
      'Reliance Nippon Life', 'Reliance Nippon Life Mutual Fund'], 'Nippon India');
same(['DSP', 'DSP Mutual Fund', 'DSP BlackRock', 'DSP Black Rock', 'DSP BlackRock Mutual Fund'], 'DSP');
same(['Aditya Birla Sun Life', 'ABSL', 'Birla Sun Life', 'Birla Sun Life Mutual Fund', 'Birla SunLife', 'Birla SL', 'Birla SL MF'], 'Aditya Birla Sun Life');
same(['360 ONE', '360 ONE Mutual Fund', 'IIFL', 'IIFL Mutual Fund', 'IIFL MF'], '360 ONE');
differ('IDFC First Bank', 'Bandhan');
differ('IDFC First Bank Ltd.', 'IDFC');
differ('Reliance Industries', 'Nippon India');
differ('IIFL Finance', '360 ONE');
differ('IIFL Wealth', '360 ONE');
differ('Bandhan', 'HSBC');

/* ---------- 2 & 3. the AMC tab and the rows' names ---------- */
console.log('--- 2. AMC Allocation tab: one row per current house ---');
const MFROWS = [
  ['Synthetic Fund I1', 'IDFC', 1.0, 'Bandhan'],
  ['Synthetic Fund B1', 'Bandhan Mutual Fund', 1.5, 'Bandhan'],
  ['Synthetic Fund L1', 'L&T', 0.5, 'HSBC'],
  ['Synthetic Fund L2', 'L and T Mutual Fund', 0.25, 'HSBC'],
  ['Synthetic Fund L3', 'Larsen & Toubro MF', 0.25, 'HSBC'],
  ['Synthetic Fund H1', 'HSBC Mutual Fund', 0.5, 'HSBC'],
  ['Synthetic Fund R1', 'Reliance', 1.0, 'Nippon India'],
  ['Synthetic Fund D1', 'DSP BlackRock', 1.0, 'DSP'],
  ['Synthetic Fund S1', 'Birla Sun Life', 1.0, 'Aditya Birla Sun Life'],
  ['Synthetic Fund A1', 'ABSL', 1.0, 'Aditya Birla Sun Life'],
  ['Synthetic Fund F1', 'IIFL', 1.0, '360 ONE'],
  ['Synthetic Fund X1', 'Axis Mutual Fund', 1.0, 'Axis Mutual Fund']
];
const OTHER = [
  ['Larsen & Toubro Ltd.', 'Larsen & Toubro Ltd', 'Direct Equity', 2.0],
  ['IDFC First Bank Ltd.', 'IDFC First Bank', 'Direct Equity', 1.0],
  ['Synthetic L&T Stock Row', 'L&T', 'Direct Equity', 0.5],
  ['Synthetic IIFL Portfolio', 'IIFL', 'PMS', 0.5]
];
const book = MFROWS.map(([n, a, c]) => row({ name: n, amc: a, cmvCr: c, invCr: c * 0.9 }))
  .concat(OTHER.map(([n, a, p, c]) => row({ name: n, amc: a, product: p, category: p === 'PMS' ? 'Multi Cap' : 'Large Cap', cmvCr: c, invCr: c * 0.8 })));
const m = review(book);
/* independent: the houses of the book, from the test's own mapping */
const want = {};
MFROWS.forEach(([, , c, h]) => { want[h] = (want[h] || 0) + c; });
const mfTot = MFROWS.reduce((a, r) => a + r[2], 0);
const rows = (m.amc && m.amc.rows) || [];
console.log('  AMC rows: ' + rows.map(r => '"' + r.amc + '" ' + r2(r.cmv).toFixed(2) + ' Cr ' + r2(r.pct).toFixed(2) + '%' + (r.breach ? ' (breach)' : '')).join(' | '));
ok(Math.abs(m.amc.mfTotal - 10) < 1e-9 && Math.abs(mfTot - 10) < 1e-9, 'the mutual-fund book is 10.00 Cr (the stocks and the PMS are outside it)');
ok(rows.length === Object.keys(want).length, 'one row per current house: ' + Object.keys(want).length + ' rows (got ' + rows.length + ')');
Object.keys(want).forEach(h => {
  const r = rows.filter(x => x.amc === h);
  const p = want[h] / mfTot * 100;
  ok(r.length === 1 && Math.abs(r[0].cmv - want[h]) < 1e-9 && Math.abs(r[0].pct - p) < 1e-9 && r[0].breach === (p > 20 + 1e-9),
     '"' + h + '": ' + want[h].toFixed(2) + ' Cr, ' + p.toFixed(2) + '%' + (p > 20 + 1e-9 ? ', a breach' : '') + ' (got ' +
     (r.length ? r.map(x => r2(x.cmv).toFixed(2) + ' Cr ' + r2(x.pct).toFixed(2) + '% breach ' + x.breach).join('; ') : 'no row') + ')');
});
ok((m.amc.breaches || []).map(b => b.amc).join(',') === 'Bandhan', 'the only breach is Bandhan, 25.00% (got ' + J((m.amc.breaches || []).map(b => b.amc + ' ' + r2(b.pct))) + ')');

console.log('--- 3. each row\'s name ---');
const nameOf = n => (m.holdings.filter(h => h.name === n)[0] || {}).amcDisplay;
const badMf = MFROWS.filter(([n, , , h]) => nameOf(n) !== h);
ok(badMf.length === 0, 'every mutual-fund row shows its current house' + (badMf.length ? ': ' + badMf.map(([n, a, , h]) =>
  '"' + a + '" shows "' + nameOf(n) + '", want "' + h + '"').join('; ') : ' (IDFC -> Bandhan, L&T -> HSBC, Reliance -> Nippon India, DSP BlackRock -> DSP, Birla Sun Life -> Aditya Birla Sun Life, IIFL -> 360 ONE)'));
const badOther = OTHER.filter(([n, a]) => nameOf(n) !== a);
ok(badOther.length === 0, 'the stock and PMS rows keep their own labels (' + OTHER.map(([n]) => '"' + nameOf(n) + '"').join(', ') + ')');

/* ---------- 5. the AI Analyst's largest AMC before the plan ---------- */
console.log('--- 5. AI Analyst: the largest house before the plan ---');
{
  const P = E.aiaCompute(m, REF, {});
  const sm = P.summary || {};
  ok(sm.amcBeforeWho === 'Bandhan' && sm.amcBefore === 25, 'largest AMC before is Bandhan 25.00% (got ' + sm.amcBeforeWho + ' ' + sm.amcBefore + '%)');
}

/* ---------- 4. the 20% cap holds for a house held under its former name ---------- */
console.log('--- 4. AI Analyst 20% house cap, house held under its former name ---');
const assetOf = k => (MP[k] && MP[k].type === 'debt') ? 'Debt' : (MP[k] && MP[k].type === 'hybrid') ? 'Hybrid' : 'Equity';
/* as KI-061 §3: the house is held at houseCr (two synthetic funds labelled with the
   former name), a weak 3.7 Cr fund of another house sits in a category where the
   house has a top-3 scheme, and six funds of other houses in another asset class fill
   the book to 10.00 Cr, so the weak fund's destinations are that category's top-3 */
function capFixture(houseRe, label, houseCr) {
  const cats = {};
  Object.keys(FR).sort().forEach(k => { const r = FR[k];
    if (houseRe.test(k) && r.rank != null && r.rank <= 3 && r.score != null && MP[k] && !cats[r.cat]) cats[r.cat] = k; });
  const cat = Object.keys(cats).sort()[0];
  if (!cat) return null;
  const S = Object.keys(FR).filter(k => FR[k].cat === cat && !houseRe.test(k) && FR[k].rank != null && MP[k])
    .sort((a, b) => (FR[b].rank - FR[a].rank) || (a < b ? -1 : 1))[0];
  if (!S) return null;
  const sAsset = assetOf(S), sTok = S.split(' ')[0];
  const seen = new Set([sTok]), FILL = [];
  Object.keys(MP).sort().forEach(k => { if (FILL.length >= 6) return; const t = k.split(' ')[0];
    if (seen.has(t) || houseRe.test(k)) return;
    if (assetOf(k) !== sAsset && MP[k].type !== 'debt' && /Reg\(G\)$/.test(k)) { seen.add(t); FILL.push(k); } });
  const fillCr = (10 - houseCr - 3.7) / FILL.length;
  const rows = [
    row({ name: 'Synthetic House Fund A', amc: label, asset: 'Equity', cmvCr: houseCr * 0.5, invCr: houseCr * 0.45 }),
    row({ name: 'Synthetic House Fund B', amc: label, asset: 'Equity', cmvCr: houseCr * 0.5, invCr: houseCr * 0.45 }),
    row({ name: S, amc: sTok, category: FR[S].cat, asset: sAsset, cmvCr: 3.7, invCr: 3.3, xirrFrac: 0.05, bmxirrFrac: 0.09 })
  ].concat(FILL.map(k => row({ name: k, amc: k.split(' ')[0], asset: assetOf(k), cmvCr: fillCr, invCr: fillCr * 0.85 })));
  const mm = review(rows);
  const P = E.aiaCompute(mm, REF, {});
  /* the house's money after the plan: its own two funds, less what they release, plus every
     destination that is one of them (a top-up) or a scheme whose NAME carries the current
     house's brand (a new addition) */
  const before = mm.holdings.filter(h => h.amc === label).reduce((a, h) => a + h.cmvCr, 0);
  let after = before; const into = [];
  P.recs.forEach(r => {
    if (r.action !== 'Retain' && /^Synthetic House Fund/.test(r.name)) after -= r.release;
    (r.destinations || []).forEach(d => { if (houseRe.test(d.name) || /^Synthetic House Fund/.test(d.name)) { after += d.amount; into.push(d); } });
  });
  return { cat, S, D: cats[cat], m: mm, P, before: before / mm.totalCMV * 100, after: after / mm.totalCMV * 100, into };
}
let ran = 0, entered = 0;
[[/^Bandhan /, 'IDFC', 'Bandhan'], [/^HSBC /, 'L&T', 'HSBC'], [/^Nippon India /, 'Reliance Mutual Fund', 'Nippon India'],
 [/^DSP /, 'DSP BlackRock', 'DSP'], [/^Aditya Birla /, 'Birla Sun Life', 'Aditya Birla Sun Life'], [/^360 ONE /, 'IIFL', '360 ONE']]
  .forEach(([re, label, house]) => {
    const f = capFixture(re, label, 1.9);
    if (!f) { console.log('NOTE  no top-3 scheme of ' + house + ' in this data vintage; the "' + label + '" scenario is not run'); return; }
    ran++;
    if (f.into.length) entered++;
    console.log('  "' + label + '" (' + house + '): ' + f.cat + ', weak fund ' + f.S + ' (' + FR[f.S].rank + '/' + FR[f.S].of + '), house top-3 ' + f.D);
    ok(Math.abs(f.before - 19) < 1e-9, '"' + label + '": the house starts at 19.00% of CMV');
    ok(f.after <= 20 + 0.005, '"' + label + '": ' + house + ' is at or under the 20% cap after the plan: ' + r2(f.before).toFixed(2) + '% -> ' +
       r2(f.after).toFixed(2) + '%' + (f.into.length ? ' (' + f.into.map(d => d.name + ' ' + d.amount + ' Cr, AMC "' + d.amc + '"').join('; ') + ')' : ''));
    const S = f.P.summary;
    ok(S.amcAfter != null && S.amcAfter + 0.005 >= r2(f.after), '"' + label + '": the summary\'s largest AMC after (' + S.amcAfter + '% ' +
       S.amcAfterWho + ') is not below the house\'s true ' + r2(f.after).toFixed(2) + '%');
  });
ok(ran >= 3, 'at least three renamed-house scenarios ran (' + ran + ')');

/* A house at 5.00% held as "IDFC" (two synthetic funds of 0.25 Cr). The weak fund's 3.70 Cr
   can top up the house's own funds (0.75 Cr each to the 10% fund cap) AND open a position in
   a top-3 Bandhan scheme (1.00 Cr). All of it is Bandhan's money, so the house may take at
   most 20% - 5% = 15% of 10.00 Cr = 1.50 Cr in all: it must end at or under 20.00%. Counting
   "IDFC" and "Bandhan" as two houses, the plan put 1.50 + 1.00 Cr in (5% -> 30%). */
console.log('--- 4b. top-ups of the "IDFC" funds and a new Bandhan scheme share one cap ---');
{
  const f = capFixture(/^Bandhan /, 'IDFC', 0.5);
  if (!f) ok(false, 'a category with a top-3 Bandhan scheme exists this cycle');
  else {
    const row0 = (f.m.amc.rows || []).filter(r => r.key === K('Bandhan'))[0];
    ok(!!row0 && row0.amc === 'Bandhan' && Math.abs(row0.pct - 5) < 1e-9, 'the AMC tab shows the house as "Bandhan" at 5.00% of the MF book (got ' +
       (row0 ? '"' + row0.amc + '" ' + r2(row0.pct) + '%' : (f.m.amc.rows || []).map(r => '"' + r.amc + '" ' + r2(r.pct) + '%').join(', ')) + ')');
    console.log('  into the house: ' + f.into.map(d => d.kind + ' ' + d.name + ' ' + d.amount + ' Cr, AMC "' + d.amc + '"').join('; '));
    ok(f.into.length > 0, 'the plan puts money into the house (precondition)');
    ok(f.after <= 20 + 0.005, 'the house ends at or under the 20% cap: ' + r2(f.before).toFixed(2) + '% -> ' + r2(f.after).toFixed(2) + '%');
    ok(f.into.length > 0 && f.into.every(d => d.amc === 'Bandhan' && d.amcKey === K('IDFC')),
       'every destination into the house carries the name "Bandhan" and the one house key (got ' + f.into.map(d => '"' + d.amc + '" / ' + d.amcKey).join(', ') + ')');
  }
}

/* ---------- 6. exports ---------- */
console.log('--- 6. XLSX ---');
{
  const wb = E.buildXLSX(m, XLSX);
  const am = XLSX.utils.sheet_to_json(wb.Sheets['AMC Allocation'], { header: 1, raw: true });
  const names = am.slice(1).filter(r => r && r[0] && typeof r[1] === 'number').map(r => r[0]);
  ok(Object.keys(want).every(h => names.indexOf(h) >= 0) && names.length === Object.keys(want).length,
     'the "AMC Allocation" sheet lists the current houses (' + J(names) + ')');
  const bf = XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true });
  const hdr = bf[0] || [], ci = hdr.indexOf('Instrument Name'), ca = hdr.indexOf('AMC');
  const up = {}; MFROWS.forEach(([n, a]) => { up[n] = a; }); OTHER.forEach(([n, a]) => { up[n] = a; });
  const bad = bf.slice(1).filter(r => r && r[ci] && (r[ci] in up) && r[ca] !== E.amcDisplay(up[r[ci]]));
  ok(bad.length === 0 && E.amcDisplay('IDFC') === 'IDFC', 'the "Base File" sheet keeps each row\'s uploaded label, as on main ("IDFC" stays "IDFC")' +
     (bad.length ? ' — ' + bad.map(r => r[ci] + ': "' + r[ca] + '"').join('; ') : ''));
}

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all OD-32 checks passed'));
process.exit(fail ? 1 : 0);
