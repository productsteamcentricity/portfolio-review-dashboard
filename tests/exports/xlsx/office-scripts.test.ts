// covers: E-79 D-039
// The Office scripts under the owner's rule (standing rule of 2 Nov 2026, K1; docs/TESTING.md section 6.1), read from
// their text, since Office does not run in CI: attach only to a running Excel or PowerPoint (the task list first, then
// GetActiveObject; never a new instance); NOT RUN, with the file's path, when none runs; open only the script's own
// file read-only, without a window (Excel: only that workbook's window is hidden, and the owner's workbook and window
// are re-activated when they still exist); change no application option; recalculate only the script's own workbook;
// close only that file, in a finally block; never quit, stop, kill or watch over a process. The negative controls
// are written and never run. The run's verdict is PASS only when every case ran and passed, and NOT RUN is never a
// pass. The security review of 2ef7216: after the first TIMEOUT of an application no further case of it starts (F1);
// the calculation mode is only read, and the edit check runs only in manual calculation (F2); the workbook's window
// is hidden at once after the open (F3). Also N7: the workbook check reads the filter range as Excel holds it.
// `npm run accept:office` runs the scripts themselves (local only, under the same rule). No test here starts
// PowerShell or Office: the run's decisions are tested with stand-in cases, and attempt false never reaches runPs.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import {
  caseVerdict, overallVerdict, summaryLine, PS_TIMEOUT_MS, NOT_ATTEMPTED, notAttempted, officeTimedOut, runInTurn,
  acceptXlsx, acceptPptx,
} from '../../../scripts/office/run-acceptance.ts';
import { writeWorkbook } from '../../../app/src/exports/xlsx/writer.ts';
import { storeZip } from '../../../app/src/exports/zip/store-zip.ts';
import { spikeWorkbookSpec } from './sample-input.ts';

