/* ============================================================================
   KI-162 (TX-03) — a listed Indian company named "International", "Global" or
   "Overseas" is a listed equity share, not a Global Fund.

     node tools/regression/KI-162-direct-equity-international.js

   Before the fix taxClassOf tested /global|international|overseas|us equity/ on
   category + name BEFORE the direct-equity test, so 286 STOCK_INFO names (Coromandel
   International, KEC International, Indian Overseas Bank, Global Health, ...) were
   taxed as Global Funds: 24 months, short term at slab, no 20% rate. Tax Reckoner
   TY 2026-27, Master Summary #1 (R8): listed equity shares, more than 12 months is long
   term, STCG 20%, LTCG 12.5%.

   After the fix: direct equity is tested first, and the direct-equity product labels
   include Equity, Shares and Stocks (D-040 c). A share is foreign-listed only on a
   positive marker (an ISIN not starting with IN, or a product or category label naming
   foreign, international, US or overseas equity): the new row "Foreign-listed shares
   (held directly)", 24 months, slab, 12.5% (D-040 c; the reckoner has no row).

   Known answers (the review's probe): as on 19 Oct 2026, 100 shares bought at Rs 100
   (Rs 10,000), worth Rs 140 (Rs 14,000), gain Rs 4,000. Purchase dates fall on the
   19th, so whole months and the anniversary rule (TX-01) agree.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const LES = 'Listed Equity Shares', FOREIGN = 'Foreign-listed shares (held directly)';
const tc = (o, R) => E.taxClassOf(Object.assign({ asset: 'Equity', category: 'Large Cap' }, o), R === undefined ? REF : R);

console.log('--- classification ---');
['Direct Equity', 'Equity', 'Shares', 'Stocks', 'Equity Shares', 'Listed Equity', 'Equities'].forEach(p =>
  ok(tc({ product: p, name: 'Coromandel International Ltd.' }) === LES, '"Coromandel International Ltd." under product "' + p + '" is ' + LES));
const SI = REF.STOCK_INFO, SR = REF.STOCK_RET;
const legacyGlobal = Object.keys(SI).filter(k => /global|international|overseas|us equity/.test((SI[k][0] + k).toLowerCase()));
const moved = legacyGlobal.filter(k => tc({ product: 'Direct Equity', category: SI[k][0], name: k }) === LES);
ok(legacyGlobal.length === 286 && moved.length === 286,
  'all 286 STOCK_INFO names the old global test caught are now ' + LES + ' (' + moved.length + ' of ' + legacyGlobal.length + ')');
const foreignIsin = Object.keys(SR).filter(k => SR[k].isin && !/^IN/i.test(SR[k].isin) && SI[k]);
ok(foreignIsin.length >= 1 && foreignIsin.every(k => tc({ product: 'Direct Equity', category: SI[k][0], name: k }) === FOREIGN),
  'a STOCK_INFO share whose STOCK_RET ISIN is not Indian is foreign-listed (' + foreignIsin.join(', ') + ')');
ok(tc({ product: 'Direct Equity', name: 'nxp semiconductors' }, null) === LES,
  'the ISIN is the marker: without the reference data the same share has none and is ' + LES);
ok(tc({ product: 'Direct Equity', name: 'Synthetic Corp', isin: 'US0000000001' }) === FOREIGN, 'a base row whose own ISIN is US... is foreign-listed');
ok(tc({ product: 'Direct Equity', name: 'Synthetic Corp', isin: 'INE000000001' }) === LES, 'a base row whose own ISIN is IN... is ' + LES);
ok(tc({ product: 'Direct Equity', name: 'Synthetic Corp', isin: 'not an isin' }) === LES, 'text that is not an ISIN is no marker');
[['Foreign Shares', 'Large Cap'], ['Shares', 'US Equity'], ['Direct Equity', 'International Equity'], ['Overseas Stocks', ''],
 ['Stocks', 'U.S. Equity']].forEach(([p, c]) =>
  ok(tc({ product: p, category: c, name: 'Synthetic Corp' }) === FOREIGN, 'product "' + p + '", category "' + c + '": foreign-listed'));
ok(tc({ product: 'Direct Equity', category: 'Others', name: 'mondelez international' }) === LES,
  'a foreign company with no marker in the data (STOCK_INFO "Others", no ISIN) is ' + LES + ' (D-040 c: a positive marker is required)');
ok(tc({ product: 'Direct Equity', name: 'Asian Paints Ltd.' }) === LES, 'control: Asian Paints is ' + LES);
['Mutual Funds', 'ETF', 'Index Funds', 'Fund of Funds', ''].forEach(p => ['Global', ''].forEach(c =>
  ok(tc({ product: p, category: c, name: 'ICICI Pru US Bluechip Equity Fund(G)' }) === 'Global Funds',
    'ICICI Pru US Bluechip Equity Fund stays Global Funds under product "' + p + '", category "' + c + '"')));
ok(REF.TAX_RULES.some(r => r.inst === FOREIGN && r.months === 24 && r.st.rate === null && r.lt.rate === 0.125),
  'TAX_RULES row ' + FOREIGN + ': 24 months, short term at slab, LTCG 12.5% (D-040 c)');

console.log('--- known answers, as on 19 Oct 2026 ---');
const stock = (name, d, nav) => new T.Book().add({ name, product: 'Direct Equity', asset: 'Equity', category: 'Large Cap', nav: nav || 140, lots: [[d, 100, 100]] });
const one = (name, d) => { const X = stock(name, d).tax('2026-10-19'); return { p: X.positions[0], h: X.harvest }; };
const c1 = one('Coromandel International Ltd.', '2025-06-19');
ok(c1.p.cls === LES && T.near(T.RS(c1.p.ltGain), 4000) && T.near(T.RS(c1.h.taxBefore), 500),
  'Coromandel International, 16 months: ' + LES + ', LTCG Rs 4,000, tax before Rs 500 (got ' + c1.p.cls + ', ' + T.RS(c1.p.ltGain) + ', ' + T.RS(c1.h.taxBefore) + '; was Global Funds, STCG at slab, Rs 0)');
const c2 = one('KEC International Ltd.', '2025-10-19');
ok(T.near(T.RS(c2.p.stGain), 4000) && T.near(T.RS(c2.h.taxBefore), 800), 'KEC International, exactly 12 months: STCG Rs 4,000 at 20% = Rs 800 (got ' + T.RS(c2.h.taxBefore) + ')');
const c3 = one('Syngene International Ltd.', '2025-09-19');
ok(T.near(T.RS(c3.p.ltGain), 4000) && T.near(T.RS(c3.h.taxBefore), 500), 'Syngene International, 13 months: LTCG Rs 4,000, Rs 500');
const c4 = one('Indian Overseas Bank', '2024-04-19');
ok(T.near(T.RS(c4.p.ltGain), 4000) && T.near(T.RS(c4.h.taxBefore), 500), 'Indian Overseas Bank, 30 months: LTCG, Rs 500 (unchanged)');
const c5 = one('Asian Paints Ltd.', '2025-06-19');
ok(c5.p.cls === LES && T.near(T.RS(c5.h.taxBefore), 500), 'control: Asian Paints, 16 months: Rs 500');

/* a long-term loss sets off only long-term gains: KEC International lost Rs 3,000 over 13 months;
   Asian Paints gained Rs 5,000 long term; Infosys Rs 2,000 short term.
   before = 5,000 x 12.5% + 2,000 x 20% = 1,025; after = (5,000 - 3,000) x 12.5% + 400 = 650; saving 375.
   (As a Global Fund held under 24 months the loss was short term and went to the 20% pool first:
   saving 525.) */
