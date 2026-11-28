// covers: E-141 E-42 AC-18 OD-2 OD-16 Q-49
// Realised gains derived from the IRR file (app/src/engine/tax/realised-irr.ts, NB-M7a S5): FIFO on the units ledger,
// per client and instrument, with "derived from transactions" as the source. Each case is a synthetic IRR file
// (tests/fixtures/make-irr-files.ts rows) and, for the term, a synthetic base file (make-books.ts bookBytes), read by the
// real readers. The working of each answer is in the comments; no figure is taken from the engine. Money in rupees.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { deriveRealisedGains, DERIVED_SOURCE, UNITS_TOLERANCE } from '../../../app/src/engine/tax/realised-irr.ts';
// Round 2c's window helpers through the namespace, so the file still loads on an older engine (the revert proof).
import * as realisedIrr from '../../../app/src/engine/tax/realised-irr.ts';
import type { DerivedLot, DerivedRealised, DeriveOptions } from '../../../app/src/engine/tax/realised-irr.ts';
import { consumeFifo } from '../../../app/src/engine/tax/lots.ts';
// Round 3 J1's oracle test reads subsetsFitting through the namespace.
import * as lotsMod from '../../../app/src/engine/tax/lots.ts';
import { realisedForYear } from '../../../app/src/engine/tax/reconcile.ts';
import { INST } from '../../../app/src/engine/tax/classify.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { DayNumber, Value } from '../../../app/src/model/value.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { bookBytes } from '../../fixtures/make-books.ts';
import type { BookRow } from '../../fixtures/make-books.ts';
import type { Cell } from '../../fixtures/make-irr-files.ts';
import { SCHEME, flow, irrImport } from '../../fixtures/make-realised-reconcile.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-11-26T00:00:00.000Z';
const day = (y: number, m: number, d: number): DayNumber => ymdToDay(y, m, d)!;
const A = 'Sample Client A';
const B = 'Sample Client B';
/** An en or em dash (built from code points, so this file holds none, D-029). */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

function hold(client: string, name: string, cat: string, units: number, invested: number, mv: number): BookRow {
  return { client, name, cat, asset: 'Equity', folio: '', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: 'Sample Distributor 1', units, invested, mv,
    xirr: 10, bmxirr: 9, days: 300, purchase: [2024, 1, 1] };
}

function run(rows: Cell[][], book: BookRow[] = [], opts: Omit<DeriveOptions, 'holdings'> = {}): DerivedRealised {
  const irr = irrImport(rows, xlsx);
  const holdings = book.length
    ? parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, book)), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW }).holdings : [];
  return deriveRealisedGains(irr.fund, { holdings, ...opts });
}

const v = (x: Value<number> | Value<DayNumber>): number | null => (x.kind === 'value' ? x.v : null);
const near = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 0.01, `${msg}: ${a} != ${b}`);
};
const lotsOf = (r: DerivedRealised, name: string): DerivedLot[] => r.lots.filter((l) => l.instrumentName === name);

describe('consumeFifo (lots.ts, the S4a ledger step exported for S5)', () => {
  test('takes oldest first, in place, and returns each take and the shortfall', () => {
    // Lots 100, 80; need 120: 100 from lot 0, 20 from lot 1 (60 left); nothing short.
    const lots = [{ u: 100 }, { u: 80 }];
    const r = consumeFifo(lots, 120);
    assert.deepEqual(r.takes, [{ index: 0, take: 100 }, { index: 1, take: 20 }]);
    assert.equal(r.short, 0);
    assert.deepEqual(lots.map((l) => l.u), [0, 60]);
    // Need 70 more: 60 from lot 1, 10 short.
    const r2 = consumeFifo(lots, 70);
    assert.deepEqual(r2.takes, [{ index: 1, take: 60 }]);
    assert.ok(Math.abs(r2.short - 10) < 1e-9);
  });
});

describe('FIFO derivations (hand-worked)', () => {
  test('a SIP with two buys and a partial redemption', () => {
    // SIP 10 Jan 2024 100 u at 100 (10,000); SIP 10 Jun 2024 80 u at 125 (10,000). Redemption 15 Mar 2025: 15,840 at
    // 132 = 120 u, oldest first:
    //   lot 1: 100 u, cost 100 x 100 = 10,000, sale 15,840 x 100/120 = 13,200, realised 3,200; anniversary 10 Jan 2025
    //          (12 months, equity MF), 15 Mar 2025 is after it: long;
    //   lot 2:  20 u, cost 20 x 125 = 2,500, sale 15,840 x 20/120 = 2,640, realised 140; anniversary 10 Jun 2025: short.
    // FY 2024-25: realised 3,340; long 3,200, short 140. 60 u stay (the base file's holding).
    const r = run([
      flow(A, SCHEME.BLUE, [2024, 1, 10], 'SIP', 100, -10000),
      flow(A, SCHEME.BLUE, [2024, 6, 10], 'SIP', 125, -10000),
      flow(A, SCHEME.BLUE, [2025, 3, 15], 'Redemption', 132, 15840),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 60, 7500, 8400)]);
    assert.equal(r.source, DERIVED_SOURCE);
    const l = lotsOf(r, SCHEME.BLUE);
    assert.equal(l.length, 2);
    for (const x of l) {
      assert.equal(x.source, 'derived from transactions');
      assert.equal(x.gap, null);
      assert.equal(x.financialYear, 2024);
      assert.equal(x.financialYearLabel, 'FY 2024-25');
      assert.equal(x.saleKind, 'redemption');
      assert.equal(x.i21, INST.equityMf);
      assert.equal(x.notComputed, 'tax-class-not-set');
    }
    near(v(l[0]!.units), 100, 'units 1'); near(v(l[0]!.purchaseValue), 10000, 'cost 1'); near(v(l[0]!.saleValue), 13200, 'sale 1'); near(v(l[0]!.realised), 3200, 'realised 1');
    assert.equal(v(l[0]!.purchaseDate), day(2024, 1, 10));
    assert.deepEqual(l[0]!.term.kind === 'value' ? l[0]!.term.v : null, 'long');
    near(v(l[1]!.units), 20, 'units 2'); near(v(l[1]!.purchaseValue), 2500, 'cost 2'); near(v(l[1]!.saleValue), 2640, 'sale 2'); near(v(l[1]!.realised), 140, 'realised 2');
    assert.deepEqual(l[1]!.term.kind === 'value' ? l[1]!.term.v : null, 'short');
    assert.equal(r.schemeYears.length, 1);
    const sy = r.schemeYears[0]!;
    near(v(sy.realised), 3340, 'scheme-year'); near(sy.lt, 3200, 'lt'); near(sy.st, 140, 'st'); near(sy.unknownTerm, 0, 'unknown');
    assert.equal(sy.gapLots, 0);
    assert.equal(sy.realised.kind === 'value' ? sy.realised.coverage : 'x', undefined);
  });

  test('a switch out is a sale; the term is not known without a joined holding', () => {
    // Purchase 1 Apr 2023 200 u at 50 (10,000); Switch Out 1 Aug 2025 4,000 at 80 = 50 u: cost 50 x 50 = 2,500,
    // realised 1,500, FY 2025-26. No base file: the term is NOT AVAILABLE, the realised gain is in `unknownTerm`.
    const r = run([
      flow(A, SCHEME.FLEXI, [2023, 4, 1], 'Purchase', 50, -10000),
      flow(A, SCHEME.FLEXI, [2025, 8, 1], 'Switch Out', 80, 4000),
    ]);
    const [x] = lotsOf(r, SCHEME.FLEXI);
    assert.equal(x!.saleKind, 'switch-out');
    near(v(x!.realised), 1500, 'realised');
    assert.equal(x!.term.kind, 'missing');
    assert.equal(x!.i21, null);
    const sy = r.schemeYears[0]!;
    assert.equal(sy.fy, 2025);
    near(sy.unknownTerm, 1500, 'unknown term'); near(sy.lt + sy.st, 0, 'no term');
    assert.equal(r.counts.instrumentsTermUnknown, 1);
    assert.ok(r.issues.some((i) => i.ruleId === 'tax.derived-term-unknown' && i.severity === 'Information' && i.count === 1));
  });

  test('a redemption without a price is stated as not computed, and so is every later sale of the scheme', () => {
    // Purchase 1 May 2024 100 u at 100. Redemption 1 Sep 2025 of 5,000 with no price: the units sold are not known, so
    // the lot is a gap 'sale-without-price' (sale value 5,000 kept, units, cost and realised missing). A later
    // redemption (1 Dec 2025, 2,400 at 120 = 20 u) cannot tell which units remain: 'after-earlier-gap'. FY 2025-26:
    // 2 lots, both gaps, realised NOT AVAILABLE (never 0, never a guess).
    const r = run([
      flow(A, SCHEME.MID, [2024, 5, 1], 'Purchase', 100, -10000),
      flow(A, SCHEME.MID, [2025, 9, 1], 'Redemption', null, 5000),
      flow(A, SCHEME.MID, [2025, 12, 1], 'Redemption', 120, 2400),
    ]);
    const l = lotsOf(r, SCHEME.MID);
    assert.deepEqual(l.map((x) => x.gap), ['sale-without-price', 'after-earlier-gap']);
    assert.equal(l[0]!.units.kind, 'missing');
    near(v(l[0]!.saleValue), 5000, 'sale value kept');
    assert.equal(l[0]!.realised.kind, 'missing');
    assert.equal(l[0]!.purchaseValue.kind, 'missing');
    near(v(l[1]!.units), 20, 'units known from the price');
    assert.equal(l[1]!.realised.kind, 'missing');
    const sy = r.schemeYears[0]!;
    assert.equal(sy.gapLots, 2);
    assert.deepEqual(sy.gaps, { 'sale-without-price': 1, 'after-earlier-gap': 1 });
    assert.equal(sy.realised.kind, 'missing');
    assert.equal(sy.realised.kind === 'missing' ? sy.realised.status : '', STATUS.NOT_AVAILABLE);
    assert.equal(r.counts.salesWithoutPrice, 1);
    const w = r.issues.find((i) => i.ruleId === 'tax.derived-gaps');
    assert.ok(w && w.severity === 'Warning' && w.count === 2);
    assert.doesNotMatch(w.message, /\d{4,}|Rs/);
  });

  test('an oversell: the units held are computed, the excess is a gap with its sale value', () => {
    // Purchase 1 Jun 2024 100 u at 20 (2,000). Redemption 1 Jul 2025 3,750 at 25 = 150 u: 100 u from the purchase
    // (cost 2,000, sale 3,750 x 100/150 = 2,500, realised 500), 50 u beyond what the file holds: a gap lot
    // 'units-beyond-held' with 50 u and sale 1,250, cost and realised missing. FY 2025-26: realised 500, PARTIAL
    // COVERAGE (1 of 2 lots not computed: coverage 0.5).
    const r = run([
      flow(A, SCHEME.FOCUSED, [2024, 6, 1], 'Purchase', 20, -2000),
      flow(A, SCHEME.FOCUSED, [2025, 7, 1], 'Redemption', 25, 3750),
    ]);
    const l = lotsOf(r, SCHEME.FOCUSED);
    assert.equal(l.length, 2);
    near(v(l[0]!.realised), 500, 'computed part');
    assert.equal(l[1]!.gap, 'units-beyond-held');
    near(v(l[1]!.units), 50, 'excess units'); near(v(l[1]!.saleValue), 1250, 'excess sale value');
    assert.equal(l[1]!.realised.kind, 'missing');
    const sy = r.schemeYears[0]!;
    assert.equal(sy.realised.kind, 'value');
    near(v(sy.realised), 500, 'partial realised');
    assert.ok(sy.realised.kind === 'value' && sy.realised.coverage === 0.5);
    assert.match(sy.realised.kind === 'value' ? sy.realised.prov.method : '', /PARTIAL/);
  });

  test('an oversell within the units tolerance is rounding, not a gap', () => {
    // Purchase 100 u at 10 (1,000). Redemption of 1,200.0036 at 12 = 100.0003 u: 0.0003 u beyond the 100 held, within
    // UNITS_TOLERANCE (0.0005): one computed lot, the whole sale value on it, realised 200.0036.
    assert.equal(UNITS_TOLERANCE, 0.0005);
    const r = run([
      flow(A, SCHEME.FOCUSED, [2024, 6, 1], 'Purchase', 10, -1000),
      flow(A, SCHEME.FOCUSED, [2025, 7, 1], 'Redemption', 12, 1200.0036),
    ]);
    const l = lotsOf(r, SCHEME.FOCUSED);
    assert.equal(l.length, 1);
    assert.equal(l[0]!.gap, null);
    near(v(l[0]!.saleValue), 1200.0036, 'whole sale value');
    near(v(l[0]!.realised), 200.0036, 'realised');
  });

  test('a sale reaching a purchase without a price is a gap; earlier priced lots are still computed', () => {
    // Purchase 1 Jan 2024 10 u at 100 (1,000); Switch In 1 Jan 2025 of 5,000 with no price (units not known).
    // Redemption 1 Feb 2026 1,800 at 120 = 15 u: 10 u from the priced lot (cost 1,000, sale 1,200, realised 200),
    // then 5 u reach the priceless switch in: a gap 'purchase-without-price' (5 u, sale 600), purchase date known.
    const r = run([
      flow(A, SCHEME.NEW, [2024, 1, 1], 'Purchase', 100, -1000),
      flow(A, SCHEME.NEW, [2025, 1, 1], 'Switch In', null, -5000),
      flow(A, SCHEME.NEW, [2026, 2, 1], 'Redemption', 120, 1800),
    ]);
    const l = lotsOf(r, SCHEME.NEW);
    assert.deepEqual(l.map((x) => x.gap), [null, 'purchase-without-price']);
    near(v(l[0]!.realised), 200, 'priced part');
    near(v(l[1]!.units), 5, 'gap units'); near(v(l[1]!.saleValue), 600, 'gap sale');
    assert.equal(v(l[1]!.purchaseDate), day(2025, 1, 1));
    assert.equal(l[1]!.buyKind, 'switch-in');
    assert.equal(r.counts.purchasesWithoutPrice, 1);
  });

  test('OD-16: untyped, unrecognised and closing rows move no lot and are counted; trades after the as-on date are left out', () => {
    // Purchase 1 Jan 2024 10 u at 100; an untyped row; an unrecognised "Dividend Payout" row; a closing value row; a
    // redemption 1 Feb 2025 of 5 u at 110 (550: cost 500, realised 50); a redemption after the as-on date (1 Oct 2026),
    // left out. One computed lot only.
    const r = run([
      flow(B, SCHEME.BLUE, [2024, 1, 1], 'Purchase', 100, -1000),
      flow(B, SCHEME.BLUE, [2024, 3, 1], null, 100, 100),
      flow(B, SCHEME.BLUE, [2024, 4, 1], 'Dividend Payout', null, 20),
      flow(B, SCHEME.BLUE, [2024, 9, 30], null, null, 1100, { rowType: 'Closing' }),
      flow(B, SCHEME.BLUE, [2025, 2, 1], 'Redemption', 110, 550),
      flow(B, SCHEME.BLUE, [2026, 10, 1], 'Redemption', 120, 600),
    ], [], { asOn: day(2026, 9, 30) });
    assert.equal(r.lots.length, 1);
    near(v(r.lots[0]!.realised), 50, 'realised');
    assert.equal(r.counts.untyped, 1);
    assert.deepEqual(r.counts.unrecognised, [{ label: 'Dividend Payout', rows: 1 }]);
    assert.equal(r.counts.valuation, 1);
    assert.equal(r.counts.later, 1);
    const i = r.issues.find((x) => x.ruleId === 'tax.derived-unused-rows');
    assert.ok(i && i.count === 2 && /Dividend Payout/.test(i.message));
  });

  test('clients are kept apart: one scheme name under two clients is two ledgers', () => {
    // A buys 10 u at 100; B buys 10 u at 50. B sells 10 u at 60 (600): B's own lot, realised 100 (never A's cost).
    const r = run([
      flow(A, SCHEME.BLUE, [2024, 1, 1], 'Purchase', 100, -1000),
      flow(B, SCHEME.BLUE, [2024, 2, 1], 'Purchase', 50, -500),
      flow(B, SCHEME.BLUE, [2025, 2, 1], 'Redemption', 60, 600),
    ]);
    assert.equal(r.lots.length, 1);
    assert.equal(r.lots[0]!.clientLabel, B);
    near(v(r.lots[0]!.realised), 100, 'B realised');
    assert.equal(r.instruments.length, 2);
  });

  test('messages carry no amount, folio or client name; no en or em dash', () => {
    const r = run([
      flow(A, SCHEME.MID, [2024, 5, 1], 'Purchase', 100, -10000, { folio: '91699999' }),
      flow(A, SCHEME.MID, [2025, 9, 1], 'Redemption', null, 5000, { folio: '91699999' }),
      flow(A, SCHEME.MID, [2025, 10, 1], 'Bogus Type', null, 5),
    ]);
    assert.ok(r.issues.length >= 2);
    for (const i of r.issues) {
      assert.doesNotMatch(i.message, /91699999|5,?000|Sample Client/);
      assert.ok(!DASH.test(i.message));
      assert.equal(i.decision, 'E-141');
    }
  });
});

