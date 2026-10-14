/* ============================================================================
   make-sample-base.js — write a SYNTHETIC client base file and IRR workbook,
   so the dashboard can be exercised end to end without any client's data.

     node tools/make-sample-base.js [outDir]          (default: test-data/)

   Writes  <outDir>/Sample_Base_File.xlsx          sheet "Base File"
           <outDir>/Sample_IRR_Transactions.xlsx   sheets "SI Xirr", "SI Bmxirr"
           <outDir>/Sample_Base_File_B.xlsx        a second, unrelated family (no
                                                   shared schemes or clients), for
                                                   the KI-001 carry-over check

   Nothing here is real: the clients, folios, dates and amounts are invented.
   Scheme names are taken from the embedded reference data (public fund names),
   so matching, look-through and performance resolve as they would for a real
   file. One holding is deliberately unknown, to exercise the unmatched count.

   Every holding is priced off a NAV path that grows at a constant rate g, so
   the transaction XIRR of its flows is EXACTLY g (and the benchmark's is gb).
   tools/smoke-review.js uses that to check the engine's XIRR against a known
   answer. Units follow the base-file conventions the engine reads
   (07_engine parseBaseRows): money in Rs and Cr., XIRR (%) and BMXIRR (%) as
   percent numbers (12.5 = 12.5%), Allocation (%) as a fraction.

   Deterministic: the same index.html always produces the same holdings.
   The output folder is git-ignored; never put a real client file there.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./engine-host.js');

const AS_ON = d(2026, 9, 30);                 /* the embedded data vintage (30 Sep 2026) */
const NAV_BASE = d(2022, 4, 1);               /* every NAV path is 100 on this date */

function d(y, m, day) { return new Date(y, m - 1, day); }          /* local midnight, as Excel stores it */
function years(a, b) { return (b - a) / 86400000 / 365; }           /* actual/365, the engine's day count */
function nav(g, t) { return 100 * Math.pow(1 + g, years(NAV_BASE, t)); }
const r2 = x => Math.round(x * 100) / 100;
const r4 = x => Math.round(x * 10000) / 10000;
/* the engine's company-name key (07_engine normCo), so a direct-equity pick resolves */
const normCo = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(ltd|limited|the|inc|corp|co|of|india)\b/g, ' ').replace(/\s+/g, ' ').trim();

/* ---- pick real scheme names from the embedded universes, deterministically ---- */
function pickSchemes(REF) {
  const ranked = k => REF.FUND_RANKS[k] && REF.FUND_RANKS[k].rank != null;
  const mf = Object.keys(REF.MF_PERF).sort();
  /* vendor sheet names vary in case ("Small cap Fund"), so compare case-insensitively */
  const firstIn = (sheet, block) => mf.find(k => String(REF.MF_PERF[k].sheet).toLowerCase() === sheet.toLowerCase() &&
    REF[block][k] && REF.MF_RISK[k] && ranked(k));
  const bySheet = (type, block) => {
    const seen = {}; const out = [];
    mf.forEach(k => { const p = REF.MF_PERF[k]; if (p.type === type && REF[block][k] && !seen[p.sheet]) { seen[p.sheet] = 1; out.push(k); } });
    return out;
  };
  const pick = {
    large: firstIn('Large Cap Fund', 'EQUITY_ANALYTICS'),
    flexi: firstIn('Flexi Cap Fund', 'EQUITY_ANALYTICS'),
    mid: firstIn('Mid Cap Fund', 'EQUITY_ANALYTICS'),
    small: firstIn('Small Cap Fund', 'EQUITY_ANALYTICS'),
    debt: bySheet('debt', 'DEBT_ANALYTICS').slice(0, 2),
    hybrid: bySheet('hybrid', 'HYBRID_ANALYTICS')[0],
    pms: Object.keys(REF.PMS_PERF).sort().find(k => REF.PMS_PERF[k].r && REF.PMS_PERF[k].r['1Y'] != null),
    aif: Object.keys(REF.AIF_PERF).sort()[0],
    sif: Object.keys(REF.SIF_PERF).sort()[0],
    stock: Object.keys(REF.STOCK_RET).sort().find(k => REF.STOCK_INFO[k] && REF.STOCK_INFO[k][0] === 'Large Cap' &&
      REF.STOCK_RET[k].r && REF.STOCK_RET[k].r['1Y'] != null && /[a-z]/.test(REF.STOCK_RET[k].n || ''))
  };
  const missing = Object.keys(pick).filter(k => !pick[k] || (Array.isArray(pick[k]) && pick[k].length < 2));
  if (missing.length) throw new Error('could not pick sample schemes for: ' + missing.join(', '));
  return pick;
}

