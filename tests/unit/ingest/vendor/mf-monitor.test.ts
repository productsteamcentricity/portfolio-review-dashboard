// covers: E-06 OD-11 KI-026 KI-076 M2.3
// The MF Monitor reader (app/src/ingest/vendor/mf-monitor.ts) on synthetic Regular and Direct issues
// (tests/fixtures/make-monitors.ts). Every answer worked out by hand from the runtime parser and the monthly pipeline's
// rules (09_parsers.js:166-208; buildtools/build_refresh.js:93-137), never from the code under test.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMfMonitor } from '../../../../app/src/ingest/vendor/mf-monitor.ts';
import { directMonitor, getter, regularMonitor } from '../../../fixtures/make-monitors.ts';

const N = (o: Record<string, number | null>): Record<string, number | null> => ({ '1M': null, '3M': null, '6M': null, '1Y': null, '2Y': null, '3Y': null, '5Y': null, '10Y': null, SI: null, ...o });

describe('MF Monitor reader', () => {
  const reg = regularMonitor();
  const p = parseMfMonitor(reg.names, getter(reg));

  test('the data date is the first "As on" cell; seven schemes and three benchmarks', () => {
    assert.equal(p.date, '2026-Nov-02');
    assert.deepEqual(Object.keys(p.schemes).sort(), ['Alpha Flexi Cap Fund-Reg(G)', 'Alpha Gold ETF', 'Alpha Liquid Fund-Reg(G)', 'Alpha Nifty 50 Index Fund-Reg(G)', 'Beta Flexi Cap Fund-Reg(G)', 'Beta Liquid Fund-Reg(G)', 'Silver Spot Composite']);
    assert.deepEqual(Object.keys(p.benchmarks).sort(), ['crisilliquiddebtindex', 'domesticpriceofgold', 'nifty50']);
  });

  test('an equity scheme: AUM rounded to 6 places, returns, market-cap shares, the inception date read in IST', () => {
    assert.deepEqual(p.schemes['Alpha Flexi Cap Fund-Reg(G)'], {
      type: 'equity', sheet: 'Flexi Cap Fund', inception: '2015-01-15', aum: 1234.567891,
      r: { '1M': 1.1, '3M': 2.2, '6M': 3.3, '1Y': 4.4, '2Y': 5.5, '3Y': 6.6, '5Y': 7.7, '10Y': 8.8, SI: 9.9 },
      mcap: { Large: 60, Mid: 25, Small: 10, Others: 5 },
    });
  });

  test('placeholders read as empty; a later sheet\'s row of the same name replaces the earlier one', () => {
    assert.deepEqual(p.schemes['Beta Flexi Cap Fund-Reg(G)'], {
      type: 'other', sheet: 'Gold', inception: '2015-01-15', aum: 1300,
      r: N({ '1M': 9, '1Y': 9, SI: 9 }), mcap: { Large: null, Mid: null, Small: null, Others: null },
    });
  });

  test('AUM from an "AUM (Cr.)" label row above the header (the pipeline)', () => {
    assert.equal(p.schemes['Alpha Nifty 50 Index Fund-Reg(G)']?.aum, 777.25);
    assert.equal(p.stats.aumFromLabel, 1);
  });

  test('a debt scheme: AUM from "in Rs.(Cr)", debt figures rounded to 4 places; all-empty debt figures drop the block', () => {
    assert.deepEqual(p.schemes['Alpha Liquid Fund-Reg(G)'], {
      type: 'debt', sheet: 'Liquid', inception: '2010-01-01', aum: 5000.125, r: N({ '1M': 0.55, '1Y': 6.9, SI: 7.1 }),
      mcap: { Large: null, Mid: null, Small: null, Others: null }, debt: { YTM: 6.9877, AvgMat: 0.1235, ModDur: 0.1112 },
    });
    assert.equal(p.schemes['Beta Liquid Fund-Reg(G)']?.debt, undefined);
  });

  test('benchmarks: the TRI row is kept over its price twin; CRISIL and gold-price rows are benchmarks', () => {
    assert.deepEqual(p.benchmarks['nifty50'], { name: 'NIFTY 50 - TRI', r: { '1M': 1.1, '3M': 1.2, '6M': 1.3, '1Y': 1.4, '2Y': 1.5, '3Y': 1.6, '5Y': 1.7, '10Y': 1.8, SI: 1.9 } });
    assert.deepEqual(p.benchmarks['crisilliquiddebtindex']?.r, N({ '1M': 0.6, '1Y': 7, SI: 7.2 }));
    assert.equal(p.benchmarks['domesticpriceofgold']?.name, 'Domestic Price of Gold');
  });

  test('a row with no AUM, date, market cap or fund word is marked bm; an ETF is not', () => {
    assert.equal(p.schemes['Silver Spot Composite']?.bm, true);
    assert.equal(p.schemes['Alpha Gold ETF']?.bm, undefined);
    assert.equal(p.stats.bm, 1);
  });

  test('Direct: an unnamed sheet takes the Regular sibling\'s category, else the majority of its sheet-mates', () => {
    const dir = directMonitor();
    const d = parseMfMonitor(dir.names, getter(dir), p.schemes);
    assert.equal(d.date, '31-Oct-2026');
    assert.deepEqual([d.schemes['Alpha Flexi Cap Fund(G)-Direct Plan']?.sheet, d.schemes['Alpha Flexi Cap Fund(G)-Direct Plan']?.type], ['Flexi Cap Fund', 'equity']);
    assert.deepEqual([d.schemes['Gamma Direct Only Fund(G)-Direct Plan']?.sheet, d.schemes['Gamma Direct Only Fund(G)-Direct Plan']?.type], ['Flexi Cap Fund', 'equity']);
    assert.deepEqual(d.schemes['Gamma Direct Only Fund(G)-Direct Plan']?.mcap, { Large: 40, Mid: 40, Small: 10, Others: 10 });
    assert.deepEqual([d.stats.sheetMapped, d.stats.sheetMappedByMajority, d.stats.sheetUnmapped], [1, 1, 0]);
    /* without the Regular parse the unnamed sheet keeps its own name */
    assert.equal(parseMfMonitor(dir.names, getter(dir)).schemes['Gamma Direct Only Fund(G)-Direct Plan']?.sheet, 'Sheet43');
  });
});
