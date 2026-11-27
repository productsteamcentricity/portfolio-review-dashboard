// covers: U-25 U-58 E-142 (returns per scope of a review, M3a wiring, NB-03; PLAN-04 option B)
// returnsForReview over the synthetic base book (tests/fixtures/make-books.ts SYNTHETIC_BOOK, syn-standard) and the
// synthetic IRR files (tests/fixtures/make-irr-files.ts): the scopes listed in order (family, each client, each
// distributor), each one equal to computeScopeReturns for that scope, the adviser list left out when the file has no
// DISTRIBUTOR column, the analyst's client label used, and a pure function of its inputs; with irr-matched (the base
// book's distributor names) the adviser scopes hold their own flows, against values worked by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import type { Value } from '../../../app/src/model/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { computeScopeReturns } from '../../../app/src/engine/returns/scope.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { irrFixtures } from '../../fixtures/make-irr-files.ts';
import { baseClientsWithoutRowsOf } from '../../../app/src/engine/returns/review-returns.ts';
import { baseClientsWithoutRowsText } from '../../../app/src/views/returns.ts';
import { BENCH_HEADER, dateCell, FUND_HEADER, fundRow, toWorkbook } from '../../fixtures/make-irr-files.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const w = nodeWiring();
const run = reviewOf(w, fixtureById('syn-standard'));
const files = new Map(irrFixtures().map((f) => [f.id, f] as const));
function irrOf(id: string): IrrFileImport {
  const l = w.loadIrrFile!(files.get(id)!.bytes, `${id}.xlsx`);
  if (!('irr' in l)) throw new Error(`${id}: ${l.kind}`);
  return l.irr;
}

describe('returnsForReview', () => {
  const irr = irrOf('irr-standard');
  const r = returnsForReview(run.review, irr);

  test('scopes in order: the family, each client of the review, each distributor of the review', () => {
    const expected = ['family', ...run.review.clients.map((c) => `client:${c.id}`), ...run.review.distributors.map((d) => `advisor:${d.id}`)];
    assert.deepEqual(r.scopes.map((s) => s.key), expected);
    assert.deepEqual(r.scopes.map((s) => s.label), ['Family', 'Sample Client A', 'Sample Client B', ...run.review.distributors.map((d) => d.label)]);
    assert.equal(r.advisorScopes, 'listed');
    assert.equal(r.sourceId, irr.sourceId);
  });

  test('each scope equals computeScopeReturns for it, with the default join', () => {
    for (const s of r.scopes) assert.deepEqual(s.result, computeScopeReturns(s.scope, irr, run.review.holdings), s.key);
    const family = r.scopes[0]!.result;
    assert.equal(family.fund.xirr.kind, 'value', 'the family has a fund XIRR');
    assert.equal(family.bench.xirr.kind, 'value', 'the family has a benchmark XIRR');
    assert.ok(family.unassigned !== null, 'the family has the unassigned line (the file has a DISTRIBUTOR column)');
  });

  test('without a DISTRIBUTOR column the adviser list is left out, and the family has no unassigned line', () => {
    const r2 = returnsForReview(run.review, irrOf('irr-by-content'));
    assert.equal(r2.advisorScopes, 'no-distributor-column');
    assert.ok(r2.scopes.every((s) => s.scope.kind !== 'advisor'));
    assert.equal(r2.scopes.length, 1 + run.review.clients.length);
    assert.equal(r2.scopes[0]!.result.unassigned, null);
  });

  test("a client scope and the tree carry the analyst's client label", () => {
    const a = run.review.clients[0]!;
    const labelled = reviewOf(w, fixtureById('syn-standard'), { labels: { family: 'Sample Family', clients: { [a.id]: 'Client One' } } });
    const r3 = returnsForReview(labelled.review, irr);
    const scope = r3.scopes.find((s) => s.key === `client:${a.id}`)!;
    assert.equal(scope.label, 'Client One');
    assert.ok(scope.result.tree.some((n) => n.level === 'client' && n.label === 'Client One'));
  });

  test('pure: the same inputs give the same output, and the inputs are not changed', () => {
    const before = JSON.stringify(irr);
    const holdings = JSON.stringify(run.review.holdings);
    assert.deepEqual(returnsForReview(run.review, irr), r);
    assert.equal(JSON.stringify(irr), before);
    assert.equal(JSON.stringify(run.review.holdings), holdings);
  });
});

