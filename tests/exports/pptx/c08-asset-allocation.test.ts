// covers: E-52 DA-03 KI-150 KI-078 KI-091
// Slide C-08 asset-allocation (deck-design-system.md §4 and the QA checks of §8; D-039) on the
// hand-worked standard sample (sample-vm.ts): the inventory snapshot, the KPIs, the table, the two pies with their
// colours fixed by category name (KI-150: never by position, never random), outlines, labels and legend, the
// content area, overlaps, text boxes, repeats, embedded workbooks, the footnote and its overflow, and two builds
// byte-identical. Set UPDATE_SNAPSHOTS=1 to rewrite the snapshot after a deliberate change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { C08_LAYOUT, labelPosition, MORE_NOTES } from '../../../app/src/exports/pptx/components/C-08-asset-allocation.ts';
import { contrastRatio } from '../../../app/src/exports/pptx/chrome.ts';
import { cambria } from '../../../app/src/exports/pptx/measure.ts';
import {
  chartRenames, dropMissingOverrides, oneParagraphPerCell, oneParagraphProperties, pieLabelsXml, renameReferences, rewritePieLabels,
  uniqueShapeIds,
} from '../../../app/src/exports/pptx/postprocess.ts';
import type { Figure, OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { kids, parseXml, shapeNamed, textAt, type Shape, type Slide, type SlideInventory } from '../../helpers/slide-inventory.ts';
import { buildDeck, fig, manyProductsVM, missing, pngDataUri, sixSliceVM, standardParts, standardVM } from './sample-vm.ts';

const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '__snapshots__', 'c08-standard.json');
const LOGO = { dataUri: pngDataUri(400, 100), widthPx: 400, heightPx: 100 };
const EM = '\u2014';

/** Category colours by name (deck-design-system.md §2.1 and §2.4), written out by hand. */
const BY_NAME: Record<string, string> = {
  Equity: 'DBC8B2', Debt: 'BD9568', Hybrid: 'BFBFBF', Commodity: '808080', 'REITs/InvITs': '8C6B43', Unknown: 'D9D9D9',
  'Open Ended': 'BD9568', 'Close Ended': 'BFBFBF',
};

// ---------------------------------------------------------------------------------------------------------------
// Snapshot

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
function normalise(inv: SlideInventory): unknown {
  const run = (r: { text: string; size: number | null; font: string | null; colour: string | null; bold: boolean; italic: boolean; superscript: boolean }): string =>
    `${r.text}|${r.size}|${r.font}|${r.colour}|${r.bold ? 'b' : ''}${r.italic ? 'i' : ''}${r.superscript ? '^' : ''}`;
  return {
    core: inv.core,
    themeFonts: inv.themeFonts,
    parts: inv.parts,
    slides: inv.slides.map((s) => ({
      index: s.index,
      notes: s.notes,
      shapes: s.shapes.map((sh) => ({
        kind: sh.kind, id: sh.id, name: sh.name, descr: sh.descr, box: [sh.x, sh.y, sh.w, sh.h].map(r3), rot: sh.rot,
        geom: sh.geom, fill: sh.fill, line: sh.line, anchor: sh.anchor, insets: sh.insets,
        ...(sh.kind === 'table' ? {} : { runs: sh.runs.map(run) }),
      })),
      tables: s.tables.map((t) => ({
        name: t.name, box: [t.x, t.y, t.w, t.h].map(r3), colW: t.colW.map(r3),
        rows: t.rows.map((row) => ({
          h: r3(row.h),
          cells: row.cells.map((c) => ({
            runs: c.runs.map(run), paragraphs: c.paragraphs, fill: c.fill, align: c.align, margins: c.margins,
            borders: (['L', 'R', 'T', 'B'] as const).map((e) => { const b = c.borders[e]; return b ? `${e} ${b.width} ${b.colour}` : null; }),
          })),
        })),
      })),
      charts: s.charts.map(({ xml: _xml, ...rest }) => rest),
    })),
  };
}

