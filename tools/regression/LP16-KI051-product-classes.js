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

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
