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
  MIXED_SOURCE, OUTSIDE_REVIEW_REASON, TOLERANCE_RULE, paiseDifference, realisedForYear, reconcileRealised, reconcileTolerance, withinTolerance,
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
    // Round 2c: on the IRR side alone the switch out is a merger candidate (Contra emptied into Small Cap on one day for
    // the same amount): a 'merger-candidate' gap with no sale value and no realised gain. It keeps the ordinary-switch
    // lot (realised 5,000, the figure before round 2c), which the reconciliation reads here because the statement shows
    // the merger on that day, so the row is as before.
    const r = rowOf(rec, 2023, SCHEME.OLD);
    const g = st.realised.gains.find((x) => x.schemeLabel === SCHEME.OLD)!;
    assert.equal(g.lotClass, 'non-taxable-transfer');
    near(v(g.realised), 5000, 'economic gain'); near(v(g.realisedCounted), 0, 'counted');
    const d = der.lots.find((x) => x.instrumentName === SCHEME.OLD)!;
    assert.equal(d.gap, 'merger-candidate');
    assert.equal(d.realised.kind, 'missing');
    assert.equal(d.saleValue.kind, 'missing');
    near(v(d.asSwitch![0]!.realised), 5000, 'the ordinary-switch lot kept, never counted');
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
    // M7b F-4: B's term is not known, so B's long and short figures are NOT AVAILABLE (not 0), and the family's long and
    // short figures are A's alone, PARTIAL (a client figure missing): never complete while a gain's term is unknown.
    assert.equal(b.lt.kind, 'missing'); assert.equal(b.st.kind, 'missing');
    assert.match(b.lt.kind === 'missing' ? b.lt.reason : '', /^the term of 1 counted lot is not known/);
    assert.ok(fy.lt.kind === 'value' && fy.lt.coverage !== undefined && fy.lt.coverage < 1, JSON.stringify(fy.lt));
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

  test('neither side: no source, and the figures missing over no client (contracts-4 B-4; it read Rs 0 before)', () => {
    const fy = realisedForYear(2020, der, st);
    assert.equal(fy.source, null);
    assert.equal(fy.clientId, null);
    assert.equal(fy.clients.length, 0);
    assert.equal(fy.schemesLeftOut, 0);
    for (const x of [fy.total, fy.st, fy.lt, fy.unknownTerm]) {
      assert.ok(x.kind === 'missing' && x.status === STATUS.NOT_AVAILABLE && /^no client of the review has a realised figure in this year/.test(x.reason), JSON.stringify(x));
    }
    assert.deepEqual(fy.outsideReview.clients, []);
  });

  test('contracts-4 (C4-5, B-4): RealisedForYear.source is null only when the total is missing; each client entry is one', () => {
    for (const y of [2020, 2023, 2024, 2025, 2026]) {
      for (const fy of [realisedForYear(y, der, st), realisedForYear(y, der, null), realisedForYear(y, null, st)]) {
        if (fy.source === null) assert.equal(fy.total.kind, 'missing', `${y}: source null with a total`);
        assert.equal(fy.schemesLeftOut, fy.clients.reduce((n, c) => n + c.schemesLeftOut, 0));
        for (const c of fy.clients) {
          assert.equal(c.fy, y);
          assert.notEqual(c.source, null);
          assert.notEqual(c.source, MIXED_SOURCE);
        }
      }
    }
    assert.equal(MIXED_SOURCE, 'mixed');
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

describe('round 2c, F1 (Gate B of 5c9ae0a): the tolerance boundary in exact arithmetic', () => {
  test('10,200 against 10,198.98 at a tolerance of exactly 1.02 reconciles', () => {
    // IRR: Purchase 1 Apr 2024 10,000 at 100 = 100 u; Redemption 2 Jun 2025 10,198.98 at 101.9898 = 100 u: derived
    // realised 198.98. Statement: 100 u bought at 100, sold at 102 = 10,200: realised 200. Difference 1.02 (102 paise).
    // Tolerance max(max(1, 10,200 x 0.0001 = 1.02), 1 + 0.005 x 1 = 1.005) = 1.02: exactly at it, reconciled. The
    // unrounded difference is 1.0200000000004366, which 5c9ae0a read as "differs" (CHAT-012's F1).
    const X = 'Sample Large and Midcap Fund - Regular Plan - Growth';
    const der = deriveRealisedGains(irrImport([
      flow(CLIENT_A, X, [2024, 4, 1], 'Purchase', 100, -10000),
      flow(CLIENT_A, X, [2025, 6, 2], 'Redemption', 101.9898, 10198.98),
    ], xlsx).fund, { asOn: AS_ON_DAY });
    const imp = parseLots([{ scheme: X, asset: 'Equity', category: 'Large & Mid Cap Funds', buy: [2024, 4, 1], sell: [2025, 6, 2], units: 100, buyNav: 100, sellNav: 102 }], {}, xlsx);
    const r = rowOf(reconcileRealised(der, { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) }), 2025, X);
    assert.equal(r.difference, 1.02);
    assert.equal(r.tolerance, 1.02);
    assert.equal(r.outcome, 'reconciled');
  });

  test('a difference of 136 paise against the 72-row tolerance Rs 1.36 (the float 1.3599999999999999) reconciles; 137 differs', () => {
    // Statement: 72 lots of 1 u each, bought at 100 on 72 different days of 2024 and sold 2 Jun 2025 at 150: sale 10,800,
    // realised 72 x 50 = 3,600. IRR: Purchase 1 Jan 2024 7,200 at 100 = 72 u; Redemption 2 Jun 2025 of 10,798.64 (72 u
    // at 149.98111...): derived realised 3,598.64. Difference 1.36. Tolerance max(max(1, 10,800 x 0.0001 = 1.08),
    // 1 + 0.005 x 72 = 1.36) = 1.36, which the float sum gives as 1.3599999999999999: a bare <= would say "differs".
    // A redemption of 10,798.63 gives 137 paise: beyond, differs.
    const X = 'Sample Large and Midcap Fund - Regular Plan - Growth';
    const lots = Array.from({ length: 72 }, (_, i) => ({ scheme: X, asset: 'Equity', category: 'Large & Mid Cap Funds',
      buy: [2024, 1 + (i % 12), 1 + Math.floor(i / 12)] as const, sell: [2025, 6, 2] as const, units: 1, buyNav: 100, sellNav: 150 }));
    const imp = parseLots(lots, {}, xlsx);
    assert.deepEqual(imp.insufficientYears, []);
    const st: StatementSide = { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) };
    const at = (sale: number): ReconcileRow => rowOf(reconcileRealised(deriveRealisedGains(irrImport([
      flow(CLIENT_A, X, [2024, 1, 1], 'Purchase', 100, -7200),
      flow(CLIENT_A, X, [2025, 6, 2], 'Redemption', sale / 72, sale),
    ], xlsx).fund, { asOn: AS_ON_DAY }), st), 2025, X);
    const r = at(10798.64);
    assert.equal(r.difference, 1.36);
    assert.ok(r.tolerance! < 1.36 && Math.abs(r.tolerance! - 1.36) < 1e-12, String(r.tolerance));
    assert.equal(r.outcome, 'reconciled');
    const beyond = at(10798.63);
    assert.equal(beyond.difference, 1.37);
    assert.equal(beyond.outcome, 'differs');
  });
});

