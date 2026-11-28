// covers: E-31 E-32 E-84 U-41 KI-302 (the owner's answers of 28 Nov 2026: the returns note, and "Absolute, and say so"
// for a fund under one year old)
// The since-inception return of a fund under one year old on its table's as-on date is shown as an absolute return,
// worked from the data's annualised figure over the days since the fund's inception, and marked; a fund at least one
// year old keeps the data's figure; where the fund's age cannot be told, or the data does not say how a young fund's
// figure is stated, the cell is a dash with its reason. Known answers by hand:
//   - 216.4712% annualised over 36 days:  3.164712^(36/365) - 1 = e^(1.152062 x 0.0986301) - 1 = 12.0335%
//   - 6.7987% annualised over 74 days:    1.067987^(74/365) - 1 = e^(0.0657756 x 0.2027397) - 1 = 1.34246%
//   - -13.413% annualised over 92 days:   0.86587^(92/365) - 1  = e^(-0.144021 x 0.2520548) - 1 = -3.5650%
//   - 10% annualised over 364 days:       1.1^(364/365) - 1     = e^(0.0953102 x 0.9972603) - 1 = 9.9713%
// The evidence for compounding is measured on the committed data: de-annualised by compounding, a young fund's figure
// lands on its own 1M, 3M or 6M return where its age is that window; pro rata it does not.
// The returns note is first under every table and in the workbook's Read Me.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { DayNumber, Value } from '../../../app/src/model/value.ts';
import type { PerformanceSources, PerfRecord } from '../../../app/src/engine/returns/performance.ts';
import { computePerformance, sinceInception, SI_ANNUALISED_SOURCES, SI_YEAR_DAYS } from '../../../app/src/engine/returns/performance.ts';
import { ABSOLUTE_MARKER, buildPerformanceVM, RETURNS_NOTE } from '../../../app/src/views/performance.ts';
import { performanceSheet } from '../../../app/src/exports/xlsx/sheets/performance.ts';
import { parseProductClassRules } from '../../../app/src/engine/match/product-class.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';

const dayOf = (y: number, m: number, d: number): Value<DayNumber> => ({ kind: 'value', v: ymdToDay(y, m, d)!, unit: 'date', prov: { sources: [], method: 't' } });
const OCT31 = dayOf(2026, 10, 31);
const rec = (inception: string | null, r: Record<string, number | null>): PerfRecord => ({ aum: 100, inception, r });
const near = (x: Value<number>, want: number, tol: number): boolean => x.kind === 'value' && Math.abs(x.v - want) < tol;

