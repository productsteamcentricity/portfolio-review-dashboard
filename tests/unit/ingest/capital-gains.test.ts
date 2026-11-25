// covers: E-141 E-150 E-156 AC-21 D-036 (capital-gains statement reader, NB-M7a; design capital-gains-upload.md §2 to §4, §6, §7, §11)
// The capital-gains reader on the synthetic statements of tests/fixtures/make-cg-statements.ts, against expectations
// worked out by hand from the fixture rows (the case list in that file), never from the code under test. The tax
// engine's ids (lot classes, tax class, rules, roll-up) are tested in the engine sprint.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import type { Cell, Workbook } from '../../../app/src/ingest/workbook.ts';
import {
  parseCapitalGains, financialYearOf, normaliseHeader, fieldOfHeader, parseInstrument, splitAccountName,
  possiblyOnePerson, scrubText, hasPanShape, amountTolerance, totalsTolerance, CG_COLUMNS, PAN_REPLACEMENT,
} from '../../../app/src/ingest/capital-gains.ts';
import type { CgImport, CgOptions, CgLot } from '../../../app/src/ingest/capital-gains.ts';
import type { ClientId, SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { dayToExcelSerial, ymdToDay } from '../../../app/src/engine/dates.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import {
  cgFixtures, panToken, lotAmounts, round2, STATEMENT_LOTS, CLIENT_A, CLIENT_B, FAMILY,
} from '../../fixtures/make-cg-statements.ts';

const SRC = 'c'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-24T00:00:00.000Z';
const xlsx = loadSheetJS();
const fixtures = new Map(cgFixtures(xlsx).map((f) => [f.id, f]));
const A = 'cl_review_a' as ClientId;
const B = 'cl_review_b' as ClientId;
const REVIEW: NonNullable<CgOptions['review']> = {
  clients: [{ id: A, label: CLIENT_A, displayLabel: null }, { id: B, label: CLIENT_B, displayLabel: null }],
  familyLabel: FAMILY,
};

/** The workbook, with each sheet's used range (`lastRow`) attached as the reader honours it (PLAN-01 D7). */
function read(id: string, withRange = true): Workbook {
  const f = fixtures.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  const wb = readWorkbook(xlsx, f.bytes);
  if (withRange) {
    const raw = xlsx.read(f.bytes, { type: 'array' }) as unknown as { Sheets: Record<string, Record<string, unknown>> };
    for (const s of wb.sheets) {
      const ref = raw.Sheets[s.name]?.['!ref'];
      if (typeof ref === 'string') (s as typeof s & { lastRow?: number }).lastRow = xlsx.utils.decode_cell(ref.split(':').pop()!).r;
    }
  }
  return wb;
}

function parse(id: string, extra: Partial<CgOptions> = {}, withRange = true): CgImport {
  return parseCapitalGains(read(id, withRange), { sourceId: SRC, now: NOW, review: REVIEW, ...extra });
}

type Expect = [rule: string, severity: string, count: number | undefined];
const results = (imp: CgImport): Expect[] => imp.issues.map((i) => [i.ruleId.replace('capital-gains.', ''), i.severity, i.count]);
const sortE = (xs: Expect[]): Expect[] => [...xs].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
const issue = (imp: CgImport, rule: string) => imp.issues.find((i) => i.ruleId === `capital-gains.${rule}`);
const v = <T>(x: { kind: 'value'; v: T } | { kind: 'missing' }): T | null => (x.kind === 'value' ? x.v : null);
const st = (x: { kind: string; status?: string }): string | null => (x.kind === 'missing' ? x.status ?? null : null);
const day = (y: number, m: number, d: number): number => ymdToDay(y, m, d)!;

/** The recorded analyst answers of cg-statement (design §13.1): the equal genuine lots as stated, the rest once. */
function recordedAnswers(imp: CgImport): NonNullable<CgOptions['repeatAnswers']> {
  const ev = (lot: number): string => imp.lots[lot]!.eventId;
  return { byEvent: { [ev(23)]: 'as-stated', [ev(5)]: 'once' }, all: 'once' };
}

// ---------------------------------------------------------------------------------------------------------------

