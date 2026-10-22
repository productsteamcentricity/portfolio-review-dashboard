// covers: E-01 E-02 E-03 BR-2.5 BR-2.6 BR-13.4 BR-13.5 U-60 OD-3 OD-7 OD-8 KI-005 KI-007 KI-057 KI-074 KI-093 KI-113
// The base-file parser on synthetic books, against known answers worked out by hand from the fixture values
// (tests/fixtures/make-books.ts SYNTHETIC_BOOK), never from the code under test. Money: rupees / 1e7 = Crore.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import type { Cell, Workbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile, HEADER_SCAN_ROWS, XIRR_FRACTION_LIMIT } from '../../../app/src/ingest/base-file.ts';
import type { BaseFileImport, BaseFileOptions } from '../../../app/src/ingest/base-file.ts';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { formatDay } from '../../../app/src/engine/dates.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const SRC = 'f'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-22T00:00:00.000Z';
const xlsx = loadSheetJS();
const fixtures = new Map(syntheticFixtures(xlsx).map((f) => [f.id, f]));

function parse(id: string, extra: Partial<BaseFileOptions> = {}): BaseFileImport {
  const f = fixtures.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  const opts: BaseFileOptions = { sourceId: SRC, now: NOW, ...extra };
  if (f.answers && !extra.answers) opts.answers = f.answers;
  return parseBaseFile(readWorkbook(xlsx, f.bytes), opts);
}
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const st = (x: Value<unknown>): string | null => (x.kind === 'missing' ? x.status : null);
const close = (a: number | null, b: number, msg?: string): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg ?? ''} ${a} != ${b}`);
};
const included = (imp: BaseFileImport): Holding[] => imp.holdings.filter((h) => h.inclusion.status === 'included');
const rules = (imp: BaseFileImport): string[] => imp.issues.map((i) => i.ruleId);
const issue = (imp: BaseFileImport, rule: string) => imp.issues.find((i) => i.ruleId === rule);

/** Hand-worked values of SYNTHETIC_BOOK in Crore: invested, market value, file gain. */
const EXPECT: Array<[number, number, number, number | null, number, number, string]> = [
  // invested, cmv, gain, units, xirr, bmxirr, purchase date
  [0.5, 0.625, 0.125, 12345.678, 14.25, 12.5, '16 Jan 2023'],
  [0.4, 0.452, 0.052, 8000.5, 11.8, 12.1, '15 Jun 2022'],
  [0.8, 0.896, 0.096, 150000, 7.2, 6.9, '5 Feb 2024'],
  [0.3, 0.339, 0.039, 25000, 10.5, 10, '11 Sep 2023'],
  [0.1, 0.131, 0.031, 40000, 18.4, 19.1, '13 May 2024'],
  [0.75, 0.91, 0.16, null, 16, 13, '10 Apr 2023'],
];

function assertStandardValues(imp: BaseFileImport, label: string): void {
  const hs = included(imp);
  assert.equal(hs.length, 6, label);
  hs.forEach((h, i) => {
    const [inv, cmv, gain, units, x, b, date] = EXPECT[i]!;
    close(v(h.invested), inv, `${label} invested ${i}`);
    close(v(h.cmv), cmv, `${label} cmv ${i}`);
    close(v(h.fileGain), gain, `${label} gain ${i}`);
    if (units === null) assert.equal(st(h.units), STATUS.NOT_AVAILABLE);
    else close(v(h.units), units, `${label} units ${i}`);
    close(v(h.xirr), x, `${label} xirr ${i}`);
    close(v(h.bmXirr), b, `${label} bmxirr ${i}`);
    assert.equal(h.purchaseDate.kind === 'value' ? formatDay(h.purchaseDate.v) : null, date, `${label} date ${i}`);
    assert.equal(h.cmv.kind === 'value' && h.cmv.unit, 'cr');
    assert.equal(h.xirr.kind === 'value' && h.xirr.unit, 'pct');
  });
  close(hs.reduce((s, h) => s + (v(h.cmv) ?? 0), 0), 3.353, `${label} total CMV`);
}

describe('the template layout', () => {
  test('values, units and the display unit: Crore columns win over rupee columns', () => {
    const imp = parse('syn-standard');
    assert.deepEqual(imp.sheet, { name: 'Base File', headerRow: 1 });
    assert.equal(imp.moneyUnit, 'crore');
    assertStandardValues(imp, 'standard');
    assert.deepEqual(imp.questions, []);
    assert.deepEqual(imp.issues.filter((i) => i.severity !== 'Information'), []);
    assert.deepEqual(included(imp).map((h) => h.assetClass), ['Equity', 'Equity', 'Debt', 'Hybrid', 'Commodity', 'Equity']);
    assert.deepEqual(included(imp).map((h) => h.product), ['Mutual Funds', 'Mutual Funds', 'Mutual Funds', 'Mutual Funds', 'Mutual Funds', 'PMS']);
    const cmv = included(imp)[0]!.cmv;
    assert.ok(cmv.kind === 'value' && cmv.prov.sources[0] === SRC && /Current Market Value \(Cr\.\)/.test(cmv.prov.method));
  });
  test('Lakh-only and rupee-only books give the same Crore values', () => {
    const lakh = parse('syn-lakh');
    assert.equal(lakh.moneyUnit, 'lakh');
    assertStandardValues(lakh, 'lakh');
    const rupee = parse('syn-rupee');
    assert.equal(rupee.moneyUnit, 'rupee');
    assertStandardValues(rupee, 'rupee');
  });
  test('text dates in the legacy forms read as the same days', () => {
    assertStandardValues(parse('syn-text-dates'), 'text dates');
  });
  test('the same file gives the same output, and holding ids do not depend on row order', () => {
    const a = parse('syn-standard');
    assert.deepEqual(parse('syn-standard'), a);
    const wb = readWorkbook(xlsx, fixtures.get('syn-standard')!.bytes);
    const rows = wb.sheets[0]!.rows;
    const reversed: Workbook = { ...wb, sheets: [{ ...wb.sheets[0]!, rows: [rows[0]!, ...rows.slice(1).reverse()] }] };
    const b = parseBaseFile(reversed, { sourceId: SRC, now: NOW });
    assert.deepEqual(b.holdings.map((h) => h.id).sort(), a.holdings.map((h) => h.id).sort());
    assert.deepEqual(b.clients.map((c) => c.id).sort(), a.clients.map((c) => c.id).sort());
  });
});

describe('XIRR units (OD-3, KI-005)', () => {
  test('percent-formatted cells are read as percentages automatically', () => {
    const imp = parse('syn-pct-xirr');
    assertStandardValues(imp, 'pct-xirr');
    assert.deepEqual(imp.questions, []);
    assert.equal(issue(imp, 'base-file.xirr-percent-format')?.count, 6);
  });
  test('an unformatted column with every value below 1.5 raises a question, and its values stay missing', () => {
    const imp = parse('syn-ambiguous-xirr');
    assert.deepEqual(imp.questions.map((q) => [q.field, q.column, q.options, q.decision]),
      [['xirr', 'XIRR (%)', ['percent', 'fraction'], 'OD-3'], ['bmXirr', 'BMXIRR (%)', ['percent', 'fraction'], 'OD-3']]);
    assert.equal(imp.questions[0]!.evidence.values, 6);
    close(imp.questions[0]!.evidence.maxAbs, 0.184);
    for (const h of imp.holdings) {
      assert.equal(st(h.xirr), STATUS.INSUFFICIENT_EVIDENCE);
      assert.equal(st(h.bmXirr), STATUS.INSUFFICIENT_EVIDENCE);
    }
    const q = imp.issues.filter((i) => i.ruleId === 'base-file.xirr-unit-question');
    assert.deepEqual(q.map((i) => [i.severity, i.resolution, i.status, i.blocksPublication]),
      [['High', 'analyst-decision', 'open', false], ['High', 'analyst-decision', 'open', false]]);
    // Everything else is read normally.
    included(imp).forEach((h, i) => close(v(h.cmv), EXPECT[i]![1]));
  });
  test('the analyst\'s answer is applied and audited; "percent" reads the numbers as they are', () => {
    const asFraction = parse('syn-ambiguous-xirr-answered');
    assertStandardValues(asFraction, 'answered');
    assert.deepEqual(asFraction.questions, []);
    assert.equal(asFraction.audit.filter((a) => a.kind === 'validation-decision').length, 2);
    const asPercent = parse('syn-ambiguous-xirr', { answers: { xirr: 'percent', bmXirr: 'percent' } });
    close(v(included(asPercent)[0]!.xirr), 0.1425);
  });
  test('the boundary: a value of 1.5 makes the column percent numbers; an all-zero column needs no question', () => {
    const at = (xs: number[]): BaseFileImport => parseBaseFile(tiny(xs.map((x) => ({ xirr: x }))), { sourceId: SRC, now: NOW });
    assert.equal(XIRR_FRACTION_LIMIT, 1.5);
    assert.equal(at([0.2, 1.5]).questions.length, 0);
    close(v(at([0.2, 1.5]).holdings[0]!.xirr), 0.2);
    assert.equal(at([0.2, 1.49]).questions.length, 1);
    assert.equal(at([-1.6, 0.2]).questions.length, 0);
    assert.equal(at([0, 0]).questions.length, 0);
    close(v(at([0, 0]).holdings[0]!.xirr), 0);
  });
  test('text with a percent sign is a percent number, whatever its size', () => {
    const imp = parseBaseFile(tiny([{ xirr: s('0.8%') }, { xirr: s('12.5 %') }]), { sourceId: SRC, now: NOW });
    assert.deepEqual(imp.questions, []);
    close(v(imp.holdings[0]!.xirr), 0.8);
    close(v(imp.holdings[1]!.xirr), 12.5);
  });
});

describe('header search and skipped rows (KI-074)', () => {
  test('a header in row 6 is found, and the sheet is named', () => {
    const imp = parse('syn-header-row-6');
    assert.deepEqual(imp.sheet, { name: 'Base File', headerRow: 6 });
    assertStandardValues(imp, 'header row 6');
    assert.equal(issue(imp, 'base-file.sheet-used')?.severity, 'Information');
    assert.equal(HEADER_SCAN_ROWS, 20);
  });
  test('a notes sheet first: the holdings sheet is found and named', () => {
    const imp = parse('syn-note-sheet-first');
    assert.deepEqual(imp.sheet, { name: 'Holdings Report', headerRow: 1 });
    assert.deepEqual(imp.sheets, [
      { sheet: 'Read Me', outcome: 'no-header', headerRow: null },
      { sheet: 'Holdings Report', outcome: 'used', headerRow: 1 },
    ]);
    assertStandardValues(imp, 'note sheet first');
    assert.match(issue(imp, 'base-file.sheet-used')!.message, /Holdings Report/);
  });
  test('"Base File" is tried first, but a sheet with a header and no rows gives way to one with holdings', () => {
    const empty = sheetOf('Base File', [HEAD]);
    const real = tiny([{ xirr: 10 }]).sheets[0]!;
    const imp = parseBaseFile({ sheets: [{ ...real, name: 'Data' }, empty], date1904: false }, { sourceId: SRC, now: NOW });
    assert.equal(imp.sheet?.name, 'Data');
    assert.deepEqual(imp.sheets.map((a) => [a.sheet, a.outcome]), [['Base File', 'no-rows'], ['Data', 'used']]);
  });
  test('blank rows, a repeated header, a total row and a row without a name are skipped and reported by reason', () => {
    const imp = parse('syn-skipped-rows');
    assertStandardValues(imp, 'skipped rows');
    assert.deepEqual(imp.counts.skipped, { 'blank-row': 1, 'repeated-header': 1, 'total-row': 1, 'no-instrument-name': 1 });
    assert.deepEqual(imp.skipped.map((r) => [r.at.row, r.reason, r.hasMoney]),
      [[4, 'blank-row', false], [7, 'repeated-header', false], [9, 'no-instrument-name', true], [11, 'total-row', true]]);
    assert.equal(issue(imp, 'base-file.skipped-no-instrument-name')?.severity, 'Warning');
    assert.equal(issue(imp, 'base-file.skipped-total-row')?.severity, 'Information');
  });
  test('no header anywhere, or no market value column, blocks publication', () => {
    const none = parseBaseFile({ sheets: [sheetOf('S', [[s('just'), s('notes')]])], date1904: false }, { sourceId: SRC, now: NOW });
    assert.equal(none.sheet, null);
    assert.deepEqual(none.holdings, []);
    assert.deepEqual(none.issues.map((i) => [i.ruleId, i.severity, i.blocksPublication]), [['base-file.no-header', 'Blocking', true]]);
    assert.equal(none.audit[0]!.kind, 'import');
    const noMv = parseBaseFile({ sheets: [sheetOf('Base File', [[s('Client Name'), s('Instrument Name'), s('Invested Value (Cr.)')],
      [s('Sample Client A'), s('Sample Fund'), n(1)]])], date1904: false }, { sourceId: SRC, now: NOW });
    assert.ok(rules(noMv).includes('base-file.no-market-value-column'));
    assert.equal(noMv.holdings[0]!.inclusion.status, 'excluded');
  });
});

describe('missing values, OD-8 and KI-007', () => {
  test('"NA" and blank market values exclude the holding and list it; never zero', () => {
    const imp = parse('syn-na-cmv');
    assert.equal(imp.counts.included, 4);
    assert.equal(imp.counts.excluded, 2);
    const ex = imp.holdings.filter((h) => h.inclusion.status === 'excluded');
    assert.deepEqual(ex.map((h) => h.instrumentName),
      ['Sample Flexi Cap Fund - Regular Plan - Growth', 'Sample Balanced Advantage Fund - Regular Plan - Growth']);
    for (const h of ex) {
      assert.deepEqual(h.inclusion, { status: 'excluded', reasons: ['no-market-value'] });
      assert.equal(st(h.cmv), STATUS.NOT_AVAILABLE);
    }
    assert.match(ex[0]!.cmv.kind === 'missing' ? ex[0]!.cmv.reason : '', /says "NA"/);
    close(v(ex[0]!.invested), 0.4, 'the excluded holding keeps its invested value for the listing');
    const w = issue(imp, 'base-file.no-market-value')!;
    assert.deepEqual([w.severity, w.decision, w.count], ['Warning', 'OD-8', 2]);
    assert.match(w.message, /Sample Flexi Cap Fund/);
  });
  test('a blank invested value stays missing, and so does the file gain', () => {
    const imp = parse('syn-blank-invested');
    const hs = included(imp);
    assert.equal(st(hs[0]!.invested), STATUS.NOT_AVAILABLE);
    assert.equal(st(hs[2]!.invested), STATUS.NOT_AVAILABLE);
    close(v(hs[1]!.invested), 0.4);
    close(v(hs[0]!.cmv), 0.625);
  });
  test('text that is not a number is invalid source data, reported by column', () => {
    const imp = parseBaseFile(tiny([{ units: s('12abc') }, { units: s('1,23,456.5') }, { units: s('--') }]), { sourceId: SRC, now: NOW });
    assert.equal(st(imp.holdings[0]!.units), STATUS.INVALID_SOURCE);
    close(v(imp.holdings[1]!.units), 123456.5);
    assert.equal(st(imp.holdings[2]!.units), STATUS.NOT_AVAILABLE);
    const w = issue(imp, 'base-file.invalid-cells')!;
    assert.deepEqual([w.severity, w.count], ['Warning', 1]);
    assert.match(w.message, /"Units" \(1\)/);
  });
  test('an impossible date is invalid, not rolled into the next month', () => {
    const imp = parseBaseFile(tiny([{ date: s('31-02-2024') }, { date: s('29-02-2024') }]), { sourceId: SRC, now: NOW });
    assert.equal(st(imp.holdings[0]!.purchaseDate), STATUS.INVALID_SOURCE);
    assert.equal(imp.holdings[1]!.purchaseDate.kind === 'value' && formatDay(imp.holdings[1]!.purchaseDate.v), '29 Feb 2024');
  });
});

describe('asset labels (OD-7) and other labels', () => {
  test('blank stays unknown; Fixed Income and Debt Funds are Debt; case is ignored; Gold stays unknown with its label', () => {
    const imp = parse('syn-odd-asset-labels');
    assert.deepEqual(imp.holdings.map((h) => [h.assetLabel, h.assetClass]), [
      [null, null], ['Fixed Income', 'Debt'], ['Debt Funds', 'Debt'], ['EQUITY', 'Equity'], ['Gold', null], ['Equity', 'Equity'],
    ]);
    assert.deepEqual([issue(imp, 'base-file.blank-asset')?.severity, issue(imp, 'base-file.blank-asset')?.count], ['Warning', 1]);
    assert.match(issue(imp, 'base-file.unrecognised-asset')!.message, /"Gold"/);
    assert.equal(issue(imp, 'base-file.asset-synonym')?.count, 2);
  });
  test('a blank Product Name reads as Mutual Funds, flagged; a blank Client Name and a total-like name are warned', () => {
    const imp = parseBaseFile(tiny([{ product: null }, { client: null }, { name: 'Grand Total' }]), { sourceId: SRC, now: NOW });
    assert.deepEqual([imp.holdings[0]!.product, imp.holdings[0]!.productLabel, imp.holdings[0]!.productDefaulted], ['Mutual Funds', null, true]);
    assert.equal(issue(imp, 'base-file.product-defaulted')?.severity, 'Information');
    assert.equal(imp.holdings[1]!.clientId, null);
    assert.equal(issue(imp, 'base-file.blank-client')?.severity, 'Warning');
    assert.equal(issue(imp, 'base-file.total-like-name')?.severity, 'Warning');
  });
});

describe('merged folios (E-02, KI-007, KI-113, KI-093)', () => {
  test('known answers for the merged holdings', () => {
    const imp = parse('syn-merged-folios');
    assert.equal(imp.counts.holdingRows, 10);
    assert.equal(imp.counts.mergedRows, 3);
    assert.equal(imp.counts.included, 6);
    assert.equal(imp.counts.excluded, 1);
    const [a, b, c] = imp.holdings;
    // Holding 0 in three folios (50/30/20 of 0.5 Cr invested and 0.625 Cr value); folio 2 has no gain, folio 3 no units.
    assert.equal(a!.rows.length, 3);
    assert.deepEqual(a!.folios, ['SYN-1001/01', 'SYN-1001/02', 'SYN-1001/03']);
    close(v(a!.invested), 0.5);
    close(v(a!.cmv), 0.625);
    assert.equal(st(a!.fileGain), STATUS.NOT_AVAILABLE, 'KI-113: no partial gain');
    assert.equal(st(a!.units), STATUS.NOT_AVAILABLE, 'KI-113 rule applied to units');
    close(v(a!.xirr), 14.25);
    // Holding 1 in two folios: 60 % at XIRR 13.8, 40 % at 8.8 -> 0.6 x 13.8 + 0.4 x 8.8 = 11.8; folio B has no invested value.
    close(v(b!.xirr), 11.8, 'CMV-weighted XIRR');
    close(v(b!.cmv), 0.452);
    assert.equal(st(b!.invested), STATUS.NOT_AVAILABLE, 'KI-007: no partial invested value');
    close(v(b!.units), 8000.5);
    // Holding 2: folio A included (70 %), folio B without a market value excluded and listed on its own.
    close(v(c!.cmv), 0.6272);
    close(v(c!.invested), 0.56);
    close(v(c!.fileGain), 0.0672);
    assert.equal(c!.inclusion.status, 'included');
    const ex = imp.holdings[3]!;
    assert.deepEqual([ex.instrumentName, ex.inclusion.status, ex.folios], [c!.instrumentName, 'excluded', ['SYN-1003-B']]);
    close(v(ex.invested), 0.24);
    assert.notEqual(ex.id, c!.id);
    assert.equal(issue(imp, 'base-file.merge-incomplete')?.count, 2);
  });
  test('a merged XIRR over part of the value records its coverage', () => {
    const imp = parseBaseFile(tiny([{ xirr: 10, cmv: 3 }, { xirr: null, cmv: 1 }], { sameHolding: true }), { sourceId: SRC, now: NOW });
    const x = imp.holdings[0]!.xirr;
    assert.ok(x.kind === 'value');
    close(x.v, 10);
    close(x.coverage ?? null, 0.75);
  });
  test('the Allocation column is not read: weights come from market values (KI-093, OD-22)', () => {
    const imp = parse('syn-standard');
    assert.ok(imp.columns.some((c) => c.field === 'alloc' && c.header === 'Allocation (%)'), 'the column is recognised');
    for (const h of imp.holdings) assert.deepEqual(Object.keys(h).filter((k) => /alloc/i.test(k)), []);
  });
});

describe('outputs never carry a dash in a sentence, and the audit carries no client data', () => {
  test('no en or em dash in any message or prompt (D-029); counts only in the audit', () => {
    for (const [id] of fixtures) {
      const imp = parse(id);
      for (const t of [...imp.issues.map((i) => i.message), ...imp.questions.map((q) => q.prompt)]) {
        assert.ok(!/[–—]/.test(t), `${id}: ${t}`);
      }
      const audit = JSON.stringify(imp.audit);
      assert.ok(!/Sample Client|SYN-\d|Sample [A-Z][a-z]+ Fund/.test(audit), `${id}: ${audit}`);
      assert.equal(imp.audit[0]!.kind, 'import');
      assert.equal(imp.audit[0]!.at, NOW());
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Tiny in-memory workbooks for edge cases (no SheetJS).

function s(text: string): Cell { return { t: 's', v: text }; }
function n(x: number): Cell { return { t: 'n', v: x, fmt: null, date: false }; }
function sheetOf(name: string, rows: Cell[][]): Workbook['sheets'][number] { return { name, hidden: false, rows }; }
const HEAD: Cell[] = ['Client Name', 'Instrument Name', 'Product Name', 'Distributor Name', 'Units',
  'Current Market Value (Cr.)', 'XIRR (%)', 'Purchase Date'].map(s);

type TinyRow = { client?: string | null; name?: string; product?: string | null; units?: Cell; cmv?: number;
  xirr?: number | null | Cell; date?: Cell };

function tiny(rows: TinyRow[], o: { sameHolding?: boolean } = {}): Workbook {
  const data = rows.map((r, i): Cell[] => [
    r.client === null ? null : s(r.client ?? 'Sample Client A'),
    s(r.name ?? (o.sameHolding ? 'Sample Fund' : `Sample Fund ${i + 1}`)),
    r.product === null ? null : s(r.product ?? 'Mutual Funds'),
    s('Centricity'),
    r.units === undefined ? n(100) : r.units,
    n(r.cmv ?? 1),
    r.xirr === undefined ? n(10) : r.xirr === null ? null : typeof r.xirr === 'number' ? n(r.xirr) : r.xirr,
    r.date === undefined ? n(44942) : r.date,
  ]);
  return { sheets: [sheetOf('Base File', [HEAD, ...data])], date1904: false };
}
