// covers: W-1 BR-3.1 BR-3.2 U-03 U-04 U-05 U-07 U-60 E-01 KI-001 KI-020 KI-087 OD-8 M1.4
// Workflow W-1 (the analyst's first steps with a family), end to end through the real store and the page's wiring in
// Node (tests/helpers/node-wiring.ts), with the view-models section 1 and section 2 render: open the page, upload
// the base file of family-a, read the import report (the load message) and the source register at the Validate and
// Preview stages, set the as-on date, choose the logo, accept, read the overview, download the slide and the
// workbook, then load a variant whose excluded holdings make the unmatched-style list, and remove the file. In M1.4
// no holding is matched (matching arrives in M2), so the list is of holdings left out of every total (OD-8).
//
// Known answers come from the fixture's own cells, read in this test with SheetJS sheet_to_json (never from app
// code): family-a is tools/make-sample-base.js's synthetic book (13 holdings, 2 clients, 2 distributors, Equity, Debt
// and Hybrid, money in rupee and Crore columns); family-a-na-cmv has "NA" and a blank in the market value of its
// second and fourth holdings (Excel rows 3 and 5). Kinds, figures and fixed constants only, never the UI sentences.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import brand from '../../app/src/config/brand-logos.json' with { type: 'json' };
import type { LogoAsset } from '../../app/src/ui/wiring.ts';
import type { AppState } from '../../app/src/ui/store.ts';
import { createStore, reviewBar } from '../../app/src/ui/store.ts';
import { ASSET_ORDER } from '../../app/src/model/review.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { parseDayText } from '../../app/src/engine/dates.ts';
import { buildImportReport, MATCHING_LINE } from '../../app/src/views/import-report.ts';
import { buildSourceRegister, ROLE_TEXT } from '../../app/src/views/source-register.ts';
import { buildValidationPanel } from '../../app/src/views/validation-panel.ts';
import { builtInLogos, decodeBase64, logoFromBytes } from '../../app/src/views/logo.ts';
import { DEFAULT_FAMILY_LABEL } from '../../app/src/views/labels.ts';
import { fixtureById, nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { slideInventory } from '../helpers/slide-inventory.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { pngDataUri } from '../exports/pptx/sample-vm.ts';

const xlsx = loadSheetJS();
const { JSZip } = loadPptxGenJS();
const AS_ON = { iso: '2026-09-30', day: 20726, text: '30 Sep 2026' } as const;
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

type FileRow = Record<string, unknown>;

/** The holdings sheet of a fixture as the analyst's file holds it, one object per row below the header. */
function fileRows(bytes: Uint8Array): FileRow[] {
  const wb = xlsx.read(bytes, { type: 'array' }) as unknown as { Sheets: Record<string, unknown> };
  return xlsx.utils.sheet_to_json(wb.Sheets['Base File'], { defval: null }) as FileRow[];
}
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sumOf = (rows: FileRow[], col: string): number => rows.reduce((s, r) => s + (num(r[col]) ?? 0), 0);
const distinct = (rows: FileRow[], col: string): string[] => [...new Set(rows.map((r) => String(r[col] ?? '').trim()))];

/** The logo to choose: the first built-in logo, or a synthetic PNG when the build ships none (D-039 point 10). */
function logoToChoose(): { logos: LogoAsset[]; logo: LogoAsset } {
  const logos = builtInLogos(brand.logos);
  if (logos.length > 0) return { logos, logo: logos[0]! };
  const png = decodeBase64(pngDataUri(120, 40).split(',')[1]!)!;
  const made = logoFromBytes(png, 'image/png', 'uploaded', 'Uploaded logo');
  assert.ok(!('error' in made));
  return { logos: [], logo: made };
}

describe('W-1: open the page, upload the base file, set the date and logo, read the load message and the list', () => {
  const w = nodeWiring();
  const prefs = memoryPrefs();
  const { logos, logo } = logoToChoose();
  const store = createStore({ wiring: w, prefs: prefs.prefs, logos });
  const family = fixtureById('family-a');
  const rows = fileRows(family.bytes);
  const stages: Array<AppState['upload']['stage']> = [];
  store.subscribe(() => {
    const st = store.get().upload.stage;
    if (stages[stages.length - 1] !== st) stages.push(st);
  });

  test('open the page: no file, no review, no date, no logo kept yet; exports are refused', async () => {
    const s = store.get();
    assert.deepEqual([s.upload.stage, s.upload.fileName, s.upload.loaded, s.review, s.vm, s.asOn, s.logo], [null, null, null, null, null, null, null]);
    assert.equal(s.labels.family, DEFAULT_FAMILY_LABEL);
    assert.deepEqual(reviewBar(s), { logo: null, familyLabel: DEFAULT_FAMILY_LABEL, asOnText: null, fileName: null });
    await assert.rejects(store.exportDeck());
    await assert.rejects(store.exportWorkbook());
    assert.equal(w.last.pptx, null);
  });

  test('upload family-a: Upload, then Validate with its import report and source register; no review before Accept', () => {
    store.dispatch({ type: 'file-picked', fileName: 'family-a.xlsx', bytes: family.bytes });
    assert.deepEqual(stages, ['upload', 'validate']);
    const s = store.get();
    assert.equal(s.review, null);
    const loaded = s.upload.loaded!;
    assert.ok(loaded, 'the file is read');
    assert.equal(loaded.base.moneyUnit, 'crore');

    // The load message: what was read, from where, with the counts the file itself gives.
    const report = buildImportReport(loaded.source, loaded.base);
    const holdings = rows.filter((r) => String(r['Instrument Name'] ?? '').trim() !== '').length;
    assert.equal(holdings, 13);
    assert.deepEqual([report.fileName, report.bytes, report.sha256], ['family-a.xlsx', family.bytes.length, sha(family.bytes)]);
    assert.deepEqual(report.sheet, { name: 'Base File', headerRow: 1 });
    const count = Object.fromEntries(report.counts.map((c) => [c.id, c.value]));
    assert.deepEqual(
      [count['data-rows'], count['holding-rows'], count['merged-rows'], count['holdings'], count['included'], count['excluded']],
      [holdings, holdings, 0, holdings, holdings, 0]);
    assert.deepEqual([report.excluded, report.skipped, report.questions], [[], [], []]);
    assert.equal(report.matching, MATCHING_LINE, 'the report says matching arrives in M2');

    // The source register: the base file, its SHA-256 in full, client data (class N).
    const register = buildSourceRegister([loaded.source]);
    assert.equal(register.rows.length, 1);
    const row = register.rows[0]!;
    assert.deepEqual([row.role, row.fileName, row.sha256, row.publicationClass], [ROLE_TEXT['base-file'], 'family-a.xlsx', sha(family.bytes), 'N']);
    assert.equal(loaded.source.asOn.kind, 'missing', 'a base file carries no date: the analyst sets it');

    const panel = buildValidationPanel(loaded.base.issues);
    assert.deepEqual([panel.blockingOpen, panel.highOpen], [0, 0]);
  });

  test('set the as-on date and choose the logo: the review bar follows at once, before Accept (KI-020)', () => {
    store.dispatch({ type: 'as-on', day: parseDayText(AS_ON.iso) });
    store.dispatch({ type: 'logo', logo });
    const s = store.get();
    assert.equal(s.upload.stage, 'validate', 'still waiting for Accept');
    assert.equal(s.asOn, AS_ON.day);
    const bar = reviewBar(s);
    assert.equal(bar.logo, logo);
    assert.deepEqual([bar.familyLabel, bar.asOnText, bar.fileName], [DEFAULT_FAMILY_LABEL, AS_ON.text, 'family-a.xlsx']);
    assert.equal(prefs.prefs.read('logo'), logos.length > 0 ? logo.id : logo.dataUri, 'the choice is kept in this browser');
  });

  test('Accept: the Review stage, and section 2 shows the overview of family-a as its Crore column gives it', () => {
    store.dispatch({ type: 'accept' });
    assert.deepEqual(stages, ['upload', 'validate', 'review']);
    const s = store.get();
    const review = s.review!;
    const vm = s.vm!;
    assert.deepEqual(review.gate, { blocking: 0, highOpen: 0, canExport: true, reasons: [] });
    assert.equal(review.sources[0]!.id, sha(family.bytes));

    const cmvSum = sumOf(rows, 'Current Market Value (Cr.)');
    const invSum = sumOf(rows, 'Invested Value (Cr.)');
    const fig = Object.fromEntries(vm.kpis.map((k) => [k.id, k.figure.value]));
    assert.deepEqual(vm.kpis.map((k) => k.id), ['invested', 'cmv', 'gain', 'absReturn', 'holdings', 'clients']);
    const v = (id: string): number => { const x = fig[id]!; assert.equal(x.kind, 'value', id); return (x as { v: number }).v; };
    assert.ok(close(v('cmv'), cmvSum), `CMV ${v('cmv')} against the file's ${cmvSum}`);
    assert.ok(close(v('invested'), invSum), `invested ${v('invested')} against the file's ${invSum}`);
    assert.ok(close(v('gain'), cmvSum - invSum), 'gain is CMV minus invested (OD-18)');
    assert.equal(v('holdings'), 13);
    assert.equal(v('clients'), distinct(rows, 'Client Name').length);

    const classes = ASSET_ORDER.filter((a) => distinct(rows, 'Asset Name').includes(a));
    assert.deepEqual(classes, ['Equity', 'Debt', 'Hybrid']);
    assert.deepEqual(vm.allocation.rows.filter((r) => r.kind === 'asset').map((r) => r.label), classes);
    assert.equal(vm.allocation.rows[vm.allocation.rows.length - 1]!.kind, 'total');
    assert.deepEqual(vm.charts.asset.slices.map((x) => x.category), classes);
    assert.deepEqual([vm.matrices.client.shown, vm.matrices.client.columns.length], [true, distinct(rows, 'Client Name').length]);
    assert.deepEqual([vm.matrices.distributor.shown, vm.matrices.distributor.columns.length], [true, distinct(rows, 'Distributor Name').length]);
    assert.deepEqual([vm.meta.unit, vm.meta.unitHeader, vm.meta.asOnText, vm.meta.familyLabel], ['crore', '(Cr.)', AS_ON.text, DEFAULT_FAMILY_LABEL]);
    assert.equal(reviewBar(s).logo, logo);
  });

  test('download the slide and the workbook: the chosen logo is on every slide; each download is logged', async () => {
    await store.exportDeck();
    const deck = w.last.pptx!;
    assert.equal(deck.fileName, `Family_Asset_Allocation_${AS_ON.iso}_PREVIEW.pptx`);
    const inv = await slideInventory(deck.bytes, JSZip);
    assert.ok(inv.slides.length >= 1);
    for (const slide of inv.slides) {
      const pics = slide.shapes.filter((x) => x.kind === 'picture');
      assert.deepEqual(pics.map((p) => p.name), ['chrome logo'], `slide ${slide.index} carries the logo once`);
    }
    const media = inv.parts.filter((p) => p.startsWith('ppt/media/'));
    assert.equal(media.length, 1, 'one image part, the logo');
    const zip = await JSZip.loadAsync(deck.bytes);
    const embedded = await zip.file(media[0]!)!.async('uint8array');
    assert.deepEqual(Buffer.from(embedded), Buffer.from(decodeBase64(logo.dataUri.split(',')[1]!)!), 'the image is the chosen logo, byte for byte');

    await store.exportWorkbook();
    const book = w.last.xlsx!;
    assert.equal(book.fileName, `Family_Portfolio_Overview_${AS_ON.iso}_PREVIEW.xlsx`);
    const readMe = sheetTable(sheetByName(readXlsx(book.bytes), 'Read Me and Controls'));
    assert.equal(readMe.find((r) => r[0] === 'Base file SHA-256')?.[1], sha(family.bytes));
    const log = store.get().exportLog;
    assert.deepEqual(log.map((e) => [e.kind, e.detail['kind'], e.detail['sha256']]), [
      ['export', 'pptx', sha(deck.bytes)],
      ['export', 'xlsx', sha(book.bytes)],
    ]);
  });

  test('the list of holdings left out: listed with their rows, kept out of every total; matching arrives in M2 (OD-8)', () => {
    const variant = fixtureById('family-a-na-cmv');
    const vrows = fileRows(variant.bytes);
    store.dispatch({ type: 'file-picked', fileName: 'family-a-na-cmv.xlsx', bytes: variant.bytes });
    let s = store.get();
    assert.deepEqual([s.review, s.asOn], [null, null], 'a new family: nothing of the last one but the logo (KI-001)');
    assert.equal(s.logo, logo);
    const loaded = s.upload.loaded!;
    const report = buildImportReport(loaded.source, loaded.base);
    const left = [1, 3].map((i) => String(vrows[i]!['Instrument Name']).trim());
    assert.equal(num(vrows[1]!['Current Market Value (Cr.)']), null, 'row 3 holds no number');
    assert.equal(num(vrows[3]!['Current Market Value (Cr.)']), null, 'row 5 holds no number');
    assert.deepEqual(report.excluded.map((e) => [e.name, e.rows]), [[left[0], [3]], [left[1], [5]]]);
    const count = Object.fromEntries(report.counts.map((c) => [c.id, c.value]));
    assert.deepEqual([count['holdings'], count['included'], count['excluded']], [13, 11, 2]);
    assert.equal(report.matching, MATCHING_LINE);
    const excluded = loaded.base.holdings.filter((h) => h.inclusion.status === 'excluded');
    assert.deepEqual(excluded.map((h) => (h.cmv.kind === 'missing' ? h.cmv.status : 'value')), [STATUS.NOT_AVAILABLE, STATUS.NOT_AVAILABLE]);
    const panel = buildValidationPanel(loaded.base.issues);
    const warnings = panel.groups.find((g) => g.severity === 'Warning')!.items.map((i) => i.ruleId);
    assert.ok(warnings.includes('base-file.no-market-value'), warnings.join(', '));

    store.dispatch({ type: 'as-on', day: AS_ON.day });
    store.dispatch({ type: 'accept' });
    s = store.get();
    assert.deepEqual([s.vm!.excluded.count, s.vm!.excluded.names], [2, left]);
    const cmv = s.vm!.kpis.find((k) => k.id === 'cmv')!.figure.value;
    assert.ok(cmv.kind === 'value' && close(cmv.v, sumOf(vrows, 'Current Market Value (Cr.)')), 'the total leaves both out');
    const held = s.vm!.kpis.find((k) => k.id === 'holdings')!.figure.value;
    assert.deepEqual([held.kind, held.kind === 'value' ? held.v : null], ['value', 11]);
    assert.equal(s.review!.gate.canExport, true, 'a Warning never blocks');
  });

  test('Remove: back to an empty slot; the logo stays, here and when the page is opened again', () => {
    store.dispatch({ type: 'remove' });
    const s = store.get();
    assert.deepEqual([s.upload.stage, s.upload.fileName, s.upload.loaded, s.review, s.vm, s.asOn], [null, null, null, null, null, null]);
    assert.equal(s.logo, logo);
    const reopened = createStore({ wiring: nodeWiring(), prefs: prefs.prefs, logos });
    const restored = reopened.get().logo;
    assert.ok(restored, 'the logo is restored from the browser');
    assert.equal(restored.dataUri, logo.dataUri);
    assert.deepEqual([restored.widthPx, restored.heightPx], [logo.widthPx, logo.heightPx]);
  });
});
