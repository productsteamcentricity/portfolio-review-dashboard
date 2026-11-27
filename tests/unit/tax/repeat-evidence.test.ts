// covers: E-150 D-036 (the evidence check on units for repeated sale events; design capital-gains-upload.md §6; the
// owner's addition to PD-16 item 5, 26 Nov 2026; PLAN-03 addendum, sprint S2b)
// app/src/engine/tax/repeat-evidence.ts on synthetic statements read by the real reader (tests/fixtures/make-cg-tax-lots.ts)
// and synthetic transactions files and holdings built here. Expected units and texts are worked by hand from the rows:
// the repeated sale is two lots, X (100 units) and Y (50 units), each written twice, sold on 12 Mar 2025 at 80, so the
// sale gives 150 units counted once and 300 as stated.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { repeatEvidence, roundUnits, unitsEqual, normaliseFolio } from '../../../app/src/engine/tax/repeat-evidence.ts';
import type { RepeatEvidence } from '../../../app/src/engine/tax/repeat-evidence.ts';
import type { CgImport } from '../../../app/src/ingest/capital-gains.ts';
import { hasPanShape } from '../../../app/src/ingest/capital-gains.ts';
import type { IrrFileImport, Transaction, TransactionKind } from '../../../app/src/model/transactions.ts';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { AccountId, ClientId, HoldingId, SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { parseLots } from '../../fixtures/make-cg-tax-lots.ts';
import { CLIENT_A } from '../../fixtures/make-cg-statements.ts';
import type { LotSpec, Ymd } from '../../fixtures/make-cg-statements.ts';

const day = (y: number, m: number, d: number): number => ymdToDay(y, m, d)!;
const AS_ON = day(2026, 9, 30);
const IRR_SRC = 'e'.repeat(64) as SourceFileId;
const BASE_SRC = 'f'.repeat(64) as SourceFileId;
const PROV = { sources: [IRR_SRC], method: 'test value' };
const SCHEME = 'Sample Flexi Cap Fund - Regular Plan - Growth Option';
/** The transactions file spells the scheme its own way; the matcher joins it (D9). */
const IRR_SCHEME = 'SAMPLE FLEXI CAP FUND REGULAR PLAN GROWTH OPTION';
const FOLIO = '91000001';
const SALE: Ymd = [2025, 3, 12];

const X: LotSpec = { client: CLIENT_A, dist: 'Sample Distributor 1', scheme: SCHEME, asset: 'Equity', category: 'Flexi Cap Fund', folio: FOLIO, buy: [2022, 1, 10], sell: SALE, units: 100, buyNav: 50, sellNav: 80 };
const Y: LotSpec = { ...X, buy: [2022, 2, 10], units: 50 };

/** The statement: the sale X, Y written twice (wholly repeated), plus any extra lots. */
function statement(extra: LotSpec[] = [], answers: Parameters<typeof parseLots>[1] = {}): CgImport {
  return parseLots([X, Y, X, Y, ...extra], answers);
}

type Row = { kind: TransactionKind; on: Ymd; amount: number; price: number | null; folio?: string | null; name?: string; client?: string };
/** A transactions-file row of the fund sheet. The client id differs from the review's, so the join is by label. */
function tx(r: Row, i: number): Transaction {
  const out = ['redemption', 'swp', 'switch-out', 'stp-out', 'transfer-out'].includes(r.kind);
  return {
    side: 'fund', at: { sourceId: IRR_SRC, sheet: 'Xirr', row: i + 2 }, clientLabel: r.client ?? CLIENT_A, clientId: 'cl_irr_a' as ClientId,
    accountLabel: null, instrumentName: r.name ?? IRR_SCHEME, instrument: null, folio: r.folio === undefined ? FOLIO : r.folio, folioId: null,
    assetLabel: 'Equity', productLabel: 'Mutual Funds', categoryLabel: null, benchmarkLabel: null, distributorLabel: null, distributorId: null,
    day: day(...r.on), dayForm: 'excel-serial', amountRupees: out ? r.amount : -r.amount,
    price: r.price === null ? missing(STATUS.NOT_AVAILABLE, 'no price in the row') : present(r.price, 'inr-per-unit', PROV),
    typeLabel: r.kind, rowTypeLabel: null, kind: r.kind, direction: out ? 'out' : 'in',
  };
}
function irrOf(rows: Row[]): IrrFileImport {
  const fund = rows.map(tx);
  return {
    parserVersion: 'irr-file@1', sourceId: IRR_SRC, fundSheet: null, benchSheet: null, sheets: [], fund, bench: [], skipped: [],
    unrecognisedTypes: [], hasDistributor: false, asOn: missing(STATUS.NOT_AVAILABLE, 'test'), issues: [], audit: [],
    counts: {
      dataRows: { fund: fund.length, bench: 0 }, flows: { fund: fund.length, bench: 0 },
      skipped: { 'blank-row': 0, 'repeated-header': 0, 'no-client': 0, 'no-amount': 0, 'invalid-amount': 0, 'unreadable-date': 0 }, unassigned: fund.length,
    },
  };
}
/** A base-file holding of Sample Client A in the scheme (units null: the base file gives none). */
function holding(units: number | null, folios: string[] = [FOLIO], name = 'Sample Flexi Cap Fund Regular Plan Growth Option'): Holding {
  const prov = { sources: [BASE_SRC], method: 'test value' };
  const na = missing(STATUS.NOT_AVAILABLE, 'test');
  return {
    id: 'h_test' as HoldingId, sourceId: BASE_SRC, rows: [{ sourceId: BASE_SRC, sheet: 'Base', row: 2 }], instrumentName: name, instrument: null,
    clientLabel: CLIENT_A, clientId: 'cl_base_a' as ClientId, distributorLabel: null, distributorId: null, accountId: 'ac_test' as AccountId,
    productLabel: 'Mutual Funds', product: 'Mutual Funds', productDefaulted: false, categoryLabel: null, assetLabel: 'Equity', assetClass: 'Equity',
    amcLabel: null, liquidity: null, folios, folioIds: [], purchaseDate: na,
    units: units === null ? na : present(units, 'units', prov), invested: na, cmv: present(0.01, 'cr', prov), fileGain: na, xirr: na, bmXirr: na,
    holdingDays: na, mergeGaps: [], inclusion: { status: 'included' },
  };
}

// The transactions file's purchases: X (100 units at 50), Y (50 units at 50) and a later 25 units at 80: 175 bought.
const BUYS: Row[] = [
  { kind: 'purchase', on: [2022, 1, 10], amount: 5000, price: 50 },
  { kind: 'sip', on: [2022, 2, 10], amount: 2500, price: 50 },
  { kind: 'purchase', on: [2023, 5, 5], amount: 2000, price: 80 },
];
/** The redemption on the sale date: `units` at 80. */
const redemption = (units: number, extra: Partial<Row> = {}): Row => ({ kind: 'redemption', on: SALE, amount: units * 80, price: 80, ...extra });

/** Every text produced in this file, for the scan at the end. */
const TEXTS: string[] = [];
function run(cg: CgImport, irr: IrrFileImport | null, holdings: Holding[]): RepeatEvidence {
  const out = repeatEvidence(cg, irr, holdings, AS_ON);
  assert.equal(out.length, cg.events.length);
  for (const r of out) TEXTS.push(r.text);
  return out[0]!;
}

describe('the readings and the units equality', () => {
  test('the repeated sale: 150 units counted once, 300 as stated', () => {
    const cg = statement();
    assert.equal(cg.events.length, 1);
    assert.equal(cg.events[0]!.wholly, true);
    const r = run(cg, null, []);
    assert.deepEqual(r.readings, { once: 150, asStated: 300 });
  });
  test('3 decimals, half away from zero: 0.0004 apart is equal, 0.0006 apart is not', () => {
    assert.equal(unitsEqual(150, 150.0004), true);
    assert.equal(unitsEqual(150, 150.0006), false);
    assert.equal(roundUnits(0.0005), 0.001);
    assert.equal(roundUnits(-0.0005), -0.001);
    assert.equal(roundUnits(25.1234), 25.123);
    assert.equal(normaliseFolio(' 9100 0001 '), FOLIO);
  });
});

describe('Evidence 1, the transactions file', () => {
  test('once supported by a redemption: the addendum\'s text', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150)]), []);
    assert.equal(r.evidence.length, 1);
    assert.deepEqual([r.evidence[0]!.source, r.evidence[0]!.supports], ['transactions', 'once']);
    assert.deepEqual(r.missing, [{ source: 'holding', reason: 'no-holding' }]);
    assert.equal(r.suggested, 'once');
    assert.equal(r.text, 'The transactions file shows 150.000 units redeemed on 12 Mar 2025 for this scheme. The statement\'s rows give 150.000 units counted once and 300.000 as stated. Suggested: count once. Please confirm.');
  });
  test('as stated supported by a redemption of 300 units', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(300)]), []);
    assert.equal(r.suggested, 'as-stated');
    assert.ok(r.text.endsWith('Suggested: count as stated. Please confirm.'), r.text);
  });
  test('the 3-decimal edge on the redemption: 150.0004 units supports once, 150.0006 units matches neither', () => {
    const near = run(statement(), irrOf([...BUYS, redemption(150.0004)]), []);
    assert.equal(near.suggested, 'once');
    const far = run(statement(), irrOf([...BUYS, redemption(150.0006)]), []);
    assert.equal(far.suggested, null);
    assert.equal(far.evidence[0]!.supports, 'neither');
  });
  test('a redemption that matches neither reading: no suggestion, both readings shown', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(140)]), []);
    assert.equal(r.suggested, null);
    assert.equal(r.text, 'The evidence matches neither reading. The transactions file shows 140.000 units redeemed on 12 Mar 2025 for this scheme. The statement\'s rows give 150.000 units counted once and 300.000 as stated. Please decide: the rows can be genuine lots.');
  });
  test('a priceless redemption gives no units figure and no evidence', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150, { price: null })]), []);
    assert.deepEqual(r.evidence, []);
    assert.deepEqual(r.missing.map((m) => m.reason), ['no-price-on-redemption', 'no-holding']);
    assert.ok(r.text.includes('no price on the redemption'), r.text);
    assert.equal(r.suggested, null);
  });
  test('folio: another folio is not matched; a row without a folio matches on the scheme alone, said in the text', () => {
    const other = run(statement(), irrOf([...BUYS, redemption(150, { folio: '91000777' })]), []);
    assert.deepEqual(other.missing[0], { source: 'transactions', reason: 'no-matching-redemption' });
    const bare = run(statement(), irrOf([...BUYS, redemption(150, { folio: null })]), []);
    assert.equal(bare.suggested, 'once');
    assert.ok(bare.text.includes('matched on the scheme alone, without a folio'), bare.text);
  });
  test('another client\'s redemption, or another scheme\'s, is not evidence', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150, { client: 'Sample Client B' }), redemption(150, { name: 'Sample Liquid Fund Regular Growth' })]), []);
    assert.deepEqual(r.missing[0], { source: 'transactions', reason: 'no-matching-redemption' });
  });
});

