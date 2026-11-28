// covers: E-31 E-32 E-84 U-41 KI-302 (the owner's answers of 28 Nov 2026: the returns note, and "Absolute, and say so"
// for a fund under one year old)
// The since-inception return of a mutual fund under one year old is shown as an absolute return and marked: worked from
// the data's annualised figure over the days from the fund's inception to the day its block is PRICED TO, which is not
// the month-end label the table shows (data/price-days.ts; October 2026: Mon 2 Nov for the Regular monitor, Fri 30 Oct
// for the Direct one). A fund at least one year old keeps the data's figure.
//
// Known answers, independent of the code: THE VENDOR'S OWN FIGURES. For a fund whose inception is the start of a 1M, 3M
// or 6M window, the vendor's return for that tenor is the fund's absolute since-inception return, so the conversion of
// its annualised figure must give that tenor's figure. Thirteen such funds are in the committed data and each must match
// to four decimals (the financial review of 28 Nov 2026, K-1 and K-4). And a second, wider measure: a fund launched at
// NAV 10 has an absolute return with at most three decimals, so the conversion on the right day lands there for most
// young funds, and on a wrong day for about one in ten; this is the test that fails when a wrong price day is typed at
// a refresh (MOD-05's ruling D-A).
//
// The Moderator's defaults of 28 Nov 2026, not the owner's rulings: under 30 days old a dash (D-B); a SIF a dash at every
// age, its data not stating whether the figure is annualised (D-C, KI-322); either date missing: the data's figure only
// when a return of one year or more shows the fund is a year old, else a dash (D-D). Never a count to the label: an
// uploaded monitor's stated date may be one, so its price day is not known (the review's R2-1).
// The returns note is first under every table and in the workbook's Read Me.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { DayNumber, Value } from '../../../app/src/model/value.ts';
import type { PerformanceSources, PerfRecord } from '../../../app/src/engine/returns/performance.ts';
import {
  computePerformance, sinceInception, SI_ANNUALISED_SOURCES, SI_BASIS_NOT_STATED_SOURCES, SI_MIN_DAYS, SI_YEAR_DAYS,
} from '../../../app/src/engine/returns/performance.ts';
import { ABSOLUTE_MARKER, buildPerformanceVM, RETURNS_NOTE } from '../../../app/src/views/performance.ts';
import { performanceSheet } from '../../../app/src/exports/xlsx/sheets/performance.ts';
import { performanceSourcesFrom, uploadedPriceDay } from '../../../app/src/data/performance-sources.ts';
import { PRICE_DAYS, priceDayOf, type PricedBlock } from '../../../app/src/data/price-days.ts';
import { parseProductClassRules } from '../../../app/src/engine/match/product-class.ts';
import { dayToIso, ymdToDay } from '../../../app/src/engine/dates.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';
import { FILE_BLOCK_TEXT } from '../../helpers/node-wiring.ts';
import { REPO } from '../../helpers/sheetjs.ts';

const dayOf = (y: number, m: number, d: number): Value<DayNumber> => ({ kind: 'value', v: ymdToDay(y, m, d)!, unit: 'date', prov: { sources: [], method: 't' } });
const NOV2 = dayOf(2026, 11, 2);
const OCT30 = dayOf(2026, 10, 30);
const rec = (inception: string | null, r: Record<string, number | null>): PerfRecord => ({ aum: 100, inception, r });
const near = (x: Value<number>, want: number, tol: number): boolean => x.kind === 'value' && Math.abs(x.v - want) < tol;
const reason = (x: ReturnType<typeof sinceInception>): string => (x && x.value.kind === 'missing' ? x.value.reason : '');
const status = (x: ReturnType<typeof sinceInception>): string | null => (x && x.value.kind === 'missing' ? x.value.status : null);

// ---------------------------------------------------------------------------------------------------------------
// The price-day table and the vendor's own figures.

const VINTAGE = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', 'VINTAGE.json'), 'utf8')) as { blocks: Record<string, { asOn: string | null }> };
const labelOf = (block: PricedBlock): Value<DayNumber> => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(VINTAGE.blocks[block]?.asOn ?? ''))!;
  return dayOf(Number(m[1]), Number(m[2]), Number(m[3]));
};

