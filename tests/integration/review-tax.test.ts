// covers: E-41 E-42 E-43 E-141 E-155 AC-18 Q-49 Q-52
// The tax seam (app/src/engine/tax/review-tax.ts, M7b, PLAN-07 section 3): one pure call over the review's holdings, the
// IRR file and the capital-gains statement, on four input sets: all three, no IRR file, no statement, and neither. The
// books are synthetic (tests/fixtures/make-books.ts bookBytes, rupee columns; make-realised-reconcile.ts `irr-realised`
// and `cg-statement-mismatch` without their merger pair, below), read by the real readers. Every figure is
// checked against an answer worked by hand (in the comments, or the existing known answers: H-1 to H-6 and R2-H7 of
// harvest-known-answers.json, KA-9 to KA-22 of cg-known-answers.json, the reconcile cases of
// realised-gains-reconcile.test.ts), and the parts are equal to the modules called directly, so the seam adds no
// arithmetic of its own. Plus: order independence, no client name or amount in an issue, no clock and no browser global.
// Money in rupees, compared to Rs 0.01; as on 30 Sep 2026 (Tax year 2026-27).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISSING_TEXT, NO_IRR, NO_STATEMENT, mergeIssues, reviewTax, yearsShown } from '../../app/src/engine/tax/review-tax.ts';
import type { ReviewTax, ReviewTaxInput, TaxPart } from '../../app/src/engine/tax/review-tax.ts';
import { computeTaxLots } from '../../app/src/engine/tax/lots.ts';
import { rollupHoldings } from '../../app/src/engine/tax/holdings-rollup.ts';
import { EXEMPTION_NOT_APPLIED, buildHarvests } from '../../app/src/engine/tax/harvest.ts';
import type { HarvestLocal } from '../../app/src/engine/tax/harvest.ts';
import { deriveRealisedGains } from '../../app/src/engine/tax/realised-irr.ts';
import { emptyTaxInputs, realiseLots } from '../../app/src/engine/tax/realised.ts';
import { rollupPersonYears } from '../../app/src/engine/tax/rollup.ts';
import type { RollupFamilyYear, RollupPersonYear } from '../../app/src/engine/tax/rollup.ts';
import { MIXED_SOURCE, realisedForYear, reconcileRealised } from '../../app/src/engine/tax/reconcile.ts';
import type { RealisedFY, ReconcileRow } from '../../app/src/engine/tax/reconcile.ts';
import { repeatEvidence } from '../../app/src/engine/tax/repeat-evidence.ts';
import { INST } from '../../app/src/engine/tax/classify.ts';
import type { EstimateLocal, TaxLot } from '../../app/src/engine/tax/types.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import type { CgImport } from '../../app/src/ingest/capital-gains.ts';
import { STATUS } from '../../app/src/model/status.ts';
import type { Holding } from '../../app/src/model/holding.ts';
import type { ClientId, SourceFileId } from '../../app/src/model/ids.ts';
import type { TaxInputs } from '../../app/src/model/tax.ts';
import type { IrrFileImport, Transaction } from '../../app/src/model/transactions.ts';
import type { ValidationResult } from '../../app/src/model/validation.ts';
import type { Value } from '../../app/src/model/value.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { bookBytes } from '../fixtures/make-books.ts';
import type { BookRow } from '../fixtures/make-books.ts';
import { AS_ON_DAY, NOW, parseLots, personYearInputs } from '../fixtures/make-cg-tax-lots.ts';
import type { KaLot, KaPersonYear } from '../fixtures/make-cg-tax-lots.ts';
import { CLIENT_A, CLIENT_B, FAMILY } from '../fixtures/make-cg-statements.ts';
import { IRR_SRC, SCHEME, flow, irrImport, irrRealisedRows, mismatchStatementLots } from '../fixtures/make-realised-reconcile.ts';
import type { Cell } from '../fixtures/make-irr-files.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CG_KA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/cg-known-answers.json'), 'utf8'));
const H_KA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/harvest-known-answers.json'), 'utf8'));
const xlsx = loadSheetJS();
const BASE_SRC = 'b'.repeat(64) as SourceFileId;
/** An en or em dash (built from code points, so this file holds none, D-029). */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

const v = (x: Value<number> | null | undefined): number | null => (x && x.kind === 'value' ? x.v : null);
const near = (a: number | null | undefined, b: number, msg = ''): void => {
  assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= 0.01, `${msg}: ${a} != ${b}`);
};
function part<T>(p: TaxPart<T>, what: string): T {
  assert.equal(p.kind, 'value', `${what}: ${p.kind === 'missing' ? p.reason : ''}`);
  return (p as { kind: 'value'; v: T }).v;
}
function missingPart(p: TaxPart<unknown>, reason: string, status: string = STATUS.NOT_AVAILABLE): void {
  assert.equal(p.kind, 'missing');
  assert.equal((p as { reason: string }).reason, reason);
  assert.equal((p as { status: string }).status, status);
}

// ---------------------------------------------------------------------------------------------------------------
// The seam's book: the holdings left after `irr-realised` (worked from the fixture's FIFO notes)

function hold(client: string, name: string, cat: string, units: number, invested: number, mv: number, o: Partial<BookRow> = {}): BookRow {
  return { client, name, cat, asset: 'Equity', folio: '', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: 'Sample Distributor 1', units, invested, mv,
    xirr: 10, bmxirr: 9, days: 300, purchase: [2024, 1, 1], ...o };
}
/**
 * A Bluechip: 60 u left of the 10 Jun 2024 lot at 125 (invested 7,500), CMV 8,400. A Flexi Cap: 150 u of the 1 Apr 2023
 * lot at 50 (7,500), CMV 13,500. A Focused: 50 u of the 1 Apr 2024 lot at 20 (1,000), CMV 1,250. B Midcap: 80 u of the
 * 1 May 2024 lot at 100 (8,000), CMV 7,200 (a loss). Every lot is long on 30 Sep 2026 (each anniversary is before it).
 */
