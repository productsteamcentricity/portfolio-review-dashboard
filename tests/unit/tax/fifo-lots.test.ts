// covers: E-42 E-41 OD-2 OD-12 OD-15 OD-16 KI-022 KI-064 KI-069 KI-070 KI-140 BF-18 D-040
// FIFO tax lots of the holdings (app/src/engine/tax/lots.ts, NB-M7a S4): hand-worked cases, each on a synthetic base
// file (tests/fixtures/make-books.ts bookBytes, rupee columns, so amounts are read to the paisa) and a synthetic IRR file
// (tests/fixtures/make-irr-files.ts), read by the real readers and joined by the returns' join (matcherJoin). The
// working of each answer is in the comments; the figures are never taken from the engine. Money in rupees; the review is
// as on 30 Sep 2026 unless a case says otherwise.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { parseIrrFile } from '../../../app/src/ingest/irr-file.ts';
import { computeTaxLots, lotLocked, lotTerm, toTaxPosition } from '../../../app/src/engine/tax/lots.ts';
import type { TaxLotsResult, TaxPositionRecord } from '../../../app/src/engine/tax/lots.ts';
import { INST, TAX_RULES_I21, i21ByInst } from '../../../app/src/engine/tax/classify.ts';
import { rollupHoldings } from '../../../app/src/engine/tax/holdings-rollup.ts';
import { buildHarvests } from '../../../app/src/engine/tax/harvest.ts';
import { financialYearOf } from '../../../app/src/engine/tax/rules.ts';
import type { ClientId } from '../../../app/src/model/ids.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { DayNumber } from '../../../app/src/model/value.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { bookBytes } from '../../fixtures/make-books.ts';
import type { BookRow } from '../../fixtures/make-books.ts';
import { FUND_HEADER, dateCell, fundRow, toWorkbook } from '../../fixtures/make-irr-files.ts';
import type { Cell } from '../../fixtures/make-irr-files.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-11-26T00:00:00.000Z';
const day = (y: number, m: number, d: number): DayNumber => ymdToDay(y, m, d)!;
const AS_ON = day(2026, 9, 30);
const A = 'Sample Client A';
const D1 = 'Sample Distributor 1';
const D2 = 'Sample Distributor 2';

/** A holding of the base file (money in rupees). */
function hold(name: string, cat: string, asset: string, units: number | null, invested: number, mv: number, o: Partial<BookRow> = {}): BookRow {
  return { client: A, name, cat, asset, folio: '', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: D1, units, invested, mv,
    xirr: 10, bmxirr: 9, days: 300, purchase: [2024, 1, 1], ...o };
}
/** A fund flow: paid in negative, paid out positive (the file's sign). */
function flow(name: string, ymd: readonly [number, number, number], type: string | null, price: number | null, amount: number, o: { folio?: string; dist?: string | null; rowType?: string } = {}): Cell[] {
  return fundRow(A, name, o.folio ?? '', 'Equity', dateCell(ymd[0], ymd[1], ymd[2]), type, o.rowType ?? null, price, amount, o.dist === undefined ? D1 : o.dist);
}

function run(book: BookRow[], flows: Cell[][], asOn: DayNumber = AS_ON, blankInvested: number[] = []): TaxLotsResult {
  const base = parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, book, blankInvested)), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW });
  const irr = parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...flows] }])), { sourceId: 'c'.repeat(64) as SourceFileId, now: NOW });
  return computeTaxLots(base.holdings, irr.fund, { asOn });
}

const all = (r: TaxLotsResult): TaxPositionRecord[] => [...r.positions, ...r.unreconciled, ...r.unmapped];
const recsOf = (r: TaxLotsResult, name: string): TaxPositionRecord[] => all(r).filter((x) => x.instrumentName === name);
const one = (r: TaxLotsResult, name: string): TaxPositionRecord => {
  const l = recsOf(r, name);
  assert.equal(l.length, 1, `${name}: ${l.length} records`);
  return l[0]!;
};
const near = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 0.01, `${msg} ${a} != ${b}`);
};

const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
const FLEXI = 'Sample Flexi Cap Fund - Regular Plan - Growth';
const MID = 'Sample Midcap Opportunities Fund - Regular Plan - Growth';
const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';
const ELSS = 'Sample Tax Saver Fund - Regular Plan - Growth';
const PMS = 'Sample Value Strategy PMS';
const AIF = 'Sample Growth Opportunities AIF Category II';

describe('terms to the as-on date (OD-2, D-040 b)', () => {
  const eq = i21ByInst().get(INST.equityMf)!;
  test('anniversary day is short term, the day after long term', () => {
    // Bought 30 Sep 2025; 12 months on: 30 Sep 2026. Strictly after it is long term.
    assert.equal(lotTerm(eq, day(2025, 9, 30), day(2026, 9, 30), false), 'short');
    assert.equal(lotTerm(eq, day(2025, 9, 30), day(2026, 10, 1), false), 'long');
  });
  test('29 Feb clamps to 28 Feb', () => {
    // Bought 29 Feb 2024; 2025 has no 29 Feb, so the anniversary is 28 Feb 2025: short on it, long on 1 Mar 2025.
    assert.equal(lotTerm(eq, day(2024, 2, 29), day(2025, 2, 28), false), 'short');
    assert.equal(lotTerm(eq, day(2024, 2, 29), day(2025, 3, 1), false), 'long');
  });
  test('ELSS is locked through its 36-month anniversary', () => {
    const elss = i21ByInst().get(INST.elss)!;
    assert.equal(lotLocked(elss, day(2023, 9, 30), day(2026, 9, 30)), true);
    assert.equal(lotLocked(elss, day(2023, 9, 30), day(2026, 10, 1)), false);
  });
  test('the I-21 table has 34 rows and every row name the engine uses', () => {
    assert.equal(TAX_RULES_I21.length, 34);
    const names = new Set(TAX_RULES_I21.map((r) => r.inst));
    for (const n of Object.values(INST)) assert.ok(names.has(n), n);
  });
});

