// covers: U-18 U-19 U-20 E-22 E-24 E-52 OD-18 OD-21 D-039
// The overview view-model on the sample reviews (tests/helpers/sample-review.ts, hand-worked from SYNTHETIC_BOOK):
// the displays of the plan's OVERVIEW_ANSWERS for syn-standard, syn-lakh, syn-blank-invested and syn-na-cmv, the
// slice colours by name, the pie labels, matrices.shown, unique registry keys, and figures that ARE the engine's
// values (the views do no arithmetic).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../../app/src/model/review.ts';
import type { MoneyFinding } from '../../../app/src/ingest/base-file.ts';
import type { Figure, OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing } from '../../../app/src/engine/value.ts';
import { buildOverviewVM, PREVIEW_MARKER } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

const rowsText = (vm: OverviewVM) => vm.allocation.rows.map((r) => [r.label, r.invested.display.text, r.cmv.display.text, r.pct.display.text]);

/** Every distinct Figure object of the view-model (the pies and the matrices' total row repeat figures by identity). */
function allFigures(vm: OverviewVM): Figure[] {
  const out = new Set<Figure>();
  for (const k of vm.kpis) out.add(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage].forEach((f) => out.add(f));
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) { out.add(c.cmv); out.add(c.share); }
    for (const r of m.rows) { r.cells.forEach((f) => out.add(f)); out.add(r.total); }
  }
  for (const p of [vm.charts.asset, vm.charts.liquidity]) for (const s of p.slices) out.add(s.pct);
  return [...out];
}

