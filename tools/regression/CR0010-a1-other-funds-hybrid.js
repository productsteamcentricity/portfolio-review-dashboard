/* ============================================================================
   CR-0010 A1 (October 2026): the 40 children's and retirement funds that the
   vendor's October Hybrid file left out carried their 30 Sep 2026 look-through,
   tagged vintage "30 Sep 2026". buildtools/build_other_funds.js replaced them
   with the vendor's "Other Funds Analytics" Oct-26 data through the same hybrid
   route as the monthly build (hybridFromAoa).

   Known answers (independent of the parser: plain sums of the Oct-26 rows of
   the vendor file, positive holdings, "Out" rows skipped, computed outside the
   repository on 22 Nov 2026; the vendor file is not in the repository):
     - ICICI Pru Children's Fund(G): equity 84.4285, the rest 15.5715; largest
       stocks Reliance Industries Ltd. 8.6823, SBI Life Insurance Company Ltd.
       5.9181 (30 Sep 2026: equity 79.9461).
     - Aditya Birla SL Retirement Fund-40-Reg(G): equity 79.0270, the rest
       20.9730; largest stocks ICICI Bank Ltd. 6.8465, HDFC Bank Ltd. 4.0406
       (30 Sep 2026: equity 78.2007).
   Checks:
     1. No HYBRID_ANALYTICS entry carries a vintage tag; the block has 244 keys.
     2. The two known answers above, from the embedded block.
     3. Every embedded hybrid entry with both sides sums to 100 +/- 0.5 for the
        40 refreshed keys (listed below).
     4. hybridFromAoa: rows above the header (a title line at row 0, a blank
        row, a date row) change nothing: the same synthetic sheet with and
        without them gives identical blocks; row 0 is never read as data.
     5. buildHybrid and hybridFromAoa are the same route (buildHybrid delegates).
     node tools/regression/CR0010-a1-other-funds-hybrid.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { hybridFromAoa } = require('../../buildtools/build_refresh.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const HY = REF.HYBRID_ANALYTICS || {};

const REFRESHED = [
  'Aditya Birla SL Bal Bhavishya Yojna-Reg(G)', 'Aditya Birla SL Retirement Fund-30-Reg(G)', 'Aditya Birla SL Retirement Fund-40-Reg(G)',
  'Aditya Birla SL Retirement Fund-50-Reg(G)', "Axis Children's Fund-Compulsory Lock in-Reg(G)", 'Axis Retirement Fund-Aggressive Plan-Reg(G)',
  'Axis Retirement Fund-Conservative Plan-Reg(G)', 'Axis Retirement Fund-Dynamic Plan-Reg(G)', 'Bandhan Retirement Fund-Reg(G)',
  "Baroda BNP Paribas Children's Fund-Reg(G)", 'Baroda BNP Paribas Retirement Fund-Reg(G)', 'Franklin India Retirement Fund(G)',
  "HDFC Children's Fund(Lock in)", 'HDFC Retirement Fund-Equity Plan-Reg(G)', 'HDFC Retirement Fund-Hybrid-Debt Plan-Reg(G)',
  'HDFC Retirement Fund-Hybrid-Equity Plan-Reg(G)', "ICICI Pru Children's Fund(G)", 'ICICI Pru Retirement Fund-Hybrid Aggressive Plan(G)',
  'ICICI Pru Retirement Fund-Hybrid Cons Plan(G)', 'ICICI Pru Retirement Fund-Pure Equity Plan(G)', 'LIC MF Children’s Fund-Reg(G)',
  'Nippon India Retirement Fund-Income Generation(G)', 'Nippon India Retirement Fund-Wealth Creation(G)', 'PGIM India Retirement Fund-Reg(G)',
  "SBI Children's Fund-Investment Plan-Reg(G)", "SBI Children's Fund-Savings Plan-Reg(G)", 'SBI Retirement Benefit Fund-Aggressive Hybrid Plan-Reg(G)',
  'SBI Retirement Benefit Fund-Aggressive Plan-Reg(G)', 'SBI Retirement Benefit Fund-Conservative Hybrid Plan-Reg(G)',
  'SBI Retirement Benefit Fund-Conservative Plan-Reg(G)', "Tata Children's Fund-Reg(G)", 'Tata Retirement Sav Fund - Cons Plan(G)',
  'Tata Retirement Sav Fund - Mod Plan(G)', 'Tata Retirement Sav Fund - Prog Plan(G)', "Union Children's Fund-Reg(G)", 'Union Retirement Fund-Reg(G)',
  "UTI Children's Equity Fund(G)", 'UTI Retirement Fund', 'Aditya Birla SL Retirement Fund-50 Plus-Debt Plan-Reg(G)', 'ICICI Pru Retirement Fund-Pure Debt Plan(G)'
];

/* 1 */
const vint = Object.keys(HY).filter(k => HY[k].vintage);
ok(vint.length === 0, '1. no HYBRID_ANALYTICS entry carries a vintage tag (found ' + vint.length + ')');
ok(Object.keys(HY).length === 244, '1. HYBRID_ANALYTICS has 244 keys (found ' + Object.keys(HY).length + ')');
ok(REFRESHED.length === 40 && REFRESHED.every(k => HY[k]), '1. all 40 refreshed keys are present');

