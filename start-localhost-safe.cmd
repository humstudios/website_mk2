@echo off
REM Safe localhost-only dev server (no directory listing, no cache)
setlocal
set PORT=8000
set ADDRESS=127.0.0.1
echo Starting safe local server on http://%ADDRESS%:%PORT%/
echo (Press CTRL+C in this window to stop)
where http-server >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
  http-server -p %PORT% -a %ADDRESS% -c-1 -d false .
) ELSE (
  npx -y http-server -p %PORT% -a %ADDRESS% -c-1 -d false .
)