describe('R2 B-1: an oversell breaks the ledger (financial review round 2, R2-F1)', () => {
  test('a later purchase and sale after an oversell are a gap, never computed on a guess', () => {
    // Purchase 1 Jun 2024 100 u at 20 (2,000). Redemption 1 Jul 2025 3,750 at 25 = 150 u: 100 u from the purchase
    // (cost 2,000, sale 3,750 x 100/150 = 2,500, realised 500) and 50 u beyond the purchases in the file (a gap
    // 'units-beyond-held'). The oversell shows purchases missing from the file; under FIFO their remaining units would
    // be sold before the purchase of 1 Aug 2025 (100 u at 30), and how many remain is not known. So the redemption of
    // 1 Dec 2025 (2,000 at 40 = 50 u) is 'after-earlier-gap': cost and realised NOT AVAILABLE (the old code took them
    // from the 1 Aug 2025 lot: 50 x (40 - 30) = 500). FY 2025-26 (both sales): 3 lots, 2 gaps: realised 500 from the
    // one computed lot, PARTIAL COVERAGE 1/3 (not 1,000 at 2/3).
    const r = run([
      flow(A, SCHEME.FOCUSED, [2024, 6, 1], 'Purchase', 20, -2000),
      flow(A, SCHEME.FOCUSED, [2025, 7, 1], 'Redemption', 25, 3750),
      flow(A, SCHEME.FOCUSED, [2025, 8, 1], 'Purchase', 30, -3000),
      flow(A, SCHEME.FOCUSED, [2025, 12, 1], 'Redemption', 40, 2000),
    ]);
    const l = lotsOf(r, SCHEME.FOCUSED);
    assert.deepEqual(l.map((x) => x.gap), [null, 'units-beyond-held', 'after-earlier-gap']);
    near(v(l[0]!.realised), 500, 'computed lot');
    near(v(l[2]!.units), 50, 'units known from the price');
    near(v(l[2]!.saleValue), 2000, 'sale value kept');
    assert.equal(l[2]!.realised.kind, 'missing');
    assert.equal(l[2]!.purchaseValue.kind, 'missing');
    assert.equal(l[2]!.purchaseDate.kind, 'missing');
    assert.equal(r.schemeYears.length, 1);
    const sy = r.schemeYears[0]!;
    assert.equal(sy.fy, 2025);
    assert.equal(sy.lots, 3);
    assert.equal(sy.gapLots, 2);
    assert.deepEqual(sy.gaps, { 'units-beyond-held': 1, 'after-earlier-gap': 1 });
    near(v(sy.realised), 500, 'FY 2025-26');
    assert.ok(sy.realised.kind === 'value' && Math.abs(sy.realised.coverage! - 1 / 3) < 1e-9, 'coverage 1/3');
  });

  test('when the later sale falls in a later financial year, that year is not shown complete', () => {
    // The same file with the last redemption on 1 May 2026 (Tax year 2026-27): that year's only lot is a gap, so its
    // realised figure is NOT AVAILABLE, never 500 shown as complete.
    const r = run([
      flow(A, SCHEME.FOCUSED, [2024, 6, 1], 'Purchase', 20, -2000),
      flow(A, SCHEME.FOCUSED, [2025, 7, 1], 'Redemption', 25, 3750),
      flow(A, SCHEME.FOCUSED, [2025, 8, 1], 'Purchase', 30, -3000),
      flow(A, SCHEME.FOCUSED, [2026, 5, 1], 'Redemption', 40, 2000),
    ]);
    const later = r.schemeYears.find((s) => s.fy === 2026)!;
    assert.equal(later.gapLots, 1);
    assert.equal(later.realised.kind, 'missing');
  });
});

describe('R2 B-2: a derived lot takes the law at its sale date (table v1), not today\'s I-21 periods', () => {
  const holdAt = (name: string, cat: string, o: Partial<BookRow> = {}): BookRow => ({ ...hold(A, name, cat, 500, 5000, 6000), ...o });
  const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';
  const GOLD = 'Sample Gold Exchange Traded Fund';
  const SHARE = 'Sample Industries Limited';
  const termOf = (x: DerivedLot): string | null => (x.term.kind === 'value' ? x.term.v : null);

  test('R2-F2: a debt fund bought 1 Jan 2021 and sold 1 Jun 2023 is short term (36 months then)', () => {
    // Purchase 1 Jan 2021 10,000 at 10 = 1,000 u; Redemption 1 Jun 2023 6,000 at 12 = 500 u: cost 5,000, realised
    // 1,000, FY 2023-24. Class: Debt MF (I-21), table v1 fund type debt-funds: Specified, bought before 1 Apr 2023, so
    // the NE rows for the sale date: a sale from 2014-07-11 to 2024-07-22 is long only strictly after 36 months
    // (anniversary 1 Jan 2024). Held 29 months: SHORT, row NE-ST-2. (Today's I-21 row, 24 months, said long.)
    const r = run([
      flow(A, BOND, [2021, 1, 1], 'Purchase', 10, -10000),
      flow(A, BOND, [2023, 6, 1], 'Redemption', 12, 6000),
    ], [holdAt(BOND, 'Corporate Bond Fund', { asset: 'Debt' })]);
    const [x] = lotsOf(r, BOND);
    near(v(x!.realised), 1000, 'realised');
    assert.equal(x!.financialYearLabel, 'FY 2023-24');
    assert.equal(x!.i21, INST.debtMf);
    assert.equal(termOf(x!), 'short');
    assert.equal(x!.termRule, 'NE-ST-2');
    const sy = r.schemeYears[0]!;
    near(sy.st, 1000, 'short'); near(sy.lt, 0, 'long'); near(sy.unknownTerm, 0, 'unknown');
  });

  test('R2-F3: a gold ETF bought 1 Jan 2022 and sold 1 Sep 2023 is short term (36 months then)', () => {
    // Purchase 1 Jan 2022 10,000 at 500 = 20 u; Redemption 1 Sep 2023 6,000 at 600 = 10 u: cost 5,000, realised 1,000.
    // Class: Commodity ETF (I-21), table v1 fund type gold-silver-etf: bought before 1 Apr 2023, so other non-equity
    // (the Specified window needs units bought from 1 Apr 2023); sale before 2024-07-23: 36 months (anniversary 1 Jan
    // 2025). Held 20 months: SHORT, NE-ST-2. (Today's I-21 row, 12 months for a listed ETF, said long.)
    const r = run([
      flow(A, GOLD, [2022, 1, 1], 'Purchase', 500, -10000),
      flow(A, GOLD, [2023, 9, 1], 'Redemption', 600, 6000),
    ], [holdAt(GOLD, 'Gold ETF', { asset: 'Commodity', product: 'ETF' })]);
    const [x] = lotsOf(r, GOLD);
    near(v(x!.realised), 1000, 'realised');
    assert.equal(x!.i21, INST.commodityEtf);
    assert.equal(termOf(x!), 'short');
    assert.equal(x!.termRule, 'NE-ST-2');
  });

  test('a gold ETF bought from 1 Apr 2023 and sold before 1 Apr 2025 was Specified: deemed short term', () => {
    // Purchase 1 Jun 2023 10,000 at 500 = 20 u; Redemption 1 Mar 2025 6,000 at 600 = 10 u (realised 1,000, held 21
    // months). Table v1 gold-silver-etf: units bought from 2023-04-01 and sold from 2023-04-01 to 2025-03-31 are
    // Specified (the 35% test), deemed short term whatever the holding (NE-50AA-1). Today's I-21 row (12 months) would
    // say long; table v1's other non-equity row for a listed unit after 2024-07-23 would too.
    const r = run([
      flow(A, GOLD, [2023, 6, 1], 'Purchase', 500, -10000),
      flow(A, GOLD, [2025, 3, 1], 'Redemption', 600, 6000),
    ], [holdAt(GOLD, 'Gold ETF', { asset: 'Commodity', product: 'ETF' })]);
    const [x] = lotsOf(r, GOLD);
    assert.equal(termOf(x!), 'short');
    assert.equal(x!.termRule, 'NE-50AA-1');
  });

  test('an equity fund keeps the 12-month rule: short on the anniversary, long the day after', () => {
    // Purchase 1 Feb 2023 10,000 at 100 = 100 u. Redemption 1 Feb 2024 6,000 at 120 = 50 u (cost 5,000, realised
    // 1,000): on the 12-month anniversary, so short (EQ-ST-2). Redemption 2 Feb 2024 6,000 at 120 = 50 u (realised
    // 1,000): strictly after it, long (EQ-LT-3, bought from 2018-02-01). Equity-oriented rows are 12 months in every
    // window, as I-21 says.
    const r = run([
      flow(A, SCHEME.BLUE, [2023, 2, 1], 'Purchase', 100, -10000),
      flow(A, SCHEME.BLUE, [2024, 2, 1], 'Redemption', 120, 6000),
      flow(A, SCHEME.BLUE, [2024, 2, 2], 'Redemption', 120, 6000),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 10, 1000, 1200)]);
    const l = lotsOf(r, SCHEME.BLUE);
    assert.deepEqual(l.map(termOf), ['short', 'long']);
    assert.deepEqual(l.map((x) => x.termRule), ['EQ-ST-2', 'EQ-LT-3']);
    const sy = r.schemeYears[0]!;
    near(sy.st, 1000, 'short'); near(sy.lt, 1000, 'long');
  });

  test('a class table v1 does not cover (a share held directly) has its term NOT KNOWN, counted in unknownTerm', () => {
    // Buy 1 Nov 2023 40,000 at 1,000 = 40 shares; Sell 1 Dec 2024 12,000 at 1,200 = 10 shares: cost 10,000, realised
    // 2,000. I-21 class Listed Equity Shares: not a mutual-fund unit, outside table v1, so the term is NOT AVAILABLE
    // (never a guess), the 2,000 in unknownTerm, and the scheme is counted with an Information result.
    const r = run([
      flow(A, SHARE, [2023, 11, 1], 'Buy', 1000, -40000),
      flow(A, SHARE, [2024, 12, 1], 'Sell', 1200, 12000),
    ], [holdAt(SHARE, 'Direct Equity', { product: 'Equity', amc: '' })]);
    const [x] = lotsOf(r, SHARE);
    assert.equal(x!.i21, INST.listedShares);
    near(v(x!.realised), 2000, 'realised');
    assert.equal(x!.term.kind, 'missing');
    assert.match(x!.term.kind === 'missing' ? x!.term.reason : '', /table v1 covers mutual-fund units only/);
    assert.equal(x!.termRule, null);
    const sy = r.schemeYears[0]!;
    near(sy.unknownTerm, 2000, 'unknown term'); near(sy.lt + sy.st, 0, 'no term');
    assert.equal(r.counts.instrumentsOutsideTable, 1);
    assert.equal(r.counts.instrumentsTermUnknown, 0);
    const i = r.issues.find((y) => y.ruleId === 'tax.derived-term-outside-table');
    assert.ok(i && i.severity === 'Information' && i.count === 1);
    assert.ok(!DASH.test(i.message));
  });
});

