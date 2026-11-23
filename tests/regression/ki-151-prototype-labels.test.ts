// covers: E-01 E-21 E-22 E-24 U-18 U-19 U-20 BR-14.3 KI-151 D-039
// KI-151 is the new app's guard (the M1.4 fix round 2, N5 and N6): a label from the base file that is the name of an
// Object.prototype member is an ordinary label. The live page's defect is KI-183 (the coordinating chat's record): there
// "constructor", "__proto__", "toString", "hasOwnProperty" or "valueOf" break the review as an Asset, Client, Category
// or Product Name and leak text as an AMC or Distributor Name.
//
// The grid: 7 label fields (Asset Name, Client Name, Category Name, Product Name, AMC, Distributor Name, Instrument Name)
// times those 5 keys. For each, SYNTHETIC_BOOK with holding 0's label replaced by the key (labelGridFixtures in
// tests/fixtures/make-books.ts) is read, reviewed, shown and exported through the page's wiring in Node: the label shows
// as itself where the view-model shows that field (never "function Object()" or "[object Object]"), the workbook keeps
// it as itself in Holdings (as loaded), the workbook and the deck build, no output carries a function's text or an
// object's, and the totals are the unchanged book's (3.353 Cr of market value, 2.85 Cr invested, 6 holdings).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { unzip, partText } from '../helpers/unzip.ts';
import { labelGridFixtures, LABEL_GRID_FIELDS, PROTOTYPE_KEYS } from '../fixtures/make-books.ts';

/** Text that a label read through a plain object would leak: a function's source or an object's string. */
const LEAK = /\[object Object\]|function \w*\(|\[native code\]/;
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v ?? null : null);

/** The column of Holdings (as loaded) that keeps each field as given (exports/xlsx/sheets/holdings-as-loaded.ts). */
const HOLDINGS_COLUMN: Readonly<Record<string, string>> = {
  'Asset Name': 'Asset Name (as given)', 'Client Name': 'Client', 'Category Name': 'Category', 'Product Name': 'Product',
  AMC: 'AMC', 'Distributor Name': 'Distributor', 'Instrument Name': 'Instrument Name',
};

/** Where the view-model shows a label of each field (AMC, Category and an included Instrument Name: the workbook only). */
function shownInVM(vm: OverviewVM, header: string, key: string): boolean | null {
  switch (header) {
    case 'Asset Name': return vm.notes.some((n) => n.id === 'unknown' && n.text === `Unknown: holdings whose Asset Name is not recognised (${key}).`);
    case 'Client Name': return vm.matrices.client.columns.some((c) => c.label === key);
    case 'Distributor Name': return vm.matrices.distributor.columns.some((c) => c.label === key);
    case 'Product Name': return vm.allocation.rows.some((r) => r.kind === 'product' && r.product === key && r.label === key)
      && vm.matrices.client.rows.some((r) => r.kind === 'product' && r.product === key && r.label === key);
    default: return null;
  }
}

describe('KI-151: the 7 label fields times the 5 Object.prototype names', () => {
  const grid = labelGridFixtures();
  const w = nodeWiring();
  const standard = reviewOf(w, fixtureById('syn-standard')).review;

  test('the grid has 35 books, one per field and key', () => {
    assert.equal(grid.length, LABEL_GRID_FIELDS.length * PROTOTYPE_KEYS.length);
    assert.equal(grid.length, 35);
    assert.equal(new Set(grid.map((f) => f.id)).size, 35);
  });

  for (const f of grid) {
    test(`${f.header} "${f.key}": read, reviewed, shown as itself, exported, totals unchanged`, async () => {
      const { review, vm } = reviewOf(w, f);
      // The totals of the unchanged book.
      assert.deepEqual([v(review.totals.cmv), v(review.totals.invested), v(review.totals.gain)],
        [v(standard.totals.cmv), v(standard.totals.invested), v(standard.totals.gain)]);
      assert.deepEqual([review.totals.counts.included, review.totals.counts.excluded], [6, 0]);
      assert.ok(review.issues.some((i) => i.ruleId === 'reconcile.passed'), 'the review reconciles');
      // The label as itself: the reader keeps it, and the view-model shows it where it shows the field.
      const h0 = review.holdings[0]!;
      const read: Record<string, string | null> = {
        'Asset Name': h0.assetLabel, 'Client Name': h0.clientLabel, 'Category Name': h0.categoryLabel, 'Product Name': h0.product,
        AMC: h0.amcLabel, 'Distributor Name': h0.distributorLabel, 'Instrument Name': h0.instrumentName,
      };
      assert.equal(read[f.header], f.key, 'the reader keeps the label');
      const shown = shownInVM(vm, f.header, f.key);
      if (shown !== null) assert.ok(shown, `the view-model shows "${f.key}" as itself`);
      const vmText = JSON.stringify(vm);
      assert.ok(!LEAK.test(vmText), `no leaked text in the view-model: ${vmText.match(LEAK)?.[0]}`);
      // The workbook: builds, keeps the label in Holdings (as loaded), and leaks nothing.
      await w.exportWorkbook(review, vm);
      const bytes = w.last.xlsx!.bytes;
      const table = sheetTable(sheetByName(readXlsx(bytes), 'Holdings (as loaded)'));
      const col = table[0]!.findIndex((c) => c === HOLDINGS_COLUMN[f.header]);
      assert.ok(col >= 0, `Holdings (as loaded) has a ${HOLDINGS_COLUMN[f.header]} column`);
      assert.equal(table[1]![col], f.key, 'the workbook keeps the label as itself');
      const z = unzip(bytes);
      for (const e of z.entries) if (e.name.endsWith('.xml')) assert.ok(!LEAK.test(partText(z, e.name)), `${e.name}: no leaked text`);
      // The deck: builds and leaks nothing.
      await w.exportDeck(review, vm, null);
      const d = unzip(w.last.pptx!.bytes);
      assert.ok(d.entries.some((e) => e.name === 'ppt/slides/slide1.xml'), 'the deck has its slide');
      for (const e of d.entries) if (e.name.endsWith('.xml')) assert.ok(!LEAK.test(partText(d, e.name)), `${e.name}: no leaked text`);
    });
  }
});
