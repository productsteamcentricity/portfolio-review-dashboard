/* ============================================================================
   CR-0010 A3: the SWOT's "international" share (intlPct) counted any holding
   whose name contained "us " anywhere: "Plus " (the Income Plus Arbitrage funds
   of funds), the Taurus AMC, Abakkus, Focus, Marcellus, Citrus, Equirus ...
   Over the page's 4,741 fund names the old test matched 278 and the new one 117:
   163 domestic names removed (all through "us "), 2 genuine "U.S." names added
   (Franklin U.S. Opportunities), no genuine international name removed.

   Known answers (synthetic books, CMV in Cr, intlPct = international CMV /
   total CMV; the SWOT lists "International / Global equity" as under-represented
   when intlPct < 5 and counts "International" as a class present when >= 2):
     A. 4 domestic funds whose names contain "us " inside a word (Taurus, Plus,
        Focus, Abakkus-like) at 1 Cr each and 6 Cr of a plain equity fund:
        intlPct 0 -> the opportunities bullet names "International / Global
        equity" (the old test gave 30%: Taurus, Plus and Credit Plus; and no
        such bullet).
     B. 1 Cr Nippon India US Equity Opp, 1 Cr Franklin U.S. Opportunities
        Equity Active FOF, 8 Cr of a plain equity fund: intlPct 20 -> no
        "International / Global equity" bullet ("U.S." now counts; the old test
        gave 10%).
   And the name test itself (the pattern copied from the page and asserted
   present there exactly once): genuine names match, the domestic ones do not.
     node tools/regression/CR0010-a3-intl-word-boundary.js
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

/* the page's pattern, read from index.html (exactly one copy) */
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const SRC = '/(\\binternat|\\bglobal|\\bus\\b|\\bu\\.s\\.|\\bnasdaq|\\bs&p|\\boverseas|\\bworld|\\bchina|\\btaiwan|\\bjapan)/i';
/* since A4 (2026-11-24-intl-terms.js) this pattern is the direct-equity test; funds use A4's wider terms */
ok(html.split('_intlA3=' + SRC + ',').length - 1 === 1, '0. the page holds the word-boundary pattern exactly once (the direct-equity test since A4)');
ok(html.indexOf('/(internat|global|us |nasdaq|') < 0, '0. the old pattern is gone from the page');
const RE = /(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i;

const genuine = ['Motilal Oswal Nasdaq 100 ETF', 'ICICI Pru US Bluechip Equity Fund(G)', 'Nippon India US Equity Opp Fund(G)',
  'Franklin U.S. Opportunities Equity Active FOF(G)', 'Motilal Oswal S&P 500 Index Fund-Reg(G)', 'Axis Global Innovation FoF-Reg(G)',
  'Kotak International REIT Overseas Equity Active FOF-Reg(G)', 'HDFC Developed World Overseas Equity Passive FOF-Reg(G)',
  'Axis Greater China Equity FoF-Reg(G)', 'Nippon India Japan Equity Fund(G)', 'Nippon India Taiwan Equity Fund-Reg(G)',
  'Bandhan US Treasury Bond 0-1 year specific Debt Passive FOF-Reg(G)', 'Edelweiss US Value Equity Offshore Fund-Reg(G)'];
const domestic = ['Axis Income Plus Arbitrage Omni FOF-Reg(G)', 'Taurus Flexi Cap Fund-Reg(G)', 'Abakkus Emerging Opportunities Fund',
  'Kotak - Focus Top 12', 'Marcellus - Kings of Capital', 'Citrus Midcap Marvels', 'Equirus Core Equity', 'ITUS - Fundamental Value Fund',
  'Edelweiss Credit Plus Fund', 'HDFC Bonus Fund', 'Cautious Allocation Fund', 'Ocean-Avendus Olivo Core Equity Portfolio'];
genuine.forEach(n => ok(RE.test(n), '1. international: ' + n));
domestic.forEach(n => ok(!RE.test(n), '1. not international: ' + n));

/* books through the engine */
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
function swot(rows){
  const aoa = [H].concat(rows.map(r => ['Test Client', r[0], '', 'Equity', r[1], 'Mutual Fund', r[2], r[2]]));
  const m = E.computeReview(E.parseBaseRows(aoa), REF, { familyName: 'Test', asOnDate: '31 Oct 2026' });
  return (m.observations || {}).swot || {};
}
const has = (sw, re) => (sw.opportunities || []).some(s => re.test(s));
const UNDER = /limited or no exposure to:[^.]*International \/ Global equity/;
const A = swot([['Taurus Flexi Cap Fund-Reg(G)', 'Taurus', 1], ['Axis Income Plus Arbitrage Omni FOF-Reg(G)', 'Axis', 1],
  ['Kotak Focused Fund-Reg(G)', 'Kotak', 1], ['Edelweiss Credit Plus Fund', 'Edelweiss', 1], ['HDFC Flexi Cap Fund(G)', 'HDFC', 6]]);
ok(has(A, UNDER), 'A. names with "us " inside a word are not international: the SWOT lists International / Global equity as under-represented');
const B = swot([['Nippon India US Equity Opp Fund(G)', 'Nippon India', 1], ['Franklin U.S. Opportunities Equity Active FOF(G)', 'Franklin Templeton', 1],
  ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]]);
ok(!has(B, UNDER), 'B. "US" and "U.S." funds at 20% count: International / Global equity is not listed as under-represented');

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
