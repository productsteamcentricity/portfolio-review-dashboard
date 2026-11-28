// covers: E-147 E-84 U-41 D-023 KI-006 M3
// E-147 in the performance tables (app/src/engine/returns/performance.ts weightedRows, through NB-04's
// portfolio-returns.ts weightedFundReturn): the weighted average return of current holdings over the mutual funds, the
// family then each client; section 5's table and notes (views/performance.ts) and the Performance sheet's Weighted rows.
// Known answers (D-023 point 3, the engine's own): funds at 5, 3 and 2 Crore with 3Y returns 14%, 6% and none give
// (5 x 14 + 3 x 6) / 8 = 11.00% at 80% coverage, never 8.80%; 5Y 10%, 8% and 4% give (50 + 24 + 8) / 10 = 8.20% at 100%.
// The sources' order (fundReturnSourcesFrom): the uploaded MF Monitor first, then the embedded one.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { DayNumber, Value } from '../../../app/src/model/value.ts';
import type { PerformanceSources, PerfRecord } from '../../../app/src/engine/returns/performance.ts';
import type { FundReturnSource } from '../../../app/src/engine/returns/portfolio-returns.ts';
import { computePerformance } from '../../../app/src/engine/returns/performance.ts';
import { buildPerformanceVM } from '../../../app/src/views/performance.ts';
import { performanceSheet } from '../../../app/src/exports/xlsx/sheets/performance.ts';
import { parseProductClassRules } from '../../../app/src/engine/match/product-class.ts';
import { fundReturnSourcesFrom } from '../../../app/src/data/performance-sources.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { dayToExcelSerial } from '../../../app/src/engine/dates.ts';
import { missing } from '../../../app/src/engine/value.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';
import { FILE_BLOCK_TEXT } from '../../helpers/node-wiring.ts';

const day = (d: number): Value<DayNumber> => ({ kind: 'value', v: d as DayNumber, unit: 'date', prov: { sources: [], method: 't' } });
const OCT31 = 20757; // 31 Oct 2026
let n = 0;
function h(name: string, cmv: number, client: string, key?: string, product = 'Mutual Funds'): Holding {
  n += 1;
  return {
    id: `h${n}`, instrumentName: name, product, assetClass: 'Equity', categoryLabel: 'Flexi Cap Fund', inclusion: { status: 'included' },
    clientId: client, clientLabel: client === 'c1' ? 'Sample Client One' : 'Sample Client Two',
    cmv: { kind: 'value', v: cmv, unit: 'cr', prov: { sources: [], method: 't' } },
    instrument: key ? { productClass: 'MF', nameKey: name, vendorKey: key, resolution: { method: 'name-match', confidence: 'exact' } } : null,
  } as unknown as Holding;
}
const rec = (r: Record<string, number | null>): PerfRecord => ({ aum: 100, inception: '2015-01-01', r });
const MF: Record<string, PerfRecord> = {
  'K1 Fund-Reg(G)': rec({ '3Y': 14, '5Y': 10 }), 'K2 Fund-Reg(G)': rec({ '3Y': 6, '5Y': 8 }), 'K3 Fund-Reg(G)': rec({ '3Y': null, '5Y': 4 }),
};
const SRC: PerformanceSources = {
  MF, MF_DIRECT: null, PMS: null, AIF: null, SIF: null, STOCK: null, BENCH: null,
  asOn: { MF: day(OCT31) }, rules: parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES')),
};
const FUNDS: FundReturnSource[] = [{ source: 'embedded-mf-monitor', plans: { regular: { asOn: day(OCT31), funds: MF } } }];
const H = [
  h('K1 Fund', 5, 'c1', 'K1 Fund-Reg(G)'), h('K2 Fund', 3, 'c1', 'K2 Fund-Reg(G)'), h('K3 Fund', 2, 'c2', 'K3 Fund-Reg(G)'),
  h('A Portfolio PMS', 7, 'c2', undefined, 'PMS'),
];
const res = computePerformance(H, SRC, { fundSources: FUNDS });
const fig = (i: number, t: '3y' | '5y') => res.weighted![i]!.byTenor[t].figure!;
const pct = (v: Value<number>): number => (v.kind === 'value' ? v.v : NaN);

