// covers: E-125 BR-2.3 E-104 KI-052 OD-23 M2.1
// The fund ISIN map (app/src/engine/match/amfi-isin.ts) on a synthetic ids file with the faults CHAT-007 saw in the real
// one on 23-24 Nov 2026 ("-" placeholders, a non-ISIN, one value on several codes), and the crosswalk's fund ISIN step:
// ISIN to scheme code to this universe's key of the same scheme, through the KI-052 re-key and the owner's aliases.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AMFI_ISIN_FORM, buildAmfiIsinRecord, parseAmfiIds, parseAmfiIsinRecord } from '../../../app/src/engine/match/amfi-isin.ts';
import { buildCrosswalk, makeUniverse, resolveInstrument } from '../../../app/src/engine/match/crosswalk.ts';
import { parseOwnerAliases } from '../../../app/src/engine/match/owner-aliases.ts';

/** The crosswalk's sprint 2a identifier steps are opt-in (Gate B of 10687a5, N1). */
const J = { identifierJoin: true };

const T = String.fromCharCode(9);
const CRLF = String.fromCharCode(13, 10);
const row = (...c: string[]): string => c.join(T);
const HEAD = row('code', 'isin_growth_or_payout', 'isin_reinvestment', 'name', 'plan', 'option', 'amc', 'category', 'last_serial', 'last_date');
const SAMPLE = [
  HEAD,
  row('100001', 'INF000A01AA1', 'INF000A01AB9', 'Zeta Flexi Cap Fund - Regular Plan - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Equity', '1', '24-Nov-2026'),
  row('100002', '-', '', 'Zeta Liquid Fund - Regular Plan - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Debt', '2', '24-Nov-2026'),
  row('100003', '-', 'INF000A01AC7', 'Zeta Liquid Fund - Regular Plan - IDCW', 'Regular', 'IDCW', 'Zeta Mutual Fund', 'Debt', '3', '24-Nov-2026'),
  row('100004', 'ZETANIVODG', '', 'Zeta Nifty Index Fund - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Index', '4', '24-Nov-2026'),
  row('100005', 'INF000A01AD5', '', 'Zeta Value Fund - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Equity', '5', '24-Nov-2026'),
  row('100006', 'inf000a01ad5', '', 'Zeta Value Fund - Bonus', 'Regular', 'Bonus', 'Zeta Mutual Fund', 'Equity', '6', '24-Nov-2026'),
  row('100007', 'INF000A01AE3', '', 'Zeta Equity & Debt Fund - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Hybrid', '7', '24-Nov-2026'),
  row('ABC', 'INF000A01AF0', '', 'Not a code', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Equity', '8', '24-Nov-2026'),
].join(CRLF) + CRLF;

describe('AMFI ids file: the fund ISIN map', () => {
  const ids = parseAmfiIds(String.fromCharCode(0xfeff) + SAMPLE);

  test('ISINs of the form only; placeholders and non-ISINs dropped and counted', () => {
    assert.equal(AMFI_ISIN_FORM.test('INF000A01AA1'), true);
    assert.equal(AMFI_ISIN_FORM.test('-'), false);
    assert.deepEqual(ids.dropped.invalidIsin, [{ code: '100002', value: '-' }, { code: '100003', value: '-' }, { code: '100004', value: 'ZETANIVODG' }]);
    assert.equal(ids.dropped.badRows, 1);
    assert.equal(ids.rows.length, 7);
  });

  test('both ISIN columns map to the code; an ISIN on two codes resolves nothing and is listed', () => {
    assert.equal(ids.byIsin.get('INF000A01AA1'), '100001');
    assert.equal(ids.byIsin.get('INF000A01AB9'), '100001');
    assert.equal(ids.byIsin.get('INF000A01AC7'), '100003');
    assert.equal(ids.byIsin.has('INF000A01AD5'), false);
    assert.deepEqual(ids.dropped.ambiguousIsin, [{ isin: 'INF000A01AD5', codes: ['100005', '100006'] }]);
  });

  test('the record round-trips; a bad entry or a wrong header is refused', () => {
    const rec = buildAmfiIsinRecord(ids, { source: 'synthetic', asOn: '2026-11-24', inputSha256: '0'.repeat(64) });
    assert.deepEqual(rec.counts, { codes: 7, isins: 4, invalidIsin: 3, ambiguousIsin: 1, badRows: 1 });
    const back = parseAmfiIsinRecord(JSON.parse(JSON.stringify(rec)));
    assert.deepEqual([...back.isinToCode], [...ids.byIsin]);
    assert.equal(back.codeToName.get('100001'), 'Zeta Flexi Cap Fund - Regular Plan - Growth');
    assert.throws(() => parseAmfiIsinRecord({ table: 'amfi-isin', isinToCode: { '-': '100002' } }), /not an ISIN/);
    assert.throws(() => parseAmfiIds(row('code', 'isin') + CRLF), /unexpected header/);
  });
});

describe('crosswalk: fund ISIN to scheme code to the universe key of the same scheme', () => {
  const ids = parseAmfiIds(SAMPLE);
  const aliases = parseOwnerAliases({
    table: 'fund-aliases', decision: 'PD-36', approved: '2026-11-25',
    aliases: [{ line: 1, oldName: 'Zeta Equity & Debt Fund', key: 'zeta equity debt fund', regular: 'Zeta Aggressive Hybrid Fund(G)', direct: 'Zeta Aggressive Hybrid Fund(G)-Direct Plan', evidence: ['https://example.org/notice'] }],
  });
  /* FUND_RANKS_CODES spells the flexi cap fund differently and still has the hybrid under its old name */
  const cw = buildCrosswalk({ fundRankCodes: { 'Zeta Flexicap Fund-Reg(G)': '100001', 'Zeta Equity & Debt Fund(G)': '100007' }, stocks: {}, fundIsins: ids.byIsin, aliases });
  const funds = makeUniverse('MF_PERF', { 'Zeta Flexi Cap Fund-Reg(G)': {}, 'Zeta Aggressive Hybrid Fund(G)': {}, 'Zeta Liquid Fund(G)': {} }, 'MF', 'instrument', 'MF');

  test('an ISIN resolves through the re-keyed spelling', () => {
    const r = resolveInstrument({ name: 'Something else', isin: 'INF000A01AB9' }, funds, cw, J);
    assert.equal(r.vendorKey, 'Zeta Flexi Cap Fund-Reg(G)');
    assert.deepEqual(r.resolution, { method: 'isin', confidence: 'exact' });
    assert.equal(r.amfiCode, '100001');
  });

  test('a renamed scheme\'s ISIN reaches its new name through the owner\'s alias (OD-23)', () => {
    const r = resolveInstrument({ name: 'Zeta Equity & Debt Fund - Growth', isin: 'INF000A01AE3' }, funds, cw, J);
    assert.equal(r.vendorKey, 'Zeta Aggressive Hybrid Fund(G)');
    assert.equal(r.resolution.method, 'isin');
  });

  test('an ISIN with no map entry, or an ambiguous one, falls back to the name', () => {
    const r = resolveInstrument({ name: 'Zeta Liquid Fund - Growth', isin: 'INF000A01AD5' }, funds, cw, { ...J, nullOnTies: true });
    assert.equal(r.vendorKey, 'Zeta Liquid Fund(G)');
    assert.equal(r.resolution.method, 'name-match');
  });

  test("without identifierJoin the crosswalk is sprint 1's: no fund ISIN step, no re-keyed code", () => {
    assert.equal(resolveInstrument({ name: 'x', isin: 'INF000A01AB9' }, funds, cw).resolution.method, 'none');
    assert.equal(resolveInstrument({ name: 'x', amfiCode: '100001' }, funds, cw).resolution.method, 'none');
  });

  test('an AMFI code resolves through the re-keyed spelling too', () => {
    const r = resolveInstrument({ name: 'x', amfiCode: '100001' }, funds, cw, J);
    assert.equal(r.vendorKey, 'Zeta Flexi Cap Fund-Reg(G)');
    assert.equal(r.resolution.method, 'amfi');
  });
});

describe('crosswalk: codes joined through the official AMFI names', () => {
  test('a Direct-plan ISIN reaches the Direct key; a scheme FUND_RANKS_CODES does not list is reached too', () => {
    const ids = parseAmfiIds([
      HEAD,
      row('200001', 'INF000B01AA1', '', 'Zeta Flexi Cap Fund - Direct Plan - Growth', 'Direct', 'Growth', 'Zeta Mutual Fund', 'Equity', '1', '24-Nov-2026'),
      row('200002', 'INF000B01AB9', '', 'Zeta Small Cap Fund - Regular Plan - Growth', 'Regular', 'Growth', 'Zeta Mutual Fund', 'Equity', '2', '24-Nov-2026'),
    ].join(CRLF));
    const names = new Map(ids.rows.map((r) => [r.code, r.name]));
    const cw = buildCrosswalk({ fundRankCodes: {}, stocks: {}, fundIsins: ids.byIsin, amfiNames: names });
    const direct = makeUniverse('MF_PERF_DIRECT', { 'Zeta Flexi Cap Fund(G)-Direct Plan': {} }, 'MF', 'instrument', 'MF');
    const regular = makeUniverse('MF_PERF', { 'Zeta Small Cap Fund-Reg(G)': {}, 'Zeta Flexi Cap Fund-Reg(G)': {} }, 'MF', 'instrument', 'MF');
    assert.equal(resolveInstrument({ name: 'x', isin: 'INF000B01AA1' }, direct, cw, J).vendorKey, 'Zeta Flexi Cap Fund(G)-Direct Plan');
    assert.equal(resolveInstrument({ name: 'x', isin: 'INF000B01AA1' }, regular, cw, J).vendorKey, undefined, 'never the other plan');
    assert.equal(resolveInstrument({ name: 'x', isin: 'INF000B01AB9' }, regular, cw, J).vendorKey, 'Zeta Small Cap Fund-Reg(G)');
  });

  test('FUND_RANKS_CODES and the AMFI names giving one key different codes: no join', () => {
    const names = new Map([['300001', 'Zeta Mid Cap Fund - Regular Plan - Growth']]);
    const cw = buildCrosswalk({ fundRankCodes: { 'Zeta Midcap Fund-Reg(G)': '399999' }, stocks: {}, fundIsins: new Map([['INF000C01AA1', '300001']]), amfiNames: names });
    const u = makeUniverse('MF_PERF', { 'Zeta Mid Cap Fund-Reg(G)': {} }, 'MF', 'instrument', 'MF');
    assert.equal(resolveInstrument({ name: 'x', isin: 'INF000C01AA1' }, u, cw, J).vendorKey, undefined);
    assert.equal(resolveInstrument({ name: 'x', amfiCode: '399999' }, u, cw, J).vendorKey, undefined);
  });
});
