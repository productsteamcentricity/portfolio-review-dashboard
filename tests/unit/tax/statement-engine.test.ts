// covers: E-155 E-153 E-141 (the statement-lot engine and the person-year roll-up over every capital-gains fixture, bare and with the recorded inputs; design capital-gains-upload.md §13.1, §14 "Validation results by id", §11 coverage)
// The reader (parseCapitalGains), the lot engine (realiseLots) and the roll-up (rollupPersonYears) over every fixture
// of tests/fixtures/make-cg-statements.ts, first bare (no analyst input: repeats-question and non-taxable-transfers
// open) and then with the fixture's recorded analyst inputs (§13.1). The engine's and the roll-up's validation results
// are compared exactly, by rule id, severity and count, with the lists below, worked out by hand from each fixture's
// lot rows (the case list in make-cg-statements.ts) and the rules of design §5, §9 and §10, never from the code under
// test. The reader's own results stay in tests/unit/ingest/capital-gains.test.ts (PLAN-03 P4: this file is the §14
// test that the design places in capital-gains.test.ts). A coverage assertion fails when an engine or roll-up id of
// §11 appears in no fixture's expected results.
//
// The recorded inputs live here, not in cg-known-answers.json (S3 fills only that file's `rollup` section).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import type { Workbook } from '../../../app/src/ingest/workbook.ts';
import { financialYearOf, parseCapitalGains } from '../../../app/src/ingest/capital-gains.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import type { CgImport, CgOptions } from '../../../app/src/ingest/capital-gains.ts';
import { emptyTaxInputs } from '../../../app/src/engine/tax/realised.ts';
import type { RealiseOptions } from '../../../app/src/engine/tax/realised.ts';
import { schemeKeyOf } from '../../../app/src/engine/tax/tax-class.ts';
import { S2_ISSUE_SEVERITY, S3_ISSUE_IDS } from '../../../app/src/engine/tax/types.ts';
import type { RollupResult, TaxIssue } from '../../../app/src/engine/tax/types.ts';
import type { TaxInputs } from '../../../app/src/model/tax.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { cgFixtures, taxCaseLots } from '../../fixtures/make-cg-statements.ts';
import { NOW, REVIEW, SRC, personYearInputs, realiseAndRoll } from '../../fixtures/make-cg-tax-lots.ts';

const xlsx = loadSheetJS();
const fixtures = new Map(cgFixtures(xlsx).map((f) => [f.id, f]));

/** The workbook, with each sheet's used range attached as the reader honours it (as in the reader test). */
function read(id: string): Workbook {
  const f = fixtures.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  const wb = readWorkbook(xlsx, f.bytes);
  const raw = xlsx.read(f.bytes, { type: 'array' }) as unknown as { Sheets: Record<string, Record<string, unknown>> };
  for (const s of wb.sheets) {
    const ref = raw.Sheets[s.name]?.['!ref'];
    if (typeof ref === 'string') (s as typeof s & { lastRow?: number }).lastRow = xlsx.utils.decode_cell(ref.split(':').pop()!).r;
  }
  return wb;
}

type Expect = [rule: string, severity: string, count: number | undefined];
const sortE = (xs: Expect[]): Expect[] => [...xs].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
const results = (issues: readonly TaxIssue[]): Expect[] => issues.map((i) => [i.ruleId.replace('capital-gains.', ''), i.severity, i.count]);

/** One fixture's recorded analyst inputs (§13.1), from its import (event ids and lot indexes as read). */
type Recorded = {
  reader?: (imp: CgImport) => Partial<CgOptions>;
  inputs?: (imp: CgImport) => Partial<TaxInputs>;
  realise?: (imp: CgImport) => RealiseOptions;
};

/** cg-statement and the fixtures with its lots: the equal genuine lots as stated, the rest once (the reader test's answers). */
const REPEATS: Recorded = {
  reader: (imp) => ({ repeatAnswers: { byEvent: { [imp.lots[23]!.eventId]: 'as-stated', [imp.lots[5]!.eventId]: 'once' }, all: 'once' } }),
  inputs: () => ({ personYear: personYearInputs([{ client: 'Sample Client A', fy: 2025, slabPct: 30, surchargePct: 0, regime: 'new' }]) }),
};

