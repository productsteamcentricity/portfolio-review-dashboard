// covers: E-85 U-28 E-142 E-29 BR-2.1 (independent known answers on screen and in the Fund IRR sheet; Gate B C2 and R4, NB-03)
// The synthetic base book (syn-standard, as on 30 Sep 2026) with irr-known (tests/fixtures/make-irr-files.ts
// knownSheets), whose XIRRs are worked on paper, never taken from the code. Every pair of flows is 365 days apart
// (1 Jan 2023 to 1 Jan 2024), so each XIRR is the plain growth over the year:
//   A's Bluechip (Centricity): -10,000 then +11,000: 10.00%; benchmark -10,000 then +10,500: 5.00%.
//   B's Balanced Advantage (no distributor): -8,000 then +7,200: -10.00%; benchmark -8,000 then +7,600: -5.00%.
//   Family: -18,000 then +18,200: 200 / 18,000 = 1.1111%, "1.11%"; benchmark -18,000 then +18,100: 0.5556%, "0.56%".
//   Unassigned line: 8,000 of the 18,000 paid in = 44.4444%, "44.44%"; its XIRRs are B's: -10.00% and -5.00%.
// Contributions (allocation over the scope's market value in Crore x XIRR / 100, in pp):
//   Client B (Balanced 0.339, Gold ETF 0.131, PMS 0.91; total 1.38): Balanced 0.339 / 1.38 = 24.5652% x -10% = -2.4565 pp,
//   "-2.46 pp"; PMS 65.9420% x 16 = 10.5507 pp; Gold 9.4928% x 18.4 = 1.7467 pp. Three lines, so all three are
//   contributors (the top five) and Balanced is also a drag: "Contributor; drag". Sum 9.8409 pp, each line once.
//   Family (total 3.353): Balanced 0.339 / 3.353 = 10.1104% x -10% = -1.0110 pp, "-1.01 pp"; the five other lines are
//   positive, so they are the contributors and Balanced is the one laggard and the one drag: "Laggard; drag".
// Each figure is asserted as the screen text (the view-model's display), as the sheet cell's number with its number
// format (read in that format by tests/helpers/excel-text.ts, written apart from the app's formatter) and as t="n".

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReadCell, ReadWorkbook } from '../helpers/xlsx-read.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM, PP_SUFFIX } from '../../app/src/views/returns.ts';
import type { Figure } from '../../app/src/views/overview-vm.ts';
import type { ReturnsScopeVM } from '../../app/src/views/returns-vm.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { colName, numberFormatAt, readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { excelFormatText } from '../helpers/excel-text.ts';
import { irrFixtures } from '../fixtures/make-irr-files.ts';

const PCT_FORMAT = '#,##0.00"%"';
const w = nodeWiring();
const { review, vm } = reviewOf(w, fixtureById('syn-standard'));
const l = w.loadIrrFile!(irrFixtures().find((f) => f.id === 'irr-known')!.bytes, 'irr-known.xlsx');
if (!('irr' in l)) throw new Error(`irr-known: ${l.kind}`);
const returns = buildReturnsVM(returnsForReview(review, l.irr), review, { source: l.source });
const wb: ReadWorkbook = readXlsx(buildOverviewWorkbook(workbookInputFrom(review, vm, returns)));
const SHEET = 'Fund IRR';
const table = sheetTable(sheetByName(wb, SHEET));
const header = table[0]!;
const col = (name: string): number => {
  const i = header.indexOf(name);
  assert.ok(i >= 0, `column ${name}`);
  return i;
};

const scope = (pickerLabel: string): ReturnsScopeVM => {
  const s = returns.scopes.find((x) => x.pickerLabel === pickerLabel);
  assert.ok(s, pickerLabel);
  return s;
};
/** The sheet row index of the first row of a scope and part whose Label passes `label`. */
const rowOf = (scopeLabel: string, part: string, label: (s: string) => boolean): number => {
  const i = table.findIndex((r) => r[col('Scope')] === scopeLabel && r[col('Part')] === part && label(String(r[col('Label')] ?? '')));
  assert.ok(i > 0, `${scopeLabel} ${part}`);
  return i;
};
const cellAt = (row: number, column: string): { ref: string; cell: ReadCell } => {
  const ref = `${colName(col(column))}${row + 1}`;
  const cell = sheetByName(wb, SHEET).cells.get(ref);
  assert.ok(cell, `${SHEET}!${ref}`);
  return { ref, cell };
};

/** A figure: the screen text, and the sheet cell's number, type and format reading as that text. */
function known(f: Figure, screen: string, value: number, row: number, column: string, kind: 'pct' | 'pp'): void {
  assert.equal(f.display.text, screen, `${f.key}: screen text`);
  assert.equal(f.shown.kind, 'value', f.key);
  const { ref, cell } = cellAt(row, column);
  assert.equal(cell.t, 'n', `${ref}: t="n"`);
  assert.equal(typeof cell.v, 'number', ref);
  assert.ok(Math.abs((cell.v as number) - value) < 1e-6, `${ref} = ${String(cell.v)}, hand-worked ${value}`);
  const fmt = numberFormatAt(wb, SHEET, ref);
  if (kind === 'pct') {
    assert.equal(fmt, PCT_FORMAT, `${ref}: the percent format, a literal % with no x100`);
    assert.equal(excelFormatText(cell.v as number, fmt), screen, `${ref} reads as the screen`);
  } else {
    assert.ok(!fmt.includes('%'), `${ref}: percentage points are not formatted as percent`);
    assert.equal(`${excelFormatText(cell.v as number, fmt)}${PP_SUFFIX}`, screen, `${ref} reads as the screen, less " pp"`);
  }
}

