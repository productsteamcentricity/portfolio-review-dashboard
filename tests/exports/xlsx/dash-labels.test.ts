// covers: E-22 E-18 E-77 E-79 BR-14.3 D-029 D-039
// Labels with an en or em dash (the financial review of the first M1.4 run: the workbook threw "no product key for
// 'PMS - Equity'"). The engine's label is the join key everywhere (allocation rows' product and liquidity, the figure
// keys, the workbook's product and liquidity keys); plainText applies to the text shown only, so two labels that print
// alike keep their own rows, keys and formulas. On syn-dash-labels (tests/fixtures/make-books.ts), by hand in Crore:
//   Equity 0.625 + 0.452 + 0.896 + 0.91 = 2.883 of 3.353 (85.98%): PMS 0.91, "A - B" 0.896, "PMS - Equity" 0.625,
//   "A - B" (an en dash in the file) 0.452; liquidity "T-3" (en dash) 0.625 + 0.339 = 0.964 (28.75%), "T-1" (em dash)
//   0.452 (13.48%), Daily 0.896 + 0.131 + 0.91 = 1.937 (57.77%).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Figure, OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { checkWorkbookBytes } from '../../../scripts/office/run-acceptance.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { evaluateAll, readWorkbookForEval, closeTo } from '../../helpers/formula-eval.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { DASH_LIQUIDITY, DASH_PAIR, DASH_PRODUCT } from '../../fixtures/make-books.ts';

function figures(vm: OverviewVM): Figure[] {
  const out = new Set<Figure>();
  for (const k of vm.kpis) out.add(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage].forEach((f) => out.add(f));
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) { out.add(c.cmv); out.add(c.share); }
    for (const r of m.rows) { r.cells.forEach((f) => out.add(f)); out.add(r.total); }
  }
  return [...out];
}

for (const id of ['syn-dash-labels', 'family-a-dash-labels']) {
  describe(id, () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, fixtureById(id));

    test('the view-model: the engine\'s label in product, liquidity and the keys; plainText in the label shown', () => {
      const products = vm.allocation.rows.filter((r) => r.kind === 'product' && r.asset === 'Equity');
      for (const raw of [DASH_PRODUCT, DASH_PAIR[0], DASH_PAIR[1]]) {
        const r = products.find((x) => x.product === raw)!;
        assert.ok(r, raw);
        assert.equal(r.label, raw.replace(/[–—]/g, '-'));
        assert.equal(r.cmv.key, `alloc.product.Equity.${raw}.cmv`);
      }
      const pair = products.filter((r) => r.label === 'A - B');
      assert.equal(pair.length, 2, 'two rows that print alike');
      assert.notEqual(pair[0]!.cmv.key, pair[1]!.cmv.key);
      assert.deepEqual(vm.liquidity.rows.filter((r) => r.liquidity !== 'Daily').map((r) => [r.liquidity, r.label]),
        [[DASH_LIQUIDITY[0], 'T-3'], [DASH_LIQUIDITY[1], 'T-1']]);
      const keys = figures(vm).map((f) => f.key);
      assert.equal(new Set(keys).size, keys.length, 'every figure key is unique');
    });

    test('the workbook builds; every formula evaluates to its cached value and to its figure', async () => {
      await w.exportWorkbook(review, vm);
      const bytes = w.last.xlsx!.bytes;
      const check = checkWorkbookBytes(bytes);
      assert.ok(check.pass, JSON.stringify(check.checks.filter((c) => !c.ok)));
      const v = evaluateAll(readWorkbookForEval(bytes));
      const wb = readXlsx(bytes);
      const manifest = new Map<string, string>();
      for (const [k, at] of sheetTable(sheetByName(wb, '_manifest'))) if (typeof k === 'string' && k.startsWith('figure ')) manifest.set(k.slice(7), String(at));
      let n = 0;
      for (const f of figures(vm)) {
        const at = manifest.get(f.key);
        if (!at || f.shown.kind !== 'value') continue;
        assert.ok(closeTo(v.get(at) as number, f.shown.v), `${f.key} at ${at}`);
        n += 1;
      }
      assert.ok(n > 40, `${n} figures checked`);
      // The overview sheets show the text of the screen: no en or em dash in their cells.
      for (const name of ['Portfolio Overview', 'Client Allocation', 'Distributor Allocation']) {
        if (!wb.sheets.some((s) => s.name === name)) continue;
        for (const row of sheetTable(sheetByName(wb, name))) for (const c of row) assert.ok(typeof c !== 'string' || !/[–—]/.test(c), `${name}: ${String(c)}`);
      }
      await w.exportDeck(review, vm, null);
      assert.ok(w.last.pptx!.bytes.length > 0, 'the deck builds too');
    });

    if (id === 'syn-dash-labels') {
      test('the known answers: each row of the pair is its own SUMIFS over its own product key', async () => {
        await w.exportWorkbook(review, vm);
        const bytes = w.last.xlsx!.bytes;
        const v = evaluateAll(readWorkbookForEval(bytes));
        const t = sheetTable(sheetByName(readXlsx(bytes), 'Portfolio Overview'));
        // Rows 2 to 6: Equity, then its products by CMV; row 11 the Grand Total; rows 12 to 14 the liquidity lines.
        assert.deepEqual(t.slice(1, 7).map((r) => [r[1], r[2], r[4]]), [
          ['Equity', null, 'Equity'], ['Equity', 'PMS', 'P05'], ['Equity', 'A - B', 'P03'], ['Equity', 'PMS - Equity', 'P01'], ['Equity', 'A - B', 'P02'],
          ['Hybrid', null, 'Hybrid'],
        ]);
        for (const [cell, want] of [['G2', 2.883], ['G3', 0.91], ['G4', 0.896], ['G5', 0.625], ['G6', 0.452], ['G11', 3.353], ['G12', 0.964], ['G13', 0.452], ['G14', 1.937]] as const) {
          assert.ok(closeTo(v.get(`Portfolio Overview!${cell}`) as number, want), `${cell} = ${String(v.get(`Portfolio Overview!${cell}`))}, by hand ${want}`);
        }
        assert.deepEqual(t.slice(11, 14).map((r) => [r[3], r[4]]), [['T-3', 'L01'], ['T-1', 'L02'], ['Daily', 'L03']]);
        assert.deepEqual(vm.liquidity.rows.map((r) => r.pct.display.text), ['28.75%', '13.48%', '57.77%']);
        assert.equal(vm.allocation.rows[0]!.pct.display.text, '85.98%');
      });
    }
  });
}
