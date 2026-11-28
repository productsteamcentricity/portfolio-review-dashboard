// covers: U-06 E-01 E-15 M2.2 (NB-05: the blank base file template, the platform's holding report cut to 17 columns)
// The template read back as zip/XML and through SheetJS: the two sheets, the 17 headings exactly as the layout of
// 26 Nov 2026 lists them (MOD-04's selection under the owner's answer of that day; typed here by hand; each is also a heading of the full holding report, in its order), the
// frozen header, no data rows, the column-default number formats (none on the two XIRR columns), the Read Me (one row
// per column, the rules, the product list), no en or em dash, deterministic bytes. Then the known answers:
//   - the blank template filled with two synthetic rows reads back through the real reader with no result at all, every
//     column but "Valuation Date" used (KI-320), and each value as typed (rupees to Crore by hand);
//   - the Read Me's product list against data/refdata/PRODUCT_CLASS_RULES.json as committed: every row's example
//     classifies as the row says, every label of the table is in the list, and no other label is;
//   - the Read Me's asset values and its two sentences on a blank and an unknown product against the reader;
//   - the Read Me's ISIN sentence against the committed match context (the financial review's T-1): a listed share
//     is found by its ISIN whatever its name, and a fund is not, while the context holds no fund ISIN;
//   - the words of the two conditional product rows against the rule's own word lists, and every row through the real
//     matcher (matchLoaded on the committed context), not a copy of its routing (T-2, T-7).
// Also the Templates group's download through the store and the wiring.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  baseTemplateReadAs, baseTemplateReadMe, baseTemplateSheet, buildBaseTemplate, BASE_TEMPLATE_ASSETS, BASE_TEMPLATE_ASSET_SYNONYMS,
  BASE_TEMPLATE_COLUMNS, BASE_TEMPLATE_DOLLAR_WORDS, BASE_TEMPLATE_FILE_NAME, BASE_TEMPLATE_GIFT_WORDS, BASE_TEMPLATE_HEADERS,
  BASE_TEMPLATE_ISIN_TEXT, BASE_TEMPLATE_PRODUCTS, BASE_TEMPLATE_PRODUCT_NOTE,
  BASE_TEMPLATE_README, BASE_TEMPLATE_RULES, BASE_TEMPLATE_SHEET, BASE_TEMPLATE_UNREAD_HEADERS,
} from '../../../app/src/exports/xlsx/base-template.ts';
import { readWorkbook, cellText } from '../../../app/src/ingest/workbook.ts';
import { DEFAULT_PRODUCT, parseBaseFile, PREFERRED_SHEET, XIRR_FRACTION_LIMIT } from '../../../app/src/ingest/base-file.ts';
import { holdingClass, nonMfRule, parseProductClassRulesDetailed } from '../../../app/src/engine/match/product-class.ts';
import { isDirectEquityProduct, matchLoaded } from '../../../app/src/engine/match/resolve-holdings.ts';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { committedMatchContext } from '../../helpers/match-blocks.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';
import { readAssetLabel } from '../../../app/src/engine/classify/asset.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { createStore } from '../../../app/src/ui/store.ts';
import { loadSheetJS, REPO, writeXlsx } from '../../helpers/sheetjs.ts';
import { unzip, partText } from '../../helpers/unzip.ts';
import { fakeWiring, memoryPrefs } from '../../helpers/sample-review.ts';
import { HOLDING_REPORT_HEADINGS } from '../../fixtures/holding-report.ts';

const xlsx = loadSheetJS();
const bytes = buildBaseTemplate();
const wb = readWorkbook(xlsx, bytes);
const SRC = 'c'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-28T00:00:00.000Z';

// The 17-column layout (MOD-04's note of 26 Nov 2026, section 6.2: its selection under the owner's answer), typed here by hand; the two rupee headings
// with the platform's trailing space.
const HEADINGS = ['Client Name', 'Account Name', 'Instrument Name', 'Isin Code', 'Category Name', 'Asset Name', 'Folio No',
  'Product Name', 'Distributor Name', 'Units', 'Invested Value (₹) ', 'Market Value (₹) ', 'Valuation Date', 'Purchase Date',
  'Avg. Holding Days', 'XIRR (%)', 'BMXIRR (%)'];

