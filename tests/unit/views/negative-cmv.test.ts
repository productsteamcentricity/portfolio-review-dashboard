// covers: E-18 E-21 E-22 U-18 D-039 OD-18
// A negative market value (the M1.4 fix round 2, N10; recorded in D-039 as the lead's decision, the owner may revisit):
// the reader reads it as written and warns, naming the holdings (base-file.negative-market-value); every number is the
// live page's (tests/parity/aggregation.parity.test.ts runs this fixture with no difference); and the overview notes
// what the pies and the liquidity table leave out for a market value of 0 or less.
//
// syn-negative-cmv (tests/fixtures/make-books.ts): SYNTHETIC_BOOK with holding 4 (Sample Gold ETF Fund of Fund, the
// only Commodity holding) at -20 Lakh = -0.2 Cr, its invested 0.1 Cr unchanged, and the only holding of liquidity
// "T+3"; the others "Daily". By hand, in Crore: CMV 0.625 + 0.452 + 0.896 + 0.339 - 0.2 + 0.91 = 3.022; invested
// 0.5 + 0.4 + 0.8 + 0.3 + 0.1 + 0.75 = 2.85; gain 0.172; absolute return 0.172 / 2.85 = 6.035%. Equity 1.987
// (65.75%), Debt 0.896 (29.65%), Hybrid 0.339 (11.22%), Commodity -0.2 (-6.62%, gain -0.3); the shares add to 100.00.
// Liquidity: Daily 3.222 (106.62%); T+3 -0.2 is left out of the table and the pie, and Commodity out of the asset pie.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { slideInventory } from '../../helpers/slide-inventory.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { NOTE_ORDER } from '../../../app/src/views/notes.ts';
import { liquidityLeftOut } from '../../../app/src/engine/aggregate/allocation.ts';

const PIE_NOTE = 'Asset classes with a market value of 0 or less are left out of the pie: Commodity.';
const LIQ_NOTE = 'Liquidity lines with a market value of 0 or less are left out: T+3.';

describe('syn-negative-cmv (N10)', () => {
  const w = nodeWiring();
  const { review, vm } = reviewOf(w, fixtureById('syn-negative-cmv'));
  const text = (id: string): string => vm.kpis.find((k) => k.id === id)!.figure.display.text;

  test('the reader warns and names the holding; the Warning makes no note of its own and blocks nothing', () => {
    const w1 = review.issues.filter((i) => i.ruleId === 'base-file.negative-market-value');
    assert.deepEqual(w1.map((i) => [i.severity, i.count, i.decision]), [['Warning', 1, 'D-039']]);
    assert.equal(w1[0]!.message, '1 holding has a negative market value, read as written and counted in every total: "Sample Gold ETF Fund of Fund - Growth".');
    assert.deepEqual(w1[0]!.scope, { kind: 'holdings', holdingIds: [review.holdings[4]!.id] });
    assert.equal(review.gate.canExport, true);
    assert.ok(!vm.notes.some((n) => /negative market value/.test(n.text)));
  });

  test('the numbers are unchanged: the holding counts in every total, as on the live page', () => {
    assert.deepEqual(['invested', 'cmv', 'gain', 'absReturn', 'holdings'].map(text), ['2.85', '3.02', '0.17', '6.04%', '6']);
    const rows = vm.allocation.rows.filter((r) => r.kind === 'asset').map((r) => [r.label, r.cmv.display.text, r.pct.display.text, r.gain.display.text]);
    assert.deepEqual(rows, [['Equity', '1.99', '65.75%', '0.34'], ['Debt', '0.90', '29.65%', '0.10'], ['Hybrid', '0.34', '11.22%', '0.04'], ['Commodity', '-0.20', '-6.62%', '-0.30']]);
  });

  test('the liquidity table and pie leave out T+3; the asset pie leaves out Commodity', () => {
    assert.deepEqual(vm.liquidity.rows.map((r) => [r.label, r.cmv.display.text, r.pct.display.text]), [['Daily', '3.22', '106.62%']]);
    assert.deepEqual(vm.charts.liquidity.slices.map((s) => s.category), ['Daily']);
    assert.deepEqual(vm.charts.asset.slices.map((s) => s.category), ['Equity', 'Debt', 'Hybrid']);
    assert.deepEqual(liquidityLeftOut(review.holdings, review.totals), ['T+3']);
  });

  test('the notes say what is left out, in the fixed order, and the pies\' shares refer to them', () => {
    assert.equal(vm.notes.find((n) => n.id === 'pie-left-out')!.text, PIE_NOTE);
    assert.equal(vm.notes.find((n) => n.id === 'liquidity-left-out')!.text, LIQ_NOTE);
    const ids = vm.notes.map((n) => n.id);
    assert.ok(ids.indexOf('pie-left-out') < ids.indexOf('liquidity-left-out'));
    assert.ok(NOTE_ORDER.indexOf('unknown') < NOTE_ORDER.indexOf('pie-left-out'));
    for (const s of vm.charts.asset.slices) assert.ok(s.pct.notes.includes('pie-left-out'), s.category);
    for (const s of vm.charts.liquidity.slices) assert.ok(s.pct.notes.includes('liquidity-left-out'), s.category);
    for (const n of vm.notes) assert.ok(!/[–—]/.test(n.text), n.text);
  });

  test('the slide and the workbook carry both sentences', async () => {
    await w.exportDeck(review, vm, null);
    const inv = await slideInventory(w.last.pptx!.bytes, loadPptxGenJS().JSZip);
    const s = inv.slides[0]!;
    const words = `${s.shapes.find((x) => x.name === 'chrome footnote')?.text ?? ''} ${s.notes}`;
    assert.ok(words.includes(PIE_NOTE) && words.includes(LIQ_NOTE), words);
    await w.exportWorkbook(review, vm);
    const readMe = sheetTable(sheetByName(readXlsx(w.last.xlsx!.bytes), 'Read Me and Controls')).flat().map(String);
    assert.ok(readMe.includes(PIE_NOTE) && readMe.includes(LIQ_NOTE));
  });
});

describe('the left-out notes on the other fixtures', () => {
  test('syn-zero-cmv: Commodity at exactly 0 is left out of the asset pie and noted; no liquidity line is left out', () => {
    const { vm } = reviewOf(nodeWiring(), fixtureById('syn-zero-cmv'));
    assert.deepEqual(vm.charts.asset.slices.map((s) => s.category), ['Equity', 'Debt', 'Hybrid']);
    assert.equal(vm.notes.find((n) => n.id === 'pie-left-out')!.text, PIE_NOTE);
    assert.equal(vm.notes.some((n) => n.id === 'liquidity-left-out'), false);
  });

  test('syn-standard and syn-liquidity-labels: nothing is left out, so neither note', () => {
    for (const id of ['syn-standard', 'syn-liquidity-labels']) {
      const { vm } = reviewOf(nodeWiring(), fixtureById(id));
      assert.equal(vm.notes.some((n) => n.id === 'pie-left-out' || n.id === 'liquidity-left-out'), false, id);
    }
  });
});
