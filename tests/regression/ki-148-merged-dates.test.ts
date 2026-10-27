// covers: E-01 E-02 KI-141 KI-148 D-041
// KI-148, part 1 (D-041 point 2; the M1.4 fix round 2, N2): a merged holding is dated by the EARLIEST purchase date of
// its folios, whatever the row order, and its holding days are recomputed from it. A folio's purchase date plus its
// holding days is the date the file counts to; when every folio with holding days has a date and they count to one
// date (within a day), the merged days are the earliest folio's own figure, or, when it has none, the days from its
// date to that date. Folios without a purchase date and with the same holding days keep that figure. Otherwise the
// days are blank, never one folio's figure, with an Information notice in the live page's words.
//
// The known answers are those of the live page's own test (tools/regression/KI-141-merged-purchase-date.js), ported
// here: every case runs through BOTH readers on the same workbook bytes (the live page's parseBaseRows through
// tools/engine-host.js, and app/src/ingest/base-file.ts), and both must give the hand-worked answer. Day counts are
// worked out with Date.UTC, apart from the code under test: 16 Jan 2023 to 30 Sep 2026 is 1353 days, 10 Mar 2025 to
// 30 Sep 2026 is 569. Synthetic rows only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../app/src/model/holding.ts';
import type { LegacyRow } from '../parity/base-file-compare.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile, type BaseFileImport } from '../../app/src/ingest/base-file.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { formatDay } from '../../app/src/engine/dates.ts';
import { legacyParse } from '../parity/base-file-compare.ts';
import { writeXlsx, type SheetJS } from '../helpers/sheetjs.ts';
import { loadLegacyHost, MERGED_DATE_CASES, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';

const host = loadLegacyHost();
const xlsx = host.XLSX as SheetJS;
const SRC = 'a'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-27T00:00:00.000Z';

const day = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 86400000;
const D_OLD = day(2026, 9, 30) - day(2023, 1, 16);
const D_NEW = day(2026, 9, 30) - day(2025, 3, 10);

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Folio No', 'Units',
  'Current Market Value (Cr.)', 'Avg. Holding Days', 'Purchase Date'];
type Cell = string | number | Date | null;
const folio = (f: string, date: Cell, days: number | null): Cell[] =>
  ['Sample Client', 'Sample Growth Fund', 'Equity', 'Mutual Funds', 'Sample Distributor', f, 10, 1, days, date];

function bytesOf(rows: Cell[][], header: string[] = HDR, cellDates = false): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([header, ...rows], cellDates ? { cellDates: true } : {}), 'Base File');
  return writeXlsx(xlsx, wb);
}

type Both = { legacy: { rows: LegacyRow[]; notices: Array<{ text: string; warn: boolean }> }; imp: BaseFileImport };
function both(bytes: Uint8Array): Both {
  return { legacy: legacyParse(host, bytes), imp: parseBaseFile(readWorkbook(xlsx, bytes), { sourceId: SRC, now: NOW }) };
}
const dateOf = (h: Holding): string | null => (h.purchaseDate.kind === 'value' ? formatDay(h.purchaseDate.v) : null);
const daysOf = (h: Holding): number | null => (h.holdingDays.kind === 'value' ? h.holdingDays.v : null);
const BLANK_NOTICE = '1 merged holding has folios whose holding days do not count to one date: the holding days are left blank.';

/** One merged holding read by both readers; both must give `date` (null: none) and `days` (null: blank). */
function expectOne(rows: Cell[][], date: string | null, days: number | null, blankNotice: boolean, header?: string[]): void {
  const { legacy, imp } = both(bytesOf(rows, header));
  assert.equal(legacy.rows.length, 1, 'legacy: one merged holding');
  assert.equal(imp.holdings.length, 1, 'new: one merged holding');
  const l = legacy.rows[0]!;
  const n = imp.holdings[0]!;
  assert.deepEqual([l.purchaseDate === '' ? null : l.purchaseDate, l.days ?? null], [date, days], 'the live page');
  assert.deepEqual([dateOf(n), daysOf(n)], [date, days], 'the new reader');
  const ln = legacy.notices.find((x) => /holding days/.test(x.text));
  const nn = imp.issues.find((i) => i.ruleId === 'base-file.merge-days-blank');
  if (blankNotice) {
    assert.deepEqual([ln?.text, ln?.warn], [BLANK_NOTICE, false], 'the live page says so, as information');
    assert.deepEqual([nn?.severity, nn?.count, nn?.message, nn?.decision], ['Information', 1, BLANK_NOTICE, 'D-041']);
    assert.deepEqual(nn!.scope, { kind: 'holdings', holdingIds: [n.id] });
    assert.equal(n.holdingDays.kind === 'missing' && n.holdingDays.status, STATUS.INSUFFICIENT_EVIDENCE);
  } else {
    assert.equal(ln, undefined, 'the live page has no notice');
    assert.equal(nn, undefined, 'the new reader has no notice');
  }
}

