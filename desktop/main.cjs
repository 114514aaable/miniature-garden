// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 桌面壳：开一个窗口，把本地服务装进去。
 *
 * 为什么还要起服务，而不是直接读文件：
 *   世界加载、规则求值、绘制指令都在服务端做（见 tools/serve.mjs），
 *   窗口只是一个浏览器。以后要做联机，这个结构不用改。
 *
 * 引擎仍然是零依赖；Electron 只属于这个壳。
 */

const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PORT = 8790;
const URL = `http://127.0.0.1:${PORT}`;

let server = null;
let window = null;

/** 等服务起来：轮询到通为止，比 sleep 固定时间可靠。 */
async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(URL, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // 还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function startServer() {
  // ELECTRON_RUN_AS_NODE：让 electron 可执行文件当 node 用
  server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: "#14161a",
    autoHideMenuBar: true,
    title: "新世界",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadURL(URL);
  window.on("closed", () => {
    window = null;
  });
}

app.whenReady().then(async () => {
  startServer();

  const ready = await waitForServer();
  if (!ready) {
    const { dialog } = require("electron");
    dialog.showErrorBox("启动失败", `本地服务没有起来：${URL}\n看终端里的报错。`);
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("quit", () => {
  if (server !== null) {
    server.kill();
    server = null;
  }
});