describe('Gate B of aa67a45 (ARC-03): transfer, bonus and zero-amount rows are named gaps, never figures (Q-49)', () => {
  const termOf = (x: DerivedLot): string | null => (x.term.kind === 'value' ? x.term.v : null);
  const gapsOf = (r: DerivedRealised, name: string): Array<string | null> => lotsOf(r, name).map((x) => x.gap);

  test('B1, ARC-03 case: a transfer out is not a sale (bought 2019, transferred out 2025: no realised 3,000)', () => {
    // Purchase 1 Apr 2019 5,000 at 50 = 100 u; Transfer Out 1 May 2025 8,000 at 80 = 100 u. The old code sold the 100 u:
    // sale 8,000 less cost 5,000 = a derived realised gain of 3,000, long term. A change of folio or account, or a gift
    // (s.47(iii)), is not a sale, and what carries over is not known: one lot, gap 'transfer-row', cost, sale value and
    // realised missing; FY 2025-26 realised NOT AVAILABLE; the review's derived figure for the year is not 3,000.
    const r = run([
      flow(A, SCHEME.BLUE, [2019, 4, 1], 'Purchase', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 5, 1], 'Transfer Out', 80, 8000),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 1, 50, 60)]);
    const l = lotsOf(r, SCHEME.BLUE);
    assert.equal(l.length, 1);
    assert.equal(l[0]!.gap, 'transfer-row');
    assert.equal(l[0]!.saleKind, 'transfer-out');
    assert.equal(l[0]!.realised.kind, 'missing');
    assert.equal(l[0]!.purchaseValue.kind, 'missing');
    assert.equal(l[0]!.saleValue.kind, 'missing');
    assert.equal(l[0]!.term.kind, 'missing');
    near(v(l[0]!.units), 100, 'units known from the price');
    const sy = r.schemeYears[0]!;
    assert.equal(sy.fyLabel, 'FY 2025-26');
    assert.deepEqual(sy.gaps, { 'transfer-row': 1 });
    assert.equal(sy.realised.kind, 'missing');
    const fy = realisedForYear(2025, r, null);
    assert.equal(fy.total.kind, 'missing');
    assert.equal(fy.lt.kind, 'missing');
    const w = r.issues.find((i) => i.ruleId === 'tax.derived-gaps')!;
    assert.match(w.message, /a transfer out of a folio or account, or a gift, is not a sale/);
    assert.ok(!DASH.test(w.message));
  });

  test('B1: a transfer out breaks the ledger: a later sale is a gap', () => {
    // Purchase 1 Apr 2023 200 u at 50; Transfer Out 1 Jun 2024 of 100 u at 60 (6,000); Redemption 1 Jun 2025 3,500 at
    // 70 = 50 u. Which units the transfer moved is not known, so the redemption is 'after-earlier-gap'.
    const r = run([
      flow(A, SCHEME.FLEXI, [2023, 4, 1], 'Purchase', 50, -10000),
      flow(A, SCHEME.FLEXI, [2024, 6, 1], 'Transfer Out', 60, 6000),
      flow(A, SCHEME.FLEXI, [2025, 6, 1], 'Redemption', 70, 3500),
    ]);
    assert.deepEqual(gapsOf(r, SCHEME.FLEXI), ['transfer-row', 'after-earlier-gap']);
    assert.ok(lotsOf(r, SCHEME.FLEXI).every((x) => x.realised.kind === 'missing'));
  });

  test('B1, N-1: every sale after a transfer in is a gap, whole, even one the earlier purchase could meet', () => {
    // Purchase 1 Apr 2023 50 u at 100 (5,000); Transfer In 1 Jun 2024 12,000 at 120 = 100 u (dated and valued by the
    // transfer: the transferred units' original acquisition date is not known, so neither is the FIFO order).
    // Redemption 1 Aug 2025 13,500 at 150 = 90 u, and 1 Sep 2025 1,500 at 150 = 10 u: both 'transfer-row', units and
    // sale value kept, cost and realised missing (fa88c2b computed 50 u of the purchase: realised 2,500, long). FY
    // 2025-26 realised NOT AVAILABLE.
    const r = run([
      flow(A, SCHEME.MID, [2023, 4, 1], 'Purchase', 100, -5000),
      flow(A, SCHEME.MID, [2024, 6, 1], 'Transfer In', 120, -12000),
      flow(A, SCHEME.MID, [2025, 8, 1], 'Redemption', 150, 13500),
      flow(A, SCHEME.MID, [2025, 9, 1], 'Redemption', 150, 1500),
    ], [hold(A, SCHEME.MID, 'Mid Cap Fund', 50, 5000, 7500)]);
    const l = lotsOf(r, SCHEME.MID);
    assert.deepEqual(l.map((x) => x.gap), ['transfer-row', 'transfer-row']);
    near(v(l[0]!.units), 90, 'units'); near(v(l[0]!.saleValue), 13500, 'sale value');
    assert.ok(l.every((x) => x.realised.kind === 'missing' && x.purchaseDate.kind === 'missing' && x.purchaseValue.kind === 'missing'));
    assert.equal(r.schemeYears[0]!.realised.kind, 'missing');
  });

  test('N-1, the review case R-XFER-IN-BEFORE-SALE: a sale after a transfer in is not LT 1,500', () => {
    // Purchase 1 Apr 2023 50 u at 100 (5,000); Transfer In 1 Jun 2024 100 u at 120 (12,000); Redemption 1 Sep 2024
    // 6,500 at 130 = 50 u. fa88c2b met it from the purchase: 50 x (130 - 100) = 1,500, long. If the transferred units
    // were bought earlier, FIFO sells them first: the figure is not known. Now 'transfer-row'.
    const r = run([
      flow(A, SCHEME.MID, [2023, 4, 1], 'Purchase', 100, -5000),
      flow(A, SCHEME.MID, [2024, 6, 1], 'Transfer In', 120, -12000),
      flow(A, SCHEME.MID, [2024, 9, 1], 'Redemption', 130, 6500),
    ], [hold(A, SCHEME.MID, 'Mid Cap Fund', 100, 12000, 13000)]);
    assert.deepEqual(gapsOf(r, SCHEME.MID), ['transfer-row']);
    assert.equal(r.schemeYears[0]!.realised.kind, 'missing');
  });

  test('B1, N-1: stock in and demerger in are lots not known too; sales before them stay computed, sales after are gaps', () => {
    // Focused (B): Purchase 1 Jan 2024 100 u at 100; Redemption 15 Jan 2024 2,200 at 110 = 20 u (before the stock in:
    // cost 2,000, realised 200, computed); Stock In 1 Feb 2024 50 u at 110; Redemption 1 Jun 2025 7,200 at 120 = 60 u:
    // 'transfer-row' (fa88c2b computed it from the purchase, realised 1,200). Value (B): Purchase 1 Jan 2024 100 u at
    // 100; Demerger In 1 Mar 2024 20 u at 10; Redemption 1 Jun 2025 1,200 at 120 = 10 u: 'transfer-row'.
    const r = run([
      flow(B, SCHEME.FOCUSED, [2024, 1, 1], 'Purchase', 100, -10000),
      flow(B, SCHEME.FOCUSED, [2024, 1, 15], 'Redemption', 110, 2200),
      flow(B, SCHEME.FOCUSED, [2024, 2, 1], 'Stock In', 110, -5500),
      flow(B, SCHEME.FOCUSED, [2025, 6, 1], 'Redemption', 120, 7200),
      flow(B, SCHEME.VALUE, [2024, 1, 1], 'Purchase', 100, -10000),
      flow(B, SCHEME.VALUE, [2024, 3, 1], 'Demerger In', 10, -200),
      flow(B, SCHEME.VALUE, [2025, 6, 1], 'Redemption', 120, 1200),
    ]);
    const l = lotsOf(r, SCHEME.FOCUSED);
    assert.deepEqual(l.map((x) => x.gap), [null, 'transfer-row']);
    near(v(l[0]!.realised), 200, 'sale before the stock in');
    near(v(l[1]!.units), 60, 'gap units');
    assert.deepEqual(gapsOf(r, SCHEME.VALUE), ['transfer-row']);
  });

  test('B2, ARC-03 case: a bonus row with an amount is never costed at it (old total 0; the bonus part is a gap)', () => {
    // Purchase 1 Apr 2024 5,000 at 50 = 100 u; Bonus 1 Jun 2025 100 u written at 40 (-4,000); Redemption 1 Sep 2025
    // 9,000 at 45 = 200 u. The old code costed the bonus at 4,000: LT -500 (100 u: 4,500 less 5,000) and ST +500 (100 u:
    // 4,500 less 4,000), total 0. By law bonus units have nil cost (the design's rule table): LT -500, ST +4,500, total
    // 4,000; how the export writes the row is not confirmed, so the bonus part is a gap 'bonus-row' (100 u, sale
    // 4,500), never +500. FY 2025-26: realised -500 from the computed lot, PARTIAL (coverage 0.5).
    const r = run([
      flow(A, SCHEME.BLUE, [2024, 4, 1], 'Purchase', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 6, 1], 'Bonus', 40, -4000),
      flow(A, SCHEME.BLUE, [2025, 9, 1], 'Redemption', 45, 9000),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 1, 50, 60)]);
    const l = lotsOf(r, SCHEME.BLUE);
    assert.deepEqual(l.map((x) => x.gap), [null, 'bonus-row']);
    near(v(l[0]!.realised), -500, 'purchase lot'); assert.equal(termOf(l[0]!), 'long');
    near(v(l[1]!.units), 100, 'bonus units'); near(v(l[1]!.saleValue), 4500, 'bonus sale value');
    assert.equal(l[1]!.buyKind, 'bonus');
    assert.equal(l[1]!.purchaseValue.kind, 'missing');
    assert.equal(l[1]!.realised.kind, 'missing');
    const sy = r.schemeYears[0]!;
    near(v(sy.realised), -500, 'realised'); near(sy.st, 0, 'no short-term figure from the bonus'); near(sy.lt, -500, 'long');
    assert.ok(sy.realised.kind === 'value' && sy.realised.coverage === 0.5);
    assert.deepEqual(sy.gaps, { 'bonus-row': 1 });
    assert.match(r.issues.find((i) => i.ruleId === 'tax.derived-gaps')!.message, /bonus units have nil cost by law/);
  });

  test('B2: a bonus row with an amount of 0 is the same gap (not units beyond those held)', () => {
    // The same file with the bonus written at 40 for 0: the bonus lot's units are not known. The sale of 200 u takes
    // 100 u of the purchase (realised -500) and reaches the bonus lot: 'bonus-row' (100 u, sale 4,500).
    const r = run([
      flow(A, SCHEME.BLUE, [2024, 4, 1], 'Purchase', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 6, 1], 'Bonus', 40, 0),
      flow(A, SCHEME.BLUE, [2025, 9, 1], 'Redemption', 45, 9000),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 1, 50, 60)]);
    const l = lotsOf(r, SCHEME.BLUE);
    assert.deepEqual(l.map((x) => x.gap), [null, 'bonus-row']);
    near(v(l[0]!.realised), -500, 'purchase lot');
    near(v(l[1]!.units), 100, 'units beyond the purchase');
  });

  test('item 7: a sale row with an amount of 0 is a gap sale-without-amount and breaks the ledger', () => {
    // Purchase 1 Jan 2024 100 u at 100; Redemption 1 Jan 2025 written at 110 for 0 (units sold not known); Redemption
    // 1 Jun 2025 6,000 at 120 = 50 u. The old code moved no units and computed the second sale from the purchase
    // (realised 1,000) with no flag. Now: 'sale-without-amount', then 'after-earlier-gap'; FY 2024-25 and 2025-26 NOT
    // AVAILABLE.
    const r = run([
      flow(A, SCHEME.VALUE, [2024, 1, 1], 'Purchase', 100, -10000),
      flow(A, SCHEME.VALUE, [2025, 1, 1], 'Redemption', 110, 0),
      flow(A, SCHEME.VALUE, [2025, 6, 1], 'Redemption', 120, 6000),
    ]);
    const l = lotsOf(r, SCHEME.VALUE);
    assert.deepEqual(l.map((x) => x.gap), ['sale-without-amount', 'after-earlier-gap']);
    assert.equal(l[0]!.units.kind, 'missing');
    assert.equal(l[0]!.saleValue.kind, 'missing');
    assert.ok(l.every((x) => x.realised.kind === 'missing'));
    assert.ok(r.schemeYears.every((s) => s.realised.kind === 'missing'));
    assert.match(r.issues.find((i) => i.ruleId === 'tax.derived-gaps')!.message, /a sale row with an amount of 0/);
  });

  test('B4: the units tolerance is pinned: an oversell of 0.0004 u is absorbed, 0.0006 u is a gap', () => {
    // Purchase 1 Apr 2024 5,000 at 50 = 100 u. Redemption 1 Jun 2025 at 60 of 6,000.024 = 100.0004 u: 0.0004 u beyond,
    // within UNITS_TOLERANCE (0.0005): one computed lot with the whole sale value, realised 1,000.024. Of 6,000.036 =
    // 100.0006 u: 0.0006 u beyond, a gap 'units-beyond-held' (0.0006 u, sale 0.036); the 100 u lot takes 6,000 (sale
    // shared over the units sold), realised 1,000.
    assert.equal(UNITS_TOLERANCE, 0.0005);
    const inside = run([
      flow(A, SCHEME.BLUE, [2024, 4, 1], 'Purchase', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 6, 1], 'Redemption', 60, 6000.024),
    ]);
    const li = lotsOf(inside, SCHEME.BLUE);
    assert.deepEqual(li.map((x) => x.gap), [null]);
    near(v(li[0]!.saleValue), 6000.024, 'whole sale'); near(v(li[0]!.realised), 1000.024, 'realised');
    const outside = run([
      flow(A, SCHEME.BLUE, [2024, 4, 1], 'Purchase', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 6, 1], 'Redemption', 60, 6000.036),
    ]);
    const lo = lotsOf(outside, SCHEME.BLUE);
    assert.deepEqual(lo.map((x) => x.gap), [null, 'units-beyond-held']);
    assert.ok(Math.abs(v(lo[1]!.units)! - 0.0006) < 1e-9, 'gap units');
    near(v(lo[0]!.realised), 1000, 'computed part');
    assert.ok(outside.schemeYears[0]!.realised.kind === 'value' && outside.schemeYears[0]!.realised.coverage === 0.5);
  });
});

