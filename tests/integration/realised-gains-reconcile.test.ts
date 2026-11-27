// covers: E-141 AC-18 E-42 Q-49
// The realised gains of the capital-gains statement reconciled with those derived from the IRR file, per scheme and
// financial year (app/src/engine/tax/reconcile.ts, NB-M7a S5; architecture §6.7; design capital-gains-upload.md §4, §8).
// End to end: `cg-statement-mismatch` and `irr-realised` (tests/fixtures/make-realised-reconcile.ts, standing in for
// the matrix's `irr-a`, which M3 has not built) are written as workbooks, read by the real readers, run through the
// statement engine (realiseLots) and the derivation (deriveRealisedGains), then reconciled. Every figure is worked by
// hand in the comments (the fixture file holds the FIFO working of each redemption). Money in rupees.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyTaxInputs, realiseLots } from '../../app/src/engine/tax/realised.ts';
import { deriveRealisedGains } from '../../app/src/engine/tax/realised-irr.ts';
import type { DerivedRealised } from '../../app/src/engine/tax/realised-irr.ts';
import {
  MIXED_SOURCE, OUTSIDE_REVIEW_REASON, TOLERANCE_RULE, realisedForYear, reconcileRealised, reconcileTolerance,
} from '../../app/src/engine/tax/reconcile.ts';
import type { ReconcileRow, RealisedReconciliation, StatementSide } from '../../app/src/engine/tax/reconcile.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { STATUS } from '../../app/src/model/status.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import type { Value } from '../../app/src/model/value.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { bookBytes } from '../fixtures/make-books.ts';
import { AS_ON_DAY, NOW, parseLots } from '../fixtures/make-cg-tax-lots.ts';
import { CLIENT_A } from '../fixtures/make-cg-statements.ts';
import { SCHEME, flow, irrImport, irrRealisedRows, mismatchStatementLots } from '../fixtures/make-realised-reconcile.ts';

const xlsx = loadSheetJS();
/** An en or em dash (built from code points, so this file holds none, D-029). */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

function statementOf(opts: Parameters<typeof mismatchStatementLots>[0] = {}): StatementSide {
  const imp = parseLots(mismatchStatementLots(opts), {}, xlsx);
  const realised = realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW });
  return { imp, realised };
}
function derivedOf(): DerivedRealised {
  return deriveRealisedGains(irrImport(irrRealisedRows(), xlsx).fund, { asOn: AS_ON_DAY });
}

const v = (x: Value<number> | null | undefined): number | null => (x && x.kind === 'value' ? x.v : null);
const near = (a: number | null | undefined, b: number, msg = ''): void => {
  assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= 0.01, `${msg}: ${a} != ${b}`);
};
const rowOf = (r: RealisedReconciliation, fy: number, scheme: string): ReconcileRow => {
  const hits = r.rows.filter((x) => x.fy === fy && (x.instrumentName === scheme || x.schemeLabels.includes(scheme)));
  assert.equal(hits.length, 1, `${scheme} FY ${fy}: ${hits.length} rows`);
  return hits[0]!;
};

