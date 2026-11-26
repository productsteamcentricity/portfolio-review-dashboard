// covers: U-13 U-25 U-28 U-58 U-69 E-29 E-142 (the returns view-model and the IRR slot's words, M3a wiring, NB-03)
// buildReturnsVM over the synthetic base book (syn-standard) and synthetic IRR files: the headline figures by key, the
// " pp" display of a contribution, a missing figure as the marker alone with its reason in a note, no en or em dash in
// any other text (D-029), the reconciliation notes (OD-4, E-142, D13) on a file made here with an IRR-only client, a
// redeemed instrument, an invalid benchmark and a split instrument, and the IRR slot's import notes with the notice
// that its issues do not block the workbook download yet (MOD-04 condition 2).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Figure } from '../../../app/src/views/overview-vm.ts';
import type { LoadedIrrFile } from '../../../app/src/ingest/load-irr.ts';
import type { ReturnsVM } from '../../../app/src/views/returns-vm.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import {
  benchCoverageText, buildIrrImportVM, buildReturnsVM, canAcceptIrr, datesWords, IRR_ISSUES_NOTICE, irrSlotView, RECONCILE_D13_TEXT,
  returnsHeadlineFigures, scopeOf, XIRR_BASIS_TEXT,
} from '../../../app/src/views/returns.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { displayPct, formatIndian } from '../../../app/src/views/format.ts';
import { MISSING_MARKER } from '../../../app/src/config/formats.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { BENCH_HEADER, dateCell, FUND_HEADER, fundRow, irrFixtures, toWorkbook } from '../../fixtures/make-irr-files.ts';

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const w = nodeWiring();
const run = reviewOf(w, fixtureById('syn-standard'));
const files = new Map(irrFixtures().map((f) => [f.id, f.bytes] as const));

function load(bytes: Uint8Array, name: string): LoadedIrrFile {
  const l = w.loadIrrFile!(bytes, name);
  if (!('irr' in l)) throw new Error(`${name}: ${l.kind}`);
  return l;
}
function vmOf(l: LoadedIrrFile): ReturnsVM {
  return buildReturnsVM(returnsForReview(run.review, l.irr), run.review, { source: l.source });
}

/**
 * A file made for the notes (synthetic): A's Bluechip under Centricity; A's Flexi Cap split (one flow without a
 * distributor); A's "Legacy Liquid Plan" with no holding (redeemed); B's Balanced whose benchmark flows fall on one day
 * (invalid); "Sample Client C", not in the base file (IRR-only).
 */
function richBytes(): Uint8Array {
  const A = 'Sample Client A', B = 'Sample Client B', C = 'Sample Client C', CEN = 'Centricity';
  const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth', FLEXI = 'Sample Flexi Cap Fund - Regular Plan - Growth';
  const BAL = 'Sample Balanced Advantage Fund - Regular Plan - Growth';
  return toWorkbook(loadSheetJS(), [
    { name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, CEN),
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 12000, CEN),
      fundRow(A, FLEXI, 'SYN-1002', 'Equity', dateCell(2023, 6, 1), 'Purchase', null, 50, -5000, CEN),
      fundRow(A, FLEXI, 'SYN-1002', 'Equity', dateCell(2024, 6, 1), 'Purchase', null, 50, -5000, null),
      fundRow(A, FLEXI, 'SYN-1002', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 11000, CEN),
      fundRow(A, 'Legacy Liquid Plan', 'SYN-1009', 'Debt', dateCell(2023, 1, 1), 'Purchase', null, 10, -3000, CEN),
      fundRow(A, 'Legacy Liquid Plan', 'SYN-1009', 'Debt', dateCell(2024, 1, 1), 'Redemption', null, 10, 3500, CEN),
      fundRow(B, BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), 'Purchase', null, 40, -8000, CEN),
      fundRow(B, BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 12, 31), null, 'Closing', null, 8800, CEN),
      fundRow(C, 'Other Liquid Plan', 'SYN-3001', 'Debt', dateCell(2023, 4, 1), 'Purchase', null, 10, -500, CEN),
      fundRow(C, 'Other Liquid Plan', 'SYN-3001', 'Debt', dateCell(2024, 4, 1), 'Redemption', null, 10, 550, CEN),
    ] },
    { name: 'SI Bmxirr', rows: [BENCH_HEADER,
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2023, 4, 1), 'Sample Index 1', -10000],
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2025, 3, 31), 'Sample Index 1', 11500],
      [B, BAL, 'Hybrid', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 2', -8000],
      [B, BAL, 'Hybrid', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 2', 8000],
    ] },
  ]);
}