const SEAM_BOOK: BookRow[] = [
  hold(CLIENT_A, SCHEME.BLUE, 'Large Cap Fund', 60, 7500, 8400),
  hold(CLIENT_A, SCHEME.FLEXI, 'Flexi Cap Fund', 150, 7500, 13500),
  hold(CLIENT_A, SCHEME.FOCUSED, 'Focused Fund', 50, 1000, 1250),
  hold(CLIENT_B, SCHEME.MID, 'Mid Cap Fund', 80, 8000, 7200),
];
const baseOf = (book: readonly BookRow[]): Holding[] => parseBaseFile(readWorkbook(xlsx, bookBytes(xlsx, book)), { sourceId: BASE_SRC, now: NOW }).holdings;
const HOLDINGS = baseOf(SEAM_BOOK);
const idOf = (holdings: readonly Holding[], label: string): ClientId => holdings.find((h) => h.clientLabel === label)!.clientId!;
const A_ID = idOf(HOLDINGS, CLIENT_A);
const B_ID = idOf(HOLDINGS, CLIENT_B);
/** The statement read with the review's clients (the base file's client ids), as the review reads it. */
function statementFor(lots: KaLot[], holdings: readonly Holding[] = HOLDINGS): CgImport {
  const clients = [...new Map(holdings.filter((h) => h.clientId !== null).map((h) => [h.clientId!, { id: h.clientId!, label: h.clientLabel!, displayLabel: null }])).values()];
  return parseLots(lots, { review: { clients, familyLabel: FAMILY } }, xlsx);
}
/**
 * The IRR file: `irr-realised` without the Contra and Small Cap rows, so it holds no switch pair and nothing here depends
 * on the merger-candidate rule (round 2c, still under review). The Flexi Cap switch out has no switch in: an ordinary
 * sale. The statement: `cg-statement-mismatch` without the Contra merger row, plus a Value lot sold in the as-on year
 * (bought 10 Nov 2023 at 150, sold 4 May 2026 at 180, 100 u: a long-term gain of 3,000; statement-only, as Value is).
 */
const NO_PAIR = (r: Cell[]): boolean => !r.includes(SCHEME.OLD) && !r.includes(SCHEME.NEW);
const IRR = irrImport(irrRealisedRows().filter(NO_PAIR), xlsx);
const VALUE_2026: KaLot = { scheme: SCHEME.VALUE, asset: 'Equity', category: 'Value Funds', folio: '91600004', buy: [2023, 11, 10], sell: [2026, 5, 4], units: 100, buyNav: 150, sellNav: 180 };
const STATEMENT = statementFor([...mismatchStatementLots().filter((l) => l.scheme !== SCHEME.OLD), VALUE_2026]);
const input = (o: Partial<ReviewTaxInput> = {}): ReviewTaxInput =>
  ({ holdings: HOLDINGS, asOnDay: AS_ON_DAY, irr: IRR, statement: STATEMENT, inputs: emptyTaxInputs(), ...o });
const run = (o: Partial<ReviewTaxInput> = {}): ReviewTax => reviewTax(input(o), { now: NOW });

const ALL = run();
const NO_IRR_RUN = run({ irr: null });
const NO_STMT_RUN = run({ statement: null });
const NEITHER = run({ irr: null, statement: null });

const recOf = (t: ReviewTax, name: string) => {
  const l = t.holdings.positions.filter((p) => p.record.instrumentName === name);
  assert.equal(l.length, 1, name);
  return l[0]!;
};
const harvestOf = (t: ReviewTax, id: ClientId): HarvestLocal => part(t.harvest, 'harvest').clients.find((c) => c.clientId === id)!;
const fyOf = (t: ReviewTax, fy: number): RealisedFY => part(t.realisedFY, 'realisedFY').find((y) => y.fy === fy)!;
const rowOf = (t: ReviewTax, fy: number, scheme: string): ReconcileRow => {
  const hits = part(t.reconciliation, 'reconciliation').rows.filter((x) => x.fy === fy && (x.instrumentName === scheme || x.schemeLabels.includes(scheme)));
  assert.equal(hits.length, 1, `${scheme} FY ${fy}`);
  return hits[0]!;
};

