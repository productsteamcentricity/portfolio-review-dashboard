// covers: E-89 E-90 E-91 E-95 E-96 E-97 E-98 E-99 E-100 E-101 E-102 E-103 E-104 E-105 E-107 E-108 D-026
// data/refdata/ equals the reference data embedded in index.html (08-regression-test-plan.md §5.4): each file
// deep-equals the object the legacy page itself runs on (evaluated through tools/engine-host.js, independently of
// the extractor's JSON reading), the files are byte-equal to the extractor's output (deterministic and up to date),
// FUND_RANKS contributes AMFI scheme codes only (D-026), and the deny-list exemptions cover exactly these files.

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { LegacyHost } from '../fixtures/make-books.ts';
import { loadLegacyHost } from '../fixtures/make-books.ts';
import { NOT_EXTRACTED, REFDATA_KEYS, renderRefdata } from '../../scripts/data-extract.ts';
import { dayToIso, parseDayText } from '../../app/src/engine/dates.ts';
import { REPO } from '../helpers/sheetjs.ts';

const DIR = path.join(REPO, 'data', 'refdata');
const readJson = (f: string): unknown => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
let host: LegacyHost;
let ER: Record<string, unknown>;

before(() => {
  host = loadLegacyHost();
  ER = (globalThis as unknown as { MF_ER_TABLE: Record<string, unknown> }).MF_ER_TABLE;
});

test('the files are byte-equal to the extractor output: deterministic and up to date with index.html', () => {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const files = renderRefdata(html);
  assert.deepEqual(renderRefdata(html), files, 'two runs give the same bytes');
  const onDisk = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(onDisk, [...files.keys()].sort());
  for (const [f, text] of files) {
    const disk = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(disk === text, `${f} differs from the extractor output: run node scripts/data-extract.ts`);
    assert.ok(!text.includes('\r'), `${f}: LF line ends only`);
    assert.ok(text.endsWith('\n'), `${f}: final newline`);
  }
});

test('every extracted block deep-equals the object the legacy page runs on', () => {
  const REF = host.REF as Record<string, unknown>;
  assert.deepEqual(Object.keys(REF).sort(), [...REFDATA_KEYS].sort());
  for (const k of REFDATA_KEYS) {
    if (k in NOT_EXTRACTED) continue;
    assert.deepStrictEqual(readJson(`${k}.json`), REF[k], k);
  }
  assert.deepStrictEqual(readJson('MF_ER_TABLE.json'), ER, 'MF_ER_TABLE');
});

test('FUND_RANKS: scheme codes only, never a score, rank, category or status (D-026)', () => {
  const ranks = host.REF.FUND_RANKS as Record<string, Record<string, unknown>>;
  const codes = readJson('FUND_RANKS_CODES.json') as Record<string, unknown>;
  assert.deepStrictEqual(codes, Object.fromEntries(Object.entries(ranks).map(([n, r]) => [n, String(r.code)])));
  for (const [name, code] of Object.entries(codes)) assert.match(String(code), /^\d+$/, name);
  assert.ok(!fs.existsSync(path.join(DIR, 'FUND_RANKS.json')));
  assert.ok(!fs.existsSync(path.join(DIR, 'FUND_RANKS_META.json')));
  // No other file carries the ranks' extra fields keyed by these funds.
  const text = fs.readFileSync(path.join(DIR, 'FUND_RANKS_CODES.json'), 'utf8');
  for (const field of ['"score"', '"rank"', '"of"', '"status"', '"cat"', '"src"']) assert.ok(!text.includes(field), field);
});

test('VINTAGE.json: the legacy DATA_DATES, the data month, and each file\'s count, hash and as-on date', () => {
  const v = readJson('VINTAGE.json') as {
    dataMonth: string; legacyDataDates: Record<string, string>; notExtracted: Record<string, string>;
    blocks: Record<string, { file: string; records: number; sha256: string; asOn: string | null; asOnFrom?: string; asOnStatus?: string }>;
  };
  const dd = host.REF.DATA_DATES as Record<string, string>;
  assert.deepStrictEqual(v.legacyDataDates, dd);
  assert.equal(v.dataMonth, dayToIso(parseDayText(dd.performance!)!).slice(0, 7));
  assert.deepEqual(Object.keys(v.notExtracted).sort(), ['DATA_DATES', 'FUND_RANKS', 'FUND_RANKS_META']);
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'VINTAGE.json').sort();
  assert.deepEqual(Object.values(v.blocks).map((b) => b.file).sort(), files);
  for (const [name, b] of Object.entries(v.blocks)) {
    const text = fs.readFileSync(path.join(DIR, b.file), 'utf8');
    assert.equal(b.sha256, crypto.createHash('sha256').update(text, 'utf8').digest('hex'), name);
    const data = JSON.parse(text) as object;
    assert.equal(b.records, Array.isArray(data) ? data.length : Object.keys(data).length, name);
    if (b.asOn === null) assert.equal(b.asOnStatus, 'NOT AVAILABLE IN SUPPLIED DATA', name);
    else {
      const key = b.asOnFrom!.replace('DATA_DATES.', '');
      assert.equal(b.asOn, dayToIso(parseDayText(dd[key]!)!), name);
    }
  }
  assert.equal(v.blocks.MF_PERF!.asOnFrom, 'DATA_DATES.performance');
  assert.equal(v.blocks.FUND_RANKS_CODES!.asOnFrom, 'DATA_DATES.ranks');
});

test('the deny-list exemptions under data/refdata/ are exactly the generated block files', () => {
  const allow = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'validation', 'privacy-allowlist.json'), 'utf8')) as {
    denylistExemptPaths: Array<{ path: string }>;
  };
  const exempt = allow.denylistExemptPaths.map((e) => e.path).filter((p) => p.startsWith('data/refdata/')).sort();
  const blocks = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'VINTAGE.json').map((f) => `data/refdata/${f}`).sort();
  assert.deepEqual(exempt, blocks);
});
