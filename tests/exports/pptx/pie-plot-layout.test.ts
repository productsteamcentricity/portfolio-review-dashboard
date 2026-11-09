// covers: E-52 DA-03 KI-091 D-039 M1.4 (fix round 2, N13: the slide pie's plot area above a two-row legend)
// From 5 categories the legend of a C-08 pie wraps to two rows, whose top PowerPoint put at 148.6 pt of the
// 220 x 190 pt chart (Office acceptance, 27 Oct 2026); the pie it placed itself ended at 128 pt, so a label outside a
// slice at 6 o'clock sat on the legend. The pie now takes a manual plot layout that leaves 26 pt above the legend:
//   diameter 148.6 - 26 - 16.5 = 106.1 pt; x (220 - 106.1) / 2 / 220 = 0.2589; y 16.5 / 190 = 0.0868;
//   w 106.1 / 220 = 0.4823; h 106.1 / 190 = 0.5584 (four decimals, worked by hand).
// Below 5 categories the plot area keeps PowerPoint's own layout (<c:layout/>). The two six-class base books of
// pie-6-oclock.ts put a slice centred at 6 o'clock (REITs/InvITs outside its slice; Hybrid best fit) through the
// real reader, engine, view-model and deck.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { C08_LAYOUT, piePlotLayout } from '../../../app/src/exports/pptx/components/C-08-asset-allocation.ts';
import { nodeWiring, reviewOf, fixtureById } from '../../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { all, kid, parseXml, slideInventory, type Chart, type Slide } from '../../helpers/slide-inventory.ts';
import { pieLabels } from './pie-labels.ts';
import { buildDeck, sixSliceVM, standardVM } from './sample-vm.ts';
import { SIX_O_CLOCK, sixOClockFixtures } from './pie-6-oclock.ts';

const { JSZip } = loadPptxGenJS();
const HAND = { x: 0.2589, y: 0.0868, w: 0.4823, h: 0.5584 };
/** The height of a two-line 9 pt label box as PowerPoint drew it (Office acceptance, 27 Oct 2026). */
const LABEL_BOX_PT = 24.1;

type ReadLayout = { first: string | null; manual: null | { target: string | null; xMode: string | null; yMode: string | null; x: number; y: number; w: number; h: number } };

/** The plot area's layout in a chart part: its first child, and the manual layout when there is one. */
function plotLayout(chartXml: string): ReadLayout {
  const plot = all(parseXml(chartXml), 'c:plotArea')[0];
  assert.ok(plot, 'the chart has a plot area');
  const first = plot.children[0]?.name ?? null;
  const m = kid(kid(plot, 'c:layout'), 'c:manualLayout');
  if (!m) return { first, manual: null };
  const val = (n: string): string | null => kid(m, n)?.attrs.val ?? null;
  return {
    first,
    manual: {
      target: val('c:layoutTarget'), xMode: val('c:xMode'), yMode: val('c:yMode'),
      x: Number(val('c:x')), y: Number(val('c:y')), w: Number(val('c:w')), h: Number(val('c:h')),
    },
  };
}

function pie(s: Slide, id: 'asset' | 'liquidity'): Chart {
  const c = s.charts.find((x) => x.name === `C-08 ${id} pie`);
  assert.ok(c, `the ${id} pie is drawn`);
  return c;
}

const firstSliceAngle = (xml: string): string | null => kid(all(parseXml(xml), 'c:pieChart')[0], 'c:firstSliceAng')?.attrs.val ?? null;

describe('N13: the layout, worked by hand', () => {
  test('from 5 categories: x 0.2589, y 0.0868, w 0.4823, h 0.5584; none below 5', () => {
    for (const n of [0, 1, 2, 3, 4]) assert.equal(piePlotLayout(n), null, `${n} categories`);
    for (const n of [5, 6, 9]) assert.deepEqual(piePlotLayout(n), HAND, `${n} categories`);
    assert.deepEqual(C08_LAYOUT.pie, { x: 615.5, dy: 19.5, w: 220, h: 190 }, 'the chart is 220 x 190 pt');
  });

  test('the pie is a 106.1 pt circle centred across the chart, its bottom 26 pt above the two-row legend', () => {
    const l = piePlotLayout(6)!;
    const width = l.w * 220; // 106.106
    const height = l.h * 190; // 106.096
    assert.ok(Math.abs(width - height) < 0.02, `a square box: ${width} x ${height}`);
    const d = Math.min(width, height);
    assert.ok(Math.abs(d - 106.1) < 0.01, `diameter ${d}`);
    assert.ok(Math.abs(l.x * 220 + width / 2 - 110) < 0.02, 'centred across the 220 pt chart');
    assert.ok(Math.abs(l.y * 190 - 16.5) < 0.01, 'the top PowerPoint gave the pie above a two-row legend');
    const gap = 148.6 - (l.y * 190 + d); // 148.6 - (16.492 + 106.096) = 26.012
    assert.ok(Math.abs(gap - 26) < 0.05, `the gap above the legend is ${gap} pt`);
    assert.ok(gap >= LABEL_BOX_PT + 1.5, 'a two-line label below the pie fits above the legend, with its gap to the slice');
  });
});

