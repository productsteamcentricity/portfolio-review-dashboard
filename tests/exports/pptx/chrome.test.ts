// covers: DA-29 E-52
// Slide chrome (deck-design-system.md §1; D-039, the preview marker): every chrome object at its position to 0.05 pt, its
// colours, the title in 22 pt bold white upper case, and the preview marker in the footer band exactly when the
// build is a preview, on every page of the component.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, slideTitle, fitLogo } from '../../../app/src/exports/pptx/chrome.ts';
import { shapeNamed, type Shape, type Slide } from '../../helpers/slide-inventory.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { buildDeck, manyProductsVM, standardVM } from './sample-vm.ts';

const near = (a: number, b: number, what: string): void => assert.ok(Math.abs(a - b) <= 0.05, `${what}: ${a} is not ${b}`);
function at(s: Shape, box: { x: number; y: number; w: number; h: number }): void {
  near(s.x, box.x, `${s.name} x`);
  near(s.y, box.y, `${s.name} y`);
  near(s.w, box.w, `${s.name} w`);
  near(s.h, box.h, `${s.name} h`);
}

function checkChrome(slide: Slide, title: string, preview: boolean): void {
  const bar = shapeNamed(slide, 'chrome header bar');
  at(bar, { x: 0, y: 0, w: 960, h: 64.8 });
  assert.equal(bar.fill, '000000');
  assert.equal(bar.geom, 'rect');
  const rule = shapeNamed(slide, 'chrome header rule');
  at(rule, { x: 0, y: 63.4, w: 960, h: 3.6 });
  assert.equal(rule.fill, 'BD9568');
  const t = shapeNamed(slide, 'chrome title');
  at(t, { x: 13, y: 10.1, w: 738, h: 47.5 });
  assert.equal(t.text, title);
  assert.equal(t.text, t.text.toUpperCase());
  assert.equal(t.anchor, 'ctr');
  for (const r of t.runs) {
    assert.deepEqual([r.size, r.bold, r.colour, r.font], [22, true, 'FFFFFF', 'Cambria']);
  }
  const band = shapeNamed(slide, 'chrome footer band');
  at(band, { x: 0, y: 520.6, w: 960, h: 19.4 });
  assert.equal(band.fill, '000000');
  const foot = shapeNamed(slide, 'chrome footnote');
  at(foot, { x: 13, y: 498.2, w: 931, h: 18.7 });
  for (const r of foot.runs) assert.deepEqual([r.size, r.italic, r.colour, r.font], [8, true, '6B6B6B', 'Cambria']);
  const markers = slide.shapes.filter((s) => s.name === 'chrome preview marker');
  if (preview) {
    assert.equal(markers.length, 1);
    const m = markers[0] as Shape;
    at(m, { x: 13, y: 520.6, w: 931, h: 19.4 });
    assert.equal(m.text, 'Preview build, not for client use');
    assert.equal(m.anchor, 'ctr');
    for (const r of m.runs) assert.deepEqual([r.size, r.italic, r.colour, r.font], [8, true, 'FFFFFF', 'Cambria']);
  } else {
    assert.equal(markers.length, 0);
    assert.ok(!slide.xml.includes('Preview build'), 'a release slide carries no preview text');
  }
}

test('the chrome boxes are the design system\'s', () => {
  assert.deepEqual(CHROME.headerBar, { x: 0, y: 0, w: 960, h: 64.8 });
  assert.deepEqual(CHROME.headerRule, { x: 0, y: 63.4, w: 960, h: 3.6 });
  assert.deepEqual(CHROME.title, { x: 13, y: 10.1, w: 738, h: 47.5 });
  assert.deepEqual(CHROME.logoBox, { x: 768, y: 13, w: 178.8, h: 38.9 });
  assert.deepEqual(CHROME.footerBand, { x: 0, y: 520.6, w: 960, h: 19.4 });
  assert.deepEqual(CHROME.previewMarker, { x: 13, y: 520.6, w: 931, h: 19.4 });
  assert.deepEqual(CHROME.footnote, { x: 13, y: 498.2, w: 931, h: 18.7 });
});

test('slide titles are upper case, with (n/N) only when a component runs over several pages', () => {
  assert.equal(slideTitle('Asset Allocation', 1, 1), 'ASSET ALLOCATION');
  assert.equal(slideTitle('Asset Allocation', 1, 2), 'ASSET ALLOCATION (1/2)');
  assert.equal(slideTitle('Asset Allocation', 3, 3), 'ASSET ALLOCATION (3/3)');
});

test('fitLogo keeps the aspect and sits on the right edge, centred in the box', () => {
  // 400 x 100 px: the height limits (38.9 / 100 = 0.389 < 178.8 / 400 = 0.447): 155.6 x 38.9 at x 946.8 - 155.6.
  const b = fitLogo({ widthPx: 400, heightPx: 100 });
  near(b.w, 155.6, 'w');
  near(b.h, 38.9, 'h');
  near(b.x, 791.2, 'x');
  near(b.y, 13, 'y');
  assert.throws(() => fitLogo({ widthPx: 0, heightPx: 10 }), /positive/);
});

test('a preview deck: every chrome object in place, the marker in the footer band', async () => {
  const { inv } = await buildDeck(standardVM());
  assert.equal(inv.slides.length, 1);
  checkChrome(inv.slides[0] as Slide, 'ASSET ALLOCATION', true);
});

test('a release deck: the same chrome and no marker anywhere', async () => {
  const { inv, bytes } = await buildDeck(standardVM({ channel: 'release' }));
  checkChrome(inv.slides[0] as Slide, 'ASSET ALLOCATION', false);
  const zip = await loadPptxGenJS().JSZip.loadAsync(bytes);
  for (const [name, f] of Object.entries(zip.files)) {
    if (f.dir || !/\.(xml|rels)$/.test(name)) continue;
    assert.ok(!(await f.async('string')).includes('Preview build'), `${name} carries no preview marker`);
  }
});

test('every page of a paginated component carries the chrome and the marker', async () => {
  const { inv } = await buildDeck(manyProductsVM(5, 5));
  assert.ok(inv.slides.length >= 2);
  const n = inv.slides.length;
  for (const s of inv.slides) checkChrome(s, `ASSET ALLOCATION (${s.index}/${n})`, true);
});