/** Every figure of the view-model. */
function figuresOf(vm: ReturnsVM): Figure[] {
  const out: Figure[] = [];
  for (const s of vm.scopes) {
    out.push(s.headline.fund, s.headline.bench);
    for (const t of s.tree) out.push(t.fund, t.bench);
    for (const l of s.lists) for (const r of l.rows) out.push(r.allocation, r.xirr, r.contribution);
    if (s.unassigned) out.push(s.unassigned.share, s.unassigned.fund, s.unassigned.bench);
  }
  return out;
}

/** Every string in a value, with its path. */
function stringsOf(x: unknown, path = '$', out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof x === 'string') out.push([path, x]);
  else if (Array.isArray(x)) x.forEach((v, i) => stringsOf(v, `${path}[${i}]`, out));
  else if (x !== null && typeof x === 'object') for (const [k, v] of Object.entries(x)) stringsOf(v, `${path}.${k}`, out);
  return out;
}

const standard = load(files.get('irr-standard')!, 'irr-standard.xlsx');
const rich = load(richBytes(), 'rich.xlsx');

describe('the returns view-model', () => {
  const vm = vmOf(standard);
  const returns = returnsForReview(run.review, standard.irr);

  test('headline figures by key: returns.<scope>.fund and .bench, the engine value displayed as a percent', () => {
    assert.equal(vm.scopes.length, returns.scopes.length);
    vm.scopes.forEach((s, i) => {
      const r = returns.scopes[i]!;
      assert.equal(s.key, r.key);
      assert.equal(s.headline.fund.key, `returns.${r.key}.fund`);
      assert.equal(s.headline.bench.key, `returns.${r.key}.bench`);
      assert.deepEqual(s.headline.fund.value, r.result.fund.xirr);
      assert.deepEqual(s.headline.fund.display, displayPct(r.result.fund.xirr));
      assert.deepEqual(s.headline.bench.display, displayPct(r.result.bench.xirr));
      assert.equal(s.headline.flows, r.result.fund.flows);
    });
    assert.equal(vm.scopes[0]!.pickerLabel, 'Family');
    assert.equal(vm.scopes[1]!.pickerLabel, 'Client: Sample Client A');
    assert.ok(vm.scopes.some((s) => s.pickerLabel.startsWith('Adviser: ')));
    assert.equal(vm.scopes[0]!.headline.flowsText, '7 fund flows from 1 Apr 2023 to 31 Mar 2025');
    assert.deepEqual(returnsHeadlineFigures(vm).map((f) => f.key), vm.scopes.flatMap((s) => [`returns.${s.key}.fund`, `returns.${s.key}.bench`]));
    assert.equal(vm.basisText, XIRR_BASIS_TEXT);
    assert.equal(scopeOf(vm, 'no-such-scope')!.key, 'family');
  });

  test('figure keys are unique within the view-model', () => {
    const keys = figuresOf(vm).map((f) => f.key);
    const byKey = new Map<string, Figure>();
    for (const f of figuresOf(vm)) {
      const was = byKey.get(f.key);
      assert.ok(!was || JSON.stringify(was) === JSON.stringify(f), `${f.key} names two figures`);
      byKey.set(f.key, f);
    }
    assert.ok(keys.length > 20);
  });

  test('a contribution reads in percentage points with a " pp" suffix', () => {
    const family = vm.scopes[0]!;
    assert.equal(family.method, 'allocation x XIRR (an approximation, not an attribution)');
    const rows = family.lists.flatMap((l) => l.rows);
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.equal(r.contribution.value.kind, 'value');
      if (r.contribution.value.kind !== 'value') continue;
      assert.equal(r.contribution.display.text, `${formatIndian(r.contribution.value.v)} pp`);
      assert.ok(r.allocation.display.text.endsWith('%') && r.xirr.display.text.endsWith('%'));
    }
    assert.equal(family.coverageText, 'Contributions cover 6 holdings; none is left out.');
  });

  test('a missing figure is the marker alone, and a note gives its reason', () => {
    for (const v of [vmOf(standard), vmOf(rich), vmOf(load(files.get('irr-dates')!, 'irr-dates.xlsx'))]) {
      let missing = 0;
      for (const s of v.scopes) {
        const figures = [s.headline.fund, s.headline.bench, ...s.tree.flatMap((t) => [t.fund, t.bench]), ...s.lists.flatMap((l) => l.rows.flatMap((r) => [r.allocation, r.xirr, r.contribution]))];
        for (const f of figures) {
          if (f.value.kind !== 'missing') {
            assert.notEqual(f.display.text, MISSING_MARKER);
            continue;
          }
          missing++;
          assert.equal(f.display.text, MISSING_MARKER, `${f.key}: the marker alone`);
          assert.ok(f.notes.length > 0 && f.notes.every((id) => s.notes.some((n) => n.id === id)), `${f.key}: a note names its reason`);
        }
      }
      assert.ok(missing > 0);
    }
  });

  test('no en or em dash in any text, except the marker or the blank label alone (D-029)', () => {
    for (const v of [vmOf(standard), vmOf(rich)]) {
      for (const [path, s] of stringsOf(v)) {
        if (s === MISSING_MARKER) continue;
        assert.ok(!DASHES.test(s), `${path}: ${s}`);
      }
    }
  });
});