/** JSON with one space of indent and arrays of plain values on one line, so the snapshot diffs read well. */
function stringify(v: unknown, indent = ''): string {
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) return JSON.stringify(v);
    return `[\n${v.map((x) => `${indent} ${stringify(x, `${indent} `)}`).join(',\n')}\n${indent}]`;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([k, x]) => `${indent} ${JSON.stringify(k)}: ${stringify(x, `${indent} `)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(v);
}

test('the standard sample matches the committed inventory snapshot', async () => {
  const { inv } = await buildDeck(standardVM(), LOGO);
  const got = normalise(inv);
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, `${stringify(got)}\n`);
  }
  assert.deepEqual(got, JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')));
});

// ---------------------------------------------------------------------------------------------------------------
// Known answers of the standard sample

test('three KPIs with their OD-18 labels and the hand-worked values', async () => {
  const { inv } = await buildDeck(standardVM());
  const s = inv.slides[0] as Slide;
  assert.deepEqual(
    ['invested', 'cmv', 'gain'].map((id) => [shapeNamed(s, `C-08 kpi ${id} value`).text, shapeNamed(s, `C-08 kpi ${id} label`).text]),
    [['3.40', 'Invested Value (Cr.)'], ['4.00', 'Current Market Value (Cr.)'], ['0.60', 'Unrealised Gain/Loss (Cr.)']],
  );
  assert.ok(!s.shapes.some((x) => / kpi (absReturn|holdings|clients) /.test(x.name)), 'the slide uses the first three KPIs only');
  assert.ok(!s.shapes.some((x) => /insight/i.test(x.name)), 'no insight box in M1.4 (D-039)');
});

test('the table: hand-worked cells, row styles, borders, margins and alignment', async () => {
  const { inv } = await buildDeck(standardVM());
  const t = (inv.slides[0] as Slide).tables[0]!;
  assert.deepEqual(t.colW, [180, 104, 119, 72]);
  assert.deepEqual([t.x, t.y], [13, 168.5]);
  assert.deepEqual(t.rows.map((r) => r.cells.map((c) => c.text)), [
    ['Asset Class', 'Investment Amount (Cr.)', 'Current Market Value (Cr.)', '% CMV'],
    ['Equity', '1.80', '2.22', '55.50%'],
    ['Mutual Funds', '1.20', '1.52', '38.00%'],
    ['PMS', '0.60', '0.70', '17.50%'],
    ['Debt', '0.85', '0.94', '23.50%'],
    ['Mutual Funds', '0.85', '0.94', '23.50%'],
    ['Hybrid', '0.40', '0.46', '11.50%'],
    ['Mutual Funds', '0.40', '0.46', '11.50%'],
    ['Commodity', '0.30', '0.32', '8.00%'],
    ['Mutual Funds', '0.30', '0.32', '8.00%'],
    ['REITs/InvITs', '0.05', '0.06', '1.50%'],
    ['REITs and InvITs', '0.05', '0.06', '1.50%'],
    ['Grand Total', '3.40', '4.00', '100.00%'],
  ]);
  const style = (i: number): string => {
    const c = t.rows[i]!.cells;
    return `${c[0]!.fill}/${c[0]!.runs[0]!.colour}/${c.every((x) => x.runs.every((r) => r.bold)) ? 'bold' : 'regular'}`;
  };
  assert.equal(style(0), '000000/FFFFFF/bold');
  assert.equal(style(1), 'BFBFBF/000000/bold');
  assert.equal(style(2), 'FFFFFF/000000/regular');
  assert.equal(style(12), '000000/FFFFFF/bold');
  for (const row of t.rows) {
    for (const [i, c] of row.cells.entries()) {
      for (const e of ['L', 'R', 'T', 'B'] as const) assert.deepEqual(c.borders[e], { width: 0.5, colour: 'D9D9D9' });
      assert.equal(c.paragraphs, 1);
      for (const r of c.runs) assert.deepEqual([r.size, r.font], [9, 'Cambria']);
      if (row !== t.rows[0]) assert.equal(c.align, i === 0 ? 'l' : 'ctr');
    }
  }
  assert.deepEqual(t.rows[1]!.cells[0]!.margins, [3, 5, 3, 5]);
  assert.deepEqual(t.rows[2]!.cells[0]!.margins, [3, 5, 3, 14], 'product labels indented');
  assert.ok(t.rows[0]!.cells.every((c) => c.align === 'ctr'));
});

test('missing, negative and partial cells: the dash alone, red on a light row, the marker as a superscript', async () => {
  const parts = standardParts();
  (parts.assets[0]!.products[1] as { invested: number | null }).invested = null;
  const vm = standardVM(parts);
  // View-model rows 0 Equity, 1 its Mutual Funds, 2 its PMS; table rows add the header, so PMS is row 3.
  const pms = vm.allocation.rows[2]!;
  assert.equal(pms.label, 'PMS');
  pms.cmv = fig(pms.cmv.key, -0.7, '-0.70');
  const eq = vm.allocation.rows[0]!;
  eq.invested = fig(eq.invested.key, 1.2, '1.20', { marker: 'p', coverage: 0.6847 });
  const total = vm.allocation.rows.at(-1)!;
  total.cmv = fig(total.cmv.key, -1, '-1.00');
  const { inv } = await buildDeck(vm);
  const t = (inv.slides[0] as Slide).tables[0]!;
  assert.equal(t.rows[3]!.cells[1]!.text, EM);
  assert.equal(t.rows[3]!.cells[1]!.align, 'ctr');
  assert.equal(t.rows[3]!.cells[2]!.text, '-0.70');
  assert.ok(t.rows[3]!.cells[2]!.runs.every((r) => r.colour === '931621'), 'red on a product row');
  assert.equal(t.rows.at(-1)!.cells[2]!.text, '-1.00');
  assert.ok(t.rows.at(-1)!.cells[2]!.runs.every((r) => r.colour === 'FFFFFF'), 'white on the black Grand Total row');
  const marked = t.rows[1]!.cells[1]!;
  assert.equal(marked.paragraphs, 1);
  assert.deepEqual(marked.runs.map((r) => [r.text, r.superscript, r.size]), [['1.20', false, 9], ['p', true, 9]]);
});

test('pies: colours by category name, 0.75 pt #BFBFBF outlines, labels from the view-model, the small slice deleted', async () => {
  const vm = standardVM();
  const { inv } = await buildDeck(vm);
  const s = inv.slides[0] as Slide;
  assert.equal(s.charts.length, 2);
  for (const c of s.charts) {
    const chart = c.name === 'C-08 asset pie' ? vm.charts.asset : vm.charts.liquidity;
    assert.equal(c.type, 'pieChart');
    assert.equal(c.series, 1);
    assert.deepEqual(c.categories, chart.slices.map((x) => x.category));
    assert.deepEqual(c.pointColours, c.categories.map((x) => BY_NAME[x]), 'colour by category name');
    for (const l of c.pointLines) assert.deepEqual(l, { width: 0.75, colour: 'BFBFBF' });
    assert.deepEqual(c.seriesLine, { width: 0.75, colour: 'BFBFBF' });
    assert.ok(!/F9F9F9/i.test(c.xml), 'no #F9F9F9 outline');
    assert.equal(c.gridlines, false);
    assert.ok(!c.xml.includes('majorGridlines'));
    assert.deepEqual(c.legend, { position: 'b', size: 9, font: 'Cambria' });
    assert.deepEqual([c.defaults.numFmt, c.defaults.separator, c.defaults.position], ['0.0%', ' ', 'bestFit']);
    assert.equal(c.labels.length, chart.slices.length);
    chart.slices.forEach((slice, i) => {
      const l = c.labels.find((x) => x.idx === i)!;
      if (slice.label === null) assert.equal(l.deleted, true, `${slice.category} label deleted`);
      else assert.deepEqual([l.deleted, l.text, l.size, l.font, l.colour], [false, slice.label, 9, 'Cambria', '222222']);
    });
  }
  const asset = s.charts.find((c) => c.name === 'C-08 asset pie')!;
  assert.deepEqual(asset.labels.map((l) => (l.deleted ? null : l.text)), ['Equity 55.5%', 'Debt 23.5%', 'Hybrid 11.5%', 'Commodity 8.0%', null]);
  assert.deepEqual(asset.values, [55.5, 23.5, 11.5, 8, 1.5]);
  assert.equal(asset.descr, 'Pie chart of asset classes by share of total market value');
  const liq = s.charts.find((c) => c.name === 'C-08 liquidity pie')!;
  assert.deepEqual(liq.labels.map((l) => l.text), ['Open Ended 92.5%', 'Close Ended 7.5%']);
  assert.equal(liq.descr, 'Pie chart of liquidity categories by share of total market value');
});

test('a label reads at 4.5:1 or better: inside a light slice, outside a dark one', async () => {
  // #222222 on #808080 (Commodity): luminances 0.0160 and 0.2159, (0.2159 + 0.05) / (0.0160 + 0.05) = 4.03.
  assert.ok(Math.abs(contrastRatio('222222', '808080') - 4.03) < 0.01);
  assert.ok(contrastRatio('#222222', '#8C6B43') < 4.5);
  assert.deepEqual(['#DBC8B2', '#BD9568', '#BFBFBF', '#808080', '#8C6B43', '#D9D9D9'].map(labelPosition), ['bestFit', 'bestFit', 'bestFit', 'outEnd', 'outEnd', 'bestFit']);
  const { inv } = await buildDeck(sixSliceVM());
  const asset = (inv.slides[0] as Slide).charts.find((c) => c.name === 'C-08 asset pie')!;
  assert.deepEqual(asset.labels.map((l) => [asset.categories[l.idx], l.position]), [
    ['Equity', 'bestFit'], ['Debt', 'bestFit'], ['Hybrid', 'bestFit'], ['Commodity', 'outEnd'], ['REITs/InvITs', 'outEnd'], ['Unknown', 'bestFit'],
  ]);
});

test('KI-150: six slices keep their colours over three builds and in a shuffled order', async () => {
  const colours = async (vm: OverviewVM): Promise<Record<string, string>> => {
    const { inv } = await buildDeck(vm);
    const c = (inv.slides[0] as Slide).charts.find((x) => x.name === 'C-08 asset pie')!;
    assert.equal(c.pointColours.length, c.categories.length, 'one colour per slice, none drawn at random');
    return Object.fromEntries(c.categories.map((cat, i) => [cat, c.pointColours[i] as string]));
  };
  const want = { Equity: 'DBC8B2', Debt: 'BD9568', Hybrid: 'BFBFBF', Commodity: '808080', 'REITs/InvITs': '8C6B43', Unknown: 'D9D9D9' };
  for (let i = 0; i < 3; i++) assert.deepEqual(await colours(sixSliceVM()), want);
  assert.deepEqual(await colours(sixSliceVM(['Unknown', 'Hybrid', 'Equity', 'REITs/InvITs', 'Debt', 'Commodity'])), want);
});

test('the deck title names the family; the dates are the export clock', async () => {
  const { inv } = await buildDeck(standardVM({ familyLabel: 'Synthetic Household' }));
  assert.deepEqual(inv.core, {
    title: 'Synthetic Household Portfolio overview', subject: 'Portfolio overview', creator: 'Portfolio Review',
    created: '2026-10-24T00:00:00Z', modified: '2026-10-24T00:00:00Z',
  });
});

test('two builds of the same view-model and clock are byte-identical', async () => {
  const a = await buildDeck(standardVM(), LOGO);
  const b = await buildDeck(standardVM(), LOGO);
  assert.ok(Buffer.from(a.bytes).equals(Buffer.from(b.bytes)));
  const many = await buildDeck(manyProductsVM(6, 6), LOGO);
  const again = await buildDeck(manyProductsVM(6, 6), LOGO);
  assert.ok(Buffer.from(many.bytes).equals(Buffer.from(again.bytes)));
  assert.deepEqual(a.inv.parts.filter((p) => /charts\/|embeddings\//.test(p)), [
    'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx', 'ppt/charts/_rels/chart1.xml.rels', 'ppt/charts/chart1.xml',
    'ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx', 'ppt/charts/_rels/chart2.xml.rels', 'ppt/charts/chart2.xml',
  ], 'chart parts numbered from 1 in every export');
});

// ---------------------------------------------------------------------------------------------------------------
// QA checks of deck-design-system.md §8

const isChrome = (s: Shape): boolean => s.name.startsWith('chrome ');
const intersects = (a: Shape, b: Shape): boolean => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.05 && h > 0.05;
};
const inside = (o: Shape, u: Shape): boolean =>
  o.x >= u.x - 0.05 && o.y >= u.y - 0.05 && o.x + o.w <= u.x + u.w + 0.05 && o.y + o.h <= u.y + u.h + 0.05;

async function sampleDecks(): Promise<Array<{ vm: OverviewVM; deck: Awaited<ReturnType<typeof buildDeck>> }>> {
  const out = [];
  for (const vm of [standardVM(), sixSliceVM(), manyProductsVM(6, 6)]) out.push({ vm, deck: await buildDeck(vm, LOGO) });
  return out;
}

test('§8 item 4: nothing outside x 13 to 947 or below 495 pt except the chrome', async () => {
  for (const { deck } of await sampleDecks()) {
    for (const s of deck.inv.slides) {
      for (const sh of s.shapes.filter((x) => !isChrome(x))) {
        assert.ok(sh.x >= 13 - 0.05 && sh.x + sh.w <= 947 + 0.05, `slide ${s.index} ${sh.name}: x ${sh.x} to ${sh.x + sh.w}`);
        assert.ok(sh.y >= 67 - 0.05 && sh.y + sh.h <= 495 + 0.05, `slide ${s.index} ${sh.name}: y ${sh.y} to ${sh.y + sh.h}`);
      }
    }
  }
});

test('§8 item 5: no overlap outside the declared layering, and each layered object lies inside its base', async () => {
  const allowed = (a: Shape, b: Shape): boolean =>
    C08_LAYOUT.layering.some((l) => (l.under === a.name && l.over.includes(b.name) && (!l.contained || inside(b, a)))
      || (l.under === b.name && l.over.includes(a.name) && (!l.contained || inside(a, b))));
  for (const { deck } of await sampleDecks()) {
    for (const s of deck.inv.slides) {
      for (let i = 0; i < s.shapes.length; i++) {
        for (let j = i + 1; j < s.shapes.length; j++) {
          const a = s.shapes[i] as Shape;
          const b = s.shapes[j] as Shape;
          if (intersects(a, b)) assert.ok(allowed(a, b), `slide ${s.index}: ${a.name} overlaps ${b.name}`);
        }
      }
    }
  }
});

test('§8 item 2: every chart is native with its embedded workbook; the only picture is the logo', async () => {
  for (const { deck } of await sampleDecks()) {
    for (const s of deck.inv.slides) {
      for (const c of s.charts) {
        assert.ok(c.embedding && deck.inv.parts.includes(c.embedding), `${c.name} has an embedded workbook`);
        for (const p of ['xl/workbook.xml', 'xl/worksheets/sheet1.xml']) assert.ok(c.embeddingParts.includes(p), `${c.name}: ${p}`);
      }
      const pics = s.shapes.filter((x) => x.kind === 'picture');
      assert.deepEqual(pics.map((p) => p.name), ['chrome logo']);
    }
    for (const t of deck.inv.slides.flatMap((s) => s.tables)) assert.equal(t.name, 'C-08 table', 'the table is native');
  }
});

test('§8 item 6: no rotated or semi-transparent text or shape, no full-slide shape, no background picture', async () => {
  for (const { deck } of await sampleDecks()) {
    assert.deepEqual(deck.inv.backgroundPictures, []);
    for (const s of deck.inv.slides) {
      assert.ok(!/<a:alpha\b/.test(s.xml), 'no transparency on the slide');
      assert.ok(!/<p:bg>/.test(s.xml), 'no slide background override');
      for (const sh of s.shapes) {
        assert.equal(sh.rot, 0, `${sh.name} rotated`);
        assert.equal(sh.fillAlpha, null);
        for (const r of sh.runs) assert.equal(r.alpha, null);
        assert.ok(!(sh.w >= 960 && sh.h >= 540), `${sh.name} covers the slide`);
      }
    }
  }
});

test('§8 item 7: text boxes within the budget, none empty, zero-size or off-slide, no identical shapes', async () => {
  for (const { deck } of await sampleDecks()) {
    for (const s of deck.inv.slides) {
      const boxes = s.shapes.filter((x) => x.hasText);
      const budget = s.index === 1 ? C08_LAYOUT.textBoxBudget.first : C08_LAYOUT.textBoxBudget.continued;
      assert.ok(boxes.length <= budget, `slide ${s.index}: ${boxes.length} text boxes over ${budget}`);
      for (const b of boxes) assert.notEqual(b.text.trim(), '', `${b.name} is empty`);
      const seen = new Set<string>();
      for (const sh of s.shapes) {
        assert.ok(sh.w > 0 && sh.h > 0, `${sh.name} has no size`);
        assert.ok(sh.x >= 0 && sh.y >= 0 && sh.x + sh.w <= 960 + 0.05 && sh.y + sh.h <= 540 + 0.05, `${sh.name} off the slide`);
        const key = [sh.x, sh.y, sh.w, sh.h, sh.geom, sh.fill, sh.kind].join(',');
        assert.ok(!seen.has(key), `${sh.name} repeats another shape`);
        seen.add(key);
      }
      assert.equal(new Set(s.shapes.map((x) => x.id)).size, s.shapes.length, 'shape ids are unique');
    }
  }
});

test('§8 item 7: a figure prints at most once per slide, except the declared repeats', async () => {
  const pattern = (p: string): RegExp => new RegExp(`^${p.split('.').map((seg) => (seg === '*' ? '[^.]+' : seg.replace(/[/]/g, '\\/'))).join('\\.')}$`);
  const sameKey = C08_LAYOUT.repeats.filter((r) => r.keys.length === 1).map((r) => pattern(r.keys[0] as string));
  for (const { deck } of await sampleDecks()) {
    const pages = new Map<number, string[]>();
    for (const f of deck.c08.figures) pages.set(f.page, [...(pages.get(f.page) ?? []), f.key]);
    for (const [page, keys] of pages) {
      const counts = new Map<string, number>();
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
      for (const [k, n] of counts) if (n > 1) assert.ok(sameKey.some((re) => re.test(k)), `page ${page}: ${k} printed ${n} times`);
    }
    const first = pages.get(1) ?? [];
    for (const pair of C08_LAYOUT.repeats.filter((r) => r.keys.length === 2)) {
      assert.ok(pair.keys.every((k) => first.includes(k)), `the declared pair ${pair.keys.join(' and ')} is on page 1`);
    }
  }
  const { inv } = await buildDeck(standardVM());
  const s = inv.slides[0] as Slide;
  const total = s.tables[0]!.rows.at(-1)!.cells;
  assert.deepEqual([shapeNamed(s, 'C-08 kpi invested value').text, shapeNamed(s, 'C-08 kpi cmv value').text], [total[1]!.text, total[2]!.text]);
});

test('every figure location reads back the figure\'s display (or the slice label) from the slide', async () => {
  for (const { vm, deck } of await sampleDecks()) {
    const byKey = new Map<string, Figure>();
    for (const k of vm.kpis) byKey.set(k.figure.key, k.figure);
    for (const r of vm.allocation.rows) for (const f of [r.invested, r.cmv, r.pct]) byKey.set(f.key, f);
    const labels = new Map<string, string | null>();
    for (const c of [vm.charts.asset, vm.charts.liquidity]) c.slices.forEach((sl, i) => labels.set(`pie:${c.id}:${i}`, sl.label));
    assert.ok(deck.c08.figures.length > 10);
    for (const loc of deck.c08.figures) {
      const slide = deck.inv.slides[loc.page - 1] as Slide;
      const got = textAt(slide, loc.cell);
      if (loc.cell.startsWith('pie:')) assert.equal(got, labels.get(loc.cell));
      else {
        const f = byKey.get(loc.key);
        assert.ok(f, `figure ${loc.key}`);
        assert.equal(got, f.display.text + (f.display.marker ?? ''), `${loc.key} at ${loc.cell}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Post-processing and package integrity

