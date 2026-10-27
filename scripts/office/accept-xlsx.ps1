<#
Office acceptance of one workbook in Excel through COM (local only, never in CI; ARCHITECTURE section 14, test T-09).
Windows PowerShell 5.1:
  powershell.exe -NoProfile -NonInteractive -File scripts\office\accept-xlsx.ps1 -Path <xlsx> -Expected <json> -Report <json>
Written by scripts/office/run-acceptance.ts, which also writes the expected values (from tests/helpers/formula-eval.ts)
and the text each view-model figure must show (its display, without the marker).
The script opens the workbook read-only in a new, invisible Excel; detects a repair; recalculates fully; compares
every expected formula cell with Excel's value at 1e-9 relative; compares the text Excel shows (Range.Text) with the
screen's text for every figure of the _manifest and every sample text cell; checks frozen panes, filters, the hidden
sheet, names, fonts, number formats and the red of a negative cell; edits one input and compares the recalculated
dependents; then closes without saving and quits only the Excel it started.
Quitting: every COM object of the checks lives inside the function Invoke-WorkbookChecks, so none is reachable once it
returns; the workbook is closed and released, the garbage collector runs twice, then Excel is asked to quit and given
15 seconds. Only then, as a last resort, is that one Excel process stopped (excelKilled in the report).
The report is JSON (synthetic data only). Exit code 0 when every check passed, 1 when one failed, 2 when not run.
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
$result = [ordered]@{
  tool = 'accept-xlsx.ps1'; file = $Path; ran = $false; pass = $false; excel = $null; opened = $false
  repaired = $false; repairEvidence = @(); checks = $checks; notRunReason = $null
  excelQuit = $false; excelKilled = $false; quitSeconds = $null
}
function Write-Report {
  $result.pass = $result.ran -and (@($checks | Where-Object { -not $_.ok }).Count -eq 0)
  $json = $result | ConvertTo-Json -Depth 8
  $json | Out-File -FilePath $Report -Encoding utf8
}

# D-018: Excel refuses a full path of 218 characters or more.
$full = [System.IO.Path]::GetFullPath($Path)
if ($full.Length -ge 218) {
  $result.notRunReason = "path of $($full.Length) characters (218 or more)"
  Write-Report; exit 2
}
$exp = Get-Content -LiteralPath $Expected -Raw -Encoding UTF8 | ConvertFrom-Json

Add-Type -Namespace AcceptXlsx -Name Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(System.IntPtr hWnd, out int processId);
'@

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
# The screen shows no sign on a value that rounds to zero ("0.00"); Excel shows "-0.00". Only that sign is ignored.
function Get-ShownText([string]$t) {
  if ($t -match '^-[0.,]+%?$' -and ($t -replace '[^1-9]', '') -eq '') { return $t.Substring(1) }
  return $t
}

$tempDir = [System.IO.Path]::GetTempPath()
$before = @{}
Get-ChildItem -LiteralPath $tempDir -Filter 'error*.xml' -ErrorAction SilentlyContinue | ForEach-Object { $before[$_.FullName] = $_.LastWriteTimeUtc }