describe('all three inputs: holdings, IRR file and statement', () => {
  test('the basis names the inputs and the years shown', () => {
    // Sales in either input: FY 2024-25 (Bluechip on both sides, Value in the statement), 2025-26 (Flexi Cap, Focused,
    // Midcap) and Tax year 2026-27 (the statement's Value lot): all up to the as-on year 2026.
    assert.deepEqual(ALL.basis, {
      asOnDay: AS_ON_DAY, fy: 2026, fyLabel: 'Tax year 2026-27', holdings: 4, irr: IRR_SRC, statement: STATEMENT.sourceId,
      inputs: { personYear: 0, scheme: 0, mergerAnswers: 0, lotMarks: 0, exemptionUsed: 0 }, absent: [], years: [2024, 2025, 2026],
    });
  });

  test('the holdings are split long to the as-on day (H-figures of the book)', () => {
    // Long CMV and gain: Bluechip 8,400 and 900; Flexi Cap 13,500 and 6,000; Focused 1,250 and 250; Midcap 7,200 and
    // -800. The family's tax.unrealised.lt = 900 + 6,000 + 250 - 800 = 6,350; st 0. Each record maps to a TaxPosition.
    for (const [name, cmv, gain] of [[SCHEME.BLUE, 8400, 900], [SCHEME.FLEXI, 13500, 6000], [SCHEME.FOCUSED, 1250, 250], [SCHEME.MID, 7200, -800]] as const) {
      const p = recOf(ALL, name);
      assert.equal(p.record.status, 'ok', name);
      assert.equal(p.record.taxRule, INST.equityMf);
      near(p.record.lt.cmv, cmv, `${name} long`); near(p.record.lt.gain, gain, `${name} gain`);
      assert.ok(p.position !== null);
      near(p.position!.lt.gain, gain, `${name} TaxPosition`);
    }
    near(v(ALL.holdings.unrealised.lt), 6350, 'unrealised lt');
    near(v(ALL.holdings.unrealised.st), 0, 'unrealised st');
    const cls = ALL.holdings.rollup.family.byClass.find((c) => c.cls === INST.equityMf)!;
    near(cls.cmv, 30350, 'class CMV'); near(cls.ltPos, 7150, 'class long gains'); near(cls.ltNeg, 800, 'class long losses');
    assert.deepEqual(ALL.holdings.rollup.clients.map((c) => c.clientId), [A_ID, B_ID]);
  });

  test('Q-52: the harvest takes the exemption already used from the statement\'s person-year of the as-on year', () => {
    // The statement's Tax year 2026-27 for A: the Value lot bought 10 Nov 2023 at 150, sold 4 May 2026 at 180, 100 u:
    // a long-term gain of 3,000 at 12.5%, all inside the Rs 1,25,000 exemption, so the exemption applied is 3,000 and the
    // tax 0. A's harvest: Sec 198 gains 900 + 6,000 + 250 = 7,150; exemption used 3,000 (statement), available 1,22,000,
    // which covers the 7,150: tax before 7,150 x 12.5% less 7,150 x 12.5% = 0, after 0. B: no statement person in the
    // year, so not applied; no gain, a long-term loss of 800, unused; Midcap the one candidate.
    const st = part(ALL.statement, 'statement').years.find((y) => y.fy === 2026)!;
    const pa = st.persons.find((p) => p.clientId === A_ID)!;
    near(pa.realised, 3000, 'A realised'); near(v(pa.values.exemptionApplied), 3000, 'A exemption applied'); near(v(pa.estimate.total), 0, 'A tax');
    const a = harvestOf(ALL, A_ID);
    assert.equal(a.exemptionApplied, 'applied');
    assert.equal(a.exemption.source, 'statement');
    near(a.exemption.used, 3000, 'used'); near(a.exemption.available, 122000, 'available');
    near(a.figures.s198Gains, 7150, 's198'); near(a.figures.taxBefore, 0, 'before'); near(a.figures.taxAfter, 0, 'after');
    const b = harvestOf(ALL, B_ID);
    assert.equal(b.exemptionApplied, EXEMPTION_NOT_APPLIED);
    near(b.figures.taxBefore, 0, 'B before'); near(b.figures.ltLosses, 800, 'B losses'); near(b.figures.ltUnused, 800, 'B unused');
    assert.deepEqual(b.candidateDetail.map((c) => c.name), [SCHEME.MID]);
    const fam = part(ALL.harvest, 'harvest').family;
    assert.equal(fam.label, 'sum of separate computations');
    near(fam.figures.taxBefore, 0, 'family before'); near(fam.figures.ltLosses, 800, 'family losses');
  });

  test('the reconciliation: the reconcile cases of irr-realised against cg-statement-mismatch', () => {
    // As realised-gains-reconcile.test.ts works them: Bluechip FY 2024-25 3,340.50 against 3,340, reconciled (tolerance
    // 1.58405); Flexi Cap FY 2025-26 1,700 against 1,500, differs (High); Value statement-only in both its years; Focused
    // and Midcap IRR-only.
    const blue = rowOf(ALL, 2024, SCHEME.BLUE);
    assert.equal(blue.outcome, 'reconciled'); near(v(blue.statement!.realised), 3340.5, 'statement'); near(v(blue.derived!.realised), 3340, 'derived');
    near(blue.tolerance, 1.58405, 'tolerance');
    const flexi = rowOf(ALL, 2025, SCHEME.FLEXI);
    assert.equal(flexi.outcome, 'differs'); near(flexi.difference, 200, 'difference');
    assert.equal(rowOf(ALL, 2024, SCHEME.VALUE).outcome, 'statement-only');
    assert.equal(rowOf(ALL, 2026, SCHEME.VALUE).outcome, 'statement-only');
    assert.equal(rowOf(ALL, 2025, SCHEME.FOCUSED).outcome, 'irr-only');
    assert.equal(rowOf(ALL, 2025, SCHEME.MID).outcome, 'irr-only');
  });

  test('tax.realisedFY per client and year: the statement where it covers the client\'s year, else derived', () => {
    // FY 2024-25: statement only, long 3,200.50 + 150 = 3,350.50, short 140, total 3,490.50. FY 2025-26: A from the
    // statement, 1,700 long, PARTIAL (Focused left out: coverage 1 / 2); B derived, Midcap 400 long (bought 1 May 2024,
    // sold 1 Sep 2025: the base file's Mid Cap Fund joins it, equity, more than 12 months); family 2,100 long, sources
    // mixed. Tax year 2026-27: A's Value lot, 3,000 long, the statement's.
    const y24 = fyOf(ALL, 2024);
    near(v(y24.lt), 3350.5, '2024 lt'); near(v(y24.st), 140, '2024 st'); near(v(y24.total), 3490.5, '2024 total');
    const y25 = fyOf(ALL, 2025);
    assert.equal(y25.source, MIXED_SOURCE);
    const a = y25.clients.find((c) => c.clientId === A_ID)!;
    assert.equal(a.source, 'statement'); near(v(a.lt), 1700, 'A lt'); assert.equal(a.total.kind === 'value' ? a.total.coverage : -1, 0.5);
    const b = y25.clients.find((c) => c.clientId === B_ID)!;
    assert.equal(b.source, 'derived from transactions'); near(v(b.lt), 400, 'B lt'); near(v(b.unknownTerm), 0, 'B term known');
    near(v(y25.lt), 2100, '2025 lt'); near(v(y25.total), 2100, '2025 total');
    const y26 = fyOf(ALL, 2026);
    assert.equal(y26.source, 'statement'); near(v(y26.lt), 3000, '2026 lt'); near(v(y26.total), 3000, '2026 total');
    assert.deepEqual(part(ALL.repeatEvidence, 'repeat evidence'), []);
  });

  test('every part equals the module called directly (no arithmetic of the seam\'s own)', () => {
    const lots = computeTaxLots(HOLDINGS, IRR.fund, { asOn: AS_ON_DAY });
    assert.deepStrictEqual(ALL.holdings.lots, lots);
    const rollup = rollupHoldings(lots, HOLDINGS);
    assert.deepStrictEqual(ALL.holdings.rollup, rollup);
    const realised = realiseLots(STATEMENT, emptyTaxInputs(), { asOnDay: AS_ON_DAY, now: NOW });
    const roll = rollupPersonYears(realised.gains, STATEMENT, emptyTaxInputs(), { now: NOW });
    const st = part(ALL.statement, 'statement');
    assert.deepStrictEqual(st.realised, realised);
    assert.deepStrictEqual(st.years, roll.years);
    assert.deepStrictEqual(part(ALL.harvest, 'harvest'), buildHarvests(rollup, { asOn: AS_ON_DAY, inputs: { personYear: [], exemptionUsed: [] }, statement: { years: roll.years } }));
    const derived = deriveRealisedGains(IRR.fund, { holdings: HOLDINGS, asOn: AS_ON_DAY, sourceId: IRR.sourceId });
    assert.deepStrictEqual(part(ALL.derived, 'derived'), derived);
    const side = { imp: STATEMENT, realised };
    assert.deepStrictEqual(part(ALL.reconciliation, 'reconciliation'), reconcileRealised(derived, side));
    assert.deepStrictEqual(part(ALL.realisedFY, 'realisedFY'), [2024, 2025, 2026].map((y) => realisedForYear(y, derived, side)));
    assert.deepStrictEqual(part(ALL.repeatEvidence, 'repeat evidence'), repeatEvidence(STATEMENT, IRR, HOLDINGS, AS_ON_DAY));
    assert.deepStrictEqual(ALL.issues, mergeIssues([realised.issues, roll.issues, derived.issues, reconcileRealised(derived, side).issues]));
  });

  test('issues: de-duplicated by rule and scope, ordered by severity then rule, ids unique', () => {
    // The High of the Flexi Cap disagreement comes first; then the Warnings and the Information results by rule.
    assert.ok(ALL.issues.length > 1);
    assert.deepEqual(ALL.issues.filter((i) => i.severity === 'High').map((i) => i.ruleId), ['tax.realised-differs']);
    assert.equal(ALL.issues[0]!.ruleId, 'tax.realised-differs');
    const order = ['Blocking', 'High', 'Warning', 'Information'];
    for (let i = 1; i < ALL.issues.length; i++) {
      const a = ALL.issues[i - 1]!; const b = ALL.issues[i]!;
      const d = order.indexOf(a.severity) - order.indexOf(b.severity);
      assert.ok(d < 0 || (d === 0 && a.ruleId <= b.ruleId), `${a.ruleId} before ${b.ruleId}`);
    }
    assert.equal(new Set(ALL.issues.map((i) => i.id)).size, ALL.issues.length);
    assert.equal(new Set(ALL.issues.map((i) => `${i.ruleId} ${JSON.stringify(i.scope)}`)).size, ALL.issues.length);
    // mergeIssues itself: a repeat of one rule and scope is dropped; the same rule on another scope is kept and renumbered.
    const mk = (ruleId: string, severity: ValidationResult['severity'], src: string): ValidationResult => ({
      id: `${ruleId}:1`, ruleId, scope: { kind: 'file', sourceId: src.repeat(64) as SourceFileId }, message: 'm', severity,
      blocksPublication: false, resolution: 'none', status: 'open',
    });
    const merged = mergeIssues([[mk('tax.b', 'Warning', 'a'), mk('tax.a', 'Information', 'a')], [mk('tax.b', 'Warning', 'a'), mk('tax.b', 'Warning', 'c'), mk('tax.z', 'High', 'a')]]);
    assert.deepEqual(merged.map((i) => [i.id, i.severity]), [['tax.z:1', 'High'], ['tax.b:1', 'Warning'], ['tax.b:2', 'Warning'], ['tax.a:1', 'Information']]);
  });
});

