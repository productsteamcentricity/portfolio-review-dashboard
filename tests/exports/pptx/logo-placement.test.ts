// covers: U-07 E-52
// Logo placement on content slides (deck-design-system.md §1; KI-020): a wide and a tall synthetic logo fit inside
// the logo box (768, 13, 178.8 x 38.9) with the aspect kept and the right edge at 946.8 pt; the logo is on every
// page; no logo means no picture at all; a logo that is not a data URI is refused (PptxGenJS would load a path).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Shape } from '../../helpers/slide-inventory.ts';
import { buildDeck, manyProductsVM, NOW, pngDataUri, standardVM } from './sample-vm.ts';
import { buildOverviewDeck } from '../../../app/src/exports/pptx/deck.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';

const near = (a: number, b: number, what: string): void => assert.ok(Math.abs(a - b) <= 0.05, `${what}: ${a} is not ${b}`);

function logoOf(shapes: Shape[]): Shape {
  const pics = shapes.filter((s) => s.kind === 'picture');
  assert.equal(pics.length, 1, 'one picture, the logo');
  const p = pics[0] as Shape;
  assert.equal(p.name, 'chrome logo');
  return p;
}

function inBox(p: Shape): void {
  assert.ok(p.x >= 768 - 0.05 && p.y >= 13 - 0.05, 'inside the box, top left');
  assert.ok(p.x + p.w <= 946.8 + 0.05 && p.y + p.h <= 51.9 + 0.05, 'inside the box, bottom right');
  near(p.x + p.w, 946.8, 'right edge');
}

test('a wide logo (1000 x 100 px) takes the full width: 178.8 x 17.88 at (768, 23.51)', async () => {
  // Scale min(178.8 / 1000, 38.9 / 100) = 0.1788: 178.8 x 17.88 pt, y = 13 + (38.9 - 17.88) / 2 = 23.51.
  const { inv } = await buildDeck(standardVM(), { dataUri: pngDataUri(1000, 100), widthPx: 1000, heightPx: 100 });
  const p = logoOf(inv.slides[0]!.shapes);
  inBox(p);
  near(p.x, 768, 'x');
  near(p.y, 23.51, 'y');
  near(p.w, 178.8, 'w');
  near(p.h, 17.88, 'h');
});

test('a tall logo (100 x 400 px) takes the full height: 9.725 x 38.9 at (937.075, 13)', async () => {
  // Scale min(178.8 / 100, 38.9 / 400) = 0.09725: 9.725 x 38.9 pt, x = 946.8 - 9.725.
  const { inv } = await buildDeck(standardVM(), { dataUri: pngDataUri(100, 400), widthPx: 100, heightPx: 400 });
  const p = logoOf(inv.slides[0]!.shapes);
  inBox(p);
  near(p.x, 937.075, 'x');
  near(p.y, 13, 'y');
  near(p.w, 9.725, 'w');
  near(p.h, 38.9, 'h');
});

test('the logo is on every page of a paginated component', async () => {
  const { inv } = await buildDeck(manyProductsVM(5, 5), { dataUri: pngDataUri(400, 100), widthPx: 400, heightPx: 100 });
  assert.ok(inv.slides.length >= 2);
  for (const s of inv.slides) inBox(logoOf(s.shapes));
});

test('no logo means no picture', async () => {
  const { inv } = await buildDeck(standardVM(), null);
  for (const s of inv.slides) assert.equal(s.shapes.filter((x) => x.kind === 'picture').length, 0);
  assert.ok(!inv.parts.some((p) => p.startsWith('ppt/media/')), 'no media part');
});

test('a logo that is not a PNG or JPEG data URI is refused', async () => {
  const lib = loadPptxGenJS();
  for (const dataUri of ['logos/brand.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,AAAA']) {
    await assert.rejects(buildOverviewDeck(standardVM(), { logo: { dataUri, widthPx: 10, heightPx: 10 }, now: NOW }, lib), /PNG or JPEG data URI/);
  }
});
