/* ============================================================================
   CR-0010 A5: the SWOT international share. (1) A share held directly whose
   reference entry (STOCK_RET, by company name) has an Indian company ISIN
   (INE..., IN9...) is domestic, whatever its name says. (2) Two overseas
   funds of funds are counted on evidence (the vendor's Other Funds file,
   Oct 2026: Baroda BNP Paribas Aqua FoF 97.59% and ICICI Pru Strategic Metal
   and Energy Equity FoF 99.42% "Overseas Mutual Fund Units").

   Measured (A4 on main 55c4292 vs A5; scratch a5-measure.js): over the 10,439
   company names held as direct equity, A4 counted 360 and A5 counts 63 (297
   Indian companies leave, none come in); the 63 are the 5 Indian-domiciled
   ETFs that invest abroad (INF ISINs, kept) and 58 names with no STOCK_RET
   entry, mostly foreign companies (a few Indian names with no entry keep the
   name test: a known limit). Over the 4,741 fund names A4 counted 139 and A5
   143: the two funds, Regular and Direct, come in; none leave.

   Checks (synthetic books, CMV in Cr; the SWOT lists "International / Global
   equity" as under-represented when the international share is below 5%):
     0. The page holds the evidence list, the ISIN rule and the statement once.
     1. The reference data: "Allcargo Global" has an INE ISIN; the FANG+ ETF an
        INF one; "Marriott International" has no STOCK_RET entry.
     F. 2 Cr "Allcargo Global Ltd." held as direct equity + 8 Cr HDFC Flexi
        Cap: 0%, the bullet is shown (A4: 20%, no bullet).
     G. 2 Cr "Marriott International Cl A" held directly: still counts.
     H. 2 Cr "Mirae Asset NYSE FANG+ ETF" held as a share: still counts (INF).
     I. 2 Cr "Baroda BNP Paribas Aqua FoF-Reg(G)": counts (A4: the bullet).
     J. 2 Cr "ICICI Pru Strategic Metal and Energy Equity FoF(G)-Direct Plan":
        counts (A4: the bullet).
     K. 2 Cr "Prabhudas-Aqua Strategy" (a PMS): does not count.
     L. 2 Cr "Asian Paints Ltd." held directly: does not count (as A4).
     node tools/regression/CR0010-a5-isin-domestic.js
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

/* 0 */
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const once = s => html.split(s).length - 1 === 1;
ok(once(String.raw`_intlEvid=/(\bbnp paribas aqua\b|\bstrategic metal (and|&) energy\b)/i,`), '0. the page holds the evidence list once');
ok(once(String.raw`_intlInIsin=function(h){ return !!(h.stockRet&&/^IN[E9]/i.test(String(h.stockRet.isin||"").trim())); };`), '0. the page holds the ISIN rule once');
ok(once('((h.directEquity&&!_intlEtf.test(_n))?(_intlA3.test(_n)&&!_intlInIsin(h)):((_intlFund.test(_n)||_intlEvid.test(_n))&&!_intlNot.test(_n)))'),
  '0. direct equity: A3 unless an Indian ISIN; funds and ETFs: the fund test or the evidence list');

/* 1 */
const normCo = s => { s = String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(ltd|limited|the|inc|corp|co|of|india)\b/g, ' '); return s.replace(/\s+/g, ' ').trim(); };
const SR = REF.STOCK_RET || {};
ok(/^INE/.test((SR[normCo('Allcargo Global Ltd.')] || {}).isin || ''), '1. "Allcargo Global" has an INE ISIN in STOCK_RET');
ok(/^INF/.test((SR[normCo('Mirae Asset NYSE FANG+ ETF')] || {}).isin || ''), '1. the NYSE FANG+ ETF has an INF ISIN (a fund unit, not an Indian company)');
ok(!SR[normCo('Marriott International Cl A')], '1. "Marriott International" has no STOCK_RET entry (the name test stays)');

/* engine */
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
function swot(rows) {
  const aoa = [H].concat(rows.map(r => ['Test Client', r[0], '', 'Equity', r[1], r[3] || 'Mutual Fund', r[2], r[2]]));
  const m = E.computeReview(E.parseBaseRows(aoa), REF, { familyName: 'Test', asOnDate: '31 Oct 2026' });
  return (m.observations || {}).swot || {};
}
const UNDER = /limited or no exposure to:[^.]*International \/ Global equity/;
const has = sw => (sw.opportunities || []).some(s => UNDER.test(s));
const FLEXI = ['HDFC Flexi Cap Fund(G)', 'HDFC', 8];
ok(has(swot([['Allcargo Global Ltd.', '', 2, 'Direct Equity'], FLEXI])), 'F. "Allcargo Global Ltd." (INE) held directly is domestic: the bullet is shown');
ok(!has(swot([['Marriott International Cl A', '', 2, 'Direct Equity'], FLEXI])), 'G. "Marriott International Cl A" (no STOCK_RET entry) still counts: no bullet');
ok(!has(swot([['Mirae Asset NYSE FANG+ ETF', '', 2, 'Equity Shares'], FLEXI])), 'H. the NYSE FANG+ ETF held as a share (INF) still counts: no bullet');
ok(!has(swot([['Baroda BNP Paribas Aqua FoF-Reg(G)', 'Baroda BNP Paribas', 2], FLEXI])), 'I. Baroda BNP Paribas Aqua FoF (97.59% overseas fund units) counts: no bullet');
ok(!has(swot([['ICICI Pru Strategic Metal and Energy Equity FoF(G)-Direct Plan', 'ICICI Prudential', 2], FLEXI])),
  'J. ICICI Pru Strategic Metal and Energy Equity FoF, Direct (99.42% overseas fund units) counts: no bullet');
ok(has(swot([['Prabhudas-Aqua Strategy', 'Prabhudas Lilladher', 2, 'PMS'], FLEXI])), 'K. "Prabhudas-Aqua Strategy" (a PMS) is not the Aqua FoF: the bullet is shown');
ok(has(swot([['Asian Paints Ltd.', '', 2, 'Direct Equity'], FLEXI])), 'L. "Asian Paints Ltd." held directly does not count (as A4)');

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
