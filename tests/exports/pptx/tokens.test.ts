// covers: DA-31 E-52
// Palette and type scale (deck-design-system.md §2; tokens.json): every colour written into the slides and charts
// is a token colour (category colours included); every text run has the size of its role's token; Cambria is the
// only typeface on the slides, in the charts and as the theme fonts. Also pins the M1.4 tokens.json contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/pptxgenjs.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import type { Slide } from '../../helpers/slide-inventory.ts';
import { buildDeck, manyProductsVM, pngDataUri, sixSliceVM, standardParts, standardVM, fig, missing } from './sample-vm.ts';

type Tokens = { font: string; colour: Record<string, string>; category: Record<string, string>; liquidity: Record<string, string>; ramp: string[]; type: Record<string, number> };
const tokens = JSON.parse(fs.readFileSync(path.join(REPO, 'app', 'src', 'config', 'tokens.json'), 'utf8')) as Tokens;

test('tokens.json holds the M1.4 contract: the appended colours, the category and liquidity maps, the ramp, the type scale', () => {
  const keys = Object.keys(tokens.colour);
  const appended = ['warmBorder', 'exit', 'new', 'topup', 'commodity', 'reits', 'alternatives', 'cash', 'unknown',
    'ok', 'okBg', 'warn', 'warnBg', 'crit', 'critBg', 'infoBg', 'goldDeep'];
  assert.deepEqual(keys.slice(keys.indexOf('textSub') + 1), appended);
  assert.deepEqual(
    appended.map((k) => tokens.colour[k]),
    ['#E8E0D5', '#FCE8E8', '#E6F4E6', '#DBC8B2', '#808080', '#8C6B43', '#C9A876', '#E5DACB', '#D9D9D9',
      '#2F6B45', '#E6F0E8', '#9A6210', '#FBF1DE', '#A3401F', '#F8E6DE', '#EEF0F2', '#8C6A43'],
  );
  assert.deepEqual(tokens.category, { Equity: 'tan', Hybrid: 'grey75', Debt: 'gold', Commodity: 'commodity', 'REITs/InvITs': 'reits', Alternatives: 'alternatives', Cash: 'cash', Unknown: 'unknown' });
  assert.deepEqual(tokens.liquidity, { 'Open Ended': 'gold', 'Close Ended': 'grey75' });
  assert.deepEqual(tokens.ramp, ['#8C6B43', '#BD9568', '#C9A876', '#DCC4A5', '#BFBFBF', '#D9D9D9', '#E5DACB']);
  assert.deepEqual(tokens.type, { title: 22, panelHeading: 11, tableCaption: 8.5, kpiValue: 13.5, kpiLabel: 7.5, body: 9, table: 9, dense: 8, footnote: 8, legend: 9, chartLabel: 9, sectionBand: 9.5, insightLabel: 8.5, insightText: 9.5 });
  assert.deepEqual(Object.keys(tokens).slice(0, 7), ['_comment', 'font', 'colour', 'category', 'liquidity', 'ramp', 'type']);
});

const allowed = new Set([...Object.values(tokens.colour), ...tokens.ramp].map((c) => c.slice(1).toUpperCase()));

/** The role of each named text box, and so its size token. */
function roleOf(name: string): string {
  if (name === 'chrome title') return 'title';
  if (name === 'chrome footnote' || name === 'chrome preview marker') return 'footnote';
  if (/ kpi \w+ value$/.test(name)) return 'kpiValue';
  if (/ kpi \w+ label$/.test(name)) return 'kpiLabel';
  if (name === 'C-08 section label' || / panel title$/.test(name)) return 'panelHeading';
  if (name === 'C-08 table') return 'table';
  if (/ pie empty$/.test(name)) return 'body';
  throw new Error(`no role for ${name}`);
}

async function decks(): Promise<Slide[]> {
  const parts = standardParts();
  parts.kpi.gain = fig('totals.gain', -0.25, '-0.25');
  parts.kpi.absReturn = missing('totals.absReturnPct', 'NOT APPLICABLE');
  const logo = { dataUri: pngDataUri(400, 100), widthPx: 400, heightPx: 100 };
  const built = await Promise.all([
    buildDeck(standardVM(), logo), buildDeck(standardVM(parts)), buildDeck(sixSliceVM()), buildDeck(manyProductsVM(6, 6)),
    buildDeck(standardVM({ channel: 'release' })),
  ]);
  return built.flatMap((b) => b.inv.slides);
}

test('every colour on the slides and in the charts is a token colour', async () => {
  for (const s of await decks()) {
    const colours = [...s.xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)].map((m) => (m[1] as string).toUpperCase());
    for (const c of s.charts) colours.push(...[...c.xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)].map((m) => (m[1] as string).toUpperCase()));
    const stray = [...new Set(colours.filter((c) => !allowed.has(c)))];
    assert.deepEqual(stray, [], `slide ${s.index}: colours outside tokens.json`);
  }
});

test('every text run has the size of its role\'s token', async () => {
  for (const s of await decks()) {
    for (const sh of s.shapes) {
      if (sh.kind === 'picture' || sh.kind === 'chart' || sh.runs.length === 0) continue;
      const size = tokens.type[roleOf(sh.name)];
      for (const r of sh.runs) assert.equal(r.size, size, `slide ${s.index} ${sh.name} run ${JSON.stringify(r.text)}`);
    }
    for (const c of s.charts) {
      assert.equal(c.legend?.size, tokens.type.legend, `${c.name} legend`);
      assert.equal(c.defaults.size, tokens.type.chartLabel, `${c.name} label defaults`);
      for (const l of c.labels.filter((x) => !x.deleted)) assert.equal(l.size, tokens.type.chartLabel, `${c.name} label ${l.idx}`);
    }
  }
});

test('Cambria everywhere: slide and chart typefaces and the theme fonts', async () => {
  for (const s of await decks()) {
    const faces = [...s.xml.matchAll(/typeface="([^"]*)"/g), ...s.charts.flatMap((c) => [...c.xml.matchAll(/typeface="([^"]*)"/g)])].map((m) => m[1]);
    assert.ok(faces.length > 0);
    assert.deepEqual([...new Set(faces)], ['Cambria'], `slide ${s.index}`);
  }
  const { inv } = await buildDeck(standardVM());
  assert.deepEqual(inv.themeFonts, { major: 'Cambria', minor: 'Cambria' });
  assert.ok(loadPptxGenJS());
});