// Gap 1 (NB-03): irr-matched carries the base book's distributor names, so the adviser scopes hold flows. Expected values
// worked by hand from the flows of make-irr-files.ts standardSheets and the holdings of make-books.ts SYNTHETIC_BOOK
// (never copied from the code's output):
//  Centricity (base-book holdings: A Bluechip, A Flexi Cap, B Balanced Advantage, B Gold ETF FoF). The IRR file's only
//    instrument wholly under Centricity is A's Bluechip: -10,000 on 1 Apr 2023 (day 0), -5,000 on 1 Apr 2024 (day 366:
//    29 Feb 2024 lies between), +17,000 on 31 Mar 2025 (day 730). With x = 1 + r, valued at the last day:
//    10,000 x^(730/365) + 5,000 x^(364/365) = 17,000. At r = 7.76%: 11,612.2 + 5,386.9 = 16,999.1 (short by 0.9); the
//    slope is about 26,500 a unit of r, so r = 7.7600% + 0.9 / 26,500 = 7.7634%, shown "7.76%". Benchmark (Sample Index 1,
//    the same days): 10,000 x^2 + 5,000 x^(364/365) = 16,500; at r = 5.87%: 11,208.5 + 5,292.7 = 16,501.1 (over by 1.1),
//    so r = 5.8700% - 1.1 / 26,200 = 5.8658%, shown "5.87%". Flows: 3. Tree: portfolio, Sample Client A, Equity, Mutual
//    Funds, the Bluechip instrument (5 nodes). Holdings without flows: Flexi Cap and Gold ETF FoF (no instrument of the
//    file is named like them); B's Balanced Advantage has flows (its instrument, though without a distributor, joins it).
//  Other Distributor (holdings: A Corporate Bond, B Value Strategy PMS). Only A's Corporate Bond: -20,000 on 15 Jun 2023,
//    +22,000 on 15 Jun 2024, 366 days apart, so (1 + r)^(366/365) = 1.1 and r = 1.1^(365/366) - 1 = 9.9714%. No
//    benchmark flow for the Bond: the benchmark XIRR is missing. Without flows: the PMS.
//  Contributions over Centricity's holdings (market value in Crore: 0.625, 0.452, 0.339, 0.131; total 1.547):
//    Bluechip 40.4008% x 7.7634% (its transaction XIRR, not the base file's 14.25) = 3.1365 pp; Flexi Cap 29.2178% x
//    11.8 (base file, no flow) = 3.4477 pp; Balanced Advantage 21.9134% x 10% (-8,000 on 1 Jan 2024, +8,800 on 31 Dec
//    2024, 365 days: exactly 10%, not the base file's 10.5) = 2.1913 pp; Gold 8.4680% x 18.4 = 1.5581 pp.
//  The unassigned line (family-wide, on both adviser scopes): money paid in without a distributor 8,000 (B's Balanced)
//    over the family's 10,000 + 5,000 + 20,000 + 8,000 = 43,000, so 18.6047%.
describe('irr-matched: non-empty adviser scopes (gap 1)', () => {
  const m = returnsForReview(run.review, irrOf('irr-matched'));
  const name = new Map(run.review.holdings.map((h) => [h.id, h.instrumentName] as const));
  const adviser = (label: string) => {
    const s = m.scopes.find((x) => x.scope.kind === 'advisor' && x.label === label);
    assert.ok(s, `adviser scope ${label}`);
    return s.result;
  };
  const num = (x: Value<number>, what: string): number => {
    assert.equal(x.kind, 'value', `${what}: ${x.kind === 'missing' ? x.reason : ''}`);
    return (x as Extract<Value<number>, { kind: 'value' }>).v;
  };
  // Net present value at the last day of the hand-worked flows (day offsets as above), for a rate r as a fraction.
  const npvAtEnd = (flows: ReadonlyArray<readonly [number, number]>, r: number): number => {
    const last = flows[flows.length - 1]![0];
    return flows.reduce((s, [day, amount]) => s + amount * (1 + r) ** ((last - day) / 365), 0);
  };
  const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
  const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';

  test('both advisers of the base book are listed, after the family and the clients', () => {
    assert.equal(m.advisorScopes, 'listed');
    assert.deepEqual(m.scopes.map((s) => s.label), ['Family', 'Sample Client A', 'Sample Client B', 'Centricity', 'Other Distributor']);
  });

  test('Centricity: fund XIRR 7.7634% and benchmark 5.8658% over A\'s Bluechip, three flows', () => {
    const c = adviser('Centricity');
    assert.equal(c.reconciliation.reconciled, true);
    const fund = num(c.fund.xirr, 'fund');
    assert.ok(Math.abs(fund - 7.7634) < 0.0005, `fund ${fund}`);
    assert.ok(Math.abs(npvAtEnd([[0, -10000], [366, -5000], [730, 17000]], fund / 100)) < 0.01, 'the rate solves the hand-worked equation');
    const bench = num(c.bench.xirr, 'bench');
    assert.ok(Math.abs(bench - 5.8658) < 0.0005, `bench ${bench}`);
    assert.ok(Math.abs(npvAtEnd([[0, -10000], [366, -5000], [730, 16500]], bench / 100)) < 0.01);
    assert.equal(c.fund.flows, 3);
  });

  test('Centricity: its tree holds its instrument only; Flexi Cap and Gold ETF FoF are its holdings without flows', () => {
    const c = adviser('Centricity');
    assert.deepEqual(c.tree.map((n) => `${n.level}:${n.label}`),
      ['portfolio:Total Portfolio', 'client:Sample Client A', 'asset:Equity', 'product:Mutual Funds', `instrument:${BLUE}`]);
    const leaf = c.tree.find((n) => n.level === 'instrument')!;
    assert.deepEqual(leaf.holdingIds.map((id) => name.get(id)), [BLUE]);
    assert.equal(leaf.redeemed, false);
    assert.deepEqual(c.reconciliation.holdingsWithoutFlows.map((id) => name.get(id)),
      ['Sample Flexi Cap Fund - Regular Plan - Growth', 'Sample Gold ETF Fund of Fund - Growth']);
  });

  test('Centricity: contributions take the transaction XIRR of a holding with flows, the base file\'s XIRR otherwise', () => {
    const rows = adviser('Centricity').contributions.rows;
    const row = (prefix: string) => {
      const r = rows.find((x) => x.label.startsWith(prefix));
      assert.ok(r, prefix);
      return r;
    };
    const expected: Array<[string, number, number, number]> = [
      // label, allocation %, XIRR %, contribution pp (hand-worked above)
      ['Sample Flexi Cap', 29.2178, 11.8, 3.4477],
      ['Sample Bluechip', 40.4008, 7.7634, 3.1365],
      ['Sample Balanced Advantage', 21.9134, 10, 2.1913],
      ['Sample Gold ETF', 8.4680, 18.4, 1.5581],
    ];
    assert.deepEqual(rows.map((r) => expected.findIndex(([p]) => r.label.startsWith(p))), [0, 1, 2, 3], 'largest contribution first');
    for (const [prefix, alloc, x, pp] of expected) {
      const r = row(prefix);
      assert.ok(Math.abs(num(r.allocationPct, prefix) - alloc) < 0.0005, `${prefix} allocation`);
      assert.ok(Math.abs(num(r.xirr, prefix) - x) < 0.0005, `${prefix} XIRR ${num(r.xirr, prefix)}`);
      assert.ok(Math.abs(num(r.contributionPp, prefix) - pp) < 0.0005, `${prefix} contribution`);
    }
  });

  test('Other Distributor: fund XIRR 1.1^(365/366) - 1 over A\'s Corporate Bond, no benchmark, the PMS without flows', () => {
    const o = adviser('Other Distributor');
    assert.ok(Math.abs(num(o.fund.xirr, 'fund') - (1.1 ** (365 / 366) - 1) * 100) < 1e-6, 'fund');
    assert.equal(o.bench.xirr.kind, 'missing');
    assert.equal(o.bench.gap, 'no-benchmark');
    assert.equal(o.fund.flows, 2);
    assert.deepEqual(o.tree.filter((n) => n.level === 'instrument').map((n) => n.label), [BOND]);
    assert.deepEqual(o.reconciliation.holdingsWithoutFlows.map((id) => name.get(id)), ['Sample Value Strategy PMS']);
  });

  test('the unassigned line on both adviser scopes: 8,000 of the family\'s 43,000 paid in (18.6047%)', () => {
    for (const label of ['Centricity', 'Other Distributor']) {
      const u = adviser(label).unassigned;
      assert.ok(u !== null, label);
      assert.equal(u.flows, 2);
      assert.equal(u.instruments, 1);
      assert.ok(Math.abs(num(u.sharePct, label) - (8000 / 43000) * 100) < 1e-9, label);
    }
  });
});