describe('delta review N-3: TR-21 bonus-stripping candidates on derived lots (design section 10.4)', () => {
  const termOf = (x: DerivedLot): string | null => (x.term.kind === 'value' ? x.term.v : null);
  test('R-TR21: a short-held loss of a scheme with a bonus row is computed and flagged stripping-candidate (Warning)', () => {
    // Purchase 1 Apr 2025 100 u at 100 (10,000); Bonus 1 Jun 2025 100 u written at 50; Redemption 1 Sep 2025 9,500 at
    // 95 = 100 u, all from the purchase (cost 10,000): realised -500, held 5 months, short; the bonus units are still
    // held. Without record-date data the loss is computed normally and flagged, as the statement side does
    // (realised.ts finish). A gain, and a loss held more than 12 months, are not flagged.
    const r = run([
      flow(A, SCHEME.BLUE, [2025, 4, 1], 'Purchase', 100, -10000),
      flow(A, SCHEME.BLUE, [2025, 6, 1], 'Bonus', 50, -5000),
      flow(A, SCHEME.BLUE, [2025, 9, 1], 'Redemption', 95, 9500),
      flow(A, SCHEME.FLEXI, [2024, 1, 1], 'Purchase', 100, -10000),
      flow(A, SCHEME.FLEXI, [2024, 3, 1], 'Bonus', 50, 0),
      flow(A, SCHEME.FLEXI, [2025, 6, 1], 'Redemption', 90, 4500),
      flow(A, SCHEME.FLEXI, [2025, 7, 1], 'Redemption', 120, 1200),
    ], [hold(A, SCHEME.BLUE, 'Large Cap Fund', 100, 1, 1)]);
    const [x] = lotsOf(r, SCHEME.BLUE);
    assert.equal(x!.gap, null);
    near(v(x!.realised), -500, 'computed normally');
    assert.equal(termOf(x!), 'short');
    assert.deepEqual(x!.flags, ['stripping-candidate']);
    // Flexi Cap: 50 u sold at a loss after 17 months (-500) and 10 u at a gain (+200): neither flagged.
    const f = lotsOf(r, SCHEME.FLEXI);
    assert.deepEqual(f.map((y) => v(y.realised)), [-500, 200]);
    assert.ok(f.every((y) => !y.flags.includes('stripping-candidate')));
    const w = r.issues.find((i) => i.ruleId === 'tax.stripping-candidate')!;
    assert.ok(w && w.severity === 'Warning' && w.count === 1);
    assert.match(w.message, /may fall under bonus stripping; without record-date data it is computed normally/);
    assert.ok(!DASH.test(w.message));
  });
});