describe('FIFO lots (hand-worked)', () => {
  test('a SIP with a partial redemption, FIFO', () => {
    // Buys: 10 Jan 2025 100 u at 100 (10,000); 10 Jun 2025 80 u at 125 (10,000); 10 Jan 2026 125 u at 80 (10,000).
    // Sale 15 Mar 2026: 15,000 at 125 = 120 u, oldest first: all 100 u of lot 1, then 20 u of lot 2 (60 u left).
    // Open: 60 u bought 10 Jun 2025 (cost 7,500; anniversary 10 Jun 2026, before 30 Sep 2026: long) and 125 u bought
    // 10 Jan 2026 (cost 10,000; anniversary 10 Jan 2027: short). 185 u = the base file's units, so scale 1.
    // Base: invested 17,500, CMV 20,350 (110 a unit). Long: 60 x 110 = 6,600, gain 6,600 - 7,500 = -900.
    // Short: 125 x 110 = 13,750, gain 13,750 - 10,000 = 3,750. Total gain 2,850 = 20,350 - 17,500.
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 185, 17500, 20350)], [
      flow(BLUE, [2025, 1, 10], 'SIP', 100, -10000),
      flow(BLUE, [2025, 6, 10], 'SIP', 125, -10000),
      flow(BLUE, [2026, 1, 10], 'SIP', 80, -10000),
      flow(BLUE, [2026, 3, 15], 'Redemption', 125, 15000),
    ]);
    const x = one(r, BLUE);
    assert.equal(x.status, 'ok');
    assert.equal(x.taxRule, INST.equityMf);
    assert.equal(x.ledger, 'units');
    near(x.lt.cmv, 6600, 'lt cmv'); near(x.lt.gain, -900, 'lt gain');
    near(x.st.cmv, 13750, 'st cmv'); near(x.st.gain, 3750, 'st gain');
    near(x.unclassified.cmv, 0); near(x.unclassified.gain, 0);
    assert.equal(x.lots, 2);
    assert.deepEqual(x.lotDetail.map((l) => [l.day, Math.round(l.units * 1e6) / 1e6, l.bucket]), [[day(2025, 6, 10), 60, 'long'], [day(2026, 1, 10), 125, 'short']]);
    const tp = toTaxPosition(x)!;
    near(tp.lt.gain + tp.st.gain + tp.unclassifiedGain, 2850, 'contract gain');
  });

  test('OD-16 kinds: top-up, STP in and SWP move lots; untyped and unrecognised rows are counted and named', () => {
    // Top-Up 1 Jan 2025 100 u at 100 (10,000); STP In 1 Jul 2025 100 u at 100 (10,000); SWP 1 Aug 2025 5,500 at 110 =
    // 50 u from the oldest lot. Open: 50 u of 1 Jan 2025 (long, cost 5,000) and 100 u of 1 Jul 2025 (anniversary
    // 1 Jul 2026: long, cost 10,000). Base: 150 u, invested 15,000, CMV 18,000. Long 18,000, gain 3,000.
    // "Dividend Reinvest" (unrecognised) and a blank type (untyped) move nothing.
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 150, 15000, 18000)], [
      flow(BLUE, [2025, 1, 1], 'Top-Up', 100, -10000),
      flow(BLUE, [2025, 7, 1], 'STP In', 100, -10000),
      flow(BLUE, [2025, 8, 1], 'SWP', 110, 5500),
      flow(BLUE, [2025, 9, 1], 'Dividend Reinvest', 100, -700),
      flow(BLUE, [2025, 9, 2], null, 100, -300),
      flow(BLUE, [2026, 9, 30], null, null, 18000, { rowType: 'Closing' }),
    ]);
    const x = one(r, BLUE);
    near(x.lt.cmv, 18000); near(x.lt.gain, 3000); near(x.st.cmv, 0);
    assert.deepEqual(r.counts.unrecognised, [{ label: 'Dividend Reinvest', rows: 1 }]);
    assert.equal(r.counts.untyped, 1);
    assert.equal(r.counts.valuation, 1);
    assert.equal(r.counts.trades, 3);
  });

  test('a switch-in without a price moves the holding to the rupee ledger', () => {
    // Switch In 1 Aug 2024, 40,000, no price: no unit lot, so the unit ledger has nothing; the rupee ledger holds one
    // lot of 40,000 rupees. Base: 400 u, invested 40,000, CMV 48,000. On the rupee ledger the base figure is the invested
    // value (40,000 = the lot: drift 0). Anniversary 1 Aug 2025: long. Long 48,000, gain 8,000.
    const r = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 400, 40000, 48000)], [
      flow(FLEXI, [2024, 8, 1], 'Switch In', null, -40000),
    ]);
    const x = one(r, FLEXI);
    assert.equal(x.status, 'ok');
    assert.equal(x.ledger, 'rupees');
    assert.equal(x.pxGap, true);
    assert.equal(x.viaSwitchIn, true);
    near(x.lt.cmv, 48000); near(x.lt.gain, 8000);
    assert.equal(r.counts.noPrice, 1);
  });

  test('rupee-only PMS and an AIF are not split (OD-12, D-040 d, h)', () => {
    // PMS: no units, invested 1,00,000, CMV 1,20,000; one purchase of 1,00,000 with no price: the rupee ledger
    // reconciles (1,00,000), and the PMS row is per security: not split, all of it unclassified (gain 20,000).
    // AIF Category II: pass-through, not split whatever its lots (no IRR flows here): unclassified 60,000, gain 10,000.
    const r = run([
      hold(PMS, 'Multi Cap', 'Equity', null, 100000, 120000, { product: 'PMS', amc: 'Sample Advisors' }),
      hold(AIF, 'Category II', 'Equity', null, 50000, 60000, { product: 'AIF', amc: 'Sample Advisors' }),
    ], [flow(PMS, [2024, 4, 1], 'Purchase', null, -100000)]);
    const p = one(r, PMS);
    assert.equal(p.status, 'not-split');
    assert.equal(p.notSplit, 'per-security');
    assert.equal(p.taxRule, INST.equityPms);
    near(p.lt.cmv, 0); near(p.st.cmv, 0); near(p.unclassified.cmv, 120000); near(p.unclassified.gain, 20000);
    const a = one(r, AIF);
    assert.equal(a.status, 'not-split');
    assert.equal(a.notSplit, 'pass-through');
    assert.equal(a.taxRule, INST.equityAif12);
    near(a.unclassified.cmv, 60000); near(a.unclassified.gain, 10000);
  });

  test('one scheme with two distributors and no folio in the IRR file: lots apportioned by units (OD-15)', () => {
    // IRR (no folio): 1 Feb 2024 200 u at 100 (20,000); 1 Feb 2026 200 u at 120 (24,000). 400 u in all.
    // Holdings: D1 300 u (invested 33,000, CMV 39,000 = 300 x 130) and D2 100 u (invested 11,000, CMV 13,000).
    // D1 share 300 / 400 = 0.75: 150 u long (cost 15,000) and 150 u short (cost 18,000); value 130 a unit.
    //   long 19,500, gain 4,500; short 19,500, gain 1,500; total 6,000 = 39,000 - 33,000.
    // D2 share 0.25: 50 u each; long 6,500, gain 1,500; short 6,500, gain 500; total 2,000.
    const r = run([
      hold(MID, 'Mid Cap Fund', 'Equity', 300, 33000, 39000, { dist: D1 }),
      hold(MID, 'Mid Cap Fund', 'Equity', 100, 11000, 13000, { dist: D2 }),
    ], [
      flow(MID, [2024, 2, 1], 'Purchase', 100, -20000, { dist: null }),
      flow(MID, [2026, 2, 1], 'Purchase', 120, -24000, { dist: null }),
    ]);
    const [h1, h2] = recsOf(r, MID);
    assert.ok(h1 && h2);
    for (const x of [h1, h2]) { assert.equal(x.status, 'ok'); assert.equal(x.apportioned, true); }
    near(h1.lt.cmv, 19500); near(h1.lt.gain, 4500); near(h1.st.cmv, 19500); near(h1.st.gain, 1500);
    near(h2.lt.cmv, 6500); near(h2.lt.gain, 1500); near(h2.st.cmv, 6500); near(h2.st.gain, 500);
    assert.equal(r.counts.apportioned, 2);
  });

  test('folios that tell the two holdings apart split the flows instead (not apportioned)', () => {
    // D1 folio SYN-7001: 300 u at 100 on 1 Feb 2024 (long). D2 folio SYN-7002: 100 u at 120 on 1 Feb 2026 (short).
    const r = run([
      hold(MID, 'Mid Cap Fund', 'Equity', 300, 30000, 39000, { dist: D1, folio: 'SYN-7001' }),
      hold(MID, 'Mid Cap Fund', 'Equity', 100, 12000, 13000, { dist: D2, folio: 'SYN-7002' }),
    ], [
      flow(MID, [2024, 2, 1], 'Purchase', 100, -30000, { folio: 'SYN-7001' }),
      flow(MID, [2026, 2, 1], 'Purchase', 120, -12000, { folio: 'SYN-7002' }),
    ]);
    const [h1, h2] = recsOf(r, MID);
    assert.ok(h1 && h2);
    assert.equal(h1.apportioned, false);
    near(h1.lt.cmv, 39000); near(h1.lt.gain, 9000); near(h1.st.cmv, 0);
    near(h2.st.cmv, 13000); near(h2.st.gain, 1000); near(h2.lt.cmv, 0);
  });

  test('a Specified debt fund splits at 1 Apr 2023 into two records', () => {
    // 1 Mar 2023 1,000 u at 10 (10,000): before 1 Apr 2023, row "Debt MF bought before 1 Apr 2023" (24 months;
    // anniversary 1 Mar 2025: long). 1 May 2023 1,000 u at 10.5 (10,500): Sec 76, always short.
    // Base: 2,000 u, invested 20,500, CMV 24,000 (12 a unit).
    // Part from 2023 (first record): 1,000 x 12 = 12,000, short gain 12,000 - 10,500 = 1,500.
    // Part before 2023 (last, takes the remainder): CMV 24,000 - 12,000 = 12,000, long gain 3,500 - 1,500 = 2,000.
    const r = run([hold(BOND, 'Corporate Bond Fund', 'Debt', 2000, 20500, 24000)], [
      flow(BOND, [2023, 3, 1], 'Purchase', 10, -10000),
      flow(BOND, [2023, 5, 1], 'Purchase', 10.5, -10500),
    ]);
    const [from, pre] = recsOf(r, BOND);
    assert.ok(from && pre);
    assert.equal(from.splitPart, 'from-2023');
    assert.equal(from.taxRule, INST.debtMf);
    near(from.cmv, 12000); near(from.gain, 1500); near(from.st.cmv, 12000); near(from.st.gain, 1500); near(from.lt.cmv, 0);
    assert.equal(pre.splitPart, 'pre-2023');
    assert.equal(pre.taxRule, 'Debt MF bought before 1 Apr 2023');
    near(pre.cmv, 12000); near(pre.gain, 2000); near(pre.lt.cmv, 12000); near(pre.lt.gain, 2000); near(pre.st.cmv, 0);
  });

  test('a listed debt ETF bought before 1 Apr 2023 is long after 12 months; its fund of funds needs 24 (TX-02)', () => {
    // Both bought 1 Feb 2023 (before 1 Apr 2023: row "Debt MF bought before 1 Apr 2023", 24 months, 12 for a listed
    // ETF). On 30 Sep 2024: the ETF's anniversary 1 Feb 2024 is past (long 10,800, gain 800); the FoF's is 1 Feb 2025
    // (short 10,900, gain 900).
    const ETF = 'Sample Bharat Bond ETF April 2030';
    const FOF = 'Sample Bharat Bond ETF FoF April 2030 - Regular Plan - Growth';
    const r = run([
      hold(ETF, 'Index Funds', 'Debt', 10, 10000, 10800, { product: 'ETF' }),
      hold(FOF, 'FoF Domestic', 'Debt', 1000, 10000, 10900),
    ], [flow(ETF, [2023, 2, 1], 'Purchase', 1000, -10000), flow(FOF, [2023, 2, 1], 'Purchase', 10, -10000)], day(2024, 9, 30));
    const e = one(r, ETF);
    assert.equal(e.taxRule, 'Debt MF bought before 1 Apr 2023');
    near(e.lt.cmv, 10800); near(e.lt.gain, 800);
    const f = one(r, FOF);
    assert.equal(f.taxRule, 'Debt MF bought before 1 Apr 2023');
    near(f.st.cmv, 10900); near(f.st.gain, 900);
  });

  test('anniversary day vs the day after, and the 29 Feb clamp, on the lots', () => {
    // 100 u at 100 bought 30 Sep 2025; base 100 u, invested 10,000, CMV 12,000.
    const book = [hold(BLUE, 'Large Cap Fund', 'Equity', 100, 10000, 12000)];
    const flows = [flow(BLUE, [2025, 9, 30], 'Purchase', 100, -10000)];
    const on = one(run(book, flows, day(2026, 9, 30)), BLUE);
    near(on.st.cmv, 12000); near(on.st.gain, 2000); near(on.lt.cmv, 0);
    const after = one(run(book, flows, day(2026, 10, 1)), BLUE);
    near(after.lt.cmv, 12000); near(after.lt.gain, 2000); near(after.st.cmv, 0);
    // Bought 29 Feb 2024: short on 28 Feb 2025, long on 1 Mar 2025.
    const leap = [flow(BLUE, [2024, 2, 29], 'Purchase', 100, -10000)];
    near(one(run(book, leap, day(2025, 2, 28)), BLUE).st.cmv, 12000);
    near(one(run(book, leap, day(2025, 3, 1)), BLUE).lt.cmv, 12000);
  });

  test('ELSS: a lot inside its lock-in is locked, not long or short', () => {
    // 15 Jan 2023 100 u at 100: lock-in to 15 Jan 2026, past; 12 months past: long. 15 Jan 2024 100 u at 100: lock-in
    // to 15 Jan 2027: locked. Base 200 u, invested 20,000, CMV 30,000 (150 a unit).
    // Long 15,000, gain 5,000; unclassified 15,000, gain 5,000, all of it locked.
    const r = run([hold(ELSS, 'ELSS', 'Equity', 200, 20000, 30000)], [
      flow(ELSS, [2023, 1, 15], 'Purchase', 100, -10000),
      flow(ELSS, [2024, 1, 15], 'Purchase', 100, -10000),
    ]);
    const x = one(r, ELSS);
    assert.equal(x.taxRule, INST.elss);
    near(x.lt.cmv, 15000); near(x.lt.gain, 5000); near(x.st.cmv, 0);
    near(x.unclassified.cmv, 15000); near(x.unclassified.gain, 5000);
    near(x.locked!.cmv, 15000); near(x.locked!.gain, 5000);
  });

  test('a trade after the as-on date is left out and counted (D-040 a)', () => {
    // 1 Jan 2025 100 u at 100 (long by 30 Sep 2026); 15 Oct 2026 a further 5,000: after the as-on date, left out.
    // Base 100 u, invested 10,000, CMV 11,000: long 11,000, gain 1,000.
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 100, 10000, 11000)], [
      flow(BLUE, [2025, 1, 1], 'Purchase', 100, -10000),
      flow(BLUE, [2026, 10, 15], 'Purchase', 100, -5000),
    ]);
    const x = one(r, BLUE);
    near(x.lt.cmv, 11000); near(x.lt.gain, 1000);
    assert.equal(x.laterTrades, 1);
    assert.equal(r.counts.later, 1);
    assert.deepEqual(r.counts.laterInstruments, [BLUE]);
  });

  test('a merge gap in units is never reconciled by amount (BF-18, KI-140)', () => {
    // Two folios of one holding, the second without units: the merged units are missing with the gap 'units'. The
    // rupee ledger would reconcile (20,000 invested, 20,000 bought), but a merge gap is not a product priced in rupees.
    const r = run([
      hold(BLUE, 'Large Cap Fund', 'Equity', 100, 10000, 12000, { folio: 'SYN-1' }),
      hold(BLUE, 'Large Cap Fund', 'Equity', null, 10000, 12000, { folio: 'SYN-2' }),
    ], [flow(BLUE, [2024, 1, 1], 'Purchase', 100, -20000)]);
    const x = one(r, BLUE);
    assert.equal(x.status, 'unreconciled');
    assert.equal(x.unreconciledKind, 'unitsGap');
    near(x.unclassified.cmv, 24000);
  });

  test('long + short + unclassified = CMV and gain, to Rs 0.01, on a scaled holding and the whole book', () => {
    // FIFO gives 185 u; the base file says 185.5 (0.27% away, inside 1%): the lots are scaled by 185.5 / 185. Values at
    // CMV / units, costs scaled to the invested value: the parts add back to the holding exactly, whatever the scale.
    const book = [
      hold(BLUE, 'Large Cap Fund', 'Equity', 185.5, 17654.32, 21987.65),
      hold(BOND, 'Corporate Bond Fund', 'Debt', 2000, 20543.21, 23456.78),
      hold(ELSS, 'ELSS', 'Equity', 200, 20111.11, 29876.54),
    ];
    const r = run(book, [
      flow(BLUE, [2025, 1, 10], 'Purchase', 100, -10000), flow(BLUE, [2025, 6, 10], 'Purchase', 125, -10000),
      flow(BLUE, [2026, 1, 10], 'Purchase', 80, -10000), flow(BLUE, [2026, 3, 15], 'Redemption', 125, 15000),
      flow(BOND, [2023, 3, 1], 'Purchase', 10, -10000), flow(BOND, [2023, 5, 1], 'Purchase', 10.5, -10500),
      flow(ELSS, [2023, 1, 15], 'Purchase', 100, -10000), flow(ELSS, [2024, 1, 15], 'Purchase', 100, -10000),
    ]);
    for (const h of book) {
      const rs = recsOf(r, h.name);
      const cmv = rs.reduce((s, x) => s + x.lt.cmv + x.st.cmv + x.unclassified.cmv, 0);
      const gain = rs.reduce((s, x) => s + x.lt.gain! + x.st.gain! + x.unclassified.gain!, 0);
      near(cmv, h.mv, `${h.name} cmv`);
      near(gain, h.mv - h.invested, `${h.name} gain`);
      near(rs.reduce((s, x) => s + x.cmv, 0), h.mv, `${h.name} records cmv`);
    }
    const total = all(r).reduce((s, x) => s + x.lt.cmv + x.st.cmv + x.unclassified.cmv + (x.fundLevel?.cmv ?? 0), 0);
    near(total, book.reduce((s, h) => s + h.mv, 0), 'book');
  });

  test('R2 S-2 (R2-F5): units blank and invested 0, the identity still holds: the CMV lands in unclassified', () => {
    // Units blank: the rupee ledger, whose base figure is the invested value, 0 here. One Purchase of 10,000 gives a
    // rupee lot of 10,000 against a base of 0: full drift (not "0 drift" as the live reads it), so the holding is
    // unreconciled ('value') and keeps its whole CMV unclassified: 12,000 at a gain of 12,000 - 0 = 12,000. Long and
    // short hold 0. long + short + unclassified = 0 + 0 + 12,000 = CMV. (The old code scaled the lot to 0 rupees, so all
    // three were 0 and the 12,000 vanished; the live does the same: ledger entry TX-05.)
    const r = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', null, 0, 12000)], [flow(FLEXI, [2024, 8, 1], 'Purchase', 100, -10000)]);
    const x = one(r, FLEXI);
    assert.equal(x.status, 'unreconciled');
    assert.equal(x.unreconciledKind, 'value');
    assert.equal(x.ledger, 'rupees');
    near(x.unclassified.cmv, 12000, 'unclassified cmv');
    near(x.unclassified.gain, 12000, 'unclassified gain');
    near(x.gain, 12000, 'gain');
    assert.equal(x.lt.cmv + x.st.cmv, 0);
    near(x.lt.cmv + x.st.cmv + x.unclassified.cmv, 12000, 'identity');
    assert.ok(x.reason !== null && x.reason.length > 0);
  });

  test('a blank invested value leaves every gain missing, never 0 (KI-007)', () => {
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 100, 10000, 12000)], [flow(BLUE, [2024, 1, 1], 'Purchase', 100, -10000)], AS_ON, [0]);
    const x = one(r, BLUE);
    assert.equal(x.gain, null);
    assert.equal(x.lt.gain, null);
    near(x.lt.cmv, 12000);
    assert.equal(toTaxPosition(x), null);
  });

  test('unmapped and unreconciled holdings keep their whole CMV unclassified, with the live reasons', () => {
    // A balanced advantage fund has no class (the live reason); a fund whose history gives fewer units than the base
    // file is unreconciled 'short'.
    const BAF = 'Sample Balanced Advantage Fund - Regular Plan - Growth';
    const r = run([
      hold(BAF, 'Balanced Advantage Fund', 'Hybrid', 100, 10000, 11000),
      hold(BLUE, 'Large Cap Fund', 'Equity', 200, 20000, 24000),
    ], [flow(BLUE, [2024, 1, 1], 'Purchase', 100, -10000)]);
    const b = one(r, BAF);
    assert.equal(b.status, 'unmapped');
    assert.match(b.reason!, /balanced advantage, dynamic asset allocation/);
    near(b.unclassified.cmv, 11000);
    const u = one(r, BLUE);
    assert.equal(u.unreconciledKind, 'short');
    assert.match(u.reason!, /gives fewer units/);
  });
});