// MOD-04's answers to Gate B, computed in the engine (R2 and R3), on irr-matched (the standard flows):
//  R2, benchmark coverage over each scope tree's instruments with fund flows. Benchmark flows exist for A's Bluechip and
//    B's Balanced, none for A's Corporate Bond. Family: 2 of 3 covered (partial); money paid in, Bluechip 10,000 + 5,000
//    and Balanced 8,000 = 23,000 of 43,000. Centricity: Bluechip, 1 of 1 (full). Other Distributor: Bond, 0 of 1 (none).
//  R3, the file's fund flows fall on 1 Apr 2023, 15 Jun 2023, 1 Jan 2024, 1 Apr 2024, 15 Jun 2024, 31 Dec 2024 and
//    31 Mar 2025 (the last). As on 30 Sep 2026: none after. As on 31 Mar 2025: equal, none after. As on 1 Jan 2024: the
//    four flows after it (1 Apr 2024, 15 Jun 2024, 31 Dec 2024, 31 Mar 2025); the one on 1 Jan 2024 is not after it.
describe('benchmark coverage (R2) and dates (R3)', () => {
  const irr = irrOf('irr-matched');
  const m = returnsForReview(run.review, irr);
  const byLabel = (label: string) => m.scopes.find((s) => s.label === label)!;

  test('partial: the family covers 2 of its 3 instruments, 23,000 of the 43,000 paid in', () => {
    const c = byLabel('Family').benchCoverage;
    assert.deepEqual({ ...c, share: undefined }, { share: undefined, basis: 'flows-in', included: 2, excluded: 1 });
    assert.ok(Math.abs(c.share - 23000 / 43000) < 1e-12, String(c.share));
  });

  test('full: Centricity covers its one instrument; none: Other Distributor\'s one instrument has no benchmark flow', () => {
    assert.deepEqual(byLabel('Centricity').benchCoverage, { share: 1, basis: 'flows-in', included: 1, excluded: 0 });
    assert.deepEqual(byLabel('Other Distributor').benchCoverage, { share: 0, basis: 'flows-in', included: 0, excluded: 1 });
  });

  test('dates: different (as on 30 Sep 2026), equal (as on 31 Mar 2025), flows after (as on 1 Jan 2024), not set', () => {
    const last = ymdToDay(2025, 3, 31)!;
    assert.deepEqual(m.dates, { lastFlowDay: last, asOnDay: ymdToDay(2026, 9, 30), flowsAfterAsOn: 0 });
    const equal = returnsForReview(reviewOf(w, fixtureById('syn-standard'), { asOn: last }).review, irr);
    assert.deepEqual(equal.dates, { lastFlowDay: last, asOnDay: last, flowsAfterAsOn: 0 });
    const early = ymdToDay(2024, 1, 1)!;
    const after = returnsForReview(reviewOf(w, fixtureById('syn-standard'), { asOn: early }).review, irr);
    assert.deepEqual(after.dates, { lastFlowDay: last, asOnDay: early, flowsAfterAsOn: 4 });
    const unset = returnsForReview(reviewOf(w, fixtureById('syn-standard'), { asOn: null }).review, irr);
    assert.deepEqual(unset.dates, { lastFlowDay: last, asOnDay: null, flowsAfterAsOn: null });
  });

  test('Gate B of 5bb0071, B1: an IRR-only client\'s flow after the as-on date sets neither the last date nor the count', () => {
    // A client with no holding in the base file is left out of every figure (OD-4), so its flow on 10 Oct 2026 in a
    // review as on 30 Sep 2026 must not appear in the dates, and the family XIRR is unchanged.
    const t0 = irr.fund[0]!;
    const outsider = { ...t0, clientId: 'cl_not_in_base' as typeof t0.clientId, clientLabel: 'Sample Client Z', day: ymdToDay(2026, 10, 10)!, amountRupees: 500 };
    const withOutsider = { ...irr, fund: [...irr.fund, outsider] } as IrrFileImport;
    const r = returnsForReview(run.review, withOutsider);
    assert.deepEqual(r.dates, m.dates);
    assert.deepEqual(byLabel('Family').result.fund, r.scopes.find((s) => s.label === 'Family')!.result.fund);
  });

  test('Gate B of 5bb0071, B1: a flow after the as-on date on an instrument with an invalid benchmark is counted as a flow of the review\'s clients', () => {
    // Client A's Bond gets benchmark flows that all fall on one day, so they give no rate (OD-4: invalid benchmark,
    // out of the scope aggregates). Its fund flows are still flows of the review's clients, so the date count includes
    // its late flow; the note claims nothing about which figures a flow enters.
    const bond = irr.fund.find((t) => /Bond/.test(t.instrumentName ?? ''))!;
    const late = { ...bond, day: ymdToDay(2026, 10, 10)!, amountRupees: 100 };
    const sameDayBench = [{ ...irr.bench[0]!, instrumentName: bond.instrumentName, clientId: bond.clientId, day: bond.day, amountRupees: -1000 },
      { ...irr.bench[0]!, instrumentName: bond.instrumentName, clientId: bond.clientId, day: bond.day, amountRupees: 1000 }];
    const invalid = { ...irr, fund: [...irr.fund, late], bench: [...irr.bench, ...sameDayBench] } as IrrFileImport;
    const r = returnsForReview(run.review, invalid);
    assert.ok(r.scopes[0]!.result.reconciliation.invalidBenchmark.some((x) => /Bond/.test(x.instrumentName)), 'the Bond benchmark is invalid');
    assert.deepEqual(r.dates, { lastFlowDay: ymdToDay(2026, 10, 10), asOnDay: ymdToDay(2026, 9, 30), flowsAfterAsOn: 1 });
  });

  test('no figure changes with the as-on date (exclusion is an owner question)', () => {
    const after = returnsForReview(reviewOf(w, fixtureById('syn-standard'), { asOn: ymdToDay(2024, 1, 1)! }).review, irr);
    assert.deepEqual(after.scopes.map((s) => s.result.fund.xirr), m.scopes.map((s) => s.result.fund.xirr));
  });
});

