// Office acceptance of the exported workbook and deck (local only, never in CI; ARCHITECTURE section 14; T-09, T-10).
//
//   node scripts/office/run-acceptance.ts --spike   [--out app/dist/office]   R1 spike: the in-house writer in Excel
//   node scripts/office/run-acceptance.ts --samples [--out app/dist/office]   the overview workbooks of the U5 samples
//   node scripts/office/run-acceptance.ts --full    [--out app/dist/office]   the overview workbook and deck built
//        through tests/helpers/node-wiring.ts (its acceptanceFiles() export) for the integration fixtures
//   node scripts/office/run-acceptance.ts --check-file <path.xlsx>            evaluator-only check, no Office
//
// For each workbook it writes the file, expected.json (every formula cell's value from tests/helpers/formula-eval.ts,
// the edit case (checked in Excel only while its calculation is manual), the frozen panes (written for the record;
// Excel does not check them, since its window stays hidden), each sheet's autoFilter range as the file declares it
// (Excel's own range must equal it: N7, a filter Excel grows over the share row fails), the sample formats, and the
// screen's text of every figure the _manifest places, which Excel's Range.Text must equal: D-039, display rounding
// agrees with Excel), then runs accept-xlsx.ps1 in Windows PowerShell 5.1 and collects its report. Decks go through
// accept-pptx.ps1 with their inventory.json. The combined report.json holds synthetic data only.
//
// THE OWNER'S RULE (standing rule of 2 Nov 2026; docs/TESTING.md section 6.1; the scripts' headers): the scripts
// attach only to an Excel or PowerPoint the owner already runs (task list first, then GetActiveObject), open only
// their own synthetic file read-only without a window (Excel: only that workbook's window is hidden), change no
// application option, recalculate only their own workbook, close only the file they opened, and never quit, start,
// stop or kill Office. So:
//  - a case whose Office is not running (or cannot be attached to) is NOT RUN, never passed; the run then prints the
//    absolute paths of the synthetic files for the owner to open by hand;
//  - the damaged-file negative controls (sheetViews moved after sheetData; a deck without slide 1) would raise a
//    repair prompt on the owner's screen, so they are written but never run: each is reported NOT RUN with its path;
//  - a script that does not answer within PS_TIMEOUT_MS is abandoned: the run stops waiting, reports TIMEOUT with the
//    path of the file left open for the owner to close, and leaves every process running (no kill, of Office or of
//    the PowerShell process);
//  - after the first TIMEOUT of an application (the run's or the script's own deadline), no further case of that
//    application starts: each remaining one is NOT RUN ("not attempted: Office did not answer") with its file's path,
//    so no second script is ever sent to an Excel or PowerPoint that has not answered. The one abandoned script may
//    still resume after the run has reported; it then meets its own deadline at its next check and closes its file.
// The overall verdict is PASS only when every case ran and passed; FAIL when a case failed or timed out; NOT RUN
// otherwise. The PowerShell scripts run under the session's execution policy: where it refuses scripts, the run is
// NOT RUN. Exit code 0 PASS, 1 FAIL, 2 NOT RUN (64 for a usage error).

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

export type Verdict = 'pass' | 'fail' | 'not run' | 'timeout';
type PsReport = {
  verdict?: Verdict; pass?: boolean; ran?: boolean; repaired?: boolean; opened?: boolean; closed?: boolean;
  notRunReason?: string | null; leftOpenForOwner?: string | null; [k: string]: unknown;
};

/**
 * How long the run waits for one script: the script's own deadline is 180 s between checks, so 300 s leaves room.
 * After it the run stops waiting (TIMEOUT) and kills nothing.
 */
export const PS_TIMEOUT_MS = 300_000;

/** Why the damaged-file controls are never run (the owner's rule of 2 Nov 2026). */
export const NEGATIVE_NOT_RUN = 'the damaged-file control would raise a repair prompt on the owner\'s screen, so it never runs against an attached Office (owner\'s rule, 2 Nov 2026); the owner may open it by hand';

/** Why a case after a TIMEOUT of its application is not started (F1). */
export const NOT_ATTEMPTED = 'not attempted: Office did not answer';

/** The report of a case that is not started because its Office did not answer an earlier case: NOT RUN, its path. */
export function notAttempted(file: string): PsReport {
  return { verdict: 'not run', ran: false, pass: false, notRunReason: NOT_ATTEMPTED, file };
}

/** Whether a case's Office did not answer: the script timed out (at its own deadline or the run's). */
export function officeTimedOut(r: Record<string, unknown>): boolean {
  const main = (r.excel ?? r.powerpoint) as PsReport | undefined;
  return main?.verdict === 'timeout';
}

