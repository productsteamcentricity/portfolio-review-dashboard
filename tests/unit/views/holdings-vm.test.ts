// covers: U-23 E-25 E-80 KI-006 KI-007 KI-048 KI-100 KI-121 M3
// Section 5's holdings view-model (app/src/views/holdings.ts) on the sample reviews (tests/helpers/sample-review.ts):
// the CZHOLD columns in the review's unit, one table per client by CMV with the analyst's label as title, the display
// of the engine's figures, the double dagger and its note where a holding has no invested value (KI-007), the dagger
// and its note where a subtotal's XIRR covers part of the CMV (KI-006), and the per-client XIRR caption (KI-121).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../../app/src/model/review.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { buildHoldingsVM, irrHookFrom } from '../../../app/src/views/holdings.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { dateCell, irrFixtures, standardSheets, toWorkbook } from '../../fixtures/make-irr-files.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const SECTION = String.fromCharCode(0x00a7);
const DAGGER = String.fromCharCode(0x2020);
const DOUBLE_DAGGER = String.fromCharCode(0x2021);
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('buildHoldingsVM on syn-standard', () => {
  const review = sampleReview('standard');
  const vm = buildHoldingsVM(review);

  test('the CZHOLD columns, Instrument Name locked, money headers in Crore', () => {
    assert.deepEqual(vm.columns.map((c) => c.label), [
      'Instrument Name', 'Purchase Date', 'Distributor', 'Invested Value (Cr.)', 'Current Market Value (Cr.)',
      'Total Gain/Loss (Cr.)', 'Allocation %', 'XIRR %', 'BMXIRR %', 'Absolute Return %',
    ]);
    assert.deepEqual(vm.columns.filter((c) => c.locked).map((c) => c.id), ['name']);
    assert.equal(vm.empty, null);
  });

  test('one table per client, highest CMV first; rows asset, product, holding, Grand Total', () => {
    assert.deepEqual(vm.clients.map((c) => c.title), ['Sample Client A', 'Sample Client B']);
    const a = vm.clients[0]!;
    assert.deepEqual(a.rows.map((r) => `${r.level}:${r.name}`), [
      'asset:Equity', 'product:Mutual Funds', 'item:Sample Bluechip Fund - Regular Plan - Growth',
      'item:Sample Flexi Cap Fund - Regular Plan - Growth', 'asset:Debt', 'product:Mutual Funds',
      'item:Sample Corporate Bond Fund - Regular Plan - Growth', 'grand:Grand Total',
    ]);
  });

  test('the displays of the engine figures; date and distributor on holdings only', () => {
    const a = vm.clients[0]!;
    const item = a.rows[2]!;
    assert.equal(item.purchaseDate, '16 Jan 2023');
    assert.equal(item.distributor, 'Centricity');
    assert.deepEqual(Object.fromEntries(Object.entries(item.cells).map(([k, d]) => [k, d.text])), {
      invested: '0.50', cmv: '0.63', gain: '0.13', allocation: '31.68%', xirr: '14.25%', bmXirr: '12.50%', absReturn: '25.00%',
    });
    const grand = a.rows[a.rows.length - 1]!;
    assert.equal(grand.distributor, '');
    assert.deepEqual([grand.cells.cmv.text, grand.cells.gain.text, grand.cells.allocation.text, grand.cells.xirr.text], ['1.97', '0.27', '100.00%', '10.49%']);
    assert.ok(vm.clients.every((c) => c.rows.every((r) => r.markers.length === 0) && c.notes.length === 0));
  });

  test('the XIRR caption per client (KI-121): CMV-weighted without an IRR file, the IRR file when the hook answers', () => {
    assert.ok(vm.clients.every((c) => c.caption === 'XIRR and BMXIRR: the base file\'s figures, weighted by market value.'));
    const withIrr = buildHoldingsVM(review, { irr: () => ({ fund: present(9, 'pct'), bench: present(8, 'pct') }) });
    assert.ok(withIrr.clients.every((c) => c.caption === 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.'));
    assert.equal(withIrr.clients[0]!.rows.at(-1)!.cells.xirr.text, '9.00%');
  });

  test('the analyst\'s client label is the title', () => {
    const a = vm.clients[0]!;
    const labelled: Review = { ...review, labels: { ...review.labels, clients: { ...review.labels.clients, [a.key]: 'Analyst Label' } } };
    assert.equal(buildHoldingsVM(labelled).clients[0]!.title, 'Analyst Label');
  });

  test('the money headers follow the unit (Lakh)', () => {
    assert.equal(buildHoldingsVM(sampleReview('lakh')).columns[3]!.label, 'Invested Value (L)');
  });
});

describe('markers and notes', () => {
  test('a holding without an invested value: the double dagger, blanks, and one note with the count (KI-007)', () => {
    const a = buildHoldingsVM(sampleReview('blank-invested')).clients[0]!;
    const marked = a.rows.filter((r) => r.markers.includes(DOUBLE_DAGGER)).map((r) => r.name);
    assert.deepEqual(marked, ['Sample Bluechip Fund - Regular Plan - Growth', 'Sample Corporate Bond Fund - Regular Plan - Growth']);
    const blank = a.rows[2]!.cells;
    assert.doesNotMatch(blank.invested.text, /[0-9]/);
    assert.deepEqual([blank.gain.text, blank.absReturn.text], [blank.invested.text, blank.invested.text]);
    /* N5: the legacy's share of CMV (07_engine.js:1284): Bluechip 0.625 and Corporate Bond 0.896 of 1.973 Cr. = 77.09% */
    assert.deepEqual(a.notes, [
      `${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: 2 holdings without one (77.09% of CMV).`,
      'A figure marked p counts only part of its row\'s holdings; the ‡ note above gives the counts.',
    ]);
  });

  test('a subtotal whose XIRR covers part of the CMV: the dagger on the subtotals, and the partial note (KI-006)', () => {
    const review = sampleReview('standard');
    const gap = missing(STATUS.NOT_AVAILABLE, 'not in the file');
    const holdings = review.holdings.map((h) => (h.instrumentName === 'Sample Flexi Cap Fund - Regular Plan - Growth' ? { ...h, xirr: gap } : h));
    const a = buildHoldingsVM({ ...review, holdings } as Review).clients[0]!;
    assert.deepEqual(a.rows.filter((r) => r.markers.includes(DAGGER)).map((r) => `${r.level}:${r.name}`), ['asset:Equity', 'product:Mutual Funds', 'grand:Grand Total']);
    assert.equal(a.rows[3]!.name, 'Sample Flexi Cap Fund - Regular Plan - Growth');
    assert.doesNotMatch(a.rows[3]!.cells.xirr.text, /[0-9]/, 'the holding without XIRR shows the missing display');
    assert.ok(a.rows[3]!.markers.length === 0, 'a holding never carries the dagger');
    assert.equal(a.notes.length, 2);
    assert.ok(a.notes[0]!.startsWith(`${DAGGER} The rows marked ${DAGGER} average only the holdings with a value: 1 without XIRR (`));
    assert.match(a.notes[0]!, /0 without BMXIRR \(100\.00%\)\.$/);
    assert.equal(a.notes[1], 'A figure marked p counts only part of its row\'s holdings; the † note above gives the counts.', 'N5: the p legend');
  });

  test('no sentence of the view contains an en or em dash (D-029)', () => {
    const vm = buildHoldingsVM(sampleReview('blank-invested'));
    for (const c of vm.clients) for (const s of [c.caption, ...c.notes]) assert.doesNotMatch(s, DASHES, s);
  });
});

describe('the IRR hook (MOD-05\'s review N2): syn-standard with the irr-standard transactions file', () => {
  /* irr-standard's flows: client A's Equity is its Bluechip only (Flexi Cap has no flow), A's Debt has no benchmark
     flows; client B has flows for its Hybrid fund only. irr-aggregate.test.ts works A's Equity node to 7.76%. */
  const w = nodeWiring();
  const run = reviewOf(w, fixtureById('syn-standard'));
  const loaded = w.loadIrrFile!(irrFixtures().find((f) => f.id === 'irr-standard')!.bytes, 'irr.xlsx');
  if (!('irr' in loaded)) throw new Error(loaded.kind);
  const returns = returnsForReview(run.review, loaded.irr);
  const vm = buildHoldingsVM(run.review, { irr: irrHookFrom(returns) });
  const [a, b] = vm.clients;

  test('without a file the hook is absent: the CMV-weighted path', () => {
    assert.equal(irrHookFrom(null), undefined);
    assert.deepEqual(buildHoldingsVM(run.review, { irr: irrHookFrom(null) }).clients.map((c) => c.caption), buildHoldingsVM(run.review).clients.map((c) => c.caption));
  });

  test('a line the node covers in part is a dash with its reason, never the CMV-weighted figure; one note per blank, a product sharing its asset\'s', () => {
    const eq = a!.rows.find((r) => r.level === 'asset' && r.name === 'Equity')!;
    assert.doesNotMatch(eq.cells.xirr.text, /[0-9]/);
    assert.doesNotMatch(eq.cells.bmXirr.text, /[0-9]/);
    assert.equal(a!.rows.find((r) => r.level === 'asset' && r.name === 'Debt')!.cells.xirr.text, '9.97%');
    assert.equal(a!.caption, 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.');
    assert.deepEqual(a!.notes, [
      'Equity and Equity / Mutual Funds: XIRR and BMXIRR from the IRR file are blank. XIRR covers 1 of 2 holdings on this line: 1 holding has no flow in the IRR file.',
      'Debt and Debt / Mutual Funds: BMXIRR from the IRR file is blank. There are no benchmark flows.',
      'Grand Total: XIRR and BMXIRR from the IRR file are blank. XIRR covers 2 of 3 holdings on this line: 1 holding has no flow in the IRR file.',
    ]);
    assert.ok(a!.rows.every((r) => !r.markers.includes(SECTION)), 'one basis in the table: no basis marker');
  });

  test('a table that mixes the two bases marks each IRR subtotal with the section sign and says so in the caption (N2b)', () => {
    assert.equal(b!.caption, `XIRR and BMXIRR: the subtotals marked ${SECTION} are from the IRR file's transactions for this client; the others are the base file's figures, weighted by market value.`);
    assert.deepEqual(b!.rows.filter((r) => r.markers.includes(SECTION)).map((r) => `${r.level}:${r.name}`), ['asset:Hybrid', 'product:Mutual Funds', 'grand:Grand Total']);
    assert.deepEqual(b!.sheet.rows.filter((r) => r.level !== 'item').map((r) => r.xirrSource), ['cmv-weighted', 'cmv-weighted', 'irr', 'irr', 'cmv-weighted', 'cmv-weighted', 'irr']);
  });

  test('the client sheet: the blank cell\'s status and the basis per row; the reasons among its notes (the same hook as the screen)', () => {
    const t = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook({ ...workbookInputFrom(run.review, buildOverviewVM(run.review)), clientHoldings: vm })), 'Sample Client A'));
    const head = t[0]!;
    const eq = t.find((r) => r[0] === 'Asset class' && r[1] === 'Equity')!;
    assert.equal(eq[head.indexOf('XIRR (%)')], null);
    assert.equal(eq[head.indexOf('XIRR Status')], STATUS.PARTIAL);
    assert.equal(eq[head.indexOf('XIRR Basis')], 'IRR file');
    assert.ok(t.some((r) => r[0] === 'Note' && r[1] === a!.notes[0]));
  });
});

