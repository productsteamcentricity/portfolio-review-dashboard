// covers: E-05 U-13 (PLAN-05, NB-03: the blank transactions (IRR) file template, the platform's cashflow file layout)
// The template read back as zip/XML and through SheetJS: the six flow sheets and the Read Me in order, the headings
// exactly as MOD-04's note of 26 Nov 2026 lists them (the rupee sign and the trailing spaces included), the frozen
// header, no data rows, the column-default number formats (date, money, price), the Read Me (one row per column, the
// accepted TRANSACTIONTYPE and TYPE values, the exact-name rule first, no en or em dash), deterministic bytes, and the
// round trip: the blank template filled with the synthetic cashflow rows (tests/fixtures/make-irr-files.ts
// cashflowSheets) reads back through parseIrrFile exactly as the fixture file itself does. Also the IRR slot's
// download through the store and the wiring.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIrrTemplate, irrTemplateFlowSheet, irrTemplateReadMe, IRR_TEMPLATE_BENCH_HEADERS, IRR_TEMPLATE_FILE_NAME,
  IRR_TEMPLATE_FUND_HEADERS, IRR_TEMPLATE_README, IRR_TEMPLATE_ROW_TYPES, IRR_TEMPLATE_RULES, IRR_TEMPLATE_SHEETS,
  IRR_TEMPLATE_TYPES_IN, IRR_TEMPLATE_TYPES_OUT,
} from '../../../app/src/exports/xlsx/irr-template.ts';
import { readWorkbook, cellText } from '../../../app/src/ingest/workbook.ts';
import { kindOf, parseIrrFile } from '../../../app/src/ingest/irr-file.ts';
import type { IrrFileImport, TransactionKind } from '../../../app/src/model/transactions.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { createStore } from '../../../app/src/ui/store.ts';
import { loadSheetJS, writeXlsx } from '../../helpers/sheetjs.ts';
import { unzip, partText } from '../../helpers/unzip.ts';
import { fakeWiring, memoryPrefs } from '../../helpers/sample-review.ts';
import { CASHFLOW_BENCH_HEADER, CASHFLOW_FUND_HEADER, cashflowSheets, irrFixtures } from '../../fixtures/make-irr-files.ts';
import type { Cell as FixtureCell } from '../../fixtures/make-irr-files.ts';

const xlsx = loadSheetJS();
const bytes = buildIrrTemplate();
const wb = readWorkbook(xlsx, bytes);
const SRC = 'b'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-26T00:00:00.000Z';

// MOD-04's note of 26 Nov 2026 §2, typed here by hand (headings only).
const XIRR_HEADINGS = ['CLIENT', 'ACCOUNT', 'INSTRUMENT', 'FOLIO_NO', 'AMOUNT (₹) ', 'PRICE (₹) ', 'TRXN_DATE', 'TRANSACTIONTYPE', 'CATEGORY', 'ASSET', 'PRODUCT', 'DISTRIBUTOR', 'TYPE'];
const BMXIRR_HEADINGS = ['CLIENT', 'ACCOUNT', 'INSTRUMENT', 'FOLIO_NO', 'BM_AMOUNT (₹) ', 'PRICE (₹) ', 'TRXN_DATE', 'TRANSACTIONTYPE', 'CATEGORY', 'ASSET', 'PRODUCT', 'DISTRIBUTOR', 'TYPE', 'INDEXNAME'];
const SHEET_NAMES = ['SI Xirr', 'SI Bmxirr', 'YTD Xirr', 'YTD Bmxirr', 'QTD Xirr', 'QTD Bmxirr'];
const isBench = (name: string): boolean => name.includes('Bmxirr');