// PLAN-05, the names rule on screen (the owner's rule of 26 Nov 2026: the two files are joined on the exact client
// name). A synthetic file where client B is spelt "Sample Clint B": B of the base file has no row in it, and the
// misspelt name is an IRR-only client (OD-4). Never joined by similarity.
function misspeltIrr(benchOnlyForB = false): IrrFileImport {
  const A = 'Sample Client A';
  const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
  const BAL = 'Sample Balanced Advantage Fund - Regular Plan - Growth';
  const bytes = toWorkbook(loadSheetJS(), [
    { name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, 'Centricity'),
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 12000, 'Centricity'),
      fundRow('Sample Clint B', BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), 'Purchase', null, 40, -8000, null),
      fundRow('Sample Clint B', BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 12, 31), null, 'Closing', null, 8800, null),
    ] },
    { name: 'SI Bmxirr', rows: [BENCH_HEADER,
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2023, 4, 1), 'Sample Index 1', -10000],
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2025, 3, 31), 'Sample Index 1', 11500],
      ...(benchOnlyForB ? [['Sample Client B', BAL, 'Hybrid', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 2', -8000]] : []),
    ] },
  ]);
  const l = w.loadIrrFile!(bytes, 'misspelt.xlsx');
  if (!('irr' in l)) throw new Error(l.kind);
  return l.irr;
}

