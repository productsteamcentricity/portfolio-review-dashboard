<#
Office acceptance of one workbook in Excel through COM (local only, never in CI; ARCHITECTURE section 14, test T-09).
Windows PowerShell 5.1:
  powershell.exe -NoProfile -NonInteractive -File scripts\office\accept-xlsx.ps1 -Path <xlsx> -Expected <json> -Report <json>
Written by scripts/office/run-acceptance.ts, which also writes the expected values (from tests/helpers/formula-eval.ts)
and the text each view-model figure must show (its display, without the marker).

THE OWNER'S RULE (standing rule of 2 Nov 2026; docs/TESTING.md section 6.1). The owner's own Excel may be open on
this PC with the owner's work in it, so the script:
  1. attaches only. It first looks for a running EXCEL process (the task list); with none, or when attaching through
     GetActiveObject fails, the verdict is NOT RUN (exit code 2), and the script prints the absolute path of the
     synthetic file for the owner to open by hand. It never starts Excel and never creates a second instance.
  2. opens only its own synthetic file, read-only (UpdateLinks 0, ReadOnly true, not added to the recent list).
     Excel has no true "no window" in a shared instance: the file opens in a window of the owner's Excel. Before the
     open the script remembers the owner's active workbook and window. Right after the open, before any wait or other
     work, it hides only its own workbook's window (Windows.Item(1) of its workbook, a property of that file), so
     frozen panes, which need a shown window, are not checked in Excel (the writer's tests check them in the file).
     After closing its file it re-activates the owner's workbook and window, only when they still exist; it never
     creates, closes or changes anything else.
  3. changes no application option: no alert, visibility, macro security, calculation mode, screen updating or event
     setting is written. It recalculates only its own workbook, sheet by sheet (Worksheet.Calculate), never the
     application, which would recalculate the owner's books. It reads the calculation mode, and only that, and runs
     the edit check (one input of its own workbook changed in memory) only when Excel is in manual calculation: in
     automatic calculation an edit could recalculate the owner's open workbooks (their volatile formulas, marking
     them unsaved), so the edit check is then skipped and reported as not checked in Excel, never as a pass and never
     as a failure. Even so, in an Excel in automatic calculation, opening the file may itself start a recalculation,
     because the file asks for a full calculation on load: volatile formulas in the owner's open workbooks may then
     recalculate. The owner may prefer to close other workbooks before a run.
  4. closes only the file it opened, without saving, in a finally block, and releases its COM references. It never
     asks Excel to quit and never stops, kills or watches over any process.
  5. on a hang: the script stops at its own deadline between checks (verdict TIMEOUT, exit code 3) and still closes
     its file. If a call into Excel never returns, run-acceptance.ts stops waiting, reports TIMEOUT with the path of
     the file left open, and leaves every process running; the owner closes that file in Excel. After a TIMEOUT the
     run starts no further workbook in Excel: each remaining one is NOT RUN ("not attempted: Office did not answer")
     with its path.
  6. the damaged-file negative control is never run against the attached Excel (it would raise the repair prompt on
     the owner's screen): run-acceptance.ts writes it and reports it NOT RUN with its path.

Checks: detects a repair; recalculates its own sheets; compares every expected formula cell with Excel's value at 1e-9
relative; compares the text Excel shows (Range.Text) with the screen's text for every figure of the _manifest and every
sample text cell; checks each filter's range as Excel holds it after the open
(AutoFilter.Range.Address(False, False)) against the file's, the hidden sheet, names, fonts, number formats and the red
of a negative cell; in manual calculation only (point 3), edits one input in memory and compares the recalculated
dependents.
The report is JSON (synthetic data only). Exit code 0 when every check passed, 1 when one failed, 2 when not run,
3 on the deadline (TIMEOUT).
#>
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][string]$Expected,
  [Parameter(Mandatory = $true)][string]$Report,
  [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$checks = New-Object System.Collections.ArrayList
function Add-Check([string]$name, [bool]$ok, $detail) {
  [void]$checks.Add([ordered]@{ name = $name; ok = $ok; detail = $detail })
}
$full = [System.IO.Path]::GetFullPath($Path)
$result = [ordered]@{
  tool = 'accept-xlsx.ps1'; file = $full; verdict = 'not run'; ran = $false; pass = $false; excel = $null
  officeRunning = $false; attached = $false; opened = $false; repaired = $false; repairEvidence = @(); checks = $checks
  notRunReason = $null; timedOut = $false; closed = $false; leftOpenForOwner = $null; ownerWindowRestored = $null
}
function Write-Report {
  $result.pass = $result.ran -and -not $result.timedOut -and (@($checks | Where-Object { -not $_.ok }).Count -eq 0)
  if ($result.timedOut) { $result.verdict = 'timeout' }
  elseif (-not $result.ran) { $result.verdict = 'not run' }
  elseif ($result.pass) { $result.verdict = 'pass' }
  else { $result.verdict = 'fail' }
  $json = $result | ConvertTo-Json -Depth 8
  $json | Out-File -FilePath $Report -Encoding utf8
}
function Exit-NotRun([string]$reason) {
  $result.notRunReason = $reason
  Write-Report
  Write-Output "NOT RUN: $reason"
  Write-Output "Open by hand: $full"
  exit 2
}

# D-018: Excel refuses a full path of 218 characters or more.
if ($full.Length -ge 218) { Exit-NotRun "path of $($full.Length) characters (218 or more)" }
$exp = Get-Content -LiteralPath $Expected -Raw -Encoding UTF8 | ConvertFrom-Json

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
function Test-Deadline([string]$step) {
  if ([DateTime]::UtcNow -gt $deadline) { throw "TIMEOUT before $step" }
}
# Excel refuses calls while a cell is being edited or a dialog is open (RPC_E_CALL_REJECTED, RPC_E_SERVERCALL_RETRYLATER).
function Test-Busy($err) {
  $text = [string]$err
  try { $text += ' ' + ('0x{0:X8}' -f $err.Exception.HResult) } catch { }
  return ($text -match '0x80010001|0x8001010A|rejected|retry later')
}

$errorNames = @{
  -2146826281 = '#DIV/0!'; -2146826246 = '#N/A'; -2146826259 = '#NAME?'; -2146826288 = '#NULL!'
  -2146826252 = '#NUM!'; -2146826265 = '#REF!'; -2146826273 = '#VALUE!'
}
function Get-ErrorName($v) {
  if ($v -is [int]) { if ($errorNames.ContainsKey($v)) { return $errorNames[$v] } else { return "#ERR($v)" } }
  return $null
}
function Test-Close([double]$a, [double]$b) {
  return [Math]::Abs($a - $b) -le (1e-9 * [Math]::Max([Math]::Abs($a), [Math]::Abs($b)) + 1e-12)
}
function Test-Property($o, [string]$name) {
  return ($o -ne $null) -and ($o.PSObject.Properties.Name -contains $name) -and ($o.$name -ne $null)
}
# The screen shows no sign on a value that rounds to zero ("0.00"); an Excel build may show "-0.00". Only that sign is
# ignored.
function Get-ShownText([string]$t) {
  if ($t -match '^-[0.,]+%?$' -and ($t -replace '[^1-9]', '') -eq '') { return $t.Substring(1) }
  return $t
}
# Recalculates the script's own workbook only, sheet by sheet (three passes cover the chains between its sheets).
function Invoke-OwnCalculate($wb) {
  for ($pass = 0; $pass -lt 3; $pass++) {
    foreach ($ws in $wb.Worksheets) { [void]$ws.Calculate() }
  }
}

$tempDir = [System.IO.Path]::GetTempPath()
$before = @{}
Get-ChildItem -LiteralPath $tempDir -Filter 'error*.xml' -ErrorAction SilentlyContinue | ForEach-Object { $before[$_.FullName] = $_.LastWriteTimeUtc }

# The owner's active workbook and window before the open, by name, so they are re-activated only if they still exist.
$owner = @{ book = $null; window = $null }
function Save-OwnerWindow($xl) {
  try { $ab = $xl.ActiveWorkbook; if ($ab -ne $null) { $owner.book = [string]$ab.FullName } } catch { }
  try { $aw = $xl.ActiveWindow; if ($aw -ne $null) { $owner.window = [string]$aw.Caption } } catch { }
}
function Restore-OwnerWindow($xl) {
  if (-not $owner.book) { return 'nothing to restore' }
  $book = $null
  foreach ($b in $xl.Workbooks) { if ([string]$b.FullName -eq $owner.book) { $book = $b; break } }
  if ($book -eq $null) { return 'the owner''s workbook is no longer open: nothing activated' }
  foreach ($w in $book.Windows) {
    if ([string]$w.Caption -eq $owner.window) { [void]$w.Activate(); return 'restored' }
  }
  return 'the owner''s window is no longer open: nothing activated'
}

# Opens the workbook, runs every check and closes it again. Every COM object it touches is a local of this function,
# and the workbook is closed (without saving) and released in its finally block.
function Invoke-WorkbookChecks($xl) {
  $wb = $null
  try {
    $openError = $null
    Save-OwnerWindow $xl
    for ($try = 0; $try -lt 5 -and $wb -eq $null; $try++) {
      try {
        # Filename, UpdateLinks 0, ReadOnly true; AddToMru stays at its default (false).
        $wb = $xl.Workbooks.Open($full, 0, $true)
      } catch {
        $openError = $_
        if (-not (Test-Busy $_)) { break }
        Start-Sleep -Seconds 2
        continue
      }
      $openError = $null
      # Only this workbook's own window is hidden, at once: before any wait, scan or other call, so nothing of it stays
      # on the owner's screen. If hiding fails, the error ends the checks and the finally block closes the file.
      $win = $wb.Windows.Item(1)
      $win.Visible = $false
    }
    if ($wb -eq $null -and $openError -ne $null -and (Test-Busy $openError)) { throw $openError }
    $result.ran = $true
    Start-Sleep -Milliseconds 300
    $newLogs = @(Get-ChildItem -LiteralPath $tempDir -Filter 'error*.xml' -ErrorAction SilentlyContinue |
      Where-Object { -not $before.ContainsKey($_.FullName) -or $before[$_.FullName] -ne $_.LastWriteTimeUtc })
    $evidence = New-Object System.Collections.ArrayList
    if ($openError) { [void]$evidence.Add("open failed: $($openError.Exception.Message)") }
    foreach ($log in $newLogs) {
      $text = Get-Content -LiteralPath $log.FullName -Raw -ErrorAction SilentlyContinue
      if ($text -and $text -match [Regex]::Escape([System.IO.Path]::GetFileName($full))) {
        [void]$evidence.Add("repair log $($log.Name)")
      }
    }
    if ($wb -ne $null) {
      $result.opened = $true
      $caption = ''
      try { $caption = [string]$win.Caption } catch { }
      if ($caption -match 'Repaired') { [void]$evidence.Add("window caption: $caption") }
    }
    $result.repairEvidence = @($evidence)
    $result.repaired = ($evidence.Count -gt 0)
    Add-Check 'opens without repair' (-not $result.repaired) ($evidence -join '; ')
    if ($wb -eq $null) { throw 'the workbook did not open' }

    # This workbook's window was hidden right after the open. Frozen panes are a property of a shown window (a sheet
    # of a hidden window cannot be activated), so they are not checked in Excel; the writer's tests check them in the
    # file (tests/exports/xlsx/writer.test.ts). What is not checked in Excel is recorded, never as a pass or a failure.
    $notChecked = New-Object System.Collections.ArrayList
    [void]$notChecked.Add('frozen panes: they need the window shown; checked in the file by tests/exports/xlsx/writer.test.ts')
    $result.notCheckedInExcel = $notChecked

    # Recalculation of this workbook only.
    Test-Deadline 'recalculation'
    Invoke-OwnCalculate $wb

    # Error values anywhere, by UsedRange.Value2 and by SpecialCells.
    Test-Deadline 'error values'
    $errorCells = New-Object System.Collections.ArrayList
    $special = 0
    foreach ($ws in $wb.Worksheets) {
      $ur = $ws.UsedRange
      $vals = $ur.Value2
      $r0 = $ur.Row; $c0 = $ur.Column
      if ($vals -is [System.Array]) {
        for ($i = 1; $i -le $vals.GetLength(0); $i++) {
          for ($j = 1; $j -le $vals.GetLength(1); $j++) {
            $e = Get-ErrorName $vals[$i, $j]
            if ($e) { [void]$errorCells.Add("$($ws.Name)!R$($r0 + $i - 1)C$($c0 + $j - 1) $e") }
          }
        }
      } else {
        $e = Get-ErrorName $vals
        if ($e) { [void]$errorCells.Add("$($ws.Name)!R$($r0)C$($c0) $e") }
      }
      foreach ($type in @(-4123, 2)) {
        try { $special += $ws.Cells.SpecialCells($type, 16).Count } catch { }
      }
    }
    Add-Check 'no error value after the recalculation' (($errorCells.Count -eq 0) -and ($special -eq 0)) (@($errorCells) + @("SpecialCells errors: $special"))

    # Formula values against the evaluator.
    Test-Deadline 'formula values'
    $mismatch = New-Object System.Collections.ArrayList
    $compared = 0
    foreach ($f in $exp.formulas) {
      $ws = $wb.Worksheets.Item([string]$f.sheet)
      $v = $ws.Range([string]$f.cell).Value2
      $compared++
      $e = Get-ErrorName $v
      if ($e -or $v -eq $null -or -not (Test-Close ([double]$v) ([double]$f.value))) {
        [void]$mismatch.Add("$($f.sheet)!$($f.cell): Excel $v, expected $($f.value)")
      }
    }
    Add-Check "formula values equal the evaluator ($compared cells)" ($mismatch.Count -eq 0) @($mismatch | Select-Object -First 20)

    # The text Excel shows against the screen's text (D-039: display rounding agrees with Excel).
    Test-Deadline 'cell texts'
    if (Test-Property $exp 'texts') {
      $textBad = New-Object System.Collections.ArrayList
      $textCount = 0
      foreach ($t in @($exp.texts)) {
        $shown = Get-ShownText ([string]$wb.Worksheets.Item([string]$t.sheet).Range([string]$t.cell).Text)
        $textCount++
        if ($shown -ne [string]$t.text) { [void]$textBad.Add("$($t.sheet)!$($t.cell): Excel '$shown', screen '$($t.text)'") }
      }
      Add-Check "cell text equals the screen's text ($textCount cells)" ($textBad.Count -eq 0) @($textBad | Select-Object -First 20)
    }

    # Filters: on every data sheet, over the range the file declares. Excel extends a filter to a row that touches
    # it when it opens a file, so the range is read as Excel holds it (the share row stays out: D-039 point 5, N7).
    Test-Deadline 'filters'
    $filterOut = New-Object System.Collections.ArrayList
    $filterOk = $true
    foreach ($fl in @($exp.filters)) {
      $ws = $wb.Worksheets.Item([string]$fl.sheet)
      $mode = [bool]$ws.AutoFilterMode
      $address = ''
      if ($mode) { $address = [string]$ws.AutoFilter.Range.Address($false, $false) }
      if (-not $mode -or $address -ne [string]$fl.ref) { $filterOk = $false }
      [void]$filterOut.Add("$($fl.sheet): AutoFilterMode $mode, range $address, file $($fl.ref)")
    }
    Add-Check 'AutoFilterMode on every data sheet, over the range the file declares' $filterOk @($filterOut)

    # Hidden and protected sheets.
    foreach ($name in $exp.hidden) {
      $ws = $wb.Worksheets.Item([string]$name)
      Add-Check "sheet $name hidden and protected" (($ws.Visible -eq 0) -and ($ws.ProtectContents -eq $true)) "Visible $($ws.Visible), ProtectContents $($ws.ProtectContents)"
    }

    # Names without #REF!.
    $badNames = New-Object System.Collections.ArrayList
    foreach ($n in $wb.Names) { if ([string]$n.RefersTo -match '#REF!') { [void]$badNames.Add("$($n.Name) $($n.RefersTo)") } }
    Add-Check "names without #REF! ($($wb.Names.Count) names)" ($badNames.Count -eq 0) @($badNames)

    # Fonts and number formats on sample cells.
    Test-Deadline 'formats'
    $fmtOut = New-Object System.Collections.ArrayList
    $fmtOk = $true
    foreach ($s in $exp.formats) {
      $r = $wb.Worksheets.Item([string]$s.sheet).Range([string]$s.cell)
      $nf = [string]$r.NumberFormat
      $ok = ([string]$r.Font.Name -eq [string]$s.font) -and ([double]$r.Font.Size -eq [double]$s.size)
      if ($s.numberFormat -ne $null) { $ok = $ok -and ($nf -eq [string]$s.numberFormat) }
      if (-not $ok) { $fmtOk = $false }
      [void]$fmtOut.Add("$($s.sheet)!$($s.cell): $($r.Font.Name) $($r.Font.Size) '$nf'")
    }
    Add-Check 'Cambria 9 and the number formats on sample cells' $fmtOk @($fmtOut)

    if ($exp.unitsText -ne $null) {
      $t = [string]$wb.Worksheets.Item([string]$exp.unitsText.sheet).Range([string]$exp.unitsText.cell).Text
      Add-Check 'units cell text in Indian grouping' ($t -eq [string]$exp.unitsText.text) "Text '$t', expected '$($exp.unitsText.text)'"
    }
    if ($exp.negative -ne $null) {
      $r = $wb.Worksheets.Item([string]$exp.negative.sheet).Range([string]$exp.negative.cell)
      $bgr = [int]$r.DisplayFormat.Font.Color
      $hex = '#{0:X2}{1:X2}{2:X2}' -f ($bgr -band 0xFF), (($bgr -shr 8) -band 0xFF), (($bgr -shr 16) -band 0xFF)
      Add-Check 'negative cell shown in red' ($hex -eq [string]$exp.negative.colour) "colour $hex, value $($r.Value2)"
    }

    # The edit check: one input changed in memory (the file is read-only and is closed without saving), this
    # workbook's sheets recalculated, its dependents compared. It runs only while the owner's Excel is in manual
    # calculation (xlCalculationManual, -4135). In automatic calculation (-4105, or semi-automatic, 2) the edit could
    # recalculate the owner's open workbooks, so it is skipped and recorded as not checked in Excel: never a pass and
    # never a failure. The calculation mode is only read here, never written.
    if ($exp.edit -ne $null) {
      $editCell = "$($exp.edit.sheet)!$($exp.edit.cell)"
      $calcMode = $null
      try { $calcMode = [int]$xl.Calculation } catch { }
      $result.calcMode = $calcMode
      if ($calcMode -eq -4135) {
        Test-Deadline 'the edit check'
        $ws = $wb.Worksheets.Item([string]$exp.edit.sheet)
        $ws.Range([string]$exp.edit.cell).Value2 = [double]$exp.edit.value
        Invoke-OwnCalculate $wb
        $editBad = New-Object System.Collections.ArrayList
        foreach ($d in $exp.edit.dependents) {
          $v = $wb.Worksheets.Item([string]$d.sheet).Range([string]$d.cell).Value2
          if ((Get-ErrorName $v) -or $v -eq $null -or -not (Test-Close ([double]$v) ([double]$d.value))) {
            [void]$editBad.Add("$($d.sheet)!$($d.cell): Excel $v, expected $($d.value)")
          }
        }
        Add-Check "edit of $editCell recalculates $(@($exp.edit.dependents).Count) dependents" ($editBad.Count -eq 0) @($editBad)
      } elseif ($calcMode -eq -4105) {
        [void]$notChecked.Add("edit of ${editCell}: Excel is in automatic calculation: editing an input could recalculate the owner's open workbooks")
      } elseif ($calcMode -eq 2) {
        [void]$notChecked.Add("edit of ${editCell}: Excel is in semi-automatic calculation: editing an input could recalculate the owner's open workbooks")
      } else {
        [void]$notChecked.Add("edit of ${editCell}: Excel's calculation mode could not be read: editing an input could recalculate the owner's open workbooks")
      }
    }
  } finally {
    # Only the file this script opened is closed, without saving; then the owner's workbook and window come back.
    if ($wb -ne $null) {
      try {
        $wb.Close($false)
        $result.closed = $true
      } catch {
        $result.leftOpenForOwner = $full
        Write-Output "Could not close the synthetic file; the owner closes it in Excel: $full"
      }
      try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) } catch { }
      $wb = $null
      try { $result.ownerWindowRestored = Restore-OwnerWindow $xl } catch { $result.ownerWindowRestored = "not restored: $($_.Exception.Message)" }
    }
  }
}