/** The inline strings of row 1 of a sheet part, as written (no trimming). */
function row1Texts(xml: string): string[] {
  const row = /<row r="1"[^>]*>(.*?)<\/row>/s.exec(xml)![1]!;
  return [...row.matchAll(/<t xml:space="preserve">(.*?)<\/t>/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
}

describe('blank transactions (IRR) file template (PLAN-05)', () => {
  test('seven sheets: the six flow sheets of the cashflow layout in order, then Read Me', () => {
    assert.deepEqual(wb.sheets.map((s) => s.name), [...SHEET_NAMES, IRR_TEMPLATE_README]);
    assert.deepEqual(IRR_TEMPLATE_SHEETS.map((s) => [s.name, s.required]), SHEET_NAMES.map((n) => [n, n.startsWith('SI ')]));
  });

  test('the headings exactly, the rupee sign and the trailing spaces included, in the file and through SheetJS', () => {
    assert.deepEqual(IRR_TEMPLATE_FUND_HEADERS, XIRR_HEADINGS);
    assert.deepEqual(IRR_TEMPLATE_BENCH_HEADERS, BMXIRR_HEADINGS);
    // The synthetic cashflow fixture (the reader's own test file) uses the same layout.
    assert.deepEqual(IRR_TEMPLATE_FUND_HEADERS, CASHFLOW_FUND_HEADER);
    assert.deepEqual(IRR_TEMPLATE_BENCH_HEADERS, CASHFLOW_BENCH_HEADER);
    const parts = unzip(bytes);
    const raw = xlsx.read(bytes, { type: 'array' }) as unknown as { Sheets: Record<string, Record<string, { v?: unknown }>> };
    SHEET_NAMES.forEach((name, i) => {
      const want = isBench(name) ? BMXIRR_HEADINGS : XIRR_HEADINGS;
      assert.deepEqual(row1Texts(partText(parts, `xl/worksheets/sheet${i + 1}.xml`)), want, name);
      const ws = raw.Sheets[name]!;
      assert.deepEqual(want.map((_, c) => ws[xlsx.utils.encode_cell({ r: 0, c })]?.v), want, `${name} through SheetJS`);
    });
  });

  test('no data rows on the flow sheets; the header row frozen on all seven sheets', () => {
    for (const s of wb.sheets.slice(0, 6)) assert.equal(s.rows.length, 1, s.name);
    const parts = unzip(bytes);
    for (let n = 1; n <= 7; n++) {
      const xml = partText(parts, `xl/worksheets/sheet${n}.xml`);
      assert.ok(/<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(xml), `sheet${n}`);
    }
  });

  test('column-default number formats: TRXN_DATE a date, the amounts and PRICE money, the names text', () => {
    const parts = unzip(bytes);
    const styles = partText(parts, 'xl/styles.xml');
    const xfs = [...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)![1]!).matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
    const codes = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map((m) => [Number(m[1]), m[2]!.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')]));
    SHEET_NAMES.forEach((name, i) => {
      const headings = isBench(name) ? BMXIRR_HEADINGS : XIRR_HEADINGS;
      const sheet = partText(parts, `xl/worksheets/sheet${i + 1}.xml`);
      const colFmt = new Map([...sheet.matchAll(/<col min="(\d+)"[^>]* style="(\d+)"/g)].map((m) => [Number(m[1]), xfs[Number(m[2])]!]));
      assert.equal(colFmt.size, headings.length, `${name}: every column has a default style`);
      const fmtOf = (h: string): string | number => { const id = colFmt.get(headings.indexOf(h) + 1)!; return codes.get(id) ?? id; };
      assert.equal(fmtOf('TRXN_DATE'), NUM_FMT_CODES.date, name);
      assert.equal(fmtOf(isBench(name) ? 'BM_AMOUNT (₹) ' : 'AMOUNT (₹) '), NUM_FMT_CODES.money, name);
      assert.equal(fmtOf('PRICE (₹) '), NUM_FMT_CODES.money, name);
      for (const h of ['CLIENT', 'INSTRUMENT', 'FOLIO_NO', 'TYPE']) assert.equal(fmtOf(h), 49, `${name} ${h}: the built-in text format`);
    });
    assert.equal(irrTemplateFlowSheet('SI Xirr', 'fund').columns.find((c) => c.header === 'TRXN_DATE')!.defaultStyle?.fmt, 'date');
  });

  test('Read Me: one row per column, required or not, the accepted values, then the rules (the exact-name rule first)', () => {
    const s = wb.sheets[6]!;
    assert.deepEqual(s.rows[0]!.map((c) => cellText(c)), ['Column', 'Sheets', 'Required', 'What it holds', 'Accepted values']);
    const colRows = s.rows.slice(1, 16);
    assert.deepEqual(colRows.map((r) => cellText(r[0])), [...XIRR_HEADINGS.map((h) => h.trim()), 'BM_AMOUNT (₹)', 'INDEXNAME']);
    const req = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[2])]));
    for (const h of ['CLIENT', 'INSTRUMENT', 'TRXN_DATE']) assert.equal(req.get(h), 'Yes', h);
    assert.equal(req.get('AMOUNT (₹)'), 'Yes, on the Xirr sheets');
    assert.equal(req.get('BM_AMOUNT (₹)'), 'Yes, on the Bmxirr sheets');
    assert.equal(req.get('TYPE'), 'Yes, on the closing rows');
    for (const h of ['ACCOUNT', 'FOLIO_NO', 'PRICE (₹)', 'TRANSACTIONTYPE', 'CATEGORY', 'ASSET', 'PRODUCT', 'DISTRIBUTOR', 'INDEXNAME']) assert.equal(req.get(h), 'No', h);
    const sheets = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[1])]));
    assert.equal(sheets.get('AMOUNT (₹)'), 'Xirr only');
    assert.equal(sheets.get('INDEXNAME'), 'Bmxirr only');
    assert.equal(sheets.get('CLIENT'), 'Xirr and Bmxirr');

    // TRANSACTIONTYPE: every accepted value is a known kind of the reader (OD-16), and every kind is listed.
    const accepted = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[4])]));
    const typeText = accepted.get('TRANSACTIONTYPE')!;
    const kinds = new Set<TransactionKind>();
    for (const [list, dir] of [[IRR_TEMPLATE_TYPES_IN, 'in'], [IRR_TEMPLATE_TYPES_OUT, 'out']] as const) {
      for (const label of list) {
        assert.ok(typeText.includes(label), label);
        const k = kindOf(label, null);
        assert.equal(k.direction, dir, label);
        kinds.add(k.kind);
      }
    }
    assert.deepEqual([...kinds].sort(), ['bonus', 'demerger-in', 'purchase', 'redemption', 'sip', 'stock-in', 'stp-in', 'stp-out', 'switch-in', 'switch-out', 'swp', 'top-up', 'transfer-in', 'transfer-out']);
    // TYPE: Closing only; a Closing row is read as the instrument's valuation. "Valuation" in TYPE is not offered:
    // the reader would take such a row as an ordinary flow, so the template must not suggest it.
    assert.deepEqual(IRR_TEMPLATE_ROW_TYPES, ['Closing']);
    assert.equal(accepted.get('TYPE'), 'Closing');
    assert.equal(kindOf(null, 'Closing').kind, 'valuation');
    assert.notEqual(kindOf(null, 'Valuation').kind, 'valuation');

    // The rules, in order after a blank row; the owner's names rule first.
    const ruleRows = s.rows.slice(17);
    assert.equal(s.rows[16]!.length, 0, 'a blank row before the rules');
    assert.deepEqual(ruleRows.map((r) => cellText(r[0])), IRR_TEMPLATE_RULES.map((_, i) => `Rule ${i + 1}`));
    assert.deepEqual(ruleRows.map((r) => cellText(r[3])), IRR_TEMPLATE_RULES.map((t) => t.replace(/\s+/g, ' ').trim()));
    const rules = IRR_TEMPLATE_RULES.join('\n');
    assert.ok(IRR_TEMPLATE_RULES[0]!.includes('exactly as the Client Name in the holding report (the base file)'));
    assert.ok(IRR_TEMPLATE_RULES[0]!.includes('joined on the client name only, never by a similar name'));
    for (const t of ['plain numbers', 'money paid in is negative', 'as Excel dates', 'one closing row', 'as-on date',
      'DISTRIBUTOR is optional', 'unassigned line', 'Bmxirr sheets, mirroring the fund flows', 'SI sheets (since inception) are required',
      'YTD and QTD sheets', 'optional and are read in a later version']) assert.ok(rules.includes(t), t);
    assert.equal(irrTemplateReadMe().rows.length, 15 + 1 + IRR_TEMPLATE_RULES.length);
  });

  test('no en or em dash anywhere in the workbook (D-029)', () => {
    const parts = unzip(bytes);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (let n = 1; n <= 7; n++) assert.ok(!dashes.test(partText(parts, `xl/worksheets/sheet${n}.xml`)), `sheet${n}`);
    assert.ok(!dashes.test(partText(parts, 'xl/workbook.xml')));
  });

  test('deterministic bytes', () => {
    assert.equal(Buffer.compare(Buffer.from(buildIrrTemplate()), Buffer.from(bytes)), 0);
    assert.equal(IRR_TEMPLATE_FILE_NAME, 'Transactions (IRR) file template.xlsx');
  });
});

