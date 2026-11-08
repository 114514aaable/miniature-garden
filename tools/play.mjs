// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 从文件夹加载一个世界并画出来（宿主侧）。
 *
 * 用法：
 *   node tools/play.mjs game/worlds/base game/worlds/normal
 *
 * 它做的每一步都是真的：读包 → 依赖排序 → 合并 → 加载 → 造 store → 放实体。
 * 只是最后没有交互，只是把世界画出来，让你看见「文件变成了世界」。
 */

import { readPack } from "./pack-reader.mjs";

import { loadWorld } from "../game/engine/core/src/pack/load.ts";
import { applyInit } from "../game/engine/core/src/pack/init.ts";
import { mergePacks } from "../game/engine/core/src/pack/merge.ts";
import { orderPacks } from "../game/engine/core/src/pack/order.ts";
import { Store } from "../game/engine/core/src/store.ts";

const GLYPH = { pc: "@", npc_salt: "N", prop_crate: "o", item_lamp: "i" };
const TERRAIN_GLYPH = { 0: " ", 1: "#", 2: "~", 3: "." };

function main(dirs) {
  if (dirs.length === 0) {
    console.error("用法：node tools/play.mjs <包目录> [更多包目录...]");
    process.exit(2);
  }

  const contents = dirs.map(readPack);
  const byId = new Map(contents.map((content) => [content.pack.id, content]));
  const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));

  const merged = mergePacks(ordered);
  const loaded = loadWorld(merged);

  const store = new Store(loaded.spaces, { templates: loaded.templates });
  for (const entity of loaded.entities) {
    store.submit({
      kind: "spawn",
      space: entity.space,
      cell: entity.pos,
      template: entity.template,
      overrides: entity.overrides,
    });
  }
  const spawned = store.step();
applyInit(store, loaded);

  console.log(`包：${ordered.map((content) => `${content.pack.id}@${content.pack.version}`).join(" + ")}`);
  console.log(`定义：${merged.definitions.size} 条，警告：${merged.warnings.length} 条`);
  console.log(`世界哈希：${loaded.hash}`);
  console.log(`规则：${loaded.rules.join(", ") || "（未声明）"}`);
  console.log(`实体：${loaded.entities.length} 个（句柄 ${spawned.map((entry) => entry.data.handle).join(", ")}）`);
  console.log(`出生点：空间 ${loaded.start.space} (${loaded.start.pos.x}, ${loaded.start.pos.y})`);
  console.log("");

  draw(store, loaded, spawned);
}

function draw(store, loaded, spawned) {
  void spawned;
  const space = loaded.spaces[0];
  const byHandle = new Map();
  // 画的是「现在世界里有谁」，不是「开局 spawn 了谁」——init 之后才算完整
  for (const entity of store.allEntities()) {
    if (entity.pos === null) continue;
    const key = `${entity.pos.x},${entity.pos.y}`;
    if (!byHandle.has(key)) {
      byHandle.set(key, GLYPH[entity.template] ?? "?");
    }
  }

  for (let y = 0; y < space.height; y++) {
    let row = "";
    for (let x = 0; x < space.width; x++) {
      row += byHandle.get(`${x},${y}`) ?? TERRAIN_GLYPH[space.terrainAt({ x, y })] ?? "?";
    }
    console.log(row);
  }

  console.log("");
  console.log(`tick=${store.now()}  链头=${store.headHash}`);
}

main(process.argv.slice(2));
