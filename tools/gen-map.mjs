// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成「代码地图」：docs/MAP.md。
 *
 * 一个文件看完：谁在哪、干什么、对外给了什么函数（带签名）。
 * 目的是修 bug 时不用一层层翻目录。
 *
 * 只写机器能确定的（签名从源码提取）；「为什么」仍看 areas / systems。
 *
 * 用法：node tools/gen-map.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["game", "tools"];
const SKIP_DIRS = new Set(["node_modules", "web", "saves", "desktop", "docs"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
      walk(full, out);
      continue;
    }
    if (!/\.(ts|mjs|js)$/.test(name)) continue;
    out.push(relative(process.cwd(), full).replaceAll("\\", "/"));
  }
  return out;
}

/** 文件头一行说明。 */
function summaryOf(source) {
  const stripped = source
    .replace(/^\uFEFF/, "")
    .replace(/^(?:\s*\/\/[^\n]*\n)+/, "")
    .replace(/^\s+/, "");
  const block = stripped.match(/^\/\*\*([\s\S]*?)\*\//);
  const text = block === null ? stripped.split("\n")[0] : block[1];
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("SPDX"))[0] ?? "";
}

function signaturesOf(source) {
  const out = [];
  const oneLine = (text) => text.replace(/\s+/g, " ").trim();

  for (const match of source.matchAll(
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([\s\S]*?)\)\s*(?::\s*([^{]+))?\{/g,
  )) {
    const name = match[1];
    const params = oneLine(match[2]);
    const returns = match[3] === undefined ? "" : oneLine(match[3]);
    out.push(`${name}(${params})${returns === "" ? "" : " → " + returns}`);
  }

  for (const match of source.matchAll(/export\s+interface\s+([A-Za-z0-9_$]+)/g)) {
    out.push(`interface ${match[1]}`);
  }
  for (const match of source.matchAll(/export\s+type\s+([A-Za-z0-9_$]+)/g)) {
    out.push(`type ${match[1]}`);
  }
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*[:=]/g)) {
    out.push(`const ${match[1]}`);
  }

  return out;
}

function layerOf(file) {
  if (file.startsWith("game/engine/core/src")) return "内核 engine/core";
  if (file.startsWith("game/systems")) return "系统 game/systems";
  if (file.startsWith("game/worlds")) return "世界数据 game/worlds";
  if (file.startsWith("tools/client")) return "页面脚本 tools/client";
  if (file.startsWith("tools")) return "工具 tools";
  return "其它";
}

const ORDER = ["内核 engine/core", "系统 game/systems", "页面脚本 tools/client", "工具 tools", "世界数据 game/worlds", "其它"];

const files = ROOTS.flatMap((root) => (statSync(root).isDirectory() ? walk(root) : []))
  .filter((file) => !/\.test\.(ts|js)$/.test(file))
  .sort();

const byLayer = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const entry = {
    file,
    summary: summaryOf(source),
    signatures: signaturesOf(source),
    lines: source.split("\n").length,
    tests: files.includes(file.replace(/\.(ts|mjs|js)$/, ".test.ts")),
  };
  const layer = layerOf(file);
  if (!byLayer.has(layer)) byLayer.set(layer, []);
  byLayer.get(layer).push(entry);
}

const parts = [
  "# 代码地图（自动生成）",
  "",
  "> 由 `node tools/gen-map.mjs` 生成，**不要手改**。",
  "> 目标是「修 bug 时一眼找到该看哪个文件」：每个文件一行说明 + 对外函数签名。",
  "> 为什么这么设计，看 [areas/](areas) 与 [systems/](systems)。",
  "",
  "## 调用链（从上到下）",
  "",
  "```",
  "浏览器页面 tools/client/*.js",
  "   ↓ fetch",
  "tools/serve.mjs（HTTP 接口、会话、快照）",
  "   ↓ 选择启用哪些规则",
  "game/systems/rules/index.ts（RULE_TABLE）",
  "   ↓ evaluate",
  "game/engine/core/src/rules/*.ts（规则处理器）",
  "   ↓ 返回 effects",
  "game/engine/core/src/store.ts（应用效果、推进时钟）",
  "   ↓ snapshot",
  "game/systems/render/*（投影成画面数据）",
  "   ↓",
  "浏览器画布 + HUD",
  "```",
  "",
  "## 核心接口速查",
  "",
  "| 接口 | 在哪 | 作用 |",
  "|---|---|---|",
  "| `RuleTools` | `game/engine/core/src/event/evaluate.ts` | 宿主给规则的能力：`offsets` / `select` / `canEnter` |",
  "| `EvaluateContext` | 同上 | 规则能看到的：`frame` / `view` / `children` / `tools` |",
  "| `Scene` / `SceneResult` | `game/systems/scene/scene.ts` | 场景契约：`handle` / `describe` / `snapshot` / `restore` |",
  "| `LoadedWorld` | `game/engine/core/src/pack/load.ts` | 加载结果：空间、模板、地形、群系、出生点 |",
  "| `connectDeclarations` | `game/engine/core/src/bind.ts` | 两边各自声明 → 连接表 + 诊断 |",
  "| `buildPassage` | `game/systems/rules/passage.ts` | 物种 × 地形 → 通行表 |",
  "",
  "## 文件清单",
  "",
];

for (const layer of ORDER) {
  const entries = byLayer.get(layer);
  if (entries === undefined) continue;

  parts.push(`### ${layer}`, "");
  for (const entry of entries) {
    const test = entry.tests ? " · 有测试" : "";
    parts.push(`- **\`${entry.file}\`**（${entry.lines} 行${test}）`);
    if (entry.summary.length > 0) parts.push(`  ${entry.summary}`);
    for (const signature of entry.signatures) parts.push(`  - \`${signature}\``);
  }
  parts.push("");
}

parts.push(
  "## 找东西的几条路",
  "",
  "| 想找 | 去哪 |",
  "|---|---|",
  "| 某个规则怎么算 | `game/engine/core/src/rules/` |",
  "| 某个 HTTP 接口 | `tools/serve.mjs`（搜 `request.url`） |",
  "| 存档写了什么 | `saveGame` / `loadGame`（`tools/serve.mjs`） |",
  "| 画面怎么画 | `game/systems/render/` |",
  "| HUD 某个块 | `tools/client/hud/` |",
  "| 数据格式 | `game/engine/core/src/pack/definitions.ts` |",
  "| 文档 | [README.md](README.md) 的路由表 |",
  "",
);

writeFileSync("docs/MAP.md", parts.join("\n"), "utf8");
console.log(`写入 docs/MAP.md：${files.length} 个文件`);
