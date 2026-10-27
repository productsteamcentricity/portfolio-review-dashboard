// covers: AC-01 E-03 E-21 E-22 E-24 E-52 E-77 E-79 E-123 BR-2.1 BR-13.1 BR-14.3 OD-8 OD-18 D-029 D-039 M1.4
// Acceptance case AC-01, standard review generation (08-regression-test-plan.md §3), as far as milestone M1.4 builds
// it: family-a is read, the review computed, the overview view-model built, and the deck (slide C-08, the manifest's
// one component) and the overview workbook exported, all through the page's wiring in Node (tests/helpers/
// node-wiring.ts). Checked:
//   - the totals and every allocation (asset class, product, client, distributor, client by class) against sums of
//     the file's own money column, read in this test with SheetJS sheet_to_json and added here, never by app code;
//     gain is market value minus invested value over the same holdings (OD-18);
//   - the totals reconcile (classes, products, liquidity, clients, distributors, matrix rows) and no result is
//     Blocking once the as-on date is set;
//   - every manifest component is in the deck with its figures, and the deck's and the workbook's figures are the
//     view-model's (the screen's): C-08's text, every formula's evaluated value and each _manifest figure cell;
//   - one display unit everywhere: family-a and the rupee-only variant in Crore "(Cr.)", the Lakh variant in Lakh
//     "(L)", never the other (E-03);
//   - house style (D-029): no en or em dash in any sentence; a dash is the missing-value marker alone in its cell,
//     with a note naming its status on the screen and the slide, and a blank cell with its status in the workbook.
// Figures and fixed constants only, never the UI sentences (they are compared output to output where they appear).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Figure, OverviewVM } from '../../app/src/views/overview-vm.ts';
import type { Value } from '../../app/src/model/value.ts';
import type { ReviewRun } from '../helpers/node-wiring.ts';
import { ASSET_ORDER } from '../../app/src/model/review.ts';
import { MISSING_STATUSES } from '../../app/src/model/status.ts';
import { MISSING_MARKER } from '../../app/src/config/formats.ts';
import { plannedComponents, SLIDE_MANIFEST } from '../../app/src/exports/pptx/manifest.ts';
import { fixtureById, nodeWiring, reviewOf, type NodeWiring } from '../helpers/node-wiring.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { slideInventory, textAt, type SlideInventory } from '../helpers/slide-inventory.ts';
import { readXlsx, sheetByName, sheetTable, type ReadWorkbook } from '../helpers/xlsx-read.ts';
import { closeTo, evaluateAll, isError, readWorkbookForEval } from '../helpers/formula-eval.ts';

const xlsx = loadSheetJS();
const { JSZip } = loadPptxGenJS();
const DASHES = /[–—]/;
/** The sheets of the overview workbook, in the order of D-039 point 5 (both matrices shown for family-a). */
const SHEET_ORDER = ['Read Me and Controls', 'Source Register', 'Holdings (as loaded)', 'Portfolio Overview',
  'Client Allocation', 'Distributor Allocation', 'Audit Log', '_manifest'];

type FileRow = Record<string, unknown>;
type Case = {
  id: string;
  unit: 'crore' | 'lakh';
  header: '(Cr.)' | '(L)';
  other: '(Cr.)' | '(L)';
  /** The file's market value and invested value columns, and their factors to Crore and to the display unit. */
  cmvCol: string;
  invCol: string;
  toCrore: number;
  toShown: number;
};

const CASES: Case[] = [
  { id: 'family-a', unit: 'crore', header: '(Cr.)', other: '(L)', cmvCol: 'Current Market Value (Cr.)', invCol: 'Invested Value (Cr.)', toCrore: 1, toShown: 1 },
  { id: 'family-a-lakh', unit: 'lakh', header: '(L)', other: '(Cr.)', cmvCol: 'Current Market Value (Lakh)', invCol: 'Invested Value (Lakh)', toCrore: 0.01, toShown: 1 },
  { id: 'family-a-rupee', unit: 'crore', header: '(Cr.)', other: '(L)', cmvCol: 'Market Value (₹)', invCol: 'Invested Value (₹)', toCrore: 1e-7, toShown: 1e-7 },
];

