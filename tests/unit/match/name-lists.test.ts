// covers: E-13 E-14 E-20 OD-5 OD-32 OD-34 KI-061 CR-0010 M2.1
// The port's three name lists (app/src/engine/match/name-lists.ts) equal the live page's ALIASES pins and blocks and
// EXACT_ONLY, parsed out of index.html's engine block (M2 plan v2 §1 (d)): the lists are never a second copy kept by
// hand. While the matcher slice of the engine block differs from the basis recorded in tests/parity/matching-ledger.json (a live matcher
// change not yet ported, §1 (b)), a difference is reported, not failed; NB-02 ports it within 5 working days.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import { engineBlock, parseLegacyNameLists, parseLegacyTable } from '../../helpers/legacy-engine.ts';
import { BLOCKS, EXACT_ONLY, PINS, aliasFor, isExactOnlyKey } from '../../../app/src/engine/match/name-lists.ts';
import { JUNK, SYN, nameKey } from '../../../app/src/engine/match/normalize.ts';
import { PMS_JUNK } from '../../../app/src/engine/match/pms.ts';
import { AMC_ALIAS, AMC_DISPLAY, AMC_NOISE, AMC_NOT_GIVEN, AMC_PLACEHOLDER, AMC_RENAMED } from '../../../app/src/engine/match/amc.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'matching-ledger.json'), 'utf8')) as { basis: { matcherSliceSha256: string } };

describe('legacy name lists', () => {
  test('pins, blocks and exact-only names equal the live engine block', (t) => {
    const block = engineBlock();
    const live = parseLegacyNameLists(block.text);
    const port = {
      pins: PINS.map((p) => p.key + ' -> ' + p.target).sort(),
      blocks: BLOCKS.map((b) => b.key).sort(),
      exactOnly: EXACT_ONLY.map((e) => e.key).sort(),
    };
    const legacy = {
      pins: live.pins.map((p) => p.key + ' -> ' + p.target).sort(),
      blocks: [...live.blocks].sort(),
      exactOnly: [...new Set(live.exactOnly)].sort(),
    };
    if (block.matcherSha256 !== ledger.basis.matcherSliceSha256) {
      t.diagnostic(`matcher slice differs from the basis: reported, not failed. live ${JSON.stringify(legacy)} port ${JSON.stringify(port)}`);
      return;
    }
    assert.deepEqual(port, legacy);
  });

  test('every key is a normalised name (normalising it again gives itself)', () => {
    for (const k of [...PINS.map((p) => p.key), ...BLOCKS.map((b) => b.key), ...EXACT_ONLY.map((e) => e.key)]) assert.equal(nameKey(k), k);
  });

  test('a block reads as "", a pin as its target, an unlisted name as nothing', () => {
    assert.equal(aliasFor('icici pru leaders fund series iv'), '');
    assert.equal(aliasFor('mosaic multiyield fund series i'), 'Mosaic Asset Management Multiyield Fund');
    assert.equal(aliasFor('hdfc flexicap fund'), undefined);
    assert.equal(isExactOnlyKey('aditya birla sl retirement fund 30s'), true);
  });

  test('the AMC tables and the normaliser tables equal the live engine block (ENGINE does not expose them)', (t) => {
    const block = engineBlock();
    const pairs = (m: ReadonlyMap<string, string>): string[] => [...m].map(([k, v]) => k + '=' + v).sort();
    const keys1 = (s: ReadonlySet<string>): string[] => [...s].map((k) => k + '=1').sort();
    const live = (name: string): string[] => parseLegacyTable(block.text, name).map(([k, v]) => k + '=' + v).sort();
    const port: Record<string, string[]> = {
      AMC_DISPLAY: pairs(AMC_DISPLAY), AMC_ALIAS: pairs(AMC_ALIAS), AMC_RENAMED: pairs(AMC_RENAMED),
      AMC_NOISE: keys1(AMC_NOISE), AMC_PLACEHOLDER: keys1(AMC_PLACEHOLDER),
      JUNK: keys1(JUNK), SYN: pairs(SYN), PMS_JUNK: keys1(PMS_JUNK),
    };
    const legacy: Record<string, string[]> = {};
    for (const n of Object.keys(port)) legacy[n] = live(n);
    if (block.matcherSha256 !== ledger.basis.matcherSliceSha256) {
      t.diagnostic(`matcher slice differs from the basis: reported, not failed. ${JSON.stringify(Object.keys(port).filter((n) => JSON.stringify(port[n]) !== JSON.stringify(legacy[n])))}`);
      return;
    }
    for (const n of Object.keys(port)) assert.deepEqual(port[n], legacy[n], n);
    assert.equal(AMC_NOT_GIVEN, 'AMC not given');
  });
});
