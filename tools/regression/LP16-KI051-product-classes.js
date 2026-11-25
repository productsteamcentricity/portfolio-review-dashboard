/* ============================================================================
   LP-16 / KI-051 (P0): six non-mutual-fund product types get their own product
   class (the owner's labels, D-7, 25 Nov 2026), so the engine never treats them
   as mutual funds. Before, productClass() knew PMS, AIF and SIF only, and
   everything else was "MF": a bond, an FD, a REIT, a GIFT City or offshore fund
   could take a mutual fund's look-through and returns, and an unlisted share
   was read as a listed stock.

   Known answers (the owner's labels and keywords, OD-6's fund-word exception;
   synthetic holdings, fictional client):
     1. Class by Product label, letter case ignored: GIFT City funds (gift city,
        ifsc; before PMS / AIF / SIF), Offshore funds (offshore, off-shore),
        US-dollar bonds (through LRS) (bond, ncd, lrs, debenture), Fixed
        deposits (fixed deposit, fd), REITs and InvITs (reit, invit), Unlisted
        shares (unlisted).
     2. Unchanged: a product that also says ETF / MF / fund ("Bond Fund",
        "Bharat Bond ETF", "REIT FoF"); sovereign gold bonds and market-linked
        debentures (none of the six: they keep their old class); Mutual Fund,
        ETF, Index Fund, FoFs, PMS, AIF, SIF, Direct Equity, Equity Shares, a
        blank product.
     3. A holding of a new class: no look-through key, no performance key, no
        Direct row, listed as excluded with "Not a mutual fund (<class>): no
        look-through data"; an unlisted share is not direct equity.
     4. A fund-like name under such a label used to take the mutual fund's
        look-through and returns (HDFC Flexi Cap Fund(G) as "FD"): now none.
     5. The financial review of LP-16: a "GIFT City AIF" / "Offshore PMS" (and
        the reverse pairs) with a real AIF or PMS name takes no domestic AIF's
        or PMS's returns or look-through (controls: as "AIF" / "PMS" they do);
        "Offshore Equity Shares", "GIFT City Stocks" and "Unlisted Equity
        Shares" are not read as listed stocks.
     6. No reference data exists for these types by design: an FD is not
        reported as "could not be matched" (an unknown mutual fund still is).
     7. Whole words only and the I-40 edge points: "Corporate Bond Fund",
        "Bond ETF", "FDR", "FD Fund", "Bonded Warehouse" stay MF.
     8. The rules are data (REFDATA.PRODUCT_CLASS_RULES, contract I-40) in
        the owner's order, and with an empty table the engine classifies
        nothing as non-MF (it reads the data, not a copy).
     9. The six labels come before the engine's bond and share tests (MOD-03,
        MOD-04, 25 Nov 2026): "US-dollar bonds (through LRS)" is its own class
        (not a listed stock, no fund's data); "Unlisted shares" is not direct
        equity but is still a share held directly (heldShare), so the Cost tab
        keeps its zero fund fee, the performance sheet its Direct Equity
        bucket and the IPS sheet its "Direct Unlisted investment" line, as
        before LP-16 (the financial review of round 3).
   The owner's answer of 25 Nov 2026 (through MOD-04) to the review's bond
   question: "No, keep as recorded". Every bond, NCD and debenture, rupee 54EC,
   tax-free, RBI and corporate NCDs included, takes the label "US-dollar bonds
   (through LRS)" (cases in 1 and 9).
     node tools/regression/LP16-KI051-product-classes.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
function run(product, name, asset) {
  const rows = E.parseBaseRows([H, ['Test Client', name || 'HDFC Flexi Cap Fund(G)', '', asset || 'Equity', 'HDFC', product, 1, 1],
    ['Test Client', 'Kotak Flexicap Fund(G)', 'Flexi Cap', 'Equity', 'Kotak', 'Mutual Fund', 4, 4]]);
  const m = E.computeReview(rows, REF, { familyName: 'Test', asOnDate: '25 Nov 2026' });
  const h = rows[0], ex = ((m.equityAnalytics || {}).excluded || []).find(x => x.name === h.name) || null;
  return { h, ex, m };
}
const cls = (p, n) => { const r = run(p, n); return r.h.directEquity ? '(direct equity)' : r.h.pcls; };
const _isNonMf = c => ['GIFT City funds', 'Offshore funds', 'US-dollar bonds (through LRS)', 'Fixed deposits', 'REITs and InvITs', 'Unlisted shares'].indexOf(c) >= 0;

/* 1 */
const WANT = {
  'GIFT City funds': ['GIFT City funds', 'gift city fund', 'GIFT City AIF', 'IFSC Fund', 'GIFT IFSC'],
  'Offshore funds': ['Offshore funds', 'OFFSHORE FUND', 'Off-shore Fund'],
  'US-dollar bonds (through LRS)': ['US-dollar bonds (through LRS)', 'Bonds', 'bond', 'NCD', 'NCDs', 'LRS', 'Debenture', 'Corporate Bonds'],
  'Fixed deposits': ['Fixed deposits', 'Fixed Deposit', 'FD', 'fds', 'Bank FD'],
  'REITs and InvITs': ['REITs and InvITs', 'REIT', 'reits', 'InvIT', 'InvITs', 'REITs & InvITs'],
  'Unlisted shares': ['Unlisted shares', 'Unlisted Equity', 'UNLISTED SHARES', 'Equity Shares - Unlisted']
};
Object.keys(WANT).forEach(c => WANT[c].forEach(p => ok(cls(p) === c, '1. "' + p + '" -> ' + c + ' (got ' + cls(p) + ')')));