describe('irr-known: hand-worked answers on screen and in the sheet (Gate B C2)', () => {
  test('family headline: fund 1.11% (200 / 18,000) and benchmark 0.56% (100 / 18,000)', () => {
    const f = scope('Family');
    const r = rowOf('Family', 'Headline', (t) => t === 'Family');
    known(f.headline.fund, '1.11%', (200 / 18000) * 100, r, 'Fund XIRR (%)', 'pct');
    known(f.headline.bench, '0.56%', (100 / 18000) * 100, r, 'Benchmark XIRR (%)', 'pct');
  });

  test('tree: Bluechip 10.00% against 5.00%; Balanced Advantage -10.00% against -5.00%', () => {
    const f = scope('Family');
    for (const [prefix, fund, bench] of [['Sample Bluechip', 10, 5], ['Sample Balanced Advantage', -10, -5]] as const) {
      const t = f.tree.find((x) => x.level === 'instrument' && x.label.startsWith(prefix))!;
      assert.ok(t, prefix);
      const r = rowOf('Family', 'Tree', (s) => s.startsWith(prefix));
      known(t.fund, `${fund.toFixed(2)}%`, fund, r, 'Fund XIRR (%)', 'pct');
      known(t.bench, `${bench.toFixed(2)}%`, bench, r, 'Benchmark XIRR (%)', 'pct');
    }
  });

  test('the unassigned line: 44.44% of the money paid in (8,000 / 18,000), under its own header; XIRRs -10.00% and -5.00%', () => {
    const u = scope('Family').unassigned!;
    assert.ok(u);
    const r = rowOf('Family', 'Unassigned', () => true);
    known(u.share, '44.44%', (8000 / 18000) * 100, r, 'Share of Money Paid In (%)', 'pct');
    known(u.fund, '-10.00%', -10, r, 'Fund XIRR (%)', 'pct');
    known(u.bench, '-5.00%', -5, r, 'Benchmark XIRR (%)', 'pct');
    assert.equal(table[r]![col('Allocation (%)')], null, 'R5: nothing under Allocation');
  });

  test('a negative contribution: Balanced Advantage in client B, -2.46 pp (24.5652% x -10%), "Contributor; drag"', () => {
    const b = scope('Client: Sample Client B');
    const line = b.lines.find((x) => x.label.startsWith('Sample Balanced Advantage'))!;
    assert.ok(line);
    const r = rowOf('Sample Client B', 'Contribution', (s) => s.startsWith('Sample Balanced Advantage'));
    known(line.contribution, '-2.46 pp', (0.339 / 1.38) * 100 * -10 / 100, r, 'Contribution (pp)', 'pp');
    known(line.allocation, '24.57%', (0.339 / 1.38) * 100, r, 'Allocation (%)', 'pct');
    known(line.xirr, '-10.00%', -10, r, 'Fund XIRR (%)', 'pct');
    assert.equal(table[r]![col('Role')], 'Contributor; drag');
  });

  test('Centricity: A\'s Bluechip alone, 10.00% against 5.00%', () => {
    const c = scope('Adviser: Centricity');
    const r = rowOf('Centricity', 'Headline', (t) => t === 'Adviser: Centricity');
    known(c.headline.fund, '10.00%', 10, r, 'Fund XIRR (%)', 'pct');
    known(c.headline.bench, '5.00%', 5, r, 'Benchmark XIRR (%)', 'pct');
  });
});

describe('irr-known: no line twice in the sheet, no double count (R4)', () => {
  test('family: Balanced Advantage is both laggard and drag, written once as "Laggard; drag", -1.01 pp', () => {
    const f = scope('Family');
    assert.ok(f.lists.find((x) => x.id === 'laggards')!.rows.some((x) => x.label.startsWith('Sample Balanced Advantage')));
    assert.ok(f.lists.find((x) => x.id === 'drags')!.rows.some((x) => x.label.startsWith('Sample Balanced Advantage')));
    const rows = table.filter((r) => r[col('Scope')] === 'Family' && String(r[col('Label')] ?? '').startsWith('Sample Balanced Advantage') && r[col('Part')] === 'Contribution');
    assert.equal(rows.length, 1, 'written once');
    assert.equal(rows[0]![col('Role')], 'Laggard; drag');
    const r = rowOf('Family', 'Contribution', (s) => s.startsWith('Sample Balanced Advantage'));
    known(f.lines.find((x) => x.label.startsWith('Sample Balanced Advantage'))!.contribution, '-1.01 pp', (0.339 / 3.353) * 100 * -10 / 100, r, 'Contribution (pp)', 'pp');
  });

  test('every scope: each line once; the Contribution (pp) sum of a scope counts each line once (client B: 9.8409 pp)', () => {
    for (const s of returns.scopes) {
      const rows = table.filter((r) => r[col('Scope')] === s.label && r[col('Part')] === 'Contribution');
      const labels = rows.map((r) => String(r[col('Label')]));
      assert.equal(new Set(labels).size, labels.length, `${s.key}: no line twice`);
      assert.equal(rows.length, s.lines.length, s.key);
    }
    const b = table.filter((r) => r[col('Scope')] === 'Sample Client B' && r[col('Part')] === 'Contribution');
    const sum = b.reduce((t, r) => t + (r[col('Contribution (pp)')] as number), 0);
    // Hand-worked: 0.91 / 1.38 x 16 + 0.131 / 1.38 x 18.4 + 0.339 / 1.38 x -10, in pp.
    const hand = (0.91 / 1.38) * 16 + (0.131 / 1.38) * 18.4 + (0.339 / 1.38) * -10;
    assert.ok(Math.abs(sum - hand) < 1e-9, `${sum} against ${hand}`);
    assert.ok(Math.abs(hand - 9.8409) < 0.0001);
  });
});
