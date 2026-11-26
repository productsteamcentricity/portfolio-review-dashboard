// covers: E-31 E-32 E-30 KI-054 KI-072 KI-073 KI-083 KI-024 Q-45 OD-7 M3
// The performance tables (app/src/engine/returns/performance.ts) on hand-made holdings and records: the bucket by route
// and class (KI-072), a mutual fund of no known class left out (OD-7), the Q-45 order and the Debt MF tenors, the
// benchmark table with a missing or empty series recorded (KI-073) and no benchmark named (OD-7), a debt-like PMS
// without an equity benchmark (KI-024), the dates per bucket (KI-083), and the Direct list (KI-054).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { DayNumber, Value } from '../../../app/src/model/value.ts';
import type { PerformanceSources, PerfRecord } from '../../../app/src/engine/returns/performance.ts';
import { computePerformance, categoryKey, benchKey } from '../../../app/src/engine/returns/performance.ts';
import { parseProductClassRules } from '../../../app/src/engine/match/product-class.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';

let n = 0;
function h(name: string, product: string, asset: Holding['assetClass'], category: string | null, key?: string): Holding {
  n += 1;
  return {
    id: `h${n}`, instrumentName: name, product, assetClass: asset, categoryLabel: category, inclusion: { status: 'included' },
    cmv: { kind: 'value', v: 1, unit: 'cr', prov: { sources: [], method: 't' } },
    instrument: key ? { productClass: 'MF', nameKey: name, vendorKey: key, resolution: { method: 'name-match', confidence: 'exact' } } : null,
  } as unknown as Holding;
}
const rec = (r: Record<string, number | null>, extra: Partial<PerfRecord> = {}): PerfRecord => ({ aum: 100, inception: '2015-01-01', r, ...extra });
const day = (d: number): Value<DayNumber> => ({ kind: 'value', v: d as DayNumber, unit: 'date', prov: { sources: [], method: 't' } });
const R = { '1M': 1, '3M': 2, '6M': 3, '1Y': 4, '2Y': 5, '3Y': 6, '5Y': 7, '10Y': 8, SI: 9 };
const MF: Record<string, PerfRecord> = {
  'Alpha Large Cap Fund-Reg(G)': rec(R), 'Alpha Flexi Cap Fund-Reg(G)': rec(R), 'Alpha Liquid Fund-Reg(G)': rec(R, { type: 'debt' }),
  'Alpha Gilt Fund-Reg(G)': rec(R), 'Alpha Arbitrage Fund-Reg(G)': rec(R), 'Alpha Conservative Hybrid Fund-Reg(G)': rec(R),
  'Alpha Nifty 50 ETF': rec(R), 'Alpha Nifty Next 50 Index Fund-Reg(G)': rec(R), 'Alpha Mystery Fund-Reg(G)': rec(R, { type: 'debt' }),
};
const MF_DIRECT: Record<string, PerfRecord> = { 'Alpha Large Cap Fund(G)-Direct Plan': rec({ ...R, '1Y': 40 }) };
const BENCH = {
  [benchKey('Nifty 100 - TRI')]: { name: 'NIFTY 100 - TRI', r: R }, [benchKey('Nifty 500 - TRI')]: { name: 'NIFTY 500 - TRI', r: R },
  [benchKey('Nifty 50 - TRI')]: { name: 'NIFTY 50 - TRI', r: R }, [benchKey('CRISIL Liquid Debt Index')]: { name: 'CRISIL Liquid Debt Index', r: R },
  /* an empty series: no figure for any tenor (KI-073) */
  [benchKey('CRISIL 10 Year Gilt Index')]: { name: 'CRISIL 10 Year Gilt Index', r: { '1Y': null } },
  [benchKey('CRISIL Hybrid 85+15 - Conservative Index')]: { name: 'CRISIL Hybrid 85+15 - Conservative Index', r: R },
};
const SRC: PerformanceSources = {
  MF, MF_DIRECT, PMS: { 'Beta Equity PMS': rec(R) }, AIF: null, SIF: null, STOCK: null, BENCH,
  asOn: { MF: day(20757), MF_DIRECT: day(20757), BENCH: day(20757), PMS: day(20665) },
  rules: parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES')),
};
const H = [
  h('Alpha Liquid Fund - Regular - Growth', 'Mutual Funds', 'Debt', 'Liquid', 'Alpha Liquid Fund-Reg(G)'),
  h('Alpha Gilt Fund', 'Mutual Funds', 'Debt', 'Gilt Fund', 'Alpha Gilt Fund-Reg(G)'),
  h('Alpha Flexi Cap Fund', 'Mutual Funds', 'Equity', 'Flexi Cap Fund', 'Alpha Flexi Cap Fund-Reg(G)'),
  h('Alpha Large Cap Fund', 'Mutual Funds', 'Equity', 'Large Cap Fund', 'Alpha Large Cap Fund-Reg(G)'),
  h('Alpha Nifty 50 ETF', 'Mutual Funds', 'Equity', 'Index Funds', 'Alpha Nifty 50 ETF'),
  h('Alpha Nifty Next 50 Index Fund', 'Mutual Funds', 'Equity', 'Index Funds', 'Alpha Nifty Next 50 Index Fund-Reg(G)'),
  h('Alpha Arbitrage Fund', 'Mutual Funds', 'Hybrid', 'Arbitrage Fund', 'Alpha Arbitrage Fund-Reg(G)'),
  h('Alpha Conservative Hybrid Fund', 'Mutual Funds', 'Hybrid', 'Conservative Hybrid Fund', 'Alpha Conservative Hybrid Fund-Reg(G)'),
  h('Alpha Balanced Advantage Fund', 'Mutual Funds', 'Hybrid', 'Balanced Advantage', undefined),
  h('Unmatched Value PMS', 'PMS', 'Equity', 'Flexi Cap', undefined),
  h('Gamma Credit PMS', 'PMS', 'Debt', 'Fixed Income', undefined),
  h('Alpha Mystery Fund', 'Mutual Funds', null, 'Something', 'Alpha Mystery Fund-Reg(G)'),
  h('Nobody Knows Fund', 'Mutual Funds', null, 'Something', undefined),
  h('Sample Corporate Bond 2030', 'Bonds', 'Debt', null, undefined),
];
const res = computePerformance(H, SRC);
const bucket = (k: string, list = res.regular) => list.find((b) => b.key === k)!;

