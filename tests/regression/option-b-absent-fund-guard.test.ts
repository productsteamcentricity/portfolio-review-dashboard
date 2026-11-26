// covers: E-13 KI-050 OD-5 M2.1
// Option B of the matching-strictness question (MOD-04, 26 Nov 2026; the owner has not answered): MatchOptions
// .absentFundGuard, OFF by default. A candidate is rejected when the holding's name leaves unmatched a word the candidate
// set knows but that fewer than 5% of its names carry. Unknown words (misspellings) never count. Full sweep, 26 Nov
// 2026, against default (A): leave-one-out wrong matches 2,725 -> 1,594; official AMFI names right 1,194 -> 1,174.
// This file pins the switch's behaviour so that turning it on is a one-line, already-measured change.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ABSENT_FUND_SHARE, matchInstrument } from '../../app/src/engine/match/instrument.ts';
import { AMFI_NAMES, type AmfiNames } from '../parity/amfi-names.ts';
import { LEDGER, namesBasis } from '../parity/matching-corrections.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';

const A = { nullOnTies: true, houseTokens: true };
const B = { ...A, absentFundGuard: true };

/** A candidate set in which "momentum" is known but rare (1 of 25 names, another house's) and "value" is common. */
const SET = [
  'Omega Momentum Fund-Reg(G)',
  ...Array.from({ length: 12 }, (_, i) => `Zeta Value Plan ${i + 1} Fund-Reg(G)`),
  ...Array.from({ length: 12 }, (_, i) => `Omega Value Series ${i + 1} Fund-Reg(G)`),
];

describe('option B: absentFundGuard (off by default)', () => {
  test('off by default; needs the corrected path', () => {
    assert.equal(ABSENT_FUND_SHARE, 0.05);
    assert.throws(() => matchInstrument('x', '', ['y'], undefined, { absentFundGuard: true }), /nullOnTies/);
  });

  test('a known rare word left unmatched rejects the candidate; (A) accepts it', () => {
    const cands = [...SET, 'Zeta Midcap Fund-Reg(G)'];
    const q = 'Zeta Midcap Momentum Fund';
    assert.equal(matchInstrument(q, 'Zeta', cands, undefined, A), 'Zeta Midcap Fund-Reg(G)');
    assert.equal(matchInstrument(q, 'Zeta', cands, undefined, B), null);
  });

  test('an unknown word (a misspelling) never counts', () => {
    const cands = [...SET, 'Zeta Midcap Fund-Reg(G)'];
    assert.equal(matchInstrument('Zeta Midcap Fnd Regulat', 'Zeta', cands, undefined, B), matchInstrument('Zeta Midcap Fnd Regulat', 'Zeta', cands, undefined, A));
  });

  test('real data: the AMFI corpus under (A) and (B), as measured (report-only after a refresh)', (t) => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8')) as { stages: Array<{ report: { namesBasis: string } }> };
    if (ledger.stages[0]?.report.namesBasis !== namesBasis()) { t.diagnostic('REPORT ONLY: reference names differ from the measured basis'); return; }
    const mf = Object.keys(refdataBlock('MF_PERF'));
    const pairs = (JSON.parse(fs.readFileSync(AMFI_NAMES, 'utf8')) as AmfiNames).pairs;
    const right = (o: object): number => pairs.filter((p) => matchInstrument(p.amfiName, '', mf, undefined, o) === p.vendorKey).length;
    assert.equal(right(A), 1194);
    assert.equal(right(B), 1174);
  });
});
