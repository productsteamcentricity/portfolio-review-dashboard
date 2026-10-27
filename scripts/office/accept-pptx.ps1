<#
Office acceptance of one deck in PowerPoint through COM (local only, never in CI; ARCHITECTURE section 15, test T-10).
Windows PowerShell 5.1:
  powershell.exe -NoProfile -NonInteractive -File scripts\office\accept-pptx.ps1 -Path <pptx> -Inventory <json> -PngDir <dir> -Report <json>
Written by scripts/office/run-acceptance.ts. The inventory JSON is { "slides": [ { "shapes": n, "charts": n, "tables": n } ] },
from the Node side's own reading of the deck. The script records whether PowerPoint was already running, opens the deck
read-only without a window, detects a repair or a refusal, compares the slide count and each slide's shape, chart and
table counts with the inventory, exports each slide as a 1920 x 1080 PNG for visual review (when -PngDir is given),
closes the deck without saving and quits PowerPoint only when this script started it.
PowerPoint runs as a single instance, so a deck a person opens during the run opens in the script's instance. The
script therefore never quits or stops an instance that holds a presentation or a window that is not its own: it
reports "not killed" with the reason instead. When PowerPoint is already open with a presentation or a window, the
script does not open its deck in that instance at all and reports "not run" (exit 2). Every COM object of the checks lives inside the function
Invoke-DeckChecks; after it returns the garbage collector runs twice before Quit, and the process is stopped only as a
last resort, when it has no window and is still the process the script started (its ProcessName and the StartTime
recorded at launch). Every Stop-Process of the script, the watchdog's included, makes those checks (Stop-OwnProcess).
Exit code 0 when every check passed, 1 when one failed, 2 when not run.
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
$result = [ordered]@{
  tool = 'accept-pptx.ps1'; file = $Path; ran = $false; pass = $false; powerpoint = $null; opened = $false
  wasRunning = $false; quit = $false; powerpointKilled = $false; notKilled = $null; quitSeconds = $null; watchdogFired = $false
  checks = $checks; pngs = @(); notRunReason = $null
}
function Write-Report {
  $result.pass = $result.ran -and $result.opened -and (@($checks | Where-Object { -not $_.ok }).Count -eq 0)
  $result | ConvertTo-Json -Depth 8 | Out-File -FilePath $Report -Encoding utf8
}

$full = [System.IO.Path]::GetFullPath($Path)
if ($full.Length -ge 218) { $result.notRunReason = "path of $($full.Length) characters (218 or more)"; Write-Report; exit 2 }
$inv = Get-Content -LiteralPath $Inventory -Raw -Encoding UTF8 | ConvertFrom-Json

Add-Type -Namespace AcceptPptx -Name Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(System.IntPtr hWnd, out int processId);
'@

function Invoke-Collect {
  for ($k = 0; $k -lt 2; $k++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers() }
}

# The process with this id, only while it is still the one recorded at launch (same ProcessName and StartTime);
# $null when it has exited or the id now names another process.
function Get-OwnProcess([int]$id, [string]$name, [long]$startTicks) {
  $p = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($p -eq $null) { return $null }
  try {
    if ($p.ProcessName -ne $name -or $p.StartTime.ToFileTimeUtc() -ne $startTicks) { return $null }
  } catch { return $null }
  return $p
}
# Every Stop-Process of the script: only the process recorded at launch, and (PowerPoint) only while it shows no window.
function Stop-OwnProcess([int]$id, [string]$name, [long]$startTicks, [switch]$WindowAllowed) {
  $p = Get-OwnProcess $id $name $startTicks
  if ($p -eq $null) { return $false }
  if (-not $WindowAllowed -and $p.MainWindowHandle -ne [System.IntPtr]::Zero) { return $false }
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  return $true
}

# Opens the deck without a window, runs every check and closes it. Every COM object it touches is a local of this
# function, so none survives it.
function Invoke-DeckChecks($pp) {
  $deck = $null
  try {
    $openError = $null
    try {
      $deck = $pp.Presentations.Open($full, -1, 0, 0) # ReadOnly, not Untitled, no window
    } catch {
      $openError = $_.Exception.Message
    }
    if ($deck -eq $null) {
      Add-Check 'opens without repair' $false "open failed: $openError"
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
    # Closed without saving (opened read-only).
    if ($deck -ne $null) {
      try { $deck.Saved = -1 } catch { }
      try { $deck.Close() } catch { }
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck)
      $deck = $null
    }
  }
}