describe('KI-148: merged purchase date and holding days, both readers (D-041 point 2)', () => {
  test('independent day counts', () => {
    assert.deepEqual([D_OLD, D_NEW], [1353, 569]);
  });

  test('the earliest purchase date, whatever the row order; the days counted to the file\'s own date', () => {
    expectOne([folio('A', '10-03-2025', D_NEW), folio('B', '16-01-2023', D_OLD)], '16 Jan 2023', 1353, false);
    expectOne([folio('B', '16-01-2023', D_OLD), folio('A', '10-03-2025', D_NEW)], '16 Jan 2023', 1353, false);
  });

  test('the earliest folio has no holding days: recomputed from its date to the date the other counts to', () => {
    // 10 Mar 2025 + 569 days = 30 Sep 2026; 16 Jan 2023 to 30 Sep 2026 = 1353.
    expectOne([folio('A', '10-03-2025', D_NEW), folio('B', '16-01-2023', null)], '16 Jan 2023', 1353, false);
  });

  test('folios that count to dates one day apart agree: the earliest folio\'s own figure, no notice', () => {
    expectOne([folio('A', '10-03-2025', D_NEW), folio('B', '16-01-2023', D_OLD + 1)], '16 Jan 2023', 1354, false);
  });

  test('blank rather than one folio\'s figure, with a notice: KI-141\'s example in both orders', () => {
    // 16 Jan 2023 + 900 = 4 Jul 2025; 10 Mar 2025 + 200 = 26 Sep 2025: not one date.
    assert.equal(day(2023, 1, 16) + 900, day(2025, 7, 4));
    assert.equal(day(2025, 3, 10) + 200, day(2025, 9, 26));
    expectOne([folio('A', '16-01-2023', 900), folio('B', '10-03-2025', 200)], '16 Jan 2023', null, true);
    expectOne([folio('B', '10-03-2025', 200), folio('A', '16-01-2023', 900)], '16 Jan 2023', null, true);
  });

  test('a folio with holding days but no date: the earliest known date, the days blank', () => {
    expectOne([folio('A', '10-03-2025', D_NEW), folio('B', null, 700)], '10 Mar 2025', null, true);
  });

  test('no Purchase Date column: the same holding days stand, different ones are blank', () => {
    const noDate = HDR.slice(0, -1);
    expectOne([folio('A', null, 500).slice(0, -1), folio('B', null, 500).slice(0, -1)], null, 500, false, noDate);
    expectOne([folio('A', null, 500).slice(0, -1), folio('B', null, 700).slice(0, -1)], null, null, true, noDate);
  });

  test('no holding days at all: the earliest date, the days blank without a notice; a single folio keeps its own', () => {
    expectOne([folio('A', '10-03-2025', null), folio('B', '16-01-2023', null)], '16 Jan 2023', null, false);
    expectOne([folio('A', '10-03-2025', D_NEW)], '10 Mar 2025', 569, false);
  });

  test('through date cells (local midnight, as Excel stores a date) and a text date that is earlier', () => {
    const local = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);
    const value = (f: string, days: number, date: Cell): Cell[] =>
      ['Sample Client', 'Sample Value Fund', 'Equity', 'Mutual Funds', 'Sample Distributor', f, 5, 1, days, date];
    const bytes = bytesOf([folio('A', local(2025, 3, 10), D_NEW), folio('B', local(2023, 1, 16), D_OLD),
      value('C', D_NEW, local(2025, 3, 10)), value('D', D_OLD, '16 Jan 2023')], HDR, true);
    const { legacy, imp } = both(bytes);
    for (const name of ['Sample Growth Fund', 'Sample Value Fund']) {
      const l = legacy.rows.find((r) => r.name === name)!;
      const n = imp.holdings.find((h) => h.instrumentName === name)!;
      assert.deepEqual([l.purchaseDate, l.days], ['16 Jan 2023', 1353], `the live page, ${name} (TZ ${process.env.TZ ?? 'system'})`);
      assert.deepEqual([dateOf(n), daysOf(n)], ['16 Jan 2023', 1353], `the new reader, ${name} (TZ ${process.env.TZ ?? 'system'})`);
    }
  });
});

describe('KI-148: the merged-dates fixture (tests/fixtures/make-books.ts), both readers', () => {
  const f = syntheticFixtures(xlsx).find((x) => x.id === 'syn-merged-dates')!;
  const { legacy, imp } = both(f.bytes);

  test('each of holdings 0 to 5 merges two folios and takes the hand-worked date and days on both sides', () => {
    assert.equal(imp.holdings.length, 6);
    assert.equal(imp.counts.mergedRows, 6);
    MERGED_DATE_CASES.forEach((c, i) => {
      const name = SYNTHETIC_BOOK[i]!.name;
      const l = legacy.rows.find((r) => r.name === name)!;
      const n = imp.holdings.find((h) => h.instrumentName === name)!;
      assert.equal(n.rows.length, 2, name);
      assert.deepEqual([l.purchaseDate === '' ? null : l.purchaseDate, l.days ?? null], [c.date, c.days], `the live page, ${name}: ${c.why}`);
      assert.deepEqual([dateOf(n), daysOf(n)], [c.date, c.days], `the new reader, ${name}: ${c.why}`);
    });
  });

  test('one notice for the two holdings whose days are blank (holdings 1 and 4), in the live page\'s words', () => {
    const nn = imp.issues.find((i) => i.ruleId === 'base-file.merge-days-blank')!;
    assert.deepEqual([nn.severity, nn.count, nn.status], ['Information', 2, 'resolved']);
    assert.equal(nn.message, '2 merged holdings have folios whose holding days do not count to one date: the holding days are left blank.');
    assert.deepEqual(nn.scope, { kind: 'holdings', holdingIds: [imp.holdings[1]!.id, imp.holdings[4]!.id] });
    assert.ok(legacy.notices.some((x) => x.text === nn.message && !x.warn), 'the live page says the same');
  });

  test('the amounts are untouched: each holding\'s market value is the sum of its two folios (60% and 40%)', () => {
    imp.holdings.forEach((h, i) => {
      const b = SYNTHETIC_BOOK[i]!;
      // Each folio's Crore cell is its share in rupees, rounded to paise, over 1e7, written to four decimals.
      const cr = (share: number): number => Math.round((Math.round(b.mv * share * 100) / 100 / 1e7) * 1e4) / 1e4;
      const want = cr(0.6) + cr(0.4);
      assert.ok(h.cmv.kind === 'value' && Math.abs(h.cmv.v - want) < 1e-9, h.instrumentName);
    });
  });
});