// ---------------------------------------------------------------------------------------------------------------
// The file, read independently

function fileRows(bytes: Uint8Array): FileRow[] {
  const wb = xlsx.read(bytes, { type: 'array' }) as unknown as { Sheets: Record<string, unknown> };
  return xlsx.utils.sheet_to_json(wb.Sheets['Base File'], { defval: null }) as FileRow[];
}
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const label = (r: FileRow, col: string): string => String(r[col] ?? '').trim();

/** Sums of a money column by a grouping key, over the rows with a market value (the included holdings, OD-8). */
function sums(rows: FileRow[], c: Case, col: string, factor: number, key: (r: FileRow) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (num(r[c.cmvCol]) === null) continue;
    const k = key(r);
    out.set(k, (out.get(k) ?? 0) + (num(r[col]) ?? 0) * factor);
  }
  return out;
}

/** Two decimals, as the formatter shows a value below 1,000 that is not on a half-way tie (both rounding rules agree). */
function twoDecimals(x: number): string {
  assert.ok(Math.abs(x) < 1000, `${x} is below 1,000 (no grouping)`);
  const scaled = Math.abs(x) * 100;
  assert.ok(Math.abs(scaled - Math.floor(scaled) - 0.5) > 1e-6, `${x} is not on a tie`);
  return (Math.round(x * 100) / 100).toFixed(2);
}

/** The number of a present Value. */
const present = (x: Value<number>, what: string): number => {
  assert.equal(x.kind, 'value', `${what} is present`);
  return (x as { v: number }).v;
};
const valueOf = (f: Figure): number => present(f.value, f.key);
const near = (a: number, b: number, what: string): void => assert.ok(closeTo(a, b), `${what}: ${a} is not ${b}`);

/** Every figure of the view-model, by its registry key. */
function figuresByKey(vm: OverviewVM): Map<string, Figure> {
  const out = new Map<string, Figure>();
  for (const k of vm.kpis) out.set(k.figure.key, k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) for (const f of [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage]) out.set(f.key, f);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const col of m.columns) { out.set(col.cmv.key, col.cmv); out.set(col.share.key, col.share); }
    for (const r of m.rows) { for (const cell of r.cells) out.set(cell.key, cell); out.set(r.total.key, r.total); }
  }
  return out;
}

type Built = { run: ReviewRun; w: NodeWiring; inv: SlideInventory; deckBytes: Uint8Array; book: ReadWorkbook; bookBytes: Uint8Array };

async function build(id: string): Promise<Built> {
  const w = nodeWiring();
  const run = reviewOf(w, fixtureById(id));
  await w.exportDeck(run.review, run.vm, null);
  await w.exportWorkbook(run.review, run.vm);
  const deckBytes = w.last.pptx!.bytes;
  const bookBytes = w.last.xlsx!.bytes;
  return { run, w, inv: await slideInventory(deckBytes, JSZip), deckBytes, book: readXlsx(bookBytes), bookBytes };
}

// ---------------------------------------------------------------------------------------------------------------

