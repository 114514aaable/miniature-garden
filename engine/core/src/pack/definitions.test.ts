// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 定义格式的测试：形状、尺寸、地形语义。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isPassable,
  parseEntityDef,
  parseSpaceDef,
  parseTemplateDef,
  parseWorldDef,
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
  assert.throws(
    () => parseEntityDef({ template: "a", space: "dock", x: 1.5, y: 2 }),
    /整数/,
  );
});

test("世界：正常解析，并能查地形语义", () => {
  const world = parseWorldDef({
    start: { space: "dock", x: 1, y: 1 },
    terrains: [
      { id: 0, name: "地面", passable: true },
      { id: 1, name: "墙", passable: false },
    ],
  });

  assert.equal(isPassable(world, 0), true);
  assert.equal(isPassable(world, 1), false);
});

test("世界：地形 id 不能重复", () => {
  assert.throws(
    () =>
      parseWorldDef({
        start: { space: "dock", x: 0, y: 0 },
        terrains: [
          { id: 0, name: "a", passable: true },
          { id: 0, name: "b", passable: false },
        ],
      }),
    /地形 id 重复/,
  );
});

test("世界：没声明过的地形，查语义时报错", () => {
  const world = parseWorldDef({
    start: { space: "dock", x: 0, y: 0 },
    terrains: [{ id: 0, name: "地面", passable: true }],
  });
  assert.throws(() => isPassable(world, 9), /没有声明地形 9/);
});

test("世界：缺 start 或 terrains 直接报错", () => {
  assert.throws(() => parseWorldDef({ terrains: [] }), /缺少字段/);
  assert.throws(() => parseWorldDef({ start: { space: "dock", x: 0, y: 0 } }), /缺少字段/);
});