test('post-processing repairs PptxGenJS text structure and refuses a chart it cannot label', () => {
  const twoPPr = '<a:p><a:pPr algn="l"><a:buNone/></a:pPr><a:r><a:t>2.80</a:t></a:r><a:pPr indent="0"/><a:r><a:t>p</a:t></a:r><a:endParaRPr/></a:p>';
  assert.equal(oneParagraphProperties(twoPPr), '<a:p><a:pPr algn="l"><a:buNone/></a:pPr><a:r><a:t>2.80</a:t></a:r><a:r><a:t>p</a:t></a:r><a:endParaRPr/></a:p>');
  const cell = '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:t>1.20</a:t></a:r><a:endParaRPr sz="900"/></a:p>'
    + '<a:p><a:pPr algn="ctr"/><a:r><a:rPr baseline="30000"/><a:t>p</a:t></a:r><a:endParaRPr sz="900"/></a:p></a:txBody><a:tcPr/></a:tc>';
  assert.equal(oneParagraphPerCell(cell), '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:t>1.20</a:t></a:r>'
    + '<a:r><a:rPr baseline="30000"/><a:t>p</a:t></a:r><a:endParaRPr sz="900"/></a:p></a:txBody><a:tcPr/></a:tc>');
  const single = '<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>x</a:t></a:r></a:p></a:txBody></a:tc>';
  assert.equal(oneParagraphPerCell(single), single);
  assert.equal(uniqueShapeIds('<p:cNvPr id="1" name=""/><p:cNvPr id="2" name="a"/><p:cNvPr id="2" name="t"/>'), '<p:cNvPr id="1" name=""/><p:cNvPr id="2" name="a"/><p:cNvPr id="3" name="t"/>');
  const spec = { objectName: 'pie', font: 'Cambria', sizePt: 9, labelColour: '222222', borderColour: 'BFBFBF', points: [{ text: 'A 50.0%', position: 'bestFit' as const }] };
  const chart = '<c:chartSpace><c:pieChart><c:ser><c:tx/><c:dLbls/><c:cat><c:strRef><c:strCache><c:ptCount val="2"/></c:strCache></c:strRef></c:cat></c:ser></c:pieChart></c:chartSpace>';
  assert.throws(() => rewritePieLabels(chart, spec), /2 categories for 1 labels/);
  assert.match(pieLabelsXml({ ...spec, points: [{ text: 'R&D <1>', position: 'outEnd' }, { text: null, position: 'bestFit' }] }),
    /<a:t>R&amp;D &lt;1&gt;<\/a:t>.*<c:dLblPos val="outEnd"\/>.*<c:dLbl><c:idx val="1"\/><c:delete val="1"\/><\/c:dLbl>/);
});

