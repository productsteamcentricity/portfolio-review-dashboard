/* ============================================================================
   LP-16b — the platform's own Product Name values (owner's decisions of 26 Nov
   2026, relayed by MOD-04; tools/patches/2026-11-26-lp16b-platform-product-names.js).

     node tools/regression/LP16b-platform-product-names.js

   Known answers, one holding per platform value (Mutual Funds, Direct Equity,
   PMS, SIF, Unlisted-Direct, AIF-Listed, Global Exposure, Bonds, P2P Lending)
   and the edge cases, through the engine's own computeReview and taxClassify:
   - the product class (h.pcls), whether it is a listed stock (directEquity) or
     a share held directly (heldShare), and that a non-MF class is never looked
     up for performance and is listed with its class in the look-through box;
   - the tax row, or the reason no row is published.
   The expected answers are the owner's words: Global Exposure is a GIFT City
   fund when the instrument name says GIFT or IFSC, else an Offshore fund;
   "Bonds" are rupee bonds and NCDs, and the US-dollar label (and no tax row)
   only when the product or name says USD, US$, US, dollar or LRS; P2P lending
   is its own class (product class OTHER) and a Debt asset whatever the Asset
   Name says; Unlisted-Direct is an unlisted share held directly;
   AIF-Listed is a Listed AIF (Category III with its note, D-043).
   Invented names only (Synthetic ...), except the two controls that must
   match the embedded universes. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
function run(product, name, asset, category) {
  const rows = E.parseBaseRows([H, ['Test Client', name, category || '', asset || 'Equity', '', product, 1, 1],
    ['Test Client', 'Kotak Flexicap Fund(G)', 'Flexi Cap', 'Equity', 'Kotak', 'Mutual Fund', 4, 4]]);
  const m = E.computeReview(rows, REF, { familyName: 'Test', asOnDate: '25 Nov 2026' });
  const h = rows[0];
  const ex = [].concat(((m.equityAnalytics || {}).excluded || []), ((m.debtAnalytics || {}).excluded || [])).find(x => x.name === h.name) || null;
  return { h, ex, m };
}
const tax = (product, name, asset, category) => E.taxClassify({ product, name, asset: asset || 'Equity', category: category || '' }, REF);
const USD = 'US-dollar bonds (through LRS)', RUPEE = 'Rupee bonds and NCDs';
const NONMF = ['GIFT City funds', 'Offshore funds', USD, RUPEE, 'Fixed deposits', 'REITs and InvITs', 'Unlisted shares', 'P2P lending'];

/* 1. each platform value: its class, and a non-MF class is never looked up and is listed with its class */
const CASES = [
  // [product, name, asset, want pcls or '(direct equity)']
  ['Mutual Funds', 'HDFC Flexi Cap Fund(G)', 'Equity', 'MF'],
  ['Direct Equity', 'HDFC Bank Ltd.', 'Equity', '(direct equity)'],
  ['PMS', 'Synthetic Growth PMS', 'Equity', 'PMS'],
  ['SIF', 'Synthetic Equity Long-Short SIF', 'Equity', 'SIF'],
  ['Unlisted-Direct', 'Synthetic Tech Pvt Ltd', 'Equity', 'Unlisted shares'],
  ['AIF-Listed', 'Synthetic Opportunities Fund', 'Equity', 'AIF'],
  ['Global Exposure', 'Synthetic US Equity Feeder Fund', 'Equity', 'Offshore funds'],
  ['Global Exposure', 'Synthetic GIFT City Global Fund', 'Equity', 'GIFT City funds'],
  ['Global Exposure', 'Synthetic IFSC Fund', 'Equity', 'GIFT City funds'],
  ['GLOBAL EXPOSURE', 'Synthetic Overseas Fund', 'Equity', 'Offshore funds'],
  ['Global-Exposure', 'Synthetic Gift Fund', 'Equity', 'GIFT City funds'],
  ['Bonds', 'Synthetic Housing Finance NCD 2028', 'Debt', RUPEE],
  ['Bonds', 'Synthetic Global Finance NCD 2027', 'Debt', RUPEE],
  ['Bonds', 'Synthetic Corp 5.25% USD Bond 2030', 'Debt', USD],
  ['Bonds', 'Synthetic Corp US$ 4.5% Notes Bond 2031', 'Debt', USD],
  ['Bonds', 'Synthetic Dollar Bond 2029', 'Debt', USD],
  ['LRS', 'Synthetic Treasury Note', 'Debt', USD],
  ['P2P Lending', 'Synthetic P2P Pool', 'Debt', 'P2P lending'],
  ['Peer to Peer Lending', 'Synthetic Lending Pool', 'Debt', 'P2P lending'],
];
for (const [p, n, a, want] of CASES) {
  const { h, ex } = run(p, n, a);
  const got = h.directEquity ? '(direct equity)' : h.pcls;
  ok(got === want, '1. "' + p + '" / "' + n + '" -> ' + want + ' (got ' + got + ')');
  if (NONMF.indexOf(want) >= 0) {
    ok(!h.perfKey && !h.eqKey && !h.dbKey && !h.hyKey, '1. "' + p + '" / "' + n + '": not looked up for performance or look-through');
    ok(!!ex && ex.pcls === want, '1. "' + p + '" / "' + n + '": listed in the look-through box with its class (' + (ex && ex.pcls) + ')');
  }
}
ok(!!run('Mutual Funds', 'HDFC Flexi Cap Fund(G)', 'Equity').h.perfKey, '1. control: a mutual fund is still matched for performance');