describe('round 2c, F2 (Gate B of 5c9ae0a): the TR-21 flag only inside the s.94(8) window around the bonus row', () => {
  // Each instrument: a Purchase of 100 u at 100 (10,000), a Bonus row of 50 u written at 90 (-4,500) on b, and a
  // Redemption of 100 u from the purchase (FIFO: the purchase lot comes first). A loss sells at 90 (9,000: -1,000), a
  // gain at 110 (+1,000), nil at 100 (0). The window: b minus 3 months <= purchase <= b < sale <= b plus 9 months,
  // calendar months clamped to the month end; b = 31 May 2025: from 28 Feb 2025, to 28 Feb 2026.
  type Ymd = readonly [number, number, number];
  type Case = { name: string; buy: Ymd; sale: Ymd; px?: number; bonus?: Ymd | null; flag: boolean; why: string };
  const B31: Ymd = [2025, 5, 31];
  const cases: Case[] = [
    { name: 'W1', buy: [2025, 2, 28], sale: [2025, 9, 1], flag: true, why: 'bought on b minus 3 months (28 Feb, clamped)' },
    { name: 'W2', buy: [2025, 2, 27], sale: [2025, 9, 1], flag: false, why: 'bought a day before the window' },
    { name: 'W3', buy: [2025, 5, 31], sale: [2025, 9, 1], flag: true, why: 'bought on b' },
    { name: 'W4', buy: [2025, 4, 1], sale: [2025, 5, 31], flag: false, why: 'sold on b, not after it' },
    { name: 'W5', buy: [2025, 4, 1], sale: [2026, 2, 28], flag: true, why: 'sold on b plus 9 months (28 Feb 2026, clamped)' },
    { name: 'W6', buy: [2025, 4, 1], sale: [2026, 3, 1], flag: false, why: 'sold a day after the window' },
    // A purchase after b cannot give a computed loss here: FIFO reaches the earlier bonus lot first, a 'bonus-row' gap
    // (B2), which breaks the ledger. The bound purchase <= b is pinned by W3 and on the window itself (next test).
    { name: 'G', buy: [2025, 4, 1], sale: [2025, 9, 1], px: 110, flag: false, why: 'a gain inside the window (D-1)' },
    { name: 'Z', buy: [2025, 4, 1], sale: [2025, 9, 1], px: 100, flag: false, why: 'a realised gain of 0 is not a loss (M14)' },
    { name: 'N', buy: [2025, 4, 1], sale: [2025, 9, 1], bonus: null, flag: false, why: 'no bonus row (M12)' },
    // CHAT-012's F2 case: a bonus after the sale (buy 1 Jan 2025, loss sale 1 Mar 2025, bonus 1 Jun 2025).
    { name: 'AFTER', buy: [2025, 1, 1], sale: [2025, 3, 1], bonus: [2025, 6, 1], flag: false, why: 'the bonus comes after the sale' },
  ];
  const nameOf = (c: Case): string => `Sample Window ${c.name} Fund - Growth`;
  const r = run(cases.flatMap((c) => {
    const bonus = c.bonus === undefined ? B31 : c.bonus;
    const px = c.px ?? 90;
    return [
      flow(A, nameOf(c), c.buy, 'Purchase', 100, -10000),
      ...(bonus ? [flow(A, nameOf(c), bonus, 'Bonus', 90, -4500)] : []),
      flow(A, nameOf(c), c.sale, 'Redemption', px, px * 100),
    ];
  }));

  for (const c of cases) {
    test(`${c.name}: ${c.flag ? 'flagged' : 'not flagged'}, ${c.why}`, () => {
      const l = lotsOf(r, nameOf(c));
      assert.equal(l.length, 1);
      assert.equal(l[0]!.gap, null);
      near(v(l[0]!.realised), ((c.px ?? 90) - 100) * 100, 'computed normally');
      assert.equal(l[0]!.flags.includes('stripping-candidate'), c.flag);
    });
  }

  test('the window itself: month ends clamped both ways; a purchase after b, or a bonus years before it, is outside', () => {
    // b = 31 May 2025: 3 months before is 28 Feb 2025 (no 31 Feb), 9 months after 28 Feb 2026. b = 31 Aug 2024: 3 months
    // before is 31 May 2024; 9 months after 31 May 2025. Leap year: b = 31 May 2024: 29 Feb 2024 and 28 Feb 2025.
    const { monthsBefore, inStrippingWindow, STRIPPING_MONTHS_BEFORE, STRIPPING_MONTHS_AFTER } = realisedIrr;
    assert.equal(monthsBefore(day(2025, 5, 31), 3), day(2025, 2, 28));
    assert.equal(monthsBefore(day(2024, 8, 31), 3), day(2024, 5, 31));
    assert.equal(monthsBefore(day(2024, 5, 31), 3), day(2024, 2, 29));
    assert.equal(monthsBefore(day(2025, 2, 15), 3), day(2024, 11, 15));
    const b = day(2025, 5, 31);
    assert.equal(inStrippingWindow(day(2025, 2, 28), b, day(2026, 2, 28)), true);
    assert.equal(inStrippingWindow(day(2025, 6, 1), b, day(2025, 9, 1)), false, 'bought after b');
    assert.equal(inStrippingWindow(day(2025, 1, 1), day(2023, 6, 1), day(2025, 3, 1)), false, 'bonus years before the purchase');
    assert.equal(inStrippingWindow(day(2025, 1, 1), day(2025, 6, 1), day(2025, 3, 1)), false, 'bonus after the sale');
    assert.equal(STRIPPING_MONTHS_BEFORE, 3);
    assert.equal(STRIPPING_MONTHS_AFTER, 9);
  });

  test('the Warning counts the flagged lots and says the bonus row\'s date stands for the record date', () => {
    const w = r.issues.find((i) => i.ruleId === 'tax.stripping-candidate')!;
    assert.equal(w.count, cases.filter((c) => c.flag).length);
    assert.match(w.message, /^3 losses derived from the IRR file, on units bought within 3 months before a bonus row and sold within 9 months after it \(s\.94\(8\)\), may fall under bonus stripping; without record-date data they are computed normally, and the bonus row's date stands for the record date\.$/);
    assert.ok(!DASH.test(w.message));
  });
});

describe('round 2c, the merger condition (MOD-05): merger candidates on the realised side', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const NEW = 'Sample Small Cap Fund - Regular Plan - Growth';
  const THIRD = 'Sample Focused Fund - Regular Plan - Growth';
  /** A: OLD bought 1 Jul 2019 100 u at 100; on 10 Nov 2023 a Switch Out of OLD and Switch Ins as given. */
  const pair = (out: number, ins: Array<[string, number]>, extra: Cell[][] = []): DerivedRealised => run([
    flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000),
    flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, out),
    ...ins.map(([name, amt]) => flow(A, name, [2023, 11, 10], 'Switch In', 150, -amt)),
    ...extra,
  ]);
  const oldGap = (r: DerivedRealised): string | null => lotsOf(r, OLD)[0]!.gap;

  test('the whole holding into one other scheme for the same amount is a candidate; within the amount tolerance too', () => {
    // 15,000 = 100 u at 150, all of OLD; one Switch In of 15,000: candidate. 15,001 (within Rs 1.50 = 0.01% of
    // 15,001): candidate; 15,002: an ordinary switch, computed 5,000.
    assert.equal(oldGap(pair(15000, [[NEW, 15000]])), 'merger-candidate');
    assert.equal(oldGap(pair(15000, [[NEW, 15001]])), 'merger-candidate');
    const r = pair(15000, [[NEW, 15002]]);
    assert.equal(oldGap(r), null);
    near(v(lotsOf(r, OLD)[0]!.realised), 5000, 'ordinary switch');
    assert.equal(r.counts.mergerCandidates, 0);
    assert.ok(!r.issues.some((i) => i.ruleId === 'tax.derived-merger-candidates'));
  });

  test('the whole holding within UNITS_TOLERANCE: 0.0004 u short of 100 u is still the whole holding', () => {
    // Switch Out of 14,999.94 at 150 = 99.9996 u: 0.0004 u left, within 0.0005: a candidate (with a switch in of the same
    // amount). Of 14,999.91 = 99.9994 u: 0.0006 u left, A is kept: an ordinary switch, computed.
    assert.equal(oldGap(pair(14999.94, [[NEW, 14999.94]])), 'merger-candidate');
    assert.equal(oldGap(pair(14999.91, [[NEW, 14999.91]])), null);
  });

  test('what stays computed: a partial switch, A traded later, several partners, another client, a redemption', () => {
    // Partial: 7,500 = 50 of 100 u (A kept) with a Switch In of 7,500: computed 2,500.
    const partial = pair(7500, [[NEW, 7500]]);
    assert.equal(oldGap(partial), null);
    near(v(lotsOf(partial, OLD)[0]!.realised), 2500, 'partial');
    // A later Purchase of OLD (1 Dec 2023): A is not left empty, computed.
    assert.equal(oldGap(pair(15000, [[NEW, 15000]], [flow(A, OLD, [2023, 12, 1], 'Purchase', 150, -1500)])), null);
    // Two Switch Ins of 15,000 the same day (NEW and THIRD): several possible partners, computed; neither switch in is
    // a candidate's (a later sale of NEW stays computed).
    const two = pair(15000, [[NEW, 15000], [THIRD, 15000]], [flow(A, NEW, [2026, 5, 4], 'Redemption', 180, 18000)]);
    assert.equal(oldGap(two), null);
    assert.deepEqual(lotsOf(two, NEW).map((x) => x.gap), [null]);
    // Two Switch Outs of 15,000 that day (OLD and THIRD, THIRD kept) and one Switch In: the switch in has two possible
    // partners, computed.
    const rivals = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, THIRD, [2019, 7, 1], 'Purchase', 100, -20000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(A, THIRD, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000),
    ]);
    assert.equal(oldGap(rivals), null);
    // The switch in is another client's: not one client, computed.
    const other = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(B, NEW, [2023, 11, 10], 'Switch In', 150, -15000),
    ]);
    assert.equal(oldGap(other), null);
    // A redemption (not a switch out) of the whole holding with a switch in of the same amount: computed.
    const redemption = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2023, 11, 10], 'Redemption', 150, 15000),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000),
    ]);
    assert.equal(oldGap(redemption), null);
  });

  test('the scheme switched into: sales before the candidate stay computed, sales after are the gap', () => {
    // NEW: Purchase 1 Jan 2023 100 u at 100; Redemption 1 Mar 2023 20 u at 120 (2,400: realised 400, before the switch
    // in, computed); the candidate's Switch In 10 Nov 2023 (100 u at 150); Redemption 1 Jun 2025 50 u at 200 (10,000):
    // FIFO would take the 2023 purchase (cost 5,000, realised 5,000), but it comes after the switch in: one
    // 'merger-candidate' gap lot, sale value 10,000, no cost, no realised gain, the ordinary-switch lot kept.
    const r = run([
      flow(A, NEW, [2023, 1, 1], 'Purchase', 100, -10000),
      flow(A, NEW, [2023, 3, 1], 'Redemption', 120, 2400),
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000),
      flow(A, NEW, [2025, 6, 1], 'Redemption', 200, 10000),
    ]);
    const l = lotsOf(r, NEW);
    assert.deepEqual(l.map((x) => x.gap), [null, 'merger-candidate']);
    near(v(l[0]!.realised), 400, 'before the switch in');
    // The marker carries scheme A's instrument key (financial review V3).
    assert.deepEqual(l[1]!.mergerCandidate, { role: 'successor', day: day(2023, 11, 10), partnerKeys: [lotsOf(r, OLD)[0]!.instrumentKey] });
    near(v(l[1]!.saleValue), 10000, 'sale value'); near(v(l[1]!.units), 50, 'units');
    assert.equal(l[1]!.realised.kind, 'missing'); assert.equal(l[1]!.purchaseDate.kind, 'missing');
    assert.deepEqual(l[1]!.asSwitch!.map((x) => v(x.realised)), [5000]);
    const sy = r.schemeYears.find((s) => s.instrumentName === NEW && s.fy === 2025)!;
    assert.equal(sy.realised.kind, 'missing');
    assert.deepEqual(sy.gaps, { 'merger-candidate': 1 });
    assert.match(r.issues.find((i) => i.ruleId === 'tax.derived-gaps')!.message, /looks like a scheme merger/);
    // N3 (financial review): the file does not say whether the pair was a merger.
    assert.match(r.issues.find((i) => i.ruleId === 'tax.derived-gaps')!.message, /the IRR file does not say whether it was a merger/);
  });
});

describe('round 2c financial review V1, V2: a merger written as several rows, and a merger out of a scheme whose units are not known', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const NEW = 'Sample Small Cap Fund - Regular Plan - Growth';
  /** Small Cap redeemed 4 May 2026, 100 u at 180 (18,000): after the switch in, so a candidate's successor. */
  const sellNew = flow(A, NEW, [2026, 5, 4], 'Redemption', 180, 18000, { folio: 'F9' });
  const noComputedOld = (r: DerivedRealised): void => {
    const l = lotsOf(r, OLD);
    assert.ok(l.length > 0 && l.every((x) => x.gap === 'merger-candidate' && x.realised.kind === 'missing' && x.saleValue.kind === 'missing'),
      JSON.stringify(l.map((x) => [x.gap, x.realised.kind])));
  };
  const newIsGap = (r: DerivedRealised): void => {
    assert.deepEqual(lotsOf(r, NEW).map((x) => [x.gap, x.mergerCandidate?.role]), [['merger-candidate', 'successor']]);
  };

  test('M1a: Contra in two folios (60 u and 40 u) switched out in two rows, two matching switch ins: no computed gain on A', () => {
    // Folio F1: Purchase 1 Jul 2019 60 u at 100; F2: 40 u at 100. 10 Nov 2023: Switch Outs of 9,000 (60 u at 150) and
    // 6,000 (40 u at 150), Contra's last trades, leaving 0 u after the day's switch outs; Small Cap Switch Ins of 9,000
    // and 6,000 the same day. The day's sums: out of Contra 15,000, in to Small Cap 15,000, one partner each way: one
    // candidate. 0e860c3 computed the 60 u row (realised 3,000): only the 40 u row emptied Contra by itself.
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -6000, { folio: 'F1' }), flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -4000, { folio: 'F2' }),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 9000, { folio: 'F1' }), flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 6000, { folio: 'F2' }),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -9000, { folio: 'F9' }), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -6000, { folio: 'F9' }),
      sellNew,
    ]);
    noComputedOld(r);
    assert.equal(lotsOf(r, OLD).length, 2);
    newIsGap(r);
    assert.equal(r.counts.mergerCandidates, 1);
  });

  test('M1b: the same two switch outs against one switch in of 15,000: a candidate, and Small Cap\'s later sale a gap', () => {
    // 0e860c3: nothing paired; both switch outs computed (3,000 and 2,000) and the Small Cap sale computed at 3,000 on
    // the merger-day cost.
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -6000, { folio: 'F1' }), flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -4000, { folio: 'F2' }),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 9000, { folio: 'F1' }), flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 6000, { folio: 'F2' }),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000, { folio: 'F9' }),
      sellNew,
    ]);
    noComputedOld(r);
    newIsGap(r);
    assert.equal(r.counts.mergerCandidates, 1);
    // A partial switch in two rows (60 u of the 100 u, Contra kept) stays computed.
    const partial = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 4500), flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 4500),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -9000),
    ]);
    assert.deepEqual(lotsOf(partial, OLD).map((x) => x.gap), [null, null]);
    assert.equal(partial.counts.mergerCandidates, 0);
  });

  test('M2: Contra with an unpriced purchase (units not known), switched out whole as its last trade: a candidate (V2)', () => {
    // Purchase 1 Jul 2019 100 u at 100; Purchase 1 Jan 2020 of 5,000 with no price (units not known); Switch Out
    // 10 Nov 2023 of 22,500 at 150, Contra's last trade; Small Cap Switch In of 22,500 the same day, the one partner.
    // 0e860c3: realised 5,000 on the priced lot (PARTIAL, beside a purchase-without-price gap) and the Small Cap sale
    // computed at 3,000. Now the whole switch out is one 'merger-candidate' gap and the Small Cap sale too.
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2020, 1, 1], 'Purchase', null, -5000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 22500), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -22500),
      sellNew,
    ]);
    noComputedOld(r);
    assert.equal(lotsOf(r, OLD).length, 1);
    newIsGap(r);
    // Units not known but a later trade of Contra: not its last trade, so an ordinary switch (the existing gaps apply).
    const later = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2020, 1, 1], 'Purchase', null, -5000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 22500), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -22500),
      flow(A, OLD, [2024, 1, 1], 'Purchase', 150, -1500),
    ]);
    assert.equal(later.counts.mergerCandidates, 0);
  });
});