describe('computePerformance', () => {
  test('categoryKey and benchKey', () => {
    assert.equal(categoryKey('Large & Mid Cap'), ' large and mid cap ');
    assert.equal(benchKey('Nifty500 Multicap 50:25:25 - TRI'), 'nifty500multicap502525');
    assert.equal(benchKey('NIFTY 100 - TRI'), 'nifty100');
  });

  test('buckets by route and class: an unmatched PMS stays PMS (KI-072); another class and an unknown, unmatched MF are left out (OD-7)', () => {
    assert.deepEqual(res.regular.map((b) => b.key), ['Equity MF', 'Hybrid MF', 'Debt MF', 'PMS']);
    assert.deepEqual(bucket('PMS').groups.flatMap((g) => g.funds.map((f) => f.name)), ['Unmatched Value PMS', 'Gamma Credit PMS']);
    assert.deepEqual(res.leftOut.map((x) => [x.name, x.reason]), [['Nobody Knows Fund', 'mf-class-unknown'], ['Sample Corporate Bond 2030', 'other-class']]);
    assert.ok(bucket('Debt MF').groups.some((g) => g.funds.some((f) => f.name === 'Alpha Mystery Fund')), "no class: the matched record's type (debt)");
  });

  test('Q-45: the Equity groups in the brief order, debt overnight to long, no 2Y for Debt MF', () => {
    assert.deepEqual(bucket('Equity MF').groups.map((g) => g.label), ['Index Funds', 'Large Cap Funds', 'Diversified Funds']);
    assert.deepEqual(bucket('Debt MF').groups.map((g) => g.label), ['Liquid', 'Gilt Fund', 'Something']);
    assert.deepEqual(bucket('Debt MF').cols, ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'SI']);
    assert.deepEqual(bucket('Hybrid MF').groups.map((g) => g.label), ['Arbitrage Fund', 'Conservative Hybrid Fund', 'Balanced Advantage']);
  });

  test('benchmarks: the conditional Next 50, a missing and an empty series recorded (KI-073), none named (OD-7), none for a debt PMS (KI-024)', () => {
    const idx = bucket('Equity MF').groups[0]!;
    assert.deepEqual(idx.benchmarks.map((b) => b.name), ['NIFTY 50 - TRI']);
    assert.deepEqual(idx.missingBenchmarks, ['Nifty Next 50 - TRI']);
    const gilt = bucket('Debt MF').groups.find((g) => g.label === 'Gilt Fund')!;
    assert.deepEqual([gilt.benchmarks.length, gilt.missingBenchmarks], [0, ['CRISIL 10 Year Gilt Index']]);
    const hy = bucket('Hybrid MF').groups;
    assert.deepEqual(hy[0]!.missingBenchmarks, ['Nifty 50 Arbitrage']);
    assert.equal(hy[2]!.noBenchmarkNamed, true);
    const credit = bucket('PMS').groups.find((g) => g.label === 'Fixed Income')!;
    assert.equal(credit.noBenchmarkNamed, true);
    assert.deepEqual(bucket('PMS').groups.find((g) => g.label === 'Flexi Cap')!.benchmarks.map((b) => b.name), ['NIFTY 500 - TRI']);
  });

  test('a fund row: Value returns; an unmatched fund blank with a reason', () => {
    const large = bucket('Equity MF').groups[1]!.funds[0]!;
    assert.equal(large.r['1Y']!.kind === 'value' && large.r['1Y']!.v, 4);
    const pms = bucket('PMS').groups[0]!.funds[0]!;
    assert.equal(pms.key, null);
    assert.ok(Object.values(pms.r).every((v) => v!.kind === 'missing'));
  });

  test('dates per bucket (KI-083)', () => {
    assert.equal(bucket('PMS').asOn.kind === 'value' && bucket('PMS').asOn.v, 20665);
    assert.equal(bucket('Equity MF').asOn.kind === 'value' && bucket('Equity MF').asOn.v, 20757);
    assert.notEqual(bucket('PMS').benchAsOn, null);
  });

  test('the Direct list (KI-054): the same scheme only, an ETF single plan, no twin a blank row counted, non-MF buckets unchanged', () => {
    const d = res.direct!;
    const eq = bucket('Equity MF', d);
    const large = eq.groups.find((g) => g.label === 'Large Cap Funds')!.funds[0]!;
    assert.deepEqual([large.plan, large.key, large.r['1Y']!.kind === 'value' && large.r['1Y']!.v], ['direct', 'Alpha Large Cap Fund(G)-Direct Plan', 40]);
    const etf = eq.groups[0]!.funds.find((f) => f.name === 'Alpha Nifty 50 ETF')!;
    assert.equal(etf.plan, 'single-plan');
    const flexi = eq.groups.find((g) => g.label === 'Diversified Funds')!.funds[0]!;
    assert.equal(flexi.plan, 'no-direct-twin');
    assert.ok(res.noDirectTwin.includes('Alpha Flexi Cap Fund'));
    assert.equal(bucket('PMS', d), bucket('PMS'));
    assert.equal(computePerformance(H.filter((x) => x.product === 'PMS'), SRC).direct, null, 'no matched mutual fund: no Direct list');
  });
});