describe('sinceInception: the conversion, by hand', () => {
  test('the year is 365 days and only the two mutual-fund monitors are known to annualise by compounding', () => {
    assert.equal(SI_YEAR_DAYS, 365);
    assert.deepEqual([...SI_ANNUALISED_SOURCES].sort(), ['MF_PERF', 'MF_PERF_DIRECT']);
  });

  test('216.4712% annualised over 36 days is 12.0335% absolute', () => {
    const x = sinceInception(rec('2026-09-25', { SI: 216.4712 }), OCT31, 'MF_PERF')!;
    assert.deepEqual(x.si, { basis: 'absolute', days: 36, vendorAnnualised: 216.4712 });
    assert.ok(near(x.value, 12.0335, 5e-4), JSON.stringify(x.value));
    // pro rata it would be 216.4712 x 36 / 365 = 21.35%: not what is shown
    assert.ok(!near(x.value, 21.35, 1));
  });

  test('6.7987% over 74 days is 1.34246%; -13.413% over 92 days is -3.5650%', () => {
    const a = sinceInception(rec('2026-08-18', { SI: 6.7987 }), OCT31, 'MF_PERF')!;
    assert.deepEqual(a.si, { basis: 'absolute', days: 74, vendorAnnualised: 6.7987 });
    assert.ok(near(a.value, 1.34246, 1e-5), JSON.stringify(a.value));
    const b = sinceInception(rec('2026-07-31', { SI: -13.413 }), OCT31, 'MF_PERF_DIRECT')!;
    assert.deepEqual(b.si, { basis: 'absolute', days: 92, vendorAnnualised: -13.413 });
    assert.ok(near(b.value, -3.565, 5e-4), JSON.stringify(b.value));
  });

  test('the one-year boundary is the calendar\'s: 31 Oct 2025 is a year old on 31 Oct 2026, 1 Nov 2025 is not', () => {
    const old = sinceInception(rec('2025-10-31', { SI: 10 }), OCT31, 'MF_PERF')!;
    assert.deepEqual(old.si, { basis: 'annualised' });
    assert.ok(old.value.kind === 'value' && old.value.v === 10, 'the data\'s figure as given');
    const young = sinceInception(rec('2025-11-01', { SI: 10 }), OCT31, 'MF_PERF')!;
    assert.deepEqual(young.si, { basis: 'absolute', days: 364, vendorAnnualised: 10 });
    assert.ok(near(young.value, 9.9713, 5e-4), JSON.stringify(young.value));
  });

  test('a leap day: on 29 Feb 2028 a fund of 28 Feb 2027 is a year old; one of 1 Mar 2027 is not (365 days, the figure unchanged)', () => {
    const on = dayOf(2028, 2, 29);
    assert.deepEqual(sinceInception(rec('2027-02-28', { SI: 8 }), on, 'MF_PERF')!.si, { basis: 'annualised' });
    const y = sinceInception(rec('2027-03-01', { SI: 8 }), on, 'MF_PERF')!;
    assert.deepEqual(y.si, { basis: 'absolute', days: 365, vendorAnnualised: 8 });
    assert.ok(near(y.value, 8, 1e-9));
  });

  test('no since-inception figure in the data: nothing to state (the cell stays "no SI return")', () => {
    assert.equal(sinceInception(rec('2026-09-25', { '1M': 1 }), OCT31, 'MF_PERF'), null);
    assert.equal(sinceInception(rec('2026-09-25', { SI: null }), OCT31, 'MF_PERF'), null);
  });
});