describe('reconciliation notes (OD-4, E-142, D13)', () => {
  const vm = vmOf(rich);
  const family = vm.scopes[0]!;
  const text = (id: string): string => family.notes.find((n) => n.id === id)?.text ?? '';

  test('the family scope lists IRR-only clients, redeemed instruments, invalid benchmarks, holdings without flows and the unassigned line', () => {
    assert.equal(text('reconcile-d13'), RECONCILE_D13_TEXT);
    assert.match(text('irr-only-clients'), /^1 client has flows in the transactions file and no holding in the base file.*Sample Client C \(2 flows\)\.$/);
    assert.match(text('redeemed'), /Legacy Liquid Plan \(Sample Client A\)/);
    assert.match(text('invalid-benchmark'), /Sample Balanced Advantage Fund - Regular Plan - Growth \(Sample Client B\), the benchmark flows give no rate/);
    assert.match(text('holdings-without-flows'), /^3 holdings of this scope have no flow/);
    const share = family.unassigned!.share;
    assert.equal(share.value.kind, 'value');
    assert.equal(text('unassigned'), `Flows without a distributor: 1 fund flow over 1 instrument, ${share.display.text} of the family's money paid in, reported on their own line and never spread across distributors (E-142).`);
    const redeemedRow = family.tree.find((t) => t.redeemed)!;
    assert.equal(redeemedRow.label, 'Legacy Liquid Plan');
    assert.equal(redeemedRow.redeemedText, 'Redeemed');
    assert.equal(redeemedRow.holdings, 0);
    assert.deepEqual(family.tree.map((t) => t.depth).slice(0, 5), [0, 1, 2, 3, 4]);
  });

  test('an adviser scope holding a split instrument does not reconcile: its figures are missing, with the reason', () => {
    const adviser = vm.scopes.find((s) => s.pickerLabel === 'Adviser: Centricity')!;
    assert.equal(adviser.reconciled, false);
    assert.equal(adviser.headline.fund.display.text, MISSING_MARKER);
    const note = adviser.notes.find((n) => n.id === 'not-reconciled')!.text;
    assert.match(note, /^This scope does not reconcile to its holdings, so its XIRR figures are missing \(insufficient evidence\): Sample Flexi Cap Fund/);
    assert.ok(!adviser.notes.some((n) => n.id === 'reconcile-d13'));
  });

  test('without a DISTRIBUTOR column the view says why no adviser is listed', () => {
    const v = vmOf(load(files.get('irr-by-content')!, 'irr-by-content.xlsx'));
    assert.equal(v.advisorText, 'The transactions (IRR) file has no DISTRIBUTOR column, so returns are not shown per adviser.');
    assert.equal(vmOf(standard).advisorText, null);
  });
});