/** The blank template filled through SheetJS with the rows of `cashflowSheets` below each sheet's heading row. */
function filledTemplate(): Uint8Array {
  type Ws = Record<string, unknown>;
  const book = xlsx.read(buildIrrTemplate(), { type: 'array' }) as unknown as { SheetNames: string[]; Sheets: Record<string, Ws> };
  const addAoa = (xlsx.utils as unknown as { sheet_add_aoa(ws: Ws, aoa: unknown[][], o: { origin: string }): void }).sheet_add_aoa;
  for (const def of cashflowSheets()) {
    const ws = book.Sheets[def.name]!;
    const body = def.rows.slice(1);
    addAoa(ws, body.map((r) => r.map((c: FixtureCell) => (c !== null && typeof c === 'object' ? c.v : c))), { origin: 'A2' });
    body.forEach((r, ri) => r.forEach((c, ci) => {
      if (c !== null && typeof c === 'object') (ws[xlsx.utils.encode_cell({ r: ri + 1, c: ci })] as Record<string, unknown>).z = c.z;
    }));
  }
  return writeXlsx(xlsx, book);
}

describe('round trip: the filled template reads back through parseIrrFile', () => {
  const filled = parseIrrFile(readWorkbook(xlsx, filledTemplate()), { sourceId: SRC, now: NOW });
  const fixture = parseIrrFile(readWorkbook(xlsx, irrFixtures(xlsx).find((f) => f.id === 'irr-cashflow')!.bytes), { sourceId: SRC, now: NOW });

  test('the SI pair is read by name, header in row 1; the other sheets are not needed', () => {
    assert.deepEqual([filled.fundSheet?.name, filled.fundSheet?.found, filled.fundSheet?.headerRow], ['SI Xirr', 'by-name', 1]);
    assert.deepEqual([filled.benchSheet?.name, filled.benchSheet?.found, filled.benchSheet?.headerRow], ['SI Bmxirr', 'by-name', 1]);
    assert.deepEqual(filled.sheets.map((s) => [s.sheet, s.outcome]), [
      ['SI Xirr', 'used'], ['SI Bmxirr', 'used'], ['YTD Xirr', 'not-needed'], ['YTD Bmxirr', 'not-needed'],
      ['QTD Xirr', 'not-needed'], ['QTD Bmxirr', 'not-needed'], ['Read Me', 'not-needed'],
    ]);
  });

  test('every column is found: 13 on the Xirr sheet, 14 on the Bmxirr sheet (INDEXNAME)', () => {
    const fields = (imp: IrrFileImport, side: 'fund' | 'bench'): string[] => (side === 'fund' ? imp.fundSheet : imp.benchSheet)!.columns.map((c) => c.field);
    assert.deepEqual(fields(filled, 'fund'), ['client', 'account', 'instrument', 'folio', 'amount', 'price', 'date', 'type', 'category', 'asset', 'product', 'distributor', 'rowType']);
    assert.deepEqual(fields(filled, 'bench'), ['client', 'account', 'instrument', 'folio', 'amount', 'price', 'date', 'type', 'category', 'asset', 'product', 'distributor', 'rowType', 'benchmark']);
    assert.deepEqual(filled.fundSheet!.columns.map((c) => c.column), [...Array(13).keys()]);
  });

  test('no row skipped, no Warning: 7 fund and 5 benchmark flows, the same as the platform layout file', () => {
    assert.deepEqual([filled.fund.length, filled.bench.length, filled.skipped.length], [7, 5, 0]);
    assert.deepEqual(filled.issues.filter((i) => i.severity !== 'Information').map((i) => i.ruleId), []);
    assert.deepEqual(filled.issues.map((i) => i.ruleId), ['irr-file.sheet-used', 'irr-file.unassigned-flows']);
    assert.deepEqual(filled.fund, fixture.fund);
    assert.deepEqual(filled.bench, fixture.bench);
    assert.deepEqual(filled.counts, fixture.counts);
    assert.deepEqual(filled.asOn, fixture.asOn);
    assert.equal(filled.hasDistributor, true);
  });
});

describe('the IRR slot download (store and wiring)', () => {
  test('the store calls the wiring\'s template download at any stage, before any base file', () => {
    const { wiring } = fakeWiring();
    let saved = 0;
    const store = createStore({ wiring: { ...wiring, downloadIrrTemplate: () => { saved++; } }, prefs: memoryPrefs().prefs, logos: [] });
    assert.equal(store.get().upload.stage, null);
    store.downloadIrrTemplate();
    assert.equal(saved, 1);
  });
  test('a wiring without the download does nothing and throws nothing', () => {
    const { wiring } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    assert.doesNotThrow(() => store.downloadIrrTemplate());
  });
});