describe('syn-standard', () => {
  const review = sampleReview('standard');
  const vm = buildOverviewVM(review);

  test('KPIs: 2.85, 3.35, 0.50, 17.65%, 6, 2 with their labels in Crore', () => {
    assert.deepEqual(vm.kpis.map((k) => [k.id, k.label, k.figure.display.text]), [
      ['invested', 'Invested Value (Cr.)', '2.85'],
      ['cmv', 'Current Market Value (Cr.)', '3.35'],
      ['gain', 'Unrealised Gain/Loss (Cr.)', '0.50'],
      ['absReturn', 'Absolute Return', '17.65%'],
      ['holdings', 'Holdings', '6'],
      ['clients', 'Clients', '2'],
    ]);
  });

  test('the allocation table: classes in the one order, products by CMV, then the Grand Total', () => {
    assert.deepEqual(vm.allocation.headers, ['Asset Class', 'Investment Amount (Cr.)', 'Current Market Value (Cr.)', '% CMV']);
    assert.deepEqual(rowsText(vm), [
      ['Equity', '1.65', '1.99', '59.26%'],
      ['Mutual Funds', '0.90', '1.08', '32.12%'],
      ['PMS', '0.75', '0.91', '27.14%'],
      ['Debt', '0.80', '0.90', '26.72%'],
      ['Mutual Funds', '0.80', '0.90', '26.72%'],
      ['Hybrid', '0.30', '0.34', '10.11%'],
      ['Mutual Funds', '0.30', '0.34', '10.11%'],
      ['Commodity', '0.10', '0.13', '3.91%'],
      ['Mutual Funds', '0.10', '0.13', '3.91%'],
      ['Grand Total', '2.85', '3.35', '100.00%'],
    ]);
    assert.deepEqual(vm.allocation.rows.map((r) => r.kind), ['asset', 'product', 'product', 'asset', 'product', 'asset', 'product', 'asset', 'product', 'total']);
    assert.deepEqual(vm.allocation.rows.map((r) => r.holdingCount), [3, 2, 1, 1, 1, 1, 1, 1, 1, 6]);
  });

  test('the asset pie: labels "Equity 59.3%" and so on, colours fixed by name', () => {
    assert.equal(vm.charts.asset.title, 'Asset Allocation by Asset Class (% of total CMV)');
    assert.deepEqual(vm.charts.asset.slices.map((s) => [s.category, s.label, s.colour]), [
      ['Equity', 'Equity 59.3%', '#DBC8B2'],
      ['Debt', 'Debt 26.7%', '#BD9568'],
      ['Hybrid', 'Hybrid 10.1%', '#BFBFBF'],
      ['Commodity', 'Commodity 3.9%', '#808080'],
    ]);
    assert.equal(vm.charts.asset.emptyStatus, null);
    // A pie slice's share IS the table's % CMV figure (a declared repeat).
    assert.equal(vm.charts.asset.slices[0]!.pct, vm.allocation.rows[0]!.pct);
  });

  test('the liquidity pie and rows: Open Ended 100% (the rule, no liquidity column)', () => {
    assert.equal(vm.charts.liquidity.title, 'Liquidity Structure (% of total CMV)');
    assert.deepEqual(vm.charts.liquidity.slices.map((s) => [s.category, s.label, s.colour]), [['Open Ended', 'Open Ended 100.0%', '#BD9568']]);
    assert.deepEqual(vm.liquidity.rows.map((r) => [r.label, r.cmv.display.text, r.pct.display.text]), [['Open Ended', '3.35', '100.00%']]);
  });

  test('clients 1.97 (58.84%) and 1.38 (41.16%); distributors 1.81 (53.86%) first, 1.55 (46.14%)', () => {
    const c = vm.matrices.client;
    assert.equal(c.shown, true);
    assert.deepEqual(c.columns.map((x) => [x.label, x.cmv.display.text, x.share.display.text]),
      [['Sample Client A', '1.97', '58.84%'], ['Sample Client B', '1.38', '41.16%']]);
    const d = vm.matrices.distributor;
    assert.equal(d.shown, true);
    assert.deepEqual(d.columns.map((x) => [x.label, x.cmv.display.text, x.share.display.text]),
      [['Other Distributor', '1.81', '53.86%'], ['Centricity', '1.55', '46.14%']]);
    // Cells: A Equity/Mutual Funds 1.08, B Equity/PMS 0.91, A Hybrid 0.00 as a real zero.
    const row = (asset: string, product: string | null) => c.rows.find((r) => r.asset === asset && r.product === product)!;
    assert.deepEqual(row('Equity', 'Mutual Funds').cells.map((f) => f.display.text), ['1.08', '0.00']);
    assert.deepEqual(row('Equity', 'PMS').cells.map((f) => f.display.text), ['0.00', '0.91']);
    assert.deepEqual(row('Hybrid', null).cells.map((f) => f.display.text), ['0.00', '0.34']);
    const total = c.rows[c.rows.length - 1]!;
    assert.deepEqual([total.kind, total.label, total.total.display.text], ['total', 'Grand Total', '3.35']);
    assert.equal(total.cells[0], c.columns[0]!.cmv);
  });

  test('registry keys are unique and follow the plan', () => {
    const keys = allFigures(vm).map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, 'one key per figure');
    for (const k of ['totals.invested', 'totals.cmv', 'totals.gain', 'totals.absReturnPct', 'counts.holdings', 'counts.clients',
      'alloc.asset.Equity.pct', 'alloc.product.Equity.PMS.cmv', 'alloc.total.invested', 'alloc.liquidity.Open Ended.pct',
      'alloc.asset.Debt.investedCoveragePct', 'alloc.asset.Hybrid.absReturnPct', 'alloc.asset.Commodity.gain']) {
      assert.ok(keys.includes(k), k);
    }
    const a = review.byClient.columns[0]!.id;
    for (const k of [`clients.${a}.cmv`, `clients.${a}.sharePct`, `clients.${a}.Equity.cmv`, `clients.${a}.Equity.PMS.cmv`]) assert.ok(keys.includes(k), k);
    const d = review.byDistributor.columns[1]!.id;
    assert.ok(keys.includes(`distributors.${d}.Hybrid.Mutual Funds.cmv`));
  });

  test('figures are the engine values themselves: no arithmetic in the views', () => {
    const r: Review = review;
    assert.equal(vm.kpis[0]!.figure.value, r.totals.invested);
    assert.equal(vm.kpis[1]!.figure.value, r.totals.cmv);
    assert.equal(vm.kpis[2]!.figure.value, r.totals.gain);
    assert.equal(vm.kpis[3]!.figure.value, r.totals.absReturnPct);
    const eq = r.assets.assets[0]!;
    assert.equal(vm.allocation.rows[0]!.pct.value, eq.line.pct);
    assert.equal(vm.allocation.rows[1]!.cmv.value, eq.products[0]!.cmv);
    assert.equal(vm.allocation.rows[9]!.invested.value, r.assets.total.invested);
    assert.equal(vm.matrices.client.columns[1]!.share.value, r.byClient.columns[1]!.sharePct);
    assert.equal(vm.matrices.distributor.rows[2]!.cells[0]!.value, r.byDistributor.rows[2]!.cells[0]);
    // In Crore the workbook number is the engine value itself.
    assert.equal(vm.kpis[1]!.figure.shown, r.totals.cmv);
  });

  test('meta and notes: as-on, unit, gain definition; the preview marker exactly in the preview channel', () => {
    assert.deepEqual(vm.meta, {
      familyLabel: 'Family', asOnText: '30 Sep 2026', asOnDay: 20726, unit: 'crore', unitHeader: '(Cr.)',
      channel: 'preview', previewMarker: PREVIEW_MARKER, reviewFingerprint: review.fingerprint,
    });
    assert.equal(PREVIEW_MARKER, 'Preview build, not for client use');
    assert.deepEqual(vm.notes.map((n) => n.text), [
      'Portfolio as on 30 Sep 2026.',
      'Amounts in Crore.',
      'Unrealised gain/loss is current market value minus invested value.',
    ]);
    const release = buildOverviewVM(sampleReview('standard', { channel: 'release' }));
    assert.equal(release.meta.previewMarker, null);
    // Every note a figure names is in the notes.
    const ids = new Set(vm.notes.map((n) => n.id));
    for (const f of allFigures(vm)) for (const n of f.notes) assert.ok(ids.has(n), `${f.key}: ${n}`);
    assert.deepEqual(vm.excluded, { count: 0, names: [] });
  });
});

