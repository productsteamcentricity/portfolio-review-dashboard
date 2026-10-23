// covers: E-143 BR-2.2 R-IN-8 Q-79
// Ownership (architecture §6.8): the client is the sole first holder by default; joint holders and the mode are read
// when the base file has holder columns; a holding is attributed to its first holder and never split.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../../../app/src/model/status.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import type { BaseFileImport } from '../../../app/src/ingest/base-file.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { attributedClient, parseHoldingMode } from '../../../app/src/engine/ownership.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const fixtures = new Map(syntheticFixtures(xlsx).map((f) => [f.id, f]));
const parse = (id: string): BaseFileImport => parseBaseFile(readWorkbook(xlsx, fixtures.get(id)!.bytes),
  { sourceId: 'a'.repeat(64) as SourceFileId, now: () => '2026-10-22T00:00:00.000Z' });
const labelOf = (imp: BaseFileImport, id: string): string => imp.clients.find((c) => c.id === id)!.label;

test('without holder columns the client is the sole first holder, share 100; joint holders and mode are not available', () => {
  const imp = parse('syn-standard');
  assert.equal(imp.ownership.length, imp.folios.length);
  for (const o of imp.ownership) {
    assert.equal(o.source, 'default-sole-holder');
    assert.equal(o.firstHolder.role, 'first');
    assert.deepEqual(o.firstHolder.share.kind === 'value' ? [o.firstHolder.share.v, o.firstHolder.share.unit] : null, [100, 'pct']);
    assert.equal(o.jointHolders.kind === 'missing' && o.jointHolders.status, STATUS.NOT_AVAILABLE);
    assert.equal(o.mode.kind === 'missing' && o.mode.status, STATUS.NOT_AVAILABLE);
  }
  // Two clients, two distributors, four accounts (client x distributor), one folio per row.
  assert.deepEqual(imp.clients.map((c) => c.label), ['Sample Client A', 'Sample Client B']);
  assert.deepEqual(imp.distributors.map((d) => d.label), ['Centricity', 'Other Distributor']);
  assert.equal(imp.accounts.length, 4);
  assert.equal(imp.folios.length, 6);
  assert.ok(imp.accounts.every((a) => a.plan === null));
});

test('joint holders and the mode of holding are read from holder columns when present', () => {
  const imp = parse('syn-holders');
  const byFolio = new Map(imp.ownership.map((o) => [imp.folios.find((f) => f.id === o.folioId)!.number, o]));
  const o1 = byFolio.get('SYN-1001')!;
  assert.equal(o1.source, 'holder-columns');
  assert.equal(labelOf(imp, o1.firstHolder.clientId), 'Sample Client A');
  assert.ok(o1.jointHolders.kind === 'value');
  assert.deepEqual(o1.jointHolders.v.map((h) => [h.role, labelOf(imp, h.clientId)]), [['second', 'Sample Joint Holder']]);
  assert.equal(o1.mode.kind === 'value' && o1.mode.v, 'joint');
  // With joint holders the shares are not in the file: missing for every holder, never split by assumption.
  assert.equal(o1.firstHolder.share.kind, 'missing');
  assert.ok(o1.jointHolders.v.every((h) => h.share.kind === 'missing'));

  const o2 = byFolio.get('SYN-1002')!;
  assert.ok(o2.jointHolders.kind === 'value');
  assert.deepEqual(o2.jointHolders.v.map((h) => h.role), ['second', 'third']);
  assert.equal(o2.mode.kind === 'value' && o2.mode.v, 'anyone-or-survivor');

  const o3 = byFolio.get('SYN-1003')!;
  assert.equal(o3.mode.kind === 'value' && o3.mode.v, 'single');
  assert.equal(o3.firstHolder.share.kind === 'value' && o3.firstHolder.share.v, 100);

  // A row whose holder columns are blank: the client is the sole holder (the file says so), mode single.
  const o4 = byFolio.get('SYN-2001')!;
  assert.ok(o4.jointHolders.kind === 'value' && o4.jointHolders.v.length === 0);
  assert.equal(o4.mode.kind === 'value' && o4.mode.v, 'single');

  // Joint holders are family members the analyst can label; the holding is still the first holder's.
  assert.deepEqual(imp.clients.map((c) => c.label).sort(),
    ['Sample Client A', 'Sample Client B', 'Sample Joint Holder', 'Sample Third Holder']);
});

test('every holding is attributed to its first holder, the client of its row', () => {
  for (const id of ['syn-standard', 'syn-holders']) {
    const imp = parse(id);
    for (const h of imp.holdings) {
      for (const fid of h.folioIds) {
        const o = imp.ownership.find((x) => x.folioId === fid)!;
        assert.equal(attributedClient(o), h.clientId, `${id}: ${h.instrumentName}`);
      }
    }
  }
});

test('mode-of-holding spellings', () => {
  const cases: Array<[string, string | null]> = [
    ['Single', 'single'], ['SI', 'single'], ['sole', 'single'], ['Joint', 'joint'], ['JO', 'joint'],
    ['Jointly', 'joint'], ['Anyone or Survivor', 'anyone-or-survivor'], ['Either or Survivor', 'anyone-or-survivor'],
    ['AS', 'anyone-or-survivor'], ['ES', 'anyone-or-survivor'], ['Any one or survivor', 'anyone-or-survivor'],
    ['Minor', null], ['', null],
  ];
  for (const [text, want] of cases) assert.equal(parseHoldingMode(text), want, text);
});

test('ownership never reaches the audit log', () => {
  const imp = parse('syn-holders');
  const audit = JSON.stringify(imp.audit);
  for (const s of ['Sample Client', 'Sample Joint Holder', 'Sample Third Holder', 'SYN-1001']) {
    assert.ok(!audit.includes(s), s);
  }
});