/**
 * Runs the cases of one application one after another (F1). After the first case whose Office timed out, no further
 * case is started: each remaining one is passed attempt false, so it is reported NOT RUN (NOT_ATTEMPTED) with its
 * path and no script is sent to the Office that has not answered.
 */
export async function runInTurn<C>(cases: readonly C[], run: (c: C, attempt: boolean) => Promise<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let answered = true;
  for (const c of cases) {
    const r = await run(c, answered);
    out.push(r);
    if (answered && officeTimedOut(r)) answered = false;
  }
  return out;
}

/**
 * Runs one script and reads its report. The script's output goes to a log file next to the report. The child is
 * detached, so that a run abandoned at PS_TIMEOUT_MS leaves it running (Node never kills it, and its exit does not
 * end it): the result is then TIMEOUT, with the file left open for the owner.
 */
async function runPs(script: string, args: string[], reportPath: string, file: string): Promise<PsReport> {
  if (process.platform !== 'win32') return { verdict: 'not run', ran: false, pass: false, notRunReason: 'not Windows' };
  fs.rmSync(reportPath, { force: true });
  const logPath = reportPath.replace(/\.json$/, '.log');
  const fd = fs.openSync(logPath, 'w');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, ...args, '-Report', reportPath],
    { stdio: ['ignore', fd, fd], windowsHide: true, detached: true });
  fs.closeSync(fd);
  const status = await new Promise<number | null | 'timeout'>((resolve) => {
    const timer = setTimeout(() => { child.unref(); resolve('timeout'); }, PS_TIMEOUT_MS);
    child.on('exit', (code) => { clearTimeout(timer); resolve(code); });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
  });
  if (status === 'timeout') {
    return {
      verdict: 'timeout', ran: true, pass: false, closed: false, leftOpenForOwner: file, abandonedPid: child.pid ?? null,
      notRunReason: `no answer within ${PS_TIMEOUT_MS / 1000} s: the run stopped waiting and killed nothing; the owner closes ${file}`,
    };
  }
  if (!fs.existsSync(reportPath)) {
    const out = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    const policy = /running scripts is disabled|cannot be loaded|execution polic/i.test(out);
    return { verdict: 'not run', ran: false, pass: false, notRunReason: policy ? 'the execution policy refuses scripts in this session' : `no report (exit ${status}): ${out.slice(0, 400)}` };
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '')) as PsReport;
}

/** One case's verdict: the Node checks first, then the script's own verdict (NOT RUN is never a pass). */
export function caseVerdict(main: PsReport, nodePass = true): Verdict {
  if (!nodePass) return 'fail';
  if (main.verdict === 'timeout') return 'timeout';
  if (main.ran !== true) return 'not run';
  return main.pass === true && main.verdict !== 'fail' ? 'pass' : 'fail';
}

/** The run's verdict: PASS only when every case ran and passed; FAIL when one failed or timed out; else NOT RUN. */
export function overallVerdict(verdicts: readonly string[]): 'pass' | 'fail' | 'not run' {
  if (verdicts.some((v) => v === 'fail' || v === 'timeout')) return 'fail';
  if (verdicts.length > 0 && verdicts.every((v) => v === 'pass')) return 'pass';
  return 'not run';
}

/** One workbook: the files are always written; the script runs only when attempt is true (F1: false after a TIMEOUT). */
export async function acceptXlsx(c: XlsxCase, outDir: string, attempt = true): Promise<Record<string, unknown>> {
  const file = path.join(outDir, `${c.id}.xlsx`);
  const exp = path.join(outDir, `${c.id}.expected.json`);
  fs.writeFileSync(file, c.bytes);
  fs.writeFileSync(exp, JSON.stringify(expectedFor(c), null, 1));
  const node = checkWorkbookBytes(c.bytes);
  const main = attempt
    ? await runPs(ACCEPT_XLSX, ['-Path', file, '-Expected', exp], path.join(outDir, `${c.id}.xlsx.report.json`), file)
    : notAttempted(file);
  // The negative control is written for the owner, never run against an attached Excel.
  const negFile = path.join(outDir, `${c.id}.negative.xlsx`);
  fs.writeFileSync(negFile, negativeControl(c.bytes));
  return {
    id: c.id, file, bytes: c.bytes.length, nodeChecks: node, excel: main,
    negativeControl: { verdict: 'not run', file: negFile, reason: NEGATIVE_NOT_RUN },
    verdict: caseVerdict(main, node.pass),
  };
}

/**
 * The console line of one result: the verdict, the case, whether the script closed its own file, the file left open
 * for the owner after a TIMEOUT, and, for a case not started after a TIMEOUT (F1), that reason and its file. The
 * negative control is always "not run" (the owner's rule).
 */
