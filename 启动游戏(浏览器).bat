@echo off
setlocal
cd /d "%~dp0"

echo [1/3] closing old server on port 8787...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8787" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1

echo [2/3] building web bundle...
call node tools\build-web.mjs
if errorlevel 1 goto build_failed

echo [3/3] starting server...
start "newworld-server" /min cmd /c "node tools\serve.mjs"
timeout /t 2 >nul
start "" http://127.0.0.1:8787

echo.
echo Opened http://127.0.0.1:8787
echo Close the minimized "newworld-server" window to stop the game.
timeout /t 5 >nul
exit /b 0

:build_failed
echo.
echo build failed. See the output above.
pause
exit /b 1
