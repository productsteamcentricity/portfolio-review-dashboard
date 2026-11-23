// covers: E-01 E-03 OD-8 OD-18 KI-147 D-039
// KI-147, the notes of the overview (the financial review of the first M1.4 run, fixed in the M1.4 fix round): a note
// counts the distinct holdings whose figure the money-column rule changes, names the column the file actually heads,
// never says "Crore" of a Lakh file, agrees in number, and never comes from the file's own gain or loss, which no
// figure uses (OD-18: that column's notices are logged in the import report and the audit log only). End to end
// through loadBaseFile, computeReview and buildOverviewVM on small synthetic books; known answers by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../app/src/model/review.ts';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { buildOverviewVM } from '../../app/src/views/overview.ts';
import { buildValidationPanel } from '../../app/src/views/validation-panel.ts';
import { workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-10-27T00:00:00.000Z';
const ID = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name'];

/** A base file of the given money headers; each row is the money cells after the five label cells. */
function book(money: string[], rows: Array<Array<number | string | null>>): Uint8Array {
  const aoa = [[...ID, ...money], ...rows.map((m, i) => ['Sample Client A', `Sample Fund ${i + 1}`, 'Equity', 'Mutual Funds', 'Centricity', ...m])];
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(aoa), 'Base File');
  return writeXlsx(xlsx, wb);
}

function run(bytes: Uint8Array): { review: Review; vm: OverviewVM } {
  const loaded = loadBaseFile(bytes, 'money.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  const review = computeReview({ loaded, asOn: 20726, labels: { family: 'Sample Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'ki-147-notes', channel: 'preview', libraries: [] } });
  return { review, vm: buildOverviewVM(review) };
}

const note = (vm: OverviewVM, id: string): string | undefined => vm.notes.find((n) => n.id === id)?.text;
const kpiNotes = (vm: OverviewVM, id: string): string[] => vm.kpis.find((k) => k.id === id)!.figure.notes;
const money = (vm: OverviewVM): string[] => vm.notes.filter((n) => /^money-/.test(n.id)).map((n) => n.id);

