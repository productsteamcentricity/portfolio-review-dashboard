<#
Office acceptance of one deck in PowerPoint through COM (local only, never in CI; ARCHITECTURE section 15, test T-10).
Windows PowerShell 5.1:
  powershell.exe -NoProfile -NonInteractive -File scripts\office\accept-pptx.ps1 -Path <pptx> -Inventory <json> -PngDir <dir> -Report <json>
Written by scripts/office/run-acceptance.ts. The inventory JSON is { "slides": [ { "shapes": n, "charts": n, "tables": n } ] },
from the Node side's own reading of the deck. The script records whether PowerPoint was already running, opens the deck
read-only without a window, detects a repair or a refusal, compares the slide count and each slide's shape, chart and
table counts with the inventory, exports each slide as a 1920 x 1080 PNG for visual review (when -PngDir is given),
closes the deck and quits PowerPoint only when this script started it. Exit code 0 when every check passed, 1 when
one failed, 2 when not run.
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
  wasRunning = $false; quit = $false; checks = $checks; pngs = @(); notRunReason = $null
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

$result.wasRunning = (@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count -gt 0)
$pp = $null; $deck = $null; $pptPid = $null; $watchdog = $null
try {
  try {
    $pp = New-Object -ComObject PowerPoint.Application
  } catch {
    $result.notRunReason = "PowerPoint could not be started through COM: $($_.Exception.Message)"
    Write-Report; exit 2
  }
  $result.ran = $true
  $result.powerpoint = "$($pp.Version) build $($pp.Build)"
  $pp.DisplayAlerts = 1 # ppAlertsNone
  if (-not $result.wasRunning) {
    [int]$procId = 0
    try { [void][AcceptPptx.Native]::GetWindowThreadProcessId([System.IntPtr]$pp.HWND, [ref]$procId) } catch { }
    if ($procId -eq 0) { $procId = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending)[0].Id }
    $pptPid = $procId
    $watchdog = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
      '-NoProfile', '-NonInteractive', '-Command',
      "Start-Sleep -Seconds $TimeoutSeconds; Stop-Process -Id $pptPid -Force -ErrorAction SilentlyContinue")
  }

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
} catch {
  if ($result.opened) { Add-Check 'script completed' $false $_.Exception.Message }
} finally {
  if ($deck -ne $null) { try { $deck.Close() } catch { } ; [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck) }
  if ($pp -ne $null) {
    if (-not $result.wasRunning) { try { $pp.Quit(); $result.quit = $true } catch { } }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp)
  }
  $deck = $null; $pp = $null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers(); [GC]::Collect()
  if ($pptPid -and -not $result.wasRunning) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ((Get-Process -Id $pptPid -ErrorAction SilentlyContinue) -and $sw.Elapsed.TotalSeconds -lt 15) { Start-Sleep -Milliseconds 200 }
    if (Get-Process -Id $pptPid -ErrorAction SilentlyContinue) { Stop-Process -Id $pptPid -Force -ErrorAction SilentlyContinue; $result.powerpointKilled = $true }
  }
  if ($watchdog -ne $null) { Stop-Process -Id $watchdog.Id -Force -ErrorAction SilentlyContinue }
}
Write-Report
if ($result.pass) { exit 0 } else { exit 1 }
