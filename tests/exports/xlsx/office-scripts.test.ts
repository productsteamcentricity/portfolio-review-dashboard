// covers: E-79 D-039
// The Office scripts under the owner's rule (standing rule of 2 Nov 2026, K1; docs/TESTING.md section 6.1), read from
// their text, since Office does not run in CI: attach only to a running Excel or PowerPoint (the task list first, then
// GetActiveObject; never a new instance); NOT RUN, with the file's path, when none runs; open only the script's own
// file read-only, without a window (Excel: only that workbook's window is hidden, and the owner's workbook and window
// are re-activated when they still exist); change no application option; recalculate only the script's own workbook;
// close only that file, in a finally block; never quit, stop, kill or watch over a process. The negative controls
// are written and never run. The run's verdict is PASS only when every case ran and passed, and NOT RUN is never a
// pass. Also N7: the workbook check reads the filter range as Excel holds it.
// `npm run accept:office` runs the scripts themselves (local only, under the same rule).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import { caseVerdict, overallVerdict, summaryLine, PS_TIMEOUT_MS } from '../../../scripts/office/run-acceptance.ts';

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
  ['EnableEvents', /EnableEvents/i], ['.Calculation', /\.Calculation/], ['Start-Process (a watchdog)', /Start-Process/i],
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

describe('N7: the workbook check reads the filter as Excel holds it', () => {
  test('accept-xlsx.ps1 compares AutoFilter.Range.Address(False, False) with the range in expected.json', () => {
    assert.match(XLSX, /\$address = \[string\]\$ws\.AutoFilter\.Range\.Address\(\$false, \$false\)/);
    assert.match(XLSX, /\$address -ne \[string\]\$fl\.ref/);
  });
});