describe('Gate B of aa67a45 (ARC-03): transfer and bonus rows, oversells and zero-amount sales on the holdings side (Q-49)', () => {
  const FOCUSED = 'Sample Focused Fund - Regular Plan - Growth';
  /** The lots, the roll-up and the harvest of a book (slab 30% entered, exemption confirmed unused). */
  function full(book: BookRow[], flows: Cell[][]) {
    const base = parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, book)), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW });
    const irr = parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...flows] }])), { sourceId: 'c'.repeat(64) as SourceFileId, now: NOW });
    const lots = computeTaxLots(base.holdings, irr.fund, { asOn: AS_ON });
    const rollup = rollupHoldings(lots, base.holdings);
    const fy = financialYearOf(AS_ON);
    const ids = rollup.clients.map((c) => c.clientId).filter((c): c is ClientId => c !== null);
    const harvest = buildHarvests(rollup, {
      asOn: AS_ON,
      inputs: {
        personYear: ids.map((clientId) => ({ clientId, fy, slabPct: 30, surchargePct: null, regime: null, assesseeMark: null })),
        exemptionUsed: ids.map((clientId) => ({ clientId, fy, amount: 'unused-confirmed' as const })),
      },
    });
    return { lots, rollup, harvest };
  }

  test('B3, ARC-03 case: a transfer in is not split by the transfer date (old: all 15,500 short term)', () => {
    // Units bought elsewhere in 2019 and transferred in on 1 Jul 2026 at NAV 150 (-15,000 = 100 u). Base 100 u, invested
    // 15,000, CMV 15,500. The old code dated the lot by the transfer: short term 15,500, gain 500, no flag (OD-16 wants a
    // label). Now unreconciled 'transferRow': the whole CMV 15,500 and gain 500 unclassified, long and short 0.
    const r = run([hold(FOCUSED, 'Focused Fund', 'Equity', 100, 15000, 15500)], [flow(FOCUSED, [2026, 7, 1], 'Transfer In', 150, -15000)]);
    const x = one(r, FOCUSED);
    assert.equal(x.status, 'unreconciled');
    assert.equal(x.unreconciledKind, 'transferRow');
    near(x.unclassified.cmv, 15500, 'unclassified cmv'); near(x.unclassified.gain, 500, 'unclassified gain');
    assert.equal(x.lt.cmv + x.st.cmv, 0);
    assert.match(x.reason!, /transfer in, stock in or demerger in\. Its lots would be dated and costed by the transfer/);
    assert.equal(toTaxPosition(x)!.status, 'unreconciled');
  });

  test('B3: stock in and demerger in rows are unreconciled the same way, even when the units reconcile', () => {
    const r = run([
      hold(BLUE, 'Large Cap Fund', 'Equity', 150, 15000, 18000),
      hold(MID, 'Mid Cap Fund', 'Equity', 110, 10200, 13200),
    ], [
      flow(BLUE, [2024, 1, 1], 'Purchase', 100, -10000), flow(BLUE, [2024, 6, 1], 'Stock In', 100, -5000),
      flow(MID, [2024, 1, 1], 'Purchase', 100, -10000), flow(MID, [2025, 3, 1], 'Demerger In', 20, -200),
    ]);
    assert.deepEqual([one(r, BLUE).unreconciledKind, one(r, MID).unreconciledKind], ['transferRow', 'transferRow']);
  });

  test('B3: a transfer-in holding stays out of the harvest; long + short + unclassified = CMV in the roll-up', () => {
    // Focused: transferred in 1 Jul 2026 (100 u at 150), CMV 12,000 against invested 15,000: the old code split it as a
    // short-term loss of 3,000, a harvest candidate that offset Bluechip's short-term gain (100 u bought 1 Feb 2026 at
    // 100, CMV 13,000: gain 3,000): tax before 3,000 x 20% = 600, after 0, saving 600. Now the Focused holding is
    // unreconciled: no candidate, no short-term loss; tax before 600, after 600, saving 0. Family totals: CMV 25,000 =
    // long 0 + short 13,000 + unclassified 12,000.
    const { lots, rollup, harvest } = full([
      hold(FOCUSED, 'Focused Fund', 'Equity', 100, 15000, 12000),
      hold(BLUE, 'Large Cap Fund', 'Equity', 100, 10000, 13000),
    ], [flow(FOCUSED, [2026, 7, 1], 'Transfer In', 150, -15000), flow(BLUE, [2026, 2, 1], 'Purchase', 100, -10000)]);
    assert.equal(one(lots, FOCUSED).unreconciledKind, 'transferRow');
    const t = rollup.family.totals;
    near(t.cmv, 25000, 'cmv');
    near(t.lt.cmv + t.st.cmv + t.unclassified.cmv, t.cmv, 'long + short + unclassified = CMV');
    near(t.st.cmv, 13000, 'short'); near(t.unclassified.cmv, 12000, 'unclassified');
    const h = harvest.clients[0]!;
    assert.deepEqual(h.candidateDetail.map((c) => c.name), []);
    near(h.figures.stLosses, 0, 'no short-term loss');
    near(h.figures.taxBefore, 600, 'tax before'); near(h.figures.taxAfter, 600, 'tax after'); near(h.figures.saving, 0, 'saving');
  });

  test('B2, ARC-03 case: a bonus row with an amount is not split at that cost (old LT 10,454.55 / ST 9,545.45)', () => {
    // Purchase 10 Jan 2024 100 u at 100 (10,000); Bonus 10 Jan 2026 100 u written at 120 (-12,000). Base 200 u, invested
    // 10,000, CMV 30,000. The old code costed the bonus at 12,000 and scaled costs to 10,000: LT gain 10,454.55, ST
    // 9,545.45 (with nil cost it would be 5,000 / 15,000). Now unreconciled 'bonusRow': CMV 30,000 and gain 20,000
    // unclassified, long and short 0; the roll-up identity holds.
    const { lots, rollup } = full([hold(MID, 'Mid Cap Fund', 'Equity', 200, 10000, 30000)], [
      flow(MID, [2024, 1, 10], 'Purchase', 100, -10000), flow(MID, [2026, 1, 10], 'Bonus', 120, -12000),
    ]);
    const x = one(lots, MID);
    assert.equal(x.unreconciledKind, 'bonusRow');
    near(x.unclassified.cmv, 30000, 'unclassified cmv'); near(x.unclassified.gain, 20000, 'unclassified gain');
    assert.equal(x.lt.cmv + x.st.cmv, 0);
    assert.match(x.reason!, /Bonus units have nil cost by law, and how the IRR file writes a bonus row is not confirmed/);
    const t = rollup.family.totals;
    near(t.lt.cmv + t.st.cmv + t.unclassified.cmv, 30000, 'identity');
  });

  test('B2: a bonus row with an amount of 0 is unreconciled bonusRow (old: short)', () => {
    const r = run([hold(MID, 'Mid Cap Fund', 'Equity', 200, 10000, 30000)], [
      flow(MID, [2024, 1, 10], 'Purchase', 100, -10000), flow(MID, [2026, 1, 10], 'Bonus', 120, 0),
    ]);
    assert.equal(one(r, MID).unreconciledKind, 'bonusRow');
  });

  test('item 6: an oversell on the unit ledger is flagged, never clamped silently', () => {
    // Purchase 10 Jan 2024 100 u at 100; Redemption 10 Jun 2024 15,000 at 100 = 150 u (50 u beyond the 100 held);
    // Purchase 10 Jan 2025 100 u at 120. Base 100 u, invested 12,000, CMV 13,000. FIFO leaves the 2025 lot (100 u), which
    // reconciles, so the split stands (long 13,000, gain 1,000), but the record names the oversell: 50 u, and a reason.
    // Within UNITS_TOLERANCE (0.0004 u beyond) there is no flag.
    const r = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 12000, 13000)], [
      flow(FLEXI, [2024, 1, 10], 'Purchase', 100, -10000),
      flow(FLEXI, [2024, 6, 10], 'Redemption', 100, 15000),
      flow(FLEXI, [2025, 1, 10], 'Purchase', 120, -12000),
    ]);
    const x = one(r, FLEXI);
    assert.equal(x.status, 'ok');
    near(x.lt.cmv, 13000, 'long'); near(x.lt.gain, 1000, 'gain');
    near(x.oversoldUnits, 50, 'oversold units');
    assert.match(x.reason!, /sells more units than its earlier purchases hold/);
    const ok = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 12000, 13000)], [
      flow(FLEXI, [2024, 1, 10], 'Purchase', 100, -10000),
      flow(FLEXI, [2024, 6, 10], 'Redemption', 100, 10000.04),
      flow(FLEXI, [2025, 1, 10], 'Purchase', 120, -12000),
    ]);
    assert.equal(one(ok, FLEXI).oversoldUnits, null);
    assert.equal(one(ok, FLEXI).reason, null);
  });

  test('item 7: a sale row with an amount of 0 counts as a sale whose units are not known (noPxSell, its own text)', () => {
    // Purchase 1 Jan 2024 100 u at 100; Redemption 1 Jan 2025 written at 110 for 0. Base 50 u: the history gives more
    // units (100). The old code read 'excess' (an event missing); now 'noPxSell', the reason naming the amount of 0.
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 50, 5000, 6000)], [
      flow(BLUE, [2024, 1, 1], 'Purchase', 100, -10000), flow(BLUE, [2025, 1, 1], 'Redemption', 110, 0),
    ]);
    const x = one(r, BLUE);
    assert.equal(x.unreconciledKind, 'noPxSell');
    assert.match(x.reason!, /carries an amount of 0, so the units it sold could not be counted/);
  });
});

