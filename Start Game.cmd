@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.12 or newer, then try again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 goto failure
)
call npm.cmd run build
if errorlevel 1 goto failure
call npm.cmd start
if errorlevel 1 goto failure
exit /b 0
:failure
echo.
echo The game could not start. The error is shown above.
pause
exit /b 1
