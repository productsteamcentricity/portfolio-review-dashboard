// covers: E-52 DA-03 E-123 U-52 KI-091 OD-8 D-039 M1.4
// Slide C-08 built through the page's wiring (tests/helpers/node-wiring.ts: the real reader, engine, view-model and
// deck) for the synthetic overview fixtures, whose answers are worked out by hand in tests/fixtures/overview-answers.ts,
// and for the sample family (the M1.4 fix round, L2, L3 and L20):
//   L2  a pie of one slice (every synthetic fixture has one liquidity bucket, Open Ended 100%) draws no label and no
//       outline, and registers no pie label; a pie of two or more slices keeps its labels and 0.75 pt #BFBFBF outlines;
//   L3  every label drawn is the hand-worked label on two lines, the category then the percent ('Commodity\n3.9%'),
//       in a text body that never wraps, with a new line as the separator;
//   L20 the footnote and the slide notes hold no sentence twice, and when holdings are excluded (OD-8) the one
//       sentence about them is the view-model's 'excluded' note, naming the hand-worked count.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_ANSWERS } from '../../fixtures/overview-answers.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { slideInventory, type Chart, type Slide } from '../../helpers/slide-inventory.ts';
import { onTwoLines, pieLabels, seriesLines } from './pie-labels.ts';

const { JSZip } = loadPptxGenJS();
const FIXTURES = ['syn-standard', 'syn-lakh', 'syn-blank-invested', 'syn-na-cmv', 'syn-all-classes', 'syn-money-columns', 'syn-single-entity', 'syn-zero-cmv', 'family-a'];
const NO_LINE = '<a:ln><a:noFill/></a:ln>';
const OUTLINE = { width: 0.75, colour: 'BFBFBF' };

const sentencesOf = (text: string): string[] => text.split(/(?<=\.)\s+/).filter((x) => x !== '');

function pie(s: Slide, id: 'asset' | 'liquidity'): Chart {
  const c = s.charts.find((x) => x.name === `C-08 ${id} pie`);
  assert.ok(c, `the ${id} pie is drawn`);
  return c;
}

for (const id of FIXTURES) {
  describe(id, () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, fixtureById(id));
    const ans = OVERVIEW_ANSWERS[id];

    test('L2 and L3: the pie labels on two lines, and a pie of one slice without label or outline', async () => {
      await w.exportDeck(review, vm, null);
      const deck = w.last.pptx!;
      const s = (await slideInventory(deck.bytes, JSZip)).slides[0] as Slide;
      const figures = deck.deck!.components[0]!.result.figures;
      if (ans) {
        // The hand-worked answers: the asset labels, and one liquidity bucket at 100%.
        assert.deepEqual(vm.charts.asset.slices.map((x) => x.category), ans.chartLabels.map((x) => x.category));
        assert.deepEqual(ans.liquidity.map((l) => l.pct), [100]);
        const asset = pieLabels(pie(s, 'asset').xml);
        assert.deepEqual(asset.labels.map((l) => (l.deleted ? null : l.lines!.join('\n'))), ans.chartLabels.map((x) => onTwoLines(x.label)));
      }
      for (const chart of [vm.charts.asset, vm.charts.liquidity]) {
        const c = pie(s, chart.id);
        const read = pieLabels(c.xml);
        const drawn = figures.filter((f) => f.cell.startsWith(`pie:${chart.id}:`)).map((f) => Number(f.cell.split(':')[2]));
        if (chart.slices.length === 1) {
          assert.deepEqual(read.labels.map((l) => l.deleted), [true], `${chart.id}: the one slice has no label`);
          assert.deepEqual(c.pointLines, [null], `${chart.id}: no slice outline`);
          assert.equal(c.seriesLine, null, `${chart.id}: no series outline`);
          assert.ok(seriesLines(c.xml).every((l) => l === NO_LINE), `${chart.id}: every series line is no line`);
          assert.deepEqual(drawn, [], `${chart.id}: no pie label registered`);
          continue;
        }
        for (const l of c.pointLines) assert.deepEqual(l, OUTLINE, `${chart.id}: slice outline`);
        assert.deepEqual(c.seriesLine, OUTLINE, `${chart.id}: series outline`);
        assert.deepEqual(read.defaults, { wrap: 'none', separator: '\n', position: 'bestFit' });
        chart.slices.forEach((slice, i) => {
          const l = read.labels.find((x) => x.idx === i)!;
          if (slice.label === null) {
            assert.equal(l.deleted, true, `${slice.category}: no label`);
            assert.ok(!drawn.includes(i));
            return;
          }
          assert.deepEqual(l.lines, [slice.category, slice.label.slice(slice.category.length + 1)], `${slice.category}: two lines`);
          assert.equal(l.lines!.join('\n'), onTwoLines(slice.label));
          assert.deepEqual([l.wrap, l.paragraphs, l.runs.length, l.breaks.length, l.separator], ['none', 1, 2, 1, '\n'], `${slice.category}`);
          assert.ok(drawn.includes(i), `${slice.category}: the label is registered`);
        });
      }
    });

    test('L20: no sentence twice in the footnote and notes; the excluded holdings once, as the view-model words them', async () => {
      await w.exportDeck(review, vm, null);
      const inv = await slideInventory(w.last.pptx!.bytes, JSZip);
      const all: string[] = [];
      for (const s of inv.slides) {
        const foot = s.shapes.find((x) => x.name === 'chrome footnote')?.text ?? '';
        const page = [...sentencesOf(foot), ...sentencesOf(s.notes)];
        assert.deepEqual(page, [...new Set(page)], `slide ${s.index}: no sentence twice`);
        all.push(...page);
      }
      assert.ok(!all.some((x) => x.includes('usable market value')), 'the slide adds no exclusion sentence of its own');
      const about = [...new Set(all.filter((x) => x.includes('excluded from every total')))];
      const excluded = ans ? ans.excluded.length : vm.excluded.count;
      if (excluded === 0) {
        assert.deepEqual(about, []);
        return;
      }
      const note = vm.notes.find((n) => n.id === 'excluded');
      assert.ok(note, 'the view-model has the excluded note');
      assert.deepEqual(about, [note.text], 'one exclusion sentence, the view-model\'s');
      assert.ok(note.text.startsWith(`${excluded} ${excluded === 1 ? 'holding' : 'holdings'} `), `the note names ${excluded}`);
    });
  });
}

test('the hand-worked counts behind L20: two fixtures exclude holdings, the others none', () => {
  assert.deepEqual(Object.entries(OVERVIEW_ANSWERS).filter(([, a]) => a.excluded.length > 0).map(([k, a]) => [k, a.excluded.length]),
    [['syn-na-cmv', 2], ['syn-money-columns', 1]]);
});