const TAX = taxCaseLots();
const scheme = (lot: number): string => schemeKeyOf(TAX[lot]!.scheme);

const RECORDED: Readonly<Record<string, Recorded>> = {
  'cg-statement': REPEATS,
  'cg-statement-reordered': REPEATS,
  'cg-statement-footer-mismatch': REPEATS,
  'cg-template-filled': { inputs: (imp) => ({ mergerAnswers: [{ eventId: imp.lots[3]!.eventId, answer: 'non-taxable' }] }) },
  // The analyst's assessee marks of §13.2: lot 0 held jointly, lot 9 of a person marked as a minor.
  'cg-statement-bad-cells': { realise: () => ({ assesseeOf: (i) => (i === 0 ? 'joint holders' : i === 9 ? 'minor' : null) }) },
  'cg-statement-pan-persons': {
    inputs: () => ({ personYear: personYearInputs([
      { personKey: 'person:1', fy: 2025, slabPct: 30, surchargePct: 0, regime: 'old' },
      { personKey: 'person:3', fy: 2025, slabPct: 20, surchargePct: 0, regime: 'new' },
    ]) }),
  },
  'cg-tax-cases': {
    inputs: (imp) => ({
      scheme: [
        { schemeKey: scheme(29), fy: 2023, taxClass: 'other-non-equity' },
        { schemeKey: scheme(68), fy: null, taxClass: 'equity-oriented' },
        { schemeKey: scheme(71), fy: null, etfFof9090: true },
        { schemeKey: scheme(63), fy: null, closeEnded: true },
        { schemeKey: scheme(64), fy: null, closeEnded: true },
      ],
      mergerAnswers: [
        { eventId: imp.lots[22]!.eventId, answer: 'non-taxable' },
        { eventId: imp.lots[24]!.eventId, answer: 'non-taxable' },
        { eventId: imp.lots[56]!.eventId, answer: 'taxable-consolidation' },
        { eventId: imp.lots[88]!.eventId, answer: 'taxable-consolidation' },
        { eventId: imp.lots[89]!.eventId, answer: 'investor-switch' },
        { eventId: imp.lots[90]!.eventId, answer: 'non-taxable' },
      ],
      personYear: personYearInputs([
        { client: 'Sample Client A', fy: 2025, slabPct: 30, surchargePct: 25, regime: null },
        { client: 'Sample Client A', fy: 2024, slabPct: 30, surchargePct: 0, regime: 'old' },
        { client: 'Sample Client B', fy: 2023, slabPct: 30, surchargePct: 37, regime: null },
        { client: 'Sample Client B', fy: 2024, slabPct: 10, surchargePct: 0, regime: 'new' },
      ]),
    }),
    realise: () => ({ fundHouseOf: (key) => (key === scheme(90) ? 'Sample House One' : key === scheme(91) ? 'Sample House Two' : null) }),
  },
};

