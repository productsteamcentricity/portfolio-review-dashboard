// covers: E-85 U-28 E-142 (the Fund IRR sheet, M3a wiring, NB-03; architecture §14 sheet 13)
// The overview workbook of the synthetic base book (syn-standard) with and without the returns of a synthetic IRR file:
// the Fund IRR sheet only with returns, just before Audit Log; its first row says the XIRR is computed by the app
// (MOD-04 condition 3; Q-60); each headline figure as the engine's value (a missing one blank, with its status) and
// recorded in _manifest; the IRR file in the Source Register and named in the Read Me (as the base file is); and a
// workbook without returns as before (no sheet, no "Sheet left out" row, no IRR file row in the Read Me; the golden
// hashes of column-default-style.test.ts pin its bytes).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { LoadedIrrFile } from '../../../app/src/ingest/load-irr.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM, SCREEN_MISSING_LEAD, SHEET_MISSING_LEAD, XIRR_BASIS_TEXT } from '../../../app/src/views/returns.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { irrFixtures } from '../../fixtures/make-irr-files.ts';
import { dateCell, FUND_HEADER, fundRow, toWorkbook } from '../../fixtures/make-irr-files.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const w = nodeWiring();
const { review, vm } = reviewOf(w, fixtureById('syn-standard'));
const files = new Map(irrFixtures().map((f) => [f.id, f.bytes] as const));
function load(id: string): LoadedIrrFile {
  const l = w.loadIrrFile!(files.get(id)!, `${id}.xlsx`);
  if (!('irr' in l)) throw new Error(`${id}: ${l.kind}`);
  return l;
}
function returnsVmOf(id: string) {
  const l = load(id);
  return buildReturnsVM(returnsForReview(review, l.irr), review, { source: { ...l.source, stage: 'review' } });
}

const plain = buildOverviewWorkbook(workbookInputFrom(review, vm));
const plainNames = readXlsx(plain).sheets.map((s) => s.name);

describe('without returns', () => {
  test('no Fund IRR sheet and no "Sheet left out" row for it; null and undefined give the same bytes', () => {
    assert.ok(!plainNames.includes('Fund IRR'));
    const readMe = sheetTable(sheetByName(readXlsx(plain), 'Read Me and Controls')).map((r) => r.join(' ')).join('\n');
    assert.ok(!readMe.includes('Fund IRR'));
    assert.deepEqual(buildOverviewWorkbook(workbookInputFrom(review, vm, null)), plain);
  });

  test('the Read Me names no transactions (IRR) file', () => {
    const readMe = sheetTable(sheetByName(readXlsx(plain), 'Read Me and Controls'));
    assert.ok(!readMe.some((r) => String(r[0]).startsWith('Transactions (IRR) file')));
    assert.ok(readMe.some((r) => r[0] === 'Base file' && r[1] === 'syn-standard.xlsx'), 'the base file is named as before');
  });
});

