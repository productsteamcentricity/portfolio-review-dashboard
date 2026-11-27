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
import { buildPerformanceVM } from '../../../app/src/views/performance.ts';
import { performanceSheet } from '../../../app/src/exports/xlsx/sheets/performance.ts';
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

  test('N8: the Direct list\'s single-plan ETF shows the Regular block\'s figures under that block\'s date, on screen and in the sheet', () => {
    /* a Direct block of another date (30 Oct 2026) than the Regular one (31 Oct 2026) */
    const r2 = computePerformance(H, { ...SRC, asOn: { ...SRC.asOn, MF_DIRECT: day(20756) } });
    const eq = bucket('Equity MF', r2.direct!);
    assert.ok(eq.asOn.kind === 'value' && eq.asOn.v === 20756);
    assert.ok(eq.singlePlanAsOn?.kind === 'value' && eq.singlePlanAsOn.v === 20757);
    assert.equal(bucket('Equity MF', r2.regular).singlePlanAsOn, undefined);
    const note = buildPerformanceVM(r2, 'direct').buckets[0]!.notes.find((x) => x.includes('single plan'));
    assert.equal(note, `${String.fromCharCode(0x2020)} 1 ETF has a single plan: the figures are the fund's own, from the Regular plans' data, as on 31 Oct 2026.`);
    const sheet = performanceSheet(r2);
    const keys = sheet.columns.map((c) => c.key);
    const at = (row: unknown[], k: string): unknown => (row[keys.indexOf(k)] as { v?: unknown } | null)?.v ?? null;
    const etfRow = sheet.rows.find((x) => at(x, 'plan') === 'Direct' && at(x, 'name') === 'Alpha Nifty 50 ETF')!;
    const otherDirect = sheet.rows.find((x) => at(x, 'plan') === 'Direct' && at(x, 'row') === 'Fund' && at(x, 'name') !== 'Alpha Nifty 50 ETF')!;
    assert.equal((at(etfRow, 'asOn') as number) - (at(otherDirect, 'asOn') as number), 1, 'the ETF row carries the Regular date, the others the Direct date');
  });
});

describe('B1 (KI-024, rule 4; MOD-05 on the financial review of 27 Nov 2026): a PMS or AIF gets an equity index only when all its holdings are equity', () => {
  const groupOf = (hs: Holding[], bucketKey: string, label: string) => computePerformance(hs, SRC).regular.find((b) => b.key === bucketKey)!.groups.find((g) => g.label === label)!;

  test('a debt AIF with a category of no debt word gets no benchmark row ("Category II", "High Yield")', () => {
    for (const cat of ['Category II', 'High Yield']) {
      const g = groupOf([h(`Synthetic ${cat} AIF`, 'AIF', 'Debt', cat)], 'AIF', cat);
      assert.deepEqual([g.benchmarks.length, g.missingBenchmarks.length, g.noBenchmarkNamed, g.noBenchmarkReason], [0, 0, true, 'not-all-equity'], cat);
    }
  });

  test('a debt PMS with a blank category ("Other") gets none', () => {
    const g = groupOf([h('Synthetic Income PMS', 'PMS', 'Debt', null)], 'PMS', 'Other');
    assert.deepEqual([g.benchmarks.length, g.noBenchmarkReason], [0, 'not-all-equity']);
  });

  test('a blank-category group with one debt and one equity AIF gets none (the test reads the holdings, not the label)', () => {
    const g = groupOf([h('Synthetic Credit AIF', 'AIF', 'Debt', null), h('Synthetic Growth AIF', 'AIF', 'Equity', null)], 'AIF', 'Other');
    assert.deepEqual([g.benchmarks.length, g.noBenchmarkReason], [0, 'not-all-equity']);
  });

  test('Hybrid, Unknown and REITs/InvITs holdings also get none; an all-equity group still gets its equity index', () => {
    for (const asset of ['Hybrid', null, 'REITs/InvITs'] as const) {
      const g = groupOf([h('Synthetic Multi Asset PMS', 'PMS', asset, 'Multi Asset')], 'PMS', 'Multi Asset');
      assert.equal(g.noBenchmarkReason, 'not-all-equity', String(asset));
    }
    const eq = groupOf([h('Synthetic Flexi PMS', 'PMS', 'Equity', 'Flexi Cap'), h('Synthetic Flexi PMS 2', 'PMS', 'Equity', 'Flexi Cap')], 'PMS', 'Flexi Cap');
    assert.deepEqual([eq.benchmarks.map((b) => b.name), eq.noBenchmarkReason], [['NIFTY 500 - TRI'], null]);
  });

  test('the view says why, apart from a category with no benchmark named or one not recognised (N6)', () => {
    /* the debt AIF is matched, so its group is shown with its figures (a group with nothing to show gets no note) */
    const vm = buildPerformanceVM(computePerformance([
      h('Synthetic Credit AIF', 'AIF', 'Debt', 'Category II', 'Synthetic Credit AIF'),
      h('Synthetic Odd Fund', 'Mutual Funds', 'Equity', 'Equity - Large Cap', 'Alpha Large Cap Fund-Reg(G)'),
      h('Synthetic Balanced Fund', 'Mutual Funds', 'Hybrid', 'Balanced Advantage', 'Alpha Conservative Hybrid Fund-Reg(G)'),
    ], { ...SRC, AIF: { 'Synthetic Credit AIF': rec(R) } }));
    const notes = vm.buckets.flatMap((b) => b.notes);
    assert.ok(notes.includes('No benchmark is shown for Category II: an equity index is used for a PMS or AIF group only when every holding in it is an equity holding.'), JSON.stringify(notes));
    assert.ok(notes.includes('The category Equity - Large Cap was not recognised, so no benchmark is shown for it.'), JSON.stringify(notes));
    assert.ok(notes.includes('No benchmark is named yet for Balanced Advantage.'), JSON.stringify(notes));
  });
});