describe('the other sample books', () => {
  test('syn-lakh: 285.00, 335.30, 50.30; Equity 165.00 | 198.70; headers in (L)', () => {
    const vm = buildOverviewVM(sampleReview('lakh'));
    assert.deepEqual(vm.kpis.slice(0, 3).map((k) => [k.label, k.figure.display.text]), [
      ['Invested Value (L)', '285.00'], ['Current Market Value (L)', '335.30'], ['Unrealised Gain/Loss (L)', '50.30'],
    ]);
    assert.deepEqual(rowsText(vm)[0], ['Equity', '165.00', '198.70', '59.26%']);
    assert.deepEqual(vm.allocation.headers.slice(1, 3), ['Investment Amount (L)', 'Current Market Value (L)']);
    assert.equal(vm.meta.unitHeader, '(L)');
    assert.equal(vm.notes[1]!.text, 'Amounts in Lakh.');
  });

  test('syn-blank-invested: 1.55 p, 0.28 p, 18.19% p and the coverage note 54.64%', () => {
    const vm = buildOverviewVM(sampleReview('blank-invested'));
    assert.deepEqual(vm.kpis.slice(0, 4).map((k) => [k.figure.display.text, k.figure.display.marker]),
      [['1.55', 'p'], ['3.35', null], ['0.28', 'p'], ['18.19%', 'p']]);
    assert.equal(vm.notes.find((n) => n.id === 'partial-invested')!.text,
      'p: invested value, gain and absolute return cover 54.64% of market value; 2 holdings have no invested value.');
    const debt = vm.allocation.rows.find((r) => r.kind === 'asset' && r.asset === 'Debt')!;
    assert.equal(debt.invested.display.text, '\u2014');
    const eq = vm.allocation.rows[0]!;
    assert.deepEqual([eq.invested.display.text, eq.invested.display.marker, eq.investedCoverage.display.text], ['1.15', 'p', '68.55%']);
  });

  test('syn-na-cmv: 2.56, 2.15, 0.41; Equity 59.91%, Debt 34.97%, Commodity 5.11%; no Hybrid row; 2 excluded', () => {
    const review = sampleReview('na-cmv');
    const vm = buildOverviewVM(review);
    assert.deepEqual(vm.kpis.slice(0, 3).map((k) => k.figure.display.text), ['2.15', '2.56', '0.41']);
    const assets = vm.allocation.rows.filter((r) => r.kind === 'asset').map((r) => [r.label, r.pct.display.text]);
    assert.deepEqual(assets, [['Equity', '59.91%'], ['Debt', '34.97%'], ['Commodity', '5.11%']]);
    // Products by CMV, highest first: PMS 0.91 before Mutual Funds 0.625.
    assert.deepEqual(vm.allocation.rows.slice(1, 3).map((r) => r.label), ['PMS', 'Mutual Funds']);
    assert.equal(vm.excluded.count, 2);
    assert.deepEqual(vm.excluded.names, [review.holdings[1]!.instrumentName, review.holdings[3]!.instrumentName]);
    assert.equal(vm.notes.find((n) => n.id === 'excluded')!.text, '2 holdings without a market value are excluded from every total.');
    assert.ok(vm.kpis[1]!.figure.notes.includes('excluded'));
  });

  test('a slice under 2.00% has no label (Commodity 1.53%); the table keeps the value', () => {
    const r = sampleReview('standard');
    const com = r.assets.assets.find((b) => b.asset === 'Commodity')!;
    com.line = { ...com.line, pct: { ...com.line.pct, v: 1.5281173594132031 } as typeof com.line.pct };
    const vm = buildOverviewVM(r);
    const slice = vm.charts.asset.slices.find((s) => s.category === 'Commodity')!;
    assert.equal(slice.label, null);
    assert.equal(slice.pct.display.text, '1.53%');
  });

  test('an Unknown class is last, coloured #D9D9D9, and noted with the labels read as unknown', () => {
    const r = sampleReview('standard');
    const com = r.assets.assets.pop()!;
    r.assets.assets.push({ ...com, asset: 'Unknown', products: [] });
    r.assets.unknownLabels = ['', 'Gold'];
    const vm = buildOverviewVM(r);
    const last = vm.charts.asset.slices[vm.charts.asset.slices.length - 1]!;
    assert.deepEqual([last.category, last.colour], ['Unknown', '#D9D9D9']);
    assert.equal(vm.notes.find((n) => n.id === 'unknown')!.text, 'Unknown: holdings whose Asset Name is blank or not recognised (Gold).');
    assert.ok(vm.allocation.rows.find((x) => x.asset === 'Unknown')!.cmv.notes.includes('unknown'));
  });

  test('the KI-147 money notes and the not-given entity note, in the fixed order (D-039)', () => {
    const r = sampleReview('standard');
    const h = r.holdings.map((x) => x.id);
    const col = (header: string, unit: 'crore' | 'lakh' | 'rupee') => ({ header, unit });
    const findings: MoneyFinding[] = [
      { holdingId: h[0]!, field: 'invested', kind: 'invalid', column: col('Invested Value (Cr.)', 'crore'), others: [col('Invested Value (Lakh)', 'lakh')] },
      { holdingId: h[1]!, field: 'cmv', kind: 'disagree', column: col('Current Market Value (Cr.)', 'crore'), others: [col('Current Market Value (Lakh)', 'lakh')] },
      { holdingId: h[2]!, field: 'cmv', kind: 'disagree', column: col('Current Market Value (Cr.)', 'crore'), others: [col('Current Market Value (Lakh)', 'lakh')] },
      // The file's own gain or loss changes no figure (OD-18): never a note.
      { holdingId: h[3]!, field: 'fileGain', kind: 'invalid', column: col('Total Gain/Loss (Cr.)', 'crore'), others: [] },
      { holdingId: h[4]!, field: 'fileGain', kind: 'disagree', column: col('Total Gain/Loss (Cr.)', 'crore'), others: [col('Total Gain/Loss (Lakh)', 'lakh')] },
    ];
    r.base = { ...r.base, moneyFindings: findings };
    // A reader result alone makes no note: the notes count the findings.
    const result = (ruleId: string, ids: typeof h) => ({
      id: `${ruleId}:1`, ruleId, scope: { kind: 'holdings' as const, holdingIds: ids }, message: 'm', severity: 'Information' as const,
      blocksPublication: false, resolution: 'none' as const, status: 'open' as const, decision: 'KI-147',
    });
    r.issues = [...r.issues, result('base-file.money-column-used', [h[3]!])];
    r.totals = { ...r.totals, counts: { ...r.totals.counts, withoutClient: 2, withoutDistributor: 1 } };
    const vm = buildOverviewVM(r);
    assert.deepEqual(vm.notes.map((n) => n.id), ['as-on', 'unit', 'gain-def', 'money-invalid', 'money-disagree', 'no-client']);
    assert.equal(vm.notes[3]!.text, '1 holding has an invested value in "Invested Value (Cr.)" that is not a number: it is invalid source data, and no Lakh amount is used in its place.');
    assert.equal(vm.notes[4]!.text, '2 holdings have market values in "Current Market Value (Cr.)" that are used although their Lakh amounts differ by more than 0.005 Crore.');
    assert.equal(vm.notes[5]!.text, '2 holdings name no client (shown under Client not given); 1 holding names no distributor (shown under Distributor not given).');
    // Each note is on the KPI whose figure it changes.
    assert.deepEqual(vm.kpis[0]!.figure.notes, ['money-invalid']);
    assert.deepEqual(vm.kpis[1]!.figure.notes, ['money-disagree']);
    // An Information notice is logged, not noted.
    assert.ok(!vm.notes.some((n) => /column-used/.test(n.id)));
  });

  test('a pie slice is labelled from 2.00% as the table rounds it: 1.995 is labelled "2.0%", 1.994 is not (D-039)', () => {
    for (const [v, label, table] of [[1.995, 'Commodity 2.0%', '2.00%'], [1.994, null, '1.99%'], [1.9949999999999, null, '1.99%'], [2, 'Commodity 2.0%', '2.00%']] as const) {
      const r = sampleReview('standard');
      const com = r.assets.assets.find((b) => b.asset === 'Commodity')!;
      com.line = { ...com.line, pct: { ...com.line.pct, v } as typeof com.line.pct };
      const slice = buildOverviewVM(r).charts.asset.slices.find((s) => s.category === 'Commodity')!;
      assert.equal(slice.pct.display.text, table, String(v));
      assert.equal(slice.label, label, String(v));
    }
  });

  test('the partial invested note counts holdings when the share of market value is missing or outside 0 to 100', () => {
    // A total market value of 0: the coverage is NOT APPLICABLE, so the note counts holdings, never the dash.
    const zero = sampleReview('blank-invested');
    zero.totals = { ...zero.totals, cmv: { ...zero.totals.cmv, v: 0 } as typeof zero.totals.cmv,
      investedCoveragePct: missing(STATUS.NOT_APPLICABLE, 'the market value is 0') };
    const z = buildOverviewVM(zero).notes.find((n) => n.id === 'partial-invested')!.text;
    assert.equal(z, 'p: invested value, gain and absolute return cover the 4 of 6 holdings that have an invested value.');
    assert.ok(!z.includes('—'));
    // Negative market values: a coverage of 150% says nothing true.
    const neg = sampleReview('blank-invested');
    neg.totals = { ...neg.totals, investedCoveragePct: { ...neg.totals.investedCoveragePct, v: 150 } as typeof neg.totals.investedCoveragePct };
    assert.equal(buildOverviewVM(neg).notes.find((n) => n.id === 'partial-invested')!.text,
      'p: invested value, gain and absolute return cover the 4 of 6 holdings that have an invested value.');
    // One of six: the singular.
    const one = sampleReview('blank-invested');
    one.totals = { ...one.totals, investedCoveragePct: missing(STATUS.NOT_APPLICABLE, 'test'),
      counts: { ...one.totals.counts, withoutInvested: 5 } };
    assert.equal(buildOverviewVM(one).notes.find((n) => n.id === 'partial-invested')!.text,
      'p: invested value, gain and absolute return cover the 1 of 6 holdings that has an invested value.');
  });

  test('the as-on date not set: no as-on text and the note says so (KI-087)', () => {
    const vm = buildOverviewVM(sampleReview('standard', { asOn: null }));
    assert.equal(vm.meta.asOnText, null);
    assert.equal(vm.meta.asOnDay, null);
    assert.equal(vm.notes[0]!.text, 'The as-on date is not set: not available in supplied data.');
  });
});