describe('the IRR slot (U-13)', () => {
  test('MOD-04: whenever an IRR file is loaded, its notes say that its issues do not block the workbook download yet', () => {
    assert.equal(IRR_ISSUES_NOTICE, 'Issues in the transactions (IRR) file do not block the workbook download yet.');
    for (const [id, bytes] of [...files, ['rich', richBytes()] as const]) {
      const notes = buildIrrImportVM(load(bytes, `${id}.xlsx`));
      assert.equal(notes.notice, IRR_ISSUES_NOTICE, id);
    }
  });

  test('import notes: rows skipped by reason, unrecognised types and the issues summary', () => {
    const mixed = buildIrrImportVM(load(files.get('irr-mixed')!, 'irr-mixed.xlsx'));
    assert.deepEqual(mixed.skipped, [
      'Blank: 1 row skipped.', 'A repeated header: 1 row skipped.', 'Without a client: 1 row skipped.', 'Without an amount: 2 rows skipped.',
      'An amount that is not a number: 1 row skipped.',
    ]);
    assert.deepEqual(mixed.unrecognised, ['"Dividend Reinvest": 1 row', '"dividend reinvest": 1 row']);
    assert.match(mixed.issuesSummary, /warnings/);
    assert.deepEqual(mixed.issues.map((i) => i.severity), [...mixed.issues.map((i) => i.severity)].sort((a, b) => ['Blocking', 'High', 'Warning', 'Information'].indexOf(a) - ['Blocking', 'High', 'Warning', 'Information'].indexOf(b)));
    const std = buildIrrImportVM(standard);
    assert.equal(std.flowsText, '7 fund flows and 5 benchmark flows read; 0 rows skipped.');
    assert.deepEqual(std.skipped, []);
  });

  test('disabled until a base file is accepted; a file read waits for Accept; a file without fund flows is refused', () => {
    const none = { stage: null, loaded: null, error: null };
    const off = irrSlotView(none, false);
    assert.equal(off.disabled, true);
    assert.match(off.disabledReason!, /^Accept a base file first/);
    assert.equal(irrSlotView(none, true).disabled, false);
    const read = { stage: 'validate' as const, loaded: standard, error: null };
    assert.equal(irrSlotView(read, true).stage, 'preview');
    assert.equal(canAcceptIrr(read, true), true);
    assert.equal(canAcceptIrr(read, false), false);
    assert.equal(canAcceptIrr({ ...read, stage: 'review' }, true), false);
    const noFund = { stage: 'validate' as const, loaded: load(files.get('irr-no-fund')!, 'irr-no-fund.xlsx'), error: null };
    const refused = irrSlotView(noFund, true);
    assert.equal(refused.chip, 'Refused');
    assert.equal(refused.stage, 'validate');
    assert.match(refused.refusal!, /^Refused: no sheet holds fund flows/);
    assert.equal(refused.canAccept, false);
  });
});

