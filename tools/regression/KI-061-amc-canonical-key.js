/* ============================================================================
   KI-061 (audit 2026-10-19, NEW-15) — one canonical key per fund house.

   A held fund's AMC came from the base-file label ("PPFAS", "HDFC Mutual Fund")
   while a destination the portfolio does not hold was named off its scheme name
   ("Parag Parikh ..." -> "PPFAS (Parag Parikh)", "HDFC ..." -> "HDFC"). Every
   AMC total and the AI Analyst's 20% house cap were keyed by those names, so the
   two never met: the plan put a 10% new position into a house already at 19%
   (19% -> 29% of CMV) and the summary still read 19%. Mixed labels of one house
   also split the AMC Allocation tab into several rows.

   Known answers (all independent of the engine's AMC keys):
     1. ENGINE.amcKey gives one key to the spellings of one house, and different
        keys to different houses (whole words: Quant is not Quantum).
     2. AMC tab: a book with HDFC under three labels and SBI under two shows one
        row per house with the summed CMV (3.0 / 5.0 / 2.0 of a 10.0 Cr MF book
        -> 30% / 50% / 20%); a house under one label keeps that label as its name.
     3. AI Analyst: a house at 19.00% of CMV, labelled "PPFAS" / "HDFC Mutual
        Fund" / "ABSL", stays at or under the 20% cap after the plan. The house's
        exposure is recomputed here from the scheme names (brand prefix), not
        from any engine key.
     4. A destination into a held house carries the house's AMC-tab name.
   Added by the review of the first round (F1, F4 and optional note 4):
     2b. Only mutual-fund-book rows take part in, and take, a house's one name; a
        PMS keeps its own label and its CMV does not choose the name.
     5. A stock or PMS that shares a fund house's key (a stock "HDFC Asset
        Management Company Ltd.", a PMS "ICICI Prudential AMC" or "ICICI
        Prudential") is outside the mutual-fund book: trimming it frees none of the
        house's room. HDFC / ICICI funds stay at 1.50 Cr (18.75% of the 8.00 Cr
        mutual-fund book) and the summary's largest-AMC-after is not below that.
     6. A PMS top-up is neither tested against nor booked to a fund house: it gets
        its full 0.50 Cr headroom.
     7. A Regular plan labelled "HDFC" and its Direct plan labelled "HDFC Mutual
        Fund" merge into one position; the house (19%) stays within the cap.
     8. The XLSX "Base File" sheet's AMC column is as on main: amcDisplay of the
        row's own uploaded label ("Aditya" -> "Aditya Birla Sun Life", "woc" ->
        "WhiteOak Capital", an unlisted label as typed), never the one name per
        house the AMC tab shows ("HDFC Mutual Fund" stays "HDFC Mutual Fund").

   Synthetic rows built here; the scheme names of real funds come from the
   embedded reference data (FUND_RANKS / MF_PERF), never from client data.
     node tools/regression/KI-061-amc-canonical-key.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF } = load();
const FR = REF.FUND_RANKS || {}, MP = REF.MF_PERF || {};

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const r2 = v => Math.round(v * 100) / 100;

function row(o) {
  return Object.assign({
    client: 'Test Client', name: '', amc: '', product: 'Mutual Funds', asset: 'Equity',
    category: 'Flexi Cap', distributor: 'Centricity', folio: '1', units: 1000,
    invR: 10000000, mvR: 12000000, glR: 2000000, invCr: 1, cmvCr: 1.2, glCr: 0.2,
    xirrFrac: 0.12, bmxirrFrac: 0.10, days: 900
  }, o);
}
const review = rows => E.computeReview(rows, REF, { familyName: 'KI-061', asOnDate: '30 Sep 2026' });

/* ---------- 1. the key function ---------- */
console.log('--- 1. ENGINE.amcKey ---');
const hasKey = typeof E.amcKey === 'function';
ok(hasKey, 'ENGINE.amcKey is exposed');
const K = hasKey ? E.amcKey : (s => 'no-amcKey:' + s);
function same(labels, house) {
  const ks = labels.map(K);
  ok(ks[0] !== '' && ks.every(k => k === ks[0]), house + ': ' + labels.map(l => '"' + l + '"').join(', ') +
     ' share one key (' + Array.from(new Set(ks)).join(' | ') + ')');
}
function differ(a, b) { ok(K(a) !== K(b), '"' + a + '" and "' + b + '" are different houses (' + K(a) + ' / ' + K(b) + ')'); }
same(['PPFAS', 'PPFAS Mutual Fund', 'PPFAS MF', 'Parag Parikh', 'Parag Parikh Mutual Fund', 'Parag', 'PPFAS (Parag Parikh)'], 'PPFAS');
same(['HDFC', 'HDFC Mutual Fund', 'HDFC MF', 'hdfc mutual fund', 'HDFC Asset Management Company Ltd.', 'HDFC AMC'], 'HDFC');
same(['ABSL', 'ABSL MF', 'Aditya', 'Aditya Birla SL', 'Aditya Birla Sun Life', 'Aditya Birla Sun Life Mutual Fund'], 'Aditya Birla Sun Life');
same(['ICICI', 'ICICI Pru', 'ICICI Prudential', 'ICICI Prudential Mutual Fund'], 'ICICI Prudential');
same(['Nippon', 'Nippon India', 'Nippon India Mutual Fund'], 'Nippon India');
same(['WOC', 'WhiteOak Capital', 'WhiteOak Capital Mutual Fund'], 'WhiteOak Capital');
same(['BOI', 'Bank of India', 'Bank of India Mutual Fund'], 'Bank of India');
same(['Invesco', 'Invesco India', 'Invesco India Mutual Fund'], 'Invesco');
same(['TRUSTMF', 'TRUST MF', 'Trust Mutual Fund'], 'TRUST MF');
same(['Old Bridge', 'Old Bridge Mutual Fund', 'OLD BRIDGE MF'], 'a house the engine does not list');
differ('Quant', 'Quantum');
differ('Quant Mutual Fund', 'Quantum Mutual Fund');
differ('HDFC', 'ICICI Prudential');
differ('Bank of India', 'Baroda BNP Paribas');
differ('Kotak Mahindra', 'Mahindra Manulife');
ok(K('') === '', 'a blank label has the blank key (no AMC to test against)');