export function summaryLine(r: Record<string, unknown>): string {
  const head = `${String(r.verdict).toUpperCase().padEnd(8)} ${String(r.id)}`;
  const main = ((r.excel ?? r.powerpoint) ?? {}) as Record<string, unknown>;
  const flag = (v: unknown): string => (v === true ? 'true' : v === false ? 'false' : 'not run');
  const left = typeof main.leftOpenForOwner === 'string' ? `  left open for the owner: ${main.leftOpenForOwner}` : '';
  const skipped = main.notRunReason === NOT_ATTEMPTED ? `  ${NOT_ATTEMPTED}; open by hand: ${String(main.file ?? r.file)}` : '';
  return `${head}  closed=${flag(main.closed)} negativeControl=not run${left}${skipped}`;
}

/** One deck: the files are always written; the script runs only when attempt is true (F1: false after a TIMEOUT). */
export async function acceptPptx(c: PptxCase, outDir: string, attempt = true): Promise<Record<string, unknown>> {
  const file = path.join(outDir, `${c.id}.pptx`);
  const inv = path.join(outDir, `${c.id}.inventory.json`);
  fs.writeFileSync(file, c.bytes);
  fs.writeFileSync(inv, JSON.stringify(c.inventory, null, 1));
  const png = path.join(outDir, 'png', c.id);
  fs.mkdirSync(png, { recursive: true });
  const main = attempt
    ? await runPs(ACCEPT_PPTX, ['-Path', file, '-Inventory', inv, '-PngDir', png], path.join(outDir, `${c.id}.pptx.report.json`), file)
    : notAttempted(file);
  // The negative control is written for the owner, never run against an attached PowerPoint.
  const negFile = path.join(outDir, `${c.id}.negative.pptx`);
  fs.writeFileSync(negFile, negativeDeck(c.bytes));
  return {
    id: c.id, file, bytes: c.bytes.length, powerpoint: main,
    negativeControl: { verdict: 'not run', file: negFile, reason: NEGATIVE_NOT_RUN },
    verdict: caseVerdict(main),
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
    return 64;
  }
  // One case after another, each application's cases in turn: a script attaches to the owner's Office, and after the
  // first TIMEOUT of an application none of its remaining cases starts (F1). So within a run no two scripts are ever
  // attached to the same Excel or PowerPoint at once, and none is sent to an Office that has not answered.
  const results: Array<Record<string, unknown>> = [
    ...await runInTurn(xlsx, (c, attempt) => acceptXlsx(c, outDir, attempt)),
    ...await runInTurn(pptx, (c, attempt) => acceptPptx(c, outDir, attempt)),
  ];
  const verdict = overallVerdict(results.map((r) => String(r.verdict)));
  const report = { mode, verdict, node: process.version, results };
  fs.writeFileSync(path.join(outDir, `report-${mode}.json`), JSON.stringify(report, null, 1));
  for (const r of results) console.log(summaryLine(r));
  for (const r of results) {
    const main = ((r.excel ?? r.powerpoint) ?? {}) as Record<string, unknown>;
    for (const n of Array.isArray(main.notCheckedInExcel) ? main.notCheckedInExcel : []) console.log(`  not checked in Excel (${String(r.id)}): ${String(n)}`);
  }
  const notRun = results.filter((r) => r.verdict === 'not run');
  if (notRun.length > 0) {
    console.log(`NOT RUN (${notRun.length} of ${results.length}): Office was not running, could not be attached to, or did not answer an earlier case; it is never started. Files for the owner to open by hand:`);
    for (const r of notRun) {
      const reason = (((r.excel ?? r.powerpoint) ?? {}) as Record<string, unknown>).notRunReason;
      console.log(`  ${String(r.file)}${typeof reason === 'string' ? `  (${reason})` : ''}`);
    }
  }
  for (const r of results.filter(officeTimedOut)) {
    const main = ((r.excel ?? r.powerpoint) ?? {}) as Record<string, unknown>;
    const left = main.closed === true ? 'the script closed its file' : `the run stopped waiting; the owner closes ${String(r.file)}`;
    console.log(`TIMEOUT ${String(r.id)}: nothing was killed; ${left}; no later case of that application was started`);
  }
  console.log('Negative controls NOT RUN (never against an attached Office; the owner may open them by hand and expect a repair prompt):');
  for (const r of results) console.log(`  ${String((r.negativeControl as Record<string, unknown>).file)}`);
  console.log(`${mode}: ${verdict.toUpperCase()}; report ${path.relative(REPO, path.join(outDir, `report-${mode}.json`))}`);
  return verdict === 'pass' ? 0 : verdict === 'fail' ? 1 : 2;
}

if (import.meta.main) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
