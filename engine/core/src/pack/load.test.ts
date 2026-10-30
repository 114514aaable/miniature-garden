// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载器的测试：内容池 → 运行时对象。
 *
 * 重点在「坏世界进不来」：缺 world、未知 kind、实体站在墙上、出生点不可走。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type PackManifest } from "./manifest.ts";
import { mergePacks, type Definition } from "./merge.ts";
import { type ComponentSpec, loadWorld } from "./load.ts";

const HEALTH: ComponentSpec = {
  name: "core.health",
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
    def("space", "dock", { id: "dock", width: 3, height: 3, terrain: [0, 0, 0, 0, 1, 0, 0, 0, 0] }),
    def("template", "npc_guard", { id: "npc_guard", components: { "core.health": { max: 10 } } }),
    def("entity", "e1", { template: "npc_guard", space: "dock", x: 0, y: 0 }),
    def("world", "main", {
      start: { space: "dock", x: 2, y: 2 },
      terrains: [
        { id: 0, name: "地面", passable: true },
        { id: 1, name: "墙", passable: false },
      ],
    }),
  ];
}

function load(definitions: Definition[] = minimal()) {
  return loadWorld(mergePacks([{ pack: manifest(), definitions }]), [HEALTH]);
}

test("最小世界能加载", () => {
  const world = load();

  assert.equal(world.spaces.length, 1);
  assert.deepEqual(world.spaceIds.get("dock"), 1);
  assert.equal(world.entities.length, 1);
  assert.deepEqual(world.entities[0].pos, { x: 0, y: 0 });
  assert.equal(world.entities[0].space, 1);
  assert.deepEqual(world.start, { space: 1, pos: { x: 2, y: 2 } });
});

test("地形被真的写进空间", () => {
  const world = load();
  assert.equal(world.spaces[0].terrainAt({ x: 1, y: 1 }), 1);
  assert.equal(world.spaces[0].terrainAt({ x: 0, y: 0 }), 0);
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
    def("world", "second", {
      start: { space: "dock", x: 0, y: 0 },
      terrains: [{ id: 0, name: "地面", passable: true }],
    }),
  ];
  assert.throws(() => load(definitions), /只能有一个 world 定义/);
});

test("未知的定义类型：拒绝", () => {
  assert.throws(
    () => load([...minimal(), def("rm.map", "m1", {})]),
    /未知的定义类型/,
  );
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
    item.kind === "world"
      ? def("world", "main", {
          start: { space: "dock", x: 1, y: 1 },
          terrains: [
            { id: 0, name: "地面", passable: true },
            { id: 1, name: "墙", passable: false },
          ],
        })
      : item,
  );
  assert.throws(() => load(definitions), /出生点在不可通行地形上/);
});

test("多个空间按名字排序分配句柄", () => {
  const definitions = [
    def("space", "mine", { id: "mine", width: 2, height: 2, terrain: [0, 0, 0, 0] }),
    def("space", "dock", { id: "dock", width: 2, height: 2, terrain: [0, 0, 0, 0] }),
    def("template", "npc_guard", { id: "npc_guard", components: { "core.health": { max: 10 } } }),
    def("world", "main", {
      start: { space: "dock", x: 0, y: 0 },
      terrains: [{ id: 0, name: "地面", passable: true }],
    }),
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
