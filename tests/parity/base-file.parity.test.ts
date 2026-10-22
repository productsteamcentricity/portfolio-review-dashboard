// covers: E-01 E-02 E-03 E-04 BR-0.4 OD-3 OD-7 OD-8 OD-22 KI-005 KI-007 KI-074 KI-093 KI-113
// Parity of app/src/ingest/base-file.ts with the legacy parseBaseRows (index.html, run through
// tools/engine-host.js with the page's own upload path) on the synthetic fixtures: tools/make-sample-base.js's two
// files and the variants of its book (tests/fixtures/make-books.ts). Every difference must match exactly one entry
// of tests/parity/base-file-ledger.json and every entry must be used. CI runs this under TZ=Asia/Kolkata and
// TZ=UTC; tests/unit/ingest/time-zones.test.ts proves the new side identical across the two in a single run.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Fixture, LegacyHost } from '../fixtures/make-books.ts';
import type { Diff, Ledger } from './base-file-compare.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { loadLegacyHost, sampleFixtures } from '../fixtures/make-books.ts';
import { compare, entriesFor, legacyParse } from './base-file-compare.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'base-file-ledger.json'), 'utf8')) as Ledger;
const describeDiff = (d: Diff): string =>
  `${d.fixture}: ${d.kind}${'field' in d ? ` ${d.field}` : ''} [${d.holding}] legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`;

let host: LegacyHost;
let fixtures: Fixture[];
const results: Array<{ fixture: Fixture; diffs: Diff[]; legacyRows: number; newIncluded: number; newExcludedKeys: string[] }> = [];

before(() => {
  host = loadLegacyHost();
  fixtures = sampleFixtures(host).fixtures;
  for (const f of fixtures) {
    const legacy = legacyParse(host, f.bytes);
    const imp = parseBaseFile(readWorkbook(host.XLSX, f.bytes), {
      sourceId: '0'.repeat(64) as SourceFileId, now: () => '2026-10-22T00:00:00.000Z', ...(f.answers ? { answers: f.answers } : {}),
    });
    results.push({
      fixture: f,
      diffs: compare(f.id, legacy, imp),
      legacyRows: legacy.rows.length,
      newIncluded: imp.counts.included,
      newExcludedKeys: imp.holdings.filter((h) => h.inclusion.status === 'excluded').map((h) => h.instrumentName),
    });
  }
});

describe(`base-file parity (TZ=${process.env.TZ ?? 'system'})`, () => {
  test('the ledger is well formed and holds no regression', () => {
    const ids = ledger.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'ledger ids are unique');
    for (const e of ledger.entries) {
      assert.ok(['correction', 'improvement', 'regression'].includes(e.class), e.id);
      assert.notEqual(e.class, 'regression', `${e.id}: a regression must be fixed, not ledgered`);
      assert.match(e.reference, /\b(OD-\d+|KI-\d+|D-\d+|BR-\d+\.\d+)\b/, `${e.id} names its decision or issue`);
      assert.ok(e.description.length > 20, e.id);
      assert.ok(!/[–—]/.test(e.description), `${e.id}: no en or em dash`);
      if (e.fixtures !== '*') for (const f of e.fixtures) assert.ok(fixtures.some((x) => x.id === f), `${e.id}: unknown fixture ${f}`);
    }
  });

  test('every difference matches exactly one ledger entry, and every entry is used', () => {
    const unmatched: string[] = [];
    const ambiguous: string[] = [];
    const used = new Map<string, number>();
    for (const r of results) {
      for (const d of r.diffs) {
        const es = entriesFor(d, ledger);
        if (es.length === 0) unmatched.push(describeDiff(d));
        else if (es.length > 1) ambiguous.push(`${describeDiff(d)} -> ${es.map((e) => e.id).join(', ')}`);
        else used.set(es[0]!.id, (used.get(es[0]!.id) ?? 0) + 1);
      }
    }
    assert.deepEqual(unmatched, [], `differences not in the ledger:\n${unmatched.join('\n')}`);
    assert.deepEqual(ambiguous, [], `differences matching more than one entry:\n${ambiguous.join('\n')}`);
    const unused = ledger.entries.filter((e) => !used.has(e.id)).map((e) => e.id);
    assert.deepEqual(unused, [], 'every ledger entry is exercised by a fixture');
  });

  test('files without an intended difference agree on every compared field', () => {
    const plain = ['family-a', 'family-b', 'family-a-standard', 'family-a-lakh', 'family-a-rupee', 'family-a-na-cmv',
      'family-a-blank-invested', 'family-a-skipped-rows', 'family-a-holders', 'family-a-text-dates'];
    for (const id of plain) {
      const r = results.find((x) => x.fixture.id === id);
      assert.ok(r, id);
      assert.deepEqual(r.diffs.filter((d) => d.kind !== 'field-not-carried').map(describeDiff), [], id);
      assert.equal(r.newIncluded, r.legacyRows, `${id}: same number of holdings`);
    }
  });

  test('holdings without a market value: the legacy dropped them silently, the new reader excludes and lists them (OD-8)', () => {
    const r = results.find((x) => x.fixture.id === 'family-a-na-cmv')!;
    assert.equal(r.newExcludedKeys.length, 2);
    assert.equal(r.legacyRows, r.newIncluded);
  });
});