describe('delta review N-2 and N-4: a transfer out named on the record; the oversell tolerance pinned', () => {
  test('N-2, the review case H-XFER-OUT: a transfer out keeps the FIFO split and is named', () => {
    // 100 u bought 10 Jan 2024 at 100 and 100 u bought 10 Jan 2026 at 100; Transfer Out 1 Mar 2026 of 100 u (12,000
    // at 120). FIFO (the usual convention, s.45(2A)) moves the 2024 units: the 2026 lot stays, short on 30 Sep 2026.
    // Base 100 u, invested 10,000, CMV 15,000: short 15,000, gain 5,000 (the same split as fa88c2b), now with
    // transferOutFifo and a reason saying the oldest units are assumed moved. No transfer out: no flag.
    const r = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 10000, 15000)], [
      flow(FLEXI, [2024, 1, 10], 'Purchase', 100, -10000),
      flow(FLEXI, [2026, 1, 10], 'Purchase', 100, -10000),
      flow(FLEXI, [2026, 3, 1], 'Transfer Out', 120, 12000),
    ]);
    const x = one(r, FLEXI);
    assert.equal(x.status, 'ok');
    near(x.st.cmv, 15000, 'short'); near(x.st.gain, 5000, 'gain'); near(x.lt.cmv, 0, 'long');
    assert.equal(x.transferOutFifo, true);
    assert.match(x.reason!, /holds a transfer out; the IRR file does not say which units it moved, so the oldest are assumed \(FIFO/);
    const plain = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 10000, 15000)], [flow(FLEXI, [2026, 1, 10], 'Purchase', 100, -10000)]);
    assert.equal(one(plain, FLEXI).transferOutFifo, false);
    assert.equal(one(plain, FLEXI).reason, null);
  });

  test('N-4: a holdings oversell of 0.0006 u is flagged (beyond UNITS_TOLERANCE)', () => {
    // Purchase 10 Jan 2024 100 u at 100; Redemption 10 Jun 2024 10,000.06 at 100 = 100.0006 u (0.0006 u beyond);
    // Purchase 10 Jan 2025 100 u at 120. The split stands (long 13,000, gain 1,000); oversoldUnits 0.0006 and the reason.
    const r = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 12000, 13000)], [
      flow(FLEXI, [2024, 1, 10], 'Purchase', 100, -10000),
      flow(FLEXI, [2024, 6, 10], 'Redemption', 100, 10000.06),
      flow(FLEXI, [2025, 1, 10], 'Purchase', 120, -12000),
    ]);
    const x = one(r, FLEXI);
    assert.ok(x.oversoldUnits !== null && Math.abs(x.oversoldUnits - 0.0006) < 1e-9, String(x.oversoldUnits));
    assert.match(x.reason!, /sells more units than its earlier purchases hold/);
    near(x.lt.cmv, 13000, 'long');
  });
});