$result.wasRunning = (@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count -gt 0)
$pp = $null; $pptPid = $null; $pptStart = $null; $watchdog = $null; $watchdogStart = $null; $prevAlerts = $null
try {
  try {
    $pp = New-Object -ComObject PowerPoint.Application
  } catch {
    $result.notRunReason = "PowerPoint could not be started through COM: $($_.Exception.Message)"
    Write-Report; exit 2
  }
  $result.powerpoint = "$($pp.Version) build $($pp.Build)"
  if ($result.wasRunning) {
    # The running instance is a person's: if it holds a presentation or a window, the check would share it (its
    # alerts setting, a repair dialog of the negative control), so the deck is not opened and the run is "not run".
    $open = -1; $wins = -1
    try { $open = [int]$pp.Presentations.Count } catch { }
    try { $wins = [int]$pp.Windows.Count } catch { }
    if ($open -ne 0 -or $wins -ne 0) {
      $result.notRunReason = "PowerPoint is already open with $open presentation(s) and $wins window(s) that are not the script's; not run, so that instance is left alone"
      $result.notKilled = 'PowerPoint was running before the script: not quit, not killed'
      Write-Report; exit 2
    }
    $prevAlerts = $pp.DisplayAlerts
  }
  $result.ran = $true
  $pp.DisplayAlerts = 1 # ppAlertsNone
  if (-not $result.wasRunning) {
    [int]$procId = 0
    try { [void][AcceptPptx.Native]::GetWindowThreadProcessId([System.IntPtr]$pp.HWND, [ref]$procId) } catch { }
    if ($procId -eq 0) { $procId = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending)[0].Id }
    $own = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($procId -ne 0 -and $own -ne $null -and $own.ProcessName -eq 'POWERPNT') {
      $pptPid = $procId
      $pptStart = $own.StartTime.ToFileTimeUtc()
      # Watchdog: stops only this PowerPoint (same id, name and start time) if the script hangs, and never while it
      # shows a window (a person's deck).
      $watchdog = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
        '-NoProfile', '-NonInteractive', '-Command',
        "Start-Sleep -Seconds $TimeoutSeconds; `$p = Get-Process -Id $pptPid -ErrorAction SilentlyContinue; if (`$p -and `$p.ProcessName -eq 'POWERPNT' -and `$p.StartTime.ToFileTimeUtc() -eq $pptStart -and `$p.MainWindowHandle -eq 0) { Stop-Process -Id $pptPid -Force -ErrorAction SilentlyContinue }")
      try { $watchdogStart = $watchdog.StartTime.ToFileTimeUtc() } catch { $watchdogStart = $null }
    }
  }

  Invoke-DeckChecks $pp
} catch {
  if ($result.opened) { Add-Check 'script completed' $false $_.Exception.Message }
} finally {
  Invoke-Collect
  if ($pp -ne $null) {
    if ($result.wasRunning -and $prevAlerts -ne $null) { try { $pp.DisplayAlerts = $prevAlerts } catch { } }
    if (-not $result.wasRunning) {
      # Quit only an instance that holds nothing but the script's own (now closed) deck.
      $others = 0; $windows = 0
      try { $others = [int]$pp.Presentations.Count } catch { $others = -1 }
      try { $windows = [int]$pp.Windows.Count } catch { $windows = -1 }
      if ($others -eq 0 -and $windows -eq 0) {
        try { $pp.Quit(); $result.quit = $true } catch { }
      } else {
        $result.notKilled = "PowerPoint holds $others other presentation(s) and $windows window(s): not quit, not killed"
      }
    }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp)
    $pp = $null
  }
  Invoke-Collect
  # The watchdog is stopped before the wait, so the wait alone decides; one that has exited already fired.
  if ($watchdog -ne $null) {
    if ($watchdog.HasExited) { $result.watchdogFired = $true }
    elseif ($watchdogStart -ne $null) { [void](Stop-OwnProcess $watchdog.Id 'powershell' $watchdogStart -WindowAllowed) }
  }
  if ($pptPid -and -not $result.wasRunning -and $result.notKilled -eq $null) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ((Get-OwnProcess $pptPid 'POWERPNT' $pptStart) -and $sw.Elapsed.TotalSeconds -lt 15) { Start-Sleep -Milliseconds 200 }
    $p = Get-OwnProcess $pptPid 'POWERPNT' $pptStart
    if ($p) {
      if ($p.MainWindowHandle -ne 0) {
        # A window appeared after Quit (a deck opened meanwhile): it is not the script's, so the process stays.
        $result.notKilled = 'PowerPoint shows a window that is not the script''s: not killed'
      } elseif (Stop-OwnProcess $pptPid 'POWERPNT' $pptStart) {
        # Last resort: the script's own PowerPoint, with no window and no presentation of anyone else, did not quit.
        $result.powerpointKilled = $true
      } else {
        $result.notKilled = 'PowerPoint changed before the last resort: not killed'
      }
    } elseif ($result.watchdogFired) {
      $result.powerpointKilled = $true
    } else {
      $result.quitSeconds = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
    }
  }
}
Write-Report
if ($result.pass) { exit 0 } else { exit 1 }
