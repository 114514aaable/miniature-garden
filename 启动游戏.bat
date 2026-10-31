@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist "desktop\node_modules" (
  echo 第一次运行需要下载 Electron，可能要几分钟……
  pushd desktop
  call npm install
  if errorlevel 1 (
    echo.
    echo 安装失败：检查网络，或者先装好 Node.js。
    pause
    exit /b 1
  )
  popd
)

pushd desktop
call npm start
popd
