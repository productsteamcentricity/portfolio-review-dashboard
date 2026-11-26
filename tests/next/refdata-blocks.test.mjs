// covers: E-89 E-147 M3b (the reference data embedded as data blocks; architecture §17.2, §19; format agreed by NB-02
// and NB-04, 26 Nov 2026)
// The built page carries each REFDATA_BLOCKS file whole, as <script type="application/json" id="refdata-<NAME>">,
// parsing to exactly the committed file; the list matches app/src/data/refdata.ts BLOCK_NAMES; the page still passes
// check-next; a data change leaves the build id and the CSP unchanged (data blocks are not hashed into either).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildNext, refdataBlocks, REFDATA_BLOCKS } from '../../scripts/build.mjs';
import { checkBuiltPage, parseHtml, readScreenerUrl } from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, failures } from './helpers.mjs';

const CSP_RE = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
const blocksOf = (html) => parseHtml(html).raw.filter((r) => r.name === 'script' && r.tag.attrs.some((a) => a.name === 'id' && a.value.startsWith('refdata-')));
const idOf = (r) => r.tag.attrs.find((a) => a.name === 'id').value;
const buildIdOf = (html) => JSON.parse(parseHtml(html).raw.find((r) => r.tag.attrs.some((a) => a.name === 'id' && a.value === 'build-info')).content).buildId;

describe('the block list', () => {
  test('names and files: one entry per name, each file under data/refdata or data/owner, present', () => {
    const names = REFDATA_BLOCKS.map(([n]) => n);
    assert.equal(new Set(names).size, names.length);
    for (const [, file] of REFDATA_BLOCKS) {
      assert.match(file, /^data\/(refdata|owner)\/[A-Za-z0-9_.-]+\.json$/);
      assert.ok(fs.existsSync(path.join(ROOT, file)), file);
    }
  });
  test('the same names in the same order as BLOCK_NAMES in app/src/data/refdata.ts', async () => {
    const { BLOCK_NAMES } = await import('../../app/src/data/refdata.ts');
    assert.deepEqual(REFDATA_BLOCKS.map(([n]) => n), [...BLOCK_NAMES]);
  });
  test('a repeated or unsafe name is refused', () => {
    assert.throws(() => refdataBlocks([['A', 'data/refdata/SIF_PERF.json'], ['A', 'data/refdata/SIF_PERF.json']], ROOT), /not a unique plain name/);
    assert.throws(() => refdataBlocks([['a"b', 'data/refdata/SIF_PERF.json']], ROOT), /not a unique plain name/);
  });
});

describe('the built page (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  let html;
  before(async () => { html = (await buildNext()).html; });

  test('one block per list entry, in order, each parsing to exactly the committed file', () => {
    const blocks = blocksOf(html);
    assert.deepEqual(blocks.map(idOf), REFDATA_BLOCKS.map(([n]) => `refdata-${n}`));
    for (const [i, [, file]] of REFDATA_BLOCKS.entries()) {
      assert.deepEqual(JSON.parse(blocks[i].content), JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), file);
      assert.equal(blocks[i].tag.attrs.find((a) => a.name === 'type').value, 'application/json');
      assert.ok(!blocks[i].content.includes('<'), 'no raw "<" in a data block');
    }
  });

  test('the page passes check-next', () => {
    const f = failures(checkBuiltPage(Buffer.from(html, 'utf8'), { screenerUrl: readScreenerUrl(path.join(ROOT, 'app/src/config/links.json')) }));
    assert.deepEqual(f, []);
  });

  test('a data change leaves the build id and the CSP unchanged; the blocks follow the files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refdata-'));
    try {
      fs.writeFileSync(path.join(dir, 'X.json'), '{"a":{"r":{"3Y":1.5}},"b":"<\/script>"}\n');
      const rel = path.relative(ROOT, path.join(dir, 'X.json'));
      const other = (await buildNext({ refdata: [['X', rel]] })).html;
      assert.equal(buildIdOf(other), buildIdOf(html));
      assert.equal(CSP_RE.exec(other)[1], CSP_RE.exec(html)[1]);
      const blocks = blocksOf(other);
      assert.deepEqual(blocks.map(idOf), ['refdata-X']);
      assert.deepEqual(JSON.parse(blocks[0].content), { a: { r: { '3Y': 1.5 } }, b: '</script>' });
      assert.ok(!blocks[0].content.includes('</script'), '"<" escaped');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('deterministic: two builds give the same blocks', async () => {
    const again = (await buildNext()).html;
    assert.deepEqual(blocksOf(again).map((b) => b.content), blocksOf(html).map((b) => b.content));
  });
});