describe('sinceInception: a dash with its reason, never a figure of unknown basis', () => {
  const reason = (x: ReturnType<typeof sinceInception>): string => (x && x.value.kind === 'missing' ? x.value.reason : '');
  const status = (x: ReturnType<typeof sinceInception>): string | null => (x && x.value.kind === 'missing' ? x.value.status : null);

  test('a young fund of a source that does not say how the figure is stated (SIF, PMS, AIF)', () => {
    for (const source of ['SIF_PERF', 'PMS_PERF', 'AIF_PERF']) {
      const x = sinceInception(rec('2026-06-08', { '1M': -4.99, '3M': -7.42, SI: -0.11 }), OCT31, source)!;
      assert.deepEqual(x.si, { basis: 'not-shown', why: 'basis-not-stated' }, source);
      assert.equal(status(x), STATUS.INSUFFICIENT_EVIDENCE);
      assert.equal(reason(x), `the fund is under one year old (inception 8 Jun 2026) and ${source} does not say whether its since-inception return is annualised, so it is not shown`);
    }
    // the same fund once it is a year old keeps the data's figure
    assert.deepEqual(sinceInception(rec('2025-06-08', { SI: 9.1 }), OCT31, 'SIF_PERF')!.si, { basis: 'annualised' });
  });

  test('either date missing: the figure as given when a return of one year or more shows the fund is a year old; else a dash naming the date', () => {
    // PMS: no inception date and no as-on date in the data
    const pmsOld = sinceInception(rec('', { '1Y': 5, SI: 19.1 }), undefined, 'PMS_PERF')!;
    assert.deepEqual(pmsOld.si, { basis: 'annualised' });
    assert.ok(pmsOld.value.kind === 'value' && pmsOld.value.v === 19.1);
    const pmsYoung = sinceInception(rec('', { '1M': 3.23, '6M': 11.3, '1Y': null, SI: 10.13 }), undefined, 'PMS_PERF')!;
    assert.deepEqual(pmsYoung.si, { basis: 'not-shown', why: 'no-inception' });
    assert.equal(reason(pmsYoung), 'PMS_PERF gives no inception date and no return of one year or more, so the fund cannot be shown to be a year old and its since-inception return is not shown');
    // an inception date that cannot be read (a two-digit year) is not guessed
    const aif = sinceInception(rec('03-Jan-18', { '1M': 5.4, SI: 15 }), OCT31, 'AIF_PERF')!;
    assert.deepEqual(aif.si, { basis: 'not-shown', why: 'no-inception' });
    assert.match(reason(aif), /^the inception date "03-Jan-18" in AIF_PERF could not be read and there is no return of one year or more/);
    assert.deepEqual(sinceInception(rec('03-Jan-18', { '1Y': 5.3, SI: 15 }), OCT31, 'AIF_PERF')!.si, { basis: 'annualised' });
    // an inception date and no as-on date
    const noDate = sinceInception(rec('2026-09-25', { '1M': 1, SI: 20 }), undefined, 'MF_PERF')!;
    assert.deepEqual(noDate.si, { basis: 'not-shown', why: 'no-as-on' });
    assert.match(reason(noDate), /^MF_PERF records no as-on date and the fund has no return of one year or more/);
    assert.deepEqual(sinceInception(rec('2015-01-01', { '3Y': 6, SI: 9 }), undefined, 'MF_PERF')!.si, { basis: 'annualised' });
  });

  test('an inception that is not before the as-on date, and an annualised loss of 100% or more', () => {
    for (const inc of ['2026-10-31', '2026-11-15']) {
      const x = sinceInception(rec(inc, { SI: 4 }), OCT31, 'MF_PERF')!;
      assert.deepEqual(x.si, { basis: 'not-shown', why: 'inception-not-before-as-on' }, inc);
    }
    const lost = sinceInception(rec('2026-09-25', { SI: -100 }), OCT31, 'MF_PERF')!;
    assert.deepEqual(lost.si, { basis: 'not-shown', why: 'cannot-convert' });
    assert.equal(status(lost), STATUS.INSUFFICIENT_EVIDENCE);
  });
});