describe('Gate B of 4001f8f: many-into-one mergers (B1), a provably partial switch (D1), the successor reset', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const OLD2 = 'Sample Value Fund - Regular Plan - Growth';
  const NEW = 'Sample Small Cap Fund - Regular Plan - Growth';
  /** Contra 100 u at 100 and Value 100 u at 40, both switched out whole on 10 Nov 2023 (15,000 and 5,000). */
  const twoIntoOne = (ins: number[], o: { valueOut?: number } = {}): DerivedRealised => run([
    flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD2, [2019, 7, 1], 'Purchase', 40, -4000),
    flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(A, OLD2, [2023, 11, 10], 'Switch Out', 50, o.valueOut ?? 5000),
    ...ins.map((amt) => flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -amt)),
    flow(A, NEW, [2026, 5, 4], 'Redemption', 180, 24000),
  ]);

  for (const ins of [[20000], [15000, 5000]]) {
    test(`B1: Contra and Value merged into Small Cap (switch in written as ${ins.length} row${ins.length > 1 ? 's' : ''}): no computed gain`, () => {
      // CHAT-012's case. Every scheme switched out that day is emptied (its last trade), every switch in goes to Small
      // Cap, and out 20,000 equals in 20,000: a candidate (2 sources). 4001f8f computed Contra 5,000 and Value 1,000 in
      // FY 2023-24 and Small Cap 4,000 (or 3,000 + 1,000) in FY 2026-27 on the merger-day cost; under a merger FY 2023-24
      // is 0 and Small Cap's gain 24,000 - 14,000 = 10,000. Now every one of them is a 'merger-candidate' gap and both
      // years are NOT AVAILABLE without a statement.
      const r = twoIntoOne(ins);
      for (const name of [OLD, OLD2]) {
        assert.deepEqual(lotsOf(r, name).map((x) => [x.gap, x.mergerCandidate?.role, x.realised.kind]), [['merger-candidate', 'switch-out', 'missing']], name);
      }
      const nw = lotsOf(r, NEW);
      assert.deepEqual(nw.map((x) => [x.gap, x.mergerCandidate?.role]), [['merger-candidate', 'successor']]);
      assert.deepEqual([...nw[0]!.mergerCandidate!.partnerKeys].sort(), [lotsOf(r, OLD)[0]!.instrumentKey, lotsOf(r, OLD2)[0]!.instrumentKey].sort());
      assert.equal(r.counts.mergerCandidates, 2);
      assert.ok(r.schemeYears.every((s) => s.realised.kind === 'missing'));
      // The review's figure from the IRR side alone (no base file here, so no client is left out as outside the review).
      const all = { ...r, baseClients: null };
      assert.equal(realisedForYear(2023, all, null).total.kind, 'missing');
      assert.equal(realisedForYear(2026, all, null).total.kind, 'missing');
      assert.match(r.issues.find((i) => i.ruleId === 'tax.derived-merger-candidates')!.message, /^2 switch pairs look like a scheme merger/);
    });
  }

  test('B1, what stays computed: a source kept, or the totals unequal', () => {
    // Value switched out 2,500 of its 5,000 (kept): not every source is emptied. Contra's 15,000 alone does not match
    // the 17,500 in, so there is no one-into-one candidate either: all computed (Contra 5,000; Value 2,500 - 2,000 =
    // 500). Totals unequal: Value whole but Small Cap in 19,000: computed.
    const kept = twoIntoOne([17500], { valueOut: 2500 });
    assert.equal(kept.counts.mergerCandidates, 0);
    near(v(lotsOf(kept, OLD)[0]!.realised), 5000, 'Contra'); near(v(lotsOf(kept, OLD2)[0]!.realised), 500, 'Value');
    const unequal = twoIntoOne([19000]);
    assert.equal(unequal.counts.mergerCandidates, 0);
    assert.ok(lotsOf(unequal, OLD).every((x) => x.gap === null));
  });

  test('D1: a switch that the priced lots prove partial stays computed even when A\'s units are not known', () => {
    // The delta review's case: Contra 100 u at 100, then a purchase of 5,000 with no price (units not known, but only
    // added); 30 u switched out for 4,500 on 10 Nov 2023 (Contra's last trade); Small Cap in for 4,500; Small Cap's 30 u
    // redeemed 4 May 2026 at 180 (5,400). At least 70 u of Contra stay, so it is a partial switch: Contra 4,500 - 3,000
    // = 1,500 and Small Cap 5,400 - 4,500 = 900, computed (4001f8f: both gaps).
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2020, 1, 1], 'Purchase', null, -5000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 4500), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -4500),
      flow(A, NEW, [2026, 5, 4], 'Redemption', 180, 5400),
    ]);
    assert.equal(r.counts.mergerCandidates, 0);
    assert.deepEqual(lotsOf(r, OLD).map((x) => [x.gap, v(x.realised)]), [[null, 1500]]);
    assert.deepEqual(lotsOf(r, NEW).map((x) => [x.gap, v(x.realised)]), [[null, 900]]);
  });

  test('the successor marker ends once the scheme switched into is back to 0 units: a later fresh purchase and sale is computed', () => {
    // The fixture merger (Contra into Small Cap, 100 u at 150), then Small Cap's 100 u redeemed 1 Jun 2024 at 160 (a
    // successor gap), a fresh Purchase 1 Jan 2025 of 50 u at 200 and its Redemption 1 Jun 2025 at 220: 11,000 - 10,000 =
    // 1,000, true under either reading, computed (4001f8f: still a gap).
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000), flow(A, NEW, [2024, 6, 1], 'Redemption', 160, 16000),
      flow(A, NEW, [2025, 1, 1], 'Purchase', 200, -10000), flow(A, NEW, [2025, 6, 1], 'Redemption', 220, 11000),
    ]);
    assert.deepEqual(lotsOf(r, NEW).map((x) => [x.gap, x.mergerCandidate?.role ?? null]), [['merger-candidate', 'successor'], [null, null]]);
    near(v(lotsOf(r, NEW)[1]!.realised), 1000, 'fresh purchase sold');
  });

  test('D1: a sale of A whose units are not known ends the lower bound, so a later switch out of the rest is a candidate (mutant D1b)', () => {
    // Contra 100 u at 100; a Redemption of 7,000 with no price (units not known: it may have sold any number); then a
    // Switch Out of 30 u at 150 (4,500), Contra's last trade, into Small Cap for 4,500. After the unknown sale no lower
    // bound of Contra's units is left, so the switch out may have emptied it: a candidate, and Small Cap's later sale
    // (30 u at 180, 5,400) a successor gap. Keeping the priced bound (100 - 30 = 70 u) would call it partial and compute
    // it: the unsafe direction.
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD, [2022, 1, 1], 'Redemption', null, 7000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 4500), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -4500),
      flow(A, NEW, [2026, 5, 4], 'Redemption', 180, 5400),
    ]);
    assert.equal(r.counts.mergerCandidates, 1);
    assert.deepEqual(lotsOf(r, OLD).map((x) => x.gap), ['sale-without-price', 'merger-candidate']);
    assert.deepEqual(lotsOf(r, NEW).map((x) => [x.gap, x.mergerCandidate?.role]), [['merger-candidate', 'successor']]);
  });
});

describe('E1 (delta review of 8ed1dc7): same-day merger chains', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const OLD2 = 'Sample Value Fund - Regular Plan - Growth';
  const NEW = 'Sample Small Cap Fund - Regular Plan - Growth';
  const LAST = 'Sample Focused Fund - Regular Plan - Growth';
  /** Contra 100 u at 100 and Value 100 u at 40 switched out whole on 10 Nov 2023 into Small Cap (20,000). */
  const intoNew = (extra: Cell[][]): DerivedRealised => run([
    flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD2, [2019, 7, 1], 'Purchase', 40, -4000),
    flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(A, OLD2, [2023, 11, 10], 'Switch Out', 50, 5000),
    flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -20000),
    ...extra,
  ]);
  const gapsOf = (r: DerivedRealised, name: string): Array<[string | null, string | null]> =>
    lotsOf(r, name).map((x) => [x.gap, x.mergerCandidate?.role ?? null]);

  test('(a) Small Cap itself switched out whole the same day: Contra, Value and Small Cap\'s switch out are all gaps', () => {
    // Small Cap's 20,000 (133.33 u at 150) is switched out whole the same day. Small Cap both receives a switch in and is
    // switched out whole: a pass-through; with no other recipient it is the chain's end. Contra and Value are emptied and
    // their 20,000 equals Small Cap's 20,000 in: a candidate. 8ed1dc7 computed Contra 5,000 and Value 1,000 (B1d guard).
    const r = intoNew([flow(A, NEW, [2023, 11, 10], 'Switch Out', 150, 20000)]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, NEW), [['merger-candidate', 'switch-out']]);
    assert.equal(r.counts.mergerCandidates, 2);
    assert.ok(r.schemeYears.every((s) => s.realised.kind === 'missing'));
  });

  test('(b) the chain Contra and Value into Small Cap into Focused the same day: every switch a gap, Focused\'s later sale too', () => {
    // Small Cap switched out whole (20,000) into Focused (20,000) the same day; Focused redeemed 4 May 2026 for 24,000.
    // Followed through Small Cap, the chain ends in Focused, whose 20,000 in equals Contra and Value's 20,000 out: Contra,
    // Value and Small Cap's switch outs are gaps, and Focused's sale is a successor gap (its lots are not known). 8ed1dc7
    // computed Contra 5,000 and Value 1,000 (the Small Cap to Focused pair hid them) and Focused's sale was a gap.
    const r = intoNew([
      flow(A, NEW, [2023, 11, 10], 'Switch Out', 150, 20000), flow(A, LAST, [2023, 11, 10], 'Switch In', 150, -20000),
      flow(A, LAST, [2026, 5, 4], 'Redemption', 180, 24000),
    ]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, NEW), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, LAST), [['merger-candidate', 'successor']]);
    assert.equal(r.counts.mergerCandidates, 3);
    assert.ok(r.schemeYears.every((s) => s.realised.kind === 'missing'));
  });

  test('a same-day chain whose ends do not agree: the first link still fits many into one (M7b B2); a chain that fits no link stays computed', () => {
    // As (b) but Focused receives 19,000: the chain's ends do not agree (20,000 out against 19,000 in), so it is no chain
    // candidate. Since M7b B2 (KI-340) many into one is tested per receiving scheme: Contra and Value's 20,000 equals
    // Small Cap's 20,000 in, so they are candidates and Small Cap's onward switch out is a successor gap (ef5e80b
    // computed Contra 5,000 and Value 1,000 here). When Small Cap itself receives 19,000 (and passes it to Focused), no
    // link of Contra and Value fits: Contra 5,000 and Value 1,000 stay computed.
    const r = intoNew([
      flow(A, NEW, [2023, 11, 10], 'Switch Out', 150, 20000), flow(A, LAST, [2023, 11, 10], 'Switch In', 150, -19000),
    ]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, NEW), [['merger-candidate', 'successor']]);
    const none = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD2, [2019, 7, 1], 'Purchase', 40, -4000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(A, OLD2, [2023, 11, 10], 'Switch Out', 50, 5000),
      flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -19000),
      flow(A, NEW, [2023, 11, 10], 'Switch Out', 150, 19000), flow(A, LAST, [2023, 11, 10], 'Switch In', 150, -19000),
    ]);
    assert.deepEqual(lotsOf(none, OLD).map((x) => [x.gap, v(x.realised)]), [[null, 5000]]);
    assert.deepEqual(lotsOf(none, OLD2).map((x) => [x.gap, v(x.realised)]), [[null, 1000]]);
  });

  test('a pass-through that held units before sells some the same day: that sale is a successor gap (mutant E1h)', () => {
    // The delta review's G1 case. Small Cap held 50 u bought 1 Jan 2022 at 100. On 10 Nov 2023 Contra (100 u at 100) is
    // switched out whole into Small Cap (15,000 = 100 u at 150); Small Cap redeems 50 u (7,500); then Small Cap is
    // switched out whole (15,000) into Focused (15,000). The starts' 15,000 equals Focused's 15,000: a chain through
    // Small Cap. The redemption comes after Small Cap's candidate switch in, so it is a successor gap: under a merger
    // Contra's carried 2019 lots could be the ones sold, so its figure is not known. Leaving the pass-through's switch in
    // unmarked would compute it at 7,500 - 5,000 = 2,500 on the ordinary FIFO reading (the unsafe direction).
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, NEW, [2022, 1, 1], 'Purchase', 100, -5000),
      flow(A, OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(A, NEW, [2023, 11, 10], 'Switch In', 150, -15000),
      flow(A, NEW, [2023, 11, 10], 'Redemption', 150, 7500), flow(A, NEW, [2023, 11, 10], 'Switch Out', 150, 15000),
      flow(A, LAST, [2023, 11, 10], 'Switch In', 150, -15000),
    ]);
    assert.deepEqual(gapsOf(r, NEW), [['merger-candidate', 'successor'], ['merger-candidate', 'switch-out']]);
    assert.equal(lotsOf(r, NEW)[0]!.realised.kind, 'missing');
    assert.deepEqual(lotsOf(r, NEW)[0]!.asSwitch!.map((x) => v(x.realised)), [2500]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
  });
});