describe('helpers (design §2.2, §2.5, §3, §8, §11)', () => {
  test('header normalising: trim, spaces, case, the four unit suffixes', () => {
    assert.equal(normaliseHeader('  Sell   Amount (₹) '), 'sell amount');
    for (const h of ['Sell Amount (Rs)', 'sell amount (rs.)', 'SELL AMOUNT (INR)', 'Sell Amount']) assert.equal(fieldOfHeader(h), 'sellAmount', h);
    assert.equal(fieldOfHeader('Redemption Date'), 'saleDate');
    assert.equal(fieldOfHeader('Units'), 'saleUnit');
    assert.equal(fieldOfHeader('XIRR (%)'), 'xirr');
    assert.equal(fieldOfHeader('Remarks'), null);
    assert.equal(CG_COLUMNS.filter((c) => c.exported).length, 29);
  });
  test('the instrument tag (§2.5)', () => {
    assert.deepEqual(parseInstrument('Sample Flexi Cap Fund - Regular Plan - Growth Option [Folio No: 91000001 || Asset: Equity]'),
      { schemeLabel: 'Sample Flexi Cap Fund - Regular Plan - Growth Option', folio: '91000001', tagAsset: 'Equity' });
    assert.deepEqual(parseInstrument('Sample Bond Fund [Folio No: 91000002/12 || Asset: Debt]'), { schemeLabel: 'Sample Bond Fund', folio: '91000002/12', tagAsset: 'Debt' });
    assert.deepEqual(parseInstrument('Sample Bond Fund [Folio No: 91000003]'), { schemeLabel: 'Sample Bond Fund', folio: '91000003', tagAsset: null });
    assert.deepEqual(parseInstrument('Sample Bond Fund'), { schemeLabel: 'Sample Bond Fund', folio: null, tagAsset: null });
  });
  test('Account Name split at its last " - " (§2.3 row 2)', () => {
    assert.deepEqual(splitAccountName('Sample Client A - Held Away'), { accountLabel: 'Sample Client A', accountNote: 'Held Away' });
    assert.deepEqual(splitAccountName('Sample - Client - Held Away'), { accountLabel: 'Sample - Client', accountNote: 'Held Away' });
    assert.deepEqual(splitAccountName('Sample Client B'), { accountLabel: 'Sample Client B', accountNote: '' });
  });
  test('PAN tags and PAN-shaped tokens removed (§3), any letter case', () => {
    const t = panToken(1);
    const s = scrubText(`Sample Client A - Held Away[PAN: ${t}]`);
    assert.deepEqual(s, { text: 'Sample Client A - Held Away', tags: 1, tokens: 0 });
    const lower = panToken(2, true);
    const s2 = scrubText(`ref ${lower} and ${t}`);
    assert.equal(s2.tokens, 2);
    assert.equal(s2.text, `ref ${PAN_REPLACEMENT} and ${PAN_REPLACEMENT}`);
    assert.ok(hasPanShape(t) && hasPanShape(lower) && !hasPanShape(PAN_REPLACEMENT));
  });
  test('financial year from the sale date at 31 Mar and 1 Apr (§8)', () => {
    assert.equal(financialYearOf(day(2025, 3, 31)).label, 'FY 2024-25');
    assert.equal(financialYearOf(day(2025, 4, 1)).label, 'FY 2025-26');
    assert.equal(financialYearOf(day(2026, 3, 31)).label, 'FY 2025-26');
    assert.equal(financialYearOf(day(2026, 4, 1)).label, 'Tax year 2026-27');
    assert.equal(financialYearOf(day(2000, 1, 15)).label, 'FY 1999-00');
  });
  test('tolerances (§4, §7)', () => {
    assert.equal(amountTolerance(5000), 1);
    assert.equal(amountTolerance(50000), 5);
    assert.equal(totalsTolerance(25), 1.125);
  });
  test('possibly one person (§11 person-ambiguous)', () => {
    assert.equal(possiblyOnePerson('Sample Client A', 'Sample Client B'), false);
    assert.equal(possiblyOnePerson('Sample Client A', 'S Client A'), true);
    assert.equal(possiblyOnePerson('Mr. Sample Client', 'sample  client'), true);
    assert.equal(possiblyOnePerson('Shri S. K. Sample', 'Sample'), true, 'one label may carry extra one-letter words');
    assert.equal(possiblyOnePerson('S Sample', 'Sample K'), false, 'extra words from both labels never pair');
    assert.equal(possiblyOnePerson('S K Sample', 'Sumit Sample'), true);
    assert.equal(possiblyOnePerson('A Sample', 'B Sample'), false);
    assert.equal(possiblyOnePerson('Sample Client A', 'Sample Client A'), false);
    assert.equal(possiblyOnePerson('Other Client X', 'Other Client Y'), false);
  });
});

