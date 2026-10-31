// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 桌面壳：开一个窗口，把本地服务装进去。
 *
 * 两个坑，这里都处理了：
 *   1. Electron 自带的 Node 是 20，跑不了 .ts（类型剥离要 Node 22+），
 *      所以服务用系统 node 起，不是 process.execPath。
 *   2. 某些显卡驱动下 Electron 一启动就崩（0x80000003），
 *      所以关掉硬件加速，并且把崩溃原因写进 desktop/electron.log。
 */

const electron = require("electron");
const { spawn } = require("node:child_process");
const { appendFileSync } = require("node:fs");
const path = require("node:path");

// 如果 ELECTRON_RUN_AS_NODE 被设置，Electron 会把自己当 node 跑，
// require("electron") 拿到的是一个路径字符串，app 是 undefined。
// 这种情况给出人话，而不是一个看不懂的 TypeError。
if (typeof electron !== "object" || electron.app === undefined) {
  console.error(
    [
      "Electron 没有以窗口模式启动。",
      "多半是环境变量 ELECTRON_RUN_AS_NODE 被设置了。",
      "在终端里执行：  Remove-Item Env:\\ELECTRON_RUN_AS_NODE",
      "然后重新运行。",
    ].join("\n"),
  );
  process.exit(1);
}

const { app, BrowserWindow, dialog } = electron;

const ROOT = path.join(__dirname, "..");
const LOG = path.join(__dirname, "electron.log");
const PORT = 8790;
const URL = `http://127.0.0.1:${PORT}`;

let server = null;
let window = null;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    appendFileSync(LOG, line, "utf8");
  } catch {
    // 日志写不进去也不能影响启动
  }
  console.log(message);
}

log(`starting; electron=${process.versions.electron} node=${process.versions.node}`);

// 先关硬件加速：某些驱动会让主进程在创建窗口前就崩。
app.disableHardwareAcceleration();

process.on("uncaughtException", (error) => {
  log(`uncaughtException: ${error && error.stack ? error.stack : error}`);
});
process.on("unhandledRejection", (reason) => {
  log(`unhandledRejection: ${reason}`);
});

app.on("child-process-gone", (_event, details) => {
  log(`child-process-gone: ${details.type} ${details.reason} (${details.exitCode})`);
});
app.on("render-process-gone", (_event, _contents, details) => {
  log(`render-process-gone: ${details.reason} (${details.exitCode})`);
});

/** 找系统 node：Electron 自带的跑不了 .ts。 */
function findNode() {
  const candidates = [
    process.env.NEWWORLD_NODE,
    process.env.NODE_EXE,
    "node",
  ].filter(Boolean);

  return candidates[0];
}

function startServer() {
  const node = findNode();
  log(`spawning server with: ${node}`);

  server = spawn(node, [path.join(ROOT, "tools", "serve.mjs")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
    shell: process.platform === "win32" && node === "node",
  });

  server.on("error", (error) => {
    log(`server spawn error: ${error.message}`);
  });
  server.on("exit", (code, signal) => {
    log(`server exited: code=${code} signal=${signal}`);
  });
}

async function waitForServer(tries = 80) {
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
  window.webContents.on("did-fail-load", (_event, code, description) => {
    log(`did-fail-load: ${code} ${description}`);
  });
  window.on("closed", () => {
    window = null;
  });
}

app.whenReady().then(async () => {
  log("app ready");
  startServer();

  const ready = await waitForServer();
  log(`server ready: ${ready}`);

  if (!ready) {
    dialog.showErrorBox(
      "启动失败",
      `本地服务没有起来：${URL}\n详见 desktop\\electron.log 和终端输出。`,
    );
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  log(`whenReady failed: ${error && error.stack ? error.stack : error}`);
  dialog.showErrorBox("启动失败", String(error));
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