describe('the price-day table (config/price-days.json)', () => {
  test('the embedded data month has a price day for each of the three blocks, within a week of its label', () => {
    for (const block of ['MF_PERF', 'MF_PERF_DIRECT', 'SIF_PERF'] as const) {
      const label = labelOf(block);
      const pd = priceDayOf(block, label);
      assert.equal(pd.kind, 'value', `${block}: no price day recorded for ${dayToIso((label as { v: DayNumber }).v).slice(0, 7)}`);
      if (pd.kind === 'value' && label.kind === 'value') assert.ok(Math.abs(pd.v - label.v) <= 7, `${block}: ${dayToIso(pd.v)} against the label ${dayToIso(label.v)}`);
    }
  });

  test('October 2026 as the refresh log records it: Regular and SIF priced to Mon 2 Nov, Direct to Fri 30 Oct', () => {
    assert.deepEqual(PRICE_DAYS['2026-10'], { MF_PERF: '2026-11-02', MF_PERF_DIRECT: '2026-10-30', SIF_PERF: '2026-11-02' });
    const label = dayOf(2026, 10, 31);
    assert.deepEqual([priceDayOf('MF_PERF', label), priceDayOf('MF_PERF_DIRECT', label)].map((v) => (v.kind === 'value' ? dayToIso(v.v) : null)), ['2026-11-02', '2026-10-30']);
  });

  test('no entry for the month, or no label: missing with the reason, never the label', () => {
    const none = priceDayOf('MF_PERF', dayOf(2027, 3, 31));
    assert.deepEqual([none.kind, none.kind === 'missing' ? none.reason : ''], ['missing', 'the price day of MF_PERF is not recorded for 2027-03']);
    const noLabel = priceDayOf('MF_PERF', { kind: 'missing', status: STATUS.NOT_AVAILABLE, reason: 'x' });
    assert.equal(noLabel.kind, 'missing');
    const bad = priceDayOf('MF_PERF', dayOf(2026, 10, 31), { '2026-10': { MF_PERF: 'soon' } });
    assert.deepEqual([bad.kind, bad.kind === 'missing' ? bad.status : ''], ['missing', STATUS.INVALID_SOURCE]);
  });

  test('the page\'s sources carry the price days of the embedded blocks', () => {
    const src = performanceSourcesFrom(undefined, FILE_BLOCK_TEXT);
    const iso = (v: Value<DayNumber> | undefined): string | null => (v && v.kind === 'value' ? dayToIso(v.v) : null);
    assert.deepEqual([iso(src.priceDay?.MF), iso(src.priceDay?.MF_DIRECT), iso(src.priceDay?.SIF)],
      (['MF_PERF', 'MF_PERF_DIRECT', 'SIF_PERF'] as const).map((b) => iso(priceDayOf(b, labelOf(b)))));
    // the label the table shows is untouched
    assert.equal(iso(src.asOn.MF), VINTAGE.blocks.MF_PERF!.asOn);
  });
});

/** Funds whose inception is the start of a tenor's window: the vendor's figure for that tenor is their absolute
 * since-inception return (the financial review's table, 28 Nov 2026). */
const VENDOR_MATCHES: ReadonlyArray<[PricedBlock, string, '1M' | '3M' | '6M']> = [
  ['MF_PERF', 'Axis Nifty500 Low Volatility 50 Index Fund-Reg(G)', '1M'], ['MF_PERF', 'JioBlackRock Balanced Advantage Fund-Reg(G)', '1M'],
  ['MF_PERF', 'Edelweiss BSE Top 10 Bank ETF', '3M'], ['MF_PERF', 'ICICI Pru BSE Insurance ETF', '3M'],
  ['MF_PERF', 'Edelweiss BSE LargeMid (60:40) Stable Dividend 50 ETF', '3M'], ['MF_PERF', 'NJ Momentum Fund-Reg(G)', '3M'],
  ['MF_PERF', 'NJ Value Fund-Reg(G)', '3M'], ['MF_PERF', 'Axis Nifty India Defence Index Fund-Reg(G)', '6M'],
  ['MF_PERF_DIRECT', 'Axis Nifty500 Low Volatility 50 Index Fund(G)-Direct Plan', '1M'], ['MF_PERF_DIRECT', 'Kotak Multi Sector Omni FOF(G)-Direct Plan', '1M'],
  ['MF_PERF_DIRECT', 'NJ Momentum Fund(G)-Direct Plan', '3M'], ['MF_PERF_DIRECT', 'NJ Value Fund(G)-Direct Plan', '3M'],
  ['MF_PERF_DIRECT', 'Axis Nifty India Defence Index Fund(G)-Direct Plan', '6M'],
];
const OCTOBER_2026 = VINTAGE.blocks.MF_PERF?.asOn === '2026-10-31' && VINTAGE.blocks.MF_PERF_DIRECT?.asOn === '2026-10-31';

