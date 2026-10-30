// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载器的测试：内容池 → 运行时对象。
 *
 * 重点在「坏世界进不来」：缺 world、未知 kind、地形没声明、实体站在墙上、出生点不可走。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type PackManifest } from "./manifest.ts";
import { mergePacks, type Definition } from "./merge.ts";
import { loadWorld } from "./load.ts";

const HEALTH = {
  schema: { t: "object", fields: { max: { t: "int" }, hp: { t: "int" } }, optional: ["hp"] },
};

function manifest(id = "official.base"): PackManifest {
  return { id, kind: "base", version: "1.0.0" };
}

function def(kind: string, id: string, data: unknown): Definition {
  return { kind, id, data: data as never };
}

/** 3×3 空间，(1,1) 是墙；实体在 (0,0)；出生点 (2,2)。 */
function minimal(): Definition[] {
  return [
    def("component", "core.health", HEALTH),
    def("terrain", "0", { name: "地面", passable: true }),
    def("terrain", "1", { name: "墙", passable: false }),
    def("space", "dock", { id: "dock", width: 3, height: 3, terrain: [0, 0, 0, 0, 1, 0, 0, 0, 0] }),
    def("template", "npc_guard", { id: "npc_guard", components: { "core.health": { max: 10 } } }),
    def("entity", "e1", { template: "npc_guard", space: "dock", x: 0, y: 0 }),
    def("world", "main", {
      start: { space: "dock", x: 2, y: 2 },
      rules: ["core.move"],
    }),
  ];
}

function load(definitions: Definition[] = minimal()) {
  return loadWorld(mergePacks([{ pack: manifest(), definitions }]));
}

test("最小世界能加载", () => {
  const world = load();

  assert.equal(world.spaces.length, 1);
  assert.deepEqual(world.spaceIds.get("dock"), 1);
  assert.equal(world.entities.length, 1);
  assert.deepEqual(world.entities[0].pos, { x: 0, y: 0 });
  assert.equal(world.entities[0].space, 1);
  assert.deepEqual(world.start, { space: 1, pos: { x: 2, y: 2 } });
  assert.deepEqual(world.rules, ["core.move"]);
});

test("地形语义进了表，空间里的地形被真的写进去", () => {
  const world = load();
  assert.equal(world.terrains.get(1)?.passable, false);
  assert.equal(world.spaces[0].terrainAt({ x: 1, y: 1 }), 1);
});

test("空间用了未声明的地形：拒绝", () => {
  const definitions = minimal().map((item) =>
    item.kind === "space"
      ? def("space", "dock", { id: "dock", width: 3, height: 3, terrain: [0, 0, 0, 0, 7, 0, 0, 0, 0] })
      : item,
  );
  assert.throws(() => load(definitions), /用了未声明的地形：7/);
});

test("没有 world 定义：拒绝", () => {
  assert.throws(
    () => load(minimal().filter((item) => item.kind !== "world")),
    /没有 world 定义/,
  );
});

test("两个 world 定义：拒绝", () => {
  const definitions = [
    ...minimal(),
    def("world", "second", { start: { space: "dock", x: 0, y: 0 } }),
  ];
  assert.throws(() => load(definitions), /只能有一个 world 定义/);
});

test("未知的定义类型：拒绝", () => {
  assert.throws(() => load([...minimal(), def("rm.map", "m1", {})]), /未知的定义类型/);
});

test("实体引用不存在的模板：拒绝", () => {
  const definitions = minimal().map((item) =>
    item.kind === "entity" ? def("entity", "e1", { template: "npc_ghost", space: "dock", x: 0, y: 0 }) : item,
  );
  assert.throws(() => load(definitions), /不存在的模板/);
});

test("实体坐标越界：拒绝", () => {
  const definitions = minimal().map((item) =>
    item.kind === "entity" ? def("entity", "e1", { template: "npc_guard", space: "dock", x: 9, y: 0 }) : item,
  );
  assert.throws(() => load(definitions), /坐标越界/);
});

test("实体站在墙上：拒绝", () => {
  const definitions = minimal().map((item) =>
    item.kind === "entity" ? def("entity", "e1", { template: "npc_guard", space: "dock", x: 1, y: 1 }) : item,
  );
  assert.throws(() => load(definitions), /不可通行地形/);
});

test("出生点不可走：拒绝", () => {
  const definitions = minimal().map((item) =>
    item.kind === "world" ? def("world", "main", { start: { space: "dock", x: 1, y: 1 } }) : item,
  );
  assert.throws(() => load(definitions), /出生点在不可通行地形上/);
});

test("多个空间按名字排序分配句柄", () => {
  const definitions = [
    def("component", "core.health", HEALTH),
    def("terrain", "0", { name: "地面", passable: true }),
    def("space", "mine", { id: "mine", width: 2, height: 2, terrain: [0, 0, 0, 0] }),
    def("space", "dock", { id: "dock", width: 2, height: 2, terrain: [0, 0, 0, 0] }),
    def("template", "npc_guard", { id: "npc_guard", components: { "core.health": { max: 10 } } }),
    def("world", "main", { start: { space: "dock", x: 0, y: 0 } }),
  ];

  const world = load(definitions);
  assert.equal(world.spaceIds.get("dock"), 1);
  assert.equal(world.spaceIds.get("mine"), 2);
});

test("内容变了，世界哈希就变", () => {
  const a = load();
  const definitions = minimal().map((item) =>
    item.kind === "entity" ? def("entity", "e1", { template: "npc_guard", space: "dock", x: 0, y: 1 }) : item,
  );
  const b = load(definitions);
  assert.notEqual(a.hash, b.hash);
});

test("同样的内容，哈希稳定", () => {
  assert.equal(load().hash, load().hash);
});