/* 2. Unlisted-Direct is a share held directly, not a listed stock (as "Unlisted Shares") */
{ const u = run('Unlisted-Direct', 'Synthetic Tech Pvt Ltd').h, d = run('Direct-Unlisted', 'Synthetic Tech Pvt Ltd').h, s = run('Unlisted Shares', 'Synthetic Tech Pvt Ltd').h;
  ok(u.heldShare === true && u.directEquity === false, '2. "Unlisted-Direct": held directly (zero fund fee), not a listed stock');
  ok(d.heldShare === true && d.pcls === 'Unlisted shares', '2. "Direct-Unlisted" too');
  ok(s.heldShare === true && s.pcls === 'Unlisted shares' && !s.directEquity, '2. control: "Unlisted Shares" as before');
  const l = run('Direct Equity', 'HDFC Bank Ltd.').h;
  ok(l.directEquity === true && l.heldShare === true, '2. control: "Direct Equity" is a listed share held directly'); }

/* 3. edge cases that must not move */
[['Mutual Funds', 'Synthetic USD Bond Fund', 'MF'], ['Bond Fund', 'Synthetic Corporate Bond Fund', 'MF'], ['Sovereign Gold Bond', 'SGB 2031 Series I', 'MF'],
 ['Market Linked Debenture', 'Synthetic MLD 2027', 'MF'], ['Global Exposure Fund of Funds', 'Synthetic Global FoF', 'Offshore funds'],
 ['Bonds', 'Synthetic Bonus Shares Bond 2030', RUPEE]].forEach(([p, n, want]) => {
  const h = run(p, n, 'Debt').h;
  ok(h.pcls === want, '3. "' + p + '" / "' + n + '" -> ' + want + ' (got ' + h.pcls + ')');
});