describe('the follow-up\'s financial review (27 Nov 2026): S1 to S4', () => {
  const w = nodeWiring();
  const run = reviewOf(w, fixtureById('syn-standard'));
  const review = run.review;

  test('S1: a line whose holdings have flows under another label in the IRR file is a dash with that reason, never the base file\'s figure', () => {
    const sheets = standardSheets();
    for (const r of sheets[0]!.rows) if (r[0] === 'Sample Client B') r[4] = 'Equity'; /* B's Hybrid fund filed under Equity */
    const loaded = w.loadIrrFile!(toWorkbook(loadSheetJS() as never, sheets), 'irr.xlsx');
    if (!('irr' in loaded)) throw new Error(loaded.kind);
    const b = buildHoldingsVM(review, { irr: irrHookFrom(returnsForReview(review, loaded.irr)) }).clients[1]!;
    const hybrid = b.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Hybrid')!;
    assert.equal(hybrid.xirrSource, 'irr');
    assert.ok(hybrid.xirr.kind === 'missing' && hybrid.xirr.status === STATUS.NOT_COMPARABLE);
    assert.ok(b.notes.includes('Hybrid and Hybrid / Mutual Funds: XIRR and BMXIRR from the IRR file are blank. 1 holding of 1 on this line has flows in the IRR file under another asset or product label, so the line\'s XIRR cannot be read from the IRR file, and the base file\'s figure is not shown in its place.'), JSON.stringify(b.notes));
    /* a line none of whose holdings has a flow keeps the base file's figure (the adapter's null) */
    assert.equal(b.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Commodity')!.xirrSource, 'cmv-weighted');
  });

  test('M1 (Gate B of d93da80): a line whose only holding with flows is left out of the IRR tree for an invalid benchmark is a dash, never the base file\'s figure beside IRR rows', () => {
    /* irr-standard, plus benchmark flows for A's Corporate Bond that give no rate (both paid in, none back): the
       instrument leaves the IRR tree (OD-4), so client A has no Debt node, yet the holding has flows in the file */
    const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';
    const sheets = standardSheets();
    sheets[1]!.rows.push(['Sample Client A', BOND, 'Debt', 'Mutual Funds', dateCell(2023, 6, 15), 'Sample Index 3', -20000]);
    sheets[1]!.rows.push(['Sample Client A', BOND, 'Debt', 'Mutual Funds', dateCell(2024, 6, 15), 'Sample Index 3', -1000]);
    const loaded = w.loadIrrFile!(toWorkbook(loadSheetJS() as never, sheets), 'irr.xlsx');
    if (!('irr' in loaded)) throw new Error(loaded.kind);
    const returns = returnsForReview(review, loaded.irr);
    const family = returns.scopes.find((x) => x.scope.kind === 'family')!;
    /* the premise: the bond is invalid, it is not "without flows", and the tree has no Debt node under client A */
    assert.ok(family.result.reconciliation.invalidBenchmark.some((x) => x.instrumentName === BOND));
    const bond = review.holdings.find((h) => h.instrumentName === BOND)!;
    assert.ok(!family.result.reconciliation.holdingsWithoutFlows.includes(bond.id));
    assert.ok(!family.result.tree.some((n) => n.level === 'asset' && n.clientId === bond.clientId && n.label === 'Debt'));
    /* the base file's own figure for the line, which must not appear */
    const base = buildHoldingsVM(review).clients.find((c) => c.title === 'Sample Client A')!;
    assert.equal(base.rows.find((r) => r.level === 'asset' && r.name === 'Debt')!.cells.xirr.text, '7.20%');
    const a = buildHoldingsVM(review, { irr: irrHookFrom(returns) }).clients.find((c) => c.title === 'Sample Client A')!;
    const debt = a.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Debt')!;
    assert.equal(debt.xirrSource, 'irr');
    assert.ok(debt.xirr.kind === 'missing' && debt.xirr.status === STATUS.NOT_COMPARABLE, JSON.stringify(debt.xirr));
    assert.ok(debt.bmXirr.kind === 'missing' && debt.bmXirr.status === STATUS.NOT_COMPARABLE);
    for (const r of a.rows.filter((x) => x.level !== 'item' && /Debt|Mutual Funds/.test(x.name))) assert.doesNotMatch(r.cells.xirr.text + r.cells.bmXirr.text, /[0-9]/, r.name);
    assert.ok(a.notes.includes('Debt and Debt / Mutual Funds: XIRR and BMXIRR from the IRR file are blank. 1 holding of 1 on this line has flows in the IRR file that are left out of the IRR tree for an invalid benchmark, so the line\'s XIRR cannot be read from the IRR file, and the base file\'s figure is not shown in its place.'), JSON.stringify(a.notes));
    /* one source in the table: every subtotal is the IRR file's, so no basis marker and the plain caption */
    assert.deepEqual(a.sheet.rows.filter((r) => r.level !== 'item').map((r) => r.xirrSource), ['irr', 'irr', 'irr', 'irr', 'irr']);
    assert.ok(a.rows.every((r) => !r.markers.includes(SECTION)));
    assert.equal(a.caption, 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.');
  });

  test('M1: a line none of whose holdings has a flow still keeps the base file\'s figure; a line with one holding under another label and one left out names both', () => {
    /* returns in the adapter's shape: the client node holds ha only (filed under "Hybrid" in the file); hb has flows
       but is left out of the tree; hc has no flow at all */
    const A0 = review.holdings.find((h) => h.instrumentName === 'Sample Bluechip Fund - Regular Plan - Growth')!;
    const mk = (id: string, asset: string, x: number) => ({ ...A0, id, instrumentName: `Sample Fund ${id}`, assetClass: asset, xirr: present(x, 'pct'), bmXirr: present(x - 1, 'pct') });
    const hs = [mk('ha', 'Equity', 10), mk('hb', 'Equity', 20), mk('hc', 'Debt', 8)];
    const gap = missing(STATUS.NOT_AVAILABLE, 'one sign of flows');
    const node = (level: string, key: string, parentKey: string | null, label: string, ids: string[]) => ({ level, key, parentKey, label, clientId: A0.clientId, holdingIds: ids, redeemed: false, benchmarkName: null, fund: { xirr: gap }, bench: { xirr: gap } });
    const returns = { scopes: [{ scope: { kind: 'family' }, result: {
      tree: [node('portfolio', 'p', null, 'P', ['ha']), node('client', 'c', 'p', 'Client', ['ha']), node('asset', 'c/H', 'c', 'Hybrid', ['ha']), node('product', 'c/H/MF', 'c/H', 'Mutual Funds', ['ha'])],
      reconciliation: { holdingsWithoutFlows: ['hc'] },
    } }] };
    const c = buildHoldingsVM({ ...review, holdings: hs } as unknown as Review, { irr: irrHookFrom(returns as never) }).clients[0]!;
    const eq = c.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Equity')!;
    assert.ok(eq.xirrSource === 'irr' && eq.xirr.kind === 'missing' && eq.xirr.status === STATUS.NOT_COMPARABLE, JSON.stringify(eq.xirr));
    assert.ok(c.notes.includes('Equity and Equity / Mutual Funds: XIRR and BMXIRR from the IRR file are blank. 1 holding of 2 on this line has flows in the IRR file under another asset or product label and 1 has flows that are left out of the IRR tree for an invalid benchmark, so the line\'s XIRR cannot be read from the IRR file, and the base file\'s figure is not shown in its place.'), JSON.stringify(c.notes));
    const debt = c.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Debt')!;
    assert.equal(debt.xirrSource, 'cmv-weighted', 'no flow at all: the adapter\'s null, the base file\'s figure (owner question Q-H2)');
    assert.equal(c.rows.find((r) => r.level === 'asset' && r.name === 'Debt')!.cells.xirr.text, '8.00%');
  });

  test('L1 (Gate B of d93da80): the double-dagger share never reads 0.00% for a holding with a value, and is not given when a market value is negative', () => {
    const gap = missing(STATUS.NOT_AVAILABLE, 'not in the file');
    const FLEXI = 'Sample Flexi Cap Fund - Regular Plan - Growth';
    const of = (holdings: unknown) => buildHoldingsVM({ ...review, holdings } as Review).clients.find((c) => c.title === 'Sample Client A')!.notes.find((x) => x.startsWith(DOUBLE_DAGGER))!;
    /* a residual 0.00001 Cr without an invested value, beside Bluechip 0.625 and the bond 0.896: 0.00066% of 1.52101 Cr */
    const tiny = of(review.holdings.map((h) => (h.instrumentName === FLEXI && h.cmv.kind === 'value' ? { ...h, invested: gap, cmv: { ...h.cmv, v: 0.00001 } } : h)));
    assert.equal(tiny, `${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: 1 holding without one (under 0.01% of CMV).`);
    /* the same holding at its own 0.452 Cr: 0.452 / 1.973 = 22.91% */
    const usual = of(review.holdings.map((h) => (h.instrumentName === FLEXI ? { ...h, invested: gap } : h)));
    assert.match(usual, /1 holding without one \(22\.91% of CMV\)\.$/);
    /* Bluechip made negative (-0.625): the client's CMV is 0.723 and the holding's 0.452 would read 62.52%, a share of nothing real */
    const neg = of(review.holdings.map((h) => {
      if (h.instrumentName === FLEXI) return { ...h, invested: gap };
      if (h.instrumentName === 'Sample Bluechip Fund - Regular Plan - Growth' && h.cmv.kind === 'value') return { ...h, cmv: { ...h.cmv, v: -h.cmv.v } };
      return h;
    }));
    assert.equal(neg, `${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: 1 holding without one (their share of CMV is not given, as a market value is negative).`);
    assert.doesNotMatch(neg, /[0-9]%/);
  });

  test('S3: a CMV-weighted subtotal of market values of both signs is blank with its reason listed, product sharing its asset\'s note', () => {
    const holdings = review.holdings.map((h) => (h.instrumentName === 'Sample Flexi Cap Fund - Regular Plan - Growth' && h.cmv.kind === 'value'
      ? { ...h, cmv: { ...h.cmv, v: -h.cmv.v } } : h));
    const a = buildHoldingsVM({ ...review, holdings } as Review).clients.find((c) => c.title === 'Sample Client A')!;
    const eq = a.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Equity')!;
    assert.ok(eq.xirr.kind === 'missing' && eq.xirr.status === STATUS.NOT_COMPARABLE);
    const n = a.notes.filter((x) => /market values of both signs/.test(x));
    assert.ok(n.length >= 1, JSON.stringify(a.notes));
    assert.equal(n[0], 'Equity and Equity / Mutual Funds: XIRR and BMXIRR are blank. The holdings on this line that have this rate have market values of both signs, so a weighted average by market value has no meaning.');
  });

  test('S2 and S4: a residual holding without XIRR gives the dagger whenever the figure carries p, and the share never reads 100.00%', () => {
    /* Bluechip keeps its XIRR; the Flexi Cap's market value is cut to a residual 0.00001 Cr with no XIRR (99.998%: above the old 99.995% threshold) */
    const gap = missing(STATUS.NOT_AVAILABLE, 'not in the file');
    const holdings = review.holdings.map((h) => (h.instrumentName === 'Sample Flexi Cap Fund - Regular Plan - Growth' && h.cmv.kind === 'value'
      ? { ...h, xirr: gap, cmv: { ...h.cmv, v: 0.00001 } } : h));
    const a = buildHoldingsVM({ ...review, holdings } as Review).clients.find((c) => c.title === 'Sample Client A')!;
    const grand = a.rows.at(-1)!;
    assert.equal(grand.cells.xirr.marker, 'p');
    assert.ok(grand.markers.includes(DAGGER), 'p and the dagger go together');
    assert.match(a.notes[0]!, /^† The rows marked † average only the holdings with a value: 1 without XIRR \(99\.99% of their CMV covered\), 0 without BMXIRR \(100\.00%\)\.$/);
  });

  test('a product row is merged into its asset row\'s note only when it holds the same holdings (N-2: the guard is tested)', () => {
    /* client A: Equity holds Mutual Funds (Bluechip, Flexi Cap made negative: both signs) and Shares (the bond moved
       there): Equity and Equity / Mutual Funds have the same reason but not the same holdings, so they are two notes */
    const holdings = review.holdings.map((h) => {
      if (h.cmv.kind !== 'value' || h.clientLabel !== 'Sample Client A') return h;
      if (h.instrumentName === 'Sample Flexi Cap Fund - Regular Plan - Growth') return { ...h, cmv: { ...h.cmv, v: -h.cmv.v } };
      if (h.instrumentName === 'Sample Corporate Bond Fund - Regular Plan - Growth') return { ...h, assetClass: 'Equity', product: 'Shares' };
      return h;
    });
    const a = buildHoldingsVM({ ...review, holdings } as Review).clients.find((c) => c.title === 'Sample Client A')!;
    assert.equal(a.sheet.rows.find((r) => r.level === 'asset' && r.label === 'Equity')!.holdingIds.length, 3);
    const n = a.notes.filter((x) => /market values of both signs/.test(x));
    assert.deepEqual(n.map((x) => x.split(':')[0]), ['Equity', 'Equity / Mutual Funds', 'Grand Total']);
  });
});
