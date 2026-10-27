// covers: E-79 D-039
// The Office scripts' safety rules (M1.4 fix round 2, N15 and N7), read from their text, since Office does not run in
// CI: Excel is given 75 s to exit after Quit (a refused open can take about 60 s) before the last resort; every
// Stop-Process, the watchdogs' included, first checks that the process is still the one the script started (its
// ProcessName and the StartTime recorded at launch) and never stops an Office that shows a window; Excel is quit only
// with no workbook and no window; and the workbook check compares Excel's own autoFilter range with the file's.
// `npm run accept:office` runs the scripts themselves (local only).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';

const read = (name: string): string => fs.readFileSync(path.join(REPO, 'scripts', 'office', name), 'utf8');
const XLSX = read('accept-xlsx.ps1');
const PPTX = read('accept-pptx.ps1');
const RUN = read('run-acceptance.ts');

/** The lines of a script that call Stop-Process, outside comments, with the function or string they sit in. */
function stopCalls(script: string): Array<{ line: string; inStopOwn: boolean }> {
  const out: Array<{ line: string; inStopOwn: boolean }> = [];
  let inStopOwn = false;
  for (const line of script.replace(/<#[\s\S]*?#>/g, '').split(/\r?\n/)) {
    if (/^function Stop-OwnProcess\b/.test(line)) inStopOwn = true;
    else if (/^\S/.test(line) && !line.startsWith('}')) inStopOwn = false;
    const code = line.replace(/#.*$/, '');
    if (/Stop-Process\b/.test(code) && !/function Stop-OwnProcess/.test(code)) out.push({ line: line.trim(), inStopOwn });
  }
  return out;
}

describe('N15: Office is stopped only as a last resort, and only the script\'s own', () => {
  for (const [name, script, office] of [['accept-xlsx.ps1', XLSX, 'EXCEL'], ['accept-pptx.ps1', PPTX, 'POWERPNT']] as const) {
    test(`${name}: every Stop-Process is inside Stop-OwnProcess or a watchdog that checks name, start time and window`, () => {
      const calls = stopCalls(script);
      assert.ok(calls.length >= 2, `${name}: ${calls.length} Stop-Process calls`);
      for (const c of calls) {
        if (c.inStopOwn) continue;
        // The watchdog's command string: the same process (name and start time) and no window.
        assert.match(c.line, new RegExp(`ProcessName -eq '${office}'`), c.line);
        assert.match(c.line, /StartTime\.ToFileTimeUtc\(\) -eq \$\w+Start/, c.line);
        assert.match(c.line, /MainWindowHandle -eq 0/, c.line);
      }
      // Stop-OwnProcess compares the name and the start time recorded at launch, and refuses a window unless told.
      const fn = /function Get-OwnProcess[\s\S]*?\n}\n[\s\S]*?function Stop-OwnProcess[\s\S]*?\n}/.exec(script.replace(/\r\n/g, '\n'));
      assert.ok(fn, `${name}: Get-OwnProcess and Stop-OwnProcess`);
      assert.match(fn![0], /\$p\.ProcessName -ne \$name -or \$p\.StartTime\.ToFileTimeUtc\(\) -ne \$startTicks/);
      assert.match(fn![0], /-not \$WindowAllowed -and \$p\.MainWindowHandle -ne \[System\.IntPtr\]::Zero/);
      // The start time is recorded at launch, from the process the COM object belongs to.
      assert.match(script, new RegExp(`\\$own\\.ProcessName -eq '${office}'`));
      assert.match(script, /Start = \$own\.StartTime\.ToFileTimeUtc\(\)/);
      // The last resort for the Office process never passes -WindowAllowed (only the script's own watchdog may).
      for (const m of script.matchAll(/Stop-OwnProcess ([^\n)]*)/g)) {
        if (/-WindowAllowed/.test(m[1]!)) assert.match(m[1]!, /'powershell'/, m[0]);
      }
    });
  }

  test('accept-xlsx.ps1 waits up to 75 s after Quit, quits only with no workbook and no window, and kills only with 0 workbooks', () => {
    assert.match(XLSX, /\[int\]\$QuitWaitSeconds = 75/);
    assert.match(XLSX, /-and \$sw\.Elapsed\.TotalSeconds -lt \$QuitWaitSeconds\)/);
    assert.match(XLSX, /if \(\$books -eq 0 -and -not \$visible\) \{\s*try \{ \$xl\.Quit\(\) \}/);
    assert.match(XLSX, /elseif \(\$result\.workbooksAtQuit -ne 0\) \{\s*\$result\.notKilled/);
    assert.match(XLSX, /UserControl = \$true/, 'an Excel holding someone else\'s workbook is handed back to the person');
    assert.ok(!/TotalSeconds -lt 15\)/.test(XLSX), 'no 15 s wait remains in the Excel script');
  });

  test('run-acceptance.ts leaves room for the checks and the wait, and prints negativeControl.excelKilled', () => {
    const t = /timeout: (\d+)_000/.exec(RUN);
    assert.ok(t && Number(t[1]) >= 180 + 75 + 60, `spawn timeout ${t?.[1]} s`);
    assert.match(RUN, /negativeControl\.excelKilled=\$\{flag\(neg\.excelKilled\)\}/);
  });
});

describe('N7: the workbook check reads the filter as Excel holds it', () => {
  test('accept-xlsx.ps1 compares AutoFilter.Range.Address(False, False) with the range in expected.json', () => {
    assert.match(XLSX, /\$address = \[string\]\$ws\.AutoFilter\.Range\.Address\(\$false, \$false\)/);
    assert.match(XLSX, /\$address -ne \[string\]\$fl\.ref/);
  });
});