// MOD-04's answers to Gate B: the words of the benchmark coverage (R2), the dates (R3) and the contribution lines (R4),
// on irr-matched (family partial, Centricity full, Other Distributor none; see tests/unit/engine/review-returns.test.ts).
describe('benchmark coverage, dates and contribution lines (R2, R3, R4)', () => {
  const matched = vmOf(load(files.get('irr-matched')!, 'irr-matched.xlsx'));
  const byPicker = (p: string) => matched.scopes.find((s) => s.pickerLabel === p)!;

  test('R2: partial and none are said beside the headline benchmark; full says nothing', () => {
    assert.equal(byPicker('Family').headline.benchCoverageText,
      'The benchmark XIRR covers 2 of the 3 instruments with fund flows; 1 instrument has no benchmark flow and is left out, so the benchmark covers less of the money paid in than the fund XIRR.');
    assert.equal(byPicker('Adviser: Centricity').headline.benchCoverageText, null);
    assert.equal(byPicker('Adviser: Other Distributor').headline.benchCoverageText,
      'The benchmark XIRR covers no instrument: the one instrument with fund flows has no benchmark flow.');
    assert.equal(benchCoverageText({ share: 0, basis: 'flows-in', included: 0, excluded: 3 }),
      'The benchmark XIRR covers no instrument: none of the 3 instruments with fund flows has a benchmark flow.');
  });

  test('R3: the dates line always; a note when the dates differ, and the count of flows after the as-on date', () => {
    assert.equal(matched.datesText, 'Last fund flow in the transactions file: 31 Mar 2025. As-on date of the review: 30 Sep 2026.');
    assert.deepEqual(matched.datesNotes, [
      'The last fund flow (31 Mar 2025) is not on the as-on date (30 Sep 2026): the XIRR figures run to the last fund flow, while the holdings and their allocation are as on the as-on date.',
    ]);
    const last = ymdToDay(2025, 3, 31)!;
    assert.deepEqual(datesWords({ lastFlowDay: last, asOnDay: last, flowsAfterAsOn: 0 }).datesNotes, [], 'equal: no note');
    const after = datesWords({ lastFlowDay: last, asOnDay: ymdToDay(2024, 1, 1)!, flowsAfterAsOn: 4 });
    assert.equal(after.datesText, 'Last fund flow in the transactions file: 31 Mar 2025. As-on date of the review: 1 Jan 2024.');
    assert.equal(after.datesNotes.length, 2);
    assert.equal(after.datesNotes[1], '4 fund flows are dated after the as-on date (1 Jan 2024); they are included in every figure.');
    assert.equal(datesWords({ lastFlowDay: last, asOnDay: last, flowsAfterAsOn: 1 }).datesNotes[0], '1 fund flow is dated after the as-on date (31 Mar 2025); it is included in every figure.');
    assert.deepEqual(datesWords({ lastFlowDay: last, asOnDay: null, flowsAfterAsOn: null }).datesNotes, ['The as-on date is not set, so the last fund flow is not compared with it.']);
    for (const t of [matched.datesText, ...matched.datesNotes, ...after.datesNotes]) assert.ok(!DASHES.test(t), t);
  });

  test('R4: each line once with its roles; the lines are exactly the lines of the three lists', () => {
    for (const s of matched.scopes) {
      const keys = s.lines.map((l) => l.key);
      assert.equal(new Set(keys).size, keys.length, `${s.key}: no line twice`);
      const inLists = new Set(s.lists.flatMap((l) => l.rows.map((r) => r.key)));
      assert.deepEqual(new Set(keys), inLists, s.key);
      for (const line of s.lines) {
        assert.deepEqual(line.roles, s.lists.filter((l) => l.rows.some((r) => r.key === line.key)).map((l) => l.id), line.key);
        assert.match(line.roleText, /^(Contributor|Laggard|Drag)(; (laggard|drag))*$/);
      }
    }
  });

  test('the screen keeps its words; no user-facing text says "advisor"', () => {
    const texts = matched.scopes.flatMap((s) => [s.pickerLabel, ...s.notes.map((n) => n.text), s.headline.benchCoverageText ?? '']);
    for (const t of [...texts, matched.datesText, buildReturnsVM(returnsForReview(run.review, load(files.get('irr-by-content')!, 'x.xlsx').irr), run.review).advisorText ?? '']) {
      assert.ok(!/advisor/i.test(t), t);
    }
  });
});