/**
 * The expected engine and roll-up results, bare and with the recorded inputs, worked out by hand:
 *  - cg-statement (and its reordered and footer-mismatch copies, whose lots are the same 25): every lot standard;
 *    the four 2021-08-02 to 2023-11-20 debt lots (13 to 16, NE-ST-2, short term by the 36-month rule) carry the
 *    statement's LTCG (held over 365 days), so term-differs 4. With the repeats answered once, lots 6, 9 to 12, 14 to
 *    16 and 19 are excluded: 16 lots counted, term-differs 1 (lot 13).
 *  - cg-template-filled: 6 lots; the merger row (a plan consolidation dated 15 Mar 2019, after the gate) is one event
 *    to answer; no LTCG or STCG cell on the other rows, so nothing to compare. Answered non-taxable: only lot-classes.
 *  - cg-statement-bad-cells: 17 lots. lot-class-other 3: lot 1 (Purchase Date invalid, the acquisition date present),
 *    lot 5 (Purchase Price 55 against the acquisition price 50 on an equity lot), lot 8 (no purchase price beside an
 *    acquisition price); lot 8's LTCG cell is 0 (the generator writes it from 0 units) against its taxable gain of
 *    Rs 200, so gain-differs 1; outside-rule-table 1 (lot 14); after-as-on-date 1 (lot 15). Other Client Z and
 *    S Client A (its own PAN) are 2 persons outside the review: the roll-up part of clients-unmatched, Warning 2.
 *    With the assessee marks: assessee-flagged 2.
 *  - cg-statement-other-family: 2 lots, both persons outside the review and none in it: clients-unmatched High 2.
 *  - cg-statement-pan-persons: S Client A's lot shares Sample Client A's PAN, so it is computed with Person 1, a person
 *    of the review: clients-unmatched Warning 1 (the joined lot). cg-statement-no-pan: S Client A is its own label
 *    person outside the review: Warning 1.
 *  - cg-tax-cases: per lot, in the order of make-cg-statements.ts taxCaseLots (see that list):
 *    non-taxable-transfers 6 events (lots 22, 24, 56, 88, 89, 90); merger-taxable 1 (56, before the gate);
 *    successor-reset 2 (25, 91); successor-not-reset 1 (57); cost-input-missing 1 (10); category-unmapped 1 (75);
 *    category-default-to-confirm 1 (29); usual-bucket-default 1 (69); tax-class-from-statement 5 (62, 65, 66, 68,
 *    75); tax-class-not-set 5 (70, 71, 72, 73, 74); specified-test-missing 1 (70); tax-class-differs 4 (58, 59, 60,
 *    67); term-differs 15 (17; 37, 38, 39, 47, 49, 50, 51, 52, 53; 58, 62, 63, 64, 67: short term by the app's rule,
 *    the statement's LTCG by its 365-day split, or KA-7's stated LTCG); anniversary-sale 5 (17 to 20, 49);
 *    elss-early-sale 1 (28); gain-differs 9 (5, 6 grandfathered; 35, 36, 41 NE-LT-1 on the 20% leg; 42, 44, 45
 *    indexed; 86 indexed against its stated LTCG); stripping-candidate 1 (26); rule-to-be-confirmed 1 (43, FY 2016-17
 *    index); lot-class-other 1 (76); lot-classes 92; indexed-cost-ignored 1 (51); grandfathered-value-ignored 1 (9);
 *    grandfathering-value-not-supplied 1 (8); pre-base-year-cost 1 (45); old-law-choice 4 (34, 35, 36, 41).
 *    With the inputs: every event answered (non-taxable-transfers gone); merger-taxable 2 (56, 88, both answered a
 *    taxable consolidation; 89, an investor switch, is a sale without the Warning); cross-house-merger 1 (90 to 91);
 *    lot 29 other non-equity by the analyst (category-default-to-confirm gone; tax-class-differs and term-differs,
 *    NE-ST-2); lot 68 by the analyst (tax-class-from-statement 4); the 90/90 flag on lots 71 to 73 (EQ-FOF-1; EQ-FOF-2
 *    rule-to-be-confirmed, now 2; NE-ST-2 in FY 2017-18 with tax-class-differs and term-differs; tax-class-not-set 2);
 *    lot 63 close-ended (listed-flag-missing 1, its term-differs gone); lot 64 close-ended Specified (still computed).
 *    So tax-class-differs 6 and term-differs 16.
 */
const STATEMENT_BARE: Expect[] = [['term-differs', 'Warning', 4], ['lot-classes', 'Information', 25]];
const STATEMENT_INPUTS: Expect[] = [['term-differs', 'Warning', 1], ['lot-classes', 'Information', 16]];
const TAX_COMMON: Expect[] = [
  ['successor-reset', 'Warning', 2], ['successor-not-reset', 'Warning', 1], ['cost-input-missing', 'Warning', 1],
  ['category-unmapped', 'Warning', 1], ['usual-bucket-default', 'Warning', 1], ['specified-test-missing', 'Warning', 1],
  ['anniversary-sale', 'Warning', 5], ['elss-early-sale', 'Warning', 1], ['gain-differs', 'Warning', 9],
  ['stripping-candidate', 'Warning', 1], ['lot-class-other', 'Warning', 1], ['lot-classes', 'Information', 92],
  ['indexed-cost-ignored', 'Information', 1], ['grandfathered-value-ignored', 'Information', 1],
  ['grandfathering-value-not-supplied', 'Information', 1], ['pre-base-year-cost', 'Information', 1],
  ['old-law-choice', 'Information', 4],
];

