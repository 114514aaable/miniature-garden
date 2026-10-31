@echo off
setlocal
cd /d "%~dp0"

echo building web bundle...
call node tools\build-web.mjs
if errorlevel 1 goto build_failed

echo starting server on 127.0.0.1:8787 ...
start "newworld-server" /min cmd /c "node tools\serve.mjs"

timeout /t 2 >nul
start "" http://127.0.0.1:8787

echo.
echo Game opened in your browser.
echo To stop the server, close the minimized "newworld-server" window.
timeout /t 5 >nul
exit /b 0

:build_failed
echo.
echo build failed. See the output above.
pause
exit /b 1
