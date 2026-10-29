// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 实体表的测试。
 *
 * 最关键的两条：
 *   1. 槽位复用之后，旧句柄必须失效（代数对不上）；
 *   2. 句柄永不复用同一个值。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable, GENERATIONS, handleGeneration, handleIndex, makeHandle } from "./entity.ts";

test("句柄编解码可以来回", () => {
  for (const [index, generation] of [
    [0, 0],
    [1, 0],
    [7, 3],
    [1000, 4095],
  ] as const) {
    const handle = makeHandle(index, generation);
    assert.equal(handleIndex(handle), index);
    assert.equal(handleGeneration(handle), generation);
  }
});

test("代数越界直接报错", () => {
  assert.throws(() => makeHandle(0, GENERATIONS), /代数/);
  assert.throws(() => makeHandle(-1, 0), /索引/);
});

test("创建后能查到", () => {
  const table = new EntityTable();
  const handle = table.create("npc_guard", { x: 1, y: 2 });

  const entity = table.get(handle);
  assert.equal(entity.template, "npc_guard");
  assert.deepEqual(entity.pos, { x: 1, y: 2 });
  assert.equal(table.size, 1);
});

test("销毁之后查询报错，而不是返回陌生人", () => {
  const table = new EntityTable();
  const handle = table.create("npc_guard");
  table.destroy(handle);

  assert.throws(() => table.get(handle), /已销毁/);
  assert.equal(table.has(handle), false);
  assert.equal(table.size, 0);
});

test("槽位复用后，旧句柄过期", () => {
  const table = new EntityTable();
  const old = table.create("npc_guard");
  table.destroy(old);

  const fresh = table.create("npc_salt");
  assert.equal(handleIndex(fresh), handleIndex(old), "槽位被复用");
  assert.notEqual(fresh, old, "但句柄值不同");

  assert.throws(() => table.get(old), /过期/);
  assert.equal(table.get(fresh).template, "npc_salt");
});

test("代数在销毁时递增", () => {
  const table = new EntityTable();
  const first = table.create("a");
  table.destroy(first);
  const second = table.create("b");

  assert.equal(handleGeneration(first), 0);
  assert.equal(handleGeneration(second), 1);
});

test("移动会更新位置，且旧句柄仍然有效", () => {
  const table = new EntityTable();
  const handle = table.create("npc_guard", { x: 0, y: 0 });

  const moved = table.move(handle, { x: 3, y: 4 });
  assert.deepEqual(moved.pos, { x: 3, y: 4 });
  assert.deepEqual(table.get(handle).pos, { x: 3, y: 4 });
});

test("移动不存在的实体会报错", () => {
  const table = new EntityTable();
  assert.throws(() => table.move(123, { x: 0, y: 0 }), /不存在/);
});

test("可以移出空间（pos = null）", () => {
  const table = new EntityTable();
  const handle = table.create("item_lamp", { x: 1, y: 1 });
  table.move(handle, null);
  assert.equal(table.get(handle).pos, null);
});

test("覆盖是副本，外部改不到内部", () => {
  const table = new EntityTable();
  const overrides = { "core.health": { hp: 7 } };
  const handle = table.create("npc_guard", null, overrides);

  overrides["core.health"] = { hp: 999 };
  assert.deepEqual(table.get(handle).overrides["core.health"], { hp: 7 });
});

test("销毁不存在的实体会报错", () => {
  const table = new EntityTable();
  assert.throws(() => table.destroy(42), /销毁失败/);
});