describe('known answers: the vendor\'s own figures (the committed data)', () => {
  test('thirteen funds whose inception starts a 1M, 3M or 6M window: the conversion gives that tenor\'s figure to four decimals', (t) => {
    if (!OCTOBER_2026) { t.diagnostic('REPORT ONLY: the embedded data is no longer October 2026; list this month\'s funds whose inception starts a tenor window and review'); return; }
    for (const [block, name, tenor] of VENDOR_MATCHES) {
      const record = (refdataBlock(block) as Record<string, PerfRecord>)[name];
      assert.ok(record, `${name} is in ${block}`);
      const want = record.r![tenor] as number;
      const x = sinceInception(record, priceDayOf(block, labelOf(block)), block)!;
      assert.equal(x.si.basis, 'absolute', name);
      assert.ok(near(x.value, want, 5e-5), `${name}: ${JSON.stringify(x.value.kind === 'value' ? x.value.v : x.value)} against the vendor's ${tenor} ${want}`);
    }
    // by hand, one of them: Edelweiss BSE Top 10 Bank ETF, inception 31 Jul 2026, -13.413% annualised, priced to 2 Nov 2026:
    // 94 days; 0.86587^(94/365) - 1 = e^(-0.144021 x 0.257534) - 1 = e^(-0.037090) - 1 = -3.6411%, the vendor's 3M figure.
    // Counted to the 31 Oct label (92 days) it would be -3.5650%: not the fund's return.
    const bank = (refdataBlock('MF_PERF') as Record<string, PerfRecord>)['Edelweiss BSE Top 10 Bank ETF']!;
    assert.deepEqual(sinceInception(bank, priceDayOf('MF_PERF', labelOf('MF_PERF')), 'MF_PERF')!.si, { basis: 'absolute', days: 94, vendorAnnualised: -13.413 });
    assert.ok(!near(sinceInception(bank, labelOf('MF_PERF'), 'MF_PERF')!.value, -3.6411, 5e-3), 'the label day does not give the vendor\'s figure');
  });

  for (const block of ['MF_PERF', 'MF_PERF_DIRECT'] as const) {
    test(`${block}: on the recorded price day most young funds land on a NAV of four decimals; on any other day about one in ten`, (t) => {
      const pd = priceDayOf(block, labelOf(block));
      assert.equal(pd.kind, 'value');
      const on = (pd as { v: DayNumber }).v;
      const landed: Record<number, number> = {};
      let n = 0;
      for (const [name, r] of Object.entries(refdataBlock(block) as Record<string, PerfRecord>)) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(r.inception ?? ''));
        const si = r.r?.SI;
        // ETFs are left out: they do not launch at a NAV of 10
        if (!m || typeof si !== 'number' || /\bETF\b/i.test(name) || !(1 + si / 100 > 0)) continue;
        const days = on - ymdToDay(Number(m[1]), Number(m[2]), Number(m[3]))!;
        if (days <= 0 || days >= 365) continue;
        n += 1;
        for (let off = -3; off <= 3; off++) {
          // launched at NAV 10.0000, the absolute return is (NAV - 10) x 10 percent: at most three decimals
          const abs = (Math.pow(1 + si / 100, (days + off) / SI_YEAR_DAYS) - 1) * 100;
          if (Math.abs(abs * 1000 - Math.round(abs * 1000)) < 0.05) landed[off] = (landed[off] ?? 0) + 1;
        }
      }
      t.diagnostic(`${n} young funds; landing by day offset from the recorded price day: ${JSON.stringify(landed)}`);
      if (n < 40) { t.diagnostic('REPORT ONLY: fewer than 40 young funds in this block; review the price day by hand'); return; }
      const others = [-3, -2, -1, 1, 2, 3].map((o) => landed[o] ?? 0);
      assert.ok((landed[0] ?? 0) >= 0.7 * n, `only ${landed[0] ?? 0} of ${n} land on the recorded day: is the price day right?`);
      assert.ok((landed[0] ?? 0) >= 3 * Math.max(...others), 'no other day comes near');
    });
  }
});

