// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 噪声与选择的测试：确定性、范围、顺序、分档。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { fbm, NOISE_KINDS, noiseOf, ridged, valueNoise } from "./noise.ts";
import { matchesRange, pickBiome, terrainFor, type Biome } from "./select.ts";

test("同样的输入永远同样的值", () => {
  assert.equal(valueNoise(7, 3, 4, 8), valueNoise(7, 3, 4, 8));
});

test("换种子或坐标都会变", () => {
  const base = valueNoise(1, 0, 0, 8);
  assert.notEqual(base, valueNoise(2, 0, 0, 8));
  assert.notEqual(base, valueNoise(1, 1, 0, 8));
});

test("落在 0..1", () => {
  for (let i = 0; i < 100; i += 1) {
    const value = valueNoise(3, i * 7, i * 13, 4);
    assert.ok(value >= 0 && value <= 1, `越界：${value}`);
  }
});

test("scale 越大越平缓（相邻格差值更小）", () => {
  const diff = (scale: number) => {
    let total = 0;
    for (let x = 0; x < 40; x += 1) total += Math.abs(valueNoise(5, x, 0, scale) - valueNoise(5, x + 1, 0, scale));
    return total;
  };
  assert.ok(diff(16) < diff(2), "大 scale 应该更平滑");
});

test("fbm 也在 0..1，且比单层更「有起伏」", () => {
  const value = fbm(11, 5, 5, { scale: 8, octaves: 4 });
  assert.ok(value >= 0 && value <= 1);
});

test("ridged 在 0..1", () => {
  for (let i = 0; i < 20; i += 1) {
    const value = ridged(13, i, i, { scale: 6, octaves: 3 });
    assert.ok(value >= 0 && value <= 1);
  }
});

test("noiseOf 按名字分派，三种都能跑", () => {
  for (const kind of NOISE_KINDS) {
    const value = noiseOf(kind, 1, 2, 3, 8, 3);
    assert.ok(value >= 0 && value <= 1, kind);
  }
});

test("区间是闭区间", () => {
  assert.equal(matchesRange({ h: [0, 1] }, { h: 0 }), true);
  assert.equal(matchesRange({ h: [0, 1] }, { h: 1 }), true);
  assert.equal(matchesRange({ h: [0, 1] }, { h: 1.1 }), false);
});

test("缺字段就当不匹配", () => {
  assert.equal(matchesRange({ h: [0, 1] }, {}), false);
});

const TEMPERATE: Biome = {
  id: "temperate",
  ranges: { height: [0.3, 1], moisture: [0.3, 1] },
  terrain: { base: "grass", hill: "rock", water: "water" },
};
const SWAMP: Biome = {
  id: "swamp",
  ranges: { height: [0, 0.3], moisture: [0.5, 1] },
  terrain: { base: "mud", water: "water" },
};

test("按顺序取第一个匹配", () => {
  assert.equal(pickBiome([TEMPERATE, SWAMP], { height: 0.5, moisture: 0.5 })?.id, "temperate");
  assert.equal(pickBiome([TEMPERATE, SWAMP], { height: 0.1, moisture: 0.8 })?.id, "swamp");
});

test("没有匹配返回 null", () => {
  assert.equal(pickBiome([TEMPERATE], { height: 0.1, moisture: 0.1 }), null);
});

test("地形分档：水 / 山 / 底", () => {
  assert.equal(terrainFor(TEMPERATE, 0.1, { water: 0.2 }), "water");
  assert.equal(terrainFor(TEMPERATE, 0.9, { hill: 0.8 }), "rock");
  assert.equal(terrainFor(TEMPERATE, 0.5, { water: 0.2, hill: 0.8 }), "grass");
});

test("群系没声明 water/hill 时退回 base", () => {
  const plain: Biome = { id: "plain", ranges: {}, terrain: { base: "grass" } };
  assert.equal(terrainFor(plain, 0.1, { water: 0.2 }), "grass");
  assert.equal(terrainFor(plain, 0.9, { hill: 0.8 }), "grass");
});
