<#
Office acceptance of one deck in PowerPoint through COM (local only, never in CI; ARCHITECTURE section 15, test T-10).
Windows PowerShell 5.1:
  powershell.exe -NoProfile -NonInteractive -File scripts\office\accept-pptx.ps1 -Path <pptx> -Inventory <json> -PngDir <dir> -Report <json>
Written by scripts/office/run-acceptance.ts. The inventory JSON is { "slides": [ { "shapes": n, "charts": n, "tables": n } ] },
from the Node side's own reading of the deck.

THE OWNER'S RULE (standing rule of 2 Nov 2026; docs/TESTING.md section 6.1). The owner's own PowerPoint may be open on
this PC with the owner's work in it, so the script:
  1. attaches only. It first looks for a running POWERPNT process (the task list); with none, or when attaching
     through GetActiveObject fails, the verdict is NOT RUN (exit code 2), and the script prints the absolute path of
     the synthetic deck for the owner to open by hand. It never starts PowerPoint.
  2. opens only its own synthetic deck, read-only and without a window (Presentations.Open with ReadOnly -1,
     Untitled 0, WithWindow 0), so nothing appears on the owner's screen and the owner's active window stays active.
  3. changes no application option: no alert, visibility or other application setting is written.
  4. closes only the deck it opened (marked saved, so PowerPoint asks nothing), in a finally block, and releases its
     COM references. It never asks PowerPoint to quit and never stops, kills or watches over any process.
  5. on a hang: the script stops at its own deadline between slides (verdict TIMEOUT, exit code 3) and still closes
     its deck. If a call into PowerPoint never returns, run-acceptance.ts stops waiting, reports TIMEOUT with the path
     of the deck left open, and leaves every process running; the owner closes that deck (opened without a window,
     it closes when the owner next closes PowerPoint). After a TIMEOUT the run starts no further deck in PowerPoint:
     each remaining one is NOT RUN ("not attempted: Office did not answer") with its path.
  6. the damaged-deck negative control is never run against the attached PowerPoint (it could raise a repair prompt
     on the owner's screen): run-acceptance.ts writes it and reports it NOT RUN with its path.

Checks: detects a repair or a refusal; compares the slide count and each slide's shape, chart and table counts with
the inventory; exports each slide as a 1920 x 1080 PNG for visual review (when -PngDir is given).
Exit code 0 when every check passed, 1 when one failed, 2 when not run, 3 on the deadline (TIMEOUT).
#>
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][string]$Inventory,
  [string]$PngDir = '',
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
  tool = 'accept-pptx.ps1'; file = $full; verdict = 'not run'; ran = $false; pass = $false; powerpoint = $null
  officeRunning = $false; attached = $false; opened = $false; checks = $checks; pngs = @(); notRunReason = $null
  timedOut = $false; closed = $false; leftOpenForOwner = $null
}
function Write-Report {
  $result.pass = $result.ran -and $result.opened -and -not $result.timedOut -and (@($checks | Where-Object { -not $_.ok }).Count -eq 0)
  if ($result.timedOut) { $result.verdict = 'timeout' }
  elseif (-not $result.ran) { $result.verdict = 'not run' }
  elseif ($result.pass) { $result.verdict = 'pass' }
  else { $result.verdict = 'fail' }
  $result | ConvertTo-Json -Depth 8 | Out-File -FilePath $Report -Encoding utf8
}
function Exit-NotRun([string]$reason) {
  $result.notRunReason = $reason
  Write-Report
  Write-Output "NOT RUN: $reason"
  Write-Output "Open by hand: $full"
  exit 2
}

if ($full.Length -ge 218) { Exit-NotRun "path of $($full.Length) characters (218 or more)" }
$inv = Get-Content -LiteralPath $Inventory -Raw -Encoding UTF8 | ConvertFrom-Json

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
function Test-Deadline([string]$step) {
  if ([DateTime]::UtcNow -gt $deadline) { throw "TIMEOUT before $step" }
}
# PowerPoint refuses calls while a dialog is open (RPC_E_CALL_REJECTED, RPC_E_SERVERCALL_RETRYLATER).
function Test-Busy($err) {
  $text = [string]$err
  try { $text += ' ' + ('0x{0:X8}' -f $err.Exception.HResult) } catch { }
  return ($text -match '0x80010001|0x8001010A|rejected|retry later')
}
function Invoke-Collect {
  for ($k = 0; $k -lt 2; $k++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers() }
}

