@echo off
setlocal
cd /d "%~dp0"

echo starting server on 127.0.0.1:8787 ...
start "newworld-server" /min cmd /c "node tools\serve.mjs"

timeout /t 2 >nul
start "" http://127.0.0.1:8787

echo.
echo Game opened in your browser.
echo To stop the server, close the minimized "newworld-server" window.
timeout /t 5 >nul
exit /b 0
