// covers: U-28 E-85 BR-2.1 (one returns figure, one text, on screen and in the Fund IRR sheet; M3a wiring, NB-03)
// For the synthetic base book (syn-standard) with each synthetic IRR file that can be accepted, every headline figure
// of the returns view-model (returns.<scope>.fund and .bench) is joined by key to the cell _manifest names: a present
// figure is that cell's number, which reads in its own number format (tests/helpers/excel-text.ts, written apart from
// the app's formatter) as the screen text; a missing one is the marker alone on screen and a blank cell in the sheet.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSING_MARKER } from '../../app/src/config/formats.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM, returnsHeadlineFigures } from '../../app/src/views/returns.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { closeTo } from '../helpers/formula-eval.ts';
import { numberFormatAt, readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { excelFormatText, withoutZeroSign } from '../helpers/excel-text.ts';
import { irrFixtures } from '../fixtures/make-irr-files.ts';

const w = nodeWiring();
const { review, vm } = reviewOf(w, fixtureById('syn-standard'));

for (const id of ['irr-standard', 'irr-dates', 'irr-by-content', 'irr-two-fund-sheets']) {
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
  });
}
