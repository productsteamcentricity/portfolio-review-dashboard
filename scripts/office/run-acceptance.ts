// Office acceptance of the exported workbook and deck (local only, never in CI; ARCHITECTURE section 14; T-09, T-10).
//
//   node scripts/office/run-acceptance.ts --spike   [--out app/dist/office]   R1 spike: the in-house writer in Excel
//   node scripts/office/run-acceptance.ts --samples [--out app/dist/office]   the overview workbooks of the U5 samples
//   node scripts/office/run-acceptance.ts --full    [--out app/dist/office]   the overview workbook and deck built
//        through tests/helpers/node-wiring.ts (its acceptanceFiles() export) for the integration fixtures
//   node scripts/office/run-acceptance.ts --check-file <path.xlsx>            evaluator-only check, no Office
//
// For each workbook it writes the file, expected.json (every formula cell's value from tests/helpers/formula-eval.ts,
// the edit case, the frozen panes, each sheet's autoFilter range as the file declares it (Excel's own range must
// equal it: N7, a filter Excel grows over the share row fails), the sample formats, and the screen's text of every
// figure the _manifest places, which Excel's Range.Text must equal: D-039, display rounding agrees with Excel) and a
// negative control (sheetViews moved after sheetData, which Excel must repair), then runs accept-xlsx.ps1 in Windows
// PowerShell 5.1 and collects its report. Decks go through accept-pptx.ps1 with their inventory.json. The combined
// report.json holds synthetic data only. Each result line names whether Office quit or had to be stopped
// (excelKilled, negativeControl.excelKilled; powerpointKilled for decks: N15).
// The PowerShell scripts run under the session's execution policy: where it refuses scripts, the run is reported as
// not run, never as passed. Exit code 0 when every check passed.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeWorkbook } from '../../app/src/exports/xlsx/writer.ts';
import { storeZip } from '../../app/src/exports/zip/store-zip.ts';
import { NUM_FMT_CODES } from '../../app/src/exports/xlsx/styles.ts';
import { evaluateAll, readWorkbookForEval, withEdit, isError, closeTo, type EvalResult } from '../../tests/helpers/formula-eval.ts';
import { readXlsx, kid, sheetTable, type ReadWorkbook } from '../../tests/helpers/xlsx-read.ts';
import { unzip } from '../../tests/helpers/unzip.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const ACCEPT_XLSX = path.join(HERE, 'accept-xlsx.ps1');
const ACCEPT_PPTX = path.join(HERE, 'accept-pptx.ps1');

export type SampleCell = { sheet: string; cell: string };
export type XlsxCase = {
  id: string;
  bytes: Uint8Array;
  /** The input edited for the recalculation check, and by how much. */
  edit: (SampleCell & { delta: number }) | null;
  formats: Array<SampleCell & { numberFormat: string | null }>;
  unitsText: (SampleCell & { text: string }) | null;
  negative: SampleCell | null;
  /** Cells whose shown text (Range.Text) Excel must give, for example a money amount above 1,00,000 in Lakh. */
  texts?: Array<SampleCell & { text: string }>;
  /**
   * The screen's text of each view-model figure by registry key (Figure.display.text, without the marker). Every
   * figure the _manifest places in a cell is compared with the text Excel shows there (D-039: display rounding
   * agrees with Excel).
   */
  figureTexts?: Record<string, string>;
};
export type PptxCase = { id: string; bytes: Uint8Array; inventory: unknown };

// ---------------------------------------------------------------------------------------------------------------
// Evaluator-only checks (also used by --check-file and its test)

export type FileCheck = { name: string; ok: boolean; detail: string[] };