/* ---------- 2. AMC tab: one row per house ---------- */
console.log('--- 2. AMC Allocation tab ---');
{
  const m = review([
    row({ name: 'Synthetic Fund H1', amc: 'HDFC', cmvCr: 1.0 }),
    row({ name: 'Synthetic Fund H2', amc: 'HDFC Mutual Fund', cmvCr: 1.5 }),
    row({ name: 'Synthetic Fund H3', amc: 'HDFC MF', cmvCr: 0.5 }),
    row({ name: 'Synthetic Fund S1', amc: 'SBI Mutual Fund', cmvCr: 3.0 }),
    row({ name: 'Synthetic Fund S2', amc: 'SBI', cmvCr: 2.0 }),
    row({ name: 'Synthetic Fund A1', amc: 'Axis Mutual Fund', cmvCr: 2.0 }),
    row({ name: 'Synthetic Fund O1', amc: 'Old Bridge Mutual Fund', cmvCr: 0.4, product: 'PMS' }),
    row({ name: 'Synthetic Fund O2', amc: 'Old Bridge', cmvCr: 0.6, product: 'PMS' })
  ]);
  const rows = m.amc.rows || [];
  console.log('  AMC rows: ' + rows.map(r => '"' + r.amc + '" ' + r2(r.cmv) + ' Cr ' + r2(r.pct) + '%').join(' | '));
  ok(rows.length === 3, 'three houses in the MF book give three rows (got ' + rows.length + ')');
  const by = n => rows.filter(r => r.amc === n)[0];
  ok(!!by('HDFC') && Math.abs(by('HDFC').cmv - 3.0) < 1e-9 && Math.abs(by('HDFC').pct - 30) < 1e-9 && by('HDFC').breach === true,
     'HDFC under "HDFC" / "HDFC Mutual Fund" / "HDFC MF" is one row named "HDFC": 3.00 Cr, 30.00%, a breach');
  ok(!!by('SBI') && Math.abs(by('SBI').cmv - 5.0) < 1e-9 && Math.abs(by('SBI').pct - 50) < 1e-9,
     'SBI under "SBI Mutual Fund" / "SBI" is one row named "SBI": 5.00 Cr, 50.00%');
  ok(!!by('Axis Mutual Fund') && Math.abs(by('Axis Mutual Fund').pct - 20) < 1e-9,
     'a house under a single label keeps that label as its name ("Axis Mutual Fund", 20.00%)');
  ok((m.amc.breaches || []).map(b => b.amc).join(',') === 'SBI,HDFC', 'the breaches are SBI and HDFC (got ' +
     (m.amc.breaches || []).map(b => b.amc).join(',') + ')');
  /* rows outside the mutual-fund book are never renamed (lead decision, F4): each keeps
     amcDisplay(its own label), which for a label AMC_DISPLAY does not list is the label */
  const ob = m.holdings.filter(h => /^Synthetic Fund O/.test(h.name)).map(h => h.amcDisplay);
  ok(ob.length === 2 && ob[0] === 'Old Bridge Mutual Fund' && ob[1] === 'Old Bridge',
     'PMS rows of one house under two labels keep their own labels ("Old Bridge Mutual Fund" / "Old Bridge"; got ' + ob.join(' / ') + ')');
}
console.log('--- 2b. one name per house: mutual-fund rows only ---');
{
  /* an unlisted house under two labels in the mutual-fund book (0.4 + 0.6 Cr), and a 5.0 Cr
     PMS carrying the other label: the house is named by the label with more MUTUAL-FUND CMV
     ("Old Bridge", 0.6 > 0.4); the PMS's CMV does not count and the PMS rows keep their labels */
  const m = review([
    row({ name: 'Synthetic Fund O1', amc: 'Old Bridge Mutual Fund', cmvCr: 0.4 }),
    row({ name: 'Synthetic Fund O2', amc: 'Old Bridge', cmvCr: 0.6 }),
    row({ name: 'Synthetic Fund A1', amc: 'Axis', cmvCr: 1.0 }),
    row({ name: 'Synthetic PMS O3', amc: 'Old Bridge Mutual Fund', cmvCr: 5.0, product: 'PMS' }),
    row({ name: 'Synthetic PMS O4', amc: 'OLD BRIDGE MF', cmvCr: 0.1, product: 'PMS' })
  ]);
  const rows = m.amc.rows || [];
  console.log('  AMC rows: ' + rows.map(r => '"' + r.amc + '" ' + r2(r.cmv) + ' Cr ' + r2(r.pct) + '%').join(' | '));
  const obr = rows.filter(r => /old bridge/i.test(r.amc));
  ok(obr.length === 1 && obr[0].amc === 'Old Bridge' && Math.abs(obr[0].cmv - 1.0) < 1e-9 && Math.abs(obr[0].pct - 50) < 1e-9,
     'the AMC tab shows the house once, as "Old Bridge" (the label with more mutual-fund CMV): 1.00 Cr, 50.00% of the 2.00 Cr MF book (got ' +
     obr.map(r => '"' + r.amc + '" ' + r2(r.cmv) + ' Cr').join(', ') + ')');
  const nm = n => (m.holdings.filter(h => h.name === n)[0] || {}).amcDisplay;
  ok(nm('Synthetic Fund O1') === 'Old Bridge' && nm('Synthetic Fund O2') === 'Old Bridge',
     'both mutual-fund rows carry that name (got ' + nm('Synthetic Fund O1') + ' / ' + nm('Synthetic Fund O2') + ')');
  ok(nm('Synthetic PMS O3') === 'Old Bridge Mutual Fund' && nm('Synthetic PMS O4') === 'OLD BRIDGE MF',
     'the PMS rows keep their own labels (got ' + nm('Synthetic PMS O3') + ' / ' + nm('Synthetic PMS O4') + ')');
}