/* 4. tax: the rows, or the reason no row is published */
const FB = 'No tax row is published for a foreign or US-dollar bond';
const T = [
  ['Bonds', 'Synthetic Housing Finance NCD 2028', 'Debt', '', 'Listed Bonds / NCDs', null],
  ['Bonds', 'Synthetic Global Finance NCD 2027', 'Debt', '', 'Listed Bonds / NCDs', null],
  ['Bonds', 'Synthetic Corp 5.25% USD Bond 2030', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Corp US$ 4.5% Notes Bond 2031', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Dollar Bond 2029', 'Debt', '', null, FB],
  ['LRS Bonds', 'Synthetic Treasury Bond 2030', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Corp Bond 2030', 'Debt', 'Overseas Bonds', null, FB],       /* the category still names the route */
  ['Unlisted-Direct', 'Synthetic Tech Pvt Ltd', 'Equity', '', 'Unlisted Equity Shares', null],
  ['P2P Lending', 'Synthetic P2P Pool', 'Debt', '', null, 'peer-to-peer lending'],
  /* a whole-word US in a bond's name counts (the owner's option read "USD, US or LRS"; MOD-04, 26 Nov 2026), but not
     Plus or Bus; a fund, AIF or PMS named "... Bond ..." keeps its own row (the bond words are read from the product or
     category only); SGB and MLD keep their rows under "Bonds"; GIFT City in a bond's name alone does not remove the row
     (owner question, today's rule kept) */
  ['Bonds', 'Synthetic US Infra Bond 2030', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Plus Finance Bond 2030', 'Debt', '', 'Listed Bonds / NCDs', null],
  ['Bonds', 'Synthetic Bus Finance NCD 2029', 'Debt', '', 'Listed Bonds / NCDs', null],
  ['Bonds', 'Synthetic Corp US5 Bond 2030', 'Debt', '', null, FB],
  ['Global Exposure', 'Synthetic Global Bond Fund', 'Debt', '', 'Global Funds', null],
  ['AIF', 'Synthetic USD Bond Fund', 'Debt', '', 'Debt AIF – Cat I/II', null],
  ['Bonds', 'Synthetic Corp Bond 2030', 'Debt', 'Global Bonds', null, FB],
  ['Bonds', 'Sovereign Gold Bond 2031 Series I', 'Debt', '', 'Sovereign Gold Bonds', null],
  ['Bonds', 'Synthetic Market Linked Debenture 2027', 'Debt', '', 'MLD', null],
  ['Bonds', 'Synthetic GIFT City Bond 2030', 'Debt', '', 'Listed Bonds / NCDs', null],
  ['Bonds', 'Synthetic Corp US$4.5% Bond 2031', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Corp Bond US$500mn', 'Debt', '', null, FB],
  ['Bonds', 'Synthetic Corp USD5.25 Bond', 'Debt', '', null, FB],
];
{ const pms = tax('PMS', 'Synthetic Dollar Bond Strategy', 'Debt', '');
  ok(pms.cls === null && String(pms.why || '').indexOf(FB) < 0, '4. tax PMS / "Synthetic Dollar Bond Strategy": the debt-PMS reason, not the foreign-bond one (got ' + pms.why + ')'); }
/* the label of the same holdings (one description each; the category split is an owner question, the label follows
   the owner's words: product or name) */
[['Bonds', 'Synthetic US Infra Bond 2030', '', USD], ['Bonds', 'Synthetic Plus Finance Bond 2030', '', RUPEE],
 ['Bonds', 'Synthetic Bus Finance NCD 2029', '', RUPEE], ['Bonds', 'Synthetic Corp US5 Bond 2030', '', USD],
 ['Bonds', 'Synthetic Corp US$ 4.5% Notes Bond 2031', '', USD],
 /* delta review D1: a figure straight after the currency word */
 ['Bonds', 'Synthetic Corp US$4.5% Bond 2031', '', USD], ['Bonds', 'Synthetic Corp Bond US$500mn', '', USD], ['Bonds', 'Synthetic Corp USD5.25 Bond', '', USD],
 ['Bonds', 'Synthetic Corp Bond 2030 Series FD2027', '', RUPEE],
 ['Bonds', 'Synthetic Corp Bond 2030', 'Global Bonds', RUPEE], ['Bonds', 'Synthetic GIFT City Bond 2030', '', RUPEE]].forEach(([p, n, c, want]) => {
  const h = run(p, n, 'Debt', c).h;
  ok(h.pcls === want, '4. label "' + p + '" / "' + n + '"' + (c ? ' / category "' + c + '"' : '') + ' -> ' + want + ' (got ' + h.pcls + ')');
});
for (const [p, n, a, c, cls, why] of T) {
  const r = tax(p, n, a, c);
  ok(cls ? r.cls === cls : (r.cls === null && String(r.why || '').toLowerCase().indexOf(why.toLowerCase()) >= 0),
    '4. tax "' + p + '" / "' + n + '"' + (c ? ' / category "' + c + '"' : '') + ' -> ' + (cls || 'no row: ' + why) + ' (got ' + (r.cls || 'no row: ' + r.why) + ')');
}
{ const l = tax('AIF-Listed', 'Synthetic Opportunities Fund', 'Equity', ''), a = tax('AIF', 'Synthetic Opportunities Fund', 'Equity', ''),
    lc = tax('AIF', 'Synthetic Opportunities Fund', 'Equity', 'Listed AIF'), un = tax('AIF-Unlisted', 'Synthetic Opportunities Fund', 'Equity', '');
  ok(l.cls === 'Equity AIF – Cat III (Listed Equity)' && l.catRuled === true, '4. tax "AIF-Listed": a Listed AIF, Category III with its note (D-043) (got ' + l.cls + ')');
  ok(lc.cls === l.cls && lc.catRuled === true, '4. control: the category "Listed AIF" gives the same row');
  ok(a.cls === 'Equity AIF – Cat I/II' && a.catAssumed === true, '4. control: a plain "AIF" with nothing stated stays Category I/II, assumed');
  ok(un.cls === 'Equity AIF – Cat I/II' && !un.catRuled, '4. "AIF-Unlisted" is not a Listed AIF'); }

/* 4b. P2P lending is a Debt asset whatever the Asset Name says (the owner's "Debt"; MOD-04 26 Nov 2026): the asset
   allocation and the debt look-through take it; nothing else changes its asset */
for (const a of ['Debt', 'Equity', 'Others', '']) {
  const { h, m } = run('P2P Lending', 'Synthetic P2P Pool', a);
  const dx = ((m.debtAnalytics || {}).excluded || []).find(x => x.name === h.name);
  ok(h.asset === 'Debt' && !!dx && dx.pcls === 'P2P lending', '4b. P2P Lending with Asset Name "' + a + '": asset Debt (got ' + h.asset + '), listed in the debt look-through as P2P lending');
}
{ const b = run('Bonds', 'Synthetic Housing Finance NCD 2028', 'Equity').h, g = run('Global Exposure', 'Synthetic US Equity Feeder Fund', 'Equity').h;
  ok(b.asset === 'Equity' && g.asset === 'Equity', '4b. control: other classes keep the Asset Name as given'); }

/* 5. the rules are data (contract I-40) and the two new fields are read from it */
{ const R = REF.PRODUCT_CLASS_RULES || [];
  ok(R.some(r => r.label === 'GIFT City funds' && (r.nameAny || []).indexOf('gift') >= 0) && R.some(r => r.label === USD && (r.andAny || []).indexOf('usd') >= 0),
    '5. PRODUCT_CLASS_RULES carries nameAny (GIFT City for Global Exposure) and andAny (the US-dollar words)');
  /* the class field is a product class of the new build's model (I-40); DEBT is none of them (CHAT-008's wiring review) */
  const MODEL = ['MF', 'SIF', 'PMS', 'AIF', 'ETF', 'EQUITY', 'BOND', 'OTHER'];
  ok(R.every(r => MODEL.indexOf(r.class) >= 0), '5. every rule\'s class is a product class of the new build\'s model (' + R.map(r => r.class).join(',') + ')');
  ok(R.some(r => r.label === 'P2P lending' && r.class === 'OTHER'), '5. P2P lending: product class OTHER');
  const R2 = JSON.parse(JSON.stringify(REF)); R2.PRODUCT_CLASS_RULES.forEach(r => { delete r.andAny; });
  const rows = E.parseBaseRows([H, ['Test Client', 'Synthetic Housing Finance NCD 2028', '', 'Debt', '', 'Bonds', 1, 1]]);
  E.computeReview(rows, R2, { familyName: 'Test', asOnDate: '25 Nov 2026' });
  ok(rows[0].pcls === USD, '5. without andAny the US-dollar rule takes every bond again (the engine reads the field, not a copy)'); }

console.log(fail ? `\n${fail} check(s) FAILED` : '\nall LP-16b checks passed');
process.exit(fail ? 1 : 0);
