// covers: U-28 E-85 BR-2.1 (one returns figure, one text, on screen and in the Fund IRR sheet; M3a wiring, NB-03)
// For the synthetic base book (syn-standard) with each synthetic IRR file that can be accepted, every headline figure
// of the returns view-model (returns.<scope>.fund and .bench) is joined by key to the cell _manifest names: a present
// figure is that cell's number, which reads in its own number format (tests/helpers/excel-text.ts, written apart from
// the app's formatter) as the screen text; a missing one is the marker alone on screen and a blank cell in the sheet.
// Gate B C3: the same for every tree, contribution-line (allocation, XIRR, contribution in pp) and unassigned figure
// (the share of money paid in and its XIRRs) of every scope, joined by scope, part and order; every value cell is t="n".

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSING_MARKER } from '../../app/src/config/formats.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM, PP_SUFFIX, returnsHeadlineFigures } from '../../app/src/views/returns.ts';
import type { Figure } from '../../app/src/views/overview-vm.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { closeTo } from '../helpers/formula-eval.ts';
import { colName, numberFormatAt, readXlsx, sheetByName, sheetTable, splitRef } from '../helpers/xlsx-read.ts';
import { excelFormatText, withoutZeroSign } from '../helpers/excel-text.ts';
import { irrFixtures } from '../fixtures/make-irr-files.ts';

const w = nodeWiring();
const { review, vm } = reviewOf(w, fixtureById('syn-standard'));

