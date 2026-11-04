// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成一张地图（MVP：噪声 → 群系 → 地形号）。
 *
 * 数据全部来自包：
 *   群系      <pack>/biomes.json
 *   生成参数  <world>/world.json 的 generation 块
 *   地形名    <pack>/terrains.json（名字 → 号）
 *
 * 用法：
 *   node tools/gen-world.mjs --world official.normal --seed 42 --size 40x20
 *   node tools/gen-world.mjs --seed 42 --size 40x20 --out spaces/field.json
 */

import { writeFileSync } from "node:fs";

import { readPack } from "./pack-reader.mjs";
import { loadWorld } from "../game/engine/core/src/pack/load.ts";
import { mergePacks } from "../game/engine/core/src/pack/merge.ts";
import { orderPacks } from "../game/engine/core/src/pack/order.ts";
import { noiseOf } from "../game/engine/core/src/worldgen/noise.ts";
import { pickBiome, terrainFor } from "../game/engine/core/src/worldgen/select.ts";

function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const worldId = String(arg("world", "official.normal"));
const seed = Number(arg("seed", "1"));
const [width, height] = String(arg("size", "48x32")).split("x").map(Number);
const out = arg("out", null);

/** 读这个世界的包（世界 + 依赖闭包）。 */
function loadPacks() {
  const root = readPack("game/worlds/" + worldId);
  const contents = [root];
  const seen = new Set([root.pack.id]);
  const queue = Object.keys(root.pack.requires ?? {});

  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const content = readPack("game/worlds/" + id);
    contents.push(content);
    queue.push(...Object.keys(content.pack.requires ?? {}));
  }

  const byId = new Map(contents.map((content) => [content.pack.id, content]));
  const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));
  return loadWorld(mergePacks(ordered));
}

const loaded = loadPacks();
const generation = loaded.world.generation ?? {};
const fields = generation.fields ?? {};
const levels = generation.levels ?? {};

if (loaded.biomes.length === 0) {
  console.error("这个包没有 biomes.json，生成不了");
  process.exit(2);
}

/** 地形 code → 地形号（从包里读，不写死）。 */
const terrainIdByCode = new Map();
for (const [id, def] of loaded.terrains) {
  if (def.code === undefined) continue;
  terrainIdByCode.set(def.code, Number(id));
}

/** 找不到就报错——静默兜底会让「配置写错」变成「地图不对」。 */
function terrainIdOf(code) {
  const id = terrainIdByCode.get(code);
  if (id === undefined) {
    console.error(`地形代号 "${code}" 不在包里（可用：${[...terrainIdByCode.keys()].join(" / ")}）`);
    process.exit(3);
  }
  return id;
}

const terrain = [];
const stats = new Map();

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const sample = {};
    for (const [name, config] of Object.entries(fields)) {
      const kind = config.noise ?? "fbm";
      const fieldSeed = (seed + (config.seedOffset ?? 0)) >>> 0;
      sample[name] = noiseOf(kind, fieldSeed, x, y, config.scale ?? 8, config.octaves ?? 4);
    }

    const biome = pickBiome(loaded.biomes, sample);
    if (biome === null) {
      console.error(
        "没有群系匹配这个采样（需要一个 ranges 为空的兜底群系）：" + JSON.stringify(sample),
      );
      process.exit(4);
    }

    const code = terrainFor(biome, sample.height ?? 0.5, { water: levels.water, hill: levels.hill });
    if (code === null) {
      console.error(`群系 ${biome.id} 没给 base 地形`);
      process.exit(5);
    }
    const id = terrainIdOf(code);

    terrain.push(id);
    stats.set(biome.id, (stats.get(biome.id) ?? 0) + 1);
  }
}

// 预览字符按「代号」取，不认数字——换包换号也不会画错
const GLYPH_BY_CODE = { air: " ", wall: "#", water: "~", floor: "." };
const glyphById = new Map();
for (const [code, id] of terrainIdByCode) glyphById.set(id, GLYPH_BY_CODE[code] ?? "?");

for (let y = 0; y < height; y += 1) {
  let row = "";
  for (let x = 0; x < width; x += 1) row += glyphById.get(terrain[y * width + x]) ?? "?";
  console.error(row);
}
console.error(`群系分布：${[...stats.entries()].map(([id, n]) => `${id}=${n}`).join(" ")}`);

const spaceId = String(arg("id", "field"));
const space = { id: spaceId, width, height, terrain };
if (out === null) {
  console.log(JSON.stringify(space));
} else {
  writeFileSync(out, JSON.stringify(space, null, 2) + "\n", "utf8");
  console.log(`写入 ${out}（${width}×${height}）`);
}