describe('M7b B2 (KI-340): compound merger days, many into one per receiving scheme', () => {
  const OLD = 'Sample Contra Fund - Regular Plan - Growth';
  const OLD2 = 'Sample Value Fund - Regular Plan - Growth';
  const NEW = 'Sample Small Cap Fund - Regular Plan - Growth';
  const FLEXI = 'Sample Flexi Cap Fund - Regular Plan - Growth';
  const MID = 'Sample Midcap Fund - Regular Plan - Growth';
  const LARGE = 'Sample Large Cap Fund - Regular Plan - Growth';
  const M = [2023, 11, 10] as const;
  /**
   * CHAT-012's known answer (probes-taxr2c/b2/kat.ts): Contra 100 u at 100 (cost 10,000) and Value 40 u at 100 (cost
   * 4,000), both switched out whole into Small Cap for 15,000 and 5,000 on 10 Nov 2023 (Small Cap in 20,000 = 133.3333 u at
   * 150); Small Cap held 50 u bought 1 Jul 2019 at 100 before the day.
   */
  const day = (extra: Cell[][], priorNew = true): DerivedRealised => run([
    flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD2, [2019, 7, 1], 'Purchase', 100, -4000),
    ...(priorNew ? [flow(A, NEW, [2019, 7, 1], 'Purchase', 100, -5000)] : []),
    flow(A, OLD, M, 'Switch Out', 150, 15000), flow(A, OLD2, M, 'Switch Out', 125, 5000), flow(A, NEW, M, 'Switch In', 150, -20000),
    ...extra,
  ]);
  const gapsOf = (r: DerivedRealised, name: string): Array<[string | null, string | null]> =>
    lotsOf(r, name).map((x) => [x.gap, x.mergerCandidate?.role ?? null]);
  /** The review's figure from the IRR side alone (no base file here, so no client is left out). */
  const fyTotal = (r: DerivedRealised, fy: number): Value<number> => realisedForYear(fy, { ...r, baseClients: null }, null).total;

  test('B1d(ii), CHAT-012\'s case: Small Cap partly switched into Flexi Cap the same day: FY 2023-24 a gap, not 8,500', () => {
    // Small Cap switches 50 u (7,500 at 150) into Flexi Cap the same day. a2870e2 found no candidate (the day held another
    // switch): Contra 5,000, Value 1,000 and Small Cap 7,500 - 5,000 = 2,500, a full 8,500 for FY 2023-24 with no gap.
    // Per receiving scheme: Contra and Value's 20,000 equals Small Cap's 20,000 in: candidates. Small Cap's own switch out
    // comes after its candidate switch in: a successor gap. FY 2023-24 is NOT AVAILABLE.
    const r = day([flow(A, NEW, M, 'Switch Out', 150, 7500), flow(A, FLEXI, M, 'Switch In', 150, -7500)]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, NEW), [['merger-candidate', 'successor']]);
    assert.equal(r.counts.mergerCandidates, 2);
    assert.equal(fyTotal(r, 2023).kind, 'missing');
  });

  test('B1d(i): Small Cap (held before) switched out whole into Flexi Cap the same day: Contra and Value gaps', () => {
    // Small Cap's 183.3333 u (27,500 at 150) all go into Flexi Cap for 27,500. a2870e2 paired Small Cap with Flexi Cap one
    // into one and stopped there: Contra 5,000 and Value 1,000 computed (FY 2023-24 6,000, partial). Now Contra and Value
    // are candidates into Small Cap too, and Small Cap's switch out is a gap (the one-into-one pair).
    const r = day([flow(A, NEW, M, 'Switch Out', 150, 27500), flow(A, FLEXI, M, 'Switch In', 150, -27500)]);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(lotsOf(r, NEW).map((x) => x.gap), ['merger-candidate']);
    assert.equal(r.counts.mergerCandidates, 3);
    assert.equal(fyTotal(r, 2023).kind, 'missing');
  });

  test('two mergers the same day (Midcap into Large Cap one into one, Contra and Value into Small Cap): all gaps', () => {
    // Midcap 30 u at 100 switched out whole (4,500 at 150) into Large Cap (4,500) the same day. a2870e2 paired Midcap with
    // Large Cap and so skipped the many-into-one test: Contra 5,000 and Value 1,000 computed.
    const r = day([
      flow(A, MID, [2019, 7, 1], 'Purchase', 100, -3000), flow(A, MID, M, 'Switch Out', 150, 4500), flow(A, LARGE, M, 'Switch In', 150, -4500),
    ], false);
    assert.deepEqual(gapsOf(r, OLD), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, OLD2), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, MID), [['merger-candidate', 'switch-out']]);
    assert.equal(r.counts.mergerCandidates, 3);
  });

  test('when more than one subset fits, every source of them is a gap (never one picked); over 16 sources, only when a fit is still possible', () => {
    // Contra 15,000, Value 5,000 and Midcap 5,000 (30 u at 100 written at 166.6667) all emptied into Small Cap for 20,000:
    // {Contra, Value} and {Contra, Midcap} both fit. All three are gaps.
    const r = day([flow(A, MID, [2019, 7, 1], 'Purchase', 100, -3000), flow(A, MID, M, 'Switch Out', 5000 / 30, 5000)], false);
    for (const name of [OLD, OLD2, MID]) assert.deepEqual(gapsOf(r, name), [['merger-candidate', 'switch-out']], name);
    // n schemes of 1,000 each (8 u bought for 800), all emptied the same day, into receiving schemes as given.
    const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Sample Many ${i + 1} Fund - Growth`);
    const many = (n: number, ins: Array<[string, number]>): DerivedRealised => run([
      ...names(n).flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -800), flow(A, k, M, 'Switch Out', 125, 1000)]),
      ...ins.map(([k, amt]) => flow(A, k, M, 'Switch In', 150, -amt)),
    ]);
    const allGaps = (r: DerivedRealised, n: number): boolean => names(n).every((k) => lotsOf(r, k).every((x) => x.gap === 'merger-candidate'));
    const allComputed = (r: DerivedRealised, n: number): boolean =>
      names(n).every((k) => lotsOf(r, k).every((x) => x.gap === null && Math.abs(v(x.realised)! - 200) < 0.01));
    // Nine into 2,000: two of them fit (many ways): all nine gaps, counted 9. Nine into 2,000 and 3,000 at once: still
    // counted once each, 9 (5054576 counted 18: review H1).
    const r9 = many(9, [[NEW, 2000]]);
    assert.equal(r9.counts.mergerCandidates, 9);
    assert.ok(allGaps(r9, 9));
    assert.equal(many(9, [[NEW, 2000], [MID, 3000]]).counts.mergerCandidates, 9);
    // Nine, and sixteen (at MANY_INTO_ONE_SOURCES), into 2,500: searched, no subset fits: all computed, 200 each
    // (5054576 made the nine gaps, over its cap of 8: review H1).
    for (const n of [9, 16]) {
      const r = many(n, [[NEW, 2500]]);
      assert.equal(r.counts.mergerCandidates, 0, `${n}`);
      assert.ok(allComputed(r, n), `${n}`);
    }
    // Seventeen (over the plain search) into 2,500: the bounds cannot rule a fit out (total 17,000, the two smallest
    // 2,000); round 3 J1 searches it exactly by meet in the middle: no sum of 1,000s is 2,500, so all seventeen are
    // computed, 0 counted (5b9028c: not decidable, all gaps, 17). Thirty-three (over MANY_INTO_ONE_SOURCES_SPLIT, 32)
    // into 2,500: still not decidable: all gaps, counted 33. Seventeen into 50,000: the total is short, nothing can fit:
    // all computed.
    const r17 = many(17, [[NEW, 2500]]);
    assert.equal(r17.counts.mergerCandidates, 0);
    assert.ok(allComputed(r17, 17));
    const r33 = many(33, [[NEW, 2500]]);
    assert.equal(r33.counts.mergerCandidates, 33);
    assert.ok(allGaps(r33, 33));
    const r17b = many(17, [[NEW, 50000]]);
    assert.equal(r17b.counts.mergerCandidates, 0);
    assert.ok(allComputed(r17b, 17));
  });

  test('review H1: nine schemes into 50,000 and 58,000, where no subset can fit, stay computed (18,000)', () => {
    // The review's case: nine schemes, each 100 u bought for 10,000 and emptied for 12,000 (realised 2,000 each), switched
    // into two schemes for 50,000 and 58,000 the same day. Sums of 12,000s are 48,000 or 60,000, never 50,000 or 58,000:
    // an ordinary rebalancing. 5054576 made all nine gaps over its cap and counted 18.
    const nine = Array.from({ length: 9 }, (_, i) => `Sample Legacy ${i + 1} Fund - Growth`);
    const r = run([
      ...nine.flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, k, M, 'Switch Out', 120, 12000)]),
      flow(A, NEW, M, 'Switch In', 100, -50000), flow(A, FLEXI, M, 'Switch In', 100, -58000),
    ]);
    assert.equal(r.counts.mergerCandidates, 0);
    const total = nine.reduce((t, k) => t + lotsOf(r, k).reduce((s, x) => s + (v(x.realised) ?? NaN), 0), 0);
    near(total, 18000, 'nine gains');
  });

  test('review H2: on an ambiguous day, a receiving scheme one of the ambiguous sources could have made is a gap too', () => {
    // The review's case: Contra, Value and Midcap, each 100 u bought for 8,000 and emptied for 10,000 on 10 Nov 2023, into
    // Small Cap (20,000) and Flexi Cap (10,000). Any two fit Small Cap: all three sources are gaps (ambiguous). Flexi
    // Cap's 10,000 can be any one of them, merged into it: its switch in is a lot not known, so its later sale (100 u at
    // 120, 12,000 on 4 May 2026) is a successor gap. 5054576 computed it at 2,000.
    const r = run([
      ...[OLD, OLD2, MID].flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -8000), flow(A, k, M, 'Switch Out', 125, 10000)]),
      flow(A, NEW, M, 'Switch In', 100, -20000), flow(A, FLEXI, M, 'Switch In', 100, -10000),
      flow(A, FLEXI, [2026, 5, 4], 'Redemption', 120, 12000),
    ]);
    for (const k of [OLD, OLD2, MID]) assert.deepEqual(gapsOf(r, k), [['merger-candidate', 'switch-out']], k);
    assert.deepEqual(gapsOf(r, FLEXI), [['merger-candidate', 'successor']]);
    assert.equal(r.counts.mergerCandidates, 3);
  });

  test('review H2 on a not-decidable day: thirty-three sources into Small Cap 2,500 and Flexi Cap 1,000 (mutant H2c)', () => {
    // Thirty-three schemes, each 8 u bought for 800 and emptied for 1,000 on 10 Nov 2023, into Small Cap (2,500) and
    // Flexi Cap (1,000 = 10 u at 100). Over MANY_INTO_ONE_SOURCES_SPLIT (32; round 3 J1 searches up to it exactly, so the
    // case of 5b9028c, seventeen sources, is now decided: no fit) the bounds cannot rule a fit into Small Cap out, so its
    // sources are not decidable: ambiguous. Flexi Cap's 1,000 can be any one of them merged into it: its switch in is a
    // lot not known, and its later sale (10 u at 120, 1,200 on 4 May 2026) is a successor gap. Treating the not-decidable
    // fit as unambiguous would compute that sale at 200.
    const names = Array.from({ length: 33 }, (_, i) => `Sample Many ${i + 1} Fund - Growth`);
    const r = run([
      ...names.flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -800), flow(A, k, M, 'Switch Out', 125, 1000)]),
      flow(A, NEW, M, 'Switch In', 150, -2500), flow(A, FLEXI, M, 'Switch In', 100, -1000),
      flow(A, FLEXI, [2026, 5, 4], 'Redemption', 120, 1200),
    ]);
    assert.ok(names.every((k) => lotsOf(r, k).every((x) => x.gap === 'merger-candidate')));
    assert.deepEqual(gapsOf(r, FLEXI), [['merger-candidate', 'successor']]);
    assert.equal(r.counts.mergerCandidates, 33);
  });

  test('a subset is two or more sources: two emptied schemes of the same amount into one switch in stay computed', () => {
    // Contra and Value (100 u at 100 each) both switched out whole for 15,000 (at 150) on 10 Nov 2023, and Small Cap in
    // for 15,000. One into one fails (two possible partners), and no subset
    // of two or more sums to 15,000: an ordinary switch each, computed at 5,000 (a single source is never a subset).
    const r = run([
      flow(A, OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, OLD2, [2019, 7, 1], 'Purchase', 100, -10000),
      flow(A, OLD, M, 'Switch Out', 150, 15000), flow(A, OLD2, M, 'Switch Out', 150, 15000), flow(A, NEW, M, 'Switch In', 150, -15000),
    ]);
    assert.equal(r.counts.mergerCandidates, 0);
    assert.deepEqual([...lotsOf(r, OLD), ...lotsOf(r, OLD2)].map((x) => [x.gap, v(x.realised)]), [[null, 5000], [null, 5000]]);
  });
});

describe('tax round 3 (CHAT-012\'s Gate B of M7b and of round 2c): the merger search on the realised side', () => {
  const X = 'Sample Contra Fund - Regular Plan - Growth';
  const Y = 'Sample Value Fund - Regular Plan - Growth';
  const B = 'Sample Small Cap Fund - Regular Plan - Growth';
  const C = 'Sample Focused Fund - Regular Plan - Growth';
  const M = [2023, 11, 10] as const;
  const gapsOf = (r: DerivedRealised, name: string): Array<[string | null, string | null]> =>
    lotsOf(r, name).map((x) => [x.gap, x.mergerCandidate?.role ?? null]);

  test('P3: a source already paired one into one never joins a many-into-one subset (CHAT-012\'s mutant P3)', () => {
    // On 10 Nov 2023: Contra (100 u bought at 80, cost 8,000) switched out whole for 10,000 (at 100), and Focused in for
    // 10,000, the only switch in of that sum and Contra the only switch out of it: a one-into-one candidate. Value (50 u at
    // 80, cost 4,000) switched out whole for 5,000, and Small Cap in for 15,000 (100 u at 150), redeemed 4 May 2026 at
    // 180 (18,000). Contra is paired, so Small Cap's only possible source is Value, one scheme: no subset of two, and
    // no one-into-one pair either (5,000 against 15,000). Value is an ordinary switch, 5,000 - 4,000 = 1,000; Small Cap's
    // sale 18,000 - 15,000 = 3,000; one candidate (Contra). With the paired source let in (mutant P3) Contra and Value
    // would fit Small Cap's 15,000: Value and Small Cap's sale gaps, and 3 counted.
    const r = run([
      flow(A, X, [2019, 7, 1], 'Purchase', 80, -8000), flow(A, Y, [2019, 7, 1], 'Purchase', 80, -4000),
      flow(A, X, M, 'Switch Out', 100, 10000), flow(A, C, M, 'Switch In', 100, -10000),
      flow(A, Y, M, 'Switch Out', 100, 5000), flow(A, B, M, 'Switch In', 150, -15000),
      flow(A, B, [2026, 5, 4], 'Redemption', 180, 18000),
    ]);
    assert.deepEqual(gapsOf(r, X), [['merger-candidate', 'switch-out']]);
    // Contra's partner is Focused (one key), never Small Cap.
    const partners = lotsOf(r, X)[0]!.mergerCandidate!.partnerKeys;
    assert.equal(partners.length, 1);
    assert.notEqual(partners[0], lotsOf(r, B)[0]!.instrumentKey);
    assert.deepEqual(lotsOf(r, Y).map((x) => [x.gap, v(x.realised)]), [[null, 1000]]);
    assert.deepEqual(lotsOf(r, B).map((x) => [x.gap, v(x.realised)]), [[null, 3000]]);
    assert.equal(r.counts.mergerCandidates, 1);
  });

  const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Sample Legacy ${i + 1} Fund - Growth`);
  test('J1, the financial review\'s case: 17 schemes of 12,000 into 1,00,000 and 1,04,000 stay computed at 34,000', () => {
    // Seventeen schemes, each 100 u bought 1 Jul 2019 for 10,000 and emptied on 10 Nov 2023 for 12,000 (realised 2,000
    // each), into Small Cap (1,00,000) and Focused (1,04,000). Sums of 12,000s are multiples of 12,000: 1,00,000 is 8.33
    // and 1,04,000 8.67 of them, so no subset fits either; an ordinary rebalancing. Over 16 sources 5b9028c could not
    // decide it (both bounds pass) and made all seventeen gaps, hiding 34,000; the exact search computes 17 x 2,000.
    const r = run([
      ...names(17).flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, k, M, 'Switch Out', 120, 12000)]),
      flow(A, B, M, 'Switch In', 100, -100000), flow(A, C, M, 'Switch In', 100, -104000),
    ]);
    assert.equal(r.counts.mergerCandidates, 0);
    assert.ok(names(17).every((k) => lotsOf(r, k).every((x) => x.gap === null)));
    near(names(17).reduce((t, k) => t + lotsOf(r, k).reduce((s, x) => s + (v(x.realised) ?? NaN), 0), 0), 34000, 'seventeen gains');
  });

  test('J1: over 16 sources a fit is still found exactly: a unique pair is a candidate alone; many fits stay all gaps', () => {
    // Sixteen schemes of 1,000 (8 u bought for 800) plus Contra emptied for 3,333 and Value for 4,444 (each 10 u bought for
    // 2,000), all on 10 Nov 2023, into Small Cap for 7,777. The only subset that sums to 7,777 within Rs 1 is Contra and
    // Value (3,333 + 4 x 1,000 = 7,333; 4,444 + 3 x 1,000 = 7,444): those two are the candidate's, 2 counted, and the
    // sixteen stay computed at 200 each (5b9028c: not decidable, all eighteen gaps).
    const r = run([
      ...names(16).flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -800), flow(A, k, M, 'Switch Out', 125, 1000)]),
      flow(A, X, [2019, 7, 1], 'Purchase', 200, -2000), flow(A, X, M, 'Switch Out', 333.3, 3333),
      flow(A, Y, [2019, 7, 1], 'Purchase', 200, -2000), flow(A, Y, M, 'Switch Out', 444.4, 4444),
      flow(A, B, M, 'Switch In', 100, -7777),
    ]);
    assert.equal(r.counts.mergerCandidates, 2);
    assert.deepEqual(gapsOf(r, X), [['merger-candidate', 'switch-out']]);
    assert.deepEqual(gapsOf(r, Y), [['merger-candidate', 'switch-out']]);
    assert.ok(names(16).every((k) => lotsOf(r, k).every((x) => x.gap === null && Math.abs(v(x.realised)! - 200) < 0.01)));
    // Eighteen schemes of 1,000 into 2,000: any two fit (153 ways): ambiguous, all eighteen gaps, 18 counted.
    const many = run([
      ...names(18).flatMap((k) => [flow(A, k, [2019, 7, 1], 'Purchase', 100, -800), flow(A, k, M, 'Switch Out', 125, 1000)]),
      flow(A, B, M, 'Switch In', 100, -2000),
    ]);
    assert.equal(many.counts.mergerCandidates, 18);
    assert.ok(names(18).every((k) => lotsOf(many, k).every((x) => x.gap === 'merger-candidate')));
  });

  test('J1: the exact search over 16 sources agrees with every subset tried one by one (synthetic oracle)', () => {
    // An independent oracle: every subset of the sources left (those not above the target), one by one, with the reader's
    // tolerance (Rs 1 or 0.01%, the larger). Deterministic pseudo-random cases of 17 and 18 sources, targets made from two
    // or three of the amounts (with and without a half-rupee step) or arbitrary.
    const same = (x: number, y: number): boolean => Math.abs(x - y) <= Math.max(1, Math.max(x, y) * 0.0001);
    let seed = 11;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const oracle = (avail: Array<[string, number]>, target: number, minSize: number): { chosen: string; ambiguous: boolean } => {
      const left = avail.filter(([, x]) => x <= target || same(x, target));
      const chosen = new Set<string>(); let fits = 0;
      for (let mask = 1; mask < 1 << left.length; mask++) {
        let n = 0; let s = 0;
        for (let i = 0; i < left.length; i++) if (mask & (1 << i)) { n++; s += left[i]![1]; }
        if (n >= minSize && same(s, target)) { fits++; for (let i = 0; i < left.length; i++) if (mask & (1 << i)) chosen.add(left[i]![0]); }
      }
      return { chosen: [...chosen].sort().join(','), ambiguous: fits > 1 };
    };
    const subsetsFitting = (lotsMod as { subsetsFitting?: typeof import('../../../app/src/engine/tax/lots.ts').subsetsFitting }).subsetsFitting!;
    let withFit = 0; let unique = 0;
    for (let c = 0; c < 16; c++) {
      const n = 17 + (c % 2);
      const pool = [1000, 1500, 2000, 2500, 777, 4321];
      const avail = Array.from({ length: n }, (_, i): [string, number] => [`s${i}`, rnd() < 0.6 ? pool[Math.floor(rnd() * pool.length)]! : Math.round(rnd() * 20000 + 100)]);
      const pick = (): number => avail[Math.floor(rnd() * n)]![1];
      const target = rnd() < 0.75 ? pick() + pick() + (rnd() < 0.4 ? pick() : 0) + (rnd() < 0.3 ? 0.5 : 0) : Math.round(rnd() * 40000);
      for (const minSize of [1, 2]) {
        const want = oracle(avail, target, minSize);
        const got = subsetsFitting(avail, target, minSize, same);
        assert.equal([...got.chosen].sort().join(','), want.chosen, `case ${c} minSize ${minSize} target ${target}`);
        assert.equal(got.ambiguous, want.ambiguous, `case ${c} minSize ${minSize} ambiguous`);
        if (want.chosen) withFit++;
        if (want.chosen && !want.ambiguous) unique++;
      }
    }
    // The cases exercise both answers (a fit and none) as well as a unique fit.
    assert.ok(withFit > 4 && withFit < 32 && unique > 0, `${withFit} with a fit, ${unique} unique`);
  });

  test('round 2c L2: at the successor reset the rounding left in the ledger is cleared, so no dust lot is computed', () => {
    // Contra (100 u at 100) merged into Small Cap on 10 Nov 2023 (15,000 at 150 = 100 u, a one-into-one candidate). Small
    // Cap redeemed 1 Jun 2024 for 16,000 at 160.0000333: 99.9999792 u, leaving 0.0000208 u, within UNITS_TOLERANCE, so the
    // successor mark ends (a gap lot). A fresh Purchase 1 Jan 2025 of 50 u at 200 and its Redemption 1 Jun 2025 of 50 u at
    // 220 (11,000): one lot of 50 u, realised 1,000, bought 1 Jan 2025. Before round 3 the 0.0000208 u of the switch in
    // (at 150) were sold first: a dust lot of about Rs 0.0015, computed, beside a lot of 49.9999792 u.
    const r = run([
      flow(A, X, [2019, 7, 1], 'Purchase', 100, -10000), flow(A, X, M, 'Switch Out', 150, 15000),
      flow(A, B, M, 'Switch In', 150, -15000), flow(A, B, [2024, 6, 1], 'Redemption', 16000 / 99.9999792, 16000),
      flow(A, B, [2025, 1, 1], 'Purchase', 200, -10000), flow(A, B, [2025, 6, 1], 'Redemption', 220, 11000),
    ]);
    const nb = lotsOf(r, B);
    assert.deepEqual(nb.map((x) => [x.gap, x.mergerCandidate?.role ?? null]), [['merger-candidate', 'successor'], [null, null]]);
    near(v(nb[1]!.units), 50, 'units'); near(v(nb[1]!.realised), 1000, 'realised');
    assert.equal(v(nb[1]!.purchaseDate), day(2025, 1, 1));
  });
});
