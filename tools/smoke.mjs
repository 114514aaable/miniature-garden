// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * HTTP 冒烟：真实起一个 serve，走「开局 → 动作 → 存档 → 读档 → 继续」。
 *
 * 单元测试碰不到 serve.mjs，读档坏了也发现不了；这个脚本就是那条缺失的回归线。
 * 用法：node tools/smoke.mjs
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";

const repoRoot = new URL("..", import.meta.url);

function fail(message, extra) {
  const detail = extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 900);
  throw new Error(message + detail);
}

async function startServer() {
  // 沙箱里不能开子进程管道：用 PORT_FILE 传端口，stdio 全部 ignore
  const portFile = repoRoot.pathname.replace(/^\/([A-Za-z]:)/, "$1") + "/.tmp/smoke-port.txt";
  mkdirSync(repoRoot.pathname.replace(/^\/([A-Za-z]:)/, "$1") + "/.tmp", { recursive: true });
  try {
    unlinkSync(portFile);
  } catch {
    // 不存在就继续
  }

  const child = spawn(process.execPath, ["tools/serve.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "0", PORT_FILE: portFile },
    stdio: "ignore",
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, "utf8").trim();
      if (/^\d+$/.test(port)) {
        return { child, base: `http://127.0.0.1:${port}`, output: () => "" };
      }
    }
    await sleep(100);
  }

  child.kill();
  throw new Error("服务没有在 15 秒内启动");
}

async function main() {
  const { child, base, output } = await startServer();
  const created = [];

  const post = async (path, body = {}) => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      fail(`${path} 返回的不是 JSON（${response.status}）：${text.slice(0, 200)}`);
    }
    return { status: response.status, json };
  };

  try {
    // 1 就绪
    let worlds;
    for (let i = 0; i < 50; i += 1) {
      try {
        const response = await fetch(base + "/api/worlds");
        worlds = await response.json();
        break;
      } catch {
        await sleep(100);
      }
    }
    if (!worlds || !Array.isArray(worlds.worlds)) fail("/api/worlds 不可用");

    const playable = worlds.worlds.find((world) => world.root === true && world.ok === true);
    if (!playable) fail("/api/worlds 里没有可玩的根包", worlds);

    // 2 开局
    const start = await post("/api/start", { id: playable.id, seed: 1 });
    if (start.json.launcher === true) fail("/api/start 回到了启动器", start.json);
    if (typeof start.json.worldId !== "string") fail("/api/start 没有 worldId", start.json);
    created.push(start.json.worldId);
    const startTick = start.json.tick;

    // 3 走一步
    const act = await post("/api/act", { dir: "d" });
    if (act.json.snapshot === undefined) fail("/api/act 没有 snapshot", act.json);

    // 4 存一个带非法文件名符号的名字
    const saveName = "smoke/存档?";
    const save = await post("/api/save", { name: saveName });
    if (save.json.error !== undefined) fail("/api/save 失败", save.json);
    const savedTick = save.json.tick;

    // 5 按名字读
    const loadNamed = await post("/api/load", { name: saveName });
    if (loadNamed.json.error !== undefined || loadNamed.json.launcher === true) {
      fail("/api/load {name} 失败", loadNamed.json);
    }
    if (loadNamed.json.tick !== savedTick) {
      fail(`读档 tick 不一致：保存 ${savedTick}，读回 ${loadNamed.json.tick}`, loadNamed.json);
    }

    // 6 自动读最新
    const loadLatest = await post("/api/load", {});
    if (loadLatest.json.error !== undefined || loadLatest.json.launcher === true) {
      fail("/api/load {} 失败", loadLatest.json);
    }

    // 7 从最近的世界继续
    const resume = await post("/api/start", { instanceId: start.json.worldId });
    if (resume.json.launcher === true) fail("/api/start {instanceId} 失败", resume.json);
    if (resume.json.tick !== savedTick) {
      fail(`继续游戏的 tick 不一致：期望 ${savedTick}，实际 ${resume.json.tick}`, resume.json);
    }

    // 8 清理：删掉测试世界
    await post("/api/world/delete", { id: start.json.worldId });
    created.length = 0;

    void startTick;
    console.log("smoke ok");
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    for (const id of created) {
      try {
        await fetch(base + "/api/world/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // 清理失败不掩盖原始错误
      }
    }
    child.kill();
    await sleep(150);
  }
}

try {
  await main();
} catch (error) {
  console.error("smoke failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
