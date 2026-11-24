// covers: U-03 U-04 U-15 U-60 D-029 D-037 D-039 M1.4 (fix round 2, N12: the words of sections 1 and 2)
// The screen words the second verify of M1.4 found wrong (QA, 27 Oct 2026), with the real reader, engine and
// view-model on synthetic books and every expected sentence written out by hand:
//   - the client and distributor notes count the named columns only, as the Clients KPI does, and put the "not given"
//     column in words ("2 clients, and 2 holdings with no client");
//   - the review bar never names a refused file ("Base file refused"), nor a file whose review failed;
//   - an empty liquidity table is a sentence, as the pies' are;
//   - the client and distributor column headers show the labels as the file spells them (no upper case).
// SYNTHETIC_BOOK: clients A (h0, h1, h2) and B (h3, h4, h5); distributors Centricity (h0, h1, h3, h4) and Other
// Distributor (h2, h5). syn-blank-entities blanks the client of h0 and h3 and the distributor of h2.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { EntityMatrixVM } from '../../../app/src/views/overview-vm.ts';
import type { UploadState } from '../../../app/src/ui/upload-slot.ts';
import { barFileName, barFileStatus } from '../../../app/src/ui/upload-slot.ts';
import { hiddenMatrixSentence, isNotGivenColumn, matrixNote } from '../../../app/src/ui/matrix-text.ts';
import { emptyLiquiditySentence, emptyPieSentence } from '../../../app/src/ui/overview-text.ts';
import { createStore, reviewBar } from '../../../app/src/ui/store.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { memoryPrefs } from '../../helpers/sample-review.ts';
import { loadSheetJS, REPO, writeXlsx } from '../../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
/** An en dash (U+2013) or an em dash (U+2014): never inside a sentence (D-029). */
const DASH_IN_SENTENCE = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const matrix = (level: 'client' | 'distributor', ids: string[], shown: boolean): EntityMatrixVM => ({
  level, title: level === 'client' ? 'Client Allocation' : 'Distributor Allocation', shown, rows: [],
  columns: ids.map((id) => ({ id, label: id, cmv: null as never, share: null as never })),
});

describe('N12: the client and distributor notes count named columns, and put the rest in words', () => {
  test('by hand: the "not given" column is not a client; its holdings are counted in words', () => {
    assert.equal(matrixNote(matrix('client', ['cl1', 'cl2', 'client:none'], true), 2), '2 clients, and 2 holdings with no client');
    assert.equal(matrixNote(matrix('distributor', ['d1', 'd2', 'distributor:none'], true), 1), '2 distributors, and 1 holding with no distributor');
    assert.equal(matrixNote(matrix('client', ['cl1', 'client:none'], true), 3), '1 client, and 3 holdings with no client');
    assert.equal(matrixNote(matrix('client', ['cl1', 'cl2'], true), 0), '2 clients');
    assert.equal(matrixNote(matrix('distributor', ['d1', 'd2', 'd3'], true), 0), '3 distributors');
    assert.equal(isNotGivenColumn({ level: 'client' }, { id: 'client:none' }), true);
    assert.equal(isNotGivenColumn({ level: 'client' }, { id: 'distributor:none' }), false);
  });

  test('by hand: a hidden matrix whose only column is "not given" names no client, never "Single client"', () => {
    const only = matrix('client', ['client:none'], false);
    assert.equal(matrixNote(only, 6), 'No client named');
    assert.equal(hiddenMatrixSentence(only), 'No included holding names a client: no client matrix is shown, and the workbook has no Client Allocation sheet.');
    const d = matrix('distributor', ['distributor:none'], false);
    assert.equal(matrixNote(d, 6), 'No distributor named');
    assert.equal(hiddenMatrixSentence(d), 'No included holding names a distributor: no distributor matrix is shown, and the workbook has no Distributor Allocation sheet.');
    assert.equal(matrixNote(matrix('client', ['cl1'], false), 0), 'Single client');
    assert.equal(matrixNote(matrix('client', [], false), 0), 'No included holding');
  });

  test('syn-blank-entities through the wiring: the notes agree with the Clients KPI', () => {
    const { review, vm } = reviewOf(nodeWiring(), fixtureById('syn-blank-entities'));
    const c = review.totals.counts;
    // Named clients: A (h1, h2) and B (h4, h5); h0 and h3 name none. Distributors: Centricity (h0, h1, h3, h4) and
    // Other Distributor (h5); h2 names none.
    assert.deepEqual([c.clients, c.withoutClient, c.distributors, c.withoutDistributor], [2, 2, 2, 1]);
    assert.equal(vm.kpis.find((k) => k.id === 'clients')!.figure.display.text, '2');
    assert.deepEqual(vm.matrices.client.columns.map((x) => x.label).sort(), ['Client not given', 'Sample Client A', 'Sample Client B']);
    assert.equal(matrixNote(vm.matrices.client, c.withoutClient), '2 clients, and 2 holdings with no client');
    assert.equal(matrixNote(vm.matrices.distributor, c.withoutDistributor), '2 distributors, and 1 holding with no distributor');
    assert.doesNotMatch(matrixNote(vm.matrices.client, c.withoutClient), DASH_IN_SENTENCE);
  });

  test('syn-standard: no "not given" column, the plain count', () => {
    const { review, vm } = reviewOf(nodeWiring(), fixtureById('syn-standard'));
    assert.equal(matrixNote(vm.matrices.client, review.totals.counts.withoutClient), '2 clients');
    assert.equal(matrixNote(vm.matrices.distributor, review.totals.counts.withoutDistributor), '2 distributors');
  });
});

