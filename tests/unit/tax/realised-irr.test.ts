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
import type { DerivedLot, DerivedRealised, DeriveOptions } from '../../../app/src/engine/tax/realised-irr.ts';
import { consumeFifo } from '../../../app/src/engine/tax/lots.ts';
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

  test('B1: a sale reaching a transfer in lot is a gap; the earlier purchase is still computed', () => {
    // Purchase 1 Apr 2023 50 u at 100 (5,000); Transfer In 1 Jun 2024 12,000 at 120 = 100 u (dated and valued by the
    // transfer, not the original purchase: cost and date not known). Redemption 1 Aug 2025 13,500 at 150 = 90 u: 50 u of
    // the purchase (cost 5,000, sale 13,500 x 50/90 = 7,500, realised 2,500, long), then 40 u reach the transfer lot: a
    // gap 'transfer-row' (40 u, sale 6,000), purchase date and cost missing (the old code took cost 4,800, date 1 Jun
    // 2024: realised 1,200, short). A later redemption (1 Sep 2025, 10 u) is 'after-earlier-gap'.
    const r = run([
      flow(A, SCHEME.MID, [2023, 4, 1], 'Purchase', 100, -5000),
      flow(A, SCHEME.MID, [2024, 6, 1], 'Transfer In', 120, -12000),
      flow(A, SCHEME.MID, [2025, 8, 1], 'Redemption', 150, 13500),
      flow(A, SCHEME.MID, [2025, 9, 1], 'Redemption', 150, 1500),
    ], [hold(A, SCHEME.MID, 'Mid Cap Fund', 50, 5000, 7500)]);
    const l = lotsOf(r, SCHEME.MID);
    assert.deepEqual(l.map((x) => x.gap), [null, 'transfer-row', 'after-earlier-gap']);
    near(v(l[0]!.realised), 2500, 'purchase part');
    assert.equal(termOf(l[0]!), 'long');
    near(v(l[1]!.units), 40, 'gap units'); near(v(l[1]!.saleValue), 6000, 'gap sale value');
    assert.equal(l[1]!.buyKind, 'transfer-in');
    assert.equal(l[1]!.purchaseDate.kind, 'missing');
    assert.equal(l[1]!.purchasePrice.kind, 'missing');
    assert.equal(l[1]!.purchaseValue.kind, 'missing');
    const sy = r.schemeYears[0]!;
    near(v(sy.realised), 2500, 'PARTIAL');
    assert.ok(sy.realised.kind === 'value' && Math.abs(sy.realised.coverage! - 1 / 3) < 1e-9);
  });

  test('B1: stock in and demerger in are lots not known too; a sale met by earlier known lots stays computed', () => {
    // Purchase 1 Jan 2024 100 u at 100; Stock In 1 Feb 2024 50 u at 110; Demerger In 1 Mar 2024 20 u at 10. Redemption
    // 1 Jun 2025 7,200 at 120 = 60 u: all from the purchase (cost 6,000, realised 1,200): computed, no gap. Redemption
    // 1 Jul 2025 6,000 at 120 = 50 u: 40 u left of the purchase (cost 4,000, sale 4,800, realised 800), then 10 u reach
    // the stock in lot: 'transfer-row'.
    const r = run([
      flow(B, SCHEME.FOCUSED, [2024, 1, 1], 'Purchase', 100, -10000),
      flow(B, SCHEME.FOCUSED, [2024, 2, 1], 'Stock In', 110, -5500),
      flow(B, SCHEME.FOCUSED, [2024, 3, 1], 'Demerger In', 10, -200),
      flow(B, SCHEME.FOCUSED, [2025, 6, 1], 'Redemption', 120, 7200),
      flow(B, SCHEME.FOCUSED, [2025, 7, 1], 'Redemption', 120, 6000),
    ]);
    const l = lotsOf(r, SCHEME.FOCUSED);
    assert.deepEqual(l.map((x) => x.gap), [null, null, 'transfer-row']);
    near(v(l[0]!.realised), 1200, 'first sale'); near(v(l[1]!.realised), 800, 'second sale, known part');
    assert.equal(l[2]!.buyKind, 'stock-in');
    near(v(l[2]!.units), 10, 'gap units');
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