describe('cg-statement-mismatch against irr-realised (AC-18: High on disagreement, both figures shown)', () => {
  const st = statementOf();
  const der = derivedOf();
  const rec = reconcileRealised(der, st);

  test('a scheme-year within tolerance is reconciled', () => {
    // Bluechip FY 2024-25: statement 3,200.50 + 140 = 3,340.50 (Sell Amount 13,200.50 on lot 0); derived 3,200 + 140 =
    // 3,340. Difference 0.50. Tolerance: the larger of Rs 1 or 0.01% of the larger sale value (15,840.50 x 0.0001 =
    // 1.58405) and Rs 1 + 0.005 x 2 rows = 1.01: 1.58405. 0.50 <= 1.58405: reconciled.
    const r = rowOf(rec, 2024, SCHEME.BLUE);
    assert.equal(r.outcome, 'reconciled');
    near(v(r.statement!.realised), 3340.5, 'statement');
    near(v(r.derived!.realised), 3340, 'derived');
    near(r.difference, 0.5, 'difference');
    near(r.tolerance, 1.58405, 'tolerance');
    assert.ok(Math.abs(reconcileTolerance(15840.5, 15840, 2) - 1.58405) < 1e-9);
  });

  test('a scheme-year beyond tolerance differs: High, both figures kept', () => {
    // Flexi Cap FY 2025-26: statement 50 u sold at 84 = 4,200 less 2,500 = 1,700; derived 4,000 less 2,500 = 1,500.
    // Difference 200; tolerance max(max(1, 4,200 x 0.0001 = 0.42), 1 + 0.005 x 1 = 1.005) = 1.005: differs.
    const r = rowOf(rec, 2025, SCHEME.FLEXI);
    assert.equal(r.outcome, 'differs');
    near(v(r.statement!.realised), 1700, 'statement kept');
    near(v(r.derived!.realised), 1500, 'derived kept');
    near(r.difference, 200, 'difference');
    near(r.tolerance, 1.005, 'tolerance');
    const hi = rec.issues.filter((i) => i.ruleId === 'tax.realised-differs');
    assert.equal(hi.length, 1);
    assert.equal(hi[0]!.severity, 'High');
    assert.equal(hi[0]!.count, 1);
    assert.match(hi[0]!.message, /1 scheme in FY 2025-26 \(1 scheme-year\)\. Both figures are shown/);
    assert.doesNotMatch(hi[0]!.message, /1,?700|1,?500|200|Flexi|Sample|9160/);
  });

  test('the non-taxable merger is left out of the realised side, on both sides', () => {
    // Contra FY 2023-24: the statement's merger row (realised 15,000 - 10,000 = 5,000) is a non-taxable transfer with
    // no successor-reset lot: realisedCounted 0. The IRR file's switch out of the same day (derived 5,000) is the same
    // merger: left out too. 0 against 0: reconciled, one lot left out on each side.
    const r = rowOf(rec, 2023, SCHEME.OLD);
    const g = st.realised.gains.find((x) => x.schemeLabel === SCHEME.OLD)!;
    assert.equal(g.lotClass, 'non-taxable-transfer');
    near(v(g.realised), 5000, 'economic gain'); near(v(g.realisedCounted), 0, 'counted');
    const d = der.lots.find((x) => x.instrumentName === SCHEME.OLD)!;
    near(v(d.realised), 5000, 'derived lot before the merger rule');
    assert.equal(r.outcome, 'reconciled');
    assert.equal(r.statement!.nonTaxableLeftOut, 1);
    assert.equal(r.derived!.nonTaxableLeftOut, 1);
    near(v(r.statement!.realised), 0, 'statement side');
    near(v(r.derived!.realised), 0, 'derived side');
  });

  test('statement-only and IRR-only schemes are listed', () => {
    // Value (A, FY 2024-25) only in the statement; Focused (A, FY 2025-26) and Midcap (B, FY 2025-26) only in the IRR
    // file (Small Cap has a switch in and no sale: no row). Rows: Contra, Bluechip, Value, Flexi Cap, Focused, Midcap.
    assert.equal(rowOf(rec, 2024, SCHEME.VALUE).outcome, 'statement-only');
    assert.equal(rowOf(rec, 2025, SCHEME.FOCUSED).outcome, 'irr-only');
    assert.equal(rowOf(rec, 2025, SCHEME.MID).outcome, 'irr-only');
    assert.deepEqual(rec.statementOnly.map((s) => [s.schemeLabels, s.instrumentName, s.years]), [[[SCHEME.VALUE], null, ['FY 2024-25']]]);
    assert.deepEqual(rec.irrOnly.map((s) => s.instrumentName).sort(), [SCHEME.FOCUSED, SCHEME.MID].sort());
    assert.deepEqual(rec.counts, { reconciled: 2, differs: 1, 'insufficient-evidence': 0, 'not-reconciled': 0, 'statement-only': 1, 'irr-only': 2 });
    const one = rec.issues.find((i) => i.ruleId === 'tax.realised-one-side')!;
    assert.equal(one.severity, 'Information');
    assert.match(one.message, /1 scheme only in the capital-gains statement and 2 schemes only in the IRR file/);
    const ok = rec.issues.find((i) => i.ruleId === 'tax.realised-reconciled')!;
    assert.match(ok.message, /2 scheme-years in FY 2023-24 and FY 2024-25/);
    assert.equal(rec.toleranceRule, TOLERANCE_RULE);
  });

  test('the statement client joins the IRR client by label (review ids differ from the IRR ids)', () => {
    // The statement's review id for "Sample Client A" is cl_review_a (the test review); the IRR reader's id is a hash
    // of the label. The bridge joins them by the label as spelt, so the rows carry the IRR client.
    const irrA = der.instruments.find((x) => x.instrumentName === SCHEME.BLUE)!.clientId;
    assert.equal(rowOf(rec, 2024, SCHEME.BLUE).clientId, irrA);
    assert.notEqual(irrA, 'cl_review_a');
  });

  test('every message is plain: no en or em dash, no amount of a lot', () => {
    for (const i of rec.issues) {
      assert.doesNotMatch(i.message, /Sample Client|9160\d{4}/);
      assert.ok(!DASH.test(i.message));
      assert.equal(i.decision, 'E-141');
      assert.equal(i.blocksPublication, false);
    }
  });
});