/* ---- the synthetic book: two clients, every product class, one unknown name ---- */
function plan(REF) {
  const P = pickSchemes(REF);
  const mfCat = k => REF.MF_PERF[k].sheet;
  const brand = k => k.split(/[\s-]+/)[0];
  const H = (o) => Object.assign({ dist: 'Centricity', priced: true, redeem: 0 }, o);
  const A = 'Sample Client A', B = 'Sample Client B';
  return [
    H({ client: A, name: P.large,  amc: brand(P.large),  product: 'Mutual Funds', asset: 'Equity', cat: mfCat(P.large),  g: 0.14, gb: 0.125, buys: [[d(2023, 1, 16), 6000000], [d(2025, 11, 17), 2500000]] }),
    H({ client: A, name: P.flexi,  amc: brand(P.flexi),  product: 'Mutual Funds', asset: 'Equity', cat: mfCat(P.flexi),  g: 0.12, gb: 0.125, buys: [[d(2022, 6, 15), 5000000]], redeem: 0.2, redeemOn: d(2025, 3, 3) }),
    H({ client: A, name: P.debt[0], amc: brand(P.debt[0]), product: 'Mutual Funds', asset: 'Debt', cat: mfCat(P.debt[0]), g: 0.072, gb: 0.069, buys: [[d(2024, 2, 5), 8000000]] }),
    H({ client: A, name: P.hybrid, amc: brand(P.hybrid), product: 'Mutual Funds', asset: 'Hybrid', cat: mfCat(P.hybrid), g: 0.105, gb: 0.1, buys: [[d(2023, 9, 11), 4000000]], dist: 'Other Distributor' }),
    H({ client: A, name: P.pms,    amc: P.pms.split(' - ')[0], product: 'PMS', asset: 'Equity', cat: REF.PMS_PERF[P.pms].category || 'Multi Cap', g: 0.16, gb: 0.13, buys: [[d(2023, 4, 10), 7500000]], priced: false }),
    H({ client: A, name: REF.STOCK_RET[P.stock].n, amc: '', product: 'Direct Equity', asset: 'Equity', cat: 'Large Cap', g: 0.09, gb: 0.12, buys: [[d(2024, 8, 20), 1500000]] }),
    H({ client: A, name: 'Sample Unknown Opportunities Fund', amc: 'Sample', product: 'Mutual Funds', asset: 'Equity', cat: 'Thematic Fund', g: 0.05, gb: 0.12, buys: [[d(2025, 1, 6), 1000000]] }),
    H({ client: B, name: P.mid,    amc: brand(P.mid),    product: 'Mutual Funds', asset: 'Equity', cat: mfCat(P.mid),    g: 0.18, gb: 0.15, buys: [[d(2022, 11, 21), 3500000], [d(2024, 12, 2), 2500000]] }),
    H({ client: B, name: P.small,  amc: brand(P.small),  product: 'Mutual Funds', asset: 'Equity', cat: mfCat(P.small),  g: 0.2, gb: 0.16, buys: [[d(2023, 7, 3), 4000000]], dist: 'Other Distributor' }),
    H({ client: B, name: P.debt[1], amc: brand(P.debt[1]), product: 'Mutual Funds', asset: 'Debt', cat: mfCat(P.debt[1]), g: 0.075, gb: 0.071, buys: [[d(2024, 5, 13), 7000000]] }),
    H({ client: B, name: P.large,  amc: brand(P.large),  product: 'Mutual Funds', asset: 'Equity', cat: mfCat(P.large),  g: 0.14, gb: 0.125, buys: [[d(2026, 2, 9), 3000000]] }),
    H({ client: B, name: P.aif,    amc: brand(P.aif),    product: 'AIF', asset: 'Equity', cat: REF.AIF_PERF[P.aif].category || 'Category III', g: 0.11, gb: 0.13, buys: [[d(2024, 3, 18), 5000000]], priced: false }),
    H({ client: B, name: P.sif,    amc: brand(P.sif),    product: 'SIF', asset: 'Equity', cat: REF.SIF_PERF[P.sif].category || 'SIF', g: 0.06, gb: 0.08, buys: [[d(2026, 6, 15), 2500000]] })
  ];
}

