// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 世界包的引用图（Mermaid）。
 *
 * 和 gen-tree（代码 import）互补：这里画的是**数据引用**
 *   world → rules / space
 *   entity → template
 *   template → component
 *   group → template
 *   …
 *
 * **不硬编码种类**：节点与边全部来自 buildGraph，新加一类定义自动出现。
 *
 * 用法：node tools/gen-pack-graph.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readPack } from "./pack-reader.mjs";
import { buildGraph } from "../game/engine/core/src/pack/graph.ts";
import { mergePacks } from "../game/engine/core/src/pack/merge.ts";
import { orderPacks } from "../game/engine/core/src/pack/order.ts";

const LOCALE = JSON.parse(readFileSync("game/locales/zh-CN.json", "utf8"));
const WORLDS_DIR = "game/worlds";

/** 语言包里的显示名；没有就退回 id。 */
function display(kind, label) {
  return LOCALE[`${kind}.${label}.name`] ?? label;
}

/** Mermaid 的节点 id 只能用字母数字下划线。 */
function mermaidId(id) {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function quote(text) {
  return '"' + String(text).replaceAll('"', "'") + '"';
}

/** 所有包目录（含 base），按包 id 建索引。 */
function packDirs() {
  const map = new Map();
  for (const name of readdirSync(WORLDS_DIR)) {
    const dir = join(WORLDS_DIR, name);
    try {
      const manifest = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8"));
      map.set(manifest.id, dir);
    } catch {
      // 不是包目录，跳过
    }
  }
  return map;
}

function findWorlds(dirMap) {
  return [...dirMap.values()].filter((dir) => {
    try {
      return statSync(join(dir, "world.json")).isFile();
    } catch {
      return false;
    }
  });
}

/** 读一个世界（依赖闭包 → 合并 → 建图）。 */
function graphOf(worldDir, dirMap) {
  // 依赖闭包：一层层读 requires，直到没有新包
  const contents = [];
  const seen = new Set();
  const queue = [worldDir];
  while (queue.length > 0) {
    const dir = queue.shift();
    const content = readPack(dir);
    if (seen.has(content.pack.id)) continue;
    seen.add(content.pack.id);
    contents.push(content);
    for (const dependency of Object.keys(content.pack.requires ?? {})) {
      const depDir = dirMap.get(dependency);
      if (depDir === undefined) throw new Error("缺少依赖：" + dependency);
      queue.push(depDir);
    }
  }

  const byId = new Map(contents.map((content) => [content.pack.id, content]));
  const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));
  const merged = mergePacks(ordered);

  const worldDef = [...merged.definitions.values()].find((definition) => definition.kind === "world");
  const rules = Array.isArray(worldDef?.data.rules) ? worldDef.data.rules.filter((r) => typeof r === "string") : [];

  return { graph: buildGraph(merged, rules), packs: ordered.map((content) => content.pack.id) };
}

function toMermaid(graph) {
  const lines = ["```mermaid", "graph LR"];

  // 按来源包分组（不按种类分组——种类是数据，来源才是结构）
  const byOrigin = new Map();
  for (const node of graph.nodes) {
    if (!byOrigin.has(node.origin)) byOrigin.set(node.origin, []);
    byOrigin.get(node.origin).push(node);
  }

  for (const [origin, nodes] of byOrigin) {
    lines.push(`  subgraph ${quote(origin)}`);
    for (const node of nodes) {
      lines.push(`    ${mermaidId(node.id)}[${quote(display(node.kind, node.label))}]`);
    }
    lines.push("  end");
  }

  const edges = new Set();
  for (const node of graph.nodes) {
    for (const ref of node.refs) {
      if (!graph.byId.has(ref)) continue;
      edges.add(`${mermaidId(node.id)} --> ${mermaidId(ref)}`);
    }
  }
  for (const edge of [...edges].sort()) lines.push(`  ${edge}`);

  lines.push("```");
  return lines.join("\n");
}

function main() {
  const dirMap = packDirs();
  const dirs = findWorlds(dirMap);

  if (dirs.length === 0) {
    console.log("没有找到世界包");
    return;
  }

  const lines = [
    "# 世界包引用图",
    "",
    "> 由 `node tools/gen-pack-graph.mjs` 生成，不要手改。",
    "> 与 [dependency-tree.md](dependency-tree.md) 互补：那边是代码 import，这边是数据引用。",
    "",
  ];

  for (const dir of dirs) {
    let result;
    try {
      result = graphOf(dir, dirMap);
    } catch (error) {
      lines.push(`## ${dir}`, "", `**读不出来**：${error.message}`, "");
      continue;
    }

    const { graph, packs } = result;
    const counts = new Map();
    for (const node of graph.nodes) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);

    lines.push(
      `## ${dir.split(/[\\/]/).pop()}`,
      "",
      `包：${packs.join(" + ")}`,
      "",
      "| 种类 | 数量 |",
      "|---|---|",
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => `| ${kind} | ${count} |`),
      "",
      toMermaid(graph),
      "",
    );
  }

  writeFileSync("docs/pack-graph.md", lines.join("\n") + "\n", "utf8");
  console.log(`写入 docs/pack-graph.md：${dirs.length} 个世界`);
}

main();