describe('E-147 in computePerformance', () => {
  test('the family: 3Y (5 x 14 + 3 x 6) / 8 = 11.00% at 80% coverage of the MF value (never 8.80%); 5Y 8.20% complete', () => {
    assert.equal(res.weighted!.length, 3);
    assert.equal(res.weighted![0]!.scope, 'family');
    assert.ok(Math.abs(pct(fig(0, '3y').value) - 11) < 1e-9);
    assert.ok(fig(0, '3y').value.kind === 'value' && Math.abs(fig(0, '3y').value.coverage! - 0.8) < 1e-12);
    assert.equal(fig(0, '3y').coverage.basis, 'mf-value');
    assert.ok(Math.abs(pct(fig(0, '5y').value) - 8.2) < 1e-9);
    assert.ok(fig(0, '5y').value.kind === 'value' && fig(0, '5y').value.coverage === undefined);
  });

  test('the PMS is not a mutual fund: it is in no weight and in no coverage', () => {
    assert.ok(res.weighted![0]!.byTenor['3y'].items.every((x) => x.holdingId !== 'h4'));
    assert.equal(res.weighted![0]!.byTenor['3y'].items.length, 3);
  });

  test('each client: client one (5 x 14 + 3 x 6) / 8 = 11.00% complete; client two no 3Y (a dash with its status), 5Y 4.00%', () => {
    assert.deepEqual(res.weighted!.map((r) => r.scope), ['family', 'client:c1', 'client:c2']);
    assert.ok(Math.abs(pct(fig(1, '3y').value) - 11) < 1e-9);
    assert.ok(fig(1, '3y').value.kind === 'value' && fig(1, '3y').value.coverage === undefined);
    assert.equal(fig(2, '3y').value.kind, 'missing');
    assert.equal(pct(fig(2, '5y').value), 4);
  });

  test('without fund-return sources there are no weighted figures (null); with no mutual fund, an empty list', () => {
    assert.equal(computePerformance(H, SRC).weighted, null);
    assert.deepEqual(computePerformance([H[3]!], SRC, { fundSources: FUNDS }).weighted, []);
  });
});

describe('E-147 on screen and in the sheet', () => {
  const vm = buildPerformanceVM(res, 'regular', { clientLabels: { c1: 'Analyst One' } });
  const w = vm.weighted!;

  test('the table: the label, 3Y and 5Y, the family then each client by the analyst\'s label; the partial marker on 11.00%', () => {
    assert.equal(w.title, 'Weighted average return of current holdings (mutual funds)');
    assert.deepEqual(w.cols, ['3Y', '5Y']);
    assert.deepEqual(w.rows.map((r) => r.name), ['Family', 'Analyst One', 'Sample Client Two']);
    assert.deepEqual(w.rows[0]!.cells.map((c) => c.text), ['11.00%', '8.20%']);
    assert.equal(w.rows[0]!.cells[0]!.marker, 'p');
    assert.equal(w.rows[0]!.cells[1]!.marker, null);
    assert.doesNotMatch(w.rows[2]!.cells[0]!.text, /[0-9]/);
  });

  test('one coverage footnote per figure (every rendering carries it), and the marker\'s legend', () => {
    assert.equal(w.notes[0], 'Family, 3Y: weighted average return of current holdings. 3Y covers 80.0% of MF value; 1 fund without a 3Y return excluded. Source: MF Monitor (embedded monthly data), Regular plans, as on 31 Oct 2026.');
    assert.equal(w.notes[1], 'Family, 5Y: weighted average return of current holdings. Source: MF Monitor (embedded monthly data), Regular plans, as on 31 Oct 2026.');
    assert.equal(w.notes.length, 7);
    assert.equal(w.notes[6], 'A figure marked p covers only part of the mutual-fund value; its note gives the share and what was left out.');
  });

  test('a figure with no source at all is the dash with "no source"', () => {
    const none = buildPerformanceVM(computePerformance(H, SRC, { fundSources: [] }), 'regular').weighted!;
    assert.doesNotMatch(none.rows[0]!.cells[0]!.text, /[0-9]/);
    assert.equal(none.notes[0], 'Family, 3Y: no source of fund returns, so no figure.');
  });

  test('the Performance sheet: one Weighted row per scope with 3Y and 5Y, PARTIAL COVERAGE, the as-on date and both footnotes', () => {
    const sheet = performanceSheet(res, { clientLabels: { c1: 'Analyst One' } });
    const keys = sheet.columns.map((c) => c.key);
    const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
    const rows = sheet.rows.filter((r) => at(r, 'row') === 'Weighted');
    assert.deepEqual(rows.map((r) => at(r, 'group')), ['Family', 'Analyst One', 'Sample Client Two']);
    assert.ok(Math.abs((at(rows[0]!, '3Y') as number) - 11) < 1e-9);
    assert.ok(Math.abs((at(rows[0]!, '5Y') as number) - 8.2) < 1e-9);
    assert.equal(at(rows[0]!, 'status'), STATUS.PARTIAL);
    assert.equal(at(rows[0]!, 'asOn'), dayToExcelSerial(OCT31 as DayNumber), 'both figures are of 31 Oct 2026: the one date');
    assert.equal(at(rows[0]!, 'note'), `${w.notes[0]!.replace(/^Family, /, '')} ${w.notes[1]!.replace(/^Family, /, '')}`);
    assert.equal(at(rows[2]!, '3Y'), null);
    assert.equal(at(rows[2]!, 'status'), STATUS.NOT_AVAILABLE);
  });
});