/* ---------- 3 & 4. AI Analyst: the 20% cap holds whatever the label ---------- */
console.log('--- 3. AI Analyst 20% house cap ---');
const assetOf = k => (MP[k] && MP[k].type === 'debt') ? 'Debt' : (MP[k] && MP[k].type === 'hybrid') ? 'Hybrid' : 'Equity';
/* the fixture: the house is held at houseCr (two synthetic funds, retained), a weak
   fund of another house in a category where the house has a top-3 fund is 3.7 Cr,
   and six funds of other houses and another asset class fill the book to 10 Cr, so
   the only destinations for the weak fund are the category's top-3 new additions */
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
  const m = review(rows);
  const P = E.aiaCompute(m, REF, {});
  /* the house's exposure, recomputed from what the plan does to the house's own rows and
     to every scheme whose NAME carries the house's brand */
  const before = m.holdings.filter(h => h.amc === label).reduce((a, h) => a + h.cmvCr, 0);
  let after = before; const into = [];
  P.recs.forEach(r => {
    if (r.action !== 'Retain' && /^Synthetic House Fund/.test(r.name)) after -= r.release;
    (r.destinations || []).forEach(d => { if (houseRe.test(d.name)) { after += d.amount; into.push(d); } });
  });
  return { cat, S, D: cats[cat], m, P, before: before / m.totalCMV * 100, after: after / m.totalCMV * 100, into };
}

