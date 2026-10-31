@echo off
setlocal
cd /d "%~dp0"

if not exist "desktop\package.json" goto no_desktop

echo [1/3] checking node...
where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_node

echo [2/3] checking electron...
if exist "desktop\node_modules\electron\package.json" goto run

echo     first run: npm install (may take a few minutes)
pushd desktop
call npm install --no-audit --no-fund > install.log 2>&1
set INSTALL_CODE=%errorlevel%
popd
if not "%INSTALL_CODE%"=="0" goto install_failed

:run
echo [3/3] starting game...
pushd desktop
call npm start
set RUN_CODE=%errorlevel%
popd
echo.
echo game exited, code=%RUN_CODE%
pause
exit /b 0

:no_desktop
echo.
echo desktop\package.json not found. Is the folder complete?
pause
exit /b 1

:no_node
echo.
echo Node.js not found in PATH.
echo Install it from https://nodejs.org/ then run this file again.
pause
exit /b 1

:install_failed
echo.
echo npm install failed, code=%INSTALL_CODE%.
echo See desktop\install.log for details.
pause
exit /b 1
