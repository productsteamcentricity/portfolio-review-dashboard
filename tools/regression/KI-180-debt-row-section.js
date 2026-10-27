/* ============================================================================
   KI-180 (TX-21) — the debt mutual fund row cites the Income-tax Act 2025.

     node tools/regression/KI-180-debt-row-section.js

   The row read "Debt Mutual Funds – Sec. 50AA", a section of the Income-tax Act 1961.
   Tax Reckoner TY 2026-27, Section Map #15 (R19) and Master Summary R24-R25: the Act
   of 2025, in force from 1 Apr 2026, numbers it Sec. 76 (old 50AA). This answers OD-28.

   The row and the class taxClassify returns must change together: computeTaxation
   finds a class's rule by its exact name, and the review measured that a one-sided
   rename moved every debt fund of the synthetic book to "unclassified" (short-term CMV
   2.400027 to 0.606327 Cr). The fix renames both in one edit, and a class with no
   TAX_RULES row is now unclassified with a reason instead of a position with no rule.
   Checked here:
     - the row and the class carry the new name; no "Sec. 50AA" is left in the page;
     - every class taxClassOf returns, over the reference universes and a set of
       synthetic holdings that reaches every branch, is a TAX_RULES row;
     - with the row removed, a debt fund is unclassified with a reason naming the class;
     - the synthetic sample book (tools/make-sample-base.js) gives the same taxation as
       before this change (the review's figures on main 517becf): CMV 8.7443, long term
       5.547273, short term 2.400027, not classified 0.797, LTCG 2.047273, STCG 0.350027,
       not classified gain 0.147, tax before 0.267175 Cr; only the label changed.
   Synthetic data only.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const H = T.host(), { E, REF } = H;
const DEBT = 'Debt Mutual Funds – Sec. 76 (old 50AA)';

console.log('--- the row and the class ---');
const rows = REF.TAX_RULES.filter(r => /^Debt Mutual Funds/.test(r.inst));
ok(rows.length === 1 && rows[0].inst === DEBT && rows[0].alwaysShort === true, 'TAX_RULES has one debt mutual fund row, "' + DEBT + '"');
ok(E.taxClassOf({ asset: 'Debt', product: 'Mutual Funds', category: 'Corporate Bond Fund', name: 'X Corporate Bond Fund-Reg(G)' }, REF) === DEBT, 'a corporate bond fund is classed "' + DEBT + '"');
const html = fs.readFileSync(path.join(require('../engine-host.js').ROOT, 'index.html'), 'utf8');
ok(html.indexOf('Sec. 50AA') < 0 && html.indexOf('(old 50AA)') >= 0, 'index.html no longer says "Sec. 50AA" anywhere');

console.log('--- every class taxClassOf returns is a TAX_RULES row ---');
const INST = new Set(REF.TAX_RULES.map(r => r.inst)), seen = new Map();
const note = (h) => { const c = E.taxClassOf(h, REF); if (c != null && !seen.has(c)) seen.set(c, h.name); };
const assetOf = (t, s) => t === 'equity' ? 'Equity' : t === 'debt' ? 'Debt' : t === 'hybrid' ? 'Hybrid' : (/gold|silver/i.test(s) ? 'Commodity' : 'Others');
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => Object.keys(REF[blk]).forEach(k => ['Mutual Funds', 'ETF', 'Fund of Funds', ''].forEach(p =>
  note({ product: p, asset: assetOf(REF[blk][k].type, REF[blk][k].sheet), category: REF[blk][k].sheet, name: k }))));
Object.keys(REF.SIF_PERF).forEach(k => note({ product: 'SIF', asset: 'Equity', category: REF.SIF_PERF[k].category, name: k }));
['Equity', 'Debt'].forEach(a => Object.keys(REF.AIF_PERF).forEach(k => note({ product: 'AIF', asset: a, category: REF.AIF_PERF[k].category, name: k })));
Object.keys(REF.PMS_PERF).forEach(k => note({ product: 'PMS', asset: 'Equity', category: REF.PMS_PERF[k].category, name: k }));
Object.keys(REF.STOCK_INFO).forEach(k => note({ product: 'Direct Equity', asset: 'Equity', category: REF.STOCK_INFO[k][0], name: k }));
[['Debt', 'AIF', 'AIF (CAT III) - Long Short', 'X Fund'], ['Debt', 'AIF', 'Category III', 'X Debt Fund'], ['Equity', 'AIF', 'Category III', 'X Long Short Fund'],
 ['Equity', 'AIF', 'Category III', 'X Fund'], ['Debt', 'AIF', 'Category II', 'X Credit Fund'], ['Equity', 'Unlisted Shares', '', 'X Pvt Ltd'],
 ['Debt', 'Bonds', 'Unlisted', 'X 10% NCD'], ['Debt', 'Bonds', 'Corporate Bond', 'X 9% NCD'], ['Debt', 'Bonds', 'G-Sec', '7.18% GOI 2033'],
 ['Debt', 'Bonds', '', 'X Market Linked Debenture'], ['Commodity', 'Bonds', '', 'Sovereign Gold Bond 2028'], ['Others', 'Crypto', 'Crypto', 'Bitcoin'],
 ['Equity', 'Shares', 'US Equity', 'X Inc'], ['Equity', 'SIF', 'Long-Short Fund', 'X Debt Long-Short Fund'], ['Equity', 'Mutual Funds', 'Index', 'X Nasdaq 100 ETF'],
 ['Hybrid', 'Mutual Funds', 'Balanced Hybrid Fund', 'X Balanced Hybrid Fund'], ['Equity', 'REIT', 'REIT', 'X REIT'], ['Equity', 'InvIT', 'InvIT', 'X InvIT'],
 ['Debt', 'Mutual Funds', 'Equity Linked Savings Scheme', 'X ELSS Tax Saver Fund']].forEach(([a, p, c, n]) => note({ asset: a, product: p, category: c, name: n }));
const missing = [...seen.keys()].filter(c => !INST.has(c));
ok(missing.length === 0 && seen.size >= 30, seen.size + ' distinct classes returned, every one a TAX_RULES row' + (missing.length ? '; missing: ' + missing.join(', ') : ''));
/* tax batch T2 (KI-161): a row for units bought before 1 Apr 2023 is reached through the "before" of a
   Specified row, by the lot's date, never by taxClassify */