let ran = 0;
[[/^Parag Parikh /, 'PPFAS'], [/^HDFC /, 'HDFC Mutual Fund'], [/^Aditya Birla /, 'ABSL']].forEach(([re, label]) => {
  const f = capFixture(re, label, 1.9);
  if (!f) { console.log('NOTE  no top-3 fund of the "' + label + '" house in this data vintage; scenario not run'); return; }
  ran++;
  console.log('  "' + label + '": ' + f.cat + ', source ' + f.S + ' (' + FR[f.S].rank + '/' + FR[f.S].of + '), house top-3 ' + f.D);
  ok(Math.abs(f.before - 19) < 1e-9, '"' + label + '" house starts at 19.00% of CMV');
  ok(f.after <= 20 + 0.005, '"' + label + '" house is at or under the 20% cap after the plan: ' + r2(f.before).toFixed(2) + '% -> ' +
     r2(f.after).toFixed(2) + '%' + (f.into.length ? ' (' + f.into.map(d => d.name + ' ' + d.amount + ' Cr, AMC "' + d.amc + '"').join('; ') + ')' : ''));
  const S = f.P.summary;
  ok(S.amcAfter != null && S.amcAfter + 0.005 >= r2(f.after), 'the summary\'s largest-AMC-after (' + S.amcAfter + '% ' + S.amcAfterWho +
     ') is not below the house\'s true ' + r2(f.after).toFixed(2) + '%');
});
ok(ran >= 2, 'at least two label scenarios ran (' + ran + ')');

console.log('--- 4. a destination into a held house carries the house\'s name ---');
{
  const f = capFixture(/^Parag Parikh /, 'PPFAS', 0.5);   /* 5%: room for a 10% new position */
  if (!f) { console.log('NOTE  no top-3 PPFAS fund in this data vintage; check not run'); }
  else {
    const row0 = (f.m.amc.rows || []).filter(r => r.amc === 'PPFAS')[0];
    ok(!!row0 && Math.abs(row0.pct - 5) < 1e-9, 'the AMC tab shows the house as "PPFAS" at 5.00% of the MF book');
    ok(f.into.length > 0, 'the plan opens a position in the house (' + f.into.map(d => d.name + ' ' + d.amount + ' Cr').join('; ') + ')');
    ok(f.into.length > 0 && f.into.every(d => d.amc === 'PPFAS'), 'that destination carries the house\'s AMC-tab name "PPFAS" (got ' +
       f.into.map(d => '"' + d.amc + '"').join(', ') + ')');
    ok(f.after <= 20 + 0.005, 'and the house stays within the cap: ' + r2(f.before).toFixed(2) + '% -> ' + r2(f.after).toFixed(2) + '%');
  }
}

/* ---------- 5. a holding outside the mutual-fund book never frees a fund house's room ---------- */
/* The book (all synthetic rows, real scheme names from the reference data):
     two synthetic funds of the house at 0.75 Cr each              1.50 Cr
     a weak 3.7 Cr fund of another house, in the first category
       (alphabetical) where the house has a top-3 scheme             3.70 Cr
     six funds of other houses in another asset class (fillers)    2.80 Cr
     = the mutual-fund book                                         8.00 Cr
     plus 2.00 Cr outside the mutual-fund book (a stock or a PMS)   10.00 Cr total
   Known answers. The house starts at 1.50 / 8.00 = 18.75% of the mutual-fund book. The
   house's figures are mutual-fund book only, so trimming the 2.00 Cr non-MF row (20% of
   the book, over the 10% holding cap) must not free any of the house's room: the room
   left is 20% x 8.00 - 1.50 = 0.10 Cr, under the 2% x 10.00 = 0.20 Cr minimum ticket,
   so no money can enter the house and its fund CMV after the plan is exactly 1.50 Cr
   (<= the 1.60 Cr cap). The house's CMV is recomputed here from the scheme names (its
   brand) and the test's own house-fund names, never from engine AMC keys or names. */
