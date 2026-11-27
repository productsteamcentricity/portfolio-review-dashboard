// covers: U-08 U-09 U-10 E-06 E-07 OD-11 M2.1
// Section 1's monitor uploads (app/src/ingest/load-monitor.ts): a synthetic MF Monitor (Regular and Direct) and SIF
// Monitor written to real workbooks with SheetJS and read back through the upload path give exactly what the sprint 3a
// readers give on the same rows, as the embedded blocks' shape; a file that is not a workbook, or holds no scheme, is
// refused with the reason.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isMonitorError, loadMonitor, refArea, type MonitorSheetJS } from '../../../app/src/ingest/load-monitor.ts';
import { parseMfMonitor } from '../../../app/src/ingest/vendor/mf-monitor.ts';
import { directMonitor, regularMonitor, type Workbook } from '../../fixtures/make-monitors.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const X = loadSheetJS() as unknown as MonitorSheetJS & { utils: Record<string, (...a: unknown[]) => unknown>; write(wb: unknown, o: Record<string, unknown>): ArrayBuffer };
function toBytes(w: Workbook): Uint8Array {
  const wb = X.utils['book_new']!();
  for (const n of w.names) X.utils['book_append_sheet']!(wb, X.utils['aoa_to_sheet']!(w.sheets[n] ?? [], { cellDates: true }), n);
  return new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }));
}
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('loadMonitor', () => {
  const reg = regularMonitor();
  const direct = directMonitor();

  test('a Regular MF Monitor gives MF_PERF and BENCH_RET as the reader does on the same rows', () => {
    const m = loadMonitor('mf-regular', toBytes(reg), 'Daily MF Monitor.xlsx', X);
    assert.ok(!isMonitorError(m));
    const want = parseMfMonitor(reg.names, (s) => reg.sheets[s]);
    assert.deepEqual(plain(m.blocks.MF_PERF), plain(want.schemes));
    assert.deepEqual(plain(m.blocks.BENCH_RET), plain(want.benchmarks));
    assert.equal(m.schemes, Object.keys(want.schemes).length);
    assert.equal(m.blocks.MF_PERF_DIRECT, undefined);
    assert.match(m.sha256, /^[0-9a-f]{64}$/);
    assert.equal(m.date, want.date);
  });

  test('a Direct issue gives MF_PERF_DIRECT, its unnamed sheets mapped through the Regular schemes', () => {
    const regular = (loadMonitor('mf-regular', toBytes(reg), 'r.xlsx', X) as { blocks: { MF_PERF: Record<string, never> } }).blocks.MF_PERF;
    const m = loadMonitor('mf-direct', toBytes(direct), 'd.xlsx', X, regular);
    assert.ok(!isMonitorError(m));
    const want = parseMfMonitor(direct.names, (s) => direct.sheets[s], regular);
    assert.deepEqual(plain(m.blocks.MF_PERF_DIRECT), plain(want.schemes));
    assert.equal(m.blocks.MF_PERF, undefined);
    assert.equal(m.blocks.BENCH_RET, undefined, 'the benchmarks come from the Regular issue');
  });

  test('a SIF Monitor gives SIF_PERF', () => {
    const rows = [
      ['Home'], ['SIF Monitor as on 31 Oct 2026'],
      ['Scheme Name', 'Category', 'AUM (Cr.)', '1 Day', '1 Week', '1 Month', '3 Months', 'Since Inception', 'Inception Date', '[Fund Manager 1]', 'Month End'],
      ['Category : Equity Long-Short Fund'],
      ['Alpha Equity Long-Short Fund-Reg(G)', 'Equity Long-Short Fund', 1534.97, 0.1, 0.5, -4.9, 2.25, 3.5, '2026-06-08', 'A. Manager', 'Alpha'],
    ];
    const m = loadMonitor('sif', toBytes({ names: ['SIF'], sheets: { SIF: rows } }), 's.xlsx', X);
    assert.ok(!isMonitorError(m));
    assert.deepEqual(Object.keys(m.blocks.SIF_PERF ?? {}), ['Alpha Equity Long-Short Fund-Reg(G)']);
    assert.equal(m.date, '31 Oct 2026');
  });

  test('refusals: not a workbook; a workbook with no scheme (for example a base file)', () => {
    const a = loadMonitor('mf-regular', new TextEncoder().encode('this is not a workbook'), 'x.xlsx', X);
    assert.ok(isMonitorError(a));
    const b = loadMonitor('mf-regular', toBytes({ names: ['Base File'], sheets: { 'Base File': [['Client Name', 'Instrument Name'], ['A', 'B']] } }), 'b.xlsx', X);
    assert.ok(isMonitorError(b));
    assert.equal(b.reason, 'not-a-monitor');
    assert.match(b.message, /is this an MF Monitor \(Regular\)\?/);
  });

  test('a sheet declaring more cells than the limit is refused before it is expanded (CHAT-008 N2)', () => {
    /* the workbook object as SheetJS would return it: two cells, a range declared over the whole sheet (writing such a
       file would itself expand it, so the spy hands the object back instead of parsing bytes) */
    const ws = X.utils['aoa_to_sheet']!([['Scheme Name'], ['Sample Fund']]) as Record<string, unknown>;
    ws['!ref'] = 'A1:XFD1048576';
    let expanded = 0;
    const spy: MonitorSheetJS = {
      read: () => ({ SheetNames: ['Padded'], Sheets: { Padded: ws } }),
      utils: { sheet_to_json: (s, o) => { expanded++; return X.utils.sheet_to_json(s, o); } },
    };
    const r = loadMonitor('mf-regular', new Uint8Array([1, 2, 3]), 'p.xlsx', spy);
    assert.ok(isMonitorError(r));
    assert.equal(r.reason, 'too-many-cells');
    assert.match(r.message, /the sheet "Padded" declares more cells than the limit/);
    assert.equal(expanded, 0, 'never expanded');
  });

  test('refArea: the declared range\'s cell count', () => {
    assert.equal(refArea('A1:C10'), 30);
    assert.equal(refArea('B7'), 1);
    assert.equal(refArea('$A$1:$XFD$1048576'), 16384 * 1048576);
    assert.equal(refArea(undefined), 0);
    assert.equal(refArea('not a range'), 0);
    /* CHAT-008: a range without row numbers (a whole column) reads as 0, so such a sheet is not refused early and its
       cells are counted after expansion, as before (the count after sheet_to_json still applies the limit) */
    assert.equal(refArea('A:A'), 0);
    assert.equal(refArea('A:XFD'), 0);
  });
});
