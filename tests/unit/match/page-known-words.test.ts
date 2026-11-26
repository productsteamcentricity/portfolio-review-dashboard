// covers: E-13 E-19 M2.1
// The page's knownWords (the normaliser follow-up): buildMatchContext derives it from the names of its instrument
// universes, and the matching-corrections ledger measures stage 4 with this same set (tests/parity/matching-corrections.ts
// knownWordsOfReference), so the page matches with exactly the measured vocabulary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchContext } from '../../../app/src/engine/match/resolve-holdings.ts';
import { referenceVocabulary } from '../../../app/src/engine/match/instrument.ts';
import { committedBlocks } from '../../helpers/match-blocks.ts';
import { knownWordsOfReference } from '../../parity/matching-corrections.ts';

test('the page context carries the vocabulary of its instrument universes, the one the ledger measures', () => {
  const ctx = buildMatchContext(committedBlocks());
  const k = ctx.options.knownWords;
  assert.ok(k && k.size > 300, `knownWords has ${k?.size ?? 0} words`);
  const names = Object.values(ctx.universes).filter((u) => u.matcher === 'instrument').map((u) => u.keys);
  assert.deepEqual([...k].sort(), [...referenceVocabulary(names)].sort());
  assert.deepEqual([...knownWordsOfReference()].sort(), [...k].sort());
  assert.deepEqual(Object.values(ctx.universes).filter((u) => u.matcher === 'instrument').map((u) => u.name).sort(), ['AIF_PERF', 'MF_PERF', 'SIF_PERF']);
});