describe('with returns', () => {
  const returns = returnsVmOf('irr-standard');
  const bytes = buildOverviewWorkbook(workbookInputFrom(review, vm, returns));
  const wb = readXlsx(bytes);
  const table = sheetTable(sheetByName(wb, 'Fund IRR'));
  const header = table[0]!;
  const col = (name: string): number => header.indexOf(name);

  test('Fund IRR is written just before Audit Log; every other sheet as without returns', () => {
    const names = wb.sheets.map((s) => s.name);
    assert.equal(names[names.indexOf('Audit Log') - 1], 'Fund IRR');
    assert.deepEqual(names.filter((n) => n !== 'Fund IRR'), plainNames);
    const readMe = sheetTable(sheetByName(wb, 'Read Me and Controls'));
    assert.match(String(readMe.find((r) => r[0] === 'Sheets in this workbook')![1]), /Fund IRR, Audit Log/);
    assert.ok(!readMe.some((r) => r[0] === 'Sheet left out' && String(r[1]).startsWith('Fund IRR')));
    assert.deepEqual(buildOverviewWorkbook(workbookInputFrom(review, vm, returns)), bytes, 'the same input gives the same bytes');
  });

  test('MOD-04: the first row says the XIRR is computed by the app, with the Excel check column to come (Q-60)', () => {
    assert.equal(table[1]![col('Part')], 'Note');
    assert.equal(table[1]![col('Label')], XIRR_BASIS_TEXT);
    assert.match(String(table[1]![col('Label')]), /^XIRR computed by the app \(actual\/365\); an Excel XIRR check column comes later \(Q-60\)\.$/);
  });

  test('each headline figure is the engine value (blank with its status when missing) and is recorded in _manifest', () => {
    const manifest = new Map(sheetTable(sheetByName(wb, '_manifest')).filter((r) => String(r[0]).startsWith('figure returns.')).map((r) => [String(r[0]).slice(7), String(r[1])]));
    const fund = sheetByName(wb, 'Fund IRR');
    let missing = 0;
    for (const s of returns.scopes) {
      const row = table.findIndex((r) => r[col('Part')] === 'Headline' && r[col('Label')] === s.pickerLabel);
      assert.ok(row > 0, `${s.key}: a headline row`);
      for (const [f, valueCol, statusCol] of [[s.headline.fund, 'Fund XIRR (%)', 'Fund XIRR Status'], [s.headline.bench, 'Benchmark XIRR (%)', 'Benchmark XIRR Status']] as const) {
        const at = manifest.get(f.key);
        const letter = String.fromCharCode(65 + col(valueCol));
        assert.equal(at, `Fund IRR!${letter}${row + 1}`, `${f.key} recorded`);
        const cell = fund.cells.get(`${letter}${row + 1}`)?.v ?? null;
        if (f.shown.kind === 'value') {
          assert.equal(cell, f.shown.v, f.key);
          assert.equal(table[row]![col(statusCol)], null);
        } else {
          missing++;
          assert.equal(cell, null, `${f.key}: blank`);
          assert.equal(table[row]![col(statusCol)], f.shown.status, `${f.key}: its status`);
        }
      }
      assert.equal(table[row]![col('Flows')], s.headline.flows);
    }
    assert.ok(missing > 0, 'the adviser scopes of the synthetic book have no flow: their figures are blank');
  });

  test('the tree, the contributors and the unassigned line as engine values; no dash in a value cell', () => {
    const family = returns.scopes[0]!;
    const treeRows = table.filter((r) => r[col('Scope')] === 'Family' && r[col('Part')] === 'Tree');
    assert.equal(treeRows.length, family.tree.length);
    family.tree.forEach((t, i) => {
      assert.equal(treeRows[i]![col('Level')], t.levelText);
      assert.equal(treeRows[i]![col('Fund XIRR (%)')], t.fund.shown.kind === 'value' ? t.fund.shown.v : null);
    });
    // R4: one row per line (Part "Contribution"), with its Role; the contributors among them in the list's order.
    const lines = table.filter((r) => r[col('Scope')] === 'Family' && r[col('Part')] === 'Contribution');
    assert.equal(lines.length, family.lines.length);
    family.lines.forEach((c, i) => {
      assert.equal(lines[i]![col('Label')], c.label);
      assert.equal(lines[i]![col('Role')], c.roleText);
      assert.equal(lines[i]![col('Contribution (pp)')], c.contribution.shown.kind === 'value' ? c.contribution.shown.v : null);
      assert.equal(lines[i]![col('Note')], 'allocation x XIRR (an approximation, not an attribution)');
    });
    assert.deepEqual(lines.filter((r) => String(r[col('Role')]).startsWith('Contributor')).map((r) => r[col('Label')]), family.lists[0]!.rows.map((c) => c.label));
    // R5: the unassigned share sits under its own header, never under Allocation.
    const unassigned = table.find((r) => r[col('Scope')] === 'Family' && r[col('Part')] === 'Unassigned')!;
    assert.equal(unassigned[col('Share of Money Paid In (%)')], family.unassigned!.share.shown.kind === 'value' ? family.unassigned!.share.shown.v : null);
    assert.equal(unassigned[col('Allocation (%)')], null);
    for (const r of table.slice(1)) {
      for (const name of ['Fund XIRR (%)', 'Benchmark XIRR (%)', 'Allocation (%)', 'Share of Money Paid In (%)', 'Contribution (pp)']) {
        const v = r[col(name)];
        assert.ok(v === null || typeof v === 'number', `${name}: ${String(v)}`);
      }
    }
  });

  test('C4: a missing figure is described in the sheet\'s own words (a blank cell with its status), on screen with the dash', () => {
    const labels = table.map((r) => String(r[col('Label')] ?? ''));
    assert.ok(!labels.some((t) => t.includes('A dash marks a missing figure')), 'no dash wording in the sheet');
    assert.ok(labels.some((t) => t.startsWith(SHEET_MISSING_LEAD)), 'the sheet wording is used');
    const screen = returns.scopes.flatMap((s) => s.notes.map((n) => n.text));
    assert.ok(screen.some((t) => t.startsWith(SCREEN_MISSING_LEAD)), 'the screen keeps the dash wording');
    assert.equal(SCREEN_MISSING_LEAD, 'A dash marks a missing figure: ');
    assert.equal(SHEET_MISSING_LEAD, 'A missing figure is a blank cell with its status beside it: ');
    // Every other note is written as on screen.
    const sheetNotes = new Set(labels);
    for (const t of screen.filter((x) => !x.startsWith(SCREEN_MISSING_LEAD))) assert.ok(sheetNotes.has(t), t);
  });

  test('R2 and R3: the dates note and the benchmark coverage note are on the sheet as on screen', () => {
    const labels = table.map((r) => String(r[col('Label')] ?? ''));
    assert.ok(labels.includes(returns.datesText), returns.datesText);
    for (const n of returns.datesNotes) assert.ok(labels.includes(n), n);
    const family = returns.scopes[0]!;
    assert.ok(family.headline.benchCoverageText !== null, 'irr-standard: the Bond has no benchmark flow');
    const at = table.findIndex((r) => r[col('Part')] === 'Headline' && r[col('Label')] === 'Family');
    assert.deepEqual([table[at + 1]![col('Part')], table[at + 1]![col('Label')]], ['Note', family.headline.benchCoverageText]);
  });

  test('the Read Me names the IRR file and its SHA-256 just after the base file, as it names the base file', () => {
    const readMe = sheetTable(sheetByName(wb, 'Read Me and Controls'));
    const at = readMe.findIndex((r) => r[0] === 'Transactions (IRR) file');
    assert.ok(at > 0, 'a "Transactions (IRR) file" row');
    assert.deepEqual(readMe[at], ['Transactions (IRR) file', 'irr-standard.xlsx', null]);
    assert.deepEqual(readMe[at + 1], ['Transactions (IRR) file SHA-256', returns.source!.id, null]);
    assert.match(String(returns.source!.id), /^[0-9a-f]{64}$/);
    assert.equal(readMe[at - 1]![0], 'Base file SHA-256');
    assert.equal(readMe[at - 2]![0], 'Base file');
    assert.equal(readMe.filter((r) => String(r[0]).startsWith('Transactions (IRR) file')).length, 2);
  });

  test('the Source Register lists the IRR file', () => {
    const rows = sheetTable(sheetByName(wb, 'Source Register'));
    const irr = rows.find((r) => r[0] === 'irr-file')!;
    assert.equal(irr[1], 'irr-standard.xlsx');
    assert.equal(irr[4], returns.source!.id);
    assert.equal(irr[6], 'review');
  });
});