function row1Texts(xml: string): string[] {
  const row = /<row r="1"[^>]*>(.*?)<\/row>/s.exec(xml)![1]!;
  return [...row.matchAll(/<t xml:space="preserve">(.*?)<\/t>/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
}

describe('blank base file template', () => {
  test('two sheets: "Base File" (the sheet the reader tries first), then Read Me', () => {
    assert.deepEqual(wb.sheets.map((s) => s.name), ['Base File', 'Read Me']);
    assert.equal(BASE_TEMPLATE_SHEET, PREFERRED_SHEET);
    assert.equal(BASE_TEMPLATE_README, 'Read Me');
  });

  test('the 17 headings exactly, in the file and through SheetJS; each a heading of the full holding report, in its order', () => {
    assert.equal(HEADINGS.length, 17);
    assert.deepEqual(BASE_TEMPLATE_HEADERS, HEADINGS);
    assert.equal(BASE_TEMPLATE_COLUMNS.length, 17);
    assert.equal(new Set(BASE_TEMPLATE_COLUMNS).size, 17);
    assert.deepEqual(row1Texts(partText(unzip(bytes), 'xl/worksheets/sheet1.xml')), HEADINGS);
    const ws = (xlsx.read(bytes, { type: 'array' }) as unknown as { Sheets: Record<string, Record<string, { v?: unknown }>> }).Sheets['Base File']!;
    assert.deepEqual(HEADINGS.map((_, c) => ws[xlsx.utils.encode_cell({ r: 0, c })]?.v), HEADINGS);
    const full: readonly string[] = HOLDING_REPORT_HEADINGS;
    const at = HEADINGS.map((h) => full.indexOf(h));
    assert.ok(at.every((i) => i >= 0), 'every template heading is one of the report\'s 34');
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'in the report\'s order');
  });

  test('no data rows; the header row frozen on both sheets', () => {
    assert.equal(wb.sheets[0]!.rows.length, 1);
    const parts = unzip(bytes);
    for (const n of [1, 2]) {
      assert.ok(/<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(partText(parts, `xl/worksheets/sheet${n}.xml`)), `sheet${n}`);
    }
  });

  test('column-default formats: names, ISIN and folio text; units; rupees; dates; days; none on XIRR and BMXIRR', () => {
    const parts = unzip(bytes);
    const styles = partText(parts, 'xl/styles.xml');
    const xfs = [...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)![1]!).matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
    const codes = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map((m) => [Number(m[1]), m[2]!.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')]));
    const sheet = partText(parts, 'xl/worksheets/sheet1.xml');
    const colFmt = new Map([...sheet.matchAll(/<col min="(\d+)"[^>]* style="(\d+)"/g)].map((m) => [Number(m[1]), xfs[Number(m[2])]!]));
    const fmtOf = (h: string): string | number | undefined => { const id = colFmt.get(HEADINGS.indexOf(h) + 1); return id === undefined ? undefined : codes.get(id) ?? id; };
    for (const h of ['Client Name', 'Account Name', 'Instrument Name', 'Isin Code', 'Category Name', 'Asset Name', 'Folio No', 'Product Name', 'Distributor Name']) {
      assert.equal(fmtOf(h), 49, `${h}: the built-in text format`);
    }
    assert.equal(fmtOf('Units'), NUM_FMT_CODES.units);
    assert.equal(fmtOf('Invested Value (₹) '), NUM_FMT_CODES.money);
    assert.equal(fmtOf('Market Value (₹) '), NUM_FMT_CODES.money);
    assert.equal(fmtOf('Valuation Date'), NUM_FMT_CODES.date);
    assert.equal(fmtOf('Purchase Date'), NUM_FMT_CODES.date);
    assert.equal(fmtOf('Avg. Holding Days'), 3, 'the built-in whole-number format');
    // A percent format on a pasted 8.79 would be read as 879%: the two columns carry no format.
    for (const h of ['XIRR (%)', 'BMXIRR (%)']) {
      assert.ok([undefined, 0].includes(fmtOf(h) as number | undefined), `${h}: General`);
      assert.equal(baseTemplateSheet().columns.find((c) => c.header === h)!.defaultStyle, undefined, h);
    }
    assert.ok(!/%/.test(codes.get(colFmt.get(16) ?? -1) ?? ''), 'no percent sign in the XIRR column format');
  });

  test('Read Me: one row per column, required or not, then the rules, then the product names', () => {
    const s = wb.sheets[1]!;
    assert.deepEqual(s.rows[0]!.map((c) => cellText(c)), ['Column', 'Required', 'What it holds', 'Accepted values']);
    const colRows = s.rows.slice(1, 18);
    assert.deepEqual(colRows.map((r) => cellText(r[0])), HEADINGS.map((h) => h.trim()));
    const req = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[1])]));
    for (const h of ['Client Name', 'Instrument Name', 'Market Value (₹)']) assert.equal(req.get(h), 'Yes', h);
    assert.equal(req.get('Asset Name'), 'Yes, for the allocation');
    for (const h of ['Account Name', 'Isin Code', 'Category Name', 'Folio No', 'Product Name', 'Distributor Name', 'Units', 'Invested Value (₹)',
      'Valuation Date', 'Purchase Date', 'Avg. Holding Days', 'XIRR (%)', 'BMXIRR (%)']) assert.equal(req.get(h), 'No', h);
    const what = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[2])]));
    assert.ok(what.get('Valuation Date')!.includes('this version does not read it'));
    assert.ok(what.get('Account Name')!.includes('No figure and no grouping uses it in this version'));
    assert.ok(what.get('Account Name')!.includes('the import report counts the different names'));
    assert.ok(what.get('Account Name')!.includes('Never enter a PAN'));
    assert.ok(what.get('Account Name')!.includes('and so is any text shaped like one (five letters, four digits and a letter, run together)'));
    assert.equal(what.get('Isin Code'), BASE_TEMPLATE_ISIN_TEXT);
    assert.ok(what.get('Purchase Date')!.includes('four-digit year'));
    assert.ok(what.get('Market Value (₹)')!.includes('left out of every total and listed'));
    const accepted = new Map(colRows.map((r) => [cellText(r[0]), cellText(r[3])]));
    for (const a of [...BASE_TEMPLATE_ASSETS, ...BASE_TEMPLATE_ASSET_SYNONYMS]) assert.ok(accepted.get('Asset Name')!.includes(a), a);
    assert.equal(accepted.get('XIRR (%)'), 'A percent number: 8.79 means 8.79%.');

    assert.equal(s.rows[18]!.length, 0, 'a blank row before the rules');
    const ruleRows = s.rows.slice(19, 19 + BASE_TEMPLATE_RULES.length);
    assert.deepEqual(ruleRows.map((r) => cellText(r[0])), BASE_TEMPLATE_RULES.map((_, i) => `Rule ${i + 1}`));
    assert.deepEqual(ruleRows.map((r) => cellText(r[2])), [...BASE_TEMPLATE_RULES]);
    assert.ok(BASE_TEMPLATE_RULES[0]!.includes('exactly as the CLIENT of the transactions (IRR) file, letter for letter'));
    const rules = BASE_TEMPLATE_RULES.join('\n');
    for (const t of ['plain numbers', 'percent numbers: 8.79 means 8.79%', 'Do not format the two columns as percentages', 'as Excel dates',
      'leave out every total and subtotal row', 'exactly Total or Grand Total is skipped and reported', 'a total row under any other name is read as a holding and counted twice',
      'four-digit year', 'Keep the headings in row 1', 'Valuation Date is not read by this version', 'No number or date is guessed']) {
      assert.ok(rules.includes(t), t);
    }

    const p0 = 19 + BASE_TEMPLATE_RULES.length;
    assert.equal(s.rows[p0]!.length, 0, 'a blank row before the product names');
    assert.deepEqual(s.rows[p0 + 1]!.slice(0, 3).map((c) => cellText(c)), ['Product Name', 'When', 'Read as']);
    const productRows = s.rows.slice(p0 + 2, p0 + 2 + BASE_TEMPLATE_PRODUCTS.length);
    assert.deepEqual(productRows.map((r) => [cellText(r[0]), cellText(r[1]), cellText(r[2])]),
      BASE_TEMPLATE_PRODUCTS.map((p) => [p.product, p.when ?? '', baseTemplateReadAs(p)]));
    assert.equal(cellText(s.rows[p0 + 2 + BASE_TEMPLATE_PRODUCTS.length]![2]), BASE_TEMPLATE_PRODUCT_NOTE);
    assert.equal(baseTemplateReadMe().rows.length, 17 + 1 + BASE_TEMPLATE_RULES.length + 2 + BASE_TEMPLATE_PRODUCTS.length + 1);
  });

  test('no en or em dash anywhere in the workbook (D-029)', () => {
    const parts = unzip(bytes);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const n of [1, 2]) assert.ok(!dashes.test(partText(parts, `xl/worksheets/sheet${n}.xml`)), `sheet${n}`);
    assert.ok(!dashes.test(partText(parts, 'xl/workbook.xml')));
  });

  test('deterministic bytes; the file name', () => {
    assert.equal(Buffer.compare(Buffer.from(buildBaseTemplate()), Buffer.from(bytes)), 0);
    assert.equal(BASE_TEMPLATE_FILE_NAME, 'Base file template.xlsx');
  });
});