describe('the evidence: the mutual-fund monitors annualise a young fund\'s figure by compounding (the committed data)', () => {
  test('where a fund\'s age is close to a 1M, 3M or 6M window, the compounded conversion is closer to that return than pro rata', (t) => {
    const block = refdataBlock('MF_PERF') as Record<string, PerfRecord>;
    const asOn = ymdToDay(2026, 10, 31)!;
    const windows: Array<[string, number]> = [['1M', 30.44], ['3M', 91.3], ['6M', 182.6]];
    let n = 0, compound = 0, simple = 0;
    for (const r of Object.values(block)) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(r.inception ?? ''));
      const si = r.r?.SI;
      if (!m || typeof si !== 'number' || r.type !== 'equity') continue;
      const age = asOn - ymdToDay(Number(m[1]), Number(m[2]), Number(m[3]))!;
      if (age <= 0 || age >= 365 || !(1 + si / 100 > 0)) continue;
      for (const [tenor, w] of windows) {
        const ret = r.r?.[tenor];
        if (typeof ret !== 'number' || Math.abs(age - w) > 12) continue;
        n += 1;
        compound += Math.abs((Math.pow(1 + si / 100, age / 365) - 1) * 100 - ret);
        simple += Math.abs(si * age / 365 - ret);
      }
    }
    t.diagnostic(`${n} fund and window pairs: mean absolute error ${(compound / Math.max(n, 1)).toFixed(3)} by compounding, ${(simple / Math.max(n, 1)).toFixed(3)} pro rata`);
    if (n < 10) { t.diagnostic('REPORT ONLY: fewer than 10 young equity funds near a window in today\'s MF_PERF (a refresh); review the evidence'); return; }
    assert.ok(compound < simple, 'compounding fits the data better than pro rata');
    assert.ok(compound / n < 1.5, 'and lands within 1.5 percentage points on average');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Through the tables, the screen's view-model and the Performance sheet.

let seq = 0;
function h(name: string, product: string, asset: Holding['assetClass'], category: string | null, key?: string): Holding {
  seq += 1;
  return {
    id: `s${seq}`, instrumentName: name, product, assetClass: asset, categoryLabel: category, inclusion: { status: 'included' },
    cmv: { kind: 'value', v: 1, unit: 'cr', prov: { sources: [], method: 't' } },
    instrument: key ? { productClass: 'MF', nameKey: name, vendorKey: key, resolution: { method: 'name-match', confidence: 'exact' } } : null,
  } as unknown as Holding;
}
const OLD = { '1M': 1, '3M': 2, '6M': 3, '1Y': 4, '3Y': 6, '5Y': 7, '10Y': 8, SI: 9 };
const SRC: PerformanceSources = {
  MF: {
    'Young Index Fund-Reg(G)': rec('2026-09-25', { '1M': 12.5494, SI: 216.4712 }),
    'Old Flexi Cap Fund-Reg(G)': rec('2015-01-01', OLD),
    'Newest Contra Fund-Reg(G)': rec('2026-10-15', { SI: -9.6648 }),
  },
  MF_DIRECT: {
    /* the Direct block is of another date here: 30 Nov 2026, 66 days after the fund's inception */
    'Young Index Fund(G)-Direct Plan': rec('2026-09-25', { '1M': 14.9992, SI: 263.9663 }),
    'Old Flexi Cap Fund(G)-Direct Plan': rec('2015-01-01', { ...OLD, SI: 10 }),
  },
  PMS: { 'Sample New PMS': rec('', { '1M': 3.23, '3M': 9.14, '6M': 11.3, SI: 10.13 }), 'Sample Old PMS': rec('', { '1Y': 5, '3Y': 15.1, SI: 19.1 }) },
  AIF: null,
  SIF: { 'Sample Long-Short Fund-Reg(G)': rec('2026-06-08', { '1M': -4.9915, '3M': -7.421, SI: -0.11 }), 'Sample Only-SI SIF-Reg(G)': rec('2026-08-01', { SI: 2.5 }) },
  STOCK: null, BENCH: null,
  asOn: { MF: OCT31, MF_DIRECT: dayOf(2026, 11, 30), SIF: OCT31 },
  rules: parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES')),
};
const H = [
  h('Young Index Fund', 'Mutual Funds', 'Equity', 'Index Funds', 'Young Index Fund-Reg(G)'),
  h('Old Flexi Cap Fund', 'Mutual Funds', 'Equity', 'Flexi Cap Fund', 'Old Flexi Cap Fund-Reg(G)'),
  h('Newest Contra Fund', 'Mutual Funds', 'Equity', 'Contra Fund', 'Newest Contra Fund-Reg(G)'),
  h('Sample New PMS', 'PMS', 'Equity', 'Flexi Cap', 'Sample New PMS'),
  h('Sample Old PMS', 'PMS', 'Equity', 'Flexi Cap', 'Sample Old PMS'),
  h('Sample Long-Short Fund', 'SIF', 'Equity', 'Equity Long Short Fund', 'Sample Long-Short Fund-Reg(G)'),
  h('Sample Only-SI SIF', 'SIF', 'Equity', 'Equity Long Short Fund', 'Sample Only-SI SIF-Reg(G)'),
];
const res = computePerformance(H, SRC);
const fundOf = (list: typeof res.regular, bucket: string, name: string) => list.find((b) => b.key === bucket)!.groups.flatMap((g) => g.funds).find((f) => f.name === name)!;

describe('the tables: each list counts the fund\'s age to its own block\'s date', () => {
  test('Regular: 36 days to 31 Oct 2026; a fund at least a year old keeps the data\'s figure', () => {
    const y = fundOf(res.regular, 'Equity MF', 'Young Index Fund');
    assert.deepEqual(y.si, { basis: 'absolute', days: 36, vendorAnnualised: 216.4712 });
    assert.ok(near(y.r.SI!, 12.0335, 5e-4));
    const o = fundOf(res.regular, 'Equity MF', 'Old Flexi Cap Fund');
    assert.deepEqual(o.si, { basis: 'annualised' });
    assert.ok(o.r.SI!.kind === 'value' && o.r.SI!.v === 9);
    // 16 days: 0.903352^(16/365) - 1 = e^(-0.101643 x 0.0438356) - 1 = -0.4446%
    const c = fundOf(res.regular, 'Equity MF', 'Newest Contra Fund');
    assert.deepEqual(c.si, { basis: 'absolute', days: 16, vendorAnnualised: -9.6648 });
    assert.ok(near(c.r.SI!, -0.4446, 5e-4), JSON.stringify(c.r.SI));
  });

  test('Direct: the Direct block\'s own figure and date: 263.9663% over 66 days to 30 Nov 2026 is 26.32%', () => {
    // 3.639663^(66/365) - 1 = e^(1.291891 x 0.1808219) - 1 = e^0.233602 - 1 = 26.314%
    const y = fundOf(res.direct!, 'Equity MF', 'Young Index Fund');
    assert.equal(y.key, 'Young Index Fund(G)-Direct Plan');
    assert.deepEqual(y.si, { basis: 'absolute', days: 66, vendorAnnualised: 263.9663 });
    assert.ok(near(y.r.SI!, 26.314, 5e-3), JSON.stringify(y.r.SI));
    assert.deepEqual(fundOf(res.direct!, 'Equity MF', 'Old Flexi Cap Fund').si, { basis: 'annualised' });
  });

  test('PMS without dates: a strategy with a 1Y return keeps its figure; one without is a dash. A young SIF is a dash', () => {
    assert.deepEqual(fundOf(res.regular, 'PMS', 'Sample Old PMS').si, { basis: 'annualised' });
    assert.deepEqual(fundOf(res.regular, 'PMS', 'Sample New PMS').si, { basis: 'not-shown', why: 'no-inception' });
    assert.equal(fundOf(res.regular, 'PMS', 'Sample New PMS').r.SI!.kind, 'missing');
    assert.deepEqual(fundOf(res.regular, 'SIF', 'Sample Long-Short Fund').si, { basis: 'not-shown', why: 'basis-not-stated' });
  });
});

describe('the screen: the returns note, the marker and the reasons', () => {
  const vm = buildPerformanceVM(res, 'regular');
  const bucketVM = (k: string) => vm.buckets.find((b) => b.key === k)!;
  const rowOf = (k: string, name: string) => bucketVM(k).rows.find((r) => r.kind === 'fund' && r.name === name) as Extract<ReturnType<typeof bucketVM>['rows'][number], { kind: 'fund' }>;

  test('the owner\'s sentence is the first note under every table, in both lists', () => {
    assert.equal(RETURNS_NOTE, 'Returns up to one year are absolute; returns over one year are annualised.');
    for (const plan of ['regular', 'direct'] as const) {
      const v = buildPerformanceVM(res, plan);
      assert.ok(v.buckets.length >= 3);
      for (const b of v.buckets) assert.equal(b.notes[0], RETURNS_NOTE, `${plan} ${b.key}`);
    }
  });

  test('an absolute since-inception return carries the marker "a" and its note; the old fund\'s cell has none', () => {
    assert.equal(ABSOLUTE_MARKER, 'a');
    assert.deepEqual([rowOf('Equity MF', 'Young Index Fund').cells.SI!.text, rowOf('Equity MF', 'Young Index Fund').cells.SI!.marker], ['12.03%', 'a']);
    assert.deepEqual([rowOf('Equity MF', 'Newest Contra Fund').cells.SI!.text, rowOf('Equity MF', 'Newest Contra Fund').cells.SI!.marker, rowOf('Equity MF', 'Newest Contra Fund').cells.SI!.negative], ['-0.44%', 'a', true]);
    assert.deepEqual([rowOf('Equity MF', 'Old Flexi Cap Fund').cells.SI!.text, rowOf('Equity MF', 'Old Flexi Cap Fund').cells.SI!.marker], ['9.00%', null]);
    assert.ok(bucketVM('Equity MF').notes.includes('a: 2 funds are under one year old on the table\'s date, so their since-inception return is shown as an absolute return, worked from the data\'s annualised figure over the days since the fund\'s inception.'));
    assert.ok(!bucketVM('PMS').notes.some((n) => n.startsWith('a: ')));
  });

  test('a since-inception return that is not shown: a dash, and a note that names the funds and the reason', () => {
    assert.doesNotMatch(rowOf('SIF', 'Sample Long-Short Fund').cells.SI!.text, /[0-9]/);
    assert.ok(bucketVM('SIF').notes.includes('Since-inception return not shown for 2 funds (Sample Long-Short Fund and Sample Only-SI SIF): the fund is under one year old and its data does not say whether the figure is annualised.'));
    assert.ok(bucketVM('PMS').notes.includes('Since-inception return not shown for 1 fund (Sample New PMS): the data gives no readable inception date and no return of one year or more.'));
    // a fund whose only figure is the since-inception return keeps its row; it is not "without returns in the data"
    assert.ok(rowOf('SIF', 'Sample Only-SI SIF'));
    assert.ok(!bucketVM('SIF').notes.some((n) => /no returns in the data/.test(n)));
  });
});

describe('the Performance sheet: the absolute figure with its Note; a blank with its status and reason', () => {
  const sheet = performanceSheet(res);
  const keys = sheet.columns.map((c) => c.key);
  const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
  const row = (plan: string, name: string) => sheet.rows.find((r) => at(r, 'row') === 'Fund' && at(r, 'name') === name && at(r, 'plan') === plan)!;

  test('Regular and Direct rows of the young fund', () => {
    const r = row('Regular', 'Young Index Fund');
    assert.ok(Math.abs((at(r, 'SI') as number) - 12.0335) < 5e-4);
    assert.equal(at(r, 'note'), 'SI is an absolute return over 36 days: the fund is under one year old on this date; the data\'s annualised figure is 216.4712%. No 3M, 6M, 1Y, 3Y, 5Y, 10Y figure in the data.');
    assert.equal(at(r, 'status'), STATUS.NOT_AVAILABLE, 'the tenors the fund has no figure for are still said');
    const d = row('Direct', 'Young Index Fund');
    assert.ok(Math.abs((at(d, 'SI') as number) - 26.314) < 5e-3);
    assert.match(String(at(d, 'note')), /^Direct\. SI is an absolute return over 66 days: .* annualised figure is 263\.9663%\. No /);
    assert.equal(at(row('Regular', 'Old Flexi Cap Fund'), 'note'), null);
    assert.equal(at(row('Regular', 'Old Flexi Cap Fund'), 'SI'), 9);
  });

  test('a since-inception return not shown: the cell blank, INSUFFICIENT EVIDENCE and the reason', () => {
    const s = row('Not applicable', 'Sample Long-Short Fund');
    assert.equal(at(s, 'SI'), null);
    assert.equal(at(s, 'status'), STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(at(s, 'note'), 'SI: the fund is under one year old (inception 8 Jun 2026) and SIF_PERF does not say whether its since-inception return is annualised, so it is not shown.');
    const p = row('Not applicable', 'Sample New PMS');
    assert.equal(at(p, 'SI'), null);
    assert.match(String(at(p, 'status')), /INSUFFICIENT EVIDENCE/);
    assert.match(String(at(p, 'note')), /SI: PMS_PERF gives no inception date and no return of one year or more/);
  });
});