# Opens the deck without a window, runs every check and closes it. Every COM object it touches is a local of this
# function, and the deck is closed and released in its finally block.
function Invoke-DeckChecks($pp) {
  $deck = $null
  try {
    $openError = $null
    for ($try = 0; $try -lt 5 -and $deck -eq $null; $try++) {
      try {
        $deck = $pp.Presentations.Open($full, -1, 0, 0) # ReadOnly, not Untitled, no window
        $openError = $null
      } catch {
        $openError = $_
        if (-not (Test-Busy $_)) { break }
        Start-Sleep -Seconds 2
      }
    }
    if ($deck -eq $null -and $openError -ne $null -and (Test-Busy $openError)) { throw $openError }
    $result.ran = $true
    if ($deck -eq $null) {
      Add-Check 'opens without repair' $false "open failed: $($openError.Exception.Message)"
      throw 'the deck did not open'
    }
    $result.opened = $true
    $name = [string]$deck.Name
    Add-Check 'opens without repair' (-not ($name -match 'Repaired')) "name $name"

    $expected = @($inv.slides)
    Add-Check 'slide count equals the inventory' ($deck.Slides.Count -eq $expected.Count) "PowerPoint $($deck.Slides.Count), inventory $($expected.Count)"
    $bad = New-Object System.Collections.ArrayList
    $pngs = New-Object System.Collections.ArrayList
    for ($i = 1; $i -le $deck.Slides.Count; $i++) {
      Test-Deadline "slide $i"
      $slide = $deck.Slides.Item($i)
      $charts = 0; $tables = 0
      foreach ($s in $slide.Shapes) {
        if ($s.HasChart -eq -1) { $charts++ }
        if ($s.HasTable -eq -1) { $tables++ }
      }
      if ($i -le $expected.Count) {
        $e = $expected[$i - 1]
        if ($slide.Shapes.Count -ne [int]$e.shapes -or $charts -ne [int]$e.charts -or $tables -ne [int]$e.tables) {
          [void]$bad.Add("slide ${i}: shapes $($slide.Shapes.Count)/$($e.shapes), charts $charts/$($e.charts), tables $tables/$($e.tables)")
        }
      }
      if ($PngDir -ne '') {
        $png = Join-Path ([System.IO.Path]::GetFullPath($PngDir)) ('slide-{0:D2}.png' -f $i)
        $slide.Export($png, 'PNG', 1920, 1080)
        [void]$pngs.Add($png)
      }
    }
    Add-Check 'shapes, charts and tables per slide equal the inventory' ($bad.Count -eq 0) @($bad)
    $result.pngs = @($pngs)
    if ($PngDir -ne '') { Add-Check 'one PNG per slide' ($pngs.Count -eq $deck.Slides.Count) "$($pngs.Count) PNGs" }
  } finally {
    # Only the deck this script opened is closed (opened read-only; marked saved, so nothing is asked).
    if ($deck -ne $null) {
      try {
        $deck.Saved = -1
        $deck.Close()
        $result.closed = $true
      } catch {
        $result.leftOpenForOwner = $full
        Write-Output "Could not close the synthetic deck; the owner closes it in PowerPoint: $full"
      }
      try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck) } catch { }
      $deck = $null
    }
  }
}

# 1. The task list first: no running PowerPoint, no run. PowerPoint is never started.
$running = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
$result.officeRunning = ($running.Count -gt 0)
if (-not $result.officeRunning) { Exit-NotRun 'PowerPoint is not running; the script attaches only and never starts it' }

$pp = $null
try {
  try {
    $pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
  } catch {
    Exit-NotRun "could not attach to the running PowerPoint: $($_.Exception.Message)"
  }
  $result.attached = $true
  try { $result.powerpoint = "$($pp.Version) build $($pp.Build)" } catch { }
  Invoke-DeckChecks $pp
} catch {
  $message = [string]$_.Exception.Message
  if ($message -match '^TIMEOUT') {
    $result.timedOut = $true
    Add-Check 'checks finished within the deadline' $false "$message ($TimeoutSeconds s)"
  } elseif (Test-Busy $_) {
    $result.ran = $false
    $result.notRunReason = "PowerPoint was busy (a dialog open): $message"
  } elseif ($result.opened) {
    Add-Check 'script completed' $false $message
  }
} finally {
  # Only the script's own references are released; the owner's PowerPoint keeps running as it was.
  if ($pp -ne $null) {
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) } catch { }
    $pp = $null
  }
  Invoke-Collect
}
Write-Report
if ($result.verdict -eq 'not run') { Write-Output "NOT RUN: $($result.notRunReason)"; Write-Output "Open by hand: $full" }
if ($result.verdict -eq 'pass') { exit 0 }
if ($result.verdict -eq 'not run') { exit 2 }
if ($result.verdict -eq 'timeout') { exit 3 }
exit 1
