// covers: E-25 E-80 U-23 KI-048 KI-100 M3
// The store with an accepted IRR file (MOD-05's review N2): section 5's holdings view and the downloaded workbook's
// client sheets take their subtotals from the IRR file through the same hook (views/holdings.ts irrHookFrom over
// state.irr.returns), so the screen and the file agree (the cross-output rule). Without the IRR file both are on the
// CMV-weighted path. Base book syn-standard, transactions file irr-standard (tests/fixtures/make-irr-files.ts).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import { buildHoldingsVM, irrHookFrom } from '../../app/src/views/holdings.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { AS_ON_30_SEP_2026, fixtureById, nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { irrFixtures } from '../fixtures/make-irr-files.ts';

const base = fixtureById('syn-standard');
const irrBytes = irrFixtures().find((f) => f.id === 'irr-standard')!.bytes;

describe('section 5 and the client sheets with an accepted IRR file', () => {
  const w = nodeWiring();
  const store = createStore({ wiring: w, prefs: memoryPrefs().prefs, logos: [] });
  const equityRow = async () => {
    await store.exportWorkbook();
    const t = sheetTable(sheetByName(readXlsx(w.last.xlsx!.bytes), 'Sample Client A'));
    const head = t[0]!;
    const eq = t.find((r) => r[0] === 'Asset class' && r[1] === 'Equity')!;
    return { xirr: eq[head.indexOf('XIRR (%)')], status: eq[head.indexOf('XIRR Status')], basis: eq[head.indexOf('XIRR Basis')], notes: t.filter((r) => r[0] === 'Note').map((r) => r[1]) };
  };

  test('without the IRR file: the CMV-weighted path on screen and in the sheet', async () => {
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: base.bytes });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    for (const h of store.get().review!.issues.filter((i) => i.severity === 'High' && i.status === 'open')) store.dispatch({ type: 'acknowledge', resultId: h.id });
    assert.equal(store.get().review!.gate.canExport, true);
    assert.equal(irrHookFrom(store.get().irr.returns), undefined);
    const row = await equityRow();
    assert.equal(row.basis, 'Weighted by market value');
    assert.equal(typeof row.xirr, 'number');
  });

  test('with it: the same blank, status and reason on screen and in the sheet; no CMV-weighted figure in its place', async () => {
    store.dispatch({ type: 'irr-picked', fileName: 'irr-standard.xlsx', bytes: irrBytes });
    store.dispatch({ type: 'irr-accept' });
    const s = store.get();
    assert.ok(s.irr.returns !== null);
    const screen = buildHoldingsVM(s.review!, { irr: irrHookFrom(s.irr.returns) }).clients[0]!;
    const row = await equityRow();
    assert.equal(row.basis, 'IRR file');
    assert.equal(row.xirr, null);
    assert.equal(row.status, STATUS.PARTIAL);
    assert.doesNotMatch(screen.rows.find((r) => r.level === 'asset' && r.name === 'Equity')!.cells.xirr.text, /[0-9]/);
    assert.deepEqual(row.notes.slice(1), screen.notes, 'the sheet carries the screen\'s notes after its caption');
    assert.equal(row.notes[0], screen.caption);
  });
});