describe('N13: in the deck (the hand-worked sample view-models)', () => {
  test('six slices: the asset pie has the manual inner layout as the plot area\'s first child; the one-slice liquidity pie has none', async () => {
    const vm = sixSliceVM();
    assert.equal(vm.charts.asset.slices.length, 6);
    const { inv } = await buildDeck(vm);
    const s = inv.slides[0] as Slide;
    const asset = plotLayout(pie(s, 'asset').xml);
    assert.equal(asset.first, 'c:layout', 'c:layout comes first in c:plotArea (CT_PlotArea)');
    assert.deepEqual(asset.manual, { target: 'inner', xMode: 'edge', yMode: 'edge', ...HAND });
    assert.deepEqual(plotLayout(pie(s, 'liquidity').xml), { first: 'c:layout', manual: null });
    assert.equal(firstSliceAngle(pie(s, 'asset').xml), '0', 'the first slice starts at 12 o\'clock');
  });

  test('five classes (the standard sample, REITs/InvITs under 2%) take it too: the legend lists every slice', async () => {
    const vm = standardVM();
    assert.deepEqual(vm.charts.asset.slices.map((x) => x.category), ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs']);
    assert.equal(vm.charts.asset.slices[4]!.label, null, 'REITs/InvITs (1.5%) has no label but is in the legend');
    const { inv } = await buildDeck(vm);
    const s = inv.slides[0] as Slide;
    assert.deepEqual(plotLayout(pie(s, 'asset').xml).manual, { target: 'inner', xMode: 'edge', yMode: 'edge', ...HAND });
    assert.deepEqual(plotLayout(pie(s, 'liquidity').xml).manual, null, 'two liquidity slices: one legend row');
  });

  test('four classes (syn-standard through the wiring): PowerPoint places the pie, as in the Office run that passed', async () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, fixtureById('syn-standard'));
    assert.deepEqual(vm.charts.asset.slices.map((x) => x.category), ['Equity', 'Debt', 'Hybrid', 'Commodity']);
    await w.exportDeck(review, vm, null);
    const s = (await slideInventory(w.last.pptx!.bytes, JSZip)).slides[0] as Slide;
    assert.deepEqual(plotLayout(pie(s, 'asset').xml), { first: 'c:layout', manual: null });
  });
});

describe('N13: the six-class books with a slice at 6 o\'clock (the Office acceptance fixtures)', () => {
  const fixtures = sixOClockFixtures();
  for (const c of SIX_O_CLOCK) {
    test(`${c.id}: ${c.atSixOClock} is centred at 6 o'clock; the pie leaves 26 pt above the legend`, async () => {
      const w = nodeWiring();
      const { review, vm } = reviewOf(w, fixtures.find((f) => f.id === c.id)!);
      const slices = vm.charts.asset.slices;
      assert.deepEqual(slices.map((x) => x.category), ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown']);
      // Each class is its value in Lakh out of 100: its percent, written out by hand.
      assert.deepEqual(slices.map((x) => x.pct.display.text), c.lakh.map((v) => `${v.toFixed(2)}%`));
      // The slice's centre: the classes before it plus half of it, out of 100, times 360 degrees, from 12 o'clock.
      const i = slices.findIndex((x) => x.category === c.atSixOClock);
      const before = c.lakh.slice(0, i).reduce((a, b) => a + b, 0);
      assert.equal((before + (c.lakh[i] as number) / 2) / 100 * 360, 180, `${c.atSixOClock} centred at 180 degrees`);
      await w.exportDeck(review, vm, null);
      const s = (await slideInventory(w.last.pptx!.bytes, JSZip)).slides[0] as Slide;
      const chart = pie(s, 'asset');
      assert.equal(firstSliceAngle(chart.xml), '0');
      assert.deepEqual(plotLayout(chart.xml).manual, { target: 'inner', xMode: 'edge', yMode: 'edge', ...HAND });
      const label = pieLabels(chart.xml).labels.find((l) => l.idx === i)!;
      assert.deepEqual(label.lines, [c.atSixOClock, `${(c.lakh[i] as number).toFixed(1)}%`]);
      // #222222 on REITs/InvITs (#8C6B43) reads 3.26:1: outside the slice; on Hybrid (#BFBFBF) best fit.
      assert.equal(label.position, c.atSixOClock === 'REITs/InvITs' ? 'outEnd' : 'bestFit');
      if (c.id === 'syn-pie6-hybrid') {
        assert.equal(pieLabels(chart.xml).labels.find((l) => l.idx === 3)!.deleted, true, 'Commodity (1.50%) has no label');
      }
    });
  }
});