test('chart parts are numbered from 1 and every reference follows the rename', () => {
  const renames = chartRenames(
    ['ppt/charts/chart4.xml', 'ppt/charts/_rels/chart4.xml.rels', 'ppt/charts/chart3.xml', 'ppt/charts/_rels/chart3.xml.rels', 'ppt/embeddings/Microsoft_Excel_Worksheet3.xlsx', 'ppt/embeddings/Microsoft_Excel_Worksheet4.xlsx'],
    new Map([['ppt/charts/chart3.xml', 'ppt/embeddings/Microsoft_Excel_Worksheet3.xlsx'], ['ppt/charts/chart4.xml', 'ppt/embeddings/Microsoft_Excel_Worksheet4.xlsx']]),
  );
  assert.equal(renames.get('ppt/charts/chart3.xml'), 'ppt/charts/chart1.xml');
  assert.equal(renames.get('ppt/charts/_rels/chart4.xml.rels'), 'ppt/charts/_rels/chart2.xml.rels');
  assert.equal(renames.get('ppt/embeddings/Microsoft_Excel_Worksheet4.xlsx'), 'ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx');
  assert.equal(renameReferences('ppt/slides/_rels/slide1.xml.rels', '<Relationship Id="rId1" Target="/ppt/charts/chart4.xml"/>', renames), '<Relationship Id="rId1" Target="/ppt/charts/chart2.xml"/>');
  assert.equal(renameReferences('ppt/charts/_rels/chart3.xml.rels', '<Relationship Id="rId1" Target="../embeddings/Microsoft_Excel_Worksheet3.xlsx"/>', renames), '<Relationship Id="rId1" Target="../embeddings/Microsoft_Excel_Worksheet1.xlsx"/>');
  assert.equal(renameReferences('[Content_Types].xml', '<Override PartName="/ppt/charts/chart3.xml"/><Override PartName="/ppt/slides/slide1.xml"/>', renames), '<Override PartName="/ppt/charts/chart1.xml"/><Override PartName="/ppt/slides/slide1.xml"/>');
  assert.equal(
    dropMissingOverrides('<Types><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="m"/> <Override PartName="/ppt/slideMasters/slideMaster2.xml" ContentType="m"/></Types>', ['ppt/slideMasters/slideMaster1.xml']),
    '<Types><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="m"/></Types>',
  );
});

