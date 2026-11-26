// covers: E-19 E-13 E-15 W-1 M2.1
// The M2 matcher wired into section 1 (test build 1, MOD-04's plan of 26 Nov 2026): picking a base file matches its
// holdings to the reference data, the store keeps the match report, the loaded file carries the resolved instruments,
// and the import report shows what each holding was matched to (E-19). A wiring without matching (an older fake) and
// a matcher that throws never block a file.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import { buildImportReport } from '../../app/src/views/import-report.ts';
import { MATCHING_FAILED, MATCHING_NO_DATA } from '../../app/src/views/matching.ts';
import { nodeWiring } from '../helpers/node-wiring.ts';
import { committedBlocks } from '../helpers/match-blocks.ts';
import { buildMatchContext, matchLoaded } from '../../app/src/engine/match/resolve-holdings.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
function workbook(rows: unknown[][]): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Base File');
  return new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
const BYTES = workbook([
  ['Client Name', 'Instrument Name', 'Product Name', 'AMC', 'Current Market Value (Cr.)'],
  ['Sample Client A', 'HDFC Flexi Cap Fund - Regular Plan - Growth', 'Mutual Funds', 'HDFC Mutual Fund', 1],
  ['Sample Client A', 'ICICI Prudential Bluechip Fund - Growth', 'Mutual Funds', 'ICICI Prudential Mutual Fund', 2],
  ['Sample Client A', 'Synthetic Unknown Opportunities Fund', 'Mutual Funds', 'Zeta Mutual Fund', 3],
  ['Sample Client A', 'Synthetic Bank Fixed Deposit 2027', 'Fixed Deposit', '', 4],
]);

describe('section 1: holdings matched when a base file is picked', () => {
  test('the store keeps the match report and the resolved holdings; the import report shows them', () => {
    const store = createStore({ wiring: nodeWiring(), prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
    const s = store.get();
    assert.equal(s.upload.stage, 'validate');
    assert.ok(s.match);
    assert.equal(s.match.entries.length, 4);
    const loaded = s.upload.loaded!;
    const alias = loaded.base.holdings.find((h) => h.instrumentName === 'ICICI Prudential Bluechip Fund - Growth')!;
    assert.equal(alias.instrument?.vendorKey, 'ICICI Pru Large Cap Fund(G)');
    const r = buildImportReport(loaded.source, loaded.base, s.match);
    assert.match(r.matching.summary, /^2 holdings are matched to reference data and 1 is unmatched; 1 holding is of a class with no fund data\.$/);
    assert.deepEqual(r.matching.matchedTo.map((m) => [m.holding, m.matchedTo]), [['ICICI Prudential Bluechip Fund - Growth', 'ICICI Pru Large Cap Fund(G)']]);
    assert.deepEqual(r.matching.unmatched.map((u) => u.holding), ['Synthetic Unknown Opportunities Fund']);
  });

  test('a new file replaces the match report; removing the file clears it', () => {
    const store = createStore({ wiring: nodeWiring(), prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
    assert.ok(store.get().match);
    store.dispatch({ type: 'remove' });
    assert.equal(store.get().match, null);
  });

  test('a wiring without matching, or a matcher that throws, never blocks the file; a failure is said, never silent (CHAT-008 B1)', () => {
    const plain = nodeWiring();
    delete (plain as { matchHoldings?: unknown }).matchHoldings;
    const a = createStore({ wiring: plain, prefs: memoryPrefs().prefs, logos: [] });
    a.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
    assert.equal(a.get().upload.stage, 'validate');
    assert.equal(a.get().match, null);
    const l = a.get().upload.loaded!;
    assert.equal(buildImportReport(l.source, l.base, a.get().match).matching.summary, MATCHING_NO_DATA);

    const broken = { ...nodeWiring(), matchHoldings: () => { throw new Error('boom'); } };
    const b = createStore({ wiring: broken, prefs: memoryPrefs().prefs, logos: [] });
    b.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
    assert.equal(b.get().upload.stage, 'validate');
    assert.equal(b.get().match?.failed, 'boom');
    assert.ok(b.get().upload.loaded!.base.holdings.every((h) => h.instrument === null));
    const lb = b.get().upload.loaded!;
    const m = buildImportReport(lb.source, lb.base, b.get().match).matching;
    assert.equal(m.error, `${MATCHING_FAILED} The reason: boom`);
    assert.deepEqual([m.counts.length, m.unmatched.length], [0, 0], 'never shown as every holding unmatched');
    b.dispatch({ type: 'accept' });
    assert.equal(b.get().upload.stage, 'review', 'the review still opens');
  });

  test('a product-class table the reader cannot fully read still matches, and names the rule it skipped', () => {
    const blocks = committedBlocks();
    const rules = [{ class: 'BOND', keywords: ['deposit'], label: 'Future deposits', currencyAny: ['eur'] }, ...(blocks.PRODUCT_CLASS_RULES as unknown[])];
    const ctx = buildMatchContext({ ...blocks, PRODUCT_CLASS_RULES: rules });
    const w = { ...nodeWiring(), matchHoldings: (loaded: Parameters<typeof matchLoaded>[0]) => matchLoaded(loaded, ctx) };
    const s = createStore({ wiring: w, prefs: memoryPrefs().prefs, logos: [] });
    s.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
    const match = s.get().match!;
    assert.equal(match.failed, undefined);
    assert.deepEqual(match.skippedRules.map((r) => r.label), ['Future deposits']);
    const l = s.get().upload.loaded!;
    const vm = buildImportReport(l.source, l.base, match).matching;
    assert.match(vm.summary, /^2 holdings are matched/, 'the other rules and the matcher still work');
    assert.equal(match.entries.find((e) => e.classLabel !== null)?.classLabel, 'Fixed deposits', 'the skipped rule never fires: the deposit is still a fixed deposit');
    assert.match(vm.warnings[0]!, /"Future deposits" was not applied: it has a field this application does not read [(]currencyAny[)]/);
  });
});