/** Structure and values of a workbook without Office: every formula evaluates to its cached value, no error value. */
export function checkWorkbookBytes(bytes: Uint8Array): { pass: boolean; checks: FileCheck[]; formulas: number } {
  const checks: FileCheck[] = [];
  const add = (name: string, bad: string[], extra: string[] = []): void => { checks.push({ name, ok: bad.length === 0, detail: bad.length ? bad.slice(0, 20) : extra }); };
  let wb: ReadWorkbook;
  try {
    wb = readXlsx(bytes);
  } catch (e) {
    return { pass: false, checks: [{ name: 'reads as a workbook', ok: false, detail: [String((e as Error).message)] }], formulas: 0 };
  }
  const ev = readWorkbookForEval(bytes);
  const values = evaluateAll(ev);
  const valueBad: string[] = [];
  const errorBad: string[] = [];
  for (const [ref, v] of values) {
    const bang = ref.lastIndexOf('!');
    const cell = ev.sheets.get(ref.slice(0, bang).toLowerCase())!.cells.get(ref.slice(bang + 1))!;
    if (isError(v)) { errorBad.push(`${ref} evaluates to ${v.error}`); continue; }
    const cached = cell.cached;
    if (typeof v === 'number' && typeof cached === 'number') {
      if (!closeTo(v, cached)) valueBad.push(`${ref}: evaluated ${v}, cached ${cached}`);
    } else if (v !== cached) valueBad.push(`${ref}: evaluated ${String(v)}, cached ${String(cached)}`);
  }
  for (const s of wb.sheets) for (const c of s.cells.values()) if (c.t === 'e') errorBad.push(`${s.name}!${c.ref} holds ${String(c.v)}`);
  add(`every formula evaluates to its cached value (${values.size} formulas)`, valueBad);
  add('no error value', errorBad);

  const structure: string[] = [];
  const names = [...wb.zip.files.keys()];
  for (const forbidden of [/calcChain\.xml$/, /sharedStrings\.xml$/, /^docProps\//]) {
    for (const n of names) if (forbidden.test(n)) structure.push(`part ${n} present`);
  }
  const calcPr = kid(wb.workbookXml, 'calcPr');
  if (!calcPr || calcPr.attrs.fullCalcOnLoad !== '1') structure.push('calcPr fullCalcOnLoad is not 1');
  const first = wb.sheets[0];
  if (!first || first.state !== 'visible') structure.push('the first sheet is not visible');
  wb.sheets.forEach((s, i) => {
    if (kid(s.root, 'mergeCells')) structure.push(`${s.name}: mergeCells present`);
    const view = kid(kid(s.root, 'sheetViews') ?? s.root, 'sheetView');
    const pane = view ? kid(view, 'pane') : undefined;
    if (!pane || pane.attrs.state !== 'frozen' || Number(pane.attrs.ySplit ?? 0) < 1) structure.push(`${s.name}: header row not frozen`);
    if (!kid(s.root, 'autoFilter')) structure.push(`${s.name}: no autoFilter`);
    if (!wb.definedNames.some((d) => d.name === '_xlnm._FilterDatabase' && d.localSheetId === i && d.hidden)) {
      structure.push(`${s.name}: no hidden _xlnm._FilterDatabase`);
    }
    if (s.name === '_manifest' && (s.state !== 'hidden' || !kid(s.root, 'sheetProtection'))) structure.push('_manifest is not hidden and protected');
  });
  add('structure: parts, calcPr, frozen header, filters, no merges, hidden protected _manifest', structure);
  return { pass: checks.every((c) => c.ok), checks, formulas: values.size };
}

// ---------------------------------------------------------------------------------------------------------------
// Expected values for accept-xlsx.ps1

function parseRef(ref: string): SampleCell {
  const bang = ref.lastIndexOf('!');
  return { sheet: ref.slice(0, bang), cell: ref.slice(bang + 1) };
}

/**
 * The cells whose text Excel must show: the case's own sample texts, then every figure the _manifest places in a cell
 * ("figure <key>" to "<sheet>!<cell>") with its view-model text. A figure of the manifest without a text fails.
 */
export function expectedTexts(c: XlsxCase, wb: ReadWorkbook = readXlsx(c.bytes)): Array<SampleCell & { key: string | null; text: string }> {
  const out: Array<SampleCell & { key: string | null; text: string }> = (c.texts ?? []).map((t) => ({ ...t, key: null }));
  if (!c.figureTexts) return out;
  const manifest = wb.sheets.find((s) => s.name === '_manifest');
  if (!manifest) throw new Error(`${c.id}: no _manifest sheet`);
  for (const [k, v] of sheetTable(manifest)) {
    if (typeof k !== 'string' || !k.startsWith('figure ')) continue;
    const key = k.slice('figure '.length);
    if (!Object.hasOwn(c.figureTexts, key)) throw new Error(`${c.id}: no screen text for the figure ${key}`);
    out.push({ ...parseRef(String(v)), key, text: c.figureTexts[key]! });
  }
  return out;
}

/**
 * Each visible sheet's autoFilter range as the file declares it ("A1:G11"). accept-xlsx.ps1 compares it with Excel's
 * AutoFilter.Range.Address(False, False) after the open, so a filter Excel extends (over the share row of the client
 * and distributor sheets, N7) fails.
 */
export function autoFilterRanges(wb: ReadWorkbook): Array<{ sheet: string; ref: string }> {
  return wb.sheets.flatMap((s) => {
    const f = kid(s.root, 'autoFilter');
    return f && s.state === 'visible' ? [{ sheet: s.name, ref: f.attrs.ref ?? '' }] : [];
  });
}

export function expectedFor(c: XlsxCase): Record<string, unknown> {
  const wb = readXlsx(c.bytes);
  const ev = readWorkbookForEval(c.bytes);
  const values = evaluateAll(ev);
  const num = (v: EvalResult, ref: string): number => {
    if (typeof v !== 'number') throw new Error(`${c.id}: ${ref} evaluates to ${JSON.stringify(v)}, not a number`);
    return v;
  };
  const formulas = [...values].map(([ref, v]) => ({ ...parseRef(ref), value: num(v, ref) }));
  let edit: Record<string, unknown> | null = null;
  if (c.edit) {
    const cell = ev.sheets.get(c.edit.sheet.toLowerCase())?.cells.get(c.edit.cell);
    if (!cell || typeof cell.value !== 'number') throw new Error(`${c.id}: the edit cell ${c.edit.sheet}!${c.edit.cell} is not a number`);
    const value = cell.value + c.edit.delta;
    const after = evaluateAll(withEdit(ev, `${c.edit.sheet}!${c.edit.cell}`, value));
    edit = { sheet: c.edit.sheet, cell: c.edit.cell, value, dependents: [...after].map(([ref, v]) => ({ ...parseRef(ref), value: num(v, ref) })) };
  }
  const freeze = wb.sheets.map((s) => {
    const view = kid(kid(s.root, 'sheetViews')!, 'sheetView');
    const pane = view ? kid(view, 'pane') : undefined;
    return { sheet: s.name, rows: Number(pane?.attrs.ySplit ?? 0), cols: Number(pane?.attrs.xSplit ?? 0) };
  });
  return {
    id: c.id,
    formulas,
    edit,
    freeze,
    filters: autoFilterRanges(wb),
    hidden: wb.sheets.filter((s) => s.state !== 'visible').map((s) => s.name),
    formats: c.formats.map((f) => ({ ...f, font: 'Cambria', size: 9 })),
    unitsText: c.unitsText,
    negative: c.negative ? { ...c.negative, colour: '#931621' } : null,
    texts: expectedTexts(c, wb),
  };
}

/** The negative control: the same workbook with sheetViews moved after sheetData in its second sheet. */
export function negativeControl(bytes: Uint8Array): Uint8Array {
  const z = unzip(bytes);
  const target = z.entries.map((e) => e.name).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[1];
  if (!target) throw new Error('negative control: no second sheet');
  const dec = new TextDecoder();
  return storeZip(z.entries.map((e) => {
    if (e.name !== target) return { name: e.name, data: e.data };
    const xml = dec.decode(e.data);
    const m = /<sheetViews>[\s\S]*?<\/sheetViews>/.exec(xml);
    if (!m) throw new Error('negative control: no sheetViews');
    const moved = xml.replace(m[0], '').replace('</sheetData>', `</sheetData>${m[0]}`);
    return { name: e.name, data: new TextEncoder().encode(moved) };
  }));
}

/** A deck with one slide part removed (PowerPoint must refuse or repair it). */
export function negativeDeck(bytes: Uint8Array): Uint8Array {
  const z = unzip(bytes);
  const drop = z.entries.map((e) => e.name).find((n) => /^ppt\/slides\/slide1\.xml$/.test(n));
  if (!drop) throw new Error('negative deck: no slide1');
  return storeZip(z.entries.filter((e) => e.name !== drop && !e.name.endsWith('/')).map((e) => ({ name: e.name, data: e.data })));
}

// ---------------------------------------------------------------------------------------------------------------
// PowerShell

type PsReport = { pass?: boolean; ran?: boolean; repaired?: boolean; opened?: boolean; notRunReason?: string | null; [k: string]: unknown };

function runPs(script: string, args: string[], reportPath: string): PsReport {
  if (process.platform !== 'win32') return { ran: false, pass: false, notRunReason: 'not Windows' };
  fs.rmSync(reportPath, { force: true });
  // Up to 180 s of checks under the script's watchdog, then up to 75 s for Office to quit: 480 s leaves room.
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, ...args, '-Report', reportPath],
    { encoding: 'utf8', timeout: 480_000, windowsHide: true });
  if (!fs.existsSync(reportPath)) {
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const policy = /running scripts is disabled|cannot be loaded|execution polic/i.test(out);
    return { ran: false, pass: false, notRunReason: policy ? 'the execution policy refuses scripts in this session' : `no report (exit ${r.status}): ${out.slice(0, 400)}` };
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '')) as PsReport;
}