describe('fundReturnSourcesFrom', () => {
  test('the embedded MF Monitor alone (both plans, VINTAGE dates); an uploaded Regular monitor goes first', () => {
    const embedded = fundReturnSourcesFrom(undefined, FILE_BLOCK_TEXT);
    assert.deepEqual(embedded.map((s) => s.source), ['embedded-mf-monitor']);
    assert.ok(embedded[0]!.plans.regular && embedded[0]!.plans.direct);
    assert.equal(embedded[0]!.plans.regular!.asOn.kind, 'value');
    const up = fundReturnSourcesFrom({ blocks: { MF_PERF: { 'X Fund-Reg(G)': { r: { '3Y': 9 } } } as never }, dates: { MF_PERF: 'As on 02-Nov-2026' } }, FILE_BLOCK_TEXT);
    assert.deepEqual(up.map((s) => s.source), ['uploaded-mf-monitor', 'embedded-mf-monitor']);
    assert.equal(up[0]!.plans.direct, undefined, 'a Regular monitor alone has no Direct table');
    assert.ok(up[0]!.plans.regular!.asOn.kind === 'value' && up[0]!.plans.regular!.asOn.v === OCT31, 'the month-end label (PD-57), not the price day');
  });
});

describe('B1 of the follow-up\'s financial review: a Direct-plan holding is read from its Direct plan, never the Regular figure', () => {
  /* the matcher gives a Direct-plan holding the Regular key (it reads both names alike) */
  const DIR: Record<string, PerfRecord> = { 'K1 Fund(G)-Direct Plan': rec({ '3Y': 15, '5Y': 11 }) };
  const SRC2: PerformanceSources = { ...SRC, MF_DIRECT: DIR, asOn: { MF: day(OCT31), MF_DIRECT: day(OCT31) } };
  const FUNDS2: FundReturnSource[] = [{ source: 'embedded-mf-monitor', plans: { regular: { asOn: day(OCT31), funds: MF }, direct: { asOn: day(OCT31), funds: DIR } } }];
  const D = [
    h('K1 Fund - Direct Plan - Growth', 5, 'c1', 'K1 Fund-Reg(G)'),
    h('K2 Fund - Direct Plan - Growth', 3, 'c1', 'K2 Fund-Reg(G)'), /* no Direct twin in the data */
    h('K3 Fund', 2, 'c1', 'K3 Fund-Reg(G)'),
  ];
  const r = computePerformance(D, SRC2, { fundSources: FUNDS2 }).weighted![0]!;

  test('K1 Direct at its Direct 3Y 15% (never the Regular 14%); K2 Direct with no twin excluded and counted; K3 Regular has no 3Y', () => {
    const items = r.byTenor['3y'].items;
    assert.deepEqual(items.map((x) => [x.returnPct, x.excluded]), [[15, null], [null, 'plan-mismatch'], [null, 'no-return']]);
    const f = r.byTenor['3y'].figure!;
    assert.ok(Math.abs(pct(f.value) - 15) < 1e-9);
    assert.ok(f.value.kind === 'value' && Math.abs(f.value.coverage! - 0.5) < 1e-12);
  });

  test('5Y: (5 x 11 + 2 x 4) / 7 = 9.00% at 70%; the footnote counts the Direct holding with no twin and names the Direct table', () => {
    assert.ok(Math.abs(pct(r.byTenor['5y'].figure!.value) - 63 / 7) < 1e-9);
    const w = buildPerformanceVM(computePerformance(D, SRC2, { fundSources: FUNDS2 }), 'regular').weighted!;
    assert.equal(w.notes[1], 'Family, 5Y: weighted average return of current holdings. 5Y covers 70.0% of MF value; 1 fund whose plan differs from the account excluded. Source: MF Monitor (embedded monthly data), Regular plans, as on 31 Oct 2026; MF Monitor (embedded monthly data), Direct plans, as on 31 Oct 2026.');
  });

  test('L2 (Gate B of d93da80): the sheet\'s As On is blank when the 3Y and 5Y figures are of different dates, and the Note says so', () => {
    /* the Direct table is of 30 Sep 2026, the Regular one of 31 Oct 2026. 3Y: only K1 (Direct) has a return, so the
       figure is the Direct table's, 30 Sep. 5Y: K1 (Direct, 30 Sep) and K3 (Regular, 31 Oct); the figure takes the
       date of the first table in the caller's order, the Regular one, 31 Oct. One row, two dates. */
    const SEP30 = OCT31 - 31;
    const FUNDS3: FundReturnSource[] = [{ source: 'embedded-mf-monitor', plans: { regular: { asOn: day(OCT31), funds: MF }, direct: { asOn: day(SEP30), funds: DIR } } }];
    const D3 = [h('K1 Fund - Direct Plan - Growth', 5, 'c1', 'K1 Fund-Reg(G)'), h('K3 Fund', 2, 'c1', 'K3 Fund-Reg(G)')];
    const res3 = computePerformance(D3, { ...SRC2, asOn: { MF: day(OCT31), MF_DIRECT: day(SEP30) } }, { fundSources: FUNDS3 });
    const fam = res3.weighted![0]!;
    const d3 = fam.byTenor['3y'].figure!.asOn;
    const d5 = fam.byTenor['5y'].figure!.asOn;
    assert.ok(d3.kind === 'value' && d3.v === SEP30, JSON.stringify(d3));
    assert.ok(d5.kind === 'value' && d5.v === OCT31, JSON.stringify(d5));
    /* the figures themselves: 3Y 15% over K1 alone; 5Y (5 x 11 + 2 x 4) / 7 = 9.00% */
    assert.ok(Math.abs(pct(fam.byTenor['3y'].figure!.value) - 15) < 1e-9);
    assert.ok(Math.abs(pct(fam.byTenor['5y'].figure!.value) - 63 / 7) < 1e-9);
    const sheet = performanceSheet(res3);
    const keys = sheet.columns.map((c) => c.key);
    const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
    const row = sheet.rows.filter((r) => at(r, 'row') === 'Weighted')[0]!;
    assert.equal(at(row, 'asOn'), null, 'no single date stands for both figures');
    const note = String(at(row, 'note'));
    assert.ok(note.startsWith('The figures of this row do not share one as-on date, so As On is blank; each footnote gives its own. 3Y: '), note);
    assert.match(note, /Direct plans, as on 30 Sep 2026/);
    assert.match(note, /Regular plans, as on 31 Oct 2026/);
  });

  describe('L2, the boundaries of As On', () => {
    const SEP30 = OCT31 - 31;
    const none = missing(STATUS.NOT_AVAILABLE, 'the table states no date') as Value<DayNumber>;
    const D3 = [h('K1 Fund - Direct Plan - Growth', 5, 'c1', 'K1 Fund-Reg(G)'), h('K3 Fund', 2, 'c1', 'K3 Fund-Reg(G)')];
    const SENTENCE = 'The figures of this row do not share one as-on date';
    const family = (holdings: Holding[], regular: Value<DayNumber>, direct: Value<DayNumber>, dir = DIR, mf = MF) => {
      const r = computePerformance(holdings, { ...SRC2, MF: mf, MF_DIRECT: dir, asOn: { MF: regular, MF_DIRECT: direct } },
        { fundSources: [{ source: 'embedded-mf-monitor', plans: { regular: { asOn: regular, funds: mf }, direct: { asOn: direct, funds: dir } } }] });
      const sheet = performanceSheet(r);
      const keys = sheet.columns.map((c) => c.key);
      const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
      const row = sheet.rows.filter((x) => at(x, 'row') === 'Weighted')[0]!;
      return { fam: r.weighted![0]!, asOn: at(row, 'asOn'), y3: at(row, '3Y'), y5: at(row, '5Y'), note: String(at(row, 'note')) };
    };

    test('neither table states a date: As On is blank, and no sentence claims the dates differ', () => {
      const x = family(D3, none, none);
      assert.equal(x.asOn, null);
      assert.ok(!x.note.includes(SENTENCE), x.note);
      assert.ok(Math.abs((x.y3 as number) - 15) < 1e-9 && Math.abs((x.y5 as number) - 63 / 7) < 1e-9, 'the figures are still shown');
    });

    test('one table states no date: the dated figure\'s date does not stand for the row', () => {
      /* 3Y is the Direct table's alone (no date); 5Y takes the Regular table's 31 Oct */
      const x = family(D3, day(OCT31), none);
      assert.equal(x.fam.byTenor['3y'].figure!.asOn.kind, 'missing');
      assert.ok(x.fam.byTenor['5y'].figure!.asOn.kind === 'value');
      assert.equal(x.asOn, null);
      assert.ok(x.note.startsWith(SENTENCE), x.note);
    });

    test('a row with one figure shows that figure\'s date: a blank 3Y brings no date of its own', () => {
      /* no fund has a 3Y return. K1's Direct plan has a 5Y, 11%, from the Direct table of 30 Sep; K9, a Regular
         holding, has neither return in the Regular table of 31 Oct. The 3Y result has no value and is stamped with the
         Regular table's date, which is the date of no figure */
      const DIR5: Record<string, PerfRecord> = { 'K1 Fund(G)-Direct Plan': rec({ '3Y': null, '5Y': 11 }) };
      const MF9 = { ...MF, 'K9 Fund-Reg(G)': rec({ '3Y': null, '5Y': null }) };
      const x = family([h('K1 Fund - Direct Plan - Growth', 5, 'c1', 'K1 Fund-Reg(G)'), h('K9 Fund', 2, 'c1', 'K9 Fund-Reg(G)')], day(OCT31), day(SEP30), DIR5, MF9);
      const d3 = x.fam.byTenor['3y'].figure!;
      assert.ok(d3.value.kind === 'missing' && d3.asOn.kind === 'value' && d3.asOn.v === OCT31, 'the premise: a blank figure carrying another date');
      assert.equal(x.y3, null);
      assert.ok(Math.abs((x.y5 as number) - 11) < 1e-9);
      assert.equal(x.asOn, dayToExcelSerial(SEP30 as DayNumber), 'the 5Y figure\'s own date, 30 Sep 2026');
      assert.ok(!x.note.includes(SENTENCE), x.note);
    });
  });
});