// Two synthetic rows; every name and amount invented. Row 2 gives its dates as Excel serials: 45092 is 15 Jun 2023
// (1 Jan 2023 is serial 44927; 15 June is day 166 of the year).
const ROWS: unknown[][] = [
  ['Sample Template Client', 'Sample Template Client (Joint)', 'Sample Report Flexi Cap Fund - Regular Plan - Growth', 'INF000S01AB1', 'Flexi Cap Fund',
    'Equity', 'SYN-FOLIO-A', 'Mutual Funds', 'Sample Distributor', 20000, 250000, 280000, '31-10-2026', '15-06-2023', 400, 11.2, 10.1],
  ['Sample Template Client', 'Sample Template Minor', 'Sample Report Corporate Bond Fund - Regular Plan - Growth', 'INF000S01CD2', 'Corporate Bond',
    'Debt', 'SYN-FOLIO-B', 'Mutual Funds', 'Sample Distributor', 5000, 150000, 160000, 46326, 45092, 700, 7.4, 7],
];

/** The blank template with `rows` typed below the headings, written through SheetJS as an analyst's saved file. */
function filledBaseTemplate(rows: unknown[][] = ROWS): Uint8Array {
  type Ws = Record<string, unknown>;
  const book = xlsx.read(buildBaseTemplate(), { type: 'array' }) as unknown as { SheetNames: string[]; Sheets: Record<string, Ws> };
  const addAoa = (xlsx.utils as unknown as { sheet_add_aoa(ws: Ws, aoa: unknown[][], o: { origin: string }): void }).sheet_add_aoa;
  addAoa(book.Sheets['Base File']!, rows, { origin: 'A2' });
  return writeXlsx(xlsx, book);
}