describe('base-file clients with no rows in the transactions file (PLAN-05)', () => {
  const [a, b] = run.review.clients;

  test('none when every base-file client has rows (irr-standard)', () => {
    assert.deepEqual(returnsForReview(run.review, irrOf('irr-standard')).baseClientsWithoutRows, []);
  });

  test('a client spelt differently: the base-file client is listed by its base-file name, the other spelling is IRR-only', () => {
    const r = returnsForReview(run.review, misspeltIrr());
    assert.equal(a!.label, 'Sample Client A');
    assert.deepEqual(r.baseClientsWithoutRows, [{ clientId: b!.id, clientLabel: 'Sample Client B' }]);
    assert.deepEqual(r.scopes[0]!.result.reconciliation.irrOnlyClients, [{ clientLabel: 'Sample Clint B', flows: 2 }]);
  });

  test('named as the base file spells them, whatever the analyst\'s display label', () => {
    const labelled = reviewOf(w, fixtureById('syn-standard'), { labels: { family: 'Sample Family', clients: { [b!.id]: 'Client Two' } } });
    assert.deepEqual(returnsForReview(labelled.review, misspeltIrr()).baseClientsWithoutRows, [{ clientId: b!.id, clientLabel: 'Sample Client B' }]);
  });

  // Gate B of d6401f6, F9 (MOD-05: count fund rows only, the note says "no fund rows"). Before, a row on either sheet
  // counted, so B with one benchmark row and no fund row was in neither list (expected [] then; that was the finding).
  test('fund rows only: a client with benchmark rows only is listed (it has no XIRR), and is not IRR-only', () => {
    const irr = misspeltIrr(true);
    assert.ok(irr.bench.some((t) => t.clientLabel === 'Sample Client B') && !irr.fund.some((t) => t.clientLabel === 'Sample Client B'), 'B: benchmark rows only');
    assert.deepEqual(baseClientsWithoutRowsOf(run.review.clients, irr), [{ clientId: b!.id, clientLabel: 'Sample Client B' }]);
    const r = returnsForReview(run.review, irr);
    assert.deepEqual(r.baseClientsWithoutRows, [{ clientId: b!.id, clientLabel: 'Sample Client B' }]);
    assert.ok(!r.scopes[0]!.result.reconciliation.irrOnlyClients.some((c) => c.clientLabel === 'Sample Client B'));
    assert.match(baseClientsWithoutRowsText(r.baseClientsWithoutRows)!, /^Clients of the base file with no fund rows in the transactions file: Sample Client B;/);
  });

  test('in review order, and pure', () => {
    const irr = misspeltIrr();
    const none = { ...irr, fund: [], bench: [] };
    assert.deepEqual(baseClientsWithoutRowsOf(run.review.clients, none).map((c) => c.clientId), run.review.clients.map((c) => c.id));
    const before = JSON.stringify(irr);
    assert.deepEqual(baseClientsWithoutRowsOf(run.review.clients, irr), baseClientsWithoutRowsOf(run.review.clients, irr));
    assert.equal(JSON.stringify(irr), before);
  });
});
