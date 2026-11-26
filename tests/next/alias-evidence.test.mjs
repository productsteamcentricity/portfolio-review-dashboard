// covers: E-13 M2.1 D-027 (MOD-04's condition for the wiring, 26 Nov 2026)
// The owner's fund aliases reach the page without their evidence: data/owner/fund-aliases.json, embedded as the
// refdata-OWNER_FUND_ALIASES block, holds the matching fields only and no URL; the public evidence links stay in
// data/owner/fund-aliases-evidence.json, which is never embedded; no evidence URL appears anywhere in the built page
// (CLAUDE.md: no remote URL in the page but the one Screener link).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildNext, REFDATA_BLOCKS } from '../../scripts/build.mjs';
import { parseHtml } from '../../scripts/validation/check-next.mjs';
import { NEEDS_BUILD, readJson } from './helpers.mjs';

const URL_RE = /https?:[/][/][^\s"'<>]+/g;
const evidenceUrls = () => [...new Set(JSON.stringify(readJson('data/owner/fund-aliases-evidence.json')).match(URL_RE) ?? [])];

describe('the alias files', () => {
  test('the embedded alias file holds no URL; the evidence file holds them, and is not in the block list', () => {
    assert.equal(JSON.stringify(readJson('data/owner/fund-aliases.json')).match(URL_RE), null);
    assert.ok(evidenceUrls().length > 0, 'the evidence file carries its links');
    assert.ok(!REFDATA_BLOCKS.some(([, file]) => /evidence/.test(file)), 'the evidence file is never embedded');
  });
});

describe('the built page (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  let html;
  before(async () => { html = (await buildNext()).html; });

  test('no evidence URL anywhere in the page; the alias block holds no URL', () => {
    for (const u of evidenceUrls()) assert.ok(!html.includes(u), `the page carries ${u}`);
    const block = parseHtml(html).raw.find((r) => r.name === 'script' && r.tag.attrs.some((a) => a.name === 'id' && a.value === 'refdata-OWNER_FUND_ALIASES'));
    assert.ok(block, 'the alias block is embedded');
    assert.equal(block.content.match(URL_RE), null);
  });
});