const EXPECTED: Readonly<Record<string, { bare: Expect[]; inputs: Expect[] }>> = {
  'cg-statement': { bare: STATEMENT_BARE, inputs: STATEMENT_INPUTS },
  'cg-statement-reordered': { bare: STATEMENT_BARE, inputs: STATEMENT_INPUTS },
  'cg-statement-duplicate-column': { bare: [], inputs: [] },
  'cg-template-blank': { bare: [], inputs: [] },
  'cg-template-filled': {
    bare: [['non-taxable-transfers', 'High', 1], ['lot-classes', 'Information', 6]],
    inputs: [['lot-classes', 'Information', 6]],
  },
  'cg-statement-not-template': { bare: [], inputs: [] },
  'cg-statement-footer-mismatch': { bare: STATEMENT_BARE, inputs: STATEMENT_INPUTS },
  'cg-statement-bad-cells': {
    bare: [
      ['lot-class-other', 'Warning', 3], ['gain-differs', 'Warning', 1], ['outside-rule-table', 'Warning', 1],
      ['after-as-on-date', 'Warning', 1], ['lot-classes', 'Information', 17], ['clients-unmatched', 'Warning', 2],
    ],
    inputs: [
      ['assessee-flagged', 'Warning', 2], ['lot-class-other', 'Warning', 3], ['gain-differs', 'Warning', 1],
      ['outside-rule-table', 'Warning', 1], ['after-as-on-date', 'Warning', 1], ['lot-classes', 'Information', 17],
      ['clients-unmatched', 'Warning', 2],
    ],
  },
  'cg-statement-other-family': {
    bare: [['lot-classes', 'Information', 2], ['clients-unmatched', 'High', 2]],
    inputs: [['lot-classes', 'Information', 2], ['clients-unmatched', 'High', 2]],
  },
  'cg-statement-pan-persons': {
    bare: [['lot-classes', 'Information', 5], ['clients-unmatched', 'Warning', 1]],
    inputs: [['lot-classes', 'Information', 5], ['clients-unmatched', 'Warning', 1]],
  },
  'cg-statement-no-pan': {
    bare: [['lot-classes', 'Information', 5], ['clients-unmatched', 'Warning', 1]],
    inputs: [['lot-classes', 'Information', 5], ['clients-unmatched', 'Warning', 1]],
  },
  'cg-tax-cases': {
    bare: [
      ...TAX_COMMON, ['non-taxable-transfers', 'High', 6], ['merger-taxable', 'Warning', 1],
      ['category-default-to-confirm', 'Warning', 1], ['tax-class-from-statement', 'Warning', 5],
      ['tax-class-not-set', 'Warning', 5], ['tax-class-differs', 'Warning', 4], ['term-differs', 'Warning', 15],
      ['rule-to-be-confirmed', 'Warning', 1],
    ],
    inputs: [
      ...TAX_COMMON, ['merger-taxable', 'Warning', 2], ['cross-house-merger', 'Warning', 1],
      ['tax-class-from-statement', 'Warning', 4], ['tax-class-not-set', 'Warning', 2], ['listed-flag-missing', 'Warning', 1],
      ['tax-class-differs', 'Warning', 6], ['term-differs', 'Warning', 16], ['rule-to-be-confirmed', 'Warning', 2],
    ],
  },
};

type Run = { imp: CgImport; issues: TaxIssue[]; roll: RollupResult };