console.log('--- 5. a stock or PMS of the same group never frees a fund house\'s cap room ---');
function bookFixture(houseRe, cat0, houseRows, extraRows) {
  const cats = {};
  Object.keys(FR).sort().forEach(k => { const r = FR[k];
    if (houseRe.test(k) && r.rank != null && r.rank <= 3 && r.score != null && MP[k] && !cats[r.cat]) cats[r.cat] = k; });
  const cat = cat0 && cats[cat0] ? cat0 : Object.keys(cats).sort()[0];
  if (!cat) return null;
  const S = Object.keys(FR).filter(k => FR[k].cat === cat && !houseRe.test(k) && FR[k].rank != null && MP[k])
    .sort((a, b) => (FR[b].rank - FR[a].rank) || (a < b ? -1 : 1))[0];
  if (!S) return null;
  const sAsset = assetOf(S), sTok = S.split(' ')[0];
  const seen = new Set([sTok]), FILL = [];
  Object.keys(MP).sort().forEach(k => { if (FILL.length >= 6) return; const t = k.split(' ')[0];
    if (seen.has(t) || houseRe.test(k)) return;
    if (assetOf(k) !== sAsset && MP[k].type !== 'debt' && /Reg\(G\)$/.test(k)) { seen.add(t); FILL.push(k); } });
  const houseCr = houseRows.reduce((a, r) => a + r.cmvCr, 0);
  const fillCr = (8 - houseCr - 3.7) / FILL.length;
  const rows = houseRows.concat([
    row({ name: S, amc: sTok, category: FR[S].cat, asset: sAsset, cmvCr: 3.7, invCr: 3.3, xirrFrac: 0.05, bmxirrFrac: 0.09 })
  ]).concat(FILL.map(k => row({ name: k, amc: k.split(' ')[0], asset: assetOf(k), cmvCr: fillCr, invCr: fillCr * 0.85 })))
    .concat(extraRows);
  const m = review(rows);
  const P = E.aiaCompute(m, REF, {});
  /* the house's fund CMV after the plan: its own funds less what they release, plus every
     destination whose scheme name carries the house's brand or is one of its own funds;
     a destination that is one of the test's own non-MF rows (a PMS top-up) is not fund money */
  const own = new Set(houseRows.map(r => r.name)), nonMf = new Set(extraRows.map(r => r.name));
  const isHouse = n => !nonMf.has(n) && (houseRe.test(n) || own.has(n));
  const before = houseRows.reduce((a, r) => a + r.cmvCr, 0);
  let after = before; const into = [];
  P.recs.forEach(r => {
    if (own.has(r.name)) after -= (r.release || 0);
    (r.destinations || []).forEach(d => { if (isHouse(d.name)) { after += d.amount; into.push(d.name + ' ' + d.amount + ' Cr'); } });
  });
  return { cat, S, m, P, before, after, into };
}
const houseFunds = label => [
  row({ name: 'Synthetic House Fund A', amc: label, cmvCr: 0.75, invCr: 0.7 }),
  row({ name: 'Synthetic House Fund B', amc: label, cmvCr: 0.75, invCr: 0.7 })
];
function nonMfCase(tag, houseRe, fundLabel, extra) {
  const f = bookFixture(houseRe, 'BAF', houseFunds(fundLabel), [extra]);
  if (!f) { ok(false, tag + ': a category with a top-3 scheme of the house exists this cycle'); return; }
  const x = f.P.recs.filter(r => r.name === extra.name)[0];
  const mf = f.m.amc.mfTotal, tot = f.m.totalCMV, S = f.P.summary;
  console.log('  ' + tag + ': ' + f.cat + ', weak fund ' + f.S + '; ' + extra.product + ' "' + extra.name + '" labelled "' + extra.amc + '": ' +
    (x ? x.action + ', releases ' + x.release + ' Cr' : 'no recommendation') + '; house funds ' + r2(f.before).toFixed(2) + ' -> ' +
    r2(f.after).toFixed(2) + ' Cr' + (f.into.length ? ' (' + f.into.join('; ') + ')' : '') + '; summary largest after ' + S.amcAfter + '% ' + S.amcAfterWho);
  ok(Math.abs(mf - 8) < 1e-9 && Math.abs(tot - 10) < 1e-9 && !!x && x.release > 0,
     tag + ': the book is 8.00 Cr of mutual funds in 10.00 Cr, and the ' + extra.product + ' row is trimmed (precondition)');
  ok(Math.abs(f.after - 1.5) < 0.005 && f.after <= 0.2 * 8 + 0.005,
     tag + ': the house\'s funds stay at 1.50 Cr after the plan (<= 20% x 8.00 = 1.60 Cr); got ' + r2(f.after).toFixed(2) + ' Cr');
  const want = 1.5 / 8 * 100;
  ok(S.amcAfter != null && S.amcAfter + 0.005 >= r2(want),
     tag + ': the summary\'s largest AMC after (' + S.amcAfter + '% ' + S.amcAfterWho + ') is not below the house\'s 1.50 / 8.00 = 18.75%');
  const imp = x && (x.signals || []).filter(s => s.id === 'impact')[0];
  ok(!!imp && imp.evidence && imp.evidence.amcBefore == null && !/relieves/.test(imp.text || ''),
     tag + ': the ' + extra.product + ' row\'s impact signal carries no fund-house figure (it is outside the mutual-fund book)' +
     (imp && imp.evidence && imp.evidence.amcBefore != null ? '; got ' + imp.evidence.amcBefore + '%' : ''));
}
nonMfCase('stock, funds "HDFC"', /^HDFC /, 'HDFC',
  row({ name: 'HDFC Asset Management Company Ltd.', amc: 'HDFC Asset Management Company Ltd.', product: 'Direct Equity',
        category: 'Large Cap', cmvCr: 2.0, invCr: 1.2 }));