const viaBefore = new Set(REF.TAX_RULES.filter(r => r.before && seen.has(r.inst)).map(r => r.before));
const unused = [...INST].filter(i => !seen.has(i) && !viaBefore.has(i));
ok(unused.length === 0, 'and every TAX_RULES row is reachable (directly, or through a Specified row\'s "before")' + (unused.length ? '; not reached: ' + unused.join(', ') : ''));

console.log('--- a class with no row is unclassified, with a reason ---');
const noDebt = Object.assign({}, REF, { TAX_RULES: REF.TAX_RULES.filter(r => r.inst !== DEBT) });
const book = new T.Book().add({ name: 'X Corporate Bond Fund-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Corporate Bond Fund', nav: 110, lots: [['2024-05-15', 1000, 100]] });
const X = book.tax('2026-10-19', Object.assign({}, book.ref(null), { TAX_RULES: noDebt.TAX_RULES }));
ok(X.positions.length === 0 && X.unmapped.length === 1 && X.unmapped[0].reason.indexOf(DEBT) >= 0 && T.near(T.RS(X.totals.unclassCmv), 110000),
  'without the row the debt fund is unclassified ("' + (X.unmapped[0] && X.unmapped[0].reason) + '"), not a position with no rule');
const Y = book.tax('2026-10-19');
ok(Y.positions.length === 1 && Y.positions[0].rule && Y.positions[0].rule.inst === DEBT && T.near(T.RS(Y.positions[0].stGain), 10000), 'with the row it is a position under its rule: STCG Rs 10,000');

console.log('--- the synthetic sample book: the same taxation, the new label ---');
const { build } = require('../make-sample-base.js');
const fx = build(H);
const aoa = (wb, n) => H.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const base = E.parseBaseRows(aoa(H.XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File'));
const iw = H.XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const m = E.computeReview(base, Object.assign({}, REF, { IRR: E.parsers.parseIRR(iw.SheetNames, n => aoa(iw, n)) }), { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
const t = m.taxation.totals, r6 = v => Math.round(v * 1e6) / 1e6;
const got = [t.cmv, t.ltcgCmv, t.stcgCmv, t.unclassCmv, t.ltcgGain, t.stcgGain, t.unclassGain, m.taxation.harvest.taxBefore].map(r6);
ok(JSON.stringify(got) === JSON.stringify([8.7443, 5.547273, 2.400027, 0.797, 2.047273, 0.350027, 0.147, 0.267175]), 'totals and tax before unchanged (' + got.join(', ') + ')');
const debts = m.taxation.positions.filter(p => /^Debt Mutual Funds/.test(p.cls));
ok(debts.length === 2 && debts.every(p => p.cls === DEBT) && r6(debts.reduce((s, p) => s + p.stCmv, 0)) === 1.7937, 'its two debt funds carry the new label (short-term CMV 1.7937 Cr)');
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m)), sl = await T.taxSlidesText(m);
    ok(tx.indexOf(DEBT) >= 0 && tx.indexOf('Sec. 50AA') < 0, 'Taxation tab shows the new label');
    ok(sl.indexOf(DEBT) >= 0 && sl.indexOf('Sec. 50AA') < 0, 'tax slides show the new label');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