describe('agreement, INSUFFICIENT EVIDENCE and a label matched by the instrument matcher', () => {
  test('the unaltered statement reconciles everywhere both sides hold the scheme-year', () => {
    // Flexi Cap put back to 80: 1,500 against 1,500. No High result.
    const rec = reconcileRealised(derivedOf(), statementOf({ flexiSellNav: 80 }));
    assert.equal(rowOf(rec, 2025, SCHEME.FLEXI).outcome, 'reconciled');
    assert.equal(rec.counts.differs, 0);
    assert.ok(!rec.issues.some((i) => i.ruleId === 'tax.realised-differs'));
  });

  test('a year INSUFFICIENT EVIDENCE in the statement is not reconciled', () => {
    // Bluechip lot 1 written twice, exactly, and not answered: FY 2024-25 is INSUFFICIENT EVIDENCE (design §6). Its
    // scheme-years (Bluechip, Value) are not reconciled, whatever the figures; the other years are unchanged.
    const st = statementOf({ repeatBlue: true });
    assert.deepEqual(st.imp.insufficientYears, ['FY 2024-25']);
    const rec = reconcileRealised(derivedOf(), st);
    assert.equal(rowOf(rec, 2024, SCHEME.BLUE).outcome, 'insufficient-evidence');
    assert.equal(rowOf(rec, 2024, SCHEME.BLUE).difference, null);
    assert.equal(rowOf(rec, 2024, SCHEME.VALUE).outcome, 'insufficient-evidence');
    assert.equal(rowOf(rec, 2025, SCHEME.FLEXI).outcome, 'differs');
    const w = rec.issues.find((i) => i.ruleId === 'tax.realised-not-reconciled')!;
    assert.equal(w.severity, 'Warning');
    assert.match(w.message, /2 scheme-years of FY 2024-25, INSUFFICIENT EVIDENCE/);
    // The review's figure for the year is INSUFFICIENT EVIDENCE, never the derived one in its place.
    const fy = realisedForYear(2024, derivedOf(), st);
    assert.equal(fy.source, 'statement');
    assert.equal(fy.total.kind === 'missing' ? fy.total.status : '', STATUS.INSUFFICIENT_EVIDENCE);
  });

  test('a statement scheme label is matched to the IRR instrument by the matcher, not by equality', () => {
    // "Sample Flexi Cap Fund - Growth" (statement) against "Sample Flexi Cap Fund - Regular Plan - Growth" (IRR): a
    // contained shorter name sharing its tokens: matched, so the pair compares 1,700 against 1,500 as before.
    const rec = reconcileRealised(derivedOf(), statementOf({ flexiLabel: 'Sample Flexi Cap Fund - Growth' }));
    const r = rowOf(rec, 2025, SCHEME.FLEXI);
    assert.deepEqual(r.schemeLabels, ['Sample Flexi Cap Fund - Growth']);
    assert.equal(r.instrumentName, SCHEME.FLEXI);
    assert.equal(r.outcome, 'differs');
  });
});