describe('cg-statement: the platform layout (§2 to §7)', () => {
  const imp = parse('cg-statement');

  test('expected validation results by id (bare import)', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['repeats-question', 'High', 5],
      ['pan-removed', 'Information', 27],
      ['footer-skipped', 'Information', 9],
      ['totals-reconciled', 'Information', 10],
      ['stated-tax-columns-empty', 'Information', undefined],
    ]));
  });
  test('sheet, header and lots', () => {
    assert.deepEqual(imp.sheet, { name: FAMILY, headerRow: 1 });
    assert.equal(imp.lots.length, 25);
    assert.deepEqual(imp.lots.map((l) => l.at.row), Array.from({ length: 25 }, (_, i) => i + 2));
    assert.equal(imp.totalsRow, 27);
    assert.equal(imp.footerRows, 9);
    assert.deepEqual(imp.excludedRows, []);
    assert.deepEqual(imp.skippedRows, []);
    assert.deepEqual(imp.ignoredColumns, []);
    assert.equal(imp.columns.length, 29);
  });
  test('lot 0: dates, amounts, names, tag (hand-worked: 100.5 units at 50 and 80)', () => {
    const l = imp.lots[0]!;
    assert.equal(l.saleDate, day(2025, 3, 31));
    assert.equal(v(l.purchaseDate), day(2021, 6, 15));
    assert.equal(l.financialYear.label, 'FY 2024-25');
    assert.equal(v(l.units), 100.5);
    assert.equal(v(l.saleValue), 8040);
    assert.equal(v(l.purchaseValue), 5025);
    assert.equal(v(l.realised), 3015);
    assert.equal(v(l.salePrice), 80);
    assert.equal(l.salePriceDerived, false);
    assert.equal(l.clientId, A);
    assert.equal(l.inReview, true);
    assert.equal(l.accountLabel, CLIENT_A);
    assert.equal(l.accountNote, 'Held Away');
    assert.equal(l.schemeLabel, 'Sample Flexi Cap Fund - Regular Plan - Growth Option');
    assert.equal(l.folio, '91000001');
    assert.equal(l.tagAsset, 'Equity');
    assert.equal(l.category, 'Flexi Cap Fund');
    assert.equal(l.statementAsset, 'Equity');
    assert.equal(v(l.statement.holdingDays), day(2025, 3, 31) - day(2021, 6, 15));
    assert.equal(v(l.statement.ltcg), 3015);
    assert.equal(st(l.statement.tax.total), STATUS.NOT_AVAILABLE);
    assert.deepEqual(l.failedChecks, []);
  });
  test('units keep every decimal; 3-paise offsets pass; year boundaries; digits/digits folio; the note-less Account Name', () => {
    assert.equal(v(imp.lots[1]!.units), 250.25);
    assert.equal(v(imp.lots[1]!.saleValue), 20620.63);
    assert.equal(imp.lots[1]!.financialYear.label, 'FY 2025-26');
    assert.equal(v(imp.lots[2]!.units), 1000.125);
    assert.equal(imp.lots[2]!.folio, '91000002/12');
    assert.equal(imp.lots[2]!.financialYear.label, 'FY 2025-26');
    assert.equal(imp.lots[3]!.financialYear.label, 'Tax year 2026-27');
    assert.equal(imp.lots[4]!.accountLabel, CLIENT_B);
    assert.equal(imp.lots[4]!.accountNote, '');
    assert.equal(imp.lots[4]!.clientId, B);
    assert.ok(imp.lots.every((l) => l.failedChecks.length === 0));
  });
  test('persons, distributors and accounts: Sample Client A under three distributors, one person', () => {
    assert.deepEqual(imp.persons.map((p) => [p.clientId, p.inReview]).sort(), [[A, true], [B, true]].sort());
    const aAccounts = new Set(imp.lots.filter((l) => l.clientId === A).map((l) => l.accountId));
    assert.equal(aAccounts.size, 3);
    assert.equal(new Set(imp.lots.map((l) => l.accountId)).size, 5);
    assert.equal(new Set(imp.lots.map((l) => l.distributorId)).size, 3);
  });
  test('reconciliation: the hand sums of the fixture equal the totals row; 0 totals over empty tax cells reconcile', () => {
    const sell = round2(STATEMENT_LOTS.reduce((s, l) => s + lotAmounts(l).sell, 0));
    const r = new Map(imp.reconciliation.map((x) => [x.field, x]));
    assert.ok(Math.abs(r.get('sellAmount')!.lotSum - sell) < 1e-6);
    assert.equal(r.get('sellAmount')!.outcome, 'reconciled');
    assert.equal(r.get('preTaxGL')!.outcome, 'reconciled');
    assert.equal(r.get('preTaxGL')!.lotSum, 0);
    assert.equal(r.get('cess')!.outcome, 'not-reconciled');
    assert.deepEqual(imp.reconciliation.filter((x) => x.outcome === 'not-reconciled').map((x) => x.field), ['cess', 'totalTax', 'postTaxGL']);
    assert.equal(r.get('sellAmount')!.tolerance, 1 + 0.005 * 25);
  });
  test('PAN: counts, and no PAN-shaped string anywhere in the import record, lots, issues, questions or audit', () => {
    assert.deepEqual(imp.pan, { tags: 25, tokens: 0, footerTokens: 2 });
    const json = JSON.stringify(imp);
    assert.equal(hasPanShape(json), false);
    for (const n of [1, 2, 7, 8]) {
      for (const lower of [false, true]) assert.equal(json.toLowerCase().includes(panToken(n, lower).toLowerCase()), false);
    }
    assert.ok(!json.includes('This statement is generated'), 'the footer text is never kept');
  });
  test('without the used range, the footer count stops at the last written row (PLAN-01 D7)', () => {
    assert.equal(parse('cg-statement', {}, false).footerRows, 2);
  });
});

