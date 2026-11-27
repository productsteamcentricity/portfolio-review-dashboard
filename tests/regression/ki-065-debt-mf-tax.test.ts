// covers: KI-065 E-41 OD-27 KI-099
// KI-065 (audit NEW-19): Corporate Bond and Dynamic Bond mutual funds (and G-Sec index funds and ETFs) were taxed as
// listed bonds or G-Secs held directly, 12 months and 12.5%, instead of as debt mutual funds (Sec 76, old 50AA). The
// live known answer is the KI-065 table of tools/smoke-review.js (15 cases), ported here word for word onto the new
// classification (app/src/engine/tax/classify.ts): a debt fund by its asset tag, by its SEBI debt category or by a
// G-Sec, SDL or gilt name (OD-27); directly held bonds and G-Secs keep their rows; an equity : G-Sec blend named by its
// ratio is unclassified until its equity share decides (KI-037); earlier rows keep their place. Then the same answer
// end to end: a Corporate Bond fund bought after 1 Apr 2023 is always short term, never long term after 12 months.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { INST, TAX_WHY, classifyHolding } from '../../app/src/engine/tax/classify.ts';
import type { ClassifyHolding } from '../../app/src/engine/tax/classify.ts';
import { computeTaxLots } from '../../app/src/engine/tax/lots.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { parseIrrFile } from '../../app/src/ingest/irr-file.ts';
import { ymdToDay } from '../../app/src/engine/dates.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { bookBytes } from '../fixtures/make-books.ts';
import { FUND_HEADER, dateCell, fundRow, toWorkbook } from '../fixtures/make-irr-files.ts';

/** A holding as the base-file reader gives it: the asset class (OD-7: "Fixed Income" is Debt, blank is unknown). */
const h = (asset: string, product: string, category: string, name: string): ClassifyHolding => ({
  instrumentName: name, product, categoryLabel: category, assetLabel: asset || null,
  assetClass: asset === 'Fixed Income' ? 'Debt' : asset === '' ? null : (asset as ClassifyHolding['assetClass']),
});

const MF = 'Mutual Funds';
/** tools/smoke-review.js, "KI-065: debt mutual funds are taxed under Sec. 76". The live reads a blank asset as Equity;
 * the case it names ("a blank Asset parses as Equity: the G-Sec name still marks a debt fund") is run both ways. */
const CASES: ReadonlyArray<readonly [ClassifyHolding, string | null]> = [
  [h('Debt', MF, 'Corporate Bond Fund', 'X Corporate Bond Fund-Reg(G)'), INST.debtMf],
  [h('Debt', MF, 'Dynamic Bond', 'X Dynamic Bond Fund-Reg(G)'), INST.debtMf],
  [h('Debt', MF, 'Gilt Fund', 'X Gilt Fund-Reg(G)'), INST.debtMf],
  [h('Debt', MF, 'Index Funds', 'X CRISIL IBX Gilt Index Fund'), INST.debtMf],
  [h('Fixed Income', MF, 'Corporate Bond Fund', 'X Corporate Bond Fund-Reg(G)'), INST.debtMf],
  [h('Debt', 'Bonds', 'Corporate Bond', 'X Ltd 8.5% NCD 2028'), INST.listedBonds],
  [h('Debt', 'Bonds', 'G-Sec', '7.18% GOI 2033'), INST.gsec],
  [h('Equity', MF, 'Large Cap Fund', 'X Large Cap Fund-Reg(G)'), INST.equityMf],
  [h('Equity', MF, 'Index Funds', 'X Nifty G-Sec Apr 2029 Index Fund-Reg(G)'), INST.debtMf],
  [h('', MF, 'Index Funds', 'X Nifty G-Sec Apr 2029 Index Fund-Reg(G)'), INST.debtMf],
  [h('Equity', MF, 'Other ETFs', 'X Nifty SDL Apr 2027 ETF'), INST.debtMf],
  [h('Equity', MF, 'Debt', 'X Banking & PSU Debt Fund-Reg(G)'), INST.debtMf],
  [h('Equity', MF, 'Index Funds', 'X Nifty200 Momentum 30 Plus 8-13yr G-Sec 75:25 Index Fund'), null],
  [h('Commodity', MF, 'Gold ETF', 'X Gold ETF'), INST.commodityEtf],
  [h('Equity', MF, 'FoF Overseas', 'X US Equity FoF'), INST.global],
  [h('Debt', MF, 'Arbitrage Fund', 'X Arbitrage Fund-Reg(G)'), INST.equityMf],
];

describe('KI-065: debt mutual funds take Sec. 76 (old 50AA); direct bonds and G-Secs keep their rows', () => {
  for (const [hold, want] of CASES) {
    test(`${hold.instrumentName} (${hold.assetLabel ?? 'blank asset'}, ${hold.product}, ${hold.categoryLabel})`, () => {
      const c = classifyHolding(hold);
      assert.equal(c.inst, want);
      if (want === null) assert.equal(c.why, TAX_WHY.blend);
    });
  }
  test('the debt row is the I-21 row named "Debt Mutual Funds ... Sec. 76 (old 50AA)"', () => {
    assert.match(INST.debtMf, /^Debt Mutual Funds . Sec\. 76 \(old 50AA\)$/);
  });
});

describe('KI-065 end to end: a Corporate Bond fund bought after 1 Apr 2023 is short term, never long after 12 months', () => {
  test('the lot of 1 May 2024 is short term on 30 Sep 2026 (it would be long under the listed-bond row)', () => {
    // 1,000 u at 10.5 (10,500) bought 1 May 2024; CMV 12,000. As a debt fund (Sec 76, always short): short 12,000,
    // gain 1,500. Under the listed-bond row (12 months) it would have been long term by 2 May 2025.
    const xlsx = loadSheetJS();
    const NAME = 'Sample Corporate Bond Fund - Regular Plan - Growth';
    const base = parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, [{
      client: 'Sample Client A', name: NAME, cat: 'Corporate Bond Fund', asset: 'Debt', folio: '', amc: 'Sample Mutual Fund',
      product: MF, dist: 'Sample Distributor 1', units: 1000, invested: 10500, mv: 12000, xirr: 7, bmxirr: 6, days: 800, purchase: [2024, 5, 1],
    }])), { sourceId: 'b'.repeat(64) as SourceFileId });
    const irr = parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER,
      fundRow('Sample Client A', NAME, '', 'Debt', dateCell(2024, 5, 1), 'Purchase', null, 10.5, -10500, 'Sample Distributor 1')] }])),
    { sourceId: 'c'.repeat(64) as SourceFileId });
    const r = computeTaxLots(base.holdings, irr.fund, { asOn: ymdToDay(2026, 9, 30)! });
    assert.equal(r.positions.length, 1);
    const x = r.positions[0]!;
    assert.equal(x.taxRule, INST.debtMf);
    assert.ok(Math.abs(x.st.cmv - 12000) <= 0.01 && Math.abs(x.st.gain! - 1500) <= 0.01, `${x.st.cmv} ${x.st.gain}`);
    assert.equal(x.lt.cmv, 0);
  });
});
