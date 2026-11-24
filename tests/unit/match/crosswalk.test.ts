// covers: E-125 BR-2.3 E-103 E-104 E-89 E-90 D-026 M2.1
// The identifier crosswalk (app/src/engine/match/crosswalk.ts): identifiers first (ISIN, AMFI scheme code, vendor key),
// then the legacy name unit unchanged. Synthetic sources for the known answers; the real data/refdata only for a
// shape check (no pinned count, so a refresh cannot fail it).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCrosswalk, makeUniverse, resolveInstrument } from '../../../app/src/engine/match/crosswalk.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';

const cw = buildCrosswalk({
  fundRankCodes: { 'Zeta Value Plus Fund-Reg(G)': '100001', 'Zeta Value Discovery Plus Fund-Reg(G)': '100002', 'Twin A': '100009', 'Twin B': '100009', 'Bad Code Fund': 'n/a' },
  stocks: { 'alpha industries': { isin: 'INE000A01011' }, 'beta motors': { isin: 'ine000b01012' }, 'no isin co': { isin: null } },
});
const funds = makeUniverse('MF_PERF', 'MF', 'instrument', ['Zeta Value Plus Fund-Reg(G)', 'Zeta Value Discovery Plus Fund-Reg(G)', 'Aditya Birla SL Retirement Fund-40-Reg(G)']);
const stocks = makeUniverse('STOCK_RET', 'EQUITY', 'stock', ['alpha industries', 'beta motors']);

describe('crosswalk', () => {
  test('an AMFI code resolves its scheme; the code and the name agree', () => {
    const r = resolveInstrument({ name: 'Something Else Entirely', amfiCode: '100002' }, funds, cw);
    assert.equal(r.vendorKey, 'Zeta Value Discovery Plus Fund-Reg(G)');
    assert.deepEqual(r.resolution, { method: 'amfi', confidence: 'exact' });
    assert.equal(r.amfiCode, '100002');
    assert.equal(r.productClass, 'MF');
  });

  test('an ISIN hit, an ISIN miss, and an ISIN in conflict with the name', () => {
    const hit = resolveInstrument({ name: 'Beta Motors Ltd', isin: 'INE000B01012' }, stocks, cw);
    assert.equal(hit.vendorKey, 'beta motors');
    assert.equal(hit.resolution.method, 'isin');
    assert.equal(hit.isin, 'INE000B01012');
    const miss = resolveInstrument({ name: 'Gamma Chemicals', isin: 'INE999Z01019' }, stocks, cw);
    assert.equal(miss.resolution.method, 'none');
    assert.equal(miss.resolution.confidence, 'unmatched');
    /* the identifier wins; the name unit's own answer is kept as a candidate so the conflict shows */
    const conflict = resolveInstrument({ name: 'Zeta Value Fund', amfiCode: '100002' }, funds, cw);
    assert.equal(conflict.vendorKey, 'Zeta Value Discovery Plus Fund-Reg(G)');
    assert.deepEqual(conflict.resolution.candidates, ['Zeta Value Plus Fund-Reg(G)']);
  });

  test('a code carried by two names, or malformed, resolves nothing (never a guess)', () => {
    assert.ok(cw.ambiguous.has('100009'));
    assert.equal(cw.nameByAmfi.has('100009'), false);
    assert.equal(cw.amfiByName.has('Bad Code Fund'), false);
  });

  test('vendor key, then the legacy name unit: pin, exact, fuzzy proposal', () => {
    assert.equal(resolveInstrument({ name: 'Zeta Value Plus Fund-Reg(G)' }, funds, cw).resolution.method, 'vendor-key');
    const pin = resolveInstrument({ name: 'Aditya Birla Sun Life Retirement Fund - The 40s Plan' }, funds, cw);
    assert.deepEqual([pin.vendorKey, pin.resolution.method, pin.resolution.confidence], ['Aditya Birla SL Retirement Fund-40-Reg(G)', 'alias-pin', 'pinned']);
    const exact = resolveInstrument({ name: 'Zeta Value Plus Fund - Regular Plan - Growth' }, funds, cw);
    assert.deepEqual([exact.vendorKey, exact.resolution.method, exact.resolution.confidence], ['Zeta Value Plus Fund-Reg(G)', 'name-match', 'exact']);
    const fuzzy = resolveInstrument({ name: 'Zeta Value Discovery Fund' }, funds, cw);
    assert.deepEqual([fuzzy.vendorKey, fuzzy.resolution.method, fuzzy.resolution.confidence], ['Zeta Value Discovery Plus Fund-Reg(G)', 'name-match', 'proposed']);
    const none = resolveInstrument({ name: 'ICICI Pru Leaders Fund Series IV' }, funds, cw);
    assert.equal(none.resolution.method, 'none');
  });

  test('on the shipped reference data: codes and ISINs are read, and FUND_RANKS gives codes only (D-026)', () => {
    const real = buildCrosswalk({ fundRankCodes: refdataBlock('FUND_RANKS_CODES'), stocks: refdataBlock('STOCK_RET') });
    assert.ok(real.nameByAmfi.size > 0);
    assert.ok(real.stockKeyByIsin.size > 0);
    for (const v of Object.values(refdataBlock('FUND_RANKS_CODES'))) assert.equal(typeof v === 'string' || typeof v === 'number', true);
  });
});