function Invoke-Collect {
  for ($k = 0; $k -lt 2; $k++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers() }
}

# 1. The task list first: no running Excel, no run. Excel is never started.
$running = @(Get-Process -Name EXCEL -ErrorAction SilentlyContinue)
$result.officeRunning = ($running.Count -gt 0)
if (-not $result.officeRunning) { Exit-NotRun 'Excel is not running; the script attaches only and never starts it' }

$xl = $null
try {
  try {
    $xl = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
  } catch {
    Exit-NotRun "could not attach to the running Excel: $($_.Exception.Message)"
  }
  $result.attached = $true
  try { $result.excel = "$($xl.Version) build $($xl.Build)" } catch { }
  Invoke-WorkbookChecks $xl
} catch {
  $message = [string]$_.Exception.Message
  if ($message -match '^TIMEOUT') {
    $result.timedOut = $true
    Add-Check 'checks finished within the deadline' $false "$message ($TimeoutSeconds s)"
  } elseif (Test-Busy $_) {
    $result.ran = $false
    $result.notRunReason = "Excel was busy (a cell being edited or a dialog open): $message"
  } else {
    Add-Check 'script completed' $false $message
  }
} finally {
  # Only the script's own references are released; the owner's Excel keeps running as it was.
  if ($xl -ne $null) {
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) } catch { }
    $xl = $null
  }
  Invoke-Collect
}
Write-Report
if ($result.verdict -eq 'not run') { Write-Output "NOT RUN: $($result.notRunReason)"; Write-Output "Open by hand: $full" }
if ($result.verdict -eq 'pass') { exit 0 }
if ($result.verdict -eq 'not run') { exit 2 }
if ($result.verdict -eq 'timeout') { exit 3 }
exit 1