nonMfCase('stock, funds "HDFC Mutual Fund"', /^HDFC /, 'HDFC Mutual Fund',
  row({ name: 'HDFC Asset Management Company Ltd.', amc: 'HDFC Asset Management Company Ltd.', product: 'Direct Equity',
        category: 'Large Cap', cmvCr: 2.0, invCr: 1.2 }));
nonMfCase('PMS "ICICI Prudential AMC", funds "ICICI Prudential"', /^ICICI /, 'ICICI Prudential',
  row({ name: 'ICICI Prudential - Value Portfolio', amc: 'ICICI Prudential AMC', product: 'PMS', category: 'Multi Cap', cmvCr: 2.0, invCr: 1.2 }));
nonMfCase('PMS and funds both "ICICI Prudential"', /^ICICI /, 'ICICI Prudential',
  row({ name: 'ICICI Prudential - Value Portfolio', amc: 'ICICI Prudential', product: 'PMS', category: 'Multi Cap', cmvCr: 2.0, invCr: 1.2 }));

/* ---------- 6. a top-up outside the mutual-fund book is not tested against a fund house ---------- */
/* The same 8.00 Cr mutual-fund book with ICICI funds at 1.50 Cr (18.75%), plus a 1.50 Cr PMS of
   another manager (15% of the book, over the 10% holding cap, so it is trimmed) and a strong
   0.50 Cr ICICI PMS labelled exactly like the funds. The PMS release can only go to the other
   PMS (product class is never crossed). Known answer: that top-up is the PMS's headroom to the
   10% holding cap, (10% - 5%) x 10.00 Cr = 0.50 Cr, whatever the ICICI fund house's room
   (0.10 Cr, under the minimum ticket), and it books nothing against the fund house. */
console.log('--- 6. a PMS top-up is neither tested against nor booked to a fund house ---');
{
  const f = bookFixture(/^ICICI /, 'BAF', houseFunds('ICICI Prudential'), [
    row({ name: '2Point2 Capital - Long term Value', amc: '2Point2', product: 'PMS', category: 'Multi Cap', cmvCr: 1.5, invCr: 1.0 }),
    row({ name: 'ICICI Prudential - Pipe Portfolio', amc: 'ICICI Prudential', product: 'PMS', category: 'Multi Cap', cmvCr: 0.5, invCr: 0.4 })
  ]);
  if (!f) ok(false, 'a category with a top-3 ICICI scheme exists this cycle');
  else {
    const src = f.P.recs.filter(r => r.name === '2Point2 Capital - Long term Value')[0];
    const tgt = f.P.recs.filter(r => r.name === 'ICICI Prudential - Pipe Portfolio')[0];
    const tu = src ? src.destinations.filter(d => d.name === 'ICICI Prudential - Pipe Portfolio') : [];
    const amt = tu.reduce((a, d) => a + d.amount, 0);
    console.log('  2Point2 PMS: ' + (src ? src.action + ', releases ' + src.release + ' Cr, destinations ' +
      src.destinations.map(d => d.name + ' ' + d.amount + ' Cr').join('; ') + ', unplaced ' + src.unfunded : 'no recommendation') +
      '; ICICI PMS ' + (tgt ? tgt.action + ' composite ' + tgt.composite : 'no recommendation') + '; house funds ' + r2(f.after).toFixed(2) + ' Cr');
    ok(!!src && src.release >= 0.5 - 1e-9 && !!tgt && tgt.action === 'Retain' && tgt.composite >= 70,
       'the 2Point2 PMS releases at least 0.50 Cr and the ICICI PMS is a strong Retain (preconditions)');
    ok(Math.abs(amt - 0.5) < 1e-9, 'the ICICI PMS is topped up by its 0.50 Cr headroom to the 10% cap (got ' + r2(amt).toFixed(2) + ' Cr)');
    ok(tu.length > 0 && tu.every(d => !d.amcKey), 'that top-up carries no fund-house key (got ' + (tu.length ? tu.map(d => '"' + d.amcKey + '"').join(', ') : 'no top-up') + ')');
    ok(Math.abs(f.after - 1.5) < 0.005, 'the ICICI fund house stays at 1.50 Cr (got ' + r2(f.after).toFixed(2) + ' Cr)');
    /* ICICI is the largest house after the plan on either basis (the BAF destinations of
       other houses are 1.00 Cr each), so the summary reads its unchanged 1.50 / 8.00 =
       18.75%; booking the PMS top-up against it would read 18.75 + 0.50 / 10.00 = 23.75% */
    const S = f.P.summary;
    ok(S.amcAfter != null && Math.abs(S.amcAfter - 18.75) < 0.006, 'the summary\'s largest AMC after is the ICICI fund house\'s 18.75% (got ' +
       S.amcAfter + '% ' + S.amcAfterWho + ')');
  }
}