const lossBook = new T.Book()
  .add({ name: 'KEC International Ltd.', product: 'Direct Equity', asset: 'Equity', category: 'Mid Cap', nav: 70, lots: [['2025-09-19', 100, 100]] })
  .add({ name: 'Asian Paints Ltd.', product: 'Direct Equity', asset: 'Equity', category: 'Large Cap', nav: 150, lots: [['2025-06-19', 100, 100]] })
  .add({ name: 'Infosys Ltd.', product: 'Direct Equity', asset: 'Equity', category: 'Large Cap', nav: 120, lots: [['2026-06-19', 100, 100]] });
const LB = lossBook.tax('2026-10-19').harvest;
ok(T.near(T.RS(LB.ltLosses), 3000) && T.near(T.RS(LB.taxBefore), 1025) && T.near(T.RS(LB.taxAfter), 650) && T.near(T.RS(LB.saving), 375),
  'loss set-off: the Rs 3,000 long-term loss offsets long-term gains only: tax 1,025 to 650, saving Rs 375 (got ' +
  T.RS(LB.taxBefore) + ' / ' + T.RS(LB.taxAfter) + ' / ' + T.RS(LB.saving) + '; was Rs 525)');

console.log('--- screen and slide ---');
const m = stock('Coromandel International Ltd.', '2025-06-19').review('2026-10-19');
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m));
    ok(tx.indexOf(LES) >= 0 && tx.indexOf('Global Funds') < 0, 'Taxation tab: the share is under ' + LES + ', no Global Funds class');
    const sl = await T.taxSlidesText(m);
    ok(sl.indexOf(LES) >= 0 && sl.indexOf('Global Funds') < 0, 'tax slides: the same');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
