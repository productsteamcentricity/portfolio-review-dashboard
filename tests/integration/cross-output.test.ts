// covers: BR-2.1 BR-14.3 U-18 U-19 U-20 U-52 E-123 OD-21 D-039 M1.4
// One figure, one text, in every output (BR-2.1, BR-14.3). The outputs are joined by the view-model's registry key
// (Figure.key): renderC08 records where each figure prints on the slide, and the workbook's _manifest lists the
// '<sheet>!<cell>' of each figure it writes. For every key present in two or more outputs, the screen text (the
// figure's display), the slide text read back from the pptx, and the sheet value (evaluated independently, then put
// through the same formatter) are equal after display rounding. A missing figure is the marker alone on screen and
// slide, and a blank cell in the workbook.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Figure, OverviewVM } from '../../app/src/views/overview-vm.ts';
import { formatIndian } from '../../app/src/views/format.ts';
import { MISSING_MARKER } from '../../app/src/config/formats.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { slideInventory, textAt } from '../helpers/slide-inventory.ts';
import { readWorkbookForEval, evaluateAll, closeTo } from '../helpers/formula-eval.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';

const { JSZip } = loadPptxGenJS();

/** Every figure of the view-model by key (the pies and the matrices' totals repeat figures by identity). */
function figuresByKey(vm: OverviewVM): Map<string, Figure> {
  const out = new Map<string, Figure>();
  const add = (f: Figure): void => {
    const was = out.get(f.key);
    assert.ok(!was || was === f || JSON.stringify(was.display) === JSON.stringify(f.display), `key ${f.key} names two different figures`);
    out.set(f.key, f);
  };
  for (const k of vm.kpis) add(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage].forEach(add);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) { add(c.cmv); add(c.share); }
    for (const r of m.rows) { r.cells.forEach(add); add(r.total); }
  }
  for (const p of [vm.charts.asset, vm.charts.liquidity]) for (const s of p.slices) add(s.pct);
  return out;
}

/** A sheet number through the screen's formatter, with the decimals and the "%" of the figure's own display. */
function asScreen(v: number, display: string): string {
  const pct = display.endsWith('%');
  const body = pct ? display.slice(0, -1) : display;
  const dot = body.indexOf('.');
  return formatIndian(v, dot < 0 ? 0 : body.length - dot - 1) + (pct ? '%' : '');
}

const FIXTURES = ['syn-standard', 'syn-lakh', 'syn-blank-invested', 'syn-na-cmv', 'syn-all-classes', 'syn-money-columns', 'syn-single-entity', 'syn-zero-cmv', 'family-a'];

for (const id of FIXTURES) {
  describe(id, () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, fixtureById(id));
    const figures = figuresByKey(vm);

    test('screen, slide and sheet show the same text for every figure they share', async () => {
      await w.exportDeck(review, vm, null);
      await w.exportWorkbook(review, vm);
      const deck = w.last.pptx!;
      const inv = await slideInventory(deck.bytes, JSZip);
      const slideText = new Map<string, string | null>();
      for (const loc of deck.deck!.components[0]!.result.figures) {
        if (loc.cell.startsWith('pie:')) continue; // a pie label is the slice label, checked below
        slideText.set(loc.key, textAt(inv.slides[loc.page - 1]!, loc.cell));
      }
      const bytes = w.last.xlsx!.bytes;
      const evaluated = evaluateAll(readWorkbookForEval(bytes));
      const wb = readXlsx(bytes);
      const sheetCell = new Map<string, string>();
      for (const row of sheetTable(sheetByName(wb, '_manifest'))) {
        if (typeof row[0] === 'string' && row[0].startsWith('figure ')) sheetCell.set(row[0].slice('figure '.length), String(row[1]));
      }
      const sheetValue = (at: string): number | string | boolean | null => {
        if (evaluated.has(at)) return evaluated.get(at) as number;
        const [sheet, cell] = at.split('!') as [string, string];
        return sheetByName(wb, sheet).cells.get(cell)?.v ?? null;
      };

      let shared = 0;
      for (const [key, f] of figures) {
        const outputs: string[] = ['screen'];
        const text = f.display.text;
        if (slideText.has(key)) {
          outputs.push('slide');
          assert.equal(slideText.get(key), text + (f.display.marker ?? ''), `${key}: slide text`);
        }
        const at = sheetCell.get(key);
        if (at) {
          outputs.push('sheet');
          const v = sheetValue(at);
          if (f.shown.kind === 'missing') {
            assert.equal(text, MISSING_MARKER, `${key}: a missing figure shows the marker alone`);
            assert.ok(v === null || v === '', `${key}: a missing figure is a blank cell at ${at}, not ${String(v)}`);
          } else {
            assert.equal(typeof v, 'number', `${key}: ${at} holds a number`);
            assert.ok(closeTo(v as number, f.shown.v), `${key}: ${at} = ${String(v)}, the figure is ${f.shown.v}`);
            assert.equal(asScreen(v as number, text), text, `${key}: ${at} reads as the screen text`);
          }
        }
        if (outputs.length >= 2) shared += 1;
      }
      assert.ok(shared >= 10, `${shared} figures are shared by two or more outputs`);
      // The pie labels on the slide are the screen's labels.
      for (const loc of deck.deck!.components[0]!.result.figures.filter((l) => l.cell.startsWith('pie:'))) {
        const [, chart, i] = loc.cell.split(':') as [string, 'asset' | 'liquidity', string];
        const slice = vm.charts[chart].slices[Number(i)]!;
        assert.equal(textAt(inv.slides[loc.page - 1]!, loc.cell), slice.label, `${loc.cell}`);
      }
    });

    test('OD-21: a matrix the screen hides is a sheet the workbook leaves out, and the Read Me says why', async () => {
      await w.exportWorkbook(review, vm);
      const wb = readXlsx(w.last.xlsx!.bytes);
      const names = wb.sheets.map((s) => s.name);
      for (const [m, sheet] of [[vm.matrices.client, 'Client Allocation'], [vm.matrices.distributor, 'Distributor Allocation']] as const) {
        assert.equal(names.includes(sheet), m.shown, `${sheet} written exactly when the screen shows the matrix`);
        if (!m.shown) {
          const readMe = sheetTable(sheetByName(wb, 'Read Me and Controls')).map((r) => r.join(' ')).join('\n');
          assert.ok(readMe.includes(sheet), `the Read Me names ${sheet} as left out`);
        }
      }
    });
  });
}