/* ---------- 7. Regular and Direct plans of one scheme under two labels ---------- */
/* An all-mutual-fund 10.00 Cr book. The house is 1.90 Cr = 19.00%: two synthetic funds labelled
   "HDFC" (0.50 + 0.50) and one scheme held as a Regular plan labelled "HDFC" (0.50) and a
   Direct plan labelled "HDFC Mutual Fund" (0.40), which the AI Analyst merges into one
   position. Known answers: one AMC row of 1.90 Cr / 19.00%; the merged position is one
   recommendation with both plans; the house's room is 20% - 19% = 1% of 10.00 Cr = 0.10 Cr,
   under the 0.20 Cr minimum ticket, so the house stays at 1.90 Cr (<= 2.00 Cr). */
console.log('--- 7. a Regular plan labelled "HDFC" and its Direct plan labelled "HDFC Mutual Fund" ---');
{
  const reg = 'HDFC Flexi Cap Fund - Regular Plan - Growth', dir = 'HDFC Flexi Cap Fund - Direct Plan - Growth';
  const hr = [
    row({ name: 'Synthetic House Fund A', amc: 'HDFC', cmvCr: 0.5, invCr: 0.45 }),
    row({ name: 'Synthetic House Fund B', amc: 'HDFC', cmvCr: 0.5, invCr: 0.45 }),
    row({ name: reg, amc: 'HDFC', category: 'Flexi Cap', cmvCr: 0.5, invCr: 0.4 }),
    row({ name: dir, amc: 'HDFC Mutual Fund', category: 'Flexi Cap', cmvCr: 0.4, invCr: 0.3 })
  ];
  /* the fillers bring the mutual-fund book (here the whole book) to 10.00 Cr */
  const f = (function () {
    const cats = {};
    Object.keys(FR).sort().forEach(k => { const r = FR[k];
      if (/^HDFC /.test(k) && r.rank != null && r.rank <= 3 && r.score != null && MP[k] && !cats[r.cat] && assetOf(k) !== 'Equity') cats[r.cat] = k; });
    const cat = Object.keys(cats).sort()[0];
    if (!cat) return null;
    const S = Object.keys(FR).filter(k => FR[k].cat === cat && !/^HDFC /.test(k) && FR[k].rank != null && MP[k])
      .sort((a, b) => (FR[b].rank - FR[a].rank) || (a < b ? -1 : 1))[0];
    if (!S) return null;
    const sAsset = assetOf(S), sTok = S.split(' ')[0];
    const seen = new Set([sTok]), FILL = [];
    Object.keys(MP).sort().forEach(k => { if (FILL.length >= 6) return; const t = k.split(' ')[0];
      if (seen.has(t) || /^HDFC /.test(k)) return;
      if (assetOf(k) !== sAsset && MP[k].type !== 'debt' && /Reg\(G\)$/.test(k)) { seen.add(t); FILL.push(k); } });
    const rows = hr.concat([row({ name: S, amc: sTok, category: FR[S].cat, asset: sAsset, cmvCr: 3.7, invCr: 3.3, xirrFrac: 0.05, bmxirrFrac: 0.09 })])
      .concat(FILL.map(k => row({ name: k, amc: k.split(' ')[0], asset: assetOf(k), cmvCr: 4.4 / FILL.length, invCr: 0.6 })));
    const m = review(rows);
    return { cat, S, m, P: E.aiaCompute(m, REF, {}) };
  })();
  if (!f) ok(false, 'a non-equity category with a top-3 HDFC scheme exists this cycle');
  else {
    const own = new Set(hr.map(r => r.name));
    let after = 1.9; const into = [];
    f.P.recs.forEach(r => {
      const mine = own.has(r.name) || (r.members || []).some(x => own.has(x.name));
      if (mine) after -= (r.release || 0);
      (r.destinations || []).forEach(d => { if (/^HDFC /.test(d.name) || own.has(d.name)) { after += d.amount; into.push(d.name + ' ' + d.amount + ' Cr'); } });
    });
    const rows = (f.m.amc.rows || []).filter(r => /hdfc/i.test(r.amc));
    const merged = f.P.recs.filter(r => r.merged && (r.members || []).some(x => x.name === reg) && (r.members || []).some(x => x.name === dir));
    console.log('  ' + f.cat + ', weak fund ' + f.S + '; AMC rows ' + rows.map(r => '"' + r.amc + '" ' + r2(r.cmv) + ' Cr').join(', ') +
      '; house ' + r2(after).toFixed(2) + ' Cr after' + (into.length ? ' (' + into.join('; ') + ')' : ''));
    ok(Math.abs(f.m.totalCMV - 10) < 1e-9 && merged.length === 1 && (merged[0].plans || []).join(',') === 'Direct,Regular',
       'the two plans are one recommendation with plans Direct and Regular (precondition)');
    ok(rows.length === 1 && Math.abs(rows[0].cmv - 1.9) < 1e-9 && Math.abs(rows[0].pct - 19) < 1e-9,
       'the AMC tab shows one HDFC row: 1.90 Cr, 19.00% (got ' + rows.map(r => '"' + r.amc + '" ' + r2(r.cmv) + ' Cr ' + r2(r.pct) + '%').join(', ') + ')');
    ok(after <= 2.0 + 0.005 && Math.abs(after - 1.9) < 0.005, 'the house stays at 1.90 Cr after the plan (<= 2.00 Cr); got ' + r2(after).toFixed(2) + ' Cr');
  }
}