describe('round trip: the filled template reads back through parseBaseFile', () => {
  const imp = parseBaseFile(readWorkbook(xlsx, filledBaseTemplate()), { sourceId: SRC, now: NOW });
  const num = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);
  const near = (a: number | null, b: number): boolean => a !== null && Math.abs(a - b) < 1e-12;

  test('read from "Base File", header in row 1; the Read Me is not needed; no result of any severity', () => {
    assert.deepEqual(imp.sheet, { name: 'Base File', headerRow: 1 });
    assert.deepEqual(imp.sheets.map((s) => [s.sheet, s.outcome]), [['Base File', 'used'], ['Read Me', 'not-needed']]);
    assert.deepEqual(imp.issues.map((i) => `${i.severity} ${i.ruleId}`), []);
    assert.deepEqual(imp.questions, []);
    assert.deepEqual(imp.skipped, []);
    assert.deepEqual([imp.counts.dataRows, imp.counts.holdingRows, imp.counts.holdings, imp.counts.included, imp.counts.excluded, imp.counts.mergedRows], [2, 2, 2, 2, 0, 0]);
  });

  test('every template column is used but Valuation Date (KI-320), each once, in the template\'s order', () => {
    assert.deepEqual(BASE_TEMPLATE_UNREAD_HEADERS, ['Valuation Date']);
    const read = HEADINGS.map((h) => h.trim()).filter((h) => h !== 'Valuation Date');
    assert.deepEqual(imp.columns.map((c) => c.header), read);
    assert.deepEqual(imp.columns.map((c) => c.field), ['client', 'accountName', 'name', 'isin', 'cat', 'asset', 'folio', 'product', 'dist', 'units',
      'invR', 'mvR', 'pdate', 'days', 'xirr', 'bmxirr']);
    assert.equal(imp.moneyUnit, 'rupee');
  });

  test('each value as typed: names, ISIN, rupees as Crore, units, dates, days, XIRR as percent numbers', () => {
    const [a, b] = imp.holdings;
    assert.deepEqual([a!.clientLabel, a!.instrumentName, a!.isin, a!.categoryLabel, a!.assetLabel, a!.assetClass, a!.folios, a!.productLabel, a!.distributorLabel],
      ['Sample Template Client', 'Sample Report Flexi Cap Fund - Regular Plan - Growth', 'INF000S01AB1', 'Flexi Cap Fund', 'Equity', 'Equity', ['SYN-FOLIO-A'], 'Mutual Funds', 'Sample Distributor']);
    assert.deepEqual([a!.accountNames, b!.accountNames], [['Sample Template Client (Joint)'], ['Sample Template Minor']]);
    // 2,50,000 rupees is 0.025 Cr; 2,80,000 is 0.028 Cr; 1,50,000 is 0.015 Cr; 1,60,000 is 0.016 Cr.
    assert.ok(near(num(a!.invested), 0.025) && near(num(a!.cmv), 0.028), JSON.stringify([a!.invested, a!.cmv]));
    assert.ok(near(num(b!.invested), 0.015) && near(num(b!.cmv), 0.016));
    assert.deepEqual([num(a!.units), num(b!.units), num(a!.holdingDays), num(b!.holdingDays)], [20000, 5000, 400, 700]);
    assert.deepEqual([num(a!.xirr), num(a!.bmXirr), num(b!.xirr), num(b!.bmXirr)], [11.2, 10.1, 7.4, 7]);
    // The date as the platform writes it and the same date as an Excel serial are one day: 15 Jun 2023.
    assert.equal(num(a!.purchaseDate), ymdToDay(2023, 6, 15));
    assert.equal(num(b!.purchaseDate), ymdToDay(2023, 6, 15));
    assert.equal(b!.assetClass, 'Debt');
    assert.equal(a!.fileGain.kind, 'missing', 'the template has no gain column: the app computes the gain');
  });

  test('rule 5 is the reader\'s: only Total and Grand Total are skipped; a total row under another name is read as a holding', () => {
    const total = (name: string, mv: number): unknown[] => ['Sample Template Client', null, name, null, null, null, null, null, null, null, null, mv, null, null, null, null, null];
    const imp2 = parseBaseFile(readWorkbook(xlsx, filledBaseTemplate([...ROWS, total('Client Total', 440000), total('Sub Total', 440000), total('Grand Total', 440000), total('Total', 440000)])), { sourceId: SRC, now: NOW });
    assert.deepEqual(imp2.holdings.map((h) => h.instrumentName).slice(2), ['Client Total', 'Sub Total']);
    assert.equal(imp2.counts.skipped['total-row'], 2);
    assert.deepEqual(imp2.issues.filter((i) => i.ruleId === 'base-file.total-row-skipped').map((i) => [i.severity, i.count]), [['Warning', 2]]);
    // "Sub Total" is warned as total-like; "Client Total" is read with no result at all (the reader's rule, D-041): the
    // Read Me therefore says to leave every such row out.
    const like = imp2.issues.filter((i) => i.ruleId === 'base-file.total-like-name');
    assert.deepEqual(like.map((i) => i.count), [1]);
    assert.ok(like[0]!.message.includes('"Sub Total"') && !like[0]!.message.includes('Client Total'));
    // 2,80,000 + 1,60,000 = 4,40,000 rupees are the two real holdings; each total row read as a holding adds the same again.
    const sum = imp2.holdings.reduce((a, h) => a + (h.cmv.kind === 'value' ? h.cmv.v : 0), 0);
    assert.ok(Math.abs(sum - 3 * 0.044) < 1e-12, String(sum));
  });

  test('the Read Me\'s XIRR sentence is the reader\'s limit', () => {
    assert.equal(XIRR_FRACTION_LIMIT, 1.5);
    const small = parseBaseFile(readWorkbook(xlsx, filledBaseTemplate(ROWS.map((r) => [...r.slice(0, 15), 0.112, 0.101]))), { sourceId: SRC, now: NOW });
    assert.deepEqual(small.questions.map((q) => q.field), ['xirr', 'bmXirr']);
    assert.ok(small.holdings.every((h) => h.xirr.kind === 'missing'), 'not used until answered');
  });
});