// PLAN-05, the names rule in the sheet: client B spelt "Sample Clint B" in the transactions file (synthetic). The note
// rows carry the view-model's own text, so the sheet and the screen agree.
describe('the names rule note in the Fund IRR sheet (PLAN-05)', () => {
  const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
  const BAL = 'Sample Balanced Advantage Fund - Regular Plan - Growth';
  const l = w.loadIrrFile!(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER,
    fundRow('Sample Client A', BLUE, 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, 'Centricity'),
    fundRow('Sample Client A', BLUE, 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 12000, 'Centricity'),
    fundRow('Sample Clint B', BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), 'Purchase', null, 40, -8000, null),
    fundRow('Sample Clint B', BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 12, 31), null, 'Closing', null, 8800, null),
  ] }]), 'misspelt.xlsx');
  if (!('irr' in l)) throw new Error(l.kind);
  const rvm = buildReturnsVM(returnsForReview(review, l.irr), review, { source: { ...l.source, stage: 'review' } });
  const table = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(workbookInputFrom(review, vm, rvm))), 'Fund IRR'));
  const header = table[0]!;
  const col = (name: string): number => header.indexOf(name);

  test('one Note row per scope with the screen\'s text, the exact-name sentence included', () => {
    const text = 'Clients of the base file with no rows in the transactions file: Sample Client B; the two files are joined on the exact client name.';
    for (const s of rvm.scopes) assert.equal(s.notes.find((n) => n.id === 'base-clients-without-rows')?.text, text, s.key);
    const rows = table.filter((r) => r[col('Part')] === 'Note' && r[col('Label')] === text);
    assert.deepEqual(rows.map((r) => r[col('Scope')]), rvm.scopes.map((s) => s.label));
  });

  test('none in the sheet of irr-standard, where every base-file client has rows', () => {
    const std = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(workbookInputFrom(review, vm, returnsVmOf('irr-standard')))), 'Fund IRR'));
    assert.ok(!std.some((r) => String(r[col('Label')]).startsWith('Clients of the base file with no rows')));
  });
});