/* 2 */
const c = HY["ICICI Pru Children's Fund(G)"] || {}, r = HY['Aditya Birla SL Retirement Fund-40-Reg(G)'] || {};
const top = (h, i) => (h.eq && h.eq.stocks[i]) || [];
ok(c.eq && c.eq.weight === 84.4285 && c.db && c.db.weight === 15.5715, "2. ICICI Pru Children's Fund: equity 84.4285 / rest 15.5715 (got " + (c.eq && c.eq.weight) + ' / ' + (c.db && c.db.weight) + ')');
ok(top(c, 0)[0] === 'Reliance Industries Ltd.' && top(c, 0)[1] === 8.6823 && top(c, 1)[0] === 'SBI Life Insurance Company Ltd.' && top(c, 1)[1] === 5.9181,
  "2. ICICI Pru Children's Fund: largest stocks Reliance 8.6823, SBI Life 5.9181");
ok(r.eq && r.eq.weight === 79.027 && r.db && r.db.weight === 20.973, '2. ABSL Retirement Fund-40: equity 79.0270 / rest 20.9730 (got ' + (r.eq && r.eq.weight) + ' / ' + (r.db && r.db.weight) + ')');
ok(top(r, 0)[0] === 'ICICI Bank Ltd.' && top(r, 0)[1] === 6.8465 && top(r, 1)[0] === 'HDFC Bank Ltd.' && top(r, 1)[1] === 4.0406,
  '2. ABSL Retirement Fund-40: largest stocks ICICI Bank 6.8465, HDFC Bank 4.0406');

/* 3 */
const off = REFRESHED.filter(k => { const h = HY[k] || {}; return Math.abs(((h.eq && h.eq.weight) || 0) + ((h.db && h.db.weight) || 0) - 100) > 0.5; });
ok(off.length === 0, '3. the 40 refreshed funds each sum to 100 +/- 0.5 (off: ' + off.join(' | ') + ')');

/* 4: synthetic sheet, fictional names (24 columns: scheme, company, in/out, holding, ..., sector 8, asset 9, asset type 10,
      rating 11, agency 12, basket 13, isin 14, issuer 15, coupon 16, maturity 17, mcap 18) */
const row = (s, co, h, asset, sector, mcap, rating, issuer) => { const x = new Array(24).fill(null); x[0] = s; x[1] = co; x[3] = h; x[8] = sector; x[9] = asset; x[10] = asset === 'Equity' ? 'Equity' : 'Debt';
  x[11] = rating || null; x[13] = rating || null; x[15] = issuer || co; x[18] = mcap || null; return x; };
const header = ['Scheme Name', 'Company Name', 'In/Out', 'Holding(%)'].concat(new Array(20).fill('x'));
const data = [
  row('Alpha Retirement Fund-Reg(G)', 'Stock A Ltd.', 60, 'Equity', 'Bank', 'Large Cap'),
  row('Alpha Retirement Fund-Reg(G)', 'Stock B Ltd.', 20, 'Equity', 'IT', 'Mid Cap'),
  row('Alpha Retirement Fund-Reg(G)', 'GOI Bond 2030', 20, 'Debt', 'Sovereign', null, 'SOV', 'Government of India'),
  (() => { const x = row('Alpha Retirement Fund-Reg(G)', 'Stock C Ltd.', 5, 'Equity', 'Auto', 'Small Cap'); x[2] = 'Out'; return x; })()
];
const plain = hybridFromAoa(E, [header].concat(data.map(x => x.slice())), null);
const titled = hybridFromAoa(E, [[' >>Portfolio'], [], [null, null, null, new Date(Date.UTC(2026, 9, 1))], header].concat(data.map(x => x.slice())), null);
ok(JSON.stringify(plain) === JSON.stringify(titled), '4. three rows above the header change nothing (identical blocks)');
const a = plain['Alpha Retirement Fund-Reg(G)'] || {};
ok(a.eq && a.eq.weight === 80 && a.db && a.db.weight === 20 && a.eq.stocks.length === 2, '4. synthetic fund: equity 80 (Out row skipped), debt 20, 2 stocks');
const firstAsData = hybridFromAoa(E, [row('Zeta Fund-Reg(G)', 'Stock Z Ltd.', 100, 'Equity', 'Bank', 'Large Cap')].concat(data.map(x => x.slice())), null);
ok(!firstAsData['Zeta Fund-Reg(G)'], '4. row 0 is never read as data');

/* 5 */
const src = require('fs').readFileSync(require('path').join(__dirname, '../../buildtools/build_refresh.js'), 'utf8');
ok(/function buildHybrid\(X, E, file, stockAcc\)\{ return hybridFromAoa\(E, aoaOf\(X,file\), stockAcc\); \}/.test(src), '5. buildHybrid delegates to hybridFromAoa');

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