describe('the blank template uploaded as it is downloaded (the Guardian\'s Gate B finding B1)', () => {
  /** The blank template, its two sheets in the order given, saved through SheetJS as an upload would arrive. */
  const blank = (order: readonly string[]): Uint8Array => {
    const book = xlsx.read(buildBaseTemplate(), { type: 'array' }) as unknown as { SheetNames: string[]; Sheets: Record<string, unknown> };
    book.SheetNames = [...order];
    return writeXlsx(xlsx, book);
  };

  for (const order of [['Base File', 'Read Me'], ['Read Me', 'Base File']] as const) {
    test(`sheets ${order.join(', ')}: a plain "no holding rows" on "Base File"; the Read Me is never read as holdings`, () => {
      // the bytes exactly as the page builds them (their own sheet order), and the same book re-saved in this order
      const uploads = order[0] === 'Base File' ? [buildBaseTemplate(), blank(order)] : [blank(order)];
      for (const upload of uploads) {
        const imp = parseBaseFile(readWorkbook(xlsx, upload), { sourceId: SRC, now: NOW });
        assert.deepEqual(imp.sheet, { name: 'Base File', headerRow: 1 });
        assert.deepEqual(imp.holdings, []);
        assert.deepEqual([imp.counts.holdingRows, imp.counts.holdings, imp.counts.dataRows], [0, 0, 0]);
        assert.deepEqual(imp.sheets.map((s) => [s.sheet, s.outcome]).sort(), [['Base File', 'no-rows'], ['Read Me', 'no-header']]);
        assert.deepEqual(imp.issues.map((i) => `${i.severity} ${i.ruleId}`), ['Blocking base-file.no-holdings']);
        assert.equal(imp.issues[0]!.message, 'The sheet "Base File" has a header row but no holding rows.');
        // every one of the template's 17 headings that the reader reads is still mapped on the blank sheet
        assert.equal(imp.columns.length, 16);
      }
    });
  }

  test('no row of the Read Me holds both words of the reader\'s header test, on any row (not only the rows the reader scans)', () => {
    const rows = wb.sheets[1]!.rows;
    assert.ok(rows.length > 20, 'the Read Me is longer than the reader\'s header scan');
    const both = rows.map((r, i) => ({ i: i + 1, text: r.map((c) => cellText(c)).join('|').toLowerCase() })).filter((x) => x.text.includes('instrument') && x.text.includes('client'));
    assert.deepEqual(both, []);
    // the two column rows that name those headings are there, each without the other's word
    assert.ok(rows.some((r) => cellText(r[0]) === 'Client Name') && rows.some((r) => cellText(r[0]) === 'Instrument Name'));
  });

  test('the sentence that was read as a header says the same without the word', () => {
    const folio = wb.sheets[1]!.rows.find((r) => cellText(r[0]) === 'Folio No')!;
    assert.equal(cellText(folio[2]), 'The folio number. Rows of one client that share the scheme or security name, the product and the distributor are merged into one holding.');
  });
});