function runFixture(id: string, withInputs: boolean): Run {
  const rec = withInputs ? RECORDED[id] ?? {} : {};
  const wb = read(id);
  const first = parseCapitalGains(wb, { sourceId: SRC, now: NOW, review: REVIEW });
  const imp = rec.reader ? parseCapitalGains(wb, { sourceId: SRC, now: NOW, review: REVIEW, ...rec.reader(first) }) : first;
  const inputs: TaxInputs = { ...emptyTaxInputs(), ...(rec.inputs?.(imp) ?? {}) };
  const { res, roll } = realiseAndRoll(imp, inputs, { realise: rec.realise?.(imp) ?? {} });
  return { imp, issues: [...res.issues, ...roll.issues], roll };
}

const SEEN = new Set<string>();

describe('the engine and the roll-up over every capital-gains fixture (design §14, §13.1)', () => {
  test('every fixture has its expected results here', () => {
    assert.deepEqual([...fixtures.keys()].filter((id) => !(id in EXPECTED)), []);
    assert.deepEqual(Object.keys(EXPECTED).filter((id) => !fixtures.has(id)), []);
  });
  for (const id of fixtures.keys()) {
    for (const withInputs of [false, true]) {
      test(`${id}, ${withInputs ? 'with the recorded inputs' : 'bare'}`, () => {
        const r = runFixture(id, withInputs);
        const want = EXPECTED[id]![withInputs ? 'inputs' : 'bare'];
        assert.deepEqual(sortE(results(r.issues)), sortE(want));
        for (const i of r.issues) SEEN.add(i.ruleId.replace('capital-gains.', ''));
        // The roll-up's invariants on every fixture: a person-year with a lot left out is PARTIAL, and the family sum
        // adds only the review's persons.
        for (const y of r.roll.years) {
          for (const p of y.persons) {
            if (p.coverage.lotsNotComputed > 0) assert.equal(p.coverage.partial, true, `${id} FY ${y.fy} ${p.personKey} PARTIAL`);
            if (p.coverage.partial && p.afterSetOffDash === null && !p.insufficientEvidence && p.estimate.tax.kind === 'value') {
              assert.ok((p.estimate.tax.coverage ?? 1) < 1, `${id} FY ${y.fy} ${p.personKey}: a PARTIAL figure carries coverage below 1`);
            }
          }
          assert.deepEqual(y.familyPersons, y.persons.filter((p) => p.inReview).map((p) => p.personKey), `${id} FY ${y.fy} family`);
          if (y.persons.some((p) => p.inReview && (p.coverage.partial || p.afterSetOffDash !== null))) {
            assert.equal(y.familySum.coverage.partial, true, `${id} FY ${y.fy} family PARTIAL`);
          }
        }
        // INSUFFICIENT EVIDENCE exactly in the reader's years.
        for (const y of r.roll.years) {
          assert.equal(y.insufficientEvidence, r.imp.insufficientYears.includes(financialYearOf(ymdToDay(y.fy, 4, 1)!).label), `${id} FY ${y.fy} evidence`);
        }
      });
    }
  }
});

describe('§11 coverage of the engine and roll-up ids (the reader ids stay in the reader test)', () => {
  test('every engine-side id of §11 (S2) and every roll-up id (S3) appears in some fixture\'s expected results', () => {
    const expected = new Set(Object.values(EXPECTED).flatMap((e) => [...e.bare, ...e.inputs].map((x) => x[0])));
    const ids = [...Object.keys(S2_ISSUE_SEVERITY), ...S3_ISSUE_IDS];
    assert.deepEqual(ids.filter((x) => !expected.has(x)), []);
    assert.deepEqual(ids.filter((x) => !SEEN.has(x)), [], 'and was raised');
  });
  test('the severities are those of §11 (clients-unmatched High or Warning)', () => {
    for (const e of Object.values(EXPECTED)) {
      for (const [rule, sev] of [...e.bare, ...e.inputs]) {
        if (rule === 'clients-unmatched') assert.ok(sev === 'High' || sev === 'Warning');
        else assert.equal(sev, S2_ISSUE_SEVERITY[rule], rule);
      }
    }
  });
});