/* 2 */
[['Bond Fund', 'MF'], ['Bharat Bond ETF', 'MF'], ['REIT FoF', 'MF'], ['REIT Mutual Fund', 'MF'], ['Sovereign Gold Bond', 'MF'], ['SGB', 'MF'],
  ['Market Linked Debenture', 'MF'], ['MLD', 'MF'], ['Mutual Fund', 'MF'], ['ETF', 'MF'], ['Index Fund', 'MF'], ['FoFs', 'MF'], ['', 'MF'],
  ['PMS', 'PMS'], ['AIF', 'AIF'], ['AIF Cat III', 'AIF'], ['SIF', 'SIF'], ['Direct Equity', '(direct equity)'], ['Equity Shares', '(direct equity)']]
  .forEach(([p, c]) => ok(cls(p) === c, '2. unchanged: "' + p + '" -> ' + c + ' (got ' + cls(p) + ')'));

/* 3 */
['GIFT City funds', 'Offshore funds', 'Bonds', 'FD', 'REIT', 'Unlisted shares'].forEach(p => {
  const r = run(p), h = r.h;
  ok(!h.eqKey && !h.hyKey && !h.dbKey && !h.perfKey && !h.perfKeyDirect && !h.directEquity,
    '3. "' + p + '": no look-through, no performance, no Direct row, not direct equity');
  ok(r.ex && r.ex.reason === 'Not a mutual fund (' + h.pcls + '): no look-through data' && r.ex.pcls === h.pcls,
    '3. "' + p + '": excluded with "Not a mutual fund (' + h.pcls + '): no look-through data" (got ' + (r.ex && r.ex.reason) + ')');
});

/* 4 */
const before = run('Mutual Fund').h, after = run('FD').h;
ok(before.eqKey === 'HDFC Flexi Cap Fund(G)' && before.perfKey === 'HDFC Flexi Cap Fund(G)', '4. control: as a mutual fund it takes its own look-through and returns');
ok(!after.eqKey && !after.perfKey, '4. labelled "FD", the same name takes neither');
const un = run('Unlisted shares', 'Swiggy Ltd').h;
ok(!un.directEquity && !un.stockInfo && un.pcls === 'Unlisted shares', '4. an unlisted share is not looked up as a listed stock');

/* 5: the financial review of LP-16. A GIFT City or offshore product whose text also says AIF or PMS takes no domestic
   AIF's or PMS's returns (controls: the same names as "AIF" / "PMS" do match) */
const AIF = 'Buoyant Capital – Opportunities Strategy', PMS = 'Abakkus - All Cap Approach';
ok(run('AIF', AIF).h.perfSrc === 'AIF' && run('PMS', PMS).h.perfSrc === 'PMS', '5. control: as "AIF" / "PMS" these names take their own returns');
[['GIFT City AIF', AIF], ['Offshore PMS', PMS], ['GIFT City PMS', PMS], ['Offshore AIF', AIF]].forEach(([p, n]) => {
  const h = run(p, n).h;
  ok(_isNonMf(h.pcls) && !h.perfKey && !h.perfSrc && !h.eqKey, '5. "' + p + '" with ' + n + ': class ' + h.pcls + ', no returns, no look-through');
});
/* a non-MF product is never read as a listed stock, whatever else it says */
[['Offshore Equity Shares', 'Offshore funds'], ['GIFT City Stocks', 'GIFT City funds'], ['Unlisted Equity Shares', 'Unlisted shares']]
  .forEach(([p, c]) => { const h = run(p, 'HDFC Bank Ltd.').h; ok(!h.directEquity && h.pcls === c, '5. "' + p + '" is ' + c + ', not a listed stock'); });

/* 6: no reference data exists for these types by design, so they are not "could not be matched" */
{ const r = run('Fixed Deposit', 'Synthetic Bank Fixed Deposit 2027');
  ok((r.m.unmatched || []).indexOf('Synthetic Bank Fixed Deposit 2027') < 0 && r.ex && /Not a mutual fund \(Fixed deposits\)/.test(r.ex.reason),
    '6. an FD is not reported unmatched; the look-through box lists it with its class');
  const r2 = run('Mutual Fund', 'Synthetic Unknown Opportunities Fund');
  ok((r2.m.unmatched || []).indexOf('Synthetic Unknown Opportunities Fund') >= 0, '6. control: an unknown mutual fund is still reported unmatched'); }