describe('repeated rows (§6)', () => {
  const bare = parse('cg-statement');
  const ev = (imp: CgImport, lot: number) => imp.events.find((e) => e.lots.includes(lot));

  test('five sale events with repeats, one question each; the years without an answer are INSUFFICIENT EVIDENCE', () => {
    assert.equal(bare.events.length, 5);
    assert.equal(bare.questions.length, 5);
    assert.ok(bare.questions.every((q) => q.kind === 'capital-gains-repeats' && q.options.join() === 'as-stated,once'));
    assert.deepEqual(bare.insufficientYears, ['FY 2023-24', 'FY 2024-25', 'FY 2025-26']);
    assert.equal(issue(bare, 'repeats-question')!.message.includes(STATUS.INSUFFICIENT_EVIDENCE), true);
  });
  test('wholly and partly repeated events, their extra rows and duplicateOf', () => {
    const cases: Array<[number, number[], boolean, number[]]> = [
      [5, [5, 6], true, [6]],
      [7, [7, 8, 9, 10, 11, 12], true, [9, 10, 11, 12]],
      [13, [13, 14, 15, 16], true, [14, 15, 16]],
      [17, [17, 18, 19, 20], false, [19]],
      [23, [23, 24], true, [24]],
    ];
    for (const [lot, lots, wholly, extras] of cases) {
      const e = ev(bare, lot)!;
      assert.deepEqual([e.lots, e.wholly, e.extraLots], [lots, wholly, extras], `event of lot ${lot}`);
    }
    assert.equal(ev(bare, 21), undefined, 'two same-day lots with different units are not repeats');
    const dup = bare.lots.map((l) => l.duplicateOf);
    assert.deepEqual([dup[6], dup[9], dup[10], dup[11], dup[12], dup[14], dup[15], dup[16], dup[19], dup[24]], [5, 7, 8, 7, 8, 13, 13, 13, 18, 23]);
    assert.equal(dup[22], null);
    // Lots X (120 at 45, sold at 98.5: gain 6,420) and Y (80 at 44.2: gain 4,344), each repeated twice beyond the first.
    assert.equal(ev(bare, 7)!.extraRealised, 2 * 6420 + 2 * 4344);
    assert.ok(bare.lots.every((l) => !l.excludedAsRepeat));
  });
  test('the recorded answers: equal genuine lots as stated, one event once, "apply to all" once for the rest', () => {
    const imp = parse('cg-statement', { repeatAnswers: recordedAnswers(bare) });
    assert.equal(imp.questions.length, 0);
    assert.deepEqual(imp.insufficientYears, []);
    assert.equal(issue(imp, 'repeats-question'), undefined);
    assert.deepEqual(imp.lots.filter((l) => l.excludedAsRepeat).map((l) => l.index), [6, 9, 10, 11, 12, 14, 15, 16, 19]);
    assert.equal(imp.lots.length, 25, 'nothing is dropped: the extra rows stay in the import record');
    const decisions = imp.audit.filter((a) => a.kind === 'validation-decision');
    assert.equal(decisions.length, 5);
    assert.deepEqual(decisions.map((d) => d.detail.via).sort(), ['all', 'all', 'all', 'event', 'event']);
    assert.equal(ev(imp, 23)!.answer, 'as-stated');
    assert.equal(hasPanShape(JSON.stringify(imp.audit)), false);
  });
  test('a single answer leaves the other events open and their years insufficient', () => {
    const imp = parse('cg-statement', { repeatAnswers: { byEvent: { [bare.lots[13]!.eventId]: 'once' } } });
    assert.equal(imp.questions.length, 4);
    assert.deepEqual(imp.insufficientYears, ['FY 2024-25', 'FY 2025-26']);
    assert.equal(issue(imp, 'repeats-question')!.count, 4);
  });
  test('"apply to all" as stated excludes nothing', () => {
    const imp = parse('cg-statement', { repeatAnswers: { all: 'as-stated' } });
    assert.equal(imp.questions.length, 0);
    assert.ok(imp.lots.every((l) => !l.excludedAsRepeat));
  });
});

describe('cg-statement-reordered: header matching (§2.1, §2.2)', () => {
  const imp = parse('cg-statement-reordered');
  const base = parse('cg-statement');
  test('expected results: the note sheet and the extra columns listed', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['columns-ignored', 'Information', 2],
      ['xirr-not-used', 'Information', undefined],
      ['repeats-question', 'High', 5],
      ['pan-removed', 'Information', 27],
      ['footer-skipped', 'Information', 9],
      ['totals-reconciled', 'Information', 10],
      ['stated-tax-columns-empty', 'Information', undefined],
    ]));
    assert.deepEqual(imp.sheet, { name: FAMILY, headerRow: 3 });
    assert.deepEqual(imp.ignoredColumns, ['Remarks', 'Branch']);
    assert.ok(issue(imp, 'sheet-used')!.message.includes('"Notes"'));
  });
  test('the same lots as cg-statement (row positions aside)', () => {
    const strip = (l: CgLot) => ({ ...l, at: null });
    assert.deepEqual(imp.lots.map(strip), base.lots.map(strip));
    assert.deepEqual(imp.lots.map((l) => l.at.row), base.lots.map((l) => l.at.row + 2));
  });
});

describe('refused files (§2.1, §2.2, §11)', () => {
  test('cg-statement-duplicate-column: Blocking duplicate-column, no lots', () => {
    const imp = parse('cg-statement-duplicate-column');
    assert.deepEqual(results(imp), [['duplicate-column', 'Blocking', 1]]);
    assert.equal(imp.lots.length, 0);
    assert.ok(issue(imp, 'duplicate-column')!.message.includes('Sale Date'));
  });
  test('cg-statement-not-template: Blocking no-header naming the five missing columns', () => {
    const imp = parse('cg-statement-not-template');
    assert.deepEqual(results(imp), [['no-header', 'Blocking', 5]]);
    const m = issue(imp, 'no-header')!.message;
    for (const h of ['Purchase Date', 'Sale Unit', 'Sell Amount (₹)', 'Invested Value (₹)', 'Category Name or Asset Name']) assert.ok(m.includes(h), h);
    assert.equal(imp.sheet, null);
    assert.equal(imp.audit[0]!.kind, 'import');
  });
  test('cg-template-blank: Blocking no-lots', () => {
    const imp = parse('cg-template-blank');
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['no-lots', 'Blocking', undefined],
    ]));
    assert.deepEqual(imp.sheet, { name: 'Capital Gains', headerRow: 1 });
  });
});