/* ---- price each holding: units, cost, value, flows ---- */
function price(h) {
  const fund = [], bench = [];
  let units = 0, cost = 0, bmUnits = 0;
  const lots = [];
  h.buys.forEach(([t, amt]) => {
    const u = amt / nav(h.g, t), ub = amt / nav(h.gb, t);
    units += u; cost += amt; bmUnits += ub; lots.push({ t, u, amt });
    fund.push({ t, type: 'Purchase', price: r4(nav(h.g, t)), amt: -amt });
    bench.push({ t, amt: -amt });
  });
  if (h.redeem) {                                   /* a partial redemption, FIFO against the first lot */
    const t = h.redeemOn, su = units * h.redeem, sb = bmUnits * h.redeem;
    let left = su;
    for (const L of lots) { const take = Math.min(L.u, left); cost -= L.amt * take / L.u; L.u -= take; left -= take; if (left <= 1e-9) break; }
    units -= su; bmUnits -= sb;
    fund.push({ t, type: 'Redemption', price: r4(nav(h.g, t)), amt: su * nav(h.g, t) });
    bench.push({ t, amt: sb * nav(h.gb, t) });
  }
  const mv = units * nav(h.g, AS_ON);
  fund.push({ t: AS_ON, type: '', rtype: 'Closing', price: r4(nav(h.g, AS_ON)), amt: mv });
  bench.push({ t: AS_ON, amt: bmUnits * nav(h.gb, AS_ON) });
  const days = lots.reduce((s, L) => s + L.u * (AS_ON - L.t) / 86400000, 0) / (units || 1);
  return Object.assign({}, h, { units, cost, mv, fund, bench, days: Math.round(days) });
}

/* `host` = an engine-host load() result, so a caller that already loaded the
   engine does not evaluate index.html's libraries a second time */