describe('Evidence 2, the holding report', () => {
  test('once supported by the balance alone (no redemption row): the addendum\'s text', () => {
    // 175 bought, 150 sold counted once: 25 left, the 25 held. As stated: 175 less 300 leaves minus 125.
    const r = run(statement(), irrOf(BUYS), [holding(25)]);
    assert.deepEqual(r.missing, [{ source: 'transactions', reason: 'no-matching-redemption' }]);
    assert.equal(r.evidence.length, 1);
    const e = r.evidence[0]!;
    assert.ok(e.source === 'holding');
    if (e.source === 'holding') {
      assert.ok(Math.abs(e.bought - 175) < 1e-9);
      assert.deepEqual(e.sold, { once: 150, asStated: 300 });
      assert.equal(e.held, 25);
      assert.equal(e.byFolio, true);
    }
    assert.equal(r.suggested, 'once');
    assert.equal(r.text, 'Units bought less units sold leave 25.000 units, matching the 25.000 units held in the base file, when the rows are counted once. Suggested: count once. Please confirm.');
  });
  test('both pieces support once: suggested once, both shown', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150)]), [holding(25)]);
    assert.deepEqual(r.evidence.map((e) => e.supports), ['once', 'once']);
    assert.equal(r.suggested, 'once');
    assert.ok(r.text.startsWith('The transactions file shows 150.000 units') && r.text.includes('Units bought less units sold leave 25.000 units'), r.text);
  });
  test('as stated supported by both pieces', () => {
    // 325 bought (150 more units at 80), 300 sold as stated: 25 left, the 25 held.
    const r = run(statement(), irrOf([...BUYS, { kind: 'purchase', on: [2023, 6, 6], amount: 12000, price: 80 }, redemption(300)]), [holding(25)]);
    assert.deepEqual(r.evidence.map((e) => e.supports), ['as-stated', 'as-stated']);
    assert.equal(r.suggested, 'as-stated');
    assert.ok(r.text.includes('when the rows are counted as stated. Suggested: count as stated. Please confirm.'), r.text);
  });
  test('two pieces that conflict: no suggestion, both shown', () => {
    // The redemption shows 150 (once); 325 bought less 300 as stated leaves the 25 held (as stated).
    const r = run(statement(), irrOf([...BUYS, { kind: 'purchase', on: [2023, 6, 6], amount: 12000, price: 80 }, redemption(150)]), [holding(25)]);
    assert.deepEqual(r.evidence.map((e) => e.supports), ['once', 'as-stated']);
    assert.equal(r.suggested, null);
    assert.ok(r.text.startsWith('The evidence does not agree: the transactions file supports counting once; the holding balance supports as stated.'), r.text);
    assert.ok(r.text.endsWith('Please decide.'), r.text);
  });
  test('redemptions on days without a statement sale count as units sold', () => {
    // 200 bought; 25 redeemed on another day (no statement row); 150 once: 25 left, the 25 held.
    const r = run(statement(), irrOf([...BUYS, { kind: 'purchase', on: [2023, 6, 6], amount: 2000, price: 80 }, { kind: 'swp', on: [2024, 1, 15], amount: 2500, price: 100 }]), [holding(25)]);
    assert.equal(r.suggested, 'once');
  });
  test('the balance needs both files; a holding without units, or another repeated sale still open, gives none', () => {
    const baseOnly = run(statement(), null, [holding(25)]);
    assert.deepEqual(baseOnly.missing, [{ source: 'transactions', reason: 'no-transactions-file' }, { source: 'holding', reason: 'no-transactions-file' }]);
    assert.equal(baseOnly.text, 'No units evidence for this sale (no transactions file). Please decide: the rows can be genuine lots.');
    const noUnits = run(statement(), irrOf(BUYS), [holding(null)]);
    assert.deepEqual(noUnits.missing.map((m) => m.reason), ['no-matching-redemption', 'no-holding-units']);
    // A second repeated sale of the scheme and folio (Z twice, on 15 Jan 2024), unanswered: the balance of either is unknown.
    const Z: LotSpec = { ...X, buy: [2022, 3, 1], sell: [2024, 1, 15], units: 10 };
    const open = run(statement([Z, Z]), irrOf(BUYS), [holding(25)]);
    assert.deepEqual(open.missing.map((m) => m.reason), ['no-matching-redemption', 'other-repeats-open']);
    // Answered once, Z counts 10: 175 less 150 less 10 leaves 15, so a holding of 15 supports once.
    const cg = statement([Z, Z]);
    const zEvent = cg.events.find((e) => e.lots.includes(4))!.id;
    const answered = repeatEvidence(statement([Z, Z], { repeatAnswers: { byEvent: { [zEvent]: 'once' } } }), irrOf(BUYS), [holding(15)], AS_ON);
    const mine = answered.find((r) => r.eventId === cg.events.find((e) => e.lots.includes(0))!.id)!;
    TEXTS.push(mine.text);
    assert.equal(mine.suggested, 'once');
  });
});

