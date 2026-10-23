// covers: E-01 E-02 E-03 E-04 BR-0.4 BR-2.5 OD-3 OD-7 OD-8 OD-22 KI-005 KI-007 KI-074 KI-093 KI-113
// Parity of app/src/ingest/base-file.ts with the legacy parseBaseRows (index.html, run through
// tools/engine-host.js with the page's own upload path) on the synthetic fixtures: tools/make-sample-base.js's two
// files and the variants of its book (tests/fixtures/make-books.ts). Every difference must match exactly one entry
// of tests/parity/base-file-ledger.json and every entry must be used. CI runs this under TZ=Asia/Kolkata and
// TZ=UTC; tests/unit/ingest/time-zones.test.ts proves the new side identical across the two in a single run.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { BookRow, Fixture, LegacyHost } from '../fixtures/make-books.ts';
import type { Diff, Ledger, LegacyParse } from './base-file-compare.ts';
import type { BaseFileImport } from '../../app/src/ingest/base-file.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { loadLegacyHost, sampleFixtures } from '../fixtures/make-books.ts';
import { compare, entriesFor, legacyParse } from './base-file-compare.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'base-file-ledger.json'), 'utf8')) as Ledger;
const describeDiff = (d: Diff): string =>
  `${d.fixture}: ${d.kind}${'field' in d ? ` ${d.field}` : ''} [${d.holding}] legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`;

let host: LegacyHost;
let fixtures: Fixture[];
let book: BookRow[];
const results: Array<{
  fixture: Fixture; diffs: Diff[]; legacyRows: number; newIncluded: number; newExcludedKeys: string[];
  legacy: LegacyParse; imp: BaseFileImport;
}> = [];

before(() => {
  host = loadLegacyHost();
  ({ fixtures, book } = sampleFixtures(host));
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
      legacy,
      imp,
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

  test('text that is not a number and an impossible date: the legacy read a number off the front of the text and rolled the date; the new reader marks each INVALID SOURCE DATA (BF-21 to BF-25)', () => {
    const r = results.find((x) => x.fixture.id === 'family-a-invalid-text')!;
    const close = (a: unknown, b: number, msg: string): void => {
      assert.ok(typeof a === 'number' && Math.abs(a - b) <= 1e-12, `${msg}: ${String(a)} != ${b}`);
    };
    const legacyOf = (h: BookRow) => r.legacy.rows.find((x) => x.client === h.client && x.name === h.name)!;
    const newOf = (h: BookRow) => r.imp.holdings.find((x) => x.clientLabel === h.client && x.instrumentName === h.name)!;
    const status = (v: { kind: string; status?: string }): string | null => (v.kind === 'missing' ? v.status ?? null : null);
    // Known answers from the cell text: parseFloat("1.25 Cr") = 1.25 and parseFloat("12abc") = 12; new Date(2024, 1, 31)
    // is 2 March 2024. The legacy XIRR is the percent number divided by 100.
    close(legacyOf(book[0]!).cmvCr, 1.25, 'legacy CMV "1.25 Cr"');
    close(legacyOf(book[1]!).cmvCr, 12, 'legacy CMV "12abc"');
    close(legacyOf(book[2]!).invCr, 1.25, 'legacy invested "1.25 Cr"');
    close(legacyOf(book[3]!).xirrFrac, 0.12, 'legacy XIRR "12abc"');
    assert.equal(legacyOf(book[4]!).purchaseDate, '2 Mar 2024');
    close(legacyOf(book[5]!).bmxirrFrac, 0.0125, 'legacy BMXIRR "1.25 Cr"');
    for (const h of [book[0]!, book[1]!]) {
      const n = newOf(h);
      assert.deepEqual(n.inclusion, { status: 'excluded', reasons: ['no-market-value'] }, h.name);
      assert.equal(status(n.cmv), STATUS.INVALID_SOURCE, h.name);
    }
    assert.equal(status(newOf(book[2]!).invested), STATUS.INVALID_SOURCE);
    // The gain cell holds the true gain in Crore, written to four decimals by the fixture.
    const g = newOf(book[2]!).fileGain;
    assert.ok(g.kind === 'value' && Math.abs(g.v - (book[2]!.mv - book[2]!.invested) / 1e7) <= 5e-5,
      'the file gain of the row with an invalid invested value is still read');
    assert.equal(status(newOf(book[3]!).xirr), STATUS.INVALID_SOURCE);
    assert.equal(status(newOf(book[4]!).purchaseDate), STATUS.INVALID_SOURCE);
    assert.equal(status(newOf(book[5]!).bmXirr), STATUS.INVALID_SOURCE);
    const w = r.imp.issues.find((i) => i.ruleId === 'base-file.invalid-cells')!;
    assert.deepEqual([w.severity, w.count], ['Warning', 6]);
    const ex = r.imp.issues.find((i) => i.ruleId === 'base-file.no-market-value')!;
    assert.deepEqual([ex.severity, ex.count], ['Warning', 2]);
  });

  test('an unrecognised Asset Name is unknown in the new reader, not its label (BF-19); REITs/InvITs is a class (BF-20)', () => {
    const r = results.find((x) => x.fixture.id === 'family-a-odd-asset-labels')!;
    const byLabel = (label: string) => r.imp.holdings.find((h) => h.assetLabel === label)!;
    assert.equal(byLabel('Gold').assetClass, null);
    assert.equal(byLabel('REITs / InvITs').assetClass, 'REITs/InvITs');
    assert.equal(byLabel('REITs/InvITs').assetClass, 'REITs/InvITs');
    assert.deepEqual(r.legacy.rows.map((x) => x.asset).filter((a) => a === 'Gold' || /REIT/.test(String(a))),
      ['Gold', 'REITs / InvITs', 'REITs/InvITs']);
  });
});
