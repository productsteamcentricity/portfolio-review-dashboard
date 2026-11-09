// covers: DA-30 E-52
// Building blocks (deck-design-system.md §3): the KPI tile (geometry, cream fill, 0.75 pt grey85 outline, gold
// strip, value 13.5 pt bold, label 7.5 pt #555555, a negative value in #931621, a marker as a superscript of the
// same size), the section label, the chart panel, and the insight box kept for M5.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insightBox, kpiGeometry } from '../../../app/src/exports/pptx/blocks.ts';
import type { PptxPresentation } from '../../../app/src/exports/pptx/pptxgen-types.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { shapeNamed, slideInventory, type Shape, type Slide } from '../../helpers/slide-inventory.ts';
import { buildDeck, fig, standardParts, standardVM } from './sample-vm.ts';

const near = (a: number, b: number, what: string): void => assert.ok(Math.abs(a - b) <= 0.05, `${what}: ${a} is not ${b}`);
function at(s: Shape, x: number, y: number, w: number, h: number): void {
  near(s.x, x, `${s.name} x`);
  near(s.y, y, `${s.name} y`);
  near(s.w, w, `${s.name} w`);
  near(s.h, h, `${s.name} h`);
}

test('KPI tile geometry: 154 x 47.5 with a 4 pt strip, the value at +6/+6 and the label at +6/+28', () => {
  assert.deepEqual(kpiGeometry(13, 76), {
    tile: { x: 13, y: 76, w: 154, h: 47.5 },
    strip: { x: 13, y: 76, w: 154, h: 4 },
    value: { x: 19, y: 82, w: 142, h: 22 },
    label: { x: 19, y: 104, w: 142, h: 15 },
  });
});

test('three KPI tiles at x 13, 173.5 and 334, y 76, in the tile style', async () => {
  const { inv } = await buildDeck(standardVM());
  const slide = inv.slides[0] as Slide;
  const want: Array<[string, number, string, string]> = [
    ['invested', 13, '3.40', 'Invested Value (Cr.)'],
    ['cmv', 173.5, '4.00', 'Current Market Value (Cr.)'],
    ['gain', 334, '0.60', 'Unrealised Gain/Loss (Cr.)'],
  ];
  for (const [id, x, value, label] of want) {
    const tile = shapeNamed(slide, `C-08 kpi ${id} tile`);
    at(tile, x, 76, 154, 47.5);
    assert.equal(tile.fill, 'FCFAF7');
    assert.deepEqual(tile.line, { width: 0.75, colour: 'D9D9D9' });
    const strip = shapeNamed(slide, `C-08 kpi ${id} strip`);
    at(strip, x, 76, 154, 4);
    assert.equal(strip.fill, 'BD9568');
    assert.equal(strip.line, null);
    const v = shapeNamed(slide, `C-08 kpi ${id} value`);
    at(v, x + 6, 82, 142, 22);
    assert.equal(v.text, value);
    for (const r of v.runs) assert.deepEqual([r.size, r.bold, r.colour, r.font], [13.5, true, '000000', 'Cambria']);
    const l = shapeNamed(slide, `C-08 kpi ${id} label`);
    at(l, x + 6, 104, 142, 15);
    assert.equal(l.text, label);
    for (const r of l.runs) assert.deepEqual([r.size, r.bold, r.colour, r.font], [7.5, false, '555555', 'Cambria']);
  }
});

test('a negative KPI value is #931621; a marker is a superscript run of the same size in one paragraph', async () => {
  const parts = standardParts();
  parts.kpi.gain = fig('totals.gain', -0.25, '-0.25');
  parts.kpi.invested = fig('totals.invested', 2.8, '2.80', { marker: 'p', coverage: 0.825 });
  const { inv } = await buildDeck(standardVM(parts));
  const slide = inv.slides[0] as Slide;
  const gain = shapeNamed(slide, 'C-08 kpi gain value');
  assert.equal(gain.text, '-0.25');
  assert.ok(gain.runs.every((r) => r.colour === '931621'));
  const inv2 = shapeNamed(slide, 'C-08 kpi invested value');
  assert.equal(inv2.paragraphs, 1);
  assert.deepEqual(inv2.runs.map((r) => [r.text, r.size, r.superscript]), [['2.80', 13.5, false], ['p', 13.5, true]]);
  assert.ok(!/<\/a:r><a:pPr/.test(slide.xml), 'paragraph properties come first, once');
});

test('section label: a gold 8.6 x 17.3 block at (13, 143) and 11 pt bold text at x 25.6, 462.4 wide', async () => {
  const { inv } = await buildDeck(standardVM());
  const slide = inv.slides[0] as Slide;
  const block = shapeNamed(slide, 'C-08 section label block');
  at(block, 13, 143, 8.6, 17.3);
  assert.equal(block.fill, 'BD9568');
  const text = shapeNamed(slide, 'C-08 section label');
  at(text, 25.6, 143, 462.4, 17.3);
  assert.equal(text.text, 'Allocation by Asset Class & Product');
  for (const r of text.runs) assert.deepEqual([r.size, r.bold, r.colour], [11, true, '000000']);
});

test('chart panels: rounded, #FBF7F1, 0.75 pt grey85, with an 11 pt bold centred title', async () => {
  const { inv } = await buildDeck(standardVM());
  const slide = inv.slides[0] as Slide;
  for (const [id, y, title] of [
    ['asset', 72, 'Asset Allocation by Asset Class (% of total CMV)'],
    ['liquidity', 285.5, 'Liquidity Structure (% of total CMV)'],
  ] as const) {
    const panel = shapeNamed(slide, `C-08 ${id} panel`);
    at(panel, 504, y, 443, 209.5);
    assert.equal(panel.geom, 'roundRect');
    assert.equal(panel.fill, 'FBF7F1');
    assert.deepEqual(panel.line, { width: 0.75, colour: 'D9D9D9' });
    const t = shapeNamed(slide, `C-08 ${id} panel title`);
    at(t, 514, y + 3, 423, 15);
    assert.equal(t.text, title);
    assert.ok(slide.xml.includes(`name="C-08 ${id} panel title"`));
    for (const r of t.runs) assert.deepEqual([r.size, r.bold, r.colour], [11, true, '000000']);
  }
});

test('insight box (kept for M5): sand, 0.75 pt gold outline, 6.5 pt gold bar, label 8.5 pt bold gold, text 9.5 pt', async () => {
  const lib = loadPptxGenJS();
  const pptx: PptxPresentation = new lib.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  insightBox(pptx.addSlide(), { x: 13, y: 420, w: 475, h: 60 }, { label: 'INSIGHT', text: 'A synthetic sentence.', name: 'insight' });
  const bytes = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
  const slide = (await slideInventory(bytes, lib.JSZip)).slides[0] as Slide;
  const box = shapeNamed(slide, 'insight');
  at(box, 13, 420, 475, 60);
  assert.deepEqual([box.geom, box.fill, box.line], ['roundRect', 'F4EEE6', { width: 0.75, colour: 'BD9568' }]);
  const bar = shapeNamed(slide, 'insight bar');
  at(bar, 13, 420, 6.5, 60);
  assert.equal(bar.fill, 'BD9568');
  const text = shapeNamed(slide, 'insight text');
  assert.deepEqual(text.runs.map((r) => [r.text, r.size, r.bold, r.colour]), [
    ['INSIGHT  ', 8.5, true, 'BD9568'],
    ['A synthetic sentence.', 9.5, false, '222222'],
  ]);
});