const read = (name: string): string => fs.readFileSync(path.join(REPO, 'scripts', 'office', name), 'utf8').replace(/\r\n/g, '\n');
const XLSX = read('accept-xlsx.ps1');
const PPTX = read('accept-pptx.ps1');
const RUN = read('run-acceptance.ts');
/** The script without its header comment and line comments: the code alone. */
const code = (s: string): string => s.replace(/<#[\s\S]*?#>/g, '').split('\n').map((l) => l.replace(/(^|\s)#(?![>{]).*$/, '$1')).join('\n');

/** What neither script may hold anywhere, comments included (the owner's rule, K1). */
const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
  ['Quit(', /Quit\(/], ['Stop-Process', /Stop-Process/i], ['New-Object -ComObject', /New-Object\s+-ComObject/i],
  ['DisplayAlerts', /DisplayAlerts/i], ['AutomationSecurity', /AutomationSecurity/i], ['ScreenUpdating', /ScreenUpdating/i],
  // The calculation mode may be read (F2), never written; a property set by reflection is refused as well.
  ['EnableEvents', /EnableEvents/i], ['a write to .Calculation', /\.Calculation\s*=/i], ['InvokeMember', /InvokeMember/i],
  ['Start-Process (a watchdog)', /Start-Process/i],
  ['taskkill', /taskkill/i], ['.Kill(', /\.Kill\(/i], ['UserControl', /UserControl/i], ['AskToUpdateLinks', /AskToUpdateLinks/i],
  ['Application.Calculate', /\$xl\.Calculate|Application\.Calculate|CalculateFull/],
  ['Visible = on the application', /\$(xl|pp)\.Visible\s*=|Application\.Visible\s*=/i],
];

describe('K1: attach only, never start, quit or kill Office, no application option', () => {
  for (const [name, script, proc, progId] of [['accept-xlsx.ps1', XLSX, 'EXCEL', 'Excel.Application'], ['accept-pptx.ps1', PPTX, 'POWERPNT', 'PowerPoint.Application']] as const) {
    test(`${name}: none of the forbidden calls or options, anywhere in the file`, () => {
      for (const [label, re] of FORBIDDEN) assert.ok(!re.test(script), `${name} holds ${label}`);
    });

    test(`${name}: the task list first, then GetActiveObject; NOT RUN (exit 2) with the file's path when no ${proc} runs`, () => {
      const c = code(script);
      const list = c.indexOf(`Get-Process -Name ${proc}`);
      const attach = c.indexOf(`[Runtime.InteropServices.Marshal]::GetActiveObject('${progId}')`);
      assert.ok(list > 0 && attach > list, `${name}: Get-Process ${proc} at ${list}, GetActiveObject at ${attach}`);
      assert.match(c, /if \(-not \$result\.officeRunning\) \{ Exit-NotRun /);
      assert.match(c, /function Exit-NotRun[\s\S]*?Write-Output "Open by hand: \$full"[\s\S]*?exit 2/);
      assert.match(c, /if \(\$result\.verdict -eq 'not run'\) \{ exit 2 \}/);
      assert.match(c, /if \(\$result\.verdict -eq 'timeout'\) \{ exit 3 \}/);
    });

    test(`${name}: the header states the rule and what happens on a hang`, () => {
      const head = /<#([\s\S]*?)#>/.exec(script)![1]!.replace(/\s+/g, ' ');
      assert.match(head, /THE OWNER'S RULE \(standing rule of 2 Nov 2026/);
      assert.match(head, /attaches only/);
      assert.match(head, /never starts/);
      assert.match(head, /changes no application option/);
      assert.match(head, /closes only the (file|deck) it opened/);
      assert.match(head, /never asks \w+ to quit and never stops, kills or watches over any process/);
      assert.match(head, /on a hang: [\s\S]*TIMEOUT[\s\S]*path[\s\S]*the owner closes/);
      assert.match(head, /negative control is never run/);
    });

    test(`${name}: only the script's own references are released; nothing else is touched in the end`, () => {
      const tail = code(script).split(/\n} finally \{\n/).at(-1)!;
      assert.match(tail, /ReleaseComObject/);
      assert.ok(!/\.Close\(|\.Activate\(/.test(tail), 'the outer finally closes or activates nothing');
    });
  }

  test('accept-xlsx.ps1: its own file read-only, only its window hidden, the owner\'s window re-activated, its own sheets recalculated, closed in finally', () => {
    const c = code(XLSX);
    assert.match(c, /\$wb = \$xl\.Workbooks\.Open\(\$full, 0, \$true\)/);
    // The only assignment to a Visible property is the script's own workbook window.
    const visible = [...c.matchAll(/(\S+)\.Visible\s*=/g)].map((m) => m[1]);
    assert.deepEqual(visible, ['$win'], 'only $win.Visible is set');
    assert.match(c, /\$win = \$wb\.Windows\.Item\(1\)/);
    assert.match(c, /\$win\.Visible = \$false/);
    // Recalculation of its own sheets only.
    assert.match(c, /function Invoke-OwnCalculate\(\$wb\) \{[\s\S]*?foreach \(\$ws in \$wb\.Worksheets\) \{ \[void\]\$ws\.Calculate\(\) \}/);
    assert.ok(!/\$xl\.Calculate|CalculateFullRebuild/.test(c));
    // The owner's workbook and window: saved before the open, re-activated after the close, only when they still exist.
    const save = c.indexOf('Save-OwnerWindow $xl');
    const open = c.indexOf('$xl.Workbooks.Open(');
    const close = c.indexOf('$wb.Close($false)');
    const restore = c.indexOf('Restore-OwnerWindow $xl');
    assert.ok(save > 0 && open > save && close > open && restore > close, `save ${save}, open ${open}, close ${close}, restore ${restore}`);
    assert.match(c, /function Restore-OwnerWindow[\s\S]*?if \(\$book -eq \$null\) \{ return [\s\S]*?if \(\[string\]\$w\.Caption -eq \$owner\.window\) \{ \[void\]\$w\.Activate\(\)/);
    // Closed in the finally block of the checks, without saving.
    assert.match(c, /\} finally \{\n[^\n]*\n\s*if \(\$wb -ne \$null\) \{\n\s*try \{\n\s*\$wb\.Close\(\$false\)/);
  });

  test('accept-xlsx.ps1 (F3): its window is hidden at once after a successful open, before any wait, scan or caption read', () => {
    const c = code(XLSX);
    const open = c.indexOf('$wb = $xl.Workbooks.Open($full, 0, $true)');
    const hide = c.indexOf('$win.Visible = $false');
    assert.ok(open > 0 && hide > open, `open ${open}, hide ${hide}`);
    // Between the open and the hide: only the catch of a failed open (no window then), and the window itself.
    assert.match(c.slice(open, hide), /^\$wb = \$xl\.Workbooks\.Open\(\$full, 0, \$true\)\n\s*\} catch \{\n[\s\S]*?\n\s*\}\n\s*\$openError = \$null\n\s*\$win = \$wb\.Windows\.Item\(1\)\n\s*$/);
    for (const later of ['Start-Sleep -Milliseconds 300', '$newLogs = ', '$win.Caption', "Test-Deadline '", '$result.ran = $true']) {
      const at = c.indexOf(later, open);
      assert.ok(at > hide, `${later} at ${at} comes after the hide at ${hide}`);
    }
    assert.ok(!/\$wb\.Windows\.Item\(1\)\.Caption/.test(c), 'the caption is read from the hidden window');
  });

  test('accept-xlsx.ps1 (F2): the calculation mode is only read; the edit check runs only in manual calculation, else it is not checked in Excel', () => {
    const c = code(XLSX);
    // One read of the calculation mode, and no other use of it.
    const uses = [...c.matchAll(/\.Calculation\b/gi)].map((m) => c.slice(Math.max(0, m.index - 30), m.index + 12));
    assert.deepEqual(uses.length, 1, `uses of Calculation: ${JSON.stringify(uses)}`);
    assert.match(c, /try \{ \$calcMode = \[int\]\$xl\.Calculation \} catch \{ \}/);
    const edit = c.slice(c.indexOf('if ($exp.edit -ne $null) {'), c.indexOf('} finally {', c.indexOf('if ($exp.edit -ne $null) {')));
    const read = edit.indexOf('$xl.Calculation');
    const manual = edit.indexOf('if ($calcMode -eq -4135) {');
    const write = edit.indexOf('.Value2 = [double]$exp.edit.value');
    const auto = edit.indexOf('} elseif ($calcMode -eq -4105) {');
    assert.ok(read > 0 && manual > read && write > manual && auto > write, `read ${read}, manual ${manual}, edit ${write}, automatic ${auto}`);
    // The edit, its recalculation and its check sit in the manual branch only.
    const manualBranch = edit.slice(manual, auto);
    assert.match(manualBranch, /Test-Deadline 'the edit check'[\s\S]*Invoke-OwnCalculate \$wb[\s\S]*Add-Check "edit of \$editCell recalculates/);
    assert.equal([...c.matchAll(/\.Value2\s*=/g)].length, 1, 'the only write to a cell is the edit in the manual branch');
    // Automatic, semi-automatic and an unreadable mode: no edit, no check (never a pass, never a failure), recorded.
    const skip = edit.slice(auto);
    assert.ok(!/Add-Check|\.Value2\s*=|Invoke-OwnCalculate|\.Calculate\(/.test(skip), 'the skip edits, recalculates and checks nothing');
    assert.ok(skip.includes('[void]$notChecked.Add("edit of ${editCell}: Excel is in automatic calculation: editing an input could recalculate the owner\'s open workbooks")'));
    assert.match(skip, /\} elseif \(\$calcMode -eq 2\) \{\n\s*\[void\]\$notChecked\.Add\(/);
    assert.match(skip, /\} else \{\n\s*\[void\]\$notChecked\.Add\(/);
    assert.match(c, /\$result\.notCheckedInExcel = \$notChecked/);
    // The header says so, and that the open itself may recalculate the owner's books in automatic calculation.
    const head = /<#([\s\S]*?)#>/.exec(XLSX)![1]!.replace(/\s+/g, ' ');
    assert.match(head, /runs the edit check \([^)]*\) only when Excel is in manual calculation/);
    assert.match(head, /skipped and reported as not checked in Excel, never as a pass and never as a failure/);
    assert.match(head, /opening the file may itself start a recalculation, because the file asks for a full calculation on load: volatile formulas in the owner's open workbooks may then recalculate\. The owner may prefer to close other workbooks before a run\./);
  });

  test('accept-pptx.ps1: its own deck read-only without a window, marked saved and closed in finally', () => {
    const c = code(PPTX);
    assert.match(c, /\$deck = \$pp\.Presentations\.Open\(\$full, -1, 0, 0\)/);
    assert.match(c, /\} finally \{\n[^\n]*\n\s*if \(\$deck -ne \$null\) \{\n\s*try \{\n\s*\$deck\.Saved = -1\n\s*\$deck\.Close\(\)/);
    assert.ok(!/\.Visible\s*=/.test(c), 'no Visible property is set');
  });

  test('run-acceptance.ts: the negative controls are written, never run; no kill; an abandoned script is left running', () => {
    assert.ok(!/excelKilled|powerpointKilled/.test(RUN), 'no killed fields');
    assert.ok(!/\.kill\(|process\.kill|taskkill|spawnSync/.test(RUN), 'no kill and no blocking spawn with a timeout');
    const runs = [...RUN.matchAll(/await runPs\(([^)]*)\)/g)].map((m) => m[1]!);
    assert.equal(runs.length, 2, 'one run per script');
    for (const r of runs) assert.ok(!/neg/i.test(r), `a negative control is never run: ${r}`);
    assert.match(RUN, /detached: true/);
    assert.match(RUN, /child\.unref\(\); resolve\('timeout'\)/);
    assert.ok(PS_TIMEOUT_MS >= 180_000 + 60_000, `the run waits longer than the script's own deadline: ${PS_TIMEOUT_MS}`);
  });
});

describe('K1: the run\'s verdict; NOT RUN is never a pass', () => {
  test('a case: the Node checks, then the script\'s verdict', () => {
    assert.equal(caseVerdict({ verdict: 'pass', ran: true, pass: true }), 'pass');
    assert.equal(caseVerdict({ verdict: 'pass', ran: true, pass: true }, false), 'fail');
    assert.equal(caseVerdict({ verdict: 'not run', ran: false, pass: false }), 'not run');
    assert.equal(caseVerdict({ verdict: 'not run', ran: false, pass: false }, false), 'fail');
    assert.equal(caseVerdict({ verdict: 'timeout', ran: true, pass: false }), 'timeout');
    assert.equal(caseVerdict({ verdict: 'fail', ran: true, pass: false }), 'fail');
    assert.equal(caseVerdict({ ran: false, pass: false, notRunReason: 'the execution policy refuses scripts in this session' }), 'not run');
  });

  test('the run: PASS only when every case ran and passed', () => {
    assert.equal(overallVerdict(['pass', 'pass']), 'pass');
    assert.equal(overallVerdict(['pass', 'not run']), 'not run');
    assert.equal(overallVerdict(['not run', 'not run']), 'not run');
    assert.equal(overallVerdict([]), 'not run');
    assert.equal(overallVerdict(['pass', 'not run', 'fail']), 'fail');
    assert.equal(overallVerdict(['pass', 'timeout']), 'fail');
  });

  test('the summary line: the script closed its own file; the negative control not run; a file left open is named', () => {
    assert.equal(summaryLine({ id: 'wired-syn-standard', verdict: 'pass', excel: { closed: true } }),
      'PASS     wired-syn-standard  closed=true negativeControl=not run');
    assert.equal(summaryLine({ id: 'x', verdict: 'not run', excel: { ran: false } }), 'NOT RUN  x  closed=not run negativeControl=not run');
    assert.equal(summaryLine({ id: 'd', verdict: 'timeout', powerpoint: { closed: false, leftOpenForOwner: 'C:\\x\\d.pptx' } }),
      'TIMEOUT  d  closed=false negativeControl=not run  left open for the owner: C:\\x\\d.pptx');
  });
});

describe('F1: after the first TIMEOUT of an application, none of its remaining cases starts', () => {
  const stand = (id: string, verdict: string, app: 'excel' | 'powerpoint' = 'excel', closed = false): Record<string, unknown> =>
    ({ id, file: `C:\\x\\${id}`, verdict, [app]: { verdict, ran: verdict !== 'not run', closed } });

  test('the cases after the first TIMEOUT get attempt false, in order, and are NOT RUN with the reason and their path', async () => {
    const calls: Array<[string, boolean]> = [];
    const outcome: Record<string, string> = { a: 'pass', b: 'timeout', c: 'pass', d: 'timeout' };
    const results = await runInTurn(['a', 'b', 'c', 'd'], async (id, attempt) => {
      calls.push([id, attempt]);
      if (!attempt) { const excel = notAttempted(`C:\\x\\${id}`); return { id, file: `C:\\x\\${id}`, excel, verdict: caseVerdict(excel) }; }
      return stand(id, outcome[id]!);
    });
    assert.deepEqual(calls, [['a', true], ['b', true], ['c', false], ['d', false]]);
    assert.deepEqual(results.map((r) => r.verdict), ['pass', 'timeout', 'not run', 'not run']);
    for (const r of results.slice(2)) {
      assert.deepEqual(r.excel, { verdict: 'not run', ran: false, pass: false, notRunReason: NOT_ATTEMPTED, file: r.file });
    }
    assert.equal(NOT_ATTEMPTED, 'not attempted: Office did not answer');
    assert.equal(overallVerdict(results.map((r) => String(r.verdict))), 'fail');
  });

  test('without a TIMEOUT every case is attempted; NOT RUN (Office not running) stops nothing', async () => {
    const calls: boolean[] = [];
    await runInTurn(['a', 'b', 'c'], async (id, attempt) => { calls.push(attempt); return stand(id, id === 'a' ? 'not run' : 'pass'); });
    assert.deepEqual(calls, [true, true, true]);
    assert.deepEqual(await runInTurn([], async () => { throw new Error('never called'); }), []);
  });

  test('a TIMEOUT is the script\'s report, whatever the case verdict: the run\'s deadline, the script\'s own, or with a failed Node check', () => {
    assert.equal(officeTimedOut(stand('a', 'timeout')), true);
    assert.equal(officeTimedOut(stand('a', 'timeout', 'powerpoint', true)), true, 'the script\'s own deadline (it closed its file)');
    assert.equal(officeTimedOut({ id: 'a', verdict: 'fail', excel: { verdict: 'timeout' } }), true, 'a Node failure does not hide the TIMEOUT');
    assert.equal(officeTimedOut(stand('a', 'pass')), false);
    assert.equal(officeTimedOut(stand('a', 'not run')), false);
    assert.equal(officeTimedOut(stand('a', 'fail')), false);
    assert.equal(officeTimedOut({ id: 'a', verdict: 'not run' }), false);
  });

  test('the summary line of a case not started names the reason and its file', () => {
    assert.equal(summaryLine({ id: 'c', verdict: 'not run', file: 'C:\\x\\c.xlsx', excel: notAttempted('C:\\x\\c.xlsx') }),
      'NOT RUN  c  closed=not run negativeControl=not run  not attempted: Office did not answer; open by hand: C:\\x\\c.xlsx');
  });

  test('acceptXlsx and acceptPptx with attempt false write the files, start no script and report NOT RUN with the path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-f1-'));
    try {
      const x = await acceptXlsx({ id: 'f1-book', bytes: writeWorkbook(spikeWorkbookSpec()), edit: null, formats: [], unitsText: null, negative: null }, dir, false);
      const enc = new TextEncoder();
      const deck = storeZip([{ name: '[Content_Types].xml', data: enc.encode('<Types/>') }, { name: 'ppt/slides/slide1.xml', data: enc.encode('<sld/>') }]);
      const p = await acceptPptx({ id: 'f1-deck', bytes: deck, inventory: { slides: [] } }, dir, false);
      for (const [r, main, ext] of [[x, x.excel, 'xlsx'], [p, p.powerpoint, 'pptx']] as const) {
        assert.equal(r.verdict, 'not run');
        assert.deepEqual(main, notAttempted(path.join(dir, `${String(r.id)}.${ext}`)));
        assert.ok(fs.existsSync(String(r.file)), `${String(r.file)} written for the owner`);
        assert.ok(!fs.existsSync(path.join(dir, `${String(r.id)}.${ext}.report.json`)) && !fs.existsSync(path.join(dir, `${String(r.id)}.${ext}.report.log`)), 'no script started');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('run-acceptance.ts: each application\'s cases run in turn through runInTurn; runPs only when attempt is true', () => {
    assert.match(RUN, /\.\.\.await runInTurn\(xlsx, \(c, attempt\) => acceptXlsx\(c, outDir, attempt\)\)/);
    assert.match(RUN, /\.\.\.await runInTurn\(pptx, \(c, attempt\) => acceptPptx\(c, outDir, attempt\)\)/);
    assert.ok(!/for \(const c of (xlsx|pptx)\)/.test(RUN), 'no other loop over the cases');
    assert.equal([...RUN.matchAll(/const main = attempt\n\s*\? await runPs\([^\n]*\n\s*: notAttempted\(file\);/g)].length, 2);
    assert.match(RUN, /within a run no two scripts are ever\n\s*\/\/ attached to the same Excel or PowerPoint at once/);
  });
});

describe('N7: the workbook check reads the filter as Excel holds it', () => {
  test('accept-xlsx.ps1 compares AutoFilter.Range.Address(False, False) with the range in expected.json', () => {
    assert.match(XLSX, /\$address = \[string\]\$ws\.AutoFilter\.Range\.Address\(\$false, \$false\)/);
    assert.match(XLSX, /\$address -ne \[string\]\$fl\.ref/);
  });
});
