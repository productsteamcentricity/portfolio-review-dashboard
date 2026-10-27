// covers: U-16 U-45 E-52
// The presentation manifest (architecture §15; deck-design-system.md §6): it lists C-08 in section 4, always
// included; a download exists only for a section with at least one slide (the KI-124 class); and the overview
// download always yields at least one slide, even for a book with nothing to chart, whose panels say "Chart not
// drawn" with the status in words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkManifest, plannedComponents, sectionDownloads, SLIDE_MANIFEST } from '../../../app/src/exports/pptx/manifest.ts';
import { chartNotDrawnText } from '../../../app/src/exports/pptx/components/C-08-asset-allocation.ts';
import { MISSING_STATUSES, type MissingStatus } from '../../../app/src/model/status.ts';
import type { OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { REPO } from '../../helpers/pptxgenjs.ts';
import { shapeNamed, type Slide } from '../../helpers/slide-inventory.ts';
import { buildDeck, line, missing, standardVM } from './sample-vm.ts';

test('the manifest file: section 4 Portfolio overview with C-08 asset-allocation, always included, in progress', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'app', 'src', 'config', 'slide-manifest.json'), 'utf8'));
  assert.deepEqual(raw, {
    version: 1,
    sections: [{ n: 4, id: 'portfolio-overview', title: 'Portfolio overview', components: [
      { id: 'C-08', name: 'asset-allocation', include: 'always', variants: ['scope'], status: 'in progress' },
    ] }],
  });
  assert.deepEqual(checkManifest(raw), []);
  assert.deepEqual(SLIDE_MANIFEST, raw);
});

test('a malformed manifest is refused', () => {
  const comp = { id: 'C-08', name: 'asset-allocation', include: 'always', variants: ['scope'], status: 'in progress' };
  assert.deepEqual(checkManifest(null), ['the manifest is not an object']);
  assert.match(checkManifest({ version: 2, sections: [{ n: 4, id: 's', title: 'S', components: [comp] }] }).join(), /version 2/);
  assert.match(checkManifest({ version: 1, sections: [] }).join(), /no sections/);
  assert.match(checkManifest({ version: 1, sections: [{ n: 4, id: 's', title: 'S', components: [comp, comp] }] }).join(), /C-08 appears twice/);
  assert.match(checkManifest({ version: 1, sections: [{ n: 4, id: 's', title: 'S', components: [{ ...comp, include: 'sometimes' }] }] }).join(), /unknown inclusion rule/);
  assert.match(checkManifest({ version: 1, sections: [{ n: 4, id: 's', title: 'S', components: [{ ...comp, id: 'C-8' }] }] }).join(), /malformed/);
});

/** A book with nothing to show: no asset row, every total missing, both charts empty. */
function emptyVM(): OverviewVM {
  const vm = standardVM();
  const na = 'NOT AVAILABLE IN SUPPLIED DATA' as const;
  const total = line('total', null, null, 'Grand Total', 'alloc.total', { invested: null, cmv: 0, pct: 0 }, 0);
  total.cmv = missing('alloc.total.cmv', na);
  total.pct = missing('alloc.total.pct', 'NOT APPLICABLE');
  vm.allocation.rows = [total];
  vm.liquidity.rows = [];
  vm.charts.asset = { ...vm.charts.asset, slices: [], emptyStatus: 'NOT APPLICABLE' };
  vm.charts.liquidity = { ...vm.charts.liquidity, slices: [], emptyStatus: 'NOT APPLICABLE' };
  vm.kpis = vm.kpis.map((k) => ({ ...k, figure: missing(k.figure.key, na) }));
  return vm;
}

test('the overview download exists exactly when a slide would be produced', () => {
  for (const vm of [standardVM(), emptyVM()]) {
    assert.deepEqual(plannedComponents(SLIDE_MANIFEST, vm).map((p) => p.component.id), ['C-08']);
    assert.deepEqual(sectionDownloads(SLIDE_MANIFEST, vm), [{ id: 'portfolio-overview', title: 'Portfolio overview', components: ['C-08'] }]);
  }
  const none = { version: 1, sections: [{ n: 9, id: 'later', title: 'Later', components: [{ id: 'C-34', name: 'tax-lt-st', include: 'always' as const, variants: [], status: 'not started' as const }] }] };
  assert.deepEqual(sectionDownloads(none, standardVM()), [], 'no download for a section without a rendered component');
});

test('the overview download always yields at least one slide', async () => {
  for (const vm of [standardVM(), emptyVM()]) {
    const { inv, build } = await buildDeck(vm);
    assert.ok(inv.slides.length >= 1);
    assert.equal(build.slides, inv.slides.length);
  }
  const { inv } = await buildDeck(emptyVM());
  const s = inv.slides[0] as Slide;
  assert.equal(s.charts.length, 0);
  assert.equal(shapeNamed(s, 'C-08 asset pie empty').text, 'Chart not drawn: not applicable.');
  assert.equal(shapeNamed(s, 'C-08 liquidity pie empty').text, 'Chart not drawn: not applicable.');
  assert.deepEqual(s.tables[0]!.rows[1]!.cells.map((c) => c.text), ['Grand Total', '\u2014', '\u2014', '\u2014']);
  assert.equal(shapeNamed(s, 'C-08 kpi cmv value').text, '\u2014');
});

test('L28: a chart not drawn names its status as the screen\'s notes word it, never the raw status', async () => {
  // Written out by hand from the data dictionary's status table (DATA_DICTIONARY.md \u00a72).
  const want: Array<[MissingStatus | null, string]> = [
    ['NOT APPLICABLE', 'Chart not drawn: not applicable.'],
    ['NOT AVAILABLE IN SUPPLIED DATA', 'Chart not drawn: not available in supplied data.'],
    ['INVALID SOURCE DATA', 'Chart not drawn: invalid source data.'],
    ['NOT DISCLOSED', 'Chart not drawn: not disclosed.'],
    ['STALE DATA', 'Chart not drawn: stale data.'],
    ['PARTIAL COVERAGE', 'Chart not drawn: partial coverage.'],
    // No status given (a view-model with no slice to show and no status): as the screen, not available.
    [null, 'Chart not drawn: not available in supplied data.'],
  ];
  for (const [status, text] of want) assert.equal(chartNotDrawnText({ emptyStatus: status }), text, String(status));
  for (const status of MISSING_STATUSES) {
    const text = chartNotDrawnText({ emptyStatus: status });
    assert.match(text, /^Chart not drawn: [a-z][a-z ]+\.$/, `${status}: a lower-case phrase in one sentence`);
    assert.ok(!text.includes(status), `${status}: not the raw status`);
  }
  // On the slide: an empty liquidity pie with INVALID SOURCE DATA beside a drawn asset pie.
  const vm = standardVM();
  vm.charts.liquidity = { ...vm.charts.liquidity, slices: [], emptyStatus: 'INVALID SOURCE DATA' };
  const s = (await buildDeck(vm)).inv.slides[0] as Slide;
  assert.equal(shapeNamed(s, 'C-08 liquidity pie empty').text, 'Chart not drawn: invalid source data.');
  assert.deepEqual(s.charts.map((c) => c.name), ['C-08 asset pie']);
});
