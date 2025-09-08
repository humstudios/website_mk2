@echo off
setlocal
cd /d "%~dp0"

REM Start dev server in a separate window with lower log noise
start "Hum Studios Dev Server" "%AppData%\npm\wrangler.cmd" pages dev . --port 8788 --log-level warn

REM Give it a moment to boot, then open the browser
REM timeout /t 2 /nobreak >nul
REM start "" http://127.0.0.1:8788/

echo Opened http://127.0.0.1:8788/ in your browser.
echo Close the "Hum Studios Dev Server" window to stop the server.
echo (If the port is busy, edit this file and change 8788 to 8789.)
pause
endlocal
