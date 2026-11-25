/* ============================================================================
   CR-0010 A4: the SWOT's "international" name test counts the overseas funds
   that A3 missed, and stops counting three domestic ones; a direct-equity
   holding keeps A3's test.

   Measured over every key of the fund blocks plus the 344 Other Funds names
   (4,741 names): A3 counted 117, A4 counts 139. 27 genuine overseas names come
   in ("Intl.", Asian, Asia Pacific, ASEAN, Brazil, Europe / Pan European,
   Hang Seng, NYSE FANG+, Emerging Markets, Off-shore); 5 domestic names go out
   (First Global x2, SMC Global, Edelweiss MSCI India Domestic & World
   Healthcare 45, Regular and Direct); no genuine name goes out. All 14 entries
   of the vendor's own "Global" sheet count (4 did not under A3). Over the
   10,439 company names of STOCK_INFO / STOCK_RET a direct-equity holding is
   tested exactly as under A3 (357 before, 357 after); the wider terms would
   have added 43 Indian companies ("Asian Paints", "Aban Offshore", ...).

   Checks:
     0. The page holds the fund test, the exceptions and the A3 direct-equity
        test exactly once each, and they equal the patterns below.
     1. Names: genuine overseas funds count; domestic funds do not.
     2. A direct-equity holding: A3's test (an Indian company called "Asian"
        does not count; one called "... Global" still does: a known limit,
        pinned, see CR-0010).
     3. Engine, synthetic books (CMV in Cr; the SWOT lists "International /
        Global equity" as under-represented when the international share is
        below 5%):
        A. 2 Cr Franklin Asian Equity + 8 Cr HDFC Flexi Cap: 20% international,
           no such bullet (A3 gave 0% and the bullet).
        B. 2 Cr "Asian Paints Ltd." held as direct equity + 8 Cr HDFC Flexi
           Cap: 0%, the bullet is shown.
        C. 2 Cr "First Global - The India Super 50" (PMS) + 8 Cr HDFC Flexi
           Cap: 0%, the bullet is shown (A3 gave 20% and no bullet).
        D. 2 Cr "Mirae Asset NYSE FANG+ ETF" held as a share (product "Equity
           Shares") + 8 Cr HDFC Flexi Cap: 20%, no bullet (A3 gave 0%): an ETF
           held as a share takes the fund test (financial review of A4).
        E. 2 Cr "Nippon India ETF Nifty 50 BeES" held as a share + 8 Cr HDFC
           Flexi Cap: 0%, the bullet is shown.
     Known limit, pinned: "MSCI India Domestic & World Healthcare 45" is about
     a third overseas (32.5% foreign stocks in its holdings data) and counts as
     0% (A3 counted it as 100%).
     node tools/regression/CR0010-a4-intl-terms.js
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

const A3 = /(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i;
const FUND = /(\binternat|\bintl\b|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bnyse\b|\bs&p|\boverseas|\boff-?shore\b|\bworld|\bchina|\btaiwan|\bjapan|\basia|\basean\b|\bbrazil|\blatin america|\beurop|\bhang seng|\bfang\b|\beafe\b|\bemerging markets?\b)/i;
const NOT = /(\bfirst global\b|\bsmc global\b|\bindia domestic\b|\bs&p bse\b|\bmagnum global\b)/i;
const ETF = /(\betf\b|bees\b)/i;

/* 0 */
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const once = s => html.split(s).length - 1 === 1;
ok(once('_intlA3=' + A3.toString() + ','), '0. the page holds the A3 direct-equity test once');
ok(once('_intlFund=' + FUND.toString() + ','), '0. the page holds the fund test once');
ok(once('_intlNot=' + NOT.toString() + ','), '0. the page holds the domestic exceptions once');
/* since CR-0010 A5 the ETF test is followed by A5's evidence list and ISIN rule, and the statement reads them (CR0010-a5-isin-domestic.js) */
ok(once('_intlEtf=' + ETF.toString() + ',') || once('_intlEtf=' + ETF.toString() + ';'), '0. the page holds the ETF test once');
ok(once('((h.directEquity&&!_intlEtf.test(_n))?_intlA3.test(_n):(_intlFund.test(_n)&&!_intlNot.test(_n)))') ||
   once('((h.directEquity&&!_intlEtf.test(_n))?(_intlA3.test(_n)&&!_intlInIsin(h)):((_intlFund.test(_n)||_intlEvid.test(_n))&&!_intlNot.test(_n)))'),
  '0. funds and ETFs use the wider test, other direct equity the A3 test');

