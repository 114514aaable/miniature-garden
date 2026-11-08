// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成器的测试：确定性、尺寸上限、兜底群系。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { clampSize, generateTerrain, MAX_SIZE, MIN_SIZE, type GenerateOptions } from "./generate.ts";
import type { Biome } from "./select.ts";

const BIOMES: Biome[] = [
  { id: "dry", ranges: {}, terrain: { base: "floor", water: "water", hill: "wall" } },
];

const IDS = new Map([
  ["floor", 3],
  ["water", 2],
  ["wall", 1],
]);

function options(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    seed: 1,
    width: 8,
    height: 6,
    fields: { height: { scale: 5 } },
    biomes: BIOMES,
    terrainIdByCode: IDS,
    levels: { water: 0.52, hill: 0.52 },
    ...overrides,
  };
}

test("同样的种子与尺寸：一模一样", () => {
  const a = generateTerrain(options());
  const b = generateTerrain(options());
  assert.deepEqual(a.terrain, b.terrain);
});

test("尺寸正确", () => {
  const result = generateTerrain(options({ width: 10, height: 4 }));
  assert.equal(result.width, 10);
  assert.equal(result.height, 4);
  assert.equal(result.terrain.length, 40);
});

test("尺寸被夹在 4..200", () => {
  assert.equal(clampSize(0), MIN_SIZE);
  assert.equal(clampSize(-5), MIN_SIZE);
  assert.equal(clampSize(9999), MAX_SIZE);
  assert.equal(clampSize(Number.NaN), MIN_SIZE);
  assert.equal(clampSize(37.9), 37);
});

test("换种子会换地图", () => {
  const a = generateTerrain(options({ seed: 1, width: 20, height: 20 }));
  const b = generateTerrain(options({ seed: 2, width: 20, height: 20 }));
  assert.notEqual(a.terrain.join(","), b.terrain.join(","));
});

test("没有群系就报错", () => {
  assert.throws(() => generateTerrain(options({ biomes: [] })), /没有群系/);
});

test("没有兜底群系就报错", () => {
  assert.throws(
    () => generateTerrain(options({ biomes: [{ id: "x", ranges: { height: [0, 1] }, terrain: { base: "floor" } }] })),
    /兜底群系/,
  );
});

test("地形代号不认识就报错（不静默兜底）", () => {
  assert.throws(
    () => generateTerrain(options({ biomes: [{ id: "d", ranges: {}, terrain: { base: "lava" } }] })),
    /不在包里/,
  );
});

test("群系分布会被统计", () => {
  const result = generateTerrain(options({ width: 12, height: 12 }));
  const total = Object.values(result.stats).reduce((sum, count) => sum + count, 0);
  assert.equal(total, 144);
});