describe('N12: the review bar never names a refused file', () => {
  const up = (u: Partial<UploadState>): UploadState => ({ stage: null, fileName: null, size: 0, loaded: null, error: null, ...u });

  test('the words for each state of the slot, by hand', () => {
    assert.deepEqual([barFileName(up({})), barFileStatus(up({}))], [null, 'No base file loaded']);
    const tooLarge = up({ stage: 'upload', fileName: 'just-over.xlsx', size: 21 * 1024 * 1024, error: { kind: 'too-large', message: 'x' } });
    assert.deepEqual([barFileName(tooLarge), barFileStatus(tooLarge)], [null, 'Base file refused']);
    const failed = up({ stage: 'upload', fileName: 'odd.xlsx', error: { kind: 'review-failed', message: 'x' } });
    assert.deepEqual([barFileName(failed), barFileStatus(failed)], [null, 'Base file not reviewed']);
    const reading = up({ stage: 'upload', fileName: 'syn-standard.xlsx' });
    assert.deepEqual([barFileName(reading), barFileStatus(reading)], [null, 'No base file loaded'], 'not yet read');
  });

  test('through the store: refused files (not a workbook, too large, no holding) leave the bar without their names', () => {
    const w = nodeWiring();
    const store = createStore({ wiring: w, prefs: memoryPrefs().prefs, logos: [] });
    const noHolding = (() => {
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['Client Name', 'Instrument Name', 'Current Market Value (Cr.)']]), 'Base File');
      return writeXlsx(xlsx, wb);
    })();
    for (const [name, bytes] of [
      ['notes.xlsx', new TextEncoder().encode('This is not a workbook.\n')],
      ['just-over.xlsx', new Uint8Array(21 * 1024 * 1024)],
      ['header-only.xlsx', noHolding],
    ] as const) {
      store.dispatch({ type: 'file-picked', fileName: name, bytes });
      const s = store.get();
      assert.equal(s.upload.fileName, name, 'the slot keeps the name, for its own sentence');
      assert.equal(reviewBar(s).fileName, null, `${name}: not named in the bar`);
      assert.equal(barFileStatus(s.upload), 'Base file refused', name);
    }
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: fixtureById('syn-standard').bytes });
    assert.equal(reviewBar(store.get()).fileName, 'syn-standard.xlsx', 'a file read is named before Accept');
    assert.equal(barFileStatus(store.get().upload), null);
    store.dispatch({ type: 'accept' });
    assert.equal(reviewBar(store.get()).fileName, 'syn-standard.xlsx', 'and after Accept');
    store.dispatch({ type: 'remove' });
    assert.deepEqual([reviewBar(store.get()).fileName, barFileStatus(store.get().upload)], [null, 'No base file loaded']);
  });

  test('a review that fails after Accept: "Base file not reviewed", not the name', () => {
    const w = nodeWiring();
    const failing = { ...w, computeReview: () => { throw new Error('planted engine failure'); } };
    const store = createStore({ wiring: failing, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: fixtureById('syn-standard').bytes });
    store.dispatch({ type: 'accept' });
    const s = store.get();
    assert.equal(s.upload.error?.kind, 'review-failed');
    assert.deepEqual([reviewBar(s).fileName, barFileStatus(s.upload)], [null, 'Base file not reviewed']);
  });
});