describe('round 2c (Gate B of 5c9ae0a F3, F4; MOD-05\'s merger condition) on the holdings side', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const SMALL = 'Sample Small Cap Fund - Regular Plan - Growth';

  test('F3: on a shared instrument the oversell and its reason are this holding\'s share (OD-15)', () => {
    // IRR (no folio): Purchase 1 Feb 2024 100 u at 100; Redemption 1 Jun 2024 15,000 at 100 = 150 u (50 u beyond);
    // Purchase 1 Feb 2025 400 u at 120 (48,000). Holdings D1 300 u (invested 36,000, CMV 39,000) and D2 100 u (12,000,
    // 13,000): shares 0.75 and 0.25 of the 400 u lot. The oversell is 50 u for the scheme: 37.5 u for D1 and 12.5 u for
    // D2 (5c9ae0a gave 50 to each). Both split, long on 30 Sep 2026: 39,000 at a gain of 3,000; 13,000 at 1,000.
    const r = run([
      hold(MID, 'Mid Cap Fund', 'Equity', 300, 36000, 39000, { dist: D1 }),
      hold(MID, 'Mid Cap Fund', 'Equity', 100, 12000, 13000, { dist: D2 }),
    ], [
      flow(MID, [2024, 2, 1], 'Purchase', 100, -10000, { dist: null }),
      flow(MID, [2024, 6, 1], 'Redemption', 100, 15000, { dist: null }),
      flow(MID, [2025, 2, 1], 'Purchase', 120, -48000, { dist: null }),
    ]);
    const [h1, h2] = recsOf(r, MID);
    assert.ok(h1 && h2);
    near(h1.oversoldUnits, 37.5, 'D1 share'); near(h2.oversoldUnits, 12.5, 'D2 share');
    near(h1.lt.cmv, 39000); near(h1.lt.gain, 3000); near(h2.lt.cmv, 13000); near(h2.lt.gain, 1000);
    assert.match(h1.reason!, /sells more units than its earlier purchases hold \(37\.5 units beyond, this holding's share by units of the scheme's history \(OD-15\)\)/);
    assert.match(h2.reason!, /\(12\.5 units beyond, this holding's share/);
    // Not shared: the whole figure, without the share words (item 6's case: 50 u).
    const own = run([hold(FLEXI, 'Flexi Cap Fund', 'Equity', 100, 12000, 13000)], [
      flow(FLEXI, [2024, 1, 10], 'Purchase', 100, -10000), flow(FLEXI, [2024, 6, 10], 'Redemption', 100, 15000),
      flow(FLEXI, [2025, 1, 10], 'Purchase', 120, -12000),
    ]);
    assert.match(one(own, FLEXI).reason!, /\(50 units beyond\), so a purchase, bonus or split is missing/);
  });

  test('F4: a sale of 0 within the 1% band keeps the split and is named in the reason', () => {
    // Purchase 1 Jan 2024 100 u at 100; Redemption 1 Jan 2025 written at 110 for 0. Base 99.5 u (invested 9,950, CMV
    // 11,940): 0.5% from the history's 100 u, inside the band, so the split stands: long 11,940 at a gain of 1,990
    // (5c9ae0a: the same split with no reason). The reason names the sale of 0.
    const r = run([hold(BLUE, 'Large Cap Fund', 'Equity', 99.5, 9950, 11940)], [
      flow(BLUE, [2024, 1, 1], 'Purchase', 100, -10000), flow(BLUE, [2025, 1, 1], 'Redemption', 110, 0),
    ]);
    const x = one(r, BLUE);
    assert.equal(x.status, 'ok');
    near(x.lt.cmv, 11940, 'long'); near(x.lt.gain, 1990, 'gain');
    assert.equal(x.reason, 'A sale, switch out or transfer out in the transaction history carries an amount of 0, so the units it sold could not be counted; the units still reconcile to the base file within 1%, so the split is shown on them.');
  });

  test('the merger condition: a holding with a merger candidate\'s switch in is not split; an ordinary partial switch is', () => {
    // Contra: Purchase 1 Jul 2019 100 u at 100; Switch Out 10 Nov 2023 15,000 at 150 = all 100 u, Contra's last trade;
    // Small Cap: Switch In 10 Nov 2023 15,000 at 150 (100 u), the only switch in of that amount: a merger candidate.
    // Base Small Cap 100 u, invested 15,000, CMV 18,000. 5c9ae0a split it long 18,000 at a gain of 3,000, dated and
    // costed at the switch; now unreconciled 'mergerCandidate', the 18,000 and 3,000 unclassified. Long + short +
    // unclassified = CMV in the roll-up; no harvest candidate.
    const r = run([hold(SMALL, 'Small Cap Fund', 'Equity', 100, 15000, 18000)], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -10000),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(SMALL, [2023, 11, 10], 'Switch In', 150, -15000),
    ]);
    const x = one(r, SMALL);
    assert.equal(x.status, 'unreconciled');
    assert.equal(x.unreconciledKind, 'mergerCandidate');
    near(x.unclassified.cmv, 18000, 'unclassified'); near(x.unclassified.gain, 3000, 'gain');
    assert.equal(x.lt.cmv + x.st.cmv, 0);
    assert.match(x.reason!, /looks like a scheme merger: on the same day the whole of another scheme was switched out for the same amount\. A merger is not a sale \(s\.47\(xviii\)\)/);
    // The partial switch: 7,500 = 50 of Contra's 100 u (Contra kept), Small Cap 50 u in at 150. Base 50 u, invested
    // 7,500, CMV 9,000: an ordinary switch, split long 9,000 at a gain of 1,500 as before.
    const p = run([hold(SMALL, 'Small Cap Fund', 'Equity', 50, 7500, 9000)], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -10000),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 7500),
      flow(SMALL, [2023, 11, 10], 'Switch In', 150, -7500),
    ]);
    const y = one(p, SMALL);
    assert.equal(y.status, 'ok');
    near(y.lt.cmv, 9000, 'long'); near(y.lt.gain, 1500, 'gain');
  });

  test('financial review V1, V2: the merger in two rows (M1b) and out of a scheme whose units are not known (M2): not split', () => {
    // M1b: Contra in folios F1 (60 u) and F2 (40 u) at 100, switched out 10 Nov 2023 in two rows (9,000 and 6,000 at
    // 150), one Small Cap Switch In of 15,000. Base Small Cap 100 u, invested 15,000, CMV 18,000. 0e860c3 split it long
    // 18,000 on a lot dated at the merger; now unreconciled 'mergerCandidate', 18,000 and 3,000 unclassified.
    const m1b = run([hold(SMALL, 'Small Cap Fund', 'Equity', 100, 15000, 18000)], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -6000, { folio: 'F1' }), flow(OLD, [2019, 7, 1], 'Purchase', 100, -4000, { folio: 'F2' }),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 9000, { folio: 'F1' }), flow(OLD, [2023, 11, 10], 'Switch Out', 150, 6000, { folio: 'F2' }),
      flow(SMALL, [2023, 11, 10], 'Switch In', 150, -15000, { folio: 'F9' }),
    ]);
    const x = one(m1b, SMALL);
    assert.equal(x.unreconciledKind, 'mergerCandidate');
    near(x.unclassified.cmv, 18000, 'unclassified'); near(x.unclassified.gain, 3000, 'gain');
    // M2: Contra 100 u at 100 and 5,000 with no price, switched out whole (22,500 at 150) as its last trade into Small
    // Cap (22,500). Base 150 u, invested 22,500, CMV 27,000: 0e860c3 split it long 27,000; now 'mergerCandidate'.
    const m2 = run([hold(SMALL, 'Small Cap Fund', 'Equity', 150, 22500, 27000)], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(OLD, [2020, 1, 1], 'Purchase', null, -5000),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 22500), flow(SMALL, [2023, 11, 10], 'Switch In', 150, -22500),
    ]);
    const z = one(m2, SMALL);
    assert.equal(z.unreconciledKind, 'mergerCandidate');
    near(z.unclassified.cmv, 27000, 'unclassified');
    // N3: the reason says the file does not say whether it was a merger.
    assert.match(z.reason!, /the IRR file does not say whether it was a merger/);
  });

  test('financial review N1: when the apportionment fails, the oversell reason does not call it this holding\'s share', () => {
    // The F3 case with D2's units blank: the lots cannot be apportioned (OD-15), so D1 is unreconciled 'apportion' with
    // the scheme's whole oversell (50 u); its reason says that, not "this holding's share".
    const r = run([
      hold(MID, 'Mid Cap Fund', 'Equity', 300, 36000, 39000, { dist: D1 }),
      hold(MID, 'Mid Cap Fund', 'Equity', null, 12000, 13000, { dist: D2 }),
    ], [
      flow(MID, [2024, 2, 1], 'Purchase', 100, -10000, { dist: null }),
      flow(MID, [2024, 6, 1], 'Redemption', 100, 15000, { dist: null }),
      flow(MID, [2025, 2, 1], 'Purchase', 120, -48000, { dist: null }),
    ]);
    const d1 = recsOf(r, MID).find((x) => x.baseUnits === 300)!;
    assert.equal(d1.unreconciledKind, 'apportion');
    near(d1.oversoldUnits, 50, 'the whole scheme\'s oversell');
    assert.doesNotMatch(d1.reason!, /this holding's share by units/);
    assert.match(d1.reason!, /\(50 units beyond, for the scheme's whole history: this holding's share is not known \(OD-15\)\)/);
  });

  test('Gate B of 4001f8f, B1: Small Cap switched into by Contra and Value together is not split (one row and two rows)', () => {
    // Contra 100 u at 100 and Value 100 u at 40, switched out whole on 10 Nov 2023 for 15,000 and 5,000; Small Cap in
    // for 20,000 (133.3333 u at 150), as one row and as two. Base Small Cap 133.3333 u, invested 20,000, CMV 24,000.
    // 4001f8f split it long 24,000 at a gain of 4,000 on a lot dated at the merger; now 'mergerCandidate', 24,000 and
    // 4,000 unclassified.
    const VALUE = 'Sample Value Fund - Regular Plan - Growth';
    for (const ins of [[20000], [15000, 5000]]) {
      const r = run([hold(SMALL, 'Small Cap Fund', 'Equity', 20000 / 150, 20000, 24000)], [
        flow(OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(VALUE, [2019, 7, 1], 'Purchase', 40, -4000),
        flow(OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(VALUE, [2023, 11, 10], 'Switch Out', 50, 5000),
        ...ins.map((amt) => flow(SMALL, [2023, 11, 10], 'Switch In', 150, -amt)),
      ]);
      const x = one(r, SMALL);
      assert.equal(x.unreconciledKind, 'mergerCandidate', `${ins.length} rows`);
      near(x.unclassified.cmv, 24000, 'unclassified'); near(x.unclassified.gain, 4000, 'gain');
    }
  });

  test('delta review D1: a switch the priced lots prove partial is not a candidate; the holding switched into stays split', () => {
    // Contra 100 u at 100 and a purchase of 5,000 with no price; 30 u switched out (4,500 at 150) into Small Cap on
    // 10 Nov 2023, Contra's last trade. At least 70 u of Contra stay: an ordinary switch. Base Small Cap 30 u, invested
    // 4,500, CMV 5,400: split long 5,400 at a gain of 900 (4001f8f: unreconciled 'mergerCandidate').
    const r = run([hold(SMALL, 'Small Cap Fund', 'Equity', 30, 4500, 5400)], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(OLD, [2020, 1, 1], 'Purchase', null, -5000),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 4500), flow(SMALL, [2023, 11, 10], 'Switch In', 150, -4500),
    ]);
    const x = one(r, SMALL);
    assert.equal(x.status, 'ok');
    near(x.lt.cmv, 5400, 'long'); near(x.lt.gain, 900, 'gain');
  });

  test('delta review D2: Small Cap held through two distributors whose folios separate the holdings: both not split', () => {
    // Contra in folios FA1 (60 u) and FA2 (40 u) at 100, merged on 10 Nov 2023 into Small Cap through FB1 (9,000, 60 u)
    // and FB2 (6,000, 40 u) at 150. Base: Small Cap FB1 60 u (invested 9,000, CMV 10,800) and FB2 40 u (6,000, 7,200).
    // The folios give each holding its own ledger, each holding one of the two switch-in rows; both are candidate rows,
    // so both holdings are unreconciled 'mergerCandidate' (marking only the first switch-in row left FB2 split long
    // 7,200 on a lot dated at the merger: mutant V1d).
    const r = run([
      hold(SMALL, 'Small Cap Fund', 'Equity', 60, 9000, 10800, { dist: D1, folio: 'FB1' }),
      hold(SMALL, 'Small Cap Fund', 'Equity', 40, 6000, 7200, { dist: D2, folio: 'FB2' }),
    ], [
      flow(OLD, [2019, 7, 1], 'Purchase', 100, -6000, { folio: 'FA1' }), flow(OLD, [2019, 7, 1], 'Purchase', 100, -4000, { folio: 'FA2' }),
      flow(OLD, [2023, 11, 10], 'Switch Out', 150, 9000, { folio: 'FA1' }), flow(OLD, [2023, 11, 10], 'Switch Out', 150, 6000, { folio: 'FA2' }),
      flow(SMALL, [2023, 11, 10], 'Switch In', 150, -9000, { folio: 'FB1' }), flow(SMALL, [2023, 11, 10], 'Switch In', 150, -6000, { folio: 'FB2' }),
    ]);
    const recs = recsOf(r, SMALL);
    assert.equal(recs.length, 2);
    assert.deepEqual(recs.map((x) => [x.unreconciledKind, Math.round(x.unclassified.cmv)]).sort(), [['mergerCandidate', 10800], ['mergerCandidate', 7200]].sort());
  });
});
