// covers: E-123 E-52
// Presentation text rules (deck-design-system.md §2.5 and §8 item 8; D-029): the lint catches a planted en or em
// dash and a hard-coded "slide 9"; the dash alone is allowed only as the missing-value marker in a cell or tile;
// the generated decks, with and without missing values, have no finding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintText, type TextRun } from '../../../app/src/exports/pptx/text-lint.ts';
import type { Slide } from '../../helpers/slide-inventory.ts';
import { buildDeck, fig, manyProductsVM, missing, standardParts, standardVM } from './sample-vm.ts';

const EM = '\u2014';
const EN = '\u2013';

test('the lint catches planted dashes and slide numbers', () => {
  const bad: TextRun[] = [
    { text: `Equity ${EN} large cap`, context: 'text' },
    { text: `Values as on 30 Sep 2026 ${EM} unaudited`, context: 'text' },
    { text: `1.25 ${EM}`, context: 'cell' },
    { text: EM, context: 'text' },
    { text: 'See slide 9 for the detail.', context: 'text' },
    { text: 'Slide 12', context: 'cell' },
    { text: 'as shown on slides 3 to 5', context: 'text' },
  ];
  const findings = lintText(bad);
  assert.equal(findings.length, 7, findings.join('\n'));
  assert.match(findings[0] as string, /en or em dash/);
  assert.match(findings[4] as string, /slide number/);
});

test('the dash alone passes in a cell or tile, and ordinary text passes', () => {
  assert.deepEqual(lintText([
    { text: EM, context: 'cell' },
    { text: EM, context: 'tile' },
    { text: 'Allocation by Asset Class & Product (continued)', context: 'text' },
    { text: 'Equity 59.3%', context: 'text' },
    { text: '-0.25', context: 'cell' },
    { text: 'Slideshow of 9 funds', context: 'text' },
  ]), []);
});

/** Every text run of a slide with its context: table cells, KPI values (tiles), everything else as text. */
function runsOf(s: Slide): TextRun[] {
  const runs: TextRun[] = [];
  for (const sh of s.shapes) {
    if (sh.kind === 'table') continue;
    const context = / kpi \w+ value$/.test(sh.name) ? 'tile' : 'text';
    if (sh.text) runs.push({ text: sh.text, context });
  }
  for (const t of s.tables) for (const r of t.rows) for (const c of r.cells) runs.push({ text: c.text, context: 'cell' });
  for (const c of s.charts) {
    for (const l of c.labels) if (l.text) runs.push({ text: l.text, context: 'text' });
    for (const cat of c.categories) runs.push({ text: cat, context: 'text' });
  }
  if (s.notes) runs.push({ text: s.notes, context: 'text' });
  return runs;
}

test('the generated decks have no finding, with dashes for missing values', async () => {
  const parts = standardParts();
  parts.kpi.absReturn = missing('totals.absReturnPct', 'NOT APPLICABLE');
  parts.kpi.gain = missing('totals.gain', 'NOT AVAILABLE IN SUPPLIED DATA', ['n-gain']);
  parts.kpi.invested = missing('totals.invested', 'NOT AVAILABLE IN SUPPLIED DATA', ['n-gain']);
  (parts.assets[0] as { products: Array<{ invested: number | null }> }).products[1]!.invested = null;
  parts.notes = [{ id: 'n-gain', text: 'Invested value and gain are not available in the supplied data for some holdings.' }];
  parts.kpi.cmv = fig('totals.cmv', 4, '4.00');
  for (const vm of [standardVM(), standardVM(parts), manyProductsVM(6, 6)]) {
    const { inv } = await buildDeck(vm);
    for (const s of inv.slides) {
      const runs = runsOf(s);
      assert.ok(runs.length > 10);
      assert.deepEqual(lintText(runs), [], `slide ${s.index}`);
    }
  }
  const { inv } = await buildDeck(standardVM(parts));
  const slide = inv.slides[0] as Slide;
  assert.ok(runsOf(slide).some((r) => r.text === EM && r.context === 'tile'), 'a dash shows in a tile');
  assert.ok(runsOf(slide).some((r) => r.text === EM && r.context === 'cell'), 'a dash shows in a cell');
});
