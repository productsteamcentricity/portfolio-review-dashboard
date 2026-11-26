// covers: D-026 E-126 M10 M1.2-check-next
// The D-026 build check (scripts/validation/check-next.mjs PACK_CONTENT_PATTERNS; ARC-03 Gate B finding B1 on
// 4bdec8a): MF Screener pack content must be found in every form it could take in the built page, above all a pack
// JSON file bundled by esbuild (the build's own bundler writes its keys unquoted), and nothing in today's app/src
// may match (the reader's schema lines, the contract version as a plain string). Every pack below is synthetic.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findPackContent, PACK_CONTENT_PATTERNS } from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD } from './helpers.mjs';

const SYNTHETIC = {
  fund_id: 'F1',
  fund_name: 'Fixture Fund (synthetic)',
  centricity_score_frac: 0.81,
  centricity_rank_in_category: 3,
  parameter_scores: { fixture_a_frac: 0.5 },
  contract_version: 'pr-datapack-v1',
};

describe('every form of pack content is found', () => {
  const BS = String.fromCharCode(92); // a backslash, built here so no escape sequence is needed in the source
  const forms = [
    ['JSON (quoted keys)', JSON.stringify(SYNTHETIC)],
    ['esbuild object literal (unquoted keys)', 'var funds_default = { fund_id: "F1", centricity_score_frac: 0.81, centricity_rank_in_category: 3, parameter_scores: { fixture_a_frac: 0.5 }, contract_version: "pr-datapack-v1" };'],
    ['single-quoted keys', "{ 'centricity_score_frac': 0.81, 'centricity_rank_in_category': 3, 'contract_version': 'pr-datapack-v1' }"],
    ['JSON escaped inside a string', JSON.stringify(JSON.stringify(SYNTHETIC))],
    ['a leading-dot number', '{centricity_score_frac:.81}'],
    ['the funds_summary.csv header', 'scheme_code,fund_name,centricity_score_frac,centricity_rank_in_category,benchmark'],
    ['the fixture marker', 'source_files: ["FIXTURE-SCREENER-PACK"]'],
  ];
  for (const [label, text] of forms) {
    test(label, () => assert.ok(findPackContent(text).length > 0, `nothing found in: ${text.slice(0, 120)}`));
  }

  test('each key pattern alone, quoted, unquoted, single-quoted and escaped', () => {
    for (const q of ['"', '', "'", `${BS}"`]) {
      assert.ok(findPackContent(`{${q}centricity_score_frac${q}: 0.5}`).length === 1, `score ${q}`);
      assert.ok(findPackContent(`{${q}centricity_rank_in_category${q}: 2}`).length === 1, `rank ${q}`);
      assert.ok(findPackContent(`{${q}parameter_scores${q}: {${q}x${q}: 7}}`).length === 1, `parameters ${q}`);
      const v = q === `${BS}"` ? `${BS}"` : q || '"';
      assert.ok(findPackContent(`{${q}contract_version${q}: ${v}pr-datapack-v1${v}}`).length === 1, `version ${q}`);
    }
  });

  test('the reader\'s own forms are not pack content', () => {
    for (const text of [
      "export const CONTRACT_VERSION = 'pr-datapack-v1';",
      "centricity_score_frac: { t: 'number', opt: true, nul: true },",
      "centricity_rank_in_category: { t: 'int', opt: true, nul: true },",
      "parameter_scores: { t: 'object', opt: true, nul: true },",
      "contract_version: { t: 'string' },",
      "if (raw.contract_version !== CONTRACT_VERSION) throw new Refused(`wrong contract version`);",
      "'centricity_score_frac', 'centricity_rank_in_category',",
    ]) assert.deepEqual(findPackContent(text), [], text);
  });

  test('nothing in today\'s app/src matches', () => {
    const hits = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|json|css|html)$/.test(e.name)) {
          const found = findPackContent(fs.readFileSync(p, 'utf8'));
          if (found.length) hits.push(`${path.relative(ROOT, p)}: ${found.join(', ')}`);
        }
      }
    };
    walk(path.join(ROOT, 'app', 'src'));
    assert.deepEqual(hits, []);
    assert.equal(PACK_CONTENT_PATTERNS.length, 6);
  });
});

describe('a pack JSON bundled by esbuild is found (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  test('the bundle of a module importing a synthetic funds.json fails the check', async () => {
    const { build } = await import('esbuild');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd026-'));
    try {
      fs.writeFileSync(path.join(dir, 'funds.json'), JSON.stringify({ contract_version: 'pr-datapack-v1', records: [SYNTHETIC] }, null, 2));
      fs.writeFileSync(path.join(dir, 'entry.js'), "import funds from './funds.json';\nconsole.log(funds.records.length);\n");
      // the build's own settings for the app script: one IIFE, not minified (scripts/build.mjs step 1)
      const out = await build({ entryPoints: [path.join(dir, 'entry.js')], bundle: true, write: false, format: 'iife', minify: false, logLevel: 'silent' });
      const text = out.outputFiles[0].text;
      assert.doesNotMatch(text, /"centricity_score_frac"/, 'esbuild writes the keys unquoted (the form B1 found missed)');
      const found = findPackContent(text);
      assert.ok(found.length >= 3, `found only ${found.join(', ')}`);
      // minified, as a stricter build might do: still found
      const min = await build({ entryPoints: [path.join(dir, 'entry.js')], bundle: true, write: false, format: 'iife', minify: true, logLevel: 'silent' });
      assert.ok(findPackContent(min.outputFiles[0].text).length >= 3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