describe('round 2c, the merger condition (MOD-05): a merger candidate is never computed without a statement that shows it', () => {
  const derivedNew = (): DerivedRealised => deriveRealisedGains(irrImport(irrRealisedRows({ sellNew: true }), xlsx).fund, { asOn: AS_ON_DAY });
  /** The mismatch statement without the Contra merger row (it does not show the merger). */
  const withoutMerger = (opts: Parameters<typeof mismatchStatementLots>[0] = {}): StatementSide => {
    const imp = parseLots(mismatchStatementLots(opts).filter((l) => l.scheme !== SCHEME.OLD), {}, xlsx);
    return { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) };
  };

  test('the fixture\'s Contra to Small Cap merger from the IRR side alone: a merger-candidate gap, FY 2023-24 NOT AVAILABLE (was 5,000)', () => {
    // A's Contra: Purchase 1 Jul 2019 100 u at 100; Switch Out 10 Nov 2023 15,000 at 150 = 100 u, the whole holding and
    // A's last Contra trade; the same day a Switch In of 15,000 to Small Cap, the only switch in of that amount: one
    // pairing, a candidate. The switch out is a 'merger-candidate' gap (no sale value, no realised gain); FY 2023-24 of
    // A holds no other derived lot, so the derived figure is NOT AVAILABLE, never the 5,000 of an ordinary switch.
    const der = derivedOf();
    const d = der.lots.filter((x) => x.instrumentName === SCHEME.OLD);
    assert.deepEqual(d.map((x) => [x.gap, x.mergerCandidate?.role]), [['merger-candidate', 'switch-out']]);
    assert.equal(d[0]!.saleValue.kind, 'missing');
    assert.equal(der.counts.mergerCandidates, 1);
    const fy = realisedForYear(2023, der, null);
    assert.equal(fy.source, 'derived from transactions');
    assert.equal(fy.total.kind, 'missing');
    const w = der.issues.find((i) => i.ruleId === 'tax.derived-merger-candidates')!;
    assert.equal(w.severity, 'Warning');
    assert.equal(w.count, 1);
    assert.match(w.message, /^1 switch pair looks like a scheme merger; a merger is not a sale \(s\.47\(xviii\)\) and cost and date carry over; confirm it with the analyst\./);
    assert.ok(!DASH.test(w.message));
    // The ordinary partial switch of the same file (Flexi Cap, 50 of 200 u, 1 Aug 2025) stays computed: 1,500.
    const flexi = der.lots.filter((x) => x.instrumentName === SCHEME.FLEXI);
    assert.deepEqual(flexi.map((x) => x.gap), [null]);
    near(v(flexi[0]!.realised), 1500, 'partial switch');
  });

  test('a statement that does not show the merger: the candidate stays a gap on the derived side (not reconciled)', () => {
    // The statement without the Contra row: the Contra FY 2023-24 row is IRR-only and its derived figure NOT AVAILABLE,
    // one lot unknown (5c9ae0a: a computed 5,000).
    const r = rowOf(reconcileRealised(derivedOf(), withoutMerger()), 2023, SCHEME.OLD);
    assert.equal(r.outcome, 'irr-only');
    assert.equal(r.derived!.realised.kind, 'missing');
    assert.equal(r.derived!.lotsUnknown, 1);
  });

  test('the successor: a later sale of Small Cap is the same gap without a statement that shows the merger', () => {
    // Small Cap redeemed 4 May 2026, 18,000 at 180 = 100 u, after the candidate's switch in: 'merger-candidate'
    // (successor), sale value 18,000 kept, no cost and no realised gain (5c9ae0a: 3,000 at the merger value). Tax year
    // 2026-27 from the IRR side: NOT AVAILABLE. With a statement holding the Small Cap sale (original cost carried) but
    // no merger row, the row is not reconciled for the derived gap (5c9ae0a: differs by 5,000); the statement figure
    // (8,000) stands for the year.
    const der = derivedNew();
    const nw = der.lots.filter((x) => x.instrumentName === SCHEME.NEW);
    assert.deepEqual(nw.map((x) => [x.gap, x.mergerCandidate?.role]), [['merger-candidate', 'successor']]);
    near(v(nw[0]!.saleValue), 18000, 'sale value');
    assert.equal(nw[0]!.realised.kind, 'missing');
    near(v(nw[0]!.asSwitch![0]!.realised), 3000, 'ordinary-switch reading kept, never counted');
    assert.equal(realisedForYear(2026, der, null).total.kind, 'missing');
    const st = withoutMerger({ sellNew: 'carried' });
    const r = rowOf(reconcileRealised(der, st), 2026, SCHEME.NEW);
    assert.equal(r.outcome, 'not-reconciled');
    assert.equal(r.reason, 'derived-gaps');
    const fy = realisedForYear(2026, der, st);
    assert.equal(fy.source, 'statement');
    near(v(fy.total), 8000, 'statement figure');
  });

  test('item 8 counts a candidate\'s gap lot as the lots it keeps, so the statement figure\'s coverage is as before (MC14)', () => {
    // irr-realised plus Small Cap bought 1 Jan 2023 (100 u at 100) and redeemed 1 Sep 2025 (150 u at 200, 30,000): the
    // ordinary-switch reading takes two lots (100 u of the purchase, 50 u of the switch in); round 2c gives one
    // 'merger-candidate' gap lot keeping both. FY 2025-26, client A: the statement covers Flexi Cap (1 lot) only; left
    // out: Focused (1 derived lot) and Small Cap (2 lots, as before round 2c). Coverage 1 / (1 + 3) = 0.25 (counting
    // the gap lot as 1 would give 1 / 3); the figure stays the statement's 1,700.
    const der = deriveRealisedGains(irrImport([
      ...irrRealisedRows(),
      flow(CLIENT_A, SCHEME.NEW, [2023, 1, 1], 'Purchase', 100, -10000),
      flow(CLIENT_A, SCHEME.NEW, [2025, 9, 1], 'Redemption', 200, 30000),
    ], xlsx).fund, { asOn: AS_ON_DAY });
    const nw = der.lots.filter((x) => x.instrumentName === SCHEME.NEW);
    assert.deepEqual(nw.map((x) => [x.gap, x.asSwitch?.length]), [['merger-candidate', 2]]);
    const a = realisedForYear(2025, der, statementOf()).clients.find((c) => c.source === 'statement')!;
    assert.equal(a.schemesLeftOut, 2);
    near(v(a.total), 1700, 'A total');
    assert.ok(a.total.kind === 'value' && a.total.coverage === 0.25, JSON.stringify(a.total));
  });

  test('V3: a statement showing another scheme\'s merger on the day does not show this one; the successor stays a gap', () => {
    // The statement holds the Small Cap sale (original cost carried, 8,000) and no Contra row; instead its Value lot is
    // written as a non-taxable merger on 10 Nov 2023 (bought 1 Jul 2019, Acquisition Date = Sale Date). The candidate's
    // scheme A is Contra, whose pair shows no merger, so the Small Cap row is not reconciled for the derived gap.
    // 0e860c3 read any merger of the client that day: the row compared 8,000 with the ordinary-switch 3,000 (differs).
    const lots = mismatchStatementLots({ sellNew: 'carried' }).filter((l) => l.scheme !== SCHEME.OLD).map((l) => (l.scheme === SCHEME.VALUE
      ? { ...l, buy: [2019, 7, 1] as const, sell: [2023, 11, 10] as const, over: { acqDate: [2023, 11, 10] as const, acqPrice: 55, ltcg: 0, stcg: 0 } } : l));
    const imp = parseLots(lots, {}, xlsx);
    const st: StatementSide = { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) };
    assert.ok(st.realised.gains.some((g) => g.schemeLabel === SCHEME.VALUE && g.lotClass === 'non-taxable-transfer'));
    const r = rowOf(reconcileRealised(derivedNew(), st), 2026, SCHEME.NEW);
    assert.equal(r.outcome, 'not-reconciled');
    assert.equal(r.reason, 'derived-gaps');
    assert.equal(r.mergerSuccessorLots, 0);
  });

  test('V4: a statement that shows the merger but not the successor\'s sale year leaves the successor a gap', () => {
    // The mismatch statement shows the Contra merger (FY 2023-24) and holds no Small Cap lot. The Small Cap Tax year
    // 2026-27 row is IRR-only; its derived figure is NOT AVAILABLE (one lot unknown). 0e860c3 showed the ordinary-switch
    // 3,000 at the merger-day cost, which a non-taxable merger contradicts (the cost carries over: 8,000).
    const r = rowOf(reconcileRealised(derivedNew(), statementOf()), 2026, SCHEME.NEW);
    assert.equal(r.outcome, 'irr-only');
    assert.equal(r.derived!.realised.kind, 'missing');
    assert.equal(r.derived!.lotsUnknown, 1);
    // Contra's own row still reads the merger as before (0 against 0, reconciled).
    assert.equal(rowOf(reconcileRealised(derivedNew(), statementOf()), 2023, SCHEME.OLD).outcome, 'reconciled');
  });
});

