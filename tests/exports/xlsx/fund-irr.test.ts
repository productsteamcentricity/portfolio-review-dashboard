// covers: E-85 U-28 E-142 (the Fund IRR sheet, M3a wiring, NB-03; architecture §14 sheet 13)
// The overview workbook of the synthetic base book (syn-standard) with and without the returns of a synthetic IRR file:
// the Fund IRR sheet only with returns, just before Audit Log; its first row says the XIRR is computed by the app
// (MOD-04 condition 3; Q-60); each headline figure as the engine's value (a missing one blank, with its status) and
// recorded in _manifest; the IRR file in the Source Register; and a workbook without returns as before (no sheet, no
// "Sheet left out" row; the golden hashes of column-default-style.test.ts pin its bytes).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { LoadedIrrFile } from '../../../app/src/ingest/load-irr.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM, XIRR_BASIS_TEXT } from '../../../app/src/views/returns.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { irrFixtures } from '../../fixtures/make-irr-files.ts';

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
    const contributors = table.filter((r) => r[col('Scope')] === 'Family' && r[col('Part')] === 'Contributor');
    assert.equal(contributors.length, family.lists[0]!.rows.length);
    family.lists[0]!.rows.forEach((c, i) => {
      assert.equal(contributors[i]![col('Contribution (pp)')], c.contribution.shown.kind === 'value' ? c.contribution.shown.v : null);
      assert.equal(contributors[i]![col('Note')], 'allocation x XIRR (an approximation, not an attribution)');
    });
    const unassigned = table.find((r) => r[col('Scope')] === 'Family' && r[col('Part')] === 'Unassigned')!;
    assert.equal(unassigned[col('Allocation (%)')], family.unassigned!.share.shown.kind === 'value' ? family.unassigned!.share.shown.v : null);
    for (const r of table.slice(1)) {
      for (const name of ['Fund XIRR (%)', 'Benchmark XIRR (%)', 'Allocation (%)', 'Contribution (pp)']) {
        const v = r[col(name)];
        assert.ok(v === null || typeof v === 'number', `${name}: ${String(v)}`);
      }
    }
  });

  test('the Source Register lists the IRR file', () => {
    const rows = sheetTable(sheetByName(wb, 'Source Register'));
    const irr = rows.find((r) => r[0] === 'irr-file')!;
    assert.equal(irr[1], 'irr-standard.xlsx');
    assert.equal(irr[4], returns.source!.id);
    assert.equal(irr[6], 'review');
  });
});