describe('no evidence: each of the four reasons, and never an answer', () => {
  test('no transactions file', () => {
    const r = run(statement(), null, []);
    assert.deepEqual(r.evidence, []);
    assert.ok(r.text.includes('(no transactions file)'), r.text);
  });
  test('no matching redemption in the transactions file', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150, { on: [2025, 3, 13] })]), []);
    assert.deepEqual(r.missing[0], { source: 'transactions', reason: 'no-matching-redemption' });
    assert.equal(r.text, 'No units evidence for this sale (no matching redemption in the transactions file; no holding for this scheme and folio). Please decide: the rows can be genuine lots.');
  });
  test('no price on the redemption', () => {
    const r = run(statement(), irrOf([...BUYS, redemption(150, { price: null })]), []);
    assert.ok(r.text.includes('no price on the redemption'), r.text);
  });
  test('no holding for this scheme and folio (another folio held)', () => {
    const r = run(statement(), irrOf(BUYS), [holding(25, ['91000999'])]);
    assert.deepEqual(r.missing, [{ source: 'transactions', reason: 'no-matching-redemption' }, { source: 'holding', reason: 'no-holding' }]);
    assert.ok(r.text.includes('no holding for this scheme and folio'), r.text);
    assert.equal(r.suggested, null);
  });
  test('a suggestion is never an answer: the import record is unchanged, its question and INSUFFICIENT EVIDENCE stay', () => {
    const cg = statement();
    const before = JSON.stringify(cg);
    const r = repeatEvidence(cg, irrOf([...BUYS, redemption(150)]), [holding(25)], AS_ON);
    assert.equal(r[0]!.suggested, 'once');
    assert.equal(JSON.stringify(cg), before);
    assert.equal(cg.questions.length, 1);
    assert.deepEqual(cg.insufficientYears, ['FY 2024-25']);
    assert.ok(cg.events.every((e) => e.answer === null) && cg.lots.every((l) => !l.excludedAsRepeat));
  });
});

describe('texts (§11 conventions)', () => {
  test('never a folio, an amount or a PAN; no en or em dash', () => {
    assert.ok(TEXTS.length >= 20, String(TEXTS.length));
    for (const t of TEXTS) {
      assert.ok(!/9100\d{4}/.test(t), t);
      // The rupee amounts of the rows: 5000, 2500, 2000, 12000, 24000, 8000, 4000 (sell), 11200 and the like; units
      // are written with three decimals, so a bare whole number of four or more digits is an amount.
      assert.ok(!/\b\d{4,}\b(?!\.\d{3})/.test(t.replace(/\b(19|20)\d{2}\b/g, '')), t);
      assert.ok(!/Rs\.?\s?\d|₹/.test(t), t);
      assert.equal(hasPanShape(t), false, t);
      assert.ok(!new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(t), t);
    }
  });
});
