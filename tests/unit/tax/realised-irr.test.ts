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