# Opens the workbook, runs every check and closes it again. Every COM object it touches is a local of this function,
# so none survives it (the cause of Excel staying alive after Quit).
function Invoke-WorkbookChecks($xl) {
  $wb = $null
  try {
    $openError = $null
    try {
      $wb = $xl.Workbooks.Open($full, 0, $true)
    } catch {
      $openError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 300
    $newLogs = @(Get-ChildItem -LiteralPath $tempDir -Filter 'error*.xml' -ErrorAction SilentlyContinue |
      Where-Object { -not $before.ContainsKey($_.FullName) -or $before[$_.FullName] -ne $_.LastWriteTimeUtc })
    $evidence = New-Object System.Collections.ArrayList
    if ($openError) { [void]$evidence.Add("open failed: $openError") }
    foreach ($log in $newLogs) {
      $text = Get-Content -LiteralPath $log.FullName -Raw -ErrorAction SilentlyContinue
      if ($text -and $text -match [Regex]::Escape([System.IO.Path]::GetFileName($full))) {
        [void]$evidence.Add("repair log $($log.Name)")
      } elseif ($text) {
        [void]$evidence.Add("repair log $($log.Name) (other file)")
      }
    }
    if ($wb -ne $null) {
      $result.opened = $true
      $caption = ''
      try { $caption = [string]$wb.Windows.Item(1).Caption } catch { }
      if ($caption -match 'Repaired') { [void]$evidence.Add("window caption: $caption") }
    }
    $result.repairEvidence = @($evidence)
    $result.repaired = ($evidence.Count -gt 0)
    Add-Check 'opens without repair' (-not $result.repaired) ($evidence -join '; ')
    if ($wb -eq $null) { throw 'the workbook did not open' }

    # Full recalculation.
    $xl.Calculation = -4105 # xlCalculationAutomatic
    $xl.CalculateFullRebuild()
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($xl.CalculationState -ne 0 -and $sw.Elapsed.TotalSeconds -lt 60) { Start-Sleep -Milliseconds 100 }
    Add-Check 'calculation finished' ($xl.CalculationState -eq 0) "state $($xl.CalculationState)"

    # Error values anywhere, by UsedRange.Value2 and by SpecialCells.
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
    Add-Check 'no error value after a full rebuild' (($errorCells.Count -eq 0) -and ($special -eq 0)) (@($errorCells) + @("SpecialCells errors: $special"))

    # Formula values against the evaluator.
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

    # Frozen panes on every visible sheet.
    $freezeOut = New-Object System.Collections.ArrayList
    $freezeOk = $true
    foreach ($fz in $exp.freeze) {
      $ws = $wb.Worksheets.Item([string]$fz.sheet)
      if ($ws.Visible -ne -1) { continue }
      [void]$ws.Activate()
      $win = $wb.Windows.Item(1)
      $ok = ($win.FreezePanes -eq $true) -and ($win.SplitRow -eq [int]$fz.rows) -and ($win.SplitColumn -eq [int]$fz.cols)
      if (-not $ok) { $freezeOk = $false }
      [void]$freezeOut.Add("$($fz.sheet): FreezePanes $($win.FreezePanes), SplitRow $($win.SplitRow), SplitColumn $($win.SplitColumn)")
    }
    Add-Check 'frozen panes on every visible sheet' $freezeOk @($freezeOut)

    # Filters.
    $filterOut = New-Object System.Collections.ArrayList
    $filterOk = $true
    foreach ($name in $exp.filters) {
      $ws = $wb.Worksheets.Item([string]$name)
      if (-not $ws.AutoFilterMode) { $filterOk = $false }
      [void]$filterOut.Add("$($name): AutoFilterMode $($ws.AutoFilterMode)")
    }
    Add-Check 'AutoFilterMode on every data sheet' $filterOk @($filterOut)

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

    # The edit check: one input changed, its dependents recalculated.
    if ($exp.edit -ne $null) {
      $ws = $wb.Worksheets.Item([string]$exp.edit.sheet)
      $ws.Range([string]$exp.edit.cell).Value2 = [double]$exp.edit.value
      $xl.Calculate()
      $sw = [Diagnostics.Stopwatch]::StartNew()
      while ($xl.CalculationState -ne 0 -and $sw.Elapsed.TotalSeconds -lt 60) { Start-Sleep -Milliseconds 100 }
      $editBad = New-Object System.Collections.ArrayList
      foreach ($d in $exp.edit.dependents) {
        $v = $wb.Worksheets.Item([string]$d.sheet).Range([string]$d.cell).Value2
        if ((Get-ErrorName $v) -or $v -eq $null -or -not (Test-Close ([double]$v) ([double]$d.value))) {
          [void]$editBad.Add("$($d.sheet)!$($d.cell): Excel $v, expected $($d.value)")
        }
      }
      Add-Check "edit of $($exp.edit.sheet)!$($exp.edit.cell) recalculates $(@($exp.edit.dependents).Count) dependents" ($editBad.Count -eq 0) @($editBad)
    }
  } finally {
    # Closed without saving (the workbook was opened read-only and edited only in memory).
    if ($wb -ne $null) {
      try { $wb.Close($false) } catch { }
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb)
      $wb = $null
    }
  }
}

function Invoke-Collect {
  for ($k = 0; $k -lt 2; $k++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers() }
}

$xl = $null; $excelPid = $null; $watchdog = $null
try {
  try {
    $xl = New-Object -ComObject Excel.Application
  } catch {
    $result.notRunReason = "Excel could not be started through COM: $($_.Exception.Message)"
    Write-Report; exit 2
  }
  $result.ran = $true
  $result.excel = "$($xl.Version) build $($xl.Build)"
  [int]$procId = 0
  [void][AcceptXlsx.Native]::GetWindowThreadProcessId([System.IntPtr]$xl.Hwnd, [ref]$procId)
  $excelPid = $procId
  # Watchdog: a separate process that stops only this Excel if the script hangs.
  $watchdog = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
    '-NoProfile', '-NonInteractive', '-Command',
    "Start-Sleep -Seconds $TimeoutSeconds; Stop-Process -Id $excelPid -Force -ErrorAction SilentlyContinue")
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $xl.ScreenUpdating = $false
  $xl.EnableEvents = $false
  $xl.AskToUpdateLinks = $false
  $xl.AutomationSecurity = 3 # msoAutomationSecurityForceDisable

  Invoke-WorkbookChecks $xl
} catch {
  Add-Check 'script completed' $false $_.Exception.Message
} finally {
  # Every COM object of the checks is out of scope: collect twice, then quit and release Excel, and collect again.
  Invoke-Collect
  if ($xl -ne $null) {
    try { $xl.Quit() } catch { }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    $xl = $null
  }
  Invoke-Collect
  if ($excelPid) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ((Get-Process -Id $excelPid -ErrorAction SilentlyContinue) -and $sw.Elapsed.TotalSeconds -lt 15) { Start-Sleep -Milliseconds 200 }
    if (Get-Process -Id $excelPid -ErrorAction SilentlyContinue) {
      # Last resort: this Excel was started by the script, holds only the script's workbook, and did not quit.
      Stop-Process -Id $excelPid -Force -ErrorAction SilentlyContinue
      $result.excelKilled = $true
    } else {
      $result.excelQuit = $true
      $result.quitSeconds = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
    }
  }
  if ($watchdog -ne $null) { Stop-Process -Id $watchdog.Id -Force -ErrorAction SilentlyContinue }
}
Write-Report
if ($result.pass) { exit 0 } else { exit 1 }