describe('no IRR file: holdings not split, no derived gains, the statement alone', () => {
  test('every holding is unreconciled with its class; the split, the harvest and the derived side are labelled missing', () => {
    // No flow: each holding has no lots, unreconciled 'noLots', its whole CMV and gain unclassified, its class shown.
    for (const p of NO_IRR_RUN.holdings.positions) {
      assert.equal(p.record.status, 'unreconciled');
      assert.equal(p.record.unreconciledKind, 'noLots');
      assert.equal(p.record.taxRule, INST.equityMf);
      near(p.record.unclassified.cmv, p.record.cmv, 'unclassified');
    }
    assert.equal(NO_IRR_RUN.holdings.positions.length, 4);
    for (const x of [NO_IRR_RUN.holdings.unrealised.lt, NO_IRR_RUN.holdings.unrealised.st]) missingPart(x, MISSING_TEXT.unrealised);
    missingPart(NO_IRR_RUN.harvest, MISSING_TEXT.harvest);
    missingPart(NO_IRR_RUN.derived, MISSING_TEXT.derived);
    missingPart(NO_IRR_RUN.reconciliation, `${NO_IRR}: nothing to reconcile`);
    assert.deepEqual(NO_IRR_RUN.basis.absent, [NO_IRR]);
    assert.equal(NO_IRR_RUN.basis.irr, null);
  });

  test('the person-year tax is the statement\'s, unchanged; tax.realisedFY the statement\'s alone, never PARTIAL for derived gains', () => {
    // FY 2025-26: A 1,700 long from the statement, complete (no derived gain to leave out), source statement; FY 2024-25
    // 3,490.50; Tax year 2026-27 3,000. Years: those of the statement, 2024 to 2026.
    assert.deepStrictEqual(part(NO_IRR_RUN.statement, 'statement').years, part(ALL.statement, 'statement').years);
    assert.deepEqual(NO_IRR_RUN.basis.years, [2024, 2025, 2026]);
    const y25 = fyOf(NO_IRR_RUN, 2025);
    assert.equal(y25.source, 'statement');
    near(v(y25.total), 1700, '2025 total');
    assert.ok(y25.total.kind === 'value' && y25.total.coverage === undefined);
    near(v(fyOf(NO_IRR_RUN, 2024).total), 3490.5, '2024'); near(v(fyOf(NO_IRR_RUN, 2026).total), 3000, '2026');
    assert.deepEqual(part(NO_IRR_RUN.repeatEvidence, 'repeat evidence'), []);
  });
});