describe('round 2c financial review V5: the amount tolerance from sale-value sums in whole paise', () => {
  test('probe 3b: statement sale values summed over 20 to 420 paise rows, at an exact 0.01% boundary, all reconcile', () => {
    // The review's probe 3b, as written: 20,000 synthetic statement years (a fixed pseudo-random sequence, seed 7), each
    // of 20 to 419 rows of up to Rs 50,000 in whole paise, the total a multiple of Rs 100 so 0.01% of it is a whole paisa
    // T; the difference is exactly T. The sale-value sum carries float noise; 0e860c3 fed it to the 0.01% straight and read
    // 755 of these as "differs" (the smallest at 160 rows; no case under that size did). Rounded to paise first: none.
    let seed = 7;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let tried = 0;
    let differs = 0;
    for (let k = 0; k < 20000; k++) {
      const rows = 20 + Math.floor(rnd() * 400);
      const paise = Array.from({ length: rows - 1 }, () => 1 + Math.floor(rnd() * 5000000));
      const partial = paise.reduce((s, x) => s + x, 0);
      const target = Math.ceil((partial + 1) / 10000) * 10000;
      paise.push(target - partial);
      const saleSum = paise.reduce((s, x) => s + x / 100, 0);
      const exactTol = target / 1000000;
      if (exactTol < 1 + 0.005 * rows + 0.011) continue;
      tried++;
      if (!withinTolerance(paiseDifference(1e5 + exactTol, 1e5), reconcileTolerance(saleSum, 0, rows))) differs++;
    }
    assert.equal(tried, 20000);
    assert.equal(differs, 0);
    // One paisa beyond still differs.
    assert.equal(withinTolerance(paiseDifference(1e5 + 1.59, 1e5), reconcileTolerance(15800.5, 0, 2)), false);
  });
});