describe('an uploaded monitor: the date its file states is not counted to (the financial review of 28 Nov 2026, R2-1)', () => {
  // The October 2026 Direct file states "31 Oct 2026" and is priced to Fri 30 Oct 2026 (the refresh log). Counted to
  // the stated date, Mirae Asset BSE Information Technology Index Fund's Direct figure would be 13.59% where the fund's
  // return is 13.19%.
  const direct = refdataBlock('MF_PERF_DIRECT') as Record<string, PerfRecord>;
  const regular = refdataBlock('MF_PERF') as Record<string, PerfRecord>;
  const src = performanceSourcesFrom({ blocks: { MF_PERF: regular, MF_PERF_DIRECT: direct } as never, dates: { MF_PERF: 'As on 02-Nov-2026', MF_PERF_DIRECT: 'As on 31-Oct-2026' } }, FILE_BLOCK_TEXT);

  test('the committed blocks uploaded with their stated dates: the label is the file\'s date, the price day is missing with its reason', () => {
    assert.equal(src.asOn.MF_DIRECT?.kind, 'value');
    for (const k of ['MF', 'MF_DIRECT'] as const) {
      const pd = src.priceDay?.[k];
      assert.deepEqual([pd?.kind, pd?.kind === 'missing' ? pd.status : ''], ['missing', STATUS.NOT_AVAILABLE], k);
    }
    const pd = uploadedPriceDay('Direct monitor');
    assert.equal(pd.kind === 'missing' ? pd.reason : '', 'the uploaded Direct monitor states one date, which may be its month\'s label and not the day its figures are priced to');
  });

  test('so a young fund of an uploaded monitor is a dash, never a figure counted to the stated date; a fund a year old keeps its figure', () => {
    let young = 0, old = 0;
    for (const [book, key, source] of [[direct, 'MF_DIRECT', 'MF_PERF_DIRECT'], [regular, 'MF', 'MF_PERF']] as const) {
      for (const [name, r] of Object.entries(book)) {
        const x = sinceInception(r, src.priceDay?.[key], source);
        if (!x) continue;
        if (String(r.inception ?? '') > '2025-11-02') {
          young += 1;
          assert.deepEqual(x.si, { basis: 'not-shown', why: 'no-price-day' }, name);
          assert.equal(x.value.kind, 'missing', name);
        } else if (x.si.basis === 'annualised') {
          old += 1;
          assert.ok(x.value.kind === 'value' && x.value.v === r.r!.SI, name);
        } else assert.deepEqual(x.si, { basis: 'not-shown', why: 'no-price-day' }, name);
      }
    }
    assert.ok(young > 300 && old > 3000, `${young} young, ${old} a year old`);
    const it = sinceInception(direct['Mirae Asset BSE Information Technology Index Fund(G)-Direct Plan']!, src.priceDay?.MF_DIRECT, 'MF_PERF_DIRECT')!;
    assert.equal(reason(it), 'the day MF_PERF_DIRECT is priced to is not known and the fund has no return of one year or more, so its days cannot be counted and its since-inception return is not shown');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The rules, on hand-made records.

describe('sinceInception: the conversion and its edges', () => {
  test('the constants: a 365-day year; only the two mutual-fund monitors are converted; SIF is never shown; 30 days', () => {
    assert.equal(SI_YEAR_DAYS, 365);
    assert.equal(SI_MIN_DAYS, 30);
    assert.deepEqual([...SI_ANNUALISED_SOURCES].sort(), ['MF_PERF', 'MF_PERF_DIRECT']);
    assert.deepEqual([...SI_BASIS_NOT_STATED_SOURCES], ['SIF_PERF']);
  });

  test('by hand: 216.4712% over 38 days is 12.7430%; 6.7987% over 76 days is 1.3790%; 6.1353% over 73 days is 1.1980%', () => {
    // Mirae Asset BSE IT Index Fund's figures: inception 25 Sep 2026, priced to 2 Nov: a NAV of 11.2743
    const a = sinceInception(rec('2026-09-25', { SI: 216.4712 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(a.si, { basis: 'absolute', days: 38, vendorAnnualised: 216.4712 });
    assert.ok(near(a.value, 12.743, 5e-5), JSON.stringify(a.value));
    // Zerodha Arbitrage Fund's figures: inception 18 Aug 2026; the Regular data to 2 Nov, the Direct data to 30 Oct
    const b = sinceInception(rec('2026-08-18', { SI: 6.7987 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(b.si, { basis: 'absolute', days: 76, vendorAnnualised: 6.7987 });
    assert.ok(near(b.value, 1.379, 5e-5), JSON.stringify(b.value));
    const c = sinceInception(rec('2026-08-18', { SI: 6.1353 }), OCT30, 'MF_PERF_DIRECT')!;
    assert.deepEqual(c.si, { basis: 'absolute', days: 73, vendorAnnualised: 6.1353 });
    assert.ok(near(c.value, 1.198, 5e-5), JSON.stringify(c.value));
  });

  test('the one-year boundary is the calendar\'s, counted to the price day: 2 Nov 2025 is a year old on 2 Nov 2026, 3 Nov 2025 is not', () => {
    const old = sinceInception(rec('2025-11-02', { SI: 10 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(old.si, { basis: 'annualised' });
    assert.ok(old.value.kind === 'value' && old.value.v === 10, 'the data\'s figure as given');
    // 364 days: 1.1^(364/365) - 1 = e^(0.0953102 x 0.9972603) - 1 = 9.9713%
    const young = sinceInception(rec('2025-11-03', { SI: 10 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(young.si, { basis: 'absolute', days: 364, vendorAnnualised: 10 });
    assert.ok(near(young.value, 9.9713, 5e-4), JSON.stringify(young.value));
    // the same fund against the Direct block's earlier price day is three days younger
    assert.deepEqual(sinceInception(rec('2025-11-03', { SI: 10 }), OCT30, 'MF_PERF_DIRECT')!.si, { basis: 'absolute', days: 361, vendorAnnualised: 10 });
  });

  test('a leap day: on 29 Feb 2028 a fund of 28 Feb 2027 is a year old; one of 1 Mar 2027 is not (365 days, the figure unchanged)', () => {
    const on = dayOf(2028, 2, 29);
    assert.deepEqual(sinceInception(rec('2027-02-28', { SI: 8 }), on, 'MF_PERF')!.si, { basis: 'annualised' });
    const y = sinceInception(rec('2027-03-01', { SI: 8 }), on, 'MF_PERF')!;
    assert.deepEqual(y.si, { basis: 'absolute', days: 365, vendorAnnualised: 8 });
    assert.ok(near(y.value, 8, 1e-9));
  });

  test('no since-inception figure in the data: nothing to state (the cell stays "no SI return")', () => {
    assert.equal(sinceInception(rec('2026-09-25', { '1M': 1 }), NOV2, 'MF_PERF'), null);
    assert.equal(sinceInception(rec('2026-09-25', { SI: null }), NOV2, 'MF_PERF'), null);
  });
});

describe('sinceInception: a dash with its reason, never a figure of unknown basis and never a count to the label', () => {
  test('under 30 days old: a dash (the Moderator\'s default); at 30 days the figure is shown', () => {
    // ICICI Pru Contra Fund's figures: inception 15 Oct 2026, 18 days to 2 Nov
    const x = sinceInception(rec('2026-10-15', { SI: -9.6648 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(x.si, { basis: 'not-shown', why: 'under-30-days' });
    assert.equal(status(x), STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(reason(x), 'the fund is only 18 days old on the day its data is priced to (inception 15 Oct 2026): one day of count is a large share of so young a figure, so its since-inception return is not shown');
    assert.deepEqual(sinceInception(rec('2026-10-04', { SI: 8 }), NOV2, 'MF_PERF')!.si, { basis: 'not-shown', why: 'under-30-days' }, '29 days');
    // 30 days: 1.08^(30/365) - 1 = e^(0.0769610 x 0.0821918) - 1 = 0.6346%
    const thirty = sinceInception(rec('2026-10-03', { SI: 8 }), NOV2, 'MF_PERF')!;
    assert.deepEqual(thirty.si, { basis: 'absolute', days: 30, vendorAnnualised: 8 });
    assert.ok(near(thirty.value, 0.6346, 5e-4), JSON.stringify(thirty.value));
  });

  test('a SIF: a dash at every age, with or without its dates (the data does not state the basis)', () => {
    for (const inception of ['2026-06-08', '2025-10-01', '2020-01-01', '']) {
      const x = sinceInception(rec(inception, { '1M': -4.99, '3M': -7.42, '1Y': 3, SI: 9.148 }), NOV2, 'SIF_PERF')!;
      assert.deepEqual(x.si, { basis: 'not-shown', why: 'basis-not-stated' }, inception);
      assert.equal(status(x), STATUS.INSUFFICIENT_EVIDENCE);
      assert.equal(reason(x), 'SIF_PERF does not state whether its since-inception return is annualised, so it is not shown');
    }
  });

  test('PMS and AIF: no dates; the figure as given when a return of one year or more shows the strategy is a year old, else a dash', () => {
    const pmsOld = sinceInception(rec('', { '1Y': 5, SI: 19.1 }), undefined, 'PMS_PERF')!;
    assert.deepEqual(pmsOld.si, { basis: 'annualised' });
    assert.ok(pmsOld.value.kind === 'value' && pmsOld.value.v === 19.1);
    const pmsYoung = sinceInception(rec('', { '1M': 3.23, '6M': 11.3, '1Y': null, SI: 10.13 }), undefined, 'PMS_PERF')!;
    assert.deepEqual(pmsYoung.si, { basis: 'not-shown', why: 'no-inception' });
    assert.equal(reason(pmsYoung), 'PMS_PERF gives no inception date and no return of one year or more, so the fund cannot be shown to be a year old and its since-inception return is not shown');
    // an inception date that cannot be read (a two-digit year) is not guessed
    const aif = sinceInception(rec('03-Jan-18', { '1M': 5.4, SI: 15 }), undefined, 'AIF_PERF')!;
    assert.deepEqual(aif.si, { basis: 'not-shown', why: 'no-inception' });
    assert.match(reason(aif), /^the inception date "03-Jan-18" in AIF_PERF could not be read and there is no return of one year or more/);
    assert.deepEqual(sinceInception(rec('03-Jan-18', { '1Y': 5.3, SI: 15 }), undefined, 'AIF_PERF')!.si, { basis: 'annualised' });
    // a PMS or AIF whose age is known and under one year: its basis is not stated either
    assert.deepEqual(sinceInception(rec('2026-06-08', { SI: 4 }), NOV2, 'PMS_PERF')!.si, { basis: 'not-shown', why: 'basis-not-stated' });
  });

  test('a mutual fund with no price day recorded: never a count to the label; the figure only when a 1Y+ return shows it is a year old', () => {
    for (const pd of [undefined, { kind: 'missing', status: STATUS.NOT_AVAILABLE, reason: 'the price day of MF_PERF is not recorded for 2027-03' } as Value<DayNumber>]) {
      const young = sinceInception(rec('2026-09-25', { '1M': 1, SI: 20 }), pd, 'MF_PERF')!;
      assert.deepEqual(young.si, { basis: 'not-shown', why: 'no-price-day' });
      assert.equal(reason(young), 'the day MF_PERF is priced to is not known and the fund has no return of one year or more, so its days cannot be counted and its since-inception return is not shown');
      assert.deepEqual(sinceInception(rec('2015-01-01', { '3Y': 6, SI: 9 }), pd, 'MF_PERF')!.si, { basis: 'annualised' });
    }
  });

  test('an inception that is not before the price day, and an annualised loss of 100% or more', () => {
    for (const inc of ['2026-11-02', '2026-11-15']) {
      assert.deepEqual(sinceInception(rec(inc, { SI: 4 }), NOV2, 'MF_PERF')!.si, { basis: 'not-shown', why: 'inception-not-before-price-day' }, inc);
    }
    assert.deepEqual(sinceInception(rec('2026-09-25', { SI: -100 }), NOV2, 'MF_PERF')!.si, { basis: 'not-shown', why: 'cannot-convert' });
  });

  test('no reason names the price day\'s date (the page shows one label only)', () => {
    const texts = [
      reason(sinceInception(rec('2026-10-15', { SI: 1 }), NOV2, 'MF_PERF')), reason(sinceInception(rec('2026-11-15', { SI: 1 }), NOV2, 'MF_PERF')),
      reason(sinceInception(rec('2026-09-25', { SI: 1 }), undefined, 'MF_PERF')),
    ];
    for (const x of texts) assert.doesNotMatch(x, /2 Nov 2026|2026-11-02/, x);
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
    'Young Index Fund(G)-Direct Plan': rec('2026-09-25', { '1M': 14.9992, SI: 263.9663 }),
    'Old Flexi Cap Fund(G)-Direct Plan': rec('2015-01-01', { ...OLD, SI: 10 }),
  },
  PMS: { 'Sample New PMS': rec('', { '1M': 3.23, '3M': 9.14, '6M': 11.3, SI: 10.13 }), 'Sample Old PMS': rec('', { '1Y': 5, '3Y': 15.1, SI: 19.1 }) },
  AIF: null,
  SIF: {
    'Sample Long-Short Fund-Reg(G)': rec('2026-06-08', { '1M': -4.9915, '3M': -7.421, SI: -0.11 }),
    'Sample Older SIF-Reg(G)': rec('2025-10-15', { '1M': 0.1257, '3M': -0.0357, SI: 9.148 }),
    'Sample Only-SI SIF-Reg(G)': rec('2026-08-01', { SI: 2.5 }),
  },
  STOCK: null, BENCH: null,
  /* one label for the month; the two monitors are priced to different days */
  asOn: { MF: dayOf(2026, 10, 31), MF_DIRECT: dayOf(2026, 10, 31), SIF: dayOf(2026, 10, 31) },
  priceDay: { MF: NOV2, MF_DIRECT: OCT30, SIF: NOV2 },
  rules: parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES')),
};
const H = [
  h('Young Index Fund', 'Mutual Funds', 'Equity', 'Index Funds', 'Young Index Fund-Reg(G)'),
  h('Old Flexi Cap Fund', 'Mutual Funds', 'Equity', 'Flexi Cap Fund', 'Old Flexi Cap Fund-Reg(G)'),
  h('Newest Contra Fund', 'Mutual Funds', 'Equity', 'Contra Fund', 'Newest Contra Fund-Reg(G)'),
  h('Sample New PMS', 'PMS', 'Equity', 'Flexi Cap', 'Sample New PMS'),
  h('Sample Old PMS', 'PMS', 'Equity', 'Flexi Cap', 'Sample Old PMS'),
  h('Sample Long-Short Fund', 'SIF', 'Equity', 'Equity Long Short Fund', 'Sample Long-Short Fund-Reg(G)'),
  h('Sample Older SIF', 'SIF', 'Equity', 'Equity Long Short Fund', 'Sample Older SIF-Reg(G)'),
  h('Sample Only-SI SIF', 'SIF', 'Equity', 'Equity Long Short Fund', 'Sample Only-SI SIF-Reg(G)'),
];
const res = computePerformance(H, SRC);
const fundOf = (list: typeof res.regular, bucket: string, name: string) => list.find((b) => b.key === bucket)!.groups.flatMap((g) => g.funds).find((f) => f.name === name)!;

describe('the tables: each list counts the fund\'s days to its own block\'s price day', () => {
  test('Regular: 38 days to 2 Nov 2026; a fund at least a year old keeps the data\'s figure; a fund 18 days old is a dash', () => {
    const y = fundOf(res.regular, 'Equity MF', 'Young Index Fund');
    assert.deepEqual(y.si, { basis: 'absolute', days: 38, vendorAnnualised: 216.4712 });
    assert.ok(near(y.r.SI!, 12.743, 5e-5));
    const o = fundOf(res.regular, 'Equity MF', 'Old Flexi Cap Fund');
    assert.deepEqual(o.si, { basis: 'annualised' });
    assert.ok(o.r.SI!.kind === 'value' && o.r.SI!.v === 9);
    assert.deepEqual(fundOf(res.regular, 'Equity MF', 'Newest Contra Fund').si, { basis: 'not-shown', why: 'under-30-days' });
  });

  test('Direct: the Direct block\'s own figure and price day: 263.9663% over 35 days to 30 Oct 2026 is 13.188%', () => {
    // 3.639663^(35/365) - 1 = e^(1.291891 x 0.0958904) - 1 = e^0.123880 - 1 = 13.188%
    const y = fundOf(res.direct!, 'Equity MF', 'Young Index Fund');
    assert.equal(y.key, 'Young Index Fund(G)-Direct Plan');
    assert.deepEqual(y.si, { basis: 'absolute', days: 35, vendorAnnualised: 263.9663 });
    assert.ok(near(y.r.SI!, 13.188, 5e-4), JSON.stringify(y.r.SI));
    assert.deepEqual(fundOf(res.direct!, 'Equity MF', 'Old Flexi Cap Fund').si, { basis: 'annualised' });
  });

  test('without a price day in the sources a young mutual fund is a dash, not a count to the label', () => {
    const { priceDay: _p, ...noDay } = SRC;
    const r = computePerformance(H, noDay);
    assert.deepEqual(fundOf(r.regular, 'Equity MF', 'Young Index Fund').si, { basis: 'not-shown', why: 'no-price-day' });
    assert.deepEqual(fundOf(r.regular, 'Equity MF', 'Old Flexi Cap Fund').si, { basis: 'annualised' });
  });

  test('PMS without dates: a strategy with a 1Y return keeps its figure; one without is a dash. Every SIF is a dash', () => {
    assert.deepEqual(fundOf(res.regular, 'PMS', 'Sample Old PMS').si, { basis: 'annualised' });
    assert.deepEqual(fundOf(res.regular, 'PMS', 'Sample New PMS').si, { basis: 'not-shown', why: 'no-inception' });
    for (const name of ['Sample Long-Short Fund', 'Sample Older SIF', 'Sample Only-SI SIF']) {
      assert.deepEqual(fundOf(res.regular, 'SIF', name).si, { basis: 'not-shown', why: 'basis-not-stated' }, name);
      assert.equal(fundOf(res.regular, 'SIF', name).r.SI!.kind, 'missing');
    }
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

  test('the note is true of every since-inception figure left on screen: absolute and marked, or of a fund a year old, or a dash', () => {
    for (const plan of ['regular', 'direct'] as const) {
      const list = plan === 'regular' ? res.regular : res.direct!;
      for (const b of list) for (const g of b.groups) for (const f of g.funds) {
        if (!f.r.SI || f.r.SI.kind !== 'value') continue;
        assert.ok(f.si && f.si.basis !== 'not-shown', `${b.key} ${f.name}: a figure with no stated basis`);
        assert.notEqual(b.key, 'SIF', 'no SIF since-inception figure is shown');
      }
    }
  });

  test('an absolute since-inception return carries the marker "a" and its note; the old fund\'s cell has none', () => {
    assert.equal(ABSOLUTE_MARKER, 'a');
    assert.deepEqual([rowOf('Equity MF', 'Young Index Fund').cells.SI!.text, rowOf('Equity MF', 'Young Index Fund').cells.SI!.marker], ['12.74%', 'a']);
    assert.deepEqual([rowOf('Equity MF', 'Old Flexi Cap Fund').cells.SI!.text, rowOf('Equity MF', 'Old Flexi Cap Fund').cells.SI!.marker], ['9.00%', null]);
    assert.ok(bucketVM('Equity MF').notes.includes('a: 1 fund is under one year old, so its since-inception return is shown as an absolute return, worked from the data\'s annualised figure over the days from the fund\'s inception to the day the data is priced to.'));
    assert.ok(!bucketVM('PMS').notes.some((n) => n.startsWith('a: ')));
  });

  test('a since-inception return that is not shown: a dash, and a note that names the funds and the reason', () => {
    assert.doesNotMatch(rowOf('Equity MF', 'Newest Contra Fund').cells.SI!.text, /[0-9]/);
    assert.ok(bucketVM('Equity MF').notes.includes('Since-inception return not shown for 1 fund (Newest Contra Fund): the fund is under 30 days old on the day its data is priced to, and one day of count is a large share of so young a figure.'));
    assert.doesNotMatch(rowOf('SIF', 'Sample Older SIF').cells.SI!.text, /[0-9]/);
    assert.ok(bucketVM('SIF').notes.includes('Since-inception return not shown for 3 funds (Sample Long-Short Fund, Sample Older SIF and Sample Only-SI SIF): the data does not state whether its since-inception return is annualised.'));
    assert.ok(bucketVM('PMS').notes.includes('Since-inception return not shown for 1 fund (Sample New PMS): the data gives no readable inception date and no return of one year or more.'));
    // a fund whose only figure is the since-inception return keeps its row; it is not "without returns in the data"
    assert.ok(rowOf('SIF', 'Sample Only-SI SIF') && rowOf('Equity MF', 'Newest Contra Fund'));
    assert.ok(!vm.buckets.some((b) => b.notes.some((n) => /no returns in the data/.test(n))));
  });

  test('nothing on screen names the price day (one label only)', () => {
    const text = JSON.stringify(vm);
    assert.doesNotMatch(text, /2 Nov 2026|30 Oct 2026|2026-11-02|2026-10-30/);
    assert.match(vm.buckets[0]!.title, /as on 31 Oct 2026/);
  });
});

describe('the Performance sheet: the absolute figure with its Note; a blank with its status and reason', () => {
  const sheet = performanceSheet(res);
  const keys = sheet.columns.map((c) => c.key);
  const at = (row: unknown[], k: string): unknown => { const c = row[keys.indexOf(k)] as { v?: unknown } | null; return c === null ? null : c?.v; };
  const row = (plan: string, name: string) => sheet.rows.find((r) => at(r, 'row') === 'Fund' && at(r, 'name') === name && at(r, 'plan') === plan)!;

  test('Regular and Direct rows of the young fund', () => {
    const r = row('Regular', 'Young Index Fund');
    assert.ok(Math.abs((at(r, 'SI') as number) - 12.743) < 5e-5);
    assert.equal(at(r, 'note'), 'SI is an absolute return over 38 days, from the fund\'s inception to the day its data is priced to: the fund is under one year old; the data\'s annualised figure is 216.4712%. No 3M, 6M, 1Y, 3Y, 5Y, 10Y figure in the data.');
    assert.equal(at(r, 'status'), STATUS.NOT_AVAILABLE, 'the tenors the fund has no figure for are still said');
    const d = row('Direct', 'Young Index Fund');
    assert.ok(Math.abs((at(d, 'SI') as number) - 13.188) < 5e-4);
    assert.match(String(at(d, 'note')), /^Direct\. SI is an absolute return over 35 days, .* annualised figure is 263\.9663%\. No /);
    assert.equal(at(row('Regular', 'Old Flexi Cap Fund'), 'note'), null);
    assert.equal(at(row('Regular', 'Old Flexi Cap Fund'), 'SI'), 9);
  });

  test('a since-inception return not shown: the cell blank, INSUFFICIENT EVIDENCE and the reason', () => {
    const s = row('Not applicable', 'Sample Older SIF');
    assert.equal(at(s, 'SI'), null);
    assert.equal(at(s, 'status'), STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(at(s, 'note'), 'SI: SIF_PERF does not state whether its since-inception return is annualised, so it is not shown.');
    const c = row('Regular', 'Newest Contra Fund');
    assert.equal(at(c, 'SI'), null);
    assert.match(String(at(c, 'note')), /SI: the fund is only 18 days old on the day its data is priced to \(inception 15 Oct 2026\)/);
    const p = row('Not applicable', 'Sample New PMS');
    assert.equal(at(p, 'SI'), null);
    assert.match(String(at(p, 'status')), /INSUFFICIENT EVIDENCE/);
    assert.match(String(at(p, 'note')), /SI: PMS_PERF gives no inception date and no return of one year or more/);
  });
});