describe('cg-template-filled: the template round trip (§12)', () => {
  const imp = parse('cg-template-filled');
  test('expected results: derived prices labelled, no totals row, no row check failed', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['no-totals-row', 'Information', undefined],
      ['stated-tax-columns-empty', 'Information', undefined],
      ['derived-prices', 'Information', 11],
    ]));
  });
  test('loads without loss: six lots, folios from the Folio Number column, derived prices exact', () => {
    assert.equal(imp.lots.length, 6);
    assert.deepEqual(imp.lots.map((l) => l.folio), ['91000021', '91000022', '91000023', '91000024', '91000024', '91000024']);
    const l0 = imp.lots[0]!;
    assert.equal(v(l0.units), 12.5);
    assert.equal(v(l0.salePrice), 825 / 12.5);
    assert.equal(l0.salePriceDerived, true);
    assert.equal(v(l0.purchasePrice), 500 / 12.5);
    assert.equal(l0.purchasePriceDerived, true);
    const merger = imp.lots[3]!;
    assert.equal(merger.salePriceDerived, false);
    assert.equal(v(merger.statement.acquisitionDate), merger.saleDate);
    assert.equal(v(merger.statement.acquisitionPrice), 27);
    assert.equal(v(merger.statement.ltcg), 0);
    assert.equal(st(imp.lots[0]!.statement.ltcg), STATUS.NOT_AVAILABLE);
    assert.equal(imp.lots[2]!.clientId, B);
    assert.ok(imp.lots.every((l) => l.schemeLabel.startsWith('Sample ') && l.tagAsset === null));
  });
});

describe('cg-statement-footer-mismatch: totals row, subtotal and excluded lots (§2.4, §7)', () => {
  const imp = parse('cg-statement-footer-mismatch');
  test('expected results', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['repeats-question', 'High', 5],
      ['totals-mismatch', 'High', 1],
      ['row-without-sale-date', 'Warning', 2],
      ['pan-removed', 'Information', 28],
      ['footer-skipped', 'Information', 9],
      ['totals-reconciled', 'Information', 9],
      ['stated-tax-columns-empty', 'Information', undefined],
    ]));
  });
  test('the Grand Total is the totals row; the subtotal and the invalid-date row are excluded lots, never footer', () => {
    assert.equal(imp.lots.length, 25);
    assert.equal(imp.totalsRow, 29);
    assert.deepEqual(imp.excludedRows.map((e) => [e.at.row, e.reason]), [[27, 'no-sale-date'], [28, 'subtotal']]);
    const m = issue(imp, 'totals-mismatch')!.message;
    assert.ok(m.includes('Sell Amount') && m.includes('-100.00') && m.includes('rows 27, 28'), m);
    assert.equal(imp.reconciliation.find((x) => x.field === 'sellAmount')!.outcome, 'mismatch');
  });
});

describe('cg-statement-bad-cells: each Warning with its count (§4, §11)', () => {
  const imp = parse('cg-statement-bad-cells');
  test('expected results', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['clients-unmatched', 'Warning', 2],
      ['row-without-sale-date', 'Warning', 1],
      ['invalid-cells', 'Warning', 2],
      ['row-check-failed', 'Warning', 1],
      ['row-check-failed', 'Warning', 1],
      ['row-check-failed', 'Warning', 1],
      ['row-check-failed', 'Warning', 1],
      ['row-check-failed', 'Warning', 1],
      ['row-check-failed', 'Warning', 1],
      ['nonzero-principal-or-interest', 'Warning', 2],
      ['tag-asset-differs', 'Warning', 1],
      ['person-ambiguous', 'Warning', 1],
      ['pan-removed', 'Information', 17],
      ['rows-skipped', 'Information', 2],
      ['no-totals-row', 'Information', undefined],
      ['stated-tax-columns-empty', 'Information', undefined],
    ]));
  });
  test('each row check fails on its own lot only', () => {
    const failed = imp.lots.map((l) => l.failedChecks);
    assert.deepEqual(failed, [[], [], [], ['holding-days'], ['sale-amount'], ['invested-value'], ['realised'], ['date-order'], ['units-positive'], [], [], [], [], [], [], []]);
  });
  test('invalid cells are INVALID SOURCE DATA; the Sale Unit 0 row gets no derived price', () => {
    assert.equal(st(imp.lots[1]!.purchaseDate), STATUS.INVALID_SOURCE);
    assert.equal(st(imp.lots[2]!.purchaseValue), STATUS.INVALID_SOURCE);
    assert.equal(st(imp.lots[2]!.realised), STATUS.NOT_AVAILABLE);
    assert.equal(st(imp.lots[8]!.salePrice), STATUS.NOT_AVAILABLE);
    assert.equal(imp.lots[8]!.salePriceDerived, false);
  });
  test('excluded and skipped rows by position', () => {
    assert.deepEqual(imp.excludedRows.map((e) => e.at.row), [5]);
    assert.deepEqual(imp.skippedRows.map((s) => [s.at.row, s.reason]), [[9, 'blank-row'], [13, 'repeated-header']]);
  });
  test('clients: Other Client Z and S Client A are not in the review; S Client A is possibly Sample Client A; Sample Client B never', () => {
    assert.deepEqual(imp.persons.filter((p) => !p.inReview).map((p) => p.label).sort(), ['Other Client Z', 'S Client A']);
    assert.equal(imp.lots[12]!.accountLabel, 'Other Client Z');
    assert.equal(imp.lots[12]!.accountNote, `Held Away PAN ${PAN_REPLACEMENT}`);
    assert.deepEqual(imp.pan, { tags: 16, tokens: 1, footerTokens: 0 });
    assert.equal(hasPanShape(JSON.stringify(imp)), false);
  });
  test('messages carry no folio, no client name and no en or em dash (§11, D-029)', () => {
    for (const i of imp.issues) {
      assert.ok(!/9100\d{4}/.test(i.message), i.message);
      assert.ok(!i.message.includes('Other Client') && !i.message.includes('Sample Client'), i.message);
      assert.ok(!/[–—]/.test(i.message), i.message);
    }
  });
});