describe('the successor of a non-taxable merger (design §4, KA-15)', () => {
  const derivedNew = (): DerivedRealised => deriveRealisedGains(irrImport(irrRealisedRows({ sellNew: true }), xlsx).fund, { asOn: AS_ON_DAY });

  test('successor-reset: the merger keeps its gain on both sides, the successor reconciles', () => {
    // Statement: the Small Cap lot bought on the merger day (10 Nov 2023) at 150 is successor-reset, so the Contra
    // merger row keeps its 5,000 (keptShare 1). The IRR file's Contra switch out (5,000) is kept at the same share:
    // 5,000 against 5,000. Small Cap Tax year 2026-27: statement 18,000 - 15,000 = 3,000; derived 18,000 - 15,000 (the
    // switch in at 150) = 3,000: reconciled, the derived lot named as a merger successor.
    const rec = reconcileRealised(derivedNew(), statementOf({ sellNew: 'reset' }));
    const old = rowOf(rec, 2023, SCHEME.OLD);
    assert.equal(old.outcome, 'reconciled');
    near(v(old.statement!.realised), 5000, 'statement merger kept');
    near(v(old.derived!.realised), 5000, 'derived merger kept');
    const nw = rowOf(rec, 2026, SCHEME.NEW);
    assert.equal(nw.fyLabel, 'Tax year 2026-27');
    assert.equal(nw.outcome, 'reconciled');
    near(v(nw.statement!.realised), 3000, 'statement'); near(v(nw.derived!.realised), 3000, 'derived');
    assert.equal(nw.mergerSuccessorLots, 1);
  });

  test('original cost carried: the successor differs by the merger gain and the High result names it', () => {
    // Statement: the Small Cap lot carries the original date and cost (1 Jul 2019, 100): 18,000 - 10,000 = 8,000; the
    // merger row's 5,000 is left out (counted once, KA-15). Derived: 18,000 - 15,000 = 3,000. Difference 5,000, the
    // merger's gain: differs (not adjusted in S5), the row and the message name the merger successor.
    const rec = reconcileRealised(derivedNew(), statementOf({ sellNew: 'carried' }));
    const nw = rowOf(rec, 2026, SCHEME.NEW);
    assert.equal(nw.outcome, 'differs');
    near(nw.difference, 5000, 'difference');
    assert.equal(nw.mergerSuccessorLots, 1);
    const hi = rec.issues.find((i) => i.ruleId === 'tax.realised-differs')!;
    assert.match(hi.message, /2 schemes in FY 2025-26 and Tax year 2026-27 \(2 scheme-years\)/);
    assert.match(hi.message, /1 of them sells units the IRR file shows switched in on the day of a non-taxable merger/);
  });
});