describe('N12: an empty liquidity table is a sentence', () => {
  /** syn-standard with "NA" in every market value cell: no holding is included. */
  function allNa(): Uint8Array {
    const wb = xlsx.read(fixtureById('syn-standard').bytes, { type: 'array', cellDates: false }) as { Sheets: Record<string, Record<string, { v: unknown; t: string; w?: string }>> };
    const ws = wb.Sheets['Base File']!;
    const range = xlsx.utils.decode_range(ws['!ref'] as unknown as string);
    let changed = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const head = ws[xlsx.utils.encode_cell({ r: 0, c })];
      // "Current Market Value (Cr.)" and the rupee column "Market Value (₹)" (make-books.ts STANDARD).
      if (!head || !/^(?:Current )?Market Value/i.test(String(head.v))) continue;
      for (let r = 1; r <= range.e.r; r++) {
        const addr = xlsx.utils.encode_cell({ r, c });
        if (ws[addr]) { ws[addr] = { v: 'NA', t: 's' }; changed++; }
      }
    }
    assert.equal(changed, 12, 'six holdings, two market value columns each');
    return writeXlsx(xlsx, wb);
  }

  test('every market value "NA": no liquidity line, and the sentence names the pie\'s status', () => {
    const { review, vm } = reviewOf(nodeWiring(), { id: 'syn-all-na', bytes: allNa() });
    assert.equal(review.totals.counts.included, 0);
    assert.equal(vm.liquidity.rows.length, 0);
    assert.equal(emptyLiquiditySentence(vm), 'No liquidity line to show: not available in supplied data.');
    assert.equal(emptyPieSentence(vm.charts.liquidity), 'No slice to show: not available in supplied data.');
    assert.equal(emptyPieSentence(vm.charts.asset), 'No slice to show: not available in supplied data.');
    assert.doesNotMatch(emptyLiquiditySentence(vm)!, DASH_IN_SENTENCE);
  });

  test('a review with liquidity lines keeps its table', () => {
    const { vm } = reviewOf(nodeWiring(), fixtureById('syn-standard'));
    assert.equal(vm.liquidity.rows.length, 1);
    assert.equal(emptyLiquiditySentence(vm), null);
    assert.equal(emptyPieSentence({ emptyStatus: 'NOT APPLICABLE' }), 'No slice to show: not applicable.');
  });
});

describe('N12: client and distributor column headers as the file spells them', () => {
  test('the column headers carry the class "entity", which the stylesheet leaves in their own letter case', () => {
    const tsx = fs.readFileSync(path.join(REPO, 'app', 'src', 'ui', 'components', 'entity-matrix.tsx'), 'utf8');
    assert.match(tsx, /matrix\.columns\.map\(\(c\) => <th scope="col" class="num entity" key=\{c\.id\}>\{c\.label\}<\/th>\)/);
    const css = fs.readFileSync(path.join(REPO, 'app', 'src', 'ui', 'shell.css'), 'utf8');
    const upper = css.indexOf('text-transform: uppercase;\n  border-bottom: none;');
    const entity = css.indexOf('table.data thead th.entity { text-transform: none; }');
    assert.ok(upper > 0 && entity > upper, 'the entity rule follows the uppercase header rule');
  });

  test('syn-case-variants: the view-model keeps both spellings as two columns (the browser check reads the screen)', () => {
    const { vm } = reviewOf(nodeWiring(), fixtureById('syn-case-variants'));
    const labels = vm.matrices.client.columns.map((x) => x.label);
    assert.ok(labels.includes('Sample Client A') && labels.includes('SAMPLE CLIENT A'), labels.join(' | '));
    assert.equal(new Set(labels).size, labels.length);
    const d = vm.matrices.distributor.columns.map((x) => x.label);
    assert.ok(d.includes('Centricity') && d.includes('CENTRICITY'), d.join(' | '));
  });
});