describe('the Read Me\'s product names against PRODUCT_CLASS_RULES as committed', () => {
  const TABLE = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', 'PRODUCT_CLASS_RULES.json'), 'utf8')) as Array<{ label: string }>;
  const { rules: R, skipped } = parseProductClassRulesDetailed(TABLE);
  /** What the matcher does with a product and a name (resolve-holdings.ts): a listed share, a fund class or a rule's label. */
  const readAs = (product: string, name: string): string => {
    if (isDirectEquityProduct(product) && !nonMfRule(product, R, name)) return 'STOCK';
    const c = holdingClass(product, R, name);
    return c.kind === 'other' ? `label:${c.label}` : c.productClass;
  };

  test('every row\'s example classifies as the row says', () => {
    assert.deepEqual(skipped, []);
    for (const p of BASE_TEMPLATE_PRODUCTS) {
      const want = typeof p.kind === 'string' ? p.kind : `label:${p.kind.label}`;
      assert.equal(readAs(p.product, p.example), want, `"${p.product}" / "${p.example}"`);
    }
  });

  test('a row with a condition and the row without it differ only by the instrument name', () => {
    const conditional = BASE_TEMPLATE_PRODUCTS.filter((p) => p.when !== null);
    assert.deepEqual([...new Set(conditional.map((p) => p.product))], ['Global Exposure', 'Bonds']);
    for (const product of ['Global Exposure', 'Bonds']) assert.equal(conditional.filter((p) => p.product === product).length, 2, product);
    assert.ok(BASE_TEMPLATE_PRODUCTS.filter((p) => p.when === null).every((p, _, all) => all.filter((q) => q.product === p.product).length === 1));
  });

  test('every label of the table is in the list, and the list names no other label', () => {
    const listed = BASE_TEMPLATE_PRODUCTS.flatMap((p) => (typeof p.kind === 'string' ? [] : [p.kind.label]));
    assert.deepEqual([...new Set(listed)].sort(), [...new Set(TABLE.map((r) => r.label))].sort());
    assert.deepEqual(BASE_TEMPLATE_PRODUCTS.filter((p) => typeof p.kind === 'string').map((p) => [p.product, p.kind]),
      [['Mutual Funds', 'MF'], ['Direct Equity', 'STOCK'], ['PMS', 'PMS'], ['AIF-Listed', 'AIF'], ['SIF', 'SIF']]);
  });

  test('the words of the two conditional rows are the rule\'s own word lists (T-2, T-7)', () => {
    const rule = (label: string, field: 'nameAny' | 'andAny'): string[] => {
      const hits = (TABLE as Array<Record<string, unknown>>).filter((r) => r.label === label && Array.isArray(r[field]));
      assert.equal(hits.length, 1, `${label}: one rule with ${field}`);
      return hits[0]![field] as string[];
    };
    assert.deepEqual([...BASE_TEMPLATE_GIFT_WORDS], rule('GIFT City funds', 'nameAny'));
    assert.deepEqual([...BASE_TEMPLATE_DOLLAR_WORDS], rule('US-dollar bonds (through LRS)', 'andAny'));
    const gift = BASE_TEMPLATE_PRODUCTS.find((p) => typeof p.kind !== 'string' && p.kind.label === 'GIFT City funds')!;
    const usd = BASE_TEMPLATE_PRODUCTS.find((p) => typeof p.kind !== 'string' && p.kind.label === 'US-dollar bonds (through LRS)')!;
    assert.equal(gift.when, 'the instrument name has one of the words GIFT, IFSC');
    assert.equal(usd.when, 'the product name or the instrument name has one of the words USD, US$, US, dollar, dollars, LRS');
    assert.deepEqual([gift.whenWords, usd.whenWords], [BASE_TEMPLATE_GIFT_WORDS, BASE_TEMPLATE_DOLLAR_WORDS]);
    // Each word alone decides: a Bonds row with only that word in its name is a US-dollar bond; with none, a rupee bond.
    for (const w of BASE_TEMPLATE_DOLLAR_WORDS) assert.equal(readAs('Bonds', `Sample Corp ${w} Bond 2030`), 'label:US-dollar bonds (through LRS)', w);
    assert.equal(readAs('Bonds', 'Sample Corp Bond 2030'), 'label:Rupee bonds and NCDs');
    for (const w of BASE_TEMPLATE_GIFT_WORDS) assert.equal(readAs('Global Exposure', `Sample ${w} Fund`), 'label:GIFT City funds', w);
  });

  test('every row through the real matcher on the committed reference data: its route and class label (T-7)', () => {
    const ctx = committedMatchContext();
    // "matched to the ... data": the page carries each of the five universes the Read Me names.
    assert.deepEqual(Object.keys(ctx.universes).sort(), ['AIF', 'MF', 'PMS', 'SIF', 'STOCK']);
    const rows = BASE_TEMPLATE_PRODUCTS.map((p) => ['Sample Template Client', null, p.example, null, null, 'Equity', null, p.product, null, null, null, 100000, null, null, null, null, null]);
    const loaded = loadBaseFile(filledBaseTemplate(rows), 'products.xlsx', xlsx, { now: NOW });
    assert.ok(isLoaded(loaded));
    const { report } = matchLoaded(loaded, ctx);
    assert.ok(report && !report.failed);
    assert.equal(loaded.base.holdings.length, BASE_TEMPLATE_PRODUCTS.length);
    const got = loaded.base.holdings.map((h) => { const e = report.entries.find((x) => x.holdingId === h.id)!; return [h.product, h.instrumentName, e.route, e.classLabel]; });
    assert.deepEqual(got, BASE_TEMPLATE_PRODUCTS.map((p) => [p.product, p.example, typeof p.kind === 'string' ? p.kind : 'other', typeof p.kind === 'string' ? null : p.kind.label]));
  });

  test('the note: a blank product is Mutual Funds, and a product the application does not recognise is looked up as a mutual fund', () => {
    assert.equal(DEFAULT_PRODUCT, 'Mutual Funds');
    assert.equal(readAs('', 'Sample Fund'), 'MF');
    assert.equal(readAs('Something Else', 'Sample Holding'), 'MF');
    assert.ok(BASE_TEMPLATE_PRODUCT_NOTE.includes('A blank Product Name is read as Mutual Funds'));
    assert.ok(BASE_TEMPLATE_PRODUCT_NOTE.includes('a name the application does not recognise is looked up as a mutual fund and will usually show as not matched'));
  });

  test('the asset values: each reads as itself; the two other spellings and Commodities as the Read Me says; another value stays unknown', () => {
    for (const a of BASE_TEMPLATE_ASSETS) assert.deepEqual(readAssetLabel(a), { assetClass: a, how: 'label' }, a);
    for (const a of BASE_TEMPLATE_ASSET_SYNONYMS) assert.deepEqual(readAssetLabel(a), { assetClass: 'Debt', how: 'synonym' }, a);
    assert.equal(readAssetLabel('Commodities').assetClass, 'Commodity');
    assert.equal(readAssetLabel('Gold').assetClass, null);
    assert.equal(readAssetLabel(null).assetClass, null);
  });
});

