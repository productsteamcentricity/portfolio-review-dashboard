// covers: E-89 E-147 M3b (the loader of the embedded reference data, app/src/data/refdata.ts)
// The loader parses a refdata-<NAME> block once and keeps it, returns null for a missing or broken block, lets an
// uploaded block stand in for the embedded one (blockOf), and dates a block from the VINTAGE block (asOnOf). The page
// is replaced by a reader over the committed data/refdata files (public data, class P) or over synthetic text.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asOnOf, blockId, blockOf, readBlock, BLOCK_NAMES, type BlockText, type RefdataBlocks } from '../../../app/src/data/refdata.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { parseDayText } from '../../../app/src/engine/dates.ts';
import { REPO } from '../../helpers/pptxgenjs.ts';
import { REFDATA_BLOCKS } from '../../../scripts/build.mjs';

/** A page holding every committed block, counting reads. */
function committedPage(): { text: BlockText; reads: Map<string, number> } {
  const reads = new Map<string, number>();
  const text: BlockText = (id) => {
    reads.set(id, (reads.get(id) ?? 0) + 1);
    const name = id.replace(/^refdata-/, '');
    const listed = REFDATA_BLOCKS.find(([n]) => n === name);
    const f = path.join(REPO, listed ? listed[1] : path.join('data', 'refdata', `${name}.json`));
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  return { text, reads };
}
const page = (blocks: Record<string, string>): BlockText => (id) => blocks[id] ?? null;
const vintage = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', 'VINTAGE.json'), 'utf8'));

describe('readBlock', () => {
  test('every embedded block parses to an object; ids are refdata-<NAME>', () => {
    const { text } = committedPage();
    for (const name of BLOCK_NAMES) {
      const b = readBlock(name, text);
      assert.ok(b && typeof b === 'object', name);
      assert.equal(blockId(name), `refdata-${name}`);
    }
    const mf = readBlock('MF_PERF', text)!;
    assert.equal(Object.keys(mf).length, vintage.blocks.MF_PERF.records);
  });
  test('parsed once and kept', () => {
    const { text, reads } = committedPage();
    const a = readBlock('BENCH_RET', text);
    const b = readBlock('BENCH_RET', text);
    assert.equal(a, b);
    assert.equal(reads.get('refdata-BENCH_RET'), 1);
  });
  test('a missing block, broken JSON, or JSON that is not an object gives null', () => {
    assert.equal(readBlock('MF_PERF', page({})), null);
    assert.equal(readBlock('MF_PERF', page({ 'refdata-MF_PERF': '{oops' })), null);
    assert.equal(readBlock('MF_PERF', page({ 'refdata-MF_PERF': '[1,2]' })), null);
    assert.equal(readBlock('MF_PERF', page({ 'refdata-MF_PERF': 'null' })), null);
  });
  test('with no page at all (outside a browser) every block is null', () => {
    assert.equal(readBlock('SIF_PERF'), null);
  });
});

describe('blockOf', () => {
  test('an uploaded block stands in for the embedded one; otherwise the embedded block', () => {
    const { text } = committedPage();
    const uploaded: RefdataBlocks['MF_PERF'] = {
      'Sample Fund-Reg(G)': { type: 'equity', sheet: 'Index', inception: '2020-01-01', aum: 1, r: { '1M': null, '3M': null, '6M': null, '1Y': 1, '2Y': null, '3Y': 2, '5Y': null, '10Y': null, SI: null } },
    };
    assert.equal(blockOf('MF_PERF', { MF_PERF: uploaded }, text), uploaded);
    assert.equal(blockOf('MF_PERF_DIRECT', { MF_PERF: uploaded }, text), readBlock('MF_PERF_DIRECT', text));
    assert.equal(blockOf('MF_PERF', undefined, text), readBlock('MF_PERF', text));
  });
});

describe('asOnOf', () => {
  test('a dated block takes its date from VINTAGE', () => {
    const { text } = committedPage();
    for (const name of ['MF_PERF', 'MF_PERF_DIRECT', 'SIF_PERF', 'BENCH_RET'] as const) {
      const want = vintage.blocks[name].asOn;
      const got = asOnOf(name, text);
      if (want === null) { assert.equal(got.kind, 'missing', name); continue; }
      assert.equal(got.kind === 'value' && got.v, parseDayText(want), name);
      assert.deepEqual(got.kind === 'value' && got.prov.sources, [vintage.blocks[name].sha256]);
      assert.equal(got.kind === 'value' && got.prov.vintage, vintage.dataMonth);
    }
  });
  test('an undated block is missing with the status VINTAGE records', () => {
    const { text } = committedPage();
    const s = asOnOf('STOCK_RET', text);
    assert.equal(s.kind, 'missing');
    assert.equal(s.kind === 'missing' && s.status, vintage.blocks.STOCK_RET.asOnStatus ?? STATUS.NOT_AVAILABLE);
  });
  test('no VINTAGE block, no entry, or an entry with a bad date or an unknown status', () => {
    assert.equal(asOnOf('MF_PERF', page({})).kind, 'missing');
    const v = (blocks: object) => page({ 'refdata-VINTAGE': JSON.stringify({ dataMonth: '2026-10', blocks }) });
    assert.equal(asOnOf('MF_PERF', v({})).kind, 'missing');
    const bad = asOnOf('MF_PERF', v({ MF_PERF: { asOn: 'soon', class: 'P', file: 'MF_PERF.json', records: 1, sha256: 'x', source: 's' } }));
    assert.equal(bad.kind === 'missing' && bad.status, STATUS.INVALID_SOURCE);
    const odd = asOnOf('MF_PERF', v({ MF_PERF: { asOn: null, asOnStatus: 'MADE UP', class: 'P', file: 'MF_PERF.json', records: 1, sha256: 'x', source: 's' } }));
    assert.equal(odd.kind === 'missing' && odd.status, STATUS.NOT_AVAILABLE);
  });
});