describe('Gate B of 4001f8f: a many-into-one merger in the reconciliation (mutant RC1)', () => {
  test('a statement showing only one source\'s merger does not show the merger: the successor stays a gap', () => {
    // IRR: Contra 100 u at 100 and Value 100 u at 40, switched out whole on 10 Nov 2023 (15,000 and 5,000) into Small
    // Cap (20,000); Small Cap redeemed 4 May 2026 for 24,000. The statement shows Contra's merger row (non-taxable, 10 Nov
    // 2023) and the Small Cap sale (original cost carried), but no Value merger. Every source must show it, so the Small
    // Cap Tax year 2026-27 row is not reconciled for the derived gap; reading the ordinary-switch lots on one source's
    // word would compare them as if the merger were shown.
    const der = deriveRealisedGains(irrImport([
      flow(CLIENT_A, SCHEME.OLD, [2019, 7, 1], 'Purchase', 100, -10000), flow(CLIENT_A, SCHEME.VALUE, [2019, 7, 1], 'Purchase', 40, -4000),
      flow(CLIENT_A, SCHEME.OLD, [2023, 11, 10], 'Switch Out', 150, 15000), flow(CLIENT_A, SCHEME.VALUE, [2023, 11, 10], 'Switch Out', 50, 5000),
      flow(CLIENT_A, SCHEME.NEW, [2023, 11, 10], 'Switch In', 150, -20000), flow(CLIENT_A, SCHEME.NEW, [2026, 5, 4], 'Redemption', 180, 24000),
    ], xlsx).fund, { asOn: AS_ON_DAY });
    assert.equal(der.counts.mergerCandidates, 2);
    const imp = parseLots(mismatchStatementLots({ sellNew: 'carried' }).filter((l) => l.scheme === SCHEME.OLD || l.scheme === SCHEME.NEW), {}, xlsx);
    const st: StatementSide = { imp, realised: realiseLots(imp, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW }) };
    const rec = reconcileRealised(der, st);
    const r = rowOf(rec, 2026, SCHEME.NEW);
    assert.equal(r.outcome, 'not-reconciled');
    assert.equal(r.reason, 'derived-gaps');
    assert.equal(r.mergerSuccessorLots, 0);
    // Contra's own switch out is read as before where its merger is shown (0 against 0, reconciled).
    assert.equal(rowOf(rec, 2023, SCHEME.OLD).outcome, 'reconciled');
  });
});