describe('the Read Me\'s ISIN sentence against the committed match context (T-1)', () => {
  const ctx = committedMatchContext();
  const stock = refdataBlock('STOCK_RET') as Record<string, { isin?: string }>;
  const shareKey = Object.keys(stock).find((k) => /^INE[A-Z0-9]{8}[0-9]$/.test(stock[k]?.isin ?? ''))!;
  const shareIsin = stock[shareKey]!.isin!;
  const row = (name: string, isin: string | null, product: string): unknown[] => ['Sample Template Client', null, name, isin, null, 'Equity', null, product, null, null, null, 100000, null, null, null, null, null];
  const entries = (rows: unknown[][]) => {
    const loaded = loadBaseFile(filledBaseTemplate(rows), 'isin.xlsx', xlsx, { now: NOW });
    assert.ok(isLoaded(loaded));
    return { holdings: loaded.base.holdings, entries: matchLoaded(loaded, ctx).report!.entries };
  };

  test('the sentence, and the fact it rests on: the context holds share ISINs and no fund ISIN', () => {
    assert.equal(BASE_TEMPLATE_ISIN_TEXT, 'The ISIN of the fund or share. A listed share is found by its ISIN before its name. A fund\'s ISIN is read and kept; in this version a fund is found by its name.');
    // When the fund ISIN table arrives (the December identifiers), this fails and the sentence is reworded.
    assert.equal(ctx.crosswalk.codeByFundIsin.size, 0);
    assert.ok(ctx.crosswalk.stockKeyByIsin.size > 0);
  });

  test('a share with a name that matches nothing is found by its ISIN; a fund with a well-formed ISIN is read, kept and not matched', () => {
    const r = entries([
      row('A Name That Matches Nothing Ltd', shareIsin, 'Direct Equity'),
      row('A Fund Name That Matches Nothing', 'INF000S01AB1', 'Mutual Funds'),
      row('Another Name That Matches Nothing Ltd', null, 'Direct Equity'),
    ]);
    assert.deepEqual(r.entries.map((e) => [e.route, e.ref?.resolution.method, e.ref?.resolution.confidence]), [
      ['STOCK', 'isin', 'exact'], ['MF', 'none', 'unmatched'], ['STOCK', 'none', 'unmatched'],
    ]);
    assert.equal(r.entries[0]!.ref!.vendorKey, shareKey);
    assert.deepEqual(r.holdings.map((h) => h.isin), [shareIsin, 'INF000S01AB1', undefined], 'the fund\'s ISIN is read and kept');
  });
});

describe('the Templates group download (store and wiring)', () => {
  test('the store calls the wiring\'s base template download at any stage, before any base file', () => {
    const { wiring } = fakeWiring();
    let saved = 0;
    const store = createStore({ wiring: { ...wiring, downloadBaseTemplate: () => { saved++; } }, prefs: memoryPrefs().prefs, logos: [] });
    assert.equal(store.get().upload.stage, null);
    store.downloadBaseTemplate();
    assert.equal(saved, 1);
  });
  test('a wiring without the download does nothing and throws nothing', () => {
    const { wiring } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    assert.doesNotThrow(() => store.downloadBaseTemplate());
  });
});