/* 1 */
const isFund = n => FUND.test(n) && !NOT.test(n);
['Aditya Birla SL Intl. Equity Fund(G)', 'Franklin Asian Equity Fund(G)', 'Edelweiss ASEAN Equity Off-Shore Fund-Reg(G)',
  'HSBC Brazil Fund(G)', 'Edelweiss Europe Dynamic Equity Off-shore Fund-Reg(G)', 'Invesco India - Invesco Pan European Equity FoF-Reg(G)',
  'Mirae Asset Hang Seng TECH ETF', 'Mirae Asset NYSE FANG+ ETF', 'PGIM India Emerging Markets Equity FoF(G)',
  'Mahindra Manulife Asia Pacific REITs FOF-Reg(G)', 'Edelweiss Emerging Markets Opp Eq. Offshore Fund-Reg(G)',
  'Nippon India US Equity Opp Fund(G)', 'Franklin U.S. Opportunities Equity Active FOF(G)', 'Motilal Oswal Nasdaq 100 ETF',
  'Axis Global Innovation FoF-Reg(G)', 'Nippon India Japan Equity Fund(G)', 'Aditya Birla Sun Life Latin America Equity Fund',
  'Templeton European Opportunities Fund', 'Some MSCI EAFE Index FoF'].forEach(n => ok(isFund(n), '1. international fund: ' + n));
/* known limit: the Edelweiss "MSCI India Domestic & World Healthcare 45" fund is about two thirds Indian (its holdings
   data puts 32.5% in foreign stocks); it counts as 0% international (A3: 100%), the nearer of the two */
ok(!isFund('Edelweiss MSCI India Domestic & World Healthcare 45 Index Fund-Reg(G)'), '1. known limit, pinned: "MSCI India Domestic & World Healthcare 45" (32.5% overseas) counts as 0%');
['First Global - The India Super 50', 'First Global - Indian Multi Asset Allocation', 'SMC Global - Growth',
  'Some S&P BSE Sensex ETF', 'SBI Magnum Global Fund',
  'Axis Income Plus Arbitrage Omni FOF-Reg(G)', 'Taurus Flexi Cap Fund-Reg(G)', 'Kotak MSCI India ETF', 'HDFC Technology Fund-Reg(G)',
  'ICICI Pru Innovation Fund-Reg(G)', 'Aditya Birla SL Special Opp Fund-Reg(G)'].forEach(n => ok(!isFund(n), '1. domestic fund: ' + n));

/* 2 */
ok(!A3.test('Asian Paints Ltd.') && isFund('Asian Paints Ltd.'), '2. "Asian Paints" is not international as direct equity (A3), though the fund terms would catch it');
ok(A3.test('Allcargo Global Ltd.'), '2. known limit, pinned: a direct-equity "... Global Ltd." still counts under A3');

/* 3 */
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
function swot(rows) {
  const aoa = [H].concat(rows.map(r => ['Test Client', r[0], '', 'Equity', r[1], r[3] || 'Mutual Fund', r[2], r[2]]));
  const m = E.computeReview(E.parseBaseRows(aoa), REF, { familyName: 'Test', asOnDate: '31 Oct 2026' });
  return (m.observations || {}).swot || {};
}
const UNDER = /limited or no exposure to:[^.]*International \/ Global equity/;
const has = sw => (sw.opportunities || []).some(s => UNDER.test(s));
ok(!has(swot([['Franklin Asian Equity Fund(G)', 'Franklin Templeton', 2], ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]])),
  'A. 20% in Franklin Asian Equity: International / Global equity is not listed as under-represented');
ok(has(swot([['Asian Paints Ltd.', '', 2, 'Direct Equity'], ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]])),
  'B. "Asian Paints" held as direct equity is not international: the bullet is shown');
ok(has(swot([['First Global - The India Super 50', 'First Global', 2, 'PMS'], ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]])),
  'C. the "First Global" PMS is not international: the bullet is shown');
ok(!has(swot([['Mirae Asset NYSE FANG+ ETF', '', 2, 'Equity Shares'], ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]])),
  'D. an overseas ETF held as a share (NYSE FANG+, product "Equity Shares") counts: no bullet');
ok(has(swot([['Nippon India ETF Nifty 50 BeES', '', 2, 'Equity Shares'], ['HDFC Flexi Cap Fund(G)', 'HDFC', 8]])),
  'E. an Indian ETF held as a share (Nifty 50 BeES) does not count: the bullet is shown');

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
