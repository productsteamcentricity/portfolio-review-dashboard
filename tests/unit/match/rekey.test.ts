// covers: E-103 E-104 E-13 KI-052 OD-23 KI-054 M2.1
// Deterministic joins between reference blocks (app/src/engine/match/rekey.ts): the re-key of FUND_RANKS / MF_RISK onto
// MF_PERF keys (KI-052, OD-23), the Direct twin (KI-054) and the look-through key. Synthetic known answers.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { directTwin, isDirectKey, lookThroughKey, rekeyBlock } from '../../../app/src/engine/match/rekey.ts';
import { parseOwnerAliases } from '../../../app/src/engine/match/owner-aliases.ts';

const aliases = parseOwnerAliases({
  table: 'fund-aliases', decision: 'PD-36', approved: '2026-11-25',
  aliases: [{ line: 1, oldName: 'Zeta Equity & Debt Fund', key: 'zeta equity debt fund', regular: 'Zeta Aggressive Hybrid Fund(G)', direct: 'Zeta Aggressive Hybrid Fund(G)-Direct Plan', evidence: ['https://example.org/notice'] }],
});

describe('rekeyBlock (KI-052, OD-23)', () => {
  const universe = ['Zeta Flexi Cap Fund-Reg(G)', 'Zeta Mid Cap Fund-Reg(G)', 'Zeta ELSS Tax Saver Fund-Reg(G)', 'Zeta Aggressive Hybrid Fund(G)', 'Zeta Liquid Fund(G)', 'Zeta Liquid Fund(IDCW)'];

  test('exact, spelling variants, the word "fund", and an approved rename', () => {
    const r = rekeyBlock(['Zeta Flexi Cap Fund-Reg(G)', 'Zeta Midcap Fund-Reg(G)', 'Zeta ELSS Tax Saver-Reg(G)', 'Zeta Equity & Debt Fund(G)'], universe, aliases);
    assert.deepEqual(r.byUniverseKey.get('Zeta Flexi Cap Fund-Reg(G)'), { blockKey: 'Zeta Flexi Cap Fund-Reg(G)', via: 'exact' });
    assert.deepEqual(r.byUniverseKey.get('Zeta Mid Cap Fund-Reg(G)'), { blockKey: 'Zeta Midcap Fund-Reg(G)', via: 'normalised' });
    assert.deepEqual(r.byUniverseKey.get('Zeta ELSS Tax Saver Fund-Reg(G)'), { blockKey: 'Zeta ELSS Tax Saver-Reg(G)', via: 'normalised' });
    assert.deepEqual(r.byUniverseKey.get('Zeta Aggressive Hybrid Fund(G)'), { blockKey: 'Zeta Equity & Debt Fund(G)', via: 'alias' });
    assert.deepEqual(r.unresolved, []);
  });

  test('without the alias table a renamed key is unresolved, never guessed', () => {
    const r = rekeyBlock(['Zeta Equity & Debt Fund(G)'], universe);
    assert.deepEqual(r.unresolved, ['Zeta Equity & Debt Fund(G)']);
  });

  test('plan and option are never crossed', () => {
    const r = rekeyBlock(['Zeta Flexi Cap Fund(G)-Direct Plan', 'Zeta Flexi Cap Fund-Reg(IDCW)'], universe);
    assert.equal(r.byUniverseKey.size, 0);
    assert.deepEqual(r.unresolved, ['Zeta Flexi Cap Fund(G)-Direct Plan', 'Zeta Flexi Cap Fund-Reg(IDCW)']);
    const liquid = rekeyBlock(['Zeta Liquid Fund - IDCW'], universe);
    assert.equal(liquid.byUniverseKey.get('Zeta Liquid Fund(IDCW)')?.blockKey, 'Zeta Liquid Fund - IDCW');
  });

  test('two block keys reaching one universe key: a conflict, neither used; an exact key wins', () => {
    const c = rekeyBlock(['Zeta Midcap Fund-Reg(G)', 'Zeta Mid-Cap Fund - Regular - Growth'], universe);
    assert.equal(c.byUniverseKey.has('Zeta Mid Cap Fund-Reg(G)'), false);
    assert.deepEqual(c.conflicts, [{ universeKey: 'Zeta Mid Cap Fund-Reg(G)', blockKeys: ['Zeta Midcap Fund-Reg(G)', 'Zeta Mid-Cap Fund - Regular - Growth'] }]);
    const e = rekeyBlock(['Zeta Midcap Fund-Reg(G)', 'Zeta Mid Cap Fund-Reg(G)'], universe);
    assert.equal(e.byUniverseKey.get('Zeta Mid Cap Fund-Reg(G)')?.via, 'exact');
  });
});

describe('directTwin (KI-054) and lookThroughKey', () => {
  const direct = ['Zeta Flexi Cap Fund(G)-Direct Plan', 'Zeta Large Cap Fund(G)-Direct Plan', 'Zeta Value Fund(G)(Adjusted)-Direct Plan', 'Zeta Liquid Fund(IDCW)-Direct Plan'];

  test('the same scheme only; no twin gives null, never a substitute', () => {
    assert.equal(directTwin('Zeta Flexi Cap Fund-Reg(G)', direct), 'Zeta Flexi Cap Fund(G)-Direct Plan');
    assert.equal(directTwin('Zeta Dividend Yield Fund-Reg(G)', direct), null, 'the audit\'s case: never the Large Cap twin');
    assert.equal(directTwin('Zeta Value Fund-Reg(G)', direct), 'Zeta Value Fund(G)(Adjusted)-Direct Plan', '"(Adjusted)" ignored');
    assert.equal(directTwin('Zeta Liquid Fund(G)', direct), null, 'the option must agree');
  });

  test('a plain row beats its "(Adjusted)" duplicate', () => {
    assert.equal(directTwin('Zeta Value Fund-Reg(G)', [...direct, 'Zeta Value Fund(G)-Direct Plan']), 'Zeta Value Fund(G)-Direct Plan');
  });

  test('look-through: own row first, else the same scheme\'s Growth row (one portfolio)', () => {
    const analytics = ['Zeta Flexi Cap Fund-Reg(G)', 'Zeta Liquid Fund(G)'];
    assert.equal(lookThroughKey('Zeta Flexi Cap Fund-Reg(G)', analytics), 'Zeta Flexi Cap Fund-Reg(G)');
    assert.equal(lookThroughKey('Zeta Liquid Fund(IDCW)', analytics), 'Zeta Liquid Fund(G)');
    assert.equal(lookThroughKey('Zeta Mid Cap Fund-Reg(G)', analytics), null);
    assert.equal(isDirectKey('Zeta Liquid Fund(G)-Direct Plan'), true);
    assert.equal(isDirectKey('Zeta Liquid Fund(G)'), false);
  });
});
