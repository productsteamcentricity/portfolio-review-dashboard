// covers: E-21 E-22 E-24 E-52 E-77 E-79 E-03 OD-18 OD-21 KI-147 D-039 M1.4
// The portfolio overview end to end, through the wiring of the page (tests/helpers/node-wiring.ts: the real reader,
// engine, view-model, deck and workbook): for each fixture of the hand-worked OVERVIEW_ANSWERS (never computed by app
// code), the screen's figures equal the known displays; the deck's KPI and table text equal them; and every workbook
// formula, evaluated independently (tests/helpers/formula-eval.ts), equals its cached value and the figure it carries.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import { OVERVIEW_ANSWERS, type Shown } from '../fixtures/overview-answers.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { slideInventory, textAt } from '../helpers/slide-inventory.ts';
import { readWorkbookForEval, evaluateAll, isError, closeTo } from '../helpers/formula-eval.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';

const shown = (f: { display: { text: string; marker: string | null } }): Shown =>
  ({ text: f.display.text, marker: (f.display.marker as 'p' | null) ?? null });
const rowsOf = (vm: OverviewVM) => vm.allocation.rows.filter((r) => r.kind !== 'liquidity');
const { JSZip } = loadPptxGenJS();

for (const [id, ans] of Object.entries(OVERVIEW_ANSWERS)) {
  describe(id, () => {
    const w = nodeWiring();
    const run = reviewOf(w, fixtureById(id));
    const { review, vm } = run;

    test('the screen: display unit, KPIs, allocation rows, pie labels and matrices equal the known answers', () => {
      assert.equal(vm.meta.unit, ans.displayUnit);
      const k = Object.fromEntries(vm.kpis.map((x) => [x.id, shown(x.figure)]));
      assert.deepEqual(k, ans.kpis);
      const rows = rowsOf(vm);
      assert.deepEqual(rows.map((r) => [r.kind, r.label]), ans.rows.map((r) => [r.kind, r.label]));
      rows.forEach((r, i) => {
        const want = ans.rows[i]!;
        assert.deepEqual(shown(r.invested), want.shown.invested, `${r.label} invested`);
        assert.equal(r.cmv.display.text, want.shown.cmv, `${r.label} cmv`);
        assert.equal(r.pct.display.text, want.shown.pct, `${r.label} pct`);
      });
      assert.deepEqual(vm.charts.asset.slices.map((s) => ({ category: s.category, label: s.label })), ans.chartLabels);
      assert.deepEqual(vm.liquidity.rows.map((r) => r.label), ans.liquidity.map((l) => l.label));
      for (const [m, cols] of [[vm.matrices.client, ans.clients], [vm.matrices.distributor, ans.distributors]] as const) {
        if (!m.shown) continue;
        assert.deepEqual(m.columns.map((c) => [c.label, c.cmv.display.text, c.share.display.text]),
          cols.map((c) => [c.label, c.shown.cmv, c.shown.share]), m.level);
      }
      assert.deepEqual(vm.excluded.names, ans.excluded);
      assert.equal(review.gate.blocking, 0, 'no Blocking result once the as-on date is set');
    });

    test('the deck: the KPI and table text of C-08 are the screen figures, the pie labels the screen labels', async () => {
      const exported = await w.exportDeck(review, vm, null);
      const kept = w.last.pptx!;
      assert.equal(exported.bytes, kept.bytes.length);
      const inv = await slideInventory(kept.bytes, JSZip);
      const c08 = kept.deck!.components.find((c) => c.id === 'C-08')!.result;
      const byKey = new Map<string, { display: { text: string; marker: string | null } }>();
      for (const kpi of vm.kpis) byKey.set(kpi.figure.key, kpi.figure);
      for (const r of vm.allocation.rows) for (const f of [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage]) byKey.set(f.key, f);
      const labels = new Map(vm.charts.asset.slices.concat(vm.charts.liquidity.slices).map((s) => [s.pct.key, s.label]));
      let checked = 0;
      for (const loc of c08.figures) {
        const slide = inv.slides[loc.page - 1]!;
        const got = textAt(slide, loc.cell);
        if (loc.cell.startsWith('pie:')) {
          assert.equal(got, labels.get(loc.key), `${loc.cell}`);
        } else {
          const f = byKey.get(loc.key);
          assert.ok(f, `figure ${loc.key} is in the view-model`);
          assert.equal(got, f.display.text + (f.display.marker ?? ''), `${loc.cell} (${loc.key})`);
        }
        checked += 1;
      }
      assert.ok(checked >= ans.rows.length * 3, `${checked} figure locations checked`);
      assert.ok(!/[–—]\S|\S[–—]|\s[–—]\s\S/.test(inv.slides.map((s) => s.xml).join('\n').replace(/<a:t>—<\/a:t>/g, '')),
        'no en or em dash inside a sentence of the deck');
    });

    test('the workbook: every formula evaluates without error to its cached value, and each figure cell is the figure', async () => {
      await w.exportWorkbook(review, vm);
      const bytes = w.last.xlsx!.bytes;
      const ev = readWorkbookForEval(bytes);
      const values = evaluateAll(ev);
      assert.ok(values.size > 0, 'the workbook has formulas');
      for (const [ref, v] of values) {
        assert.ok(!isError(v), `${ref} evaluates to an error`);
        const [sheet, cell] = ref.split('!') as [string, string];
        const cached = ev.sheets.get(sheet.toLowerCase())!.cells.get(cell)!.cached;
        if (typeof v === 'number') assert.ok(typeof cached === 'number' && closeTo(v, cached), `${ref}: ${v} != cached ${String(cached)}`);
      }
      const wb = readXlsx(bytes);
      const manifest = sheetTable(sheetByName(wb, '_manifest'));
      const figureRows = manifest.filter((r) => typeof r[0] === 'string' && r[0].startsWith('figure '));
      assert.ok(figureRows.length > 0, '_manifest lists the figure cells');
      const kpiCmv = vm.kpis.find((k) => k.id === 'cmv')!.figure;
      const row = figureRows.find((r) => r[0] === `figure ${kpiCmv.key}`);
      if (row) {
        const at = String(row[1]);
        const v = values.get(at);
        assert.ok(typeof v === 'number' && kpiCmv.shown.kind === 'value' && closeTo(v, kpiCmv.shown.v), `${at} is the total CMV`);
      }
    });
  });
}