/** Labels as an uploaded file could give them: markup characters, a control character, inherited member names. */
function hostileVM(): OverviewVM {
  const parts = standardParts();
  parts.assets[0]!.products[0]!.label = 'R&D <Growth> "Fund" \u0001';
  parts.assets[0]!.products[1]!.label = '__proto__';
  parts.assets[1]!.products[0]!.label = 'constructor';
  parts.liquidity[0]!.label = 'Open & <Ended>';
  parts.familyLabel = 'Family & <Co> \u0007';
  return standardVM(parts);
}

test('hostile labels: escaped, control characters dropped, registry keys kept', async () => {
  const vm = hostileVM();
  const { inv, c08 } = await buildDeck(vm);
  const s = inv.slides[0] as Slide;
  const labels = s.tables[0]!.rows.map((r) => r.cells[0]!.text);
  assert.deepEqual(labels.slice(1, 6), ['Equity', 'R&D <Growth> "Fund" ', '__proto__', 'Debt', 'constructor']);
  const liq = s.charts.find((c) => c.name === 'C-08 liquidity pie')!;
  assert.deepEqual([liq.categories[0], liq.labels[0]!.text], ['Open & <Ended>', 'Open & <Ended> 92.5%']);
  assert.equal(inv.core.title, 'Family & <Co>  Portfolio overview');
  assert.ok(c08.figures.some((f) => f.key === 'alloc.product.Equity.R&D <Growth> "Fund" \u0001.cmv'), 'the key is the view-model\'s');
  assert.ok(c08.figures.some((f) => f.key === 'alloc.product.Equity.__proto__.cmv'));
});

