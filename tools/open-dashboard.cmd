@echo off
rem ===========================================================================
rem  open-dashboard.cmd - open the dashboard from this repository in the browser.
rem  Starts the local preview server (tools\serve-dashboard.js, 127.0.0.1:8099)
rem  in a minimised window if it is not already running, then opens the page.
rem  Close the "Portfolio Review server" window to stop the server.
rem ===========================================================================
setlocal
set "REPO=%~dp0.."
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\dev\tools\node\node.exe"
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8099 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  start "Portfolio Review server" /min "%NODE%" "%REPO%\tools\serve-dashboard.js"
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 1200"
)
start "" "http://127.0.0.1:8099/"
endlocal
