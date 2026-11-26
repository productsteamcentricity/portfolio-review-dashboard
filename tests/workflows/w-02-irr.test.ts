// covers: W-2 U-13 U-25 U-58 E-85 (the analyst adds a transactions (IRR) file, M3a wiring, NB-03)
// Workflow W-2 through the real store and the page's reader, engine and exporters in Node (tests/helpers/node-wiring.ts):
// the IRR slot refuses a pick before a base file is accepted; upload and accept the synthetic base book (syn-standard),
// upload the synthetic IRR file (irr-matched: the standard flows with the base book's distributor names, so the adviser
// scopes hold flows), read its import notes, accept it, read the returns of the family, pick an adviser scope and read
// its own returns, pick a client scope, download the workbook and find its Fund IRR sheet with the adviser's headline;
// then pick a base file again and the IRR file is gone.
// Adviser "Centricity", worked by hand (the full working is in tests/unit/engine/review-returns.test.ts): its one
// instrument is A's Bluechip, -10,000 on 1 Apr 2023, -5,000 on 1 Apr 2024 (366 days on), +17,000 on 31 Mar 2025 (730
// days from the first): 10,000 x^2 + 5,000 x^(364/365) = 17,000 gives r = 7.7634%, shown "7.76%"; its benchmark flows
// (+16,500 at the end) give 5.8658%, "5.87%". Its holdings without flows: Flexi Cap and Gold ETF FoF.
// The store passes the returns view-model to the wiring's exportWorkbook; the Node wiring's own exportWorkbook takes
// two arguments, so this test's wiring builds the workbook with the third (as ui/wiring.ts does in the browser).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Wiring } from '../../app/src/ui/wiring.ts';
import { createStore } from '../../app/src/ui/store.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { buildIrrImportVM, IRR_ISSUES_NOTICE, irrSlotView, scopeOf } from '../../app/src/views/returns.ts';
import { buildSourceRegister } from '../../app/src/views/source-register.ts';
import { MISSING_MARKER } from '../../app/src/config/formats.ts';
import { AS_ON_30_SEP_2026, fixtureById, nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { irrFixtures } from '../fixtures/make-irr-files.ts';

const base = fixtureById('syn-standard');
const irrBytes = irrFixtures().find((f) => f.id === 'irr-matched')!.bytes;

describe('W-2: base file, IRR file, returns, workbook', () => {
  const nw = nodeWiring();
  let workbook: Uint8Array | null = null;
  const wiring: Wiring = {
    ...nw,
    exportWorkbook: async (review, vm, returns) => {
      workbook = buildOverviewWorkbook(workbookInputFrom(review, vm, returns));
      return nw.exportWorkbook(review, vm);
    },
  };
  const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });

  test('the IRR slot is disabled, and a pick ignored, until a base file is accepted', () => {
    assert.equal(irrSlotView(store.get().irr, false).disabled, true);
    store.dispatch({ type: 'irr-picked', fileName: 'irr-matched.xlsx', bytes: irrBytes });
    assert.equal(store.get().irr.stage, null);
    assert.equal(store.get().irr.fileName, null);
  });

  test('upload, read and accept the base file', () => {
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: base.bytes });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    const s = store.get();
    assert.equal(s.upload.stage, 'review');
    assert.ok(s.review !== null);
    const high = s.review.issues.filter((i) => i.severity === 'High' && i.status === 'open');
    for (const h of high) store.dispatch({ type: 'acknowledge', resultId: h.id });
    assert.equal(store.get().review!.gate.canExport, true, store.get().review!.gate.reasons.join(' '));
  });

  test('Gate B R1: a refused IRR file (no fund sheet) cannot be accepted, shows its reason and the notice, and leaves no returns', () => {
    const noFund = irrFixtures().find((f) => f.id === 'irr-no-fund')!.bytes;
    store.dispatch({ type: 'irr-picked', fileName: 'irr-no-fund.xlsx', bytes: noFund });
    const s = store.get();
    const slot = irrSlotView(s.irr, true);
    assert.equal(slot.chip, 'Refused');
    assert.match(slot.refusal ?? '', /^Refused: no sheet holds fund flows/);
    assert.equal(slot.canAccept, false);
    assert.equal(slot.acceptReason, 'The file was refused: choose another transactions file.');
    assert.equal(buildIrrImportVM(s.irr.loaded!).notice, IRR_ISSUES_NOTICE, 'the notice shows for a refused file too');
    store.dispatch({ type: 'irr-accept' });
    const after = store.get();
    assert.notEqual(after.irr.stage, 'review', 'Accept does nothing');
    assert.equal(after.irr.vm, null);
    assert.equal(after.irr.returns, null);
  });

  test('upload the IRR file: read, waiting for Accept, with its import notes and the notice that its issues do not block the download', () => {
    store.dispatch({ type: 'irr-picked', fileName: 'irr-matched.xlsx', bytes: irrBytes });
    const s = store.get();
    assert.equal(s.irr.stage, 'validate');
    assert.equal(s.irr.error, null);
    assert.equal(s.irr.vm, null, 'no returns before Accept');
    const slot = irrSlotView(s.irr, true);
    assert.equal(slot.stage, 'preview');
    assert.equal(slot.canAccept, true);
    const notes = buildIrrImportVM(s.irr.loaded!);
    assert.equal(notes.notice, IRR_ISSUES_NOTICE);
    assert.equal(notes.flowsText, '7 fund flows and 5 benchmark flows read; 0 rows skipped.');
  });

  test('accept: the returns of every scope, the family first, and the IRR file in the source register', () => {
    store.dispatch({ type: 'irr-accept' });
    const s = store.get();
    assert.equal(s.irr.stage, 'review');
    const vm = s.irr.vm!;
    assert.ok(vm !== null && s.irr.returns !== null);
    assert.deepEqual(vm.scopes.map((x) => x.pickerLabel).slice(0, 3), ['Family', 'Client: Sample Client A', 'Client: Sample Client B']);
    const family = scopeOf(vm, s.irr.scopeKey)!;
    assert.equal(family.key, 'family');
    assert.equal(family.headline.fund.key, 'returns.family.fund');
    assert.notEqual(family.headline.fund.display.text, MISSING_MARKER);
    assert.match(family.headline.fund.display.text, /^\d+\.\d\d%$/);
    assert.equal(vm.source!.role, 'irr-file');
    const register = buildSourceRegister([...s.review!.sources, vm.source!]);
    assert.deepEqual(register.rows.map((r) => r.role), ['Base file (holdings)', 'Transactions (IRR) file']);
  });

  test('pick an adviser scope: Centricity\'s own flows, its tree and its holdings without flows (hand-worked above)', () => {
    const vm = store.get().irr.vm!;
    assert.deepEqual(vm.scopes.map((x) => x.pickerLabel),
      ['Family', 'Client: Sample Client A', 'Client: Sample Client B', 'Adviser: Centricity', 'Adviser: Other Distributor']);
    assert.equal(vm.advisorText, null);
    const key = vm.scopes.find((x) => x.pickerLabel === 'Adviser: Centricity')!.key;
    store.dispatch({ type: 'scope-picked', key });
    assert.equal(store.get().irr.scopeKey, key);
    const c = scopeOf(store.get().irr.vm!, key)!;
    assert.equal(c.kind, 'advisor');
    assert.equal(c.headline.fund.display.text, '7.76%');
    assert.equal(c.headline.bench.display.text, '5.87%');
    assert.equal(c.headline.flowsText, '3 fund flows from 1 Apr 2023 to 31 Mar 2025');
    assert.deepEqual(c.tree.filter((t) => t.level === 'instrument').map((t) => t.label), ['Sample Bluechip Fund - Regular Plan - Growth']);
    const without = c.notes.find((n) => n.id === 'holdings-without-flows')!;
    assert.ok(without, 'the holdings without flows are listed');
    assert.match(without.text, /^2 holdings of this scope have no flow in the transactions file/);
    assert.match(without.text, /: Sample Flexi Cap Fund - Regular Plan - Growth, Sample Gold ETF Fund of Fund - Growth\.$/);
    assert.ok(c.unassigned !== null, 'the unassigned line shows on an adviser scope');
    assert.equal(c.unassigned.share.display.text, '18.60%');
  });

  test('pick a client scope; a scope the view does not list is ignored', () => {
    const clientKey = store.get().irr.vm!.scopes[1]!.key;
    store.dispatch({ type: 'scope-picked', key: clientKey });
    assert.equal(store.get().irr.scopeKey, clientKey);
    store.dispatch({ type: 'scope-picked', key: 'client:nobody' });
    assert.equal(store.get().irr.scopeKey, clientKey);
    assert.equal(scopeOf(store.get().irr.vm!, clientKey)!.pickerLabel, 'Client: Sample Client A');
  });

  test('a change to the review recomputes the returns, keeping the scope', () => {
    const before = store.get().irr.returns;
    const clientKey = store.get().irr.scopeKey;
    const a = store.get().review!.clients[0]!;
    store.dispatch({ type: 'client-label', clientId: a.id, label: 'Client One' });
    const s = store.get();
    assert.notEqual(s.irr.returns, before);
    assert.equal(s.irr.scopeKey, clientKey);
    assert.equal(scopeOf(s.irr.vm!, clientKey)!.pickerLabel, 'Client: Client One');
  });

  test('the workbook download carries the Fund IRR sheet before Audit Log', async () => {
    await store.exportWorkbook();
    assert.ok(workbook !== null);
    const wb = readXlsx(workbook);
    const names = wb.sheets.map((x) => x.name);
    assert.equal(names[names.indexOf('Audit Log') - 1], 'Fund IRR');
    const fundIrr = sheetTable(sheetByName(wb, 'Fund IRR'));
    assert.ok(fundIrr.some((r) => r[1] === 'Headline' && r[3] === 'Family'));
    const adviser = fundIrr.find((r) => r[1] === 'Headline' && r[3] === 'Adviser: Centricity');
    assert.ok(adviser, 'the adviser scope has its headline row');
    const fundXirr = adviser[4]; // column E, Fund XIRR (%)
    assert.ok(typeof fundXirr === 'number' && Math.abs(fundXirr - 7.7634) < 0.0005, `Centricity fund XIRR ${String(fundXirr)}`);
    assert.equal(store.get().exportLog.length, 1);
  });

  test('Remove clears the IRR file only; a new base file clears it too', () => {
    store.dispatch({ type: 'irr-remove' });
    assert.equal(store.get().irr.loaded, null);
    assert.equal(store.get().irr.vm, null);
    assert.ok(store.get().review !== null, 'the review stays');
    store.dispatch({ type: 'irr-picked', fileName: 'irr-matched.xlsx', bytes: irrBytes });
    store.dispatch({ type: 'irr-accept' });
    assert.ok(store.get().irr.vm !== null);
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: base.bytes });
    const s = store.get();
    assert.equal(s.irr.stage, null);
    assert.equal(s.irr.loaded, null);
    assert.equal(s.irr.vm, null);
    assert.equal(s.irr.scopeKey, 'family');
  });
});