function build(host) {
  const { XLSX, REF } = host || load();
  const book = plan(REF).map(price);
  const total = book.reduce((s, h) => s + h.mv, 0);

  /* ---- base file: the 19 documented columns, plus Purchase Date ---- */
  const head = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Folio No', 'AMC', 'Product Name',
    'Distributor Name', 'Units', 'Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)',
    'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)',
    'Allocation (%)', 'XIRR (%)', 'BMXIRR (%)', 'Avg. Holding Days', 'Purchase Date'];
  const base = [head].concat(book.map((h, i) => [
    h.client, h.name, h.cat, h.asset, 'SAMPLE-' + String(1001 + i), h.amc, h.product, h.dist,
    h.priced ? Math.round(h.units * 1000) / 1000 : null,
    r2(h.cost), r2(h.mv), r2(h.mv - h.cost),
    r4(h.cost / 1e7), r4(h.mv / 1e7), r4((h.mv - h.cost) / 1e7),
    r4(h.mv / total), r2(h.g * 100), r2(h.gb * 100), h.days, h.buys[0][0]
  ]));
  const wbB = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(base, { cellDates: true }), 'Base File');

  /* ---- IRR workbook: fund flows and the benchmark's, joined on client + instrument ---- */
  const fh = ['CLIENT NAME', 'INSTRUMENT NAME', 'ASSET CLASS', 'PRODUCT', 'FOLIO NO', 'TRXN_DATE', 'TRANSACTION TYPE', 'TYPE', 'PRICE', 'AMOUNT'];
  const bh = ['CLIENT NAME', 'INSTRUMENT NAME', 'ASSET CLASS', 'PRODUCT', 'INDEX NAME', 'TRXN_DATE', 'BM_AMOUNT'];
  const fRows = [fh], bRows = [bh];
  book.forEach((h, i) => {
    h.fund.forEach(f => fRows.push([h.client, h.name, h.asset, h.product, 'SAMPLE-' + String(1001 + i), f.t,
      f.type, f.rtype || 'Transaction', h.priced ? f.price : null, r2(f.amt)]));
    h.bench.forEach(b => bRows.push([h.client, h.name, h.asset, h.product, h.asset === 'Debt' ? 'CRISIL Composite Bond Index' : 'Nifty 500 TRI', b.t, r2(b.amt)]));
  });
  const wbI = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbI, XLSX.utils.aoa_to_sheet(fRows, { cellDates: true }), 'SI Xirr');
  XLSX.utils.book_append_sheet(wbI, XLSX.utils.aoa_to_sheet(bRows, { cellDates: true }), 'SI Bmxirr');

  return {
    book, total,
    baseBuf: XLSX.write(wbB, { type: 'buffer', bookType: 'xlsx' }),
    irrBuf: XLSX.write(wbI, { type: 'buffer', bookType: 'xlsx' })
  };
}

/* A second family that shares no scheme and no client with the main book:
   load it after the main book in the same tab to check that nothing carries over. */
function buildFamilyB(host) {
  const { XLSX, REF } = host || load();
  const main = new Set(plan(REF).map(h => h.name));
  const pick = pre => Object.keys(REF.MF_PERF).sort().find(k => k.startsWith(pre) && !main.has(k) &&
    REF.MF_PERF[k].type === 'equity' && REF.EQUITY_ANALYTICS[k]);
  const names = ['HDFC ', 'ICICI Pru ', 'SBI ', 'Kotak '].map(pick).filter(Boolean);
  if (names.length < 4) throw new Error('could not pick four family-B schemes');
  const head = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name',
    'Distributor Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)', 'XIRR (%)', 'BMXIRR (%)'];
  const rows = [head].concat(names.map((n, i) => [i % 2 ? 'Sample Client Y' : 'Sample Client X', n, REF.MF_PERF[n].sheet,
    'Equity', n.split(' ')[0], 'Mutual Funds', 'Centricity', 0.5, r4(0.6 + i * 0.1), r4(0.1 + i * 0.1), 11 + i, 10 + i]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Base File');
  return { names, baseBuf: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
}

module.exports = { build, buildFamilyB, AS_ON };

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'test-data'));
  fs.mkdirSync(out, { recursive: true });
  const host = load();
  const r = build(host);
  fs.writeFileSync(path.join(out, 'Sample_Base_File.xlsx'), r.baseBuf);
  fs.writeFileSync(path.join(out, 'Sample_IRR_Transactions.xlsx'), r.irrBuf);
  const b = buildFamilyB(host);
  fs.writeFileSync(path.join(out, 'Sample_Base_File_B.xlsx'), b.baseBuf);
  console.log('holdings : ' + r.book.length + '   total CMV Rs ' + (r.total / 1e7).toFixed(4) + ' Cr');
  r.book.forEach(h => console.log('  ' + h.client.padEnd(16) + h.product.padEnd(14) + (h.mv / 1e7).toFixed(4).padStart(8) + ' Cr  g ' +
    (h.g * 100).toFixed(1).padStart(5) + '%  ' + h.name));
  console.log('wrote    : ' + path.join(out, 'Sample_Base_File.xlsx'));
  console.log('wrote    : ' + path.join(out, 'Sample_IRR_Transactions.xlsx'));
  console.log('wrote    : ' + path.join(out, 'Sample_Base_File_B.xlsx') + '   (family B: ' + b.names.join(' | ') + ')');
}