/* ---------- 8. the XLSX Base File sheet: the AMC column as on main ---------- */
/* The column is unchanged from main: the display name of the row's OWN uploaded label
   (amcDisplay(label): a label AMC_DISPLAY lists gets the engine's name for it, any other
   label is echoed as typed). It must not take the one-name-per-house name the AMC tab
   shows (h.amcDisplay), so a "HDFC Mutual Fund" row beside a "HDFC" row is not exported as
   "HDFC". The expected cells are main's output for these labels, written out here. */
console.log('--- 8. XLSX "Base File" sheet: the AMC column is amcDisplay(the uploaded label), as on main ---');
{
  const XLSX = global.XLSX;                     /* set by engine-host load() */
  const up = [
    row({ name: 'Synthetic Fund X1', amc: 'HDFC', cmvCr: 1.0 }),
    row({ name: 'Synthetic Fund X2', amc: 'HDFC Mutual Fund', cmvCr: 1.0 }),
    row({ name: 'Synthetic Fund X3', amc: 'Aditya', cmvCr: 1.0 }),
    row({ name: 'Synthetic Fund X4', amc: 'woc', cmvCr: 1.0 }),
    row({ name: 'Synthetic PMS X5', amc: 'ICICI Prudential AMC', product: 'PMS', cmvCr: 1.0 })
  ];
  const want = { 'Synthetic Fund X1': 'HDFC', 'Synthetic Fund X2': 'HDFC Mutual Fund', 'Synthetic Fund X3': 'Aditya Birla Sun Life',
    'Synthetic Fund X4': 'WhiteOak Capital', 'Synthetic PMS X5': 'ICICI Prudential AMC' };
  const upl = {}; up.forEach(r => { upl[r.name] = r.amc; });
  ok(up.every(r => E.amcDisplay(r.amc) === want[r.name]), 'precondition: the expected cells are amcDisplay(uploaded label) (' +
     up.map(r => '"' + r.amc + '" -> "' + E.amcDisplay(r.amc) + '"').join(', ') + ')');
  const m = review(up.map(r => Object.assign({}, r)));
  const shown = (m.holdings.filter(h => h.name === 'Synthetic Fund X2')[0] || {}).amcDisplay;
  console.log('  on screen the "HDFC Mutual Fund" row carries the house name "' + shown + '" (one name per house)');
  let got = [];
  try {
    const wb = E.buildXLSX(m, XLSX);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true });
    const hdr = aoa[0] || [], ci = hdr.indexOf('Instrument Name'), ca = hdr.indexOf('AMC');
    got = aoa.slice(1).filter(r => r && r[ci]).map(r => [r[ci], r[ca]]);
  } catch (e) { console.log('  workbook error: ' + (e && e.message)); }
  const bad = got.filter(([n, a]) => want[n] !== a);
  ok(got.length === up.length && bad.length === 0, 'every row\'s AMC cell is amcDisplay of its uploaded label, as on main' +
     (bad.length ? ' — ' + bad.map(([n, a]) => n + ': "' + a + '" (uploaded "' + upl[n] + '", want "' + want[n] + '")').join('; ') : ''));
  const x2 = got.filter(([n]) => n === 'Synthetic Fund X2')[0];
  ok(!!x2 && x2[1] === 'HDFC Mutual Fund', 'the "HDFC Mutual Fund" row is not renamed "HDFC" in the export (got ' + (x2 ? '"' + x2[1] + '"' : 'no row') + ')');
}

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all KI-061 checks passed'));
process.exit(fail ? 1 : 0);