describe('cg-statement-other-family (§11)', () => {
  const imp = parse('cg-statement-other-family');
  test('High clients-unmatched and Warning family-differs', () => {
    assert.deepEqual(sortE(results(imp)), sortE([
      ['sheet-used', 'Information', undefined],
      ['xirr-not-used', 'Information', undefined],
      ['clients-unmatched', 'High', 2],
      ['family-differs', 'Warning', 2],
      ['pan-removed', 'Information', 4],
      ['footer-skipped', 'Information', 9],
      ['totals-reconciled', 'Information', 10],
      ['stated-tax-columns-empty', 'Information', undefined],
    ]));
    assert.ok(imp.lots.every((l) => !l.inReview && l.clientId !== A && l.clientId !== B));
  });
  test('family label unset: Family Name not compared; no review: client checks not run', () => {
    const unset = parse('cg-statement-other-family', { review: { ...REVIEW, familyLabel: null } });
    assert.equal(issue(unset, 'family-differs'), undefined);
    const none = parseCapitalGains(read('cg-statement-other-family'), { sourceId: SRC, now: NOW });
    assert.equal(issue(none, 'clients-unmatched'), undefined);
    assert.equal(issue(none, 'family-differs'), undefined);
  });
});

describe('every reader id of design §11 appears in some fixture', () => {
  test('coverage', () => {
    const readerIds = [
      'no-header', 'duplicate-column', 'no-lots', 'repeats-question', 'totals-mismatch', 'clients-unmatched',
      'family-differs', 'row-without-sale-date', 'invalid-cells', 'row-check-failed', 'nonzero-principal-or-interest',
      'tag-asset-differs', 'person-ambiguous', 'sheet-used', 'columns-ignored', 'pan-removed', 'rows-skipped',
      'footer-skipped', 'totals-reconciled', 'no-totals-row', 'stated-tax-columns-empty', 'derived-prices', 'xirr-not-used',
    ];
    const seen = new Set<string>();
    for (const id of fixtures.keys()) for (const i of parse(id).issues) seen.add(i.ruleId.replace('capital-gains.', ''));
    assert.deepEqual(readerIds.filter((r) => !seen.has(r)), []);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Boundaries and the review's findings on 7e9e51d (items 2 to 4), on small in-memory workbooks.

type Mem = Partial<Record<'Sale Date' | 'Client Name' | 'Instrument Name' | 'Category Name' | 'Purchase Date' | 'Purchase Price' | 'Sale Price' | 'Sale Unit' | 'Sell Amount' | 'Invested Value' | 'Realized G/L' | 'XIRR (%)', Cell | number | string | null>>;
const MEM_HEADERS = ['Sale Date', 'Client Name', 'Instrument Name', 'Category Name', 'Purchase Date', 'Purchase Price', 'Sale Price', 'Sale Unit', 'Sell Amount', 'Invested Value', 'Realized G/L', 'XIRR (%)'] as const;
const dt = (y: number, m: number, d: number): Cell => ({ t: 'n', v: dayToExcelSerial(ymdToDay(y, m, d)!), fmt: 'dd-mmm-yyyy', date: true });
const toCell = (x: Cell | number | string | null | undefined): Cell =>
  x === null || x === undefined ? null : typeof x === 'number' ? { t: 'n', v: x, fmt: null, date: false } : typeof x === 'string' ? { t: 's', v: x } : x;
/** A clean lot: 10 units bought at 50 and sold at 100; every row check passes. */
const CLEAN: Mem = {
  'Sale Date': dt(2025, 1, 2), 'Client Name': CLIENT_A, 'Instrument Name': 'Sample Fund [Folio No: 91000901 || Asset: Equity]',
  'Category Name': 'Flexi Cap Fund', 'Purchase Date': dt(2023, 1, 2), 'Purchase Price': 50, 'Sale Price': 100, 'Sale Unit': 10,
  'Sell Amount': 1000, 'Invested Value': 500, 'Realized G/L': 500, 'XIRR (%)': 12.5,
};
function memBook(lots: Mem[], tail: Cell[][] = []): Workbook {
  const rows: Cell[][] = [MEM_HEADERS.map((h) => toCell(h)), ...lots.map((l, i) => MEM_HEADERS.map((h) =>
    toCell(h === 'Instrument Name' ? `Sample Fund ${i} [Folio No: ${91000900 + i} || Asset: Equity]` : (h in l ? l[h] : CLEAN[h]))))];
  return { sheets: [{ name: 'Mem', hidden: false, rows: [...rows, ...tail] }], date1904: false };
}
const memParse = (wb: Workbook): CgImport => parseCapitalGains(wb, { sourceId: SRC, now: NOW, review: REVIEW });

describe('tolerance boundaries (§4, §7)', () => {
  test('Rs 1 floor: exactly Rs 1 off passes, Rs 1.01 fails (each amount check)', () => {
    const imp = memParse(memBook([
      { 'Sell Amount': 1001, 'Realized G/L': 501 },
      { 'Sell Amount': 1001.01, 'Realized G/L': 501.01 },
      { 'Invested Value': 499, 'Realized G/L': 501 },
      { 'Invested Value': 498.99, 'Realized G/L': 501.01 },
      { 'Realized G/L': 501 },
      { 'Realized G/L': 501.01 },
    ]));
    assert.deepEqual(imp.lots.map((l) => l.failedChecks), [[], ['sale-amount'], [], ['invested-value'], [], ['realised']]);
  });
  test('0.01% above Rs 10,000: Rs 5 off Rs 50,000 passes, Rs 5.01 fails', () => {
    const imp = memParse(memBook([
      { 'Sale Unit': 1, 'Sale Price': 50005, 'Sell Amount': 50000, 'Purchase Price': 500, 'Invested Value': 500, 'Realized G/L': 49500 },
      { 'Sale Unit': 1, 'Sale Price': 50005.01, 'Sell Amount': 50000, 'Purchase Price': 500, 'Invested Value': 500, 'Realized G/L': 49500 },
    ]));
    assert.deepEqual(imp.lots.map((l) => l.failedChecks), [[], ['sale-amount']]);
  });
  test('totals: Rs 1 + Rs 0.005 x 200 lots = Rs 2 reconciles at exactly Rs 2, not at Rs 2.01', () => {
    const lots = Array.from({ length: 200 }, (): Mem => ({}));
    const total = (sell: number): Cell[] => MEM_HEADERS.map((h) => toCell(h === 'Sale Date' ? 'Grand Total' : h === 'Sell Amount' ? sell : null));
    const at = (sell: number) => memParse(memBook(lots, [total(sell)])).reconciliation.find((x) => x.field === 'sellAmount')!;
    assert.equal(at(200000 + 2).outcome, 'reconciled');
    assert.equal(at(200000 + 2).tolerance, 2);
    assert.equal(at(200000 + 2.01).outcome, 'mismatch');
    assert.equal(at(200000 - 2).outcome, 'reconciled');
  });
});

describe('the review of 7e9e51d: percent text and lots without a person', () => {
  test('"12%" in a money cell is INVALID SOURCE DATA, never 12; a percent sign is accepted in XIRR only', () => {
    const imp = memParse(memBook([{ 'Sell Amount': '1000%', 'XIRR (%)': '12.5%' }, { 'Purchase Price': '50%' }]));
    assert.equal(st(imp.lots[0]!.saleValue), STATUS.INVALID_SOURCE);
    assert.equal(st(imp.lots[1]!.purchasePrice), STATUS.INVALID_SOURCE);
    assert.equal(issue(imp, 'invalid-cells')!.count, 2);
  });
  test('a lot with neither Client Name nor Account Name is counted in clients-unmatched and named', () => {
    const imp = memParse(memBook([{}, { 'Client Name': null }]));
    assert.equal(imp.lots[1]!.clientId, null);
    const i = issue(imp, 'clients-unmatched')!;
    assert.deepEqual([i.severity, i.count], ['Warning', 1]);
    assert.ok(i.message.includes('no client label'), i.message);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Gate B (ARC-03, NO-GO on 1144ba8): B1, B2, and the tests asked for in R2 and R5.

describe('Gate B B1: review clients that differ only in letter case stay two (D-039)', () => {
  const caseReview = (labels: string[]): NonNullable<CgOptions['review']> => ({
    clients: labels.map((l, i) => ({ id: `cl_case_${i}` as ClientId, label: l, displayLabel: null })), familyLabel: FAMILY,
  });
  const run = (review: NonNullable<CgOptions['review']>, clients: string[]) =>
    parseCapitalGains(memBook(clients.map((c): Mem => ({ 'Client Name': c }))), { sourceId: SRC, now: NOW, review });
  test('each spelling joins its own review client', () => {
    const imp = run(caseReview(['Sample Client A', 'SAMPLE CLIENT A']), ['Sample Client A', 'SAMPLE CLIENT A', 'Sample  Client A']);
    assert.deepEqual(imp.lots.map((l) => l.clientId), ['cl_case_0', 'cl_case_1', 'cl_case_0']);
    assert.ok(imp.lots.every((l) => l.inReview));
    assert.equal(issue(imp, 'clients-unmatched'), undefined);
  });
  test('a third spelling matching two case variants is left unmatched and named', () => {
    const imp = run(caseReview(['Sample Client A', 'SAMPLE CLIENT A']), ['sample client a']);
    assert.equal(imp.lots[0]!.inReview, false);
    const i = issue(imp, 'clients-unmatched')!;
    assert.deepEqual([i.severity, i.count], ['High', 1]);
    assert.ok(i.message.includes('differ only in letter case'), i.message);
  });
  test('a case-insensitive match is still used when it names one review client', () => {
    const imp = run(caseReview(['Sample Client A']), ['SAMPLE CLIENT A']);
    assert.deepEqual([imp.lots[0]!.clientId, imp.lots[0]!.inReview], ['cl_case_0', true]);
  });
});

describe('Gate B B2: a plain number in Sale Date is not a date', () => {
  test('a count or SUM (1) in Sale Date with amounts is an excluded lot, never a lot sold in 1900', () => {
    const imp = memParse(memBook([{}, { 'Sale Date': 1 }, { 'Sale Date': 45000 }]));
    assert.equal(imp.lots.length, 1);
    assert.deepEqual(imp.excludedRows.map((e) => [e.at.row, e.reason]), [[3, 'no-sale-date'], [4, 'no-sale-date']]);
    assert.equal(issue(imp, 'row-without-sale-date')!.count, 2);
  });
});

describe('Gate B R2: PAN-shaped text in a sheet name and in an error cell', () => {
  test('both removed, counted, and absent from the whole import record', () => {
    const lot = memBook([{ 'Category Name': { t: 'e', v: `#REF ${panToken(11)}` } }]);
    const wb: Workbook = { date1904: false, sheets: [{ name: `Notes ${panToken(12)}`, hidden: false, rows: [['notes']] }, lot.sheets[0]!] };
    const imp = parseCapitalGains(wb, { sourceId: SRC, now: NOW, review: REVIEW });
    assert.equal(imp.lots.length, 1);
    assert.equal(imp.pan.tokens, 2);
    assert.equal(hasPanShape(JSON.stringify(imp)), false);
    assert.ok(imp.sheets[0]!.sheet.includes(PAN_REPLACEMENT));
  });
});

describe('Gate B R5: losses, totals variants, units, Lakh headers and the 1904 date system', () => {
  test('a loss: signed realised gain; a loss off by more than the tolerance fails the realised check', () => {
    const imp = memParse(memBook([
      { 'Sale Price': 40, 'Sell Amount': 400, 'Realized G/L': -100 },
      { 'Sale Price': 40, 'Sell Amount': 400, 'Realized G/L': -110 },
    ]));
    assert.equal(v(imp.lots[0]!.realised), -100);
    assert.deepEqual(imp.lots.map((l) => l.failedChecks), [[], ['realised']]);
  });
  test('a negative column sum reconciles with a "Total" row (no "Grand Total")', () => {
    const total = MEM_HEADERS.map((h) => toCell(h === 'Sale Date' ? 'Total' : h === 'Sell Amount' ? 800 : h === 'Invested Value' ? 1000 : h === 'Realized G/L' ? -200 : null));
    const imp = memParse(memBook([{ 'Sale Price': 40, 'Sell Amount': 400, 'Realized G/L': -100 }, { 'Sale Price': 40, 'Sell Amount': 400, 'Realized G/L': -100 }], [total]));
    assert.equal(imp.totalsRow, 4);
    assert.equal(imp.reconciliation.find((x) => x.field === 'realisedGL')!.outcome, 'reconciled');
  });
  test('a negative Sale Unit fails units-positive and derives no price; Sale Unit 0 with a stated price fails both checks', () => {
    const imp = memParse(memBook([
      { 'Sale Unit': -10, 'Sale Price': null, 'Purchase Price': null },
      { 'Sale Unit': 0 },
    ]));
    assert.deepEqual(imp.lots[0]!.failedChecks, ['units-positive']);
    assert.equal(imp.lots[0]!.salePriceDerived, false);
    assert.deepEqual(imp.lots[1]!.failedChecks, ['sale-amount', 'invested-value', 'units-positive']);
  });
  test('a header in Lakh is not a rupee column', () => {
    assert.equal(fieldOfHeader('Sell Amount (Lakh)'), null);
    assert.equal(fieldOfHeader('Invested Value (Cr.)'), null);
  });
  test('a workbook in the 1904 date system reads the same calendar days', () => {
    const wb = memBook([{}]);
    const d1904 = (y: number, m: number, d: number): Cell => ({ t: 'n', v: dayToExcelSerial(ymdToDay(y, m, d)!) - 1462, fmt: 'dd-mmm-yyyy', date: true });
    const row = wb.sheets[0]!.rows[1]!;
    row[0] = d1904(2025, 1, 2);
    row[4] = d1904(2023, 1, 2);
    const imp = parseCapitalGains({ ...wb, date1904: true }, { sourceId: SRC, now: NOW, review: REVIEW });
    assert.equal(imp.lots[0]!.saleDate, day(2025, 1, 2));
    assert.equal(v(imp.lots[0]!.purchaseDate), day(2023, 1, 2));
  });
});