export function acceptXlsx(c: XlsxCase, outDir: string): Record<string, unknown> {
  const file = path.join(outDir, `${c.id}.xlsx`);
  const exp = path.join(outDir, `${c.id}.expected.json`);
  fs.writeFileSync(file, c.bytes);
  fs.writeFileSync(exp, JSON.stringify(expectedFor(c), null, 1));
  const node = checkWorkbookBytes(c.bytes);
  const main = runPs(ACCEPT_XLSX, ['-Path', file, '-Expected', exp], path.join(outDir, `${c.id}.xlsx.report.json`));

  const negFile = path.join(outDir, `${c.id}.negative.xlsx`);
  fs.writeFileSync(negFile, negativeControl(c.bytes));
  const negExp = path.join(outDir, `${c.id}.negative.expected.json`);
  fs.writeFileSync(negExp, JSON.stringify({ formulas: [], edit: null, freeze: [], filters: [], hidden: [], formats: [], unitsText: null, negative: null, texts: [] }));
  const neg = runPs(ACCEPT_XLSX, ['-Path', negFile, '-Expected', negExp], path.join(outDir, `${c.id}.negative.xlsx.report.json`));
  const negativeDetected = neg.ran === true && (neg.repaired === true || neg.opened === false);
  return {
    id: c.id, bytes: c.bytes.length, nodeChecks: node, excel: main,
    negativeControl: { detected: negativeDetected, ran: neg.ran, repaired: neg.repaired, opened: neg.opened, evidence: neg.repairEvidence, notRunReason: neg.notRunReason, excelQuit: neg.excelQuit, excelKilled: neg.excelKilled, quitSeconds: neg.quitSeconds, notKilled: neg.notKilled },
    verdict: main.ran !== true || neg.ran !== true ? 'not run' : main.pass === true && negativeDetected && node.pass ? 'pass' : 'fail',
  };
}