for (const id of ['irr-standard', 'irr-dates', 'irr-by-content', 'irr-two-fund-sheets', 'irr-matched', 'irr-known']) {
  describe(id, () => {
    test('screen text equals the Fund IRR cell for every headline figure key', () => {
      const l = w.loadIrrFile!(irrFixtures().find((f) => f.id === id)!.bytes, `${id}.xlsx`);
      if (!('irr' in l)) throw new Error(`${id}: ${l.kind}`);
      const returns = buildReturnsVM(returnsForReview(review, l.irr), review, { source: l.source });
      const wb = readXlsx(buildOverviewWorkbook(workbookInputFrom(review, vm, returns)));
      const manifest = new Map<string, string>();
      for (const row of sheetTable(sheetByName(wb, '_manifest'))) {
        if (typeof row[0] === 'string' && row[0].startsWith('figure returns.')) manifest.set(row[0].slice('figure '.length), String(row[1]));
      }
      const figures = returnsHeadlineFigures(returns);
      assert.equal(manifest.size, figures.length, 'one _manifest row per headline figure');
      let present = 0;
      for (const f of figures) {
        const at = manifest.get(f.key);
        assert.ok(at, `${f.key}: recorded`);
        const [sheet, cell] = at.split('!') as [string, string];
        assert.equal(sheet, 'Fund IRR');
        const v = sheetByName(wb, sheet).cells.get(cell)?.v ?? null;
        if (f.shown.kind === 'missing') {
          assert.equal(f.display.text, MISSING_MARKER, `${f.key}: the marker alone on screen`);
          assert.ok(v === null || v === '', `${f.key}: a blank cell at ${at}, not ${String(v)}`);
        } else {
          present++;
          assert.equal(typeof v, 'number', `${f.key}: ${at} holds a number`);
          assert.ok(closeTo(v as number, f.shown.v), `${f.key}: ${at} = ${String(v)}, the figure is ${f.shown.v}`);
          assert.equal(withoutZeroSign(excelFormatText(v as number, numberFormatAt(wb, sheet, cell))), f.display.text, `${f.key}: ${at} reads as the screen text`);
        }
      }
      if (id === 'irr-standard') assert.ok(present >= 6, `${present} present figures`);
    });

    // Gate B C3: beyond the headline, every tree, allocation, contribution and unassigned figure of every scope.
    test('screen text equals the Fund IRR cell for every tree, contribution-line and unassigned figure; every value cell is t="n"', () => {
      const l = w.loadIrrFile!(irrFixtures().find((f) => f.id === id)!.bytes, `${id}.xlsx`);
      if (!('irr' in l)) throw new Error(`${id}: ${l.kind}`);
      const returns = buildReturnsVM(returnsForReview(review, l.irr), review, { source: l.source });
      const wb = readXlsx(buildOverviewWorkbook(workbookInputFrom(review, vm, returns)));
      const sheet = sheetByName(wb, 'Fund IRR');
      const table = sheetTable(sheet);
      const header = table[0]!;
      const col = (name: string): number => { const i = header.indexOf(name); assert.ok(i >= 0, name); return i; };
      let checked = 0;
      const same = (f: Figure, row: number, column: string, kind: 'pct' | 'pp'): void => {
        const ref = `${colName(col(column))}${row + 1}`;
        const cell = sheet.cells.get(ref);
        if (f.shown.kind === 'missing') {
          assert.equal(f.display.text, MISSING_MARKER, `${f.key}: the marker alone on screen`);
          assert.ok(!cell || cell.v === null || cell.v === '', `${f.key}: a blank cell at ${ref}`);
          return;
        }
        checked++;
        assert.ok(cell && cell.t === 'n' && typeof cell.v === 'number', `${f.key}: ${ref} is a number cell (t="n")`);
        assert.ok(closeTo(cell.v as number, f.shown.v), `${f.key}: ${ref} = ${String(cell.v)}, the figure is ${f.shown.v}`);
        const text = withoutZeroSign(excelFormatText(cell.v as number, numberFormatAt(wb, 'Fund IRR', ref)));
        assert.equal(kind === 'pp' ? `${text}${PP_SUFFIX}` : text, f.display.text, `${f.key}: ${ref} reads as the screen text`);
        if (kind === 'pp') assert.ok(!text.includes('%'), `${f.key}: pp is not formatted as percent`);
      };
      for (const s of returns.scopes) {
        const rowsOf = (part: string): number[] => table.map((r, i) => (r[col('Scope')] === s.label && r[col('Part')] === part ? i : -1)).filter((i) => i > 0);
        const tree = rowsOf('Tree');
        assert.equal(tree.length, s.tree.length, `${s.key}: one row per tree node`);
        s.tree.forEach((t, i) => { same(t.fund, tree[i]!, 'Fund XIRR (%)', 'pct'); same(t.bench, tree[i]!, 'Benchmark XIRR (%)', 'pct'); });
        const lines = rowsOf('Contribution');
        assert.equal(lines.length, s.lines.length, `${s.key}: one row per contribution line`);
        s.lines.forEach((c, i) => {
          same(c.allocation, lines[i]!, 'Allocation (%)', 'pct');
          same(c.xirr, lines[i]!, 'Fund XIRR (%)', 'pct');
          same(c.contribution, lines[i]!, 'Contribution (pp)', 'pp');
        });
        const un = rowsOf('Unassigned');
        assert.equal(un.length, s.unassigned ? 1 : 0, `${s.key}: the unassigned line`);
        if (s.unassigned) {
          same(s.unassigned.share, un[0]!, 'Share of Money Paid In (%)', 'pct');
          same(s.unassigned.fund, un[0]!, 'Fund XIRR (%)', 'pct');
          same(s.unassigned.bench, un[0]!, 'Benchmark XIRR (%)', 'pct');
        }
      }
      // Every value cell of the sheet (figures, flows, holdings) holds a number of type n, never text.
      const valueCols = ['Fund XIRR (%)', 'Benchmark XIRR (%)', 'Flows', 'Allocation (%)', 'Share of Money Paid In (%)', 'Contribution (pp)', 'Holdings'].map(col);
      for (const cell of sheet.cells.values()) {
        const { col: c, row } = splitRef(cell.ref);
        if (row === 1 || !valueCols.includes(c) || cell.v === null) continue;
        assert.ok(cell.t === 'n' && typeof cell.v === 'number', `${cell.ref}: t="${cell.t}", ${String(cell.v)}`);
      }
      if (id === 'irr-standard') assert.ok(checked >= 20, `${checked} present figures beyond the headline`);
    });
  });
}