describe('the money notes count what changes a figure and name the column the file heads (KI-147)', () => {
  test('a Lakh-only file, "12abc" in the Lakh market value: one holding, the Lakh column named, never "Crore"', () => {
    // Lakh: (invested, market value, gain) = (50, "12abc", 12.5), (40, 45.2, 5.2), (80, 89.6, 9.6).
    const { review, vm } = run(book(['Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'],
      [[50, '12abc', 12.5], [40, 45.2, 5.2], [80, 89.6, 9.6]]));
    assert.equal(review.displayUnit, 'lakh');
    assert.deepEqual([review.totals.counts.included, review.totals.counts.excluded], [2, 1]);
    // 45.2 + 89.6 = 134.8 Lakh.
    assert.equal(vm.kpis.find((k) => k.id === 'cmv')!.figure.display.text, '134.80');
    assert.equal(note(vm, 'money-invalid'),
      '1 holding has a market value in "Current Market Value (Lakh)" that is not a number: it is invalid source data.');
    assert.deepEqual(money(vm), ['money-invalid']);
    for (const n of vm.notes) assert.ok(!/Crore|Cr\./.test(n.text), n.text);
    assert.deepEqual(kpiNotes(vm, 'cmv'), ['excluded', 'money-invalid']);
    assert.ok(!kpiNotes(vm, 'invested').includes('money-invalid'), 'the invested total is not changed');
  });

  test('a Lakh and rupee file whose market values disagree: the Lakh amount is used, and the note says so in Lakh', () => {
    // Holding 2: 45.2 Lakh = 0.452 Cr beside Rs 46,00,000 = 0.46 Cr, 0.008 Cr apart (more than 0.005). The others agree.
    const { review, vm } = run(book(['Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Invested Value (₹)', 'Market Value (₹)'],
      [[50, 62.5, 5000000, 6250000], [40, 45.2, 4000000, 4600000], [80, 89.6, 8000000, 8960000]]));
    assert.equal(review.displayUnit, 'lakh');
    // 62.5 + 45.2 + 89.6 = 197.3 Lakh: the Lakh amount is the one used.
    assert.equal(vm.kpis.find((k) => k.id === 'cmv')!.figure.display.text, '197.30');
    assert.equal(note(vm, 'money-disagree'),
      '1 holding has a market value in "Current Market Value (Lakh)" that is used although its rupee amount differs by more than 0.5 Lakh.');
    assert.deepEqual(money(vm), ['money-disagree']);
    assert.deepEqual(kpiNotes(vm, 'cmv'), ['money-disagree']);
    assert.deepEqual(kpiNotes(vm, 'invested'), []);
    for (const n of vm.notes) assert.ok(!/Crore/.test(n.text), n.text);
  });

  test('one holding with both its invested value and its market value invalid counts once', () => {
    // Holding 1: Crore invested "12abc" and Crore market value "9x" beside Lakh 50 and 62.5: excluded (OD-8), so its
    // invested value changes no figure; the note counts 1 holding, never 2.
    const { review, vm } = run(book(['Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Invested Value (Lakh)', 'Current Market Value (Lakh)'],
      [['12abc', '9x', 50, 62.5], [0.4, 0.452, 40, 45.2]]));
    const warnings = review.issues.filter((i) => i.ruleId === 'base-file.money-invalid');
    assert.equal(warnings.length, 2, 'the reader warns of each column');
    assert.equal(note(vm, 'money-invalid'),
      '1 holding has a market value in "Current Market Value (Cr.)" that is not a number: it is invalid source data, and no Lakh amount is used in its place.');
    assert.deepEqual(kpiNotes(vm, 'invested'), [], 'the excluded holding\'s invested value is in no total');
  });

  test('two holdings, one market value and one invested value invalid: "amounts", plural, both columns named', () => {
    // Holding 1 market value "9x" (excluded); holding 2 invested "12abc" (included, without an invested value).
    const { vm } = run(book(['Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Invested Value (Lakh)', 'Current Market Value (Lakh)'],
      [[0.5, '9x', 50, 62.5], ['12abc', 0.452, 40, 45.2], [0.8, 0.896, 80, 89.6]]));
    assert.equal(note(vm, 'money-invalid'),
      '2 holdings have amounts in "Current Market Value (Cr.)" or "Invested Value (Cr.)" that are not numbers: they are invalid source data, and no Lakh amounts are used in their place.');
    assert.ok(kpiNotes(vm, 'cmv').includes('money-invalid'));
    assert.ok(kpiNotes(vm, 'invested').includes('money-invalid'));
  });

  test('only the file\'s gain or loss is invalid or disagrees: no money note, no note id on a KPI, logged as Information', () => {
    // Holding 1: Crore gain "12abc"; holding 2: Crore gain 0.05 beside Lakh gain 9 (0.09 Cr, 0.04 apart). No figure
    // uses the file's gain or loss (OD-18): gain is CMV minus invested.
    const { review, vm } = run(book(['Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)',
      'Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'],
    [[0.5, 0.625, '12abc', 50, 62.5, 12.5], [0.4, 0.452, 0.05, 40, 45.2, 9], [0.8, 0.896, 0.096, 80, 89.6, 9.6]]));
    assert.deepEqual(money(vm), []);
    for (const k of vm.kpis) assert.ok(!k.figure.notes.some((n) => /^money-/.test(n)), k.id);
    // 0.625 + 0.452 + 0.896 - (0.5 + 0.4 + 0.8) = 0.273.
    assert.equal(vm.kpis.find((k) => k.id === 'gain')!.figure.display.text, '0.27');
    const gl = review.issues.filter((i) => /^base-file\.money-(invalid|disagree)$/.test(i.ruleId));
    assert.deepEqual(gl.map((i) => [i.ruleId, i.severity, i.status]),
      [['base-file.money-invalid', 'Information', 'resolved'], ['base-file.money-disagree', 'Information', 'resolved']]);
    for (const i of gl) assert.match(i.message, /; no figure uses the file's gain or loss \(OD-18\)\.$/);
    assert.match(gl[0]!.message, /^1 holding has text that is not an amount in "Total Gain\/Loss \(Cr\.\)" \(row 2\), so its gain or loss is invalid source data; "Total Gain\/Loss \(Lakh\)" is not used instead;/);
    // The import report (the validation panel of section 1) logs them; the workbook's Audit Log lists them.
    const info = buildValidationPanel(review.issues).groups.find((g) => g.severity === 'Information')!;
    assert.ok(gl.every((i) => info.items.some((x) => x.id === i.id)));
    assert.equal(buildValidationPanel(review.issues).groups.find((g) => g.severity === 'Warning')!.items.some((x) => /^base-file\.money-/.test(x.ruleId)), false);
    const results = workbookInputFrom(review, vm).results;
    assert.ok(gl.every((i) => results.some((r) => r.id === i.id && r.severity === 'Information')));
    assert.equal(review.gate.canExport, true);
  });

  test('the reader\'s Warning agrees in number: "their market values are invalid source data" (L16)', () => {
    const { review } = run(book(['Current Market Value (Cr.)'], [['12abc'], ['9x'], [0.896]]));
    const w = review.issues.find((i) => i.ruleId === 'base-file.money-invalid')!;
    assert.equal(w.message,
      '2 holdings have text that is not an amount in "Current Market Value (Cr.)" (rows 2 and 3), so their market values are invalid source data and they are excluded from every total.');
    const one = run(book(['Current Market Value (Cr.)'], [['12abc'], [0.896]])).review.issues.find((i) => i.ruleId === 'base-file.money-invalid')!;
    assert.equal(one.message,
      '1 holding has text that is not an amount in "Current Market Value (Cr.)" (row 2), so its market value is invalid source data and it is excluded from every total.');
  });
});