describe('S3: a scheme the Regular block carries only as a Direct plan', () => {
  test('is a single plan with the dagger in the Regular list, never "Regular"', () => {
    const src = { ...SRC, MF: { ...MF, 'Zeta Nifty 50 Index Fund(G)-Direct Plan': rec(R) } };
    const res = computePerformance([h('Zeta Nifty 50 Index Fund - Direct Plan - Growth', 'Mutual Funds', 'Equity', 'Index Funds', 'Zeta Nifty 50 Index Fund(G)-Direct Plan')], src);
    const f = res.regular[0]!.groups[0]!.funds[0]!;
    assert.equal(f.plan, 'single-plan');
    const b = buildPerformanceVM(res, 'regular').buckets[0]!;
    assert.ok(b.rows.some((r) => r.kind === 'fund' && r.marker !== null));
    assert.ok(b.notes.some((n) => n.endsWith('1 scheme has only a Direct plan: the figures are that plan\'s.')), JSON.stringify(b.notes));
    const row = performanceSheet(res).rows.find((r) => (r[6] as { v?: string } | null)?.v === 'Zeta Nifty 50 Index Fund - Direct Plan - Growth')!;
    assert.deepEqual(row[0], { kind: 'str', v: 'Direct only (single plan)' }, 'the workbook\'s Plan column');
  });
});

describe('N10: an unmatched fund and a matched fund with no returns are told apart', () => {
  test('two notes', () => {
    const src = { ...SRC, MF: { ...MF, 'Alpha Empty Fund-Reg(G)': rec({}) } };
    const b = buildPerformanceVM(computePerformance([
      h('Synthetic Unknown Fund', 'Mutual Funds', 'Equity', 'Large Cap Fund'),
      h('Alpha Empty Fund', 'Mutual Funds', 'Equity', 'Large Cap Fund', 'Alpha Empty Fund-Reg(G)'),
      h('Alpha Large Cap Fund', 'Mutual Funds', 'Equity', 'Large Cap Fund', 'Alpha Large Cap Fund-Reg(G)'),
    ], src)).buckets[0]!;
    assert.ok(b.notes.includes('1 fund is not matched to reference data and is not shown: Synthetic Unknown Fund.'), JSON.stringify(b.notes));
    assert.ok(b.notes.includes('1 fund has no returns in the data and is not shown: Alpha Empty Fund.'), JSON.stringify(b.notes));
  });
});