describe('the review figure tax.realisedFY: the statement where it covers the year, else derived', () => {
  const st = statementOf();
  const der = derivedOf();

  test('a year the statement covers for one client and not the other: per client, never mixed in one client-year', () => {
    // FY 2025-26. Client A: the statement has the Flexi Cap lot, so A's figure is the statement's: 1,700, long term
    // (bought 1 Apr 2023, sold 1 Aug 2025: more than 12 months, equity-oriented). A's Focused redemption (derived 500,
    // IRR-only) is NOT added. Client B: no statement lot, so the derived 400 (no base file: term not known).
    // Family: long 1,700, short 0, term not known 400, total 2,100; sources mixed.
    const fy = realisedForYear(2025, der, st);
    assert.equal(fy.fyLabel, 'FY 2025-26');
    assert.equal(fy.source, MIXED_SOURCE);
    assert.equal(fy.label, 'sum of separate computations');
    assert.deepEqual(fy.clients.map((c) => c.source).sort(), ['derived from transactions', 'statement']);
    const a = fy.clients.find((c) => c.source === 'statement')!;
    near(v(a.lt), 1700, 'A lt'); near(v(a.st), 0, 'A st'); near(v(a.total), 1700, 'A total');
    const b = fy.clients.find((c) => c.source === 'derived from transactions')!;
    near(v(b.unknownTerm), 400, 'B unknown term'); near(v(b.total), 400, 'B total');
    near(v(fy.lt), 1700, 'lt'); near(v(fy.st), 0, 'st'); near(v(fy.unknownTerm), 400, 'unknown'); near(v(fy.total), 2100, 'total');
  });

  test('a year the statement covers for every client: the statement alone', () => {
    // FY 2024-25, client A only: Bluechip 3,200.50 long (bought 10 Jan 2024, sold 15 Mar 2025) and 140 short (bought
    // 10 Jun 2024); Value 150 long (bought 1 Jun 2022, sold 1 Dec 2024). Long 3,350.50, short 140, total 3,490.50.
    const fy = realisedForYear(2024, der, st);
    assert.equal(fy.source, 'statement');
    near(v(fy.lt), 3350.5, 'lt'); near(v(fy.st), 140, 'st'); near(v(fy.total), 3490.5, 'total');
  });

  test('the merger year counts 0 from the statement, not the derived 5,000', () => {
    // FY 2023-24: the statement covers A (the merger row); its counted realised is 0.
    const fy = realisedForYear(2023, der, st);
    assert.equal(fy.source, 'statement');
    near(v(fy.total), 0, 'total');
  });

  test('without a statement every figure is labelled "derived from transactions"', () => {
    // FY 2025-26 from the IRR file alone: A Flexi Cap 1,500 + Focused 500 = 2,000; B Midcap 400. Total 2,400.
    const fy = realisedForYear(2025, der, null);
    assert.equal(fy.source, 'derived from transactions');
    assert.ok(fy.clients.every((c) => c.source === 'derived from transactions'));
    near(v(fy.total), 2400, 'total');
  });

  test('neither side: no source and a total of 0 over no client', () => {
    const fy = realisedForYear(2020, der, st);
    assert.equal(fy.source, null);
    assert.equal(fy.clients.length, 0);
    near(v(fy.total), 0, 'total');
    assert.deepEqual(fy.outsideReview.clients, []);
  });
});

describe('R2 S-5 (OD-4): an IRR client with no holding in the base file is left out of the family figure, and listed', () => {
  // The base file holds client A only (Bluechip, 60 u). Client B is in the IRR file (Midcap, derived 400 in FY 2025-26)
  // but holds nothing in the base file: outside the review, as the statement side leaves out a person not in the
  // review. B is listed with a count, never added.
  const base = parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, [{
    client: CLIENT_A, name: SCHEME.BLUE, cat: 'Large Cap Fund', asset: 'Equity', folio: '', amc: 'Sample Mutual Fund', product: 'Mutual Funds',
    dist: 'Sample Distributor 1', units: 60, invested: 7500, mv: 8400, xirr: 10, bmxirr: 9, days: 300, purchase: [2024, 1, 10],
  }])), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW });
  const der = deriveRealisedGains(irrImport(irrRealisedRows(), xlsx).fund, { asOn: AS_ON_DAY, holdings: base.holdings });

  test('without a statement: A only, 2,000; B listed outside the review', () => {
    // FY 2025-26: A Flexi Cap 1,500 + Focused 500 = 2,000 (no holding joins either: term not known). B Midcap 400 is
    // left out (the old figure was 2,400). One client outside, with its one lot.
    const fy = realisedForYear(2025, der, null);
    assert.equal(fy.clients.length, 1);
    near(v(fy.total), 2000, 'total');
    assert.equal(fy.outsideReview.count, 1);
    assert.deepEqual(fy.outsideReview.clients.map((c) => [c.clientLabel, c.lots]), [['Sample Client B', 1]]);
    assert.equal(fy.outsideReview.reason, OUTSIDE_REVIEW_REASON);
    assert.match(fy.total.kind === 'value' ? fy.total.prov.method : '', /1 client of the IRR file with no holding in the base file left out \(OD-4\)/);
  });

  test('with the statement: one rule on both sides, so the figure is the statement\'s alone', () => {
    // FY 2025-26: A from the statement, 1,700 long; B (derived 400) outside the review: total 1,700, source statement
    // (was 2,100, mixed).
    const fy = realisedForYear(2025, der, statementOf());
    assert.equal(fy.source, 'statement');
    near(v(fy.total), 1700, 'total');
    near(v(fy.unknownTerm), 0, 'unknown term');
    assert.equal(fy.outsideReview.count, 1);
  });
});