describe('no statement: no person-year tax; tax.realisedFY derived, labelled', () => {
  test('the statement side and the reconciliation are missing; the harvest applies no exemption', () => {
    // A's harvest without the statement: Sec 198 gains 7,150, exemption not applied (no analyst entry, no statement):
    // tax before 7,150 x 12.5% = 893.75, after 893.75 (no loss), labelled "exemption not applied".
    missingPart(NO_STMT_RUN.statement, MISSING_TEXT.statement);
    missingPart(NO_STMT_RUN.reconciliation, `${NO_STATEMENT}: nothing to reconcile`);
    missingPart(NO_STMT_RUN.repeatEvidence, MISSING_TEXT.repeatEvidence, STATUS.NOT_APPLICABLE);
    const a = harvestOf(NO_STMT_RUN, A_ID);
    assert.equal(a.exemptionApplied, EXEMPTION_NOT_APPLIED);
    assert.ok(a.labels.includes(EXEMPTION_NOT_APPLIED));
    near(a.figures.taxBefore, 893.75, 'before'); near(a.figures.taxAfter, 893.75, 'after');
    assert.deepEqual(NO_STMT_RUN.basis.absent, [NO_STATEMENT]);
  });

  test('tax.realisedFY from the derived gains, labelled "derived from transactions"', () => {
    // Years: those of the IRR file, 2024 and 2025. FY 2024-25: Bluechip 3,200 long (bought 10 Jan 2024, sold 15 Mar 2025)
    // + 140 short (bought 10 Jun 2024) = 3,340. FY 2025-26: A Flexi Cap 1,500 + Focused 500, both long; B Midcap 400
    // long; total 2,400.
    assert.deepEqual(NO_STMT_RUN.basis.years, [2024, 2025]);
    for (const y of part(NO_STMT_RUN.realisedFY, 'realisedFY')) assert.equal(y.source, 'derived from transactions', String(y.fy));
    const y24 = fyOf(NO_STMT_RUN, 2024);
    near(v(y24.lt), 3200, '2024 lt'); near(v(y24.st), 140, '2024 st'); near(v(y24.total), 3340, '2024 total');
    const y25 = fyOf(NO_STMT_RUN, 2025);
    near(v(y25.lt), 2400, '2025 lt'); near(v(y25.total), 2400, '2025 total');
  });
});