describe('L5 (Gate B of d93da80): mutual-fund holdings with no client are in the Family row and in no client row, and the table says so', () => {
  const NOTE = '1 mutual-fund holding has no client in the base file: it is in the Family row\'s holdings and in no client row\'s.';
  const orphan = { ...h('K2 Fund', 3, 'c1', 'K2 Fund-Reg(G)'), clientId: null, clientLabel: null } as unknown as Holding;
  const r = computePerformance([h('K1 Fund', 5, 'c1', 'K1 Fund-Reg(G)'), orphan], SRC, { fundSources: FUNDS });

  test('the family counts it, (5 x 14 + 3 x 6) / 8 = 11.00%; the one client row is K1 alone, 14.00%; the note gives the count', () => {
    assert.deepEqual(r.weighted!.map((x) => x.clientId), [null, 'c1']);
    assert.ok(Math.abs(pct(r.weighted![0]!.byTenor['3y'].figure!.value) - 11) < 1e-9);
    assert.ok(Math.abs(pct(r.weighted![1]!.byTenor['3y'].figure!.value) - 14) < 1e-9);
    assert.equal(r.weighted![0]!.withoutClient, 1);
    const vm = buildPerformanceVM(r, 'regular').weighted!;
    assert.equal(vm.notes.filter((x) => x === NOTE).length, 1, JSON.stringify(vm.notes));
  });

  test('the sheet: the note is on the Family row only; with a client on every holding there is no such note', () => {
    const sheet = performanceSheet(r);
    const keys = sheet.columns.map((c) => c.key);
    const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
    const rows = sheet.rows.filter((x) => at(x, 'row') === 'Weighted');
    assert.ok(String(at(rows[0]!, 'note')).endsWith(NOTE));
    assert.ok(!String(at(rows[1]!, 'note')).includes('no client in the base file'));
    assert.ok(!buildPerformanceVM(res, 'regular').weighted!.notes.some((x) => x.includes('no client in the base file')));
    assert.equal(res.weighted![0]!.withoutClient, 0);
  });

  test('which holdings the count takes: mutual funds only, of any value; two of them read in the plural', () => {
    const noClient = (x: Holding): Holding => ({ ...x, clientId: null, clientLabel: null } as unknown as Holding);
    const k1 = h('K1 Fund', 5, 'c1', 'K1 Fund-Reg(G)');
    /* a PMS with no client is not a mutual fund: no count, no note, and the family is K1 alone, 14.00% */
    const pms = computePerformance([k1, noClient(h('A Portfolio PMS', 7, 'c1', undefined, 'PMS'))], SRC, { fundSources: FUNDS });
    assert.equal(pms.weighted![0]!.withoutClient, 0);
    assert.ok(Math.abs(pct(pms.weighted![0]!.byTenor['3y'].figure!.value) - 14) < 1e-9);
    assert.ok(!buildPerformanceVM(pms, 'regular').weighted!.notes.some((x) => x.includes('no client in the base file')));
    /* a mutual fund of no market value and no client is in the family's holdings (the count) though not in its figure:
       the figure is K1's 14.00%, and the family's own footnote says the holding is not counted */
    const zero = computePerformance([k1, noClient(h('K2 Fund', 0, 'c1', 'K2 Fund-Reg(G)'))], SRC, { fundSources: FUNDS });
    assert.equal(zero.weighted![0]!.withoutClient, 1);
    assert.ok(Math.abs(pct(zero.weighted![0]!.byTenor['3y'].figure!.value) - 14) < 1e-9);
    const zn = buildPerformanceVM(zero, 'regular').weighted!.notes;
    assert.ok(zn.includes(NOTE), JSON.stringify(zn));
    assert.ok(zn.some((x) => x.startsWith('Family, 3Y') && /1 holding without a positive market value not counted/.test(x)), JSON.stringify(zn));
    /* two of them, 3 and 2 Crore: (5 x 14 + 3 x 6) / 8 = 11.00% over 80% of the 10 Crore (K3 has no 3Y) */
    const two = computePerformance([k1, noClient(h('K2 Fund', 3, 'c1', 'K2 Fund-Reg(G)')), noClient(h('K3 Fund', 2, 'c1', 'K3 Fund-Reg(G)'))], SRC, { fundSources: FUNDS });
    assert.equal(two.weighted![0]!.withoutClient, 2);
    assert.ok(Math.abs(pct(two.weighted![0]!.byTenor['3y'].figure!.value) - 11) < 1e-9);
    assert.ok(buildPerformanceVM(two, 'regular').weighted!.notes.includes('2 mutual-fund holdings have no client in the base file: they are in the Family row\'s holdings and in no client row\'s.'));
  });
});