/* 7: whole words only, and the edge points of contract I-40 */
[['Corporate Bond Fund', 'MF'], ['Bond ETF', 'MF'], ['FDR', 'MF'], ['FD Fund', 'MF'], ['Bonded Warehouse', 'MF'], ['Fixeddeposit', 'Fixed deposits'],
  ['Off Shore Fund', 'Offshore funds'], ['GIFTCity Fund', 'GIFT City funds']].forEach(([p, c]) => ok(cls(p) === c, '7. "' + p + '" -> ' + c + ' (got ' + cls(p) + ')'));

/* 8: the rules are data (REFDATA.PRODUCT_CLASS_RULES, contract I-40), in this order, and the engine reads them */
const RULES = REF.PRODUCT_CLASS_RULES || [];
ok(RULES.map(r => r.label).join('|') === 'GIFT City funds|Offshore funds|US-dollar bonds (through LRS)|Fixed deposits|REITs and InvITs|Unlisted shares',
  '8. REFDATA.PRODUCT_CLASS_RULES holds the six owner labels in order');
ok(RULES.filter(r => r.beforePmsAifSif).map(r => r.label).join('|') === 'GIFT City funds|Offshore funds', '8. GIFT City and offshore are tested before PMS / AIF / SIF');
{ const R2 = JSON.parse(JSON.stringify(REF)); R2.PRODUCT_CLASS_RULES = [];
  const rows = E.parseBaseRows([H, ['Test Client', 'HDFC Flexi Cap Fund(G)', '', 'Equity', 'HDFC', 'FD', 1, 1]]);
  E.computeReview(rows, R2, { familyName: 'Test', asOnDate: '25 Nov 2026' });
  ok(rows[0].pcls === 'MF', '8. with an empty table the engine classifies nothing as non-MF (it reads the data, not a copy)'); }

/* 9: the six labels are tested before the engine's bond|ncd|debenture and shares? rules */
{ const USD = 'US-dollar bonds (through LRS)';
  [['US-dollar bonds (through LRS)', 'Synthetic Corp 5.25% USD Bond 2030'], ['NCD', 'Tata Capital NCD 2027'], ['54EC Bonds', 'REC 54EC Bond 2029'],
    ['Tax Free Bonds', 'NHAI Tax Free Bond 2031'], ['RBI Bonds', 'RBI Floating Rate Savings Bond 2031']].forEach(([p, n]) => {
    const h = run(p, n).h;
    ok(h.pcls === USD && !h.directEquity && !h.heldShare && !h.perfKey && !h.eqKey && !h.dbKey, '9. "' + p + '" (' + n + ') -> ' + USD + ' (got ' + h.pcls + ')');
  });
  const u = run('Unlisted shares', 'Swiggy Ltd').h, l = run('Equity Shares', 'HDFC Bank Ltd.').h;
  ok(u.pcls === 'Unlisted shares' && !u.directEquity && u.heldShare === true, '9. "Unlisted shares": not direct equity, still a share held directly (zero fund fee)');
  ok(l.directEquity === true && l.heldShare === true, '9. control: a listed share is direct equity and held directly');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
  ok(html.split('directEq:!!(h.directEquity||h.heldShare)').length === 3 && html.indexOf('directEq:!!h.directEquity') < 0,
    '9. the Cost tab and its fallback read heldShare, so an unlisted share keeps its zero fund fee');
  /* the financial review of round 3: an unlisted share stays in the Direct Equity performance bucket (not "Equity MF")
     and counts as "Direct Unlisted investment" on the IPS sheet, as before LP-16 */
  const pb = run('Unlisted shares', 'Synthetic Unlisted Co Pvt Ltd').m.performance.buckets || [],
    inB = k => JSON.stringify((pb.find(b => b.key === k || b.label === k || b.name === k) || {})).indexOf('Synthetic Unlisted Co Pvt Ltd') >= 0;
  ok(inB('Direct Equity') && !inB('Equity MF'), '9. performance: an unlisted share is in the Direct Equity bucket, not Equity MF');
  ok(html.indexOf('if(h.directEquity||h.heldShare||/direct/i.test(prod)) dirUnlistedCMV') >= 0,
    '9. IPS: an unlisted share held directly counts as Direct Unlisted investment (heldShare)');
  /* ARC-02's Gate B L1: a share held directly, listed or not, keeps the SWOT's narrow A3 name test (the wide fund test would
     catch "Asian", "Offshore", "Europe" in Indian company names); an ETF held as a share still takes the fund test (A4) */
  const UNDER = /limited or no exposure to:[^.]*International \/ Global equity/,
    intlBullet = (p, n) => ((run(p, n).m.observations || {}).swot || {}).opportunities.some(s => UNDER.test(s));
  ok(intlBullet('Unlisted shares', 'Asian Hotels (East) Ltd') && intlBullet('Unlisted shares', 'Synthetic Offshore Engineering Pvt Ltd'),
    '9. SWOT: an unlisted "Asian Hotels (East) Ltd" or "... Offshore Engineering" share is not international (A3 name test)');
  ok(!intlBullet('Equity Shares', 'Mirae Asset NYSE FANG+ ETF'), '9. SWOT control: an overseas ETF held as a share still counts (fund test, A4)'); }

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