/**
 * The console line of one result: the verdict, the case, and whether Office quit by itself or was stopped as a last
 * resort, for the main file and for its negative control (N15: "negativeControl.excelKilled=false").
 */
export function summaryLine(r: Record<string, unknown>): string {
  const head = `${String(r.verdict).toUpperCase().padEnd(8)} ${String(r.id)}`;
  const neg = (r.negativeControl ?? {}) as Record<string, unknown>;
  const flag = (v: unknown): string => (v === true ? 'true' : v === false ? 'false' : 'not run');
  if (r.excel !== undefined) {
    const main = r.excel as Record<string, unknown>;
    return `${head}  excelKilled=${flag(main.excelKilled)} negativeControl.excelKilled=${flag(neg.excelKilled)}`;
  }
  const main = (r.powerpoint ?? {}) as Record<string, unknown>;
  return `${head}  powerpointKilled=${flag(main.powerpointKilled)} negativeControl.powerpointKilled=${flag(neg.powerpointKilled)}`;
}

export function acceptPptx(c: PptxCase, outDir: string): Record<string, unknown> {
  const file = path.join(outDir, `${c.id}.pptx`);
  const inv = path.join(outDir, `${c.id}.inventory.json`);
  fs.writeFileSync(file, c.bytes);
  fs.writeFileSync(inv, JSON.stringify(c.inventory, null, 1));
  const png = path.join(outDir, 'png', c.id);
  fs.mkdirSync(png, { recursive: true });
  const main = runPs(ACCEPT_PPTX, ['-Path', file, '-Inventory', inv, '-PngDir', png], path.join(outDir, `${c.id}.pptx.report.json`));
  const negFile = path.join(outDir, `${c.id}.negative.pptx`);
  fs.writeFileSync(negFile, negativeDeck(c.bytes));
  const neg = runPs(ACCEPT_PPTX, ['-Path', negFile, '-Inventory', inv, '-PngDir', ''], path.join(outDir, `${c.id}.negative.pptx.report.json`));
  const negativeDetected = neg.ran === true && neg.pass !== true;
  return {
    id: c.id, bytes: c.bytes.length, powerpoint: main, negativeControl: { detected: negativeDetected, ran: neg.ran, notRunReason: neg.notRunReason, quit: neg.quit, powerpointKilled: neg.powerpointKilled, notKilled: neg.notKilled },
    verdict: main.ran !== true || neg.ran !== true ? 'not run' : main.pass === true && negativeDetected ? 'pass' : 'fail',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Cases

async function spikeCases(): Promise<XlsxCase[]> {
  const { spikeWorkbookSpec } = await import(pathToFileURL(path.join(REPO, 'tests/exports/xlsx/sample-input.ts')).href);
  const bytes = writeWorkbook(spikeWorkbookSpec());
  const H = 'Holdings (as loaded)';
  return [{
    id: 'r1-spike', bytes,
    edit: { sheet: H, cell: 'G2', delta: 1 },
    formats: [
      { sheet: H, cell: 'A2', numberFormat: 'General' },
      { sheet: H, cell: 'F2', numberFormat: NUM_FMT_CODES.money },
      { sheet: 'Portfolio Overview', cell: 'F2', numberFormat: NUM_FMT_CODES.pct },
      { sheet: H, cell: 'I2', numberFormat: 'd mmm yyyy' },
    ],
    unitsText: { sheet: H, cell: 'E4', text: '1,50,000.000' },
    negative: { sheet: H, cell: 'H8' },
  }];
}

async function sampleCases(): Promise<XlsxCase[]> {
  const mod = await import(pathToFileURL(path.join(REPO, 'tests/exports/xlsx/sample-input.ts')).href);
  if (typeof mod.officeSampleCases !== 'function') throw new Error('sample-input.ts has no officeSampleCases()');
  return mod.officeSampleCases() as XlsxCase[];
}

async function fullCases(): Promise<{ xlsx: XlsxCase[]; pptx: PptxCase[] }> {
  const wiring = path.join(REPO, 'tests/helpers/node-wiring.ts');
  if (!fs.existsSync(wiring)) throw new Error('--full needs tests/helpers/node-wiring.ts (written by the integration agent)');
  const mod = await import(pathToFileURL(wiring).href);
  if (typeof mod.acceptanceFiles !== 'function') throw new Error('tests/helpers/node-wiring.ts must export acceptanceFiles()');
  return await mod.acceptanceFiles() as { xlsx: XlsxCase[]; pptx: PptxCase[] };
}

function argValue(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const checkFile = argValue(args, '--check-file');
  if (checkFile) {
    const res = checkWorkbookBytes(new Uint8Array(fs.readFileSync(checkFile)));
    for (const c of res.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail.length && !c.ok ? `\n      ${c.detail.join('\n      ')}` : ''}`);
    console.log(res.pass ? `check-file: pass (${res.formulas} formulas)` : 'check-file: FAIL');
    return res.pass ? 0 : 1;
  }
  const outDir = path.resolve(REPO, argValue(args, '--out') ?? 'app/dist/office');
  fs.mkdirSync(outDir, { recursive: true });
  let xlsx: XlsxCase[] = [];
  let pptx: PptxCase[] = [];
  let mode = '';
  if (args.includes('--spike')) { mode = 'spike'; xlsx = await spikeCases(); }
  else if (args.includes('--samples')) { mode = 'samples'; xlsx = await sampleCases(); }
  else if (args.includes('--full')) { mode = 'full'; ({ xlsx, pptx } = await fullCases()); }
  else {
    console.error('usage: node scripts/office/run-acceptance.ts --spike | --samples | --full [--out dir] | --check-file <xlsx>');
    return 2;
  }
  const results = [...xlsx.map((c) => acceptXlsx(c, outDir)), ...pptx.map((c) => acceptPptx(c, outDir))];
  const verdicts = results.map((r) => r.verdict);
  const verdict = verdicts.every((v) => v === 'pass') ? 'pass' : verdicts.some((v) => v === 'fail') ? 'fail' : 'not run';
  const report = { mode, verdict, node: process.version, results };
  fs.writeFileSync(path.join(outDir, `report-${mode}.json`), JSON.stringify(report, null, 1));
  for (const r of results) console.log(summaryLine(r));
  const killed = (pick: (r: Record<string, unknown>) => unknown): number => results.filter((r) => pick(r) === true).length;
  const books = results.filter((r) => r.excel !== undefined);
  console.log(`Excel stopped as a last resort: ${killed((r) => (r.excel as Record<string, unknown> | undefined)?.excelKilled)} of ${books.length} workbooks, `
    + `${killed((r) => (r.excel !== undefined ? (r.negativeControl as Record<string, unknown>).excelKilled : undefined))} of ${books.length} negative controls`);
  console.log(`${mode}: ${verdict}; report ${path.relative(REPO, path.join(outDir, `report-${mode}.json`))}`);
  return verdict === 'pass' ? 0 : 1;
}

if (import.meta.main) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
