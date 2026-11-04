// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 定义格式的测试：形状、尺寸、地形语义。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isPassable,
  parseBiomeDef,
  parseEntityDef,
  parseSpaceDef,
  parseTemplateDef,
  parseTerrainDef,
  parseWorldDef,
  type TerrainDef,
} from "./definitions.ts";

function space(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "dock", width: 2, height: 2, terrain: [0, 0, 0, 1], ...overrides };
}

test("空间：正常解析，cellSize 默认 1", () => {
  const def = parseSpaceDef(space());
  assert.equal(def.cellSize, 1);
  assert.deepEqual(def.terrain, [0, 0, 0, 1]);
});

test("空间：地形数量必须等于格子数", () => {
  assert.throws(() => parseSpaceDef(space({ terrain: [0, 0, 0] })), /地形数量必须等于 2×2=4/);
});

test("空间：尺寸有上下限", () => {
  assert.throws(() => parseSpaceDef(space({ width: 0, terrain: [] })), /1\.\.1024/);
  assert.throws(() => parseSpaceDef(space({ width: 2000, terrain: [] })), /1\.\.1024/);
});

test("空间：id 格式非法报错", () => {
  assert.throws(() => parseSpaceDef(space({ id: "Dock!" })), /id 非法/);
});

test("模板：正常解析", () => {
  const def = parseTemplateDef({ id: "npc_guard", components: { "core.health": { max: 10 } } });
  assert.deepEqual(def.components["core.health"], { max: 10 });
});

test("模板：组件名必须带命名空间", () => {
  assert.throws(
    () => parseTemplateDef({ id: "npc_guard", components: { health: {} } }),
    /组件名非法/,
  );
});

test("实体：正常解析，overrides 可选", () => {
  const plain = parseEntityDef({ template: "npc_guard", space: "dock", x: 1, y: 2 });
  assert.equal(plain.overrides, undefined);

  const withOverrides = parseEntityDef({
    template: "npc_guard",
    space: "dock",
    x: 1,
    y: 2,
    overrides: { "core.health": { hp: 3 } },
  });
  assert.deepEqual(withOverrides.overrides?.["core.health"], { hp: 3 });
});

test("实体：坐标必须是整数", () => {
  assert.throws(() => parseEntityDef({ template: "a", space: "dock", x: 1.5, y: 2 }), /整数/);
});

test("地形：数字号来自定义键，数据里只写含义", () => {
  const def = parseTerrainDef({ name: "墙", passable: false }, "1");
  assert.deepEqual(def, { id: 1, name: "墙", passable: false });
});

test("地形：编号必须是非负整数，且不能有前导零", () => {
  assert.throws(() => parseTerrainDef({ name: "x", passable: true }, "a"), /非负整数/);
  assert.throws(() => parseTerrainDef({ name: "x", passable: true }, "-1"), /非负整数/);
  assert.throws(() => parseTerrainDef({ name: "x", passable: true }, "01"), /前导零/);
});

test("世界：只剩 start / rules / onConflict", () => {
  const world = parseWorldDef({
    start: { space: "dock", x: 1, y: 1 },
    rules: ["core.move"],
    onConflict: "warn",
  });
  assert.deepEqual(world.rules, ["core.move"]);
  assert.equal(world.onConflict, "warn");
});

test("世界：缺 start 直接报错", () => {
  assert.throws(() => parseWorldDef({ rules: [] }), /缺少字段/);
});

test("世界：onConflict 只接受三档", () => {
  assert.throws(
    () => parseWorldDef({ start: { space: "a", x: 0, y: 0 }, onConflict: "whatever" }),
    /需要/,
  );
});

test("地形语义：能查，未声明就报错", () => {
  const terrains = new Map<number, TerrainDef>([
    [0, { id: 0, name: "地面", passable: true }],
    [1, { id: 1, name: "墙", passable: false }],
  ]);
  assert.equal(isPassable(terrains, 0), true);
  assert.equal(isPassable(terrains, 1), false);
  assert.throws(() => isPassable(terrains, 9), /没有声明地形 9/);
});

test("群系：区间与调色板都保留", () => {
  const biome = parseBiomeDef(
    {
      ranges: { height: [0, 0.5] },
      terrain: { base: "floor", water: "water" },
      structures: ["hut"],
    },
    "temperate",
  );

  assert.equal(biome.id, "temperate");
  assert.deepEqual(biome.ranges.height, [0, 0.5]);
  assert.equal(biome.terrain.base, "floor");
});

test("群系：区间反了要报错", () => {
  assert.throws(
    () => parseBiomeDef({ ranges: { height: [0.8, 0.2] }, terrain: {} }, "bad"),
    /区间反了/,
  );
});

test("群系：区间不是两个数字要报错", () => {
  assert.throws(
    () => parseBiomeDef({ ranges: { height: [0] }, terrain: {} }, "bad"),
    /两个数字/,
  );
});

test("地形可以带 code（生成器按它找号）", () => {
  const terrain = parseTerrainDef({ name: "水", passable: false, code: "water" }, "2");
  assert.equal(terrain.code, "water");
});