test('the package holds together: every part well formed, typed, and every relationship resolves', async () => {
  for (const deck of [...(await sampleDecks()).map((d) => d.deck), await buildDeck(hostileVM(), LOGO)]) {
    const zip = await loadPptxGenJS().JSZip.loadAsync(deck.bytes);
    const parts = Object.keys(zip.files).filter((k) => !zip.files[k]!.dir);
    assert.ok(!Object.values(zip.files).some((f) => f.dir), 'no folder entries');
    const ct = parseXml(await zip.file('[Content_Types].xml')!.async('string'));
    const defaults = new Set(kids(ct, 'Default').map((d) => (d.attrs.Extension ?? '').toLowerCase()));
    const overrides = kids(ct, 'Override').map((o) => (o.attrs.PartName ?? '').slice(1));
    for (const o of overrides) assert.ok(parts.includes(o), `[Content_Types].xml names ${o}, which does not exist`);
    for (const p of parts) {
      if (p === '[Content_Types].xml') continue;
      assert.ok(overrides.includes(p) || defaults.has(p.slice(p.lastIndexOf('.') + 1).toLowerCase()), `${p} has no content type`);
      if (!/\.(xml|rels)$/.test(p)) continue;
      const doc = parseXml(await zip.file(p)!.async('string'));
      if (!p.endsWith('.rels')) continue;
      const source = p.replace(/_rels\/([^/]*)\.rels$/, '$1');
      const dir = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
      for (const r of kids(doc, 'Relationship')) {
        if (r.attrs.TargetMode === 'External') continue;
        const t = r.attrs.Target ?? '';
        const resolved = t.startsWith('/') ? t.slice(1) : path.posix.normalize(path.posix.join(dir, t));
        assert.ok(parts.includes(resolved), `${p}: ${t} does not resolve`);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Footnote

test('the footnote: the as-on date, the notes of the page\'s figures in the view-model\'s order, the excluded count', async () => {
  const plain = await buildDeck(standardVM());
  assert.equal(shapeNamed(plain.inv.slides[0] as Slide, 'chrome footnote').text, 'Portfolio as on 30 Sep 2026.');

  const parts = standardParts();
  parts.kpi.invested = fig('totals.invested', 2.8, '2.80', { marker: 'p', coverage: 0.825, notes: ['partial'] });
  (parts.assets[1]!.products[0] as { notes?: string[] }).notes = ['debt-note'];
  parts.notes = [
    { id: 'debt-note', text: 'Debt note for the test.' },
    { id: 'unused', text: 'A note no figure on the slide refers to.' },
    { id: 'partial', text: 'Invested value covers 82.50% of the market value.' },
  ];
  parts.excluded = 2;
  const { inv, c08 } = await buildDeck(standardVM(parts));
  assert.equal(
    shapeNamed(inv.slides[0] as Slide, 'chrome footnote').text,
    'Portfolio as on 30 Sep 2026. Debt note for the test. Invested value covers 82.50% of the market value. '
      + '2 holdings without a usable market value are excluded from every total.',
  );
  assert.deepEqual(c08.overflowNotes, []);

  const one = await buildDeck(standardVM({ excluded: 1, asOnText: null }));
  assert.equal(shapeNamed(one.inv.slides[0] as Slide, 'chrome footnote').text, '1 holding without a usable market value is excluded from every total.');

  const none = await buildDeck(standardVM({ asOnText: null }));
  assert.equal((none.inv.slides[0] as Slide).shapes.filter((x) => x.name === 'chrome footnote').length, 0, 'no empty footnote box');
});

test('a footnote over two lines keeps what fits, ends "More notes in the slide notes." and moves the rest to the notes', async () => {
  const parts = standardParts();
  const notes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, text: `Synthetic note ${i + 1} explains a status of a figure on this slide in one plain sentence.` }));
  parts.notes = notes;
  parts.kpi.gain = missing('totals.gain', 'NOT AVAILABLE IN SUPPLIED DATA', notes.map((n) => n.id));
  const { inv, c08 } = await buildDeck(standardVM(parts));
  const s = inv.slides[0] as Slide;
  const foot = shapeNamed(s, 'chrome footnote').text;
  assert.ok(foot.endsWith(MORE_NOTES));
  assert.ok(cambria.lines(foot, 8, false, 931) <= 2, 'two lines at most');
  assert.ok(c08.overflowNotes.length > 0);
  const shown = notes.filter((n) => foot.includes(n.text));
  assert.deepEqual([...shown, ...c08.overflowNotes.map((t) => notes.find((n) => n.text === t)!)], notes, 'every note once, in order');
  assert.equal(s.notes, c08.overflowNotes.join(' '));
});

test('a continuation page footnotes only the notes of its own rows', async () => {
  const vm = manyProductsVM(6, 6);
  const lastProduct = vm.allocation.rows.at(-2)!;
  lastProduct.cmv = fig(lastProduct.cmv.key, 0.1, '0.10', { notes: ['late'] });
  vm.notes = [{ id: 'late', text: 'A note on the last product only.' }];
  const { inv } = await buildDeck(vm);
  const n = inv.slides.length;
  assert.ok(n >= 2);
  assert.ok(!shapeNamed(inv.slides[0] as Slide, 'chrome footnote').text.includes('last product'));
  assert.ok(shapeNamed(inv.slides[n - 1] as Slide, 'chrome footnote').text.includes('A note on the last product only.'));
});