describe('Gate B of aa67a45 (ARC-03): the tolerance pairs (Q4, Q5) and a statement covering part of a client-year (item 8)', () => {
  /** The mismatch statement with Bluechip lot 0 sold for `blueOffset` rupees more and Flexi Cap sold at `flexiNav`. */
  function recPair(blueOffset: number, flexiNav: number): RealisedReconciliation {
    const lots = mismatchStatementLots({ flexiSellNav: flexiNav });
    lots[0] = { ...lots[0]!, sellOffset: blueOffset };
    const imp = parseLots(lots, {}, xlsx);
    return reconcileRealised(derivedOf(), { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) });
  }

  test('Q4: the Rs 1 + Rs 0.005 per statement row part of the tolerance', () => {
    // One statement row on a sale of about 4,000: the amount part is max(1, 0.40) = 1, the rows part 1 + 0.005 = 1.005:
    // the tolerance is 1.005, exactly. 400 rows on a sale of 5,000: max(1, 0.5) against 1 + 2 = 3: 3. Two rows on a
    // sale of 1 crore: the amount part, 1,000.
    assert.equal(reconcileTolerance(4001.005, 4000, 1), 1 + 0.005);
    assert.equal(reconcileTolerance(5000, 5000, 400), 3);
    assert.equal(reconcileTolerance(1e7, 1e7, 2), 1000);
    const r = rowOf(recPair(1.58, 80.02), 2025, SCHEME.FLEXI);
    assert.ok(Math.abs(r.tolerance! - 1.005) < 1e-12, `Flexi Cap tolerance ${r.tolerance}`);
  });

  test('the review pairs: Bluechip 1.58 against 1.584158 reconciled, 1.59 against 1.584159 differs; Flexi Cap 1.00 against 1.005 reconciled, 1.01 differs', () => {
    // Bluechip FY 2024-25: derived 3,340 on a sale of 15,840; the statement's lot 0 sold for x more. Tolerance max(1,
    // (15,840 + x) x 0.0001, 1 + 0.005 x 2): x = 1.58 gives 1.584158 and a difference of 1.58: reconciled; x = 1.59 gives
    // 1.584159 and 1.59: differs. Flexi Cap FY 2025-26: derived 1,500 on 4,000, one statement row (tolerance 1.005);
    // NAV 80.02 sells 50 u for 4,001.00 (difference 1.00): reconciled; NAV 80.0202 for 4,001.01 (1.01): differs.
    const lo = recPair(1.58, 80.02);
    const hi = recPair(1.59, 80.0202);
    const b1 = rowOf(lo, 2024, SCHEME.BLUE); const b2 = rowOf(hi, 2024, SCHEME.BLUE);
    assert.ok(Math.abs(b1.tolerance! - 1.584158) < 1e-9 && Math.abs(b1.difference! - 1.58) < 1e-6, `${b1.tolerance} ${b1.difference}`);
    assert.equal(b1.outcome, 'reconciled');
    assert.ok(Math.abs(b2.tolerance! - 1.584159) < 1e-9 && Math.abs(b2.difference! - 1.59) < 1e-6, `${b2.tolerance} ${b2.difference}`);
    assert.equal(b2.outcome, 'differs');
    const f1 = rowOf(lo, 2025, SCHEME.FLEXI); const f2 = rowOf(hi, 2025, SCHEME.FLEXI);
    assert.ok(Math.abs(f1.difference! - 1) < 1e-6, String(f1.difference));
    assert.equal(f1.outcome, 'reconciled');
    assert.ok(Math.abs(f2.difference! - 1.01) < 1e-6, String(f2.difference));
    assert.equal(f2.outcome, 'differs');
  });

  test('Q5: a difference exactly at the tolerance is reconciled (<=)', () => {
    // A scheme of A in both files, amounts exact in binary. IRR: Purchase 1 Apr 2024 6,400 at 100 = 64 u; Redemption
    // 2 Jun 2025 19,998 at 312.46875 = 64 u: derived realised 13,598. Statement: 64 u bought at 100, sold at 312.5 =
    // 20,000: realised 13,600. Difference 2; tolerance max(max(1, 20,000 x 0.0001 = 2), 1.005) = 2: exactly at it,
    // reconciled.
    const X = 'Sample Large and Midcap Fund - Regular Plan - Growth';
    const der = deriveRealisedGains(irrImport([
      flow(CLIENT_A, X, [2024, 4, 1], 'Purchase', 100, -6400),
      flow(CLIENT_A, X, [2025, 6, 2], 'Redemption', 312.46875, 19998),
    ], xlsx).fund, { asOn: AS_ON_DAY });
    const imp = parseLots([{ scheme: X, asset: 'Equity', category: 'Large & Mid Cap Funds', buy: [2024, 4, 1], sell: [2025, 6, 2], units: 64, buyNav: 100, sellNav: 312.5 }], {}, xlsx);
    const rec = reconcileRealised(der, { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) });
    const r = rowOf(rec, 2025, X);
    assert.equal(r.difference, 2);
    assert.equal(r.tolerance, 2);
    assert.equal(r.outcome, 'reconciled');
  });

  test('item 8: a statement that covers part of a client-year is PARTIAL, never complete', () => {
    // FY 2025-26, client A: the statement has the Flexi Cap lot (1,700) and no Focused lot, while the IRR file derives a
    // Focused gain of 500 that year. The 500 is not added (never both sides in one client-year), so A's figure stays
    // 1,700, but it is PARTIAL: one scheme left out, coverage 1 statement lot / (1 + 1 derived lot) = 0.5. The family
    // figure is PARTIAL too. FY 2024-25 (every derived scheme of A in the statement) is complete.
    const fy = realisedForYear(2025, derivedOf(), statementOf());
    const a = fy.clients.find((c) => c.source === 'statement')!;
    assert.equal(a.schemesLeftOut, 1);
    near(v(a.total), 1700, 'A total');
    assert.ok(a.total.kind === 'value' && a.total.coverage === 0.5, JSON.stringify(a.total));
    assert.match(a.total.kind === 'value' ? a.total.prov.method : '', /PARTIAL: 1 scheme with gains derived from the IRR file in this year is not in the capital-gains statement/);
    assert.ok(a.lt.kind === 'value' && a.lt.coverage === 0.5);
    assert.ok(fy.total.kind === 'value' && fy.total.coverage !== undefined && fy.total.coverage < 1);
    assert.equal(fy.clients.find((c) => c.source === 'derived from transactions')!.schemesLeftOut, 0);
    const full = realisedForYear(2024, derivedOf(), statementOf());
    assert.equal(full.clients[0]!.schemesLeftOut, 0);
    assert.ok(full.total.kind === 'value' && full.total.coverage === undefined);
  });

  test('N-5: a scheme whose only derived rows in the year are a transfer out or a sale of 0 does not make the figure PARTIAL', () => {
    // irr-realised with A's Focused redemption of 1 Oct 2025 written as a Transfer Out instead, and A's Midcap bought
    // 1 May 2024 and "sold" 1 Sep 2025 for 0. Neither row sells anything, so FY 2025-26 for A (the statement's Flexi
    // Cap lot, 1,700) leaves no scheme out: complete (fa88c2b marked it PARTIAL with 2 schemes left out).
    const rows = irrRealisedRows().filter((r) => !(r.includes(SCHEME.FOCUSED) && r.includes('Redemption')));
    rows.push(
      flow(CLIENT_A, SCHEME.FOCUSED, [2025, 10, 1], 'Transfer Out', 30, 1500),
      flow(CLIENT_A, SCHEME.MID, [2024, 5, 1], 'Purchase', 100, -10000),
      flow(CLIENT_A, SCHEME.MID, [2025, 9, 1], 'Redemption', 120, 0),
    );
    const der = deriveRealisedGains(irrImport(rows, xlsx).fund, { asOn: AS_ON_DAY });
    assert.deepEqual(der.lots.filter((l) => l.clientLabel === CLIENT_A && l.financialYear === 2025 && l.gap !== null).map((l) => l.gap).sort(),
      ['sale-without-amount', 'transfer-row']);
    const a = realisedForYear(2025, der, statementOf()).clients.find((c) => c.source === 'statement')!;
    assert.equal(a.schemesLeftOut, 0);
    near(v(a.total), 1700, 'A total');
    assert.ok(a.total.kind === 'value' && a.total.coverage === undefined, JSON.stringify(a.total));
  });
});
