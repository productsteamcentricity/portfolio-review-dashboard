// covers: E-13 KI-036 OD-5 M2.1
// KI-036 (P0): the legacy matcher breaks ties on candidate order (strict ">", the first key wins), and its exact-name
// step collapses the Growth and IDCW plans. The correction (MatchOptions.nullOnTies; the audit's fix): a candidate
// equal to the raw name wins first; option variants of one scheme are told apart by the holding's own option; any other
// tie gives no match. The audit's known answers (verify-data-7/tie1.js, fix.js) and an order-independence check on the
// real reference data.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchInstrument, matchInstrumentDetail, optionOf } from '../../app/src/engine/match/instrument.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';

const C = { nullOnTies: true };
const MF = Object.keys(refdataBlock('MF_PERF'));

describe('KI-036: no answer decided by candidate order', () => {
  test('a fuzzy tie between two different funds gives no match; the legacy took the first', () => {
    const cands = ['Zeta Alpha Equity Fund-Reg(G)', 'Zeta Alpha Value Fund-Reg(G)'];
    const q = 'Zeta Alpha Fund';
    assert.equal(matchInstrument(q, 'Zeta', cands), cands[0]);
    assert.equal(matchInstrument(q, 'Zeta', [...cands].reverse()), cands[1]);
    assert.deepEqual(matchInstrumentDetail(q, 'Zeta', cands, undefined, C).step, 'fuzzy-tie');
    assert.equal(matchInstrument(q, 'Zeta', cands, undefined, C), null);
    assert.equal(matchInstrument(q, 'Zeta', [...cands].reverse(), undefined, C), null);
  });

  test('Growth and IDCW of one scheme: the holding\'s own option decides (exact step)', () => {
    const cands = ['Zeta Liquid Rate ETF(G)', 'Zeta Liquid Rate ETF(IDCW)'];
    assert.equal(matchInstrument('Zeta Liquid Rate ETF - IDCW', '', cands), 'Zeta Liquid Rate ETF(G)', 'legacy collapses the plans');
    assert.equal(matchInstrument('Zeta Liquid Rate ETF - IDCW', '', cands, undefined, C), 'Zeta Liquid Rate ETF(IDCW)');
    assert.equal(matchInstrument('Zeta Liquid Rate ETF - Dividend Payout', '', [...cands].reverse(), undefined, C), 'Zeta Liquid Rate ETF(IDCW)');
    assert.equal(matchInstrument('Zeta Liquid Rate ETF - Growth', '', [...cands].reverse(), undefined, C), 'Zeta Liquid Rate ETF(G)');
    assert.equal(matchInstrument('Zeta Liquid Rate ETF', '', [...cands].reverse(), undefined, C), 'Zeta Liquid Rate ETF(G)', 'no option stated: Growth');
  });

  test('same normalised name, not told apart by option: no match', () => {
    const cands = ['Zeta Bond Fund(G)', 'Zeta Bond Fund-Reg(G)'];
    assert.deepEqual(matchInstrumentDetail('Zeta Bond Fund', '', cands, undefined, C), { key: null, step: 'exact-ambiguous' });
  });

  test('a candidate equal to the raw name wins first', () => {
    const cands = ['Zeta Bond Fund(G)', 'Zeta Bond Fund-Reg(G)'];
    assert.equal(matchInstrument('Zeta Bond Fund-Reg(G)', '', cands, undefined, C), 'Zeta Bond Fund-Reg(G)');
  });

  test('"Dividend Yield" is a fund category, not the IDCW option', () => {
    assert.equal(optionOf('Zeta Dividend Yield Fund-Reg(G)'), 'growth');
    assert.equal(optionOf('Zeta Dividend Yield Fund-Reg(IDCW)'), 'idcw');
    assert.equal(optionOf('Zeta Dividend Yield Fund - Regular Plan - Growth'), 'growth');
    const cands = ['Zeta Dividend Yield Fund-Reg(G)', 'Zeta Dividend Yield Fund-Reg(IDCW)'];
    assert.equal(matchInstrument('Zeta Dividend Yield Fund - Growth', '', [...cands].reverse(), undefined, C), cands[0]);
  });

  test('legacy default unchanged without the option', () => {
    const cands = ['Zeta Alpha Equity Fund-Reg(G)', 'Zeta Alpha Value Fund-Reg(G)'];
    assert.equal(matchInstrumentDetail('Zeta Alpha Fund', 'Zeta', cands).step, 'fuzzy');
  });
});

describe('KI-036 on the real reference data', () => {
  test('the audit\'s case: an IDCW ETF holding gets its own IDCW record, not the Growth one', (t) => {
    const g = 'ICICI Pru BSE Liquid Rate ETF(G)', d = 'ICICI Pru BSE Liquid Rate ETF(IDCW)';
    if (!MF.includes(g) || !MF.includes(d)) { t.diagnostic('REPORT ONLY: the ETF is not in today\'s MF_PERF'); return; }
    assert.equal(matchInstrument('ICICI Prudential BSE Liquid Rate ETF - IDCW', '', MF), g, 'legacy');
    assert.equal(matchInstrument('ICICI Prudential BSE Liquid Rate ETF - IDCW', '', MF, undefined, C), d);
  });

  test('order independence: reversing MF_PERF never changes a corrected answer (every 7th name and a misspelling)', () => {
    const rev = [...MF].reverse();
    let differ = 0;
    MF.forEach((k, i) => {
      if (i % 7 !== 0) return;
      for (const q of [k, k.replace(/[(][^)]*[)]/g, ' ').replace(/-Reg/g, ' ').trim(), k.split(' ').slice(0, 3).join(' ')]) {
        if (matchInstrument(q, '', MF, undefined, C) !== matchInstrument(q, '', rev, undefined, C)) differ++;
      }
    });
    assert.equal(differ, 0);
  });
});
