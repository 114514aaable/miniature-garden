// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 读一个世界的「结构」定义（生成期数据，不进运行时加载）。
 *
 * 约定：包目录下 worldgen/structures.json，可以多个包叠加，
 * 后面的包覆盖前面的同名结构。
 */

import { existsSync, readFileSync } from "node:fs";

import { readPack } from "./pack-reader.mjs";
import { parseStructure } from "../game/engine/core/src/worldgen/structures.ts";

/** 世界 → 它依赖的包目录（按加载顺序）。 */
function packDirsOf(worldId) {
  const root = readPack("game/worlds/" + worldId);
  const dirs = ["game/worlds/" + worldId];
  const seen = new Set([root.pack.id]);
  const queue = Object.keys(root.pack.requires ?? {});

  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    dirs.push("game/worlds/" + id);
    const content = readPack("game/worlds/" + id);
    queue.push(...Object.keys(content.pack.requires ?? {}));
  }

  // 依赖先、世界后（后覆盖前）
  return dirs.reverse();
}

export function loadStructures(worldId) {
  const defs = new Map();

  for (const dir of packDirsOf(worldId)) {
    const file = dir + "/worldgen/structures.json";
    if (!existsSync(file)) continue;

    const raw = JSON.parse(readFileSync(file, "utf8"));
    const items = Array.isArray(raw) ? raw : [];

    for (const item of items) {
      if (typeof item !== "object" || item === null || typeof item.id !== "string") continue;
      defs.set(item.id, parseStructure(item, item.id));
    }
  }

  return defs;
}

/** 调试用：把结构印成字符画。 */
export function previewStructure(def) {
  const rows = [];
  for (let y = 0; y < def.height; y += 1) {
    let row = "";
    for (let x = 0; x < def.width; x += 1) {
      const code = def.cells[y * def.width + x];
      row += code === "wall" ? "#" : code === "floor" ? "." : " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}
