// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 扫源码里的 import，画一张引用树。
 *
 * 用法：node tools/gen-tree.mjs [--out docs/dependency-tree.md]
 *
 * 只做三件事：
 *   1. 抽出每个文件的相对 import（忽略 'node:xxx' 与 /web|/client 这类浏览器路径）
 *   2. 从入口开始深度优先，标出环
 *   3. 输出「树」+「被谁引用」两张表
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOTS = ["tools", "game"];
const ENTRIES = [
  "tools/serve.mjs",
  "tools/client/game.js",
  "tools/client/launcher.js",
  "tools/client/shared.js",
  "tools/play.mjs",
  "tools/build-web.mjs",
];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

function listFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      listFiles(full, out);
    } else if (/\.(ts|mjs|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** 相对路径 → 仓库内 POSIX 路径；解析不到就返回 null。 */
function resolveSpecifier(fromFile, spec) {
  // 浏览器侧路径：/web/game/... → game/...（.js 换回 .ts），/client/x → tools/client/x
  if (spec.startsWith("/web/")) {
    const rel = spec.slice("/web/".length).replace(/\.js$/, ".ts");
    for (const candidate of [rel, rel.replace(/\.ts$/, ".js")]) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // 继续试
      }
    }
    return null;
  }
  if (spec.startsWith("/client/")) {
    const rel = "tools/client/" + spec.slice("/client/".length);
    try {
      if (statSync(rel).isFile()) return rel;
    } catch {
      return null;
    }
    return rel;
  }

  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, join(base, "index.ts"), join(base, "index.js")];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return relative(process.cwd(), candidate).replaceAll("\\", "/");
    } catch {
      // 试下一个
    }
  }
  return null;
}

function importsOf(file) {
  const text = readFileSync(file, "utf8");
  const specs = new Set();
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec !== undefined) specs.add(spec);
  }

  const resolved = [];
  for (const spec of specs) {
    const target = resolveSpecifier(file, spec);
    if (target !== null) resolved.push(target);
  }
  return resolved.sort();
}

function main() {
  const files = ROOTS.flatMap((root) => listFiles(root)).map((f) => relative(process.cwd(), f).replaceAll("\\", "/"));
  const graph = new Map(files.map((file) => [file, importsOf(join(process.cwd(), file))]));

  const lines = [];
  const onPath = new Set();
  const visited = new Set();

  function draw(file, depth) {
    const pad = "  ".repeat(depth);
    if (onPath.has(file)) {
      lines.push(`${pad}└─ ${file}  ⟲ 环`);
      return;
    }
    if (file.endsWith(".test.ts") || file.endsWith(".test.js")) return;
    if (visited.has(file)) {
      lines.push(`${pad}└─ ${file}  (已展开)`);
      return;
    }

    visited.add(file);
    onPath.add(file);
    lines.push(`${pad}${depth === 0 ? "" : "└─ "}${file}`);

    for (const child of graph.get(file) ?? []) {
      draw(child, depth + 1);
    }

    onPath.delete(file);
  }

  const layerOf = (file) => {
    if (file.startsWith("game/engine/core/")) return "内核";
    if (file.startsWith("game/systems/")) return "系统";
    if (file.startsWith("game/worlds/")) return "世界包";
    if (file.startsWith("tools/client/")) return "页面脚本";
    if (file.startsWith("tools/")) return "宿主工具";
    return "其它";
  };

  const layers = new Map();
  for (const file of files) {
    const layer = layerOf(file);
    layers.set(layer, (layers.get(layer) ?? 0) + 1);
  }

  lines.push("# 引用树", "", "> 由 `node tools/gen-tree.mjs` 生成。不含测试文件。", "");
  lines.push("## 分层概览", "", "| 层 | 文件数 |", "|---|---|");
  for (const [layer, count] of [...layers.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push("| " + layer + " | " + count + " |");
  }
  lines.push("");
  for (const entry of ENTRIES) {
    lines.push(`## ${entry}`, "", "```");
    draw(entry, 0);
    lines.push("```", "");
  }

  // 反向引用
  const reverse = new Map();
  for (const [file, deps] of graph) {
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, []);
      reverse.get(dep).push(file);
    }
  }

  lines.push("## 被谁引用（引用数最多的 20 个）", "");
  lines.push("| 文件 | 被引用 |", "|---|---|");
  const top = [...reverse.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 20);
  for (const [file, users] of top) {
    lines.push(`| \`${file}\` | ${users.length} 处：${users.slice(0, 4).map((u) => "`" + u + "`").join(", ")}${users.length > 4 ? " …" : ""} |`);
  }

  // 没有任何人引用的文件（入口除外）
  const orphans = files.filter(
    (file) => !reverse.has(file) && !ENTRIES.includes(file) && !/\.test\.(ts|js)$/.test(file),
  );
  lines.push("", "## 没有被引用的文件", "");
  if (orphans.length === 0) lines.push("（无）");
  else for (const file of orphans) lines.push(`- \`${file}\``);

  const sources = files.filter((file) => !/\.test\.(ts|js)$/.test(file));
  lines.push("", `> 共 ${sources.length} 个源文件（另有 ${files.length - sources.length} 个测试），${[...graph.values()].reduce((n, deps) => n + deps.length, 0)} 条引用。`);

  const outIndex = process.argv.indexOf("--out");
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : "docs/dependency-tree.md";
  writeFileSync(out, lines.join("\n") + "\n", "utf8");
  console.log(`写入 ${out}：${files.length} 个文件`);
}

main();