describe('neither: the holdings\' classes only, every figure a labelled missing value', () => {
  test('holdings unreconciled with their classes; every other part missing; no issue', () => {
    assert.deepStrictEqual(NEITHER.holdings, NO_IRR_RUN.holdings);
    missingPart(NEITHER.harvest, MISSING_TEXT.harvest);
    missingPart(NEITHER.statement, MISSING_TEXT.statement);
    missingPart(NEITHER.derived, MISSING_TEXT.derived);
    missingPart(NEITHER.reconciliation, `${NO_IRR} and ${NO_STATEMENT}: nothing to reconcile`);
    missingPart(NEITHER.realisedFY, MISSING_TEXT.realisedFY);
    missingPart(NEITHER.repeatEvidence, MISSING_TEXT.repeatEvidence, STATUS.NOT_APPLICABLE);
    assert.deepEqual(NEITHER.issues, []);
    assert.deepEqual(NEITHER.basis.absent, [NO_IRR, NO_STATEMENT]);
    assert.deepEqual(NEITHER.basis.years, []);
    assert.deepEqual(yearsShown(null, null, 2026), []);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The existing known answers through the seam

describe('H-1 to H-6 and R2-H7 through the seam (holdings and IRR file, no statement)', () => {
  /** The base row and the purchase of one known-answer position: invested = CMV less gain, 1 unit per Rs 100. */
  const CLASS_ROW: Record<string, { cat: string; asset: string; product: string; amc?: string }> = {
    equityMf: { cat: 'Large Cap Fund', asset: 'Equity', product: 'Mutual Funds' },
    debtMf: { cat: 'Corporate Bond Fund', asset: 'Debt', product: 'Mutual Funds' },
    crypto: { cat: 'Crypto', asset: 'Equity', product: 'Crypto', amc: '' },
    listedShares: { cat: 'Direct Equity', asset: 'Equity', product: 'Equity', amc: '' },
    global: { cat: 'FoF Overseas', asset: 'Equity', product: 'Mutual Funds' },
  };
  type Pos = { client: string; name: string; cls: string; cmv: number; lt?: number; st?: number };
  function runCase(positions: Pos[], inputs: { slab?: Record<string, number>; exemptionUsed?: Record<string, number | 'unused-confirmed'> }): ReviewTax {
    const book = positions.map((p) => {
      const r = CLASS_ROW[p.cls]!;
      const invested = p.cmv - (p.lt ?? p.st ?? 0);
      return hold(p.client, p.name, r.cat, invested / 100, invested, p.cmv, { asset: r.asset, product: r.product, amc: r.amc ?? 'Sample Mutual Fund' });
    });
    // A long-term lot bought 1 Jan 2024 (more than 24 months to 30 Sep 2026); a short-term lot bought 1 Mar 2026.
    const flows: Cell[][] = positions.map((p) => flow(p.client, p.name, p.lt !== undefined ? [2024, 1, 1] : [2026, 3, 1], 'Purchase', 100, -(p.cmv - (p.lt ?? p.st ?? 0))));
    const holdings = baseOf(book);
    const id = (label: string): ClientId => idOf(holdings, label);
    const tax: TaxInputs = {
      ...emptyTaxInputs(),
      personYear: Object.entries(inputs.slab ?? {}).map(([c, pct]) => ({ clientId: id(c), fy: 2026, slabPct: pct, surchargePct: null, regime: null, assesseeMark: null })),
      exemptionUsed: Object.entries(inputs.exemptionUsed ?? {}).map(([c, amount]) => ({ clientId: id(c), fy: 2026, amount })),
    };
    return reviewTax({ holdings, asOnDay: AS_ON_DAY, irr: irrImport(flows, xlsx), statement: null, inputs: tax }, { now: NOW });
  }
  const FIG = ['taxBefore', 'taxAfter', 'saving', 'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused', 'slabSheltered',
    'unquantifiedGain', 'unquantifiedPools', 'noSetOffGain', 'noSetOffLoss', 's198Gains', 's198Left', 'exAfter'] as const;
  for (const c of H_KA.cases as Array<{ id: string; positions: Pos[]; inputs: Record<string, never>; expect: { clients: Array<Record<string, unknown>>; family?: Record<string, number | string> } }>) {
    test(c.id, () => {
      const t = runCase(c.positions, c.inputs);
      // Every position is split (one lot each, reconciled to the base file), so the harvest sees the case's gains.
      assert.ok(t.holdings.positions.every((p) => p.record.status === 'ok'), JSON.stringify(t.holdings.positions.map((p) => [p.record.instrumentName, p.record.status, p.record.reason])));
      const h = part(t.harvest, 'harvest');
      for (const e of c.expect.clients) {
        const got = h.clients.find((x) => x.clientLabel === e.client)!;
        assert.ok(got, `${c.id} ${String(e.client)}`);
        for (const k of FIG) {
          if (!(k in e)) continue;
          const want = e[k] as number | null;
          if (want === null) assert.equal(got.figures[k], null, `${c.id} ${k}`); else near(got.figures[k], want, `${c.id} ${k}`);
        }
        if ('exemptionApplied' in e) assert.equal(got.exemptionApplied, e.exemptionApplied);
        if ('exemptionSource' in e) assert.equal(got.exemption.source, e.exemptionSource);
        if ('exemptionAvailable' in e) near(got.exemption.available, e.exemptionAvailable as number, `${c.id} available`);
        if ('candidates' in e) assert.deepEqual(got.candidateDetail.map((x) => x.name), e.candidates);
        if ('labels' in e) for (const l of e.labels as string[]) assert.ok(got.labels.includes(l), `${c.id} label ${l}`);
      }
      if (c.expect.family) {
        const f = c.expect.family;
        assert.equal(h.family.label, f.label);
        for (const k of ['taxBefore', 'taxAfter', 'saving', 'ltLosses', 'ltUnused'] as const) if (k in f) near(h.family.figures[k], f[k] as number, `${c.id} family ${k}`);
        if ('candidates' in f) assert.equal(h.family.candidates.length, f.candidates);
      }
    });
  }
});

describe('KA-9 to KA-22 through the seam (holdings and statement, no IRR file): the person-year tax', () => {
  type KaCase = {
    id: string; lots: KaLot[]; inputs: Partial<TaxInputs>; personYear: KaPersonYear[]; rollupFy?: number;
    expect: { lots?: Array<Record<string, unknown>>; personYears?: Array<Record<string, unknown>>; family?: Record<string, unknown>; realisedAllYears?: number };
    variants?: Array<{ id: string; lots?: KaLot[]; lotsOver?: Array<Partial<KaLot> | null>; personYear?: KaPersonYear[]; expect: KaCase['expect'] }>;
  };
  const IDS: Record<string, string> = { [CLIENT_A]: 'cl_review_a', [CLIENT_B]: 'cl_review_b' };
  const est = (e: EstimateLocal, x: Record<string, unknown>, w: string): void => {
    for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) {
      if (!(k in x)) continue;
      const want = x[k] as number | null;
      if (want === null) assert.equal(e[k].kind, 'missing', `${w} ${k}`); else near(v(e[k]), want, `${w} ${k}`);
    }
  };
  function checkPerson(p: RollupPersonYear, x: Record<string, unknown>, w: string): void {
    est(p.estimate, x, w);
    for (const [k, want] of Object.entries(x)) {
      switch (k) {
        case 'client': case 'fy': case 'tax': case 'surcharge': case 'cess': case 'total': break;
        case 'totalUnrounded': assert.ok(Math.abs(v(p.estimate.total)! - (want as number)) < 0.0001, `${w} total unrounded`); break;
        case 'partial': assert.equal(p.coverage.partial, want, `${w} partial`); break;
        case 'lotsNotComputed': assert.equal(p.coverage.lotsNotComputed, want, `${w} lots not computed`); break;
        case 'economicGainNotComputed': near(p.coverage.economicGainNotComputed, want as number, `${w} gain not computed`); break;
        case 'exemptionApplied': near(p.exemption.applied, want as number, `${w} exemption`); break;
        case 'beforeSurcharge': assert.equal(p.estimate.beforeSurcharge, want, `${w} before surcharge`); break;
        case 'afterSetOffDash': assert.equal(p.afterSetOffDash, want, `${w} dash`); break;
        case 'slabTaxableLeftOut': near(p.slabTaxableLeftOut, want as number, `${w} slab left out`); break;
        case 'realised': near(p.realised, want as number, `${w} realised`); break;
        case 'nonTaxable': near(p.nonTaxable, want as number, `${w} non-taxable`); break;
        case 'unabsorbed': near(p.unabsorbed.st, (want as { st: number }).st, `${w} unabsorbed st`); near(p.unabsorbed.lt, (want as { lt: number }).lt, `${w} unabsorbed lt`); break;
        case 'labels': for (const l of want as string[]) assert.ok(p.labels.includes(l), `${w} label ${l}`); break;
        case 'buckets':
          for (const b of want as Array<Record<string, unknown>>) {
            const got = p.buckets.find((y) => y.ruleId === b.ruleId);
            assert.ok(got, `${w} bucket ${String(b.ruleId)}`);
            for (const [f, z] of Object.entries(b)) {
              if (f === 'ruleId') continue;
              if (f === 'rate') assert.equal(got!.rate, z); else near((got as unknown as Record<string, number>)[f], z as number, `${w} bucket ${String(b.ruleId)} ${f}`);
            }
          }
          break;
        case 'alternatives':
          for (const [a, z] of Object.entries(want as Record<string, Record<string, unknown>>)) {
            const d = p.alternativesDetail[a as 'anniversaryLongTerm'] as (EstimateLocal & { leg?: string }) | null;
            assert.ok(d, `${w} alternative ${a}`);
            est(d!, z, `${w} alternative ${a}`);
            if ('leg' in z) assert.equal(d!.leg, z.leg);
          }
          break;
        case 'oldLawLegs':
          near(v(p.alternativesDetail.oldLawLegs!.indexed20.tax), (want as { indexed20: number }).indexed20, `${w} 20% leg`);
          near(v(p.alternativesDetail.oldLawLegs!.actual10.tax), (want as { actual10: number }).actual10, `${w} 10% leg`);
          break;
        default: throw new Error(`${w}: unknown expectation ${k}`);
      }
    }
  }
  function checkLots(g: readonly TaxLot[], want: Array<Record<string, unknown>>, w: string): void {
    for (const e of want) {
      const lot = g[e.lot as number]!;
      for (const [k, x] of Object.entries(e)) {
        if (k === 'lot') continue;
        if (k === 'ruleId') assert.equal(lot.ruleId, x, `${w} lot ${String(e.lot)} rule`);
        else if (k === 'taxableGain' || k === 'costForTax' || k === 'realised') {
          if (x === null) assert.equal(lot[k].kind, 'missing'); else near(v(lot[k]), x as number, `${w} lot ${String(e.lot)} ${k}`);
        } else if (k === 'flags') for (const f of x as string[]) assert.ok(lot.flags.includes(f), `${w} flag ${f}`);
        else if (k === 'legs') assert.equal(lot.legDetail?.chosen, (x as { chosen: string }).chosen, `${w} leg`);
        else throw new Error(`${w}: unknown lot expectation ${k}`);
      }
    }
  }
  function check(id: string, lots: readonly KaLot[], personYear: readonly KaPersonYear[], inputs: Partial<TaxInputs>, e: KaCase['expect']): void {
    const tax: TaxInputs = { ...emptyTaxInputs(), ...inputs, personYear: personYearInputs(personYear) };
    const t = reviewTax({ holdings: HOLDINGS, asOnDay: AS_ON_DAY, irr: null, statement: parseLots(lots, {}, xlsx), inputs: tax }, { now: NOW });
    const st = part(t.statement, `${id} statement`);
    const year = (fy: number): RollupFamilyYear => { const y = st.years.find((x) => x.fy === fy); assert.ok(y, `${id} year ${fy}`); return y!; };
    if (e.lots) checkLots(st.realised.gains, e.lots, id);
    for (const p of e.personYears ?? []) {
      const who = p.client as string;
      const person = year(p.fy as number).persons.find((x) => (IDS[who] !== undefined ? x.clientId === IDS[who] : x.personKey === who));
      assert.ok(person, `${id} ${who} ${String(p.fy)}`);
      checkPerson(person!, p, `${id} ${who} FY ${String(p.fy)}`);
    }
    if (e.family) {
      const y = year(e.family.fy as number);
      assert.equal(y.familyPersons.length, e.family.persons, `${id} family persons`);
      est(y.familySum.estimate as EstimateLocal, e.family, `${id} family`);
      assert.equal(y.familySum.coverage.partial, e.family.partial, `${id} family partial`);
    }
    if (e.realisedAllYears !== undefined) near(st.years.reduce((s, y) => s + y.familySum.realised, 0), e.realisedAllYears, `${id} realised over all years`);
  }
  const cases = (CG_KA.rollup as KaCase[]).filter((c) => c.rollupFy === undefined);
  test('every person-year known answer the seam can read is run (KA-19 re-dates the roll-up input, so it is not a statement)', () => {
    assert.deepEqual(cases.map((c) => c.id), ['KA-9', 'KA-10', 'KA-11', 'KA-12', 'KA-13', 'KA-15', 'KA-18', 'KA-20', 'KA-21', 'KA-22']);
  });
  for (const c of cases) {
    test(c.id, () => check(c.id, c.lots, c.personYear, c.inputs, c.expect));
    for (const vr of c.variants ?? []) {
      test(vr.id, () => check(vr.id, vr.lots ?? c.lots.map((l, i) => ({ ...l, ...(vr.lotsOver?.[i] ?? {}) })), vr.personYear ?? c.personYear, c.inputs, vr.expect));
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Order, privacy, purity

describe('order independence, messages, purity', () => {
  test('shuffled flows give the same output (file order kept only within a day, as the engines\' tie-break)', () => {
    // A fixed pseudo-random interleaving of the days: rows of one day keep their relative order, the days are mixed.
    let seed = 11;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const byDay = new Map<number, Transaction[]>();
    for (const t of IRR.fund) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t]);
    const queues = [...byDay.values()];
    const shuffled: Transaction[] = [];
    while (queues.some((q) => q.length)) {
      const open = queues.filter((q) => q.length);
      shuffled.push(open[Math.floor(rnd() * open.length)]!.shift()!);
    }
    assert.notDeepEqual(shuffled.map((t) => t.at.row), IRR.fund.map((t) => t.at.row));
    const irr: IrrFileImport = { ...IRR, fund: shuffled };
    assert.deepStrictEqual(run({ irr }), ALL);
    assert.deepStrictEqual(run({ irr, statement: null }), NO_STMT_RUN);
  });

  test('no client name, folio or amount in any issue message, and no en or em dash', () => {
    // The amounts of the inputs (flows, statement lots, base figures) and of the answers above, as written or grouped.
    const amounts = new Set<number>();
    for (const t of IRR.fund) amounts.add(Math.abs(t.amountRupees));
    for (const r of SEAM_BOOK) { amounts.add(r.invested); amounts.add(r.mv); }
    for (const l of STATEMENT.lots) for (const c of [l.saleValue, l.purchaseValue] as unknown[]) if (c && typeof c === 'object' && (c as { kind?: string }).kind === 'value') amounts.add(Math.abs((c as { v: number }).v));
    for (const x of [3340.5, 3490.5, 3350.5, 1700, 1500, 2100, 2400, 3000, 5000, 7150, 893.75, 122000, 6350, 900, 800]) amounts.add(x);
    const texts = (n: number): string[] => [String(n), n.toLocaleString('en-IN'), n.toLocaleString('en-US'), n.toFixed(2)];
    const words = [...amounts].filter((n) => n >= 100).flatMap(texts);
    const issues = [...ALL.issues, ...NO_STMT_RUN.issues, ...NO_IRR_RUN.issues];
    assert.ok(issues.length >= ALL.issues.length && ALL.issues.length > 1, String(issues.length));
    assert.ok(issues.some((i) => i.ruleId === 'tax.realised-differs') && issues.some((i) => i.ruleId === 'tax.realised-one-side'));
    for (const i of issues) {
      assert.doesNotMatch(i.message, /Sample|9160\d{4}|Client [AB]/, i.ruleId);
      assert.ok(!DASH.test(i.message), i.ruleId);
      for (const w of words) assert.ok(!new RegExp(`(^|[^0-9.,])${w.replace(/[.,]/g, '\\$&')}([^0-9]|$)`).test(i.message), `${i.ruleId} carries ${w}: ${i.message}`);
    }
  });

  test('the seam reads no clock and no browser global', () => {
    // Date.now and a Date built without an argument throw for the call; window, document and the browser stores are
    // traps on globalThis. The seam's source names none of them either (CLAUDE.md, the pure layers).
    const RealDate = globalThis.Date;
    class TrapDate extends RealDate {
      constructor(...a: ConstructorParameters<typeof Date>) {
        if (a.length === 0) throw new Error('new Date() read the clock');
        super(...a);
      }
      static override now(): number { throw new Error('Date.now() read the clock'); }
    }
    const names = ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB'];
    const saved = names.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)] as const);
    let out: ReviewTax | null = null;
    try {
      globalThis.Date = TrapDate as DateConstructor;
      for (const n of names) Object.defineProperty(globalThis, n, { configurable: true, get() { throw new Error(`${n} read`); } });
      out = run();
    } finally {
      globalThis.Date = RealDate;
      for (const [n, d] of saved) { if (d) Object.defineProperty(globalThis, n, d); else delete (globalThis as Record<string, unknown>)[n]; }
    }
    assert.deepStrictEqual(out, ALL);
    const src = fs.readFileSync(path.join(ROOT, 'app/src/engine/tax/review-tax.ts'), 'utf8');
    assert.doesNotMatch(src, /Date\.now|new Date\(|\b(window|document|globalThis|localStorage|sessionStorage|indexedDB)\./);
  });
});