for (const c of CASES) {
  describe(`AC-01 ${c.id}`, () => {
    const fixture = fixtureById(c.id);
    const rows = fileRows(fixture.bytes);
    const built = build(c.id);

    test('the totals and every allocation equal sums of the file\'s own money column (OD-8, OD-18)', async () => {
      const { run: { review, vm } } = await built;
      assert.ok(rows.length > 0 && rows.every((r) => num(r[c.cmvCol]) !== null), 'every holding of the file has a market value');
      const all = (): string => 'all';
      const cmv = sums(rows, c, c.cmvCol, c.toCrore, all).get('all')!;
      const inv = sums(rows, c, c.invCol, c.toCrore, all).get('all')!;
      const t = review.totals;
      near(present(t.cmv, 'total CMV'), cmv, 'total CMV in Crore');
      near(present(t.invested, 'total invested'), inv, 'total invested in Crore');
      near(present(t.gain, 'gain'), cmv - inv, 'gain is CMV minus invested');
      near(present(t.absReturnPct, 'absolute return'), ((cmv - inv) / inv) * 100, 'absolute return');
      near(present(t.investedCoveragePct, 'invested coverage'), 100, 'every holding has an invested value');
      assert.equal(t.counts.included, rows.length);
      assert.equal(t.counts.excluded, 0);
      assert.equal(t.counts.clients, new Set(rows.map((r) => label(r, 'Client Name'))).size);
      assert.equal(t.counts.distributors, new Set(rows.map((r) => label(r, 'Distributor Name'))).size);

      // The screen's KPIs: the same totals in the display unit, and their text.
      const kpi = new Map(vm.kpis.map((k) => [k.id, k.figure]));
      const shown = (f: Figure): number => { assert.equal(f.shown.kind, 'value'); return (f.shown as { v: number }).v; };
      const cmvShown = sums(rows, c, c.cmvCol, c.toShown, all).get('all')!;
      const invShown = sums(rows, c, c.invCol, c.toShown, all).get('all')!;
      near(shown(kpi.get('cmv')!), cmvShown, 'KPI CMV in the display unit');
      near(shown(kpi.get('invested')!), invShown, 'KPI invested in the display unit');
      near(shown(kpi.get('gain')!), cmvShown - invShown, 'KPI gain in the display unit');
      assert.equal(kpi.get('cmv')!.display.text, twoDecimals(cmvShown));
      assert.equal(kpi.get('invested')!.display.text, twoDecimals(invShown));
      assert.equal(kpi.get('gain')!.display.text, twoDecimals(cmvShown - invShown));
      assert.equal(kpi.get('absReturn')!.display.text, `${twoDecimals(((cmvShown - invShown) / invShown) * 100)}%`);
      assert.equal(valueOf(kpi.get('holdings')!), rows.length);

      // Asset classes in the one order (D-039 point 3), products within them, each with its share of the total.
      const byAsset = sums(rows, c, c.cmvCol, c.toCrore, (r) => label(r, 'Asset Name'));
      const invByAsset = sums(rows, c, c.invCol, c.toCrore, (r) => label(r, 'Asset Name'));
      const byProduct = sums(rows, c, c.cmvCol, c.toCrore, (r) => `${label(r, 'Asset Name')}|${label(r, 'Product Name')}`);
      const assetRows = vm.allocation.rows.filter((r) => r.kind === 'asset');
      assert.deepEqual(assetRows.map((r) => r.label), ASSET_ORDER.filter((a) => byAsset.has(a)));
      for (const r of assetRows) {
        near(valueOf(r.cmv), byAsset.get(r.label)!, `${r.label} CMV`);
        near(valueOf(r.invested), invByAsset.get(r.label)!, `${r.label} invested`);
        near(valueOf(r.pct), (byAsset.get(r.label)! / cmv) * 100, `${r.label} % CMV`);
      }
      const productRows = vm.allocation.rows.filter((r) => r.kind === 'product');
      assert.deepEqual(productRows.map((r) => `${r.asset}|${r.product}`).sort(), [...byProduct.keys()].sort());
      for (const r of productRows) near(valueOf(r.cmv), byProduct.get(`${r.asset}|${r.product}`)!, `${r.asset} ${r.product} CMV`);
      near(valueOf(vm.allocation.rows.find((r) => r.kind === 'total')!.cmv), cmv, 'Grand Total CMV');

      // Clients and distributors (columns by label), and the client matrix by class.
      for (const [m, col] of [[vm.matrices.client, 'Client Name'], [vm.matrices.distributor, 'Distributor Name']] as const) {
        const want = sums(rows, c, c.cmvCol, c.toCrore, (r) => label(r, col));
        assert.ok(m.shown, `${m.level} matrix shown: ${want.size} ${m.level}s`);
        assert.deepEqual(m.columns.map((x) => x.label).sort(), [...want.keys()].sort());
        for (const x of m.columns) {
          near(valueOf(x.cmv), want.get(x.label)!, `${m.level} ${x.label} CMV`);
          near(valueOf(x.share), (want.get(x.label)! / cmv) * 100, `${m.level} ${x.label} share`);
        }
        const cell = sums(rows, c, c.cmvCol, c.toCrore, (r) => `${label(r, col)}|${label(r, 'Asset Name')}`);
        for (const r of m.rows.filter((x) => x.kind === 'asset')) {
          r.cells.forEach((f, i) => near(valueOf(f), cell.get(`${m.columns[i]!.label}|${r.asset}`) ?? 0, `${m.level} ${m.columns[i]!.label} ${r.asset}`));
        }
      }
    });

    test('the totals reconcile, and no result is Blocking once the as-on date is set', async () => {
      const { run: { review, vm } } = await built;
      const total = valueOf(vm.allocation.rows.find((r) => r.kind === 'total')!.cmv);
      const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
      const assets = vm.allocation.rows.filter((r) => r.kind === 'asset');
      near(sum(assets.map((r) => valueOf(r.cmv))), total, 'classes add up to the Grand Total');
      near(sum(assets.map((r) => valueOf(r.pct))), 100, 'class shares add up to 100');
      for (const a of assets) {
        const products = vm.allocation.rows.filter((r) => r.kind === 'product' && r.asset === a.asset);
        near(sum(products.map((r) => valueOf(r.cmv))), valueOf(a.cmv), `${a.label}'s products add up to it`);
      }
      near(sum(vm.liquidity.rows.map((r) => valueOf(r.cmv))), total, 'liquidity lines add up to the Grand Total');
      for (const m of [vm.matrices.client, vm.matrices.distributor]) {
        near(sum(m.columns.map((x) => valueOf(x.cmv))), total, `${m.level} columns add up to the Grand Total`);
        for (const r of m.rows) near(sum(r.cells.map(valueOf)), valueOf(r.total), `${m.level} row ${r.label} adds up across`);
      }
      near(valueOf(vm.kpis.find((k) => k.id === 'cmv')!.figure), total, 'the KPI is the Grand Total');
      assert.deepEqual(review.issues.filter((i) => i.severity === 'Blocking').map((i) => i.ruleId), []);
      assert.ok(review.issues.some((i) => i.ruleId === 'reconcile.passed'), 'the reconciliation ran and passed');
      assert.deepEqual(review.gate, { blocking: 0, highOpen: 0, canExport: true, reasons: [] });
      assert.equal(vm.meta.asOnText, '30 Sep 2026');
    });

    test('the deck: every manifest component with its figures; the slide shows the screen\'s figures', async () => {
      const { run: { vm }, w, inv } = await built;
      const deck = w.last.pptx!.deck!;
      const planned = plannedComponents(SLIDE_MANIFEST, vm).map((p) => p.component.id);
      assert.ok(planned.length > 0, 'the manifest plans at least one component');
      assert.deepEqual(deck.components.map((x) => x.id), planned, 'every planned component is in the deck');
      let pages = 0;
      for (const comp of deck.components) {
        assert.ok(comp.result.pages >= 1 && comp.result.figures.length > 0, `${comp.id} has content`);
        pages += comp.result.pages;
      }
      assert.equal(inv.slides.length, pages);
      for (const s of inv.slides) assert.ok(s.tables.length >= 1, `slide ${s.index} has its table`);
      assert.equal(inv.slides[0]!.charts.length, 2, 'the asset and liquidity pies');

      const c08 = deck.components.find((x) => x.id === 'C-08')!.result;
      const byKey = figuresByKey(vm);
      const pieLabels = new Map(vm.charts.asset.slices.concat(vm.charts.liquidity.slices).map((s) => [s.pct.key, s.label]));
      const placed = new Set<string>();
      for (const loc of c08.figures) {
        const got = textAt(inv.slides[loc.page - 1]!, loc.cell);
        placed.add(loc.key);
        if (loc.cell.startsWith('pie:')) {
          // A pie label is the view-model's label; PowerPoint may break it into lines, so white space is not compared.
          assert.equal((got ?? '').replace(/\s+/g, ''), (pieLabels.get(loc.key) ?? '').replace(/\s+/g, ''), loc.cell);
        } else {
          const f = byKey.get(loc.key);
          assert.ok(f, `figure ${loc.key} is in the view-model`);
          assert.equal(got, f.display.text + (f.display.marker ?? ''), `${loc.cell} (${loc.key})`);
        }
      }
      for (const id of ['invested', 'cmv', 'gain'] as const) assert.ok(placed.has(vm.kpis.find((k) => k.id === id)!.figure.key), `KPI ${id} on the slide`);
      for (const r of vm.allocation.rows.filter((x) => x.kind !== 'liquidity')) assert.ok(placed.has(r.cmv.key), `${r.label} CMV on the slide`);
    });

    test('the workbook: the sheets of D-039 in order with data; every formula evaluates to its cached value; each figure cell is the screen\'s figure', async () => {
      const { run: { vm }, book, bookBytes } = await built;
      assert.deepEqual(book.sheets.map((s) => s.name), SHEET_ORDER);
      for (const s of book.sheets) assert.ok(sheetTable(s).length >= 2, `${s.name} has data below its header`);

      const ev = readWorkbookForEval(bookBytes);
      const values = evaluateAll(ev);
      assert.ok(values.size > 0, 'the overview is formulas');
      for (const [ref, v] of values) {
        assert.ok(!isError(v), `${ref} evaluates to an error`);
        const [sheet, cell] = ref.split('!') as [string, string];
        const cached = ev.sheets.get(sheet.toLowerCase())!.cells.get(cell)!.cached;
        if (typeof v === 'number') assert.ok(typeof cached === 'number' && closeTo(v, cached), `${ref}: ${v} against the cached ${String(cached)}`);
      }

      const byKey = figuresByKey(vm);
      const cellValue = (at: string): unknown => {
        if (values.has(at)) return values.get(at);
        const [sheet, cell] = at.split('!') as [string, string];
        return ev.sheets.get(sheet.toLowerCase())?.cells.get(cell)?.value;
      };
      const figureRows = sheetTable(sheetByName(book, '_manifest')).filter((r) => typeof r[0] === 'string' && r[0].startsWith('figure '));
      let checked = 0;
      for (const r of figureRows) {
        const key = String(r[0]).slice('figure '.length);
        const f = byKey.get(key);
        assert.ok(f, `_manifest figure ${key} is a figure of the view-model`);
        if (f.shown.kind !== 'value') continue;
        const at = String(r[1]);
        const v = cellValue(at);
        assert.ok(typeof v === 'number' && closeTo(v, f.shown.v), `${at} (${key}): ${String(v)} against ${f.shown.v}`);
        checked += 1;
      }
      assert.ok(checked >= vm.allocation.rows.length, `${checked} figure cells checked`);

      // The Grand Total and the holdings as loaded against the file's own column, in the display unit.
      const cmvShown = sums(rows, c, c.cmvCol, c.toShown, () => 'all').get('all')!;
      const totalAt = figureRows.find((r) => r[0] === `figure ${vm.allocation.rows.find((x) => x.kind === 'total')!.cmv.key}`);
      assert.ok(totalAt, 'the Grand Total CMV has a cell');
      const totalValue = cellValue(String(totalAt[1]));
      assert.ok(typeof totalValue === 'number' && closeTo(totalValue, cmvShown), `Grand Total ${String(totalValue)} against the file's ${cmvShown}`);
      const held = sheetTable(sheetByName(book, 'Holdings (as loaded)'));
      const j = held[0]!.indexOf(`Current Market Value ${c.header}`);
      assert.ok(j >= 0, 'Holdings (as loaded) has the market value column in the display unit');
      const column = held.slice(1).map((r) => r[j]);
      assert.equal(column.length, rows.length);
      column.forEach((v, i) => assert.ok(typeof v === 'number' && closeTo(v, num(rows[i]![c.cmvCol])! * c.toShown), `holding ${i + 1}: ${String(v)}`));
    });

    test(`one display unit everywhere: ${c.header} on the screen, the slide and the sheets, never ${c.other} (E-03)`, async () => {
      const { run: { vm }, inv, book } = await built;
      assert.deepEqual([vm.meta.unit, vm.meta.unitHeader], [c.unit, c.header]);
      for (const k of vm.kpis.filter((x) => ['invested', 'cmv', 'gain'].includes(x.id))) assert.ok(k.label.endsWith(c.header), k.label);
      assert.ok(vm.allocation.headers[1].endsWith(c.header) && vm.allocation.headers[2].endsWith(c.header), vm.allocation.headers.join(' | '));
      const slideText = inv.slides.map((s) => s.shapes.map((x) => x.text).join('\n') + s.tables.flatMap((t) => t.rows.flatMap((r) => r.cells.map((x) => x.text))).join('\n')).join('\n');
      assert.ok(slideText.includes(c.header), `the slide shows ${c.header}`);
      assert.ok(!slideText.includes(c.other), `the slide never shows ${c.other}`);
      for (const name of ['Holdings (as loaded)', 'Portfolio Overview', 'Client Allocation', 'Distributor Allocation']) {
        const head = sheetTable(sheetByName(book, name))[0]!.map((x) => String(x ?? ''));
        assert.ok(head.some((h) => h.endsWith(c.header)), `${name} headers carry ${c.header}`);
      }
      for (const s of book.sheets) {
        for (const cell of s.cells.values()) {
          if (typeof cell.v === 'string') assert.ok(!cell.v.includes(c.other), `${s.name}!${cell.ref} shows ${c.other}`);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// House style (D-029), on family-a and on its variant without invested values (whose figures show the marker)

for (const id of ['family-a', 'family-a-no-invested']) {
  test(`AC-01 ${id}: no en or em dash in a sentence; a dash is the marker alone in its cell with its status (D-029)`, async () => {
    const { run: { vm }, inv, book, w } = await build(id);
    const fileText = new Set(fileRows(fixtureById(id).bytes).flatMap((r) => Object.values(r)).filter((v): v is string => typeof v === 'string').map((v) => v.trim()));
    const noteIds = new Set(vm.notes.map((n) => n.id));

    // The screen (the view-model): sentences and labels without a dash; each marker with a note that names its status.
    for (const n of vm.notes) assert.ok(!DASHES.test(n.text), `note ${n.id}: ${n.text}`);
    const labels = [
      ...vm.kpis.map((k) => k.label), ...vm.allocation.headers, ...vm.allocation.rows.map((r) => r.label),
      ...vm.liquidity.rows.map((r) => r.label), vm.charts.asset.title, vm.charts.liquidity.title,
      ...vm.charts.asset.slices.concat(vm.charts.liquidity.slices).map((s) => s.label ?? ''),
      ...[vm.matrices.client, vm.matrices.distributor].flatMap((m) => [m.title, ...m.columns.map((x) => x.label), ...m.rows.map((r) => r.label)]),
    ];
    for (const l of labels) assert.ok(!DASHES.test(l), `label ${l}`);
    const markers: Figure[] = [];
    for (const f of figuresByKey(vm).values()) {
      if (!DASHES.test(f.display.text)) continue;
      assert.equal(f.display.text, MISSING_MARKER, `${f.key} shows the marker alone`);
      assert.equal(f.display.marker, null, `${f.key} has no p or s after the marker`);
      assert.ok(f.display.footnoteStatus !== null && MISSING_STATUSES.includes(f.display.footnoteStatus), `${f.key} names a status`);
      assert.ok(f.notes.length > 0 && f.notes.every((n) => noteIds.has(n)), `${f.key} refers to notes that are shown`);
      markers.push(f);
    }
    if (id === 'family-a') assert.equal(markers.length, 0, 'family-a is complete: no marker');
    else assert.ok(markers.length > 0, 'the variant shows markers');

    // The slide: every text run or table cell with a dash is the marker alone; each marker's notes are on its slide.
    for (const s of inv.slides) {
      for (const sh of s.shapes) for (const r of sh.runs) if (DASHES.test(r.text)) assert.equal(r.text, MISSING_MARKER, `slide ${s.index} ${sh.name}: ${r.text}`);
      for (const t of s.tables) for (const row of t.rows) for (const cell of row.cells) if (DASHES.test(cell.text)) assert.equal(cell.text, MISSING_MARKER, `slide ${s.index} table cell: ${cell.text}`);
      for (const ch of s.charts) for (const l of ch.labels) if (l.text) assert.ok(!DASHES.test(l.text), `slide ${s.index} chart label ${l.text}`);
      assert.ok(!DASHES.test(s.notes), `slide ${s.index} notes`);
    }
    const byKey = figuresByKey(vm);
    const c08 = w.last.pptx!.deck!.components.find((x) => x.id === 'C-08')!.result;
    for (const loc of c08.figures) {
      const f = byKey.get(loc.key);
      if (!f || f.display.text !== MISSING_MARKER) continue;
      const slide = inv.slides[loc.page - 1]!;
      const text = `${slide.shapes.map((x) => x.text).join(' ')} ${slide.notes}`.replace(/\s+/g, ' ');
      for (const n of f.notes) {
        const note = vm.notes.find((x) => x.id === n)!;
        assert.ok(text.includes(note.text.replace(/\s+/g, ' ')), `the note of ${loc.key} (${n}) is on slide ${loc.page}`);
      }
    }

    // The workbook: no dash in any cell but the file's own text; a missing figure is a blank cell whose row names
    // its status in the Status column (rows with a Key; the share row below a matrix has none).
    for (const s of book.sheets) {
      for (const cell of s.cells.values()) {
        if (typeof cell.v === 'string' && DASHES.test(cell.v)) assert.ok(fileText.has(cell.v.trim()), `${s.name}!${cell.ref}: ${cell.v}`);
      }
    }
    let blanks = 0;
    for (const name of ['Portfolio Overview', 'Client Allocation', 'Distributor Allocation']) {
      const table = sheetTable(sheetByName(book, name));
      const head = table[0]!.map((x) => String(x ?? ''));
      const keyAt = head.indexOf('Key');
      const statusAt = head.indexOf('Status');
      assert.ok(keyAt >= 0 && statusAt > keyAt, `${name} has Key and Status columns`);
      for (const r of table.slice(1)) {
        if (r[keyAt] === null) continue;
        for (let j = keyAt + 1; j < statusAt; j++) {
          if (r[j] !== null) continue;
          blanks += 1;
          const status = String(r[statusAt] ?? '');
          assert.ok(MISSING_STATUSES.some((x) => status.includes(x)), `${name} ${String(r[keyAt])}, ${head[j]}: blank, and the Status names it (${status})`);
        }
      }
    }
    if (id === 'family-a') assert.equal(blanks, 0, 'family-a is complete: no blank figure cell');
    else assert.ok(blanks > 0, 'the variant leaves its missing figures blank');
  });
}
