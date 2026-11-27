// covers: E-30 E-31 KI-024 KI-073 OD-7 Q-45 M3
// The benchmark of every SEBI mutual-fund category name (S1 of the financial review of 27 Nov 2026), through the real
// table (app/src/config/performance.json) and engine (computePerformance), with the committed BENCH_RET. There is no
// owner-signed category-to-benchmark table for every category, so the expected answers are the live page's own rules
// (07_engine.js PERF_GROUPS and benchmarkFor) with the owner's recorded decisions on top:
//   - OD-7: no benchmark named for balanced advantage, dynamic asset allocation, multi-asset and equity savings;
//     arbitrage against Nifty 50 Arbitrage;
//   - Q-45: each Diversified category with its own benchmark row.
// The debt names also cover the spellings the whole-word patterns had lost (Floater, Ultrashort, Gsec, Banking PSU).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import { benchKey, computePerformance } from '../../../app/src/engine/returns/performance.ts';
import { FILE_BLOCK_TEXT } from '../../helpers/node-wiring.ts';
import { performanceSourcesFrom } from '../../../app/src/data/performance-sources.ts';

const SRC = performanceSourcesFrom({ blocks: {}, dates: {} }, FILE_BLOCK_TEXT);
const N100 = 'Nifty 100 - TRI', N500 = 'Nifty 500 - TRI', LM250 = 'Nifty LargeMidcap 250 - TRI', MC150 = 'Nifty Midcap 150 - TRI';
const SC250 = 'Nifty Smallcap 250 - TRI', MULTI = 'Nifty 500 Multicap 50:25:25 - TRI', N50 = 'Nifty 50 - TRI';
const LIQ = 'CRISIL Liquid Debt Index', STB = 'CRISIL Short Term Bond Index', COMP = 'CRISIL Composite Bond Index', GILT = 'CRISIL 10 Year Gilt Index';
const CONS = 'CRISIL Hybrid 85+15 - Conservative Index', AGGR = 'CRISIL Hybrid 35+65 - Aggressive Index', ARB = 'Nifty 50 Arbitrage';

/** [asset class, category, expected benchmark names (empty: none named)] */
const TABLE: Array<[Holding['assetClass'], string, string[]]> = [
  // equity (SEBI equity categories and index funds)
  ['Equity', 'Large Cap Fund', [N100]], ['Equity', 'Large & Mid Cap Fund', [LM250]], ['Equity', 'Mid Cap Fund', [MC150]],
  ['Equity', 'Small Cap Fund', [SC250]], ['Equity', 'Multi Cap Fund', [MULTI]], ['Equity', 'Flexi Cap Fund', [N500]],
  ['Equity', 'Focused Fund', [N500]], ['Equity', 'ELSS', [N500]], ['Equity', 'Dividend Yield Fund', [N500]],
  ['Equity', 'Value Fund', [N500]], ['Equity', 'Contra Fund', [N500]], ['Equity', 'Sectoral/Thematic', [N500]],
  ['Equity', 'Index Funds', [N50]],
  // hybrid (the 7 SEBI hybrid categories)
  ['Hybrid', 'Conservative Hybrid Fund', [CONS]], ['Hybrid', 'Balanced Hybrid Fund', [AGGR]], ['Hybrid', 'Aggressive Hybrid Fund', [AGGR]],
  ['Hybrid', 'Dynamic Asset Allocation or Balanced Advantage', []], ['Hybrid', 'Multi Asset Allocation', []],
  ['Hybrid', 'Arbitrage Fund', [ARB]], ['Hybrid', 'Equity Savings', []],
  // debt (the 16 SEBI debt categories)
  ['Debt', 'Overnight Fund', [LIQ]], ['Debt', 'Liquid Fund', [LIQ]], ['Debt', 'Ultra Short Duration Fund', [LIQ]],
  ['Debt', 'Low Duration Fund', [STB]], ['Debt', 'Money Market Fund', [LIQ]], ['Debt', 'Short Duration Fund', [STB]],
  ['Debt', 'Medium Duration Fund', [COMP]], ['Debt', 'Medium to Long Duration Fund', [COMP]], ['Debt', 'Long Duration Fund', [COMP]],
  ['Debt', 'Dynamic Bond', [COMP]], ['Debt', 'Corporate Bond Fund', [STB]], ['Debt', 'Credit Risk Fund', [STB]],
  ['Debt', 'Banking and PSU Fund', [STB]], ['Debt', 'Gilt Fund', [GILT]], ['Debt', 'Gilt Fund with 10 year constant duration', [GILT]],
  ['Debt', 'Floater Fund', [STB]],
  // the spellings the review named (the legacy answers kept)
  ['Debt', 'Ultrashort', [LIQ]], ['Debt', 'Gsec', [GILT]], ['Debt', 'Banking PSU', [STB]], ['Debt', 'Floating Rate', [STB]],
];

test('every SEBI category gets the benchmark the table names (legacy rules with OD-7 and Q-45)', () => {
  let n = 0;
  const holdings = TABLE.map(([asset, category]) => ({
    id: `h${++n}`, instrumentName: `Synthetic ${category} Fund`, product: 'Mutual Funds', assetClass: asset, categoryLabel: category,
    inclusion: { status: 'included' }, cmv: { kind: 'value', v: 1, unit: 'cr', prov: { sources: [], method: 't' } }, instrument: null,
  }) as unknown as Holding);
  const res = computePerformance(holdings, SRC);
  const groups = res.regular.flatMap((b) => b.groups);
  const bad: string[] = [];
  for (const [, category, want] of TABLE) {
    /* Equity groups carry the brief's group labels: find the group by its category's holding */
    const g = groups.find((x) => x.funds.some((f) => f.name === `Synthetic ${category} Fund`))!;
    const got = [...g.benchmarks.map((b) => b.name), ...g.missingBenchmarks].map(benchKey);
    const own = want.map(benchKey);
    /* a Diversified group shows the union of its held categories' rows; each category's own row must be in it */
    const ok = own.length === 0 ? g.noBenchmarkNamed : own.every((k) => got.includes(k)) && (g.label === 'Diversified Funds' || got.length === own.length);
    if (!ok) bad.push(`${category}: want ${JSON.stringify(want)} got ${JSON.stringify(got)} (${g.label}; ${g.noBenchmarkReason})`);
  }
  assert.deepEqual(bad, []);
});
