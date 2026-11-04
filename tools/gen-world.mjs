// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成一张地图（MVP：噪声 → 群系 → 地形号）。
 *
 * 用法：
 *   node tools/gen-world.mjs --seed 42 --size 48x32
 *   node tools/gen-world.mjs --seed 42 --size 48x32 --out spaces/field.json
 *
 * 现在只有「环境类」一种：高度场 + 湿度场 → 群系 → 地形。
 * 地牢（BSP 房间）是下一步。
 */

import { writeFileSync } from "node:fs";

import { fbm } from "../game/engine/core/src/worldgen/noise.ts";
import { pickBiome, terrainFor } from "../game/engine/core/src/worldgen/select.ts";

function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const seed = Number(arg("seed", "1"));
const [width, height] = String(arg("size", "48x32")).split("x").map(Number);
const out = arg("out", null);

/** 三档地形：水 / 山 / 草地。号来自官方包的 terrains.json。 */
const TERRAIN_ID = { water: 2, rock: 1, grass: 3 };

const BIOMES = [
  { id: "temperate", ranges: { height: [0.35, 1], moisture: [0.45, 1] }, terrain: { base: "grass", hill: "rock", water: "water" } },
  { id: "swamp", ranges: { height: [0, 0.35], moisture: [0.55, 1] }, terrain: { base: "grass", water: "water" } },
  { id: "dry", ranges: {}, terrain: { base: "grass", hill: "rock", water: "water" } },
];

const terrain = [];
const stats = new Map();

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const sample = {
      height: fbm(seed, x, y, { scale: 7, octaves: 4 }),
      moisture: fbm(seed + 1000, x, y, { scale: 13, octaves: 3 }),
    };

    const biome = pickBiome(BIOMES, sample) ?? BIOMES[BIOMES.length - 1];
    const name = terrainFor(biome, sample.height, { water: 0.40, hill: 0.65 });
    const id = TERRAIN_ID[name] ?? TERRAIN_ID.grass;

    terrain.push(id);
    stats.set(biome.id, (stats.get(biome.id) ?? 0) + 1);
  }
}

const space = { id: "field", width, height, terrain };

const text = JSON.stringify(space);
// 终端里先看一眼
const GLYPH = { 1: "#", 2: "~", 3: ".", 0: " " };
for (let y = 0; y < height; y += 1) {
  let row = "";
  for (let x = 0; x < width; x += 1) row += GLYPH[terrain[y * width + x]] ?? "?";
  console.error(row);
}

if (out === null) {
  console.log(text);
  console.error(`群系分布：${[...stats.entries()].map(([id, n]) => `${id}=${n}`).join(" ")}`);
} else {
  writeFileSync(out, JSON.stringify(space, null, 2) + "\n", "utf8");
  console.log(`写入 ${out}（${width}×${height}）`);
  console.log(`群系分布：${[...stats.entries()].map(([id, n]) => `${id}=${n}`).join(" ")}`);
}
