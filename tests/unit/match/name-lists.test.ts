// covers: E-13 OD-5 CR-0010 M2.1
// The port's three name lists (app/src/engine/match/name-lists.ts) equal the live page's ALIASES pins and blocks and
// EXACT_ONLY, parsed out of index.html's engine block (M2 plan v2 §1 (d)): the lists are never a second copy kept by
// hand. While the engine block differs from the basis recorded in tests/parity/matching-ledger.json (a live matcher
// change not yet ported, §1 (b)), a difference is reported, not failed; NB-02 ports it within 5 working days.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import { engineBlock, parseLegacyNameLists } from '../../helpers/legacy-engine.ts';
import { BLOCKS, EXACT_ONLY, PINS, aliasFor, isExactOnlyKey } from '../../../app/src/engine/match/name-lists.ts';
import { nameKey } from '../../../app/src/engine/match/normalize.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'matching-ledger.json'), 'utf8')) as { basis: { engineBlockSha256: string } };

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
    if (block.sha256 !== ledger.basis.engineBlockSha256) {
      t.diagnostic(`engine block differs from the basis: reported, not failed. live ${JSON.stringify(legacy)} port ${JSON.stringify(port)}`);
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
});
