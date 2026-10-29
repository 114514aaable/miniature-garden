// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 实体在 store 里的落地测试。
 *
 * 重点：实体表与空间占用必须一起变——不然就会出现「人走了，索引里还留着他」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "./space.ts";
import { Store } from "./store.ts";
import { collectEffects } from "./event/effects.ts";

function world(): { store: Store; space: Space } {
  const space = new Space(1, 4, 4);
  const store = new Store([space], { templates: { has: (id) => id === "npc_guard" || id === "item_lamp" } });
  return { store, space };
}

test("spawn：实体被创建，格子被占用，日志里带句柄", () => {
  const { store, space } = world();

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "npc_guard" });
  const logs = store.step();

  const handle = logs[0].data.handle as number;
  assert.equal(store.entity(handle).template, "npc_guard");
  assert.deepEqual(space.occupantsAt({ x: 1, y: 1 }), [handle]);
  assert.equal(store.entityCount, 1);
});

test("spawn：未知模板直接拒绝，世界不动", () => {
  const { store, space } = world();

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "npc_dragon" });
  assert.throws(() => store.step(), /模板不存在/);

  assert.equal(store.entityCount, 0);
  assert.deepEqual(space.occupantsAt({ x: 1, y: 1 }), []);
  assert.equal(store.now(), 0);
});

test("despawn：实体消失，格子空出来", () => {
  const { store, space } = world();
  store.submit({ kind: "spawn", space: 1, cell: { x: 2, y: 2 }, template: "npc_guard" });
  const handle = store.step()[0].data.handle as number;

  store.submit({ kind: "despawn", handle });
  store.step();

  assert.equal(store.entityCount, 0);
  assert.deepEqual(space.occupantsAt({ x: 2, y: 2 }), []);
  assert.throws(() => store.entity(handle), /已销毁/);
});

test("move：实体位置与空间索引一起变", () => {
  const { store, space } = world();
  store.submit({ kind: "spawn", space: 1, cell: { x: 0, y: 0 }, template: "npc_guard" });
  const handle = store.step()[0].data.handle as number;

  store.submit({ kind: "move", space: 1, handle, to: { x: 3, y: 3 } });
  store.step();

  assert.deepEqual(store.entity(handle).pos, { x: 3, y: 3 });
  assert.deepEqual(space.occupantsAt({ x: 0, y: 0 }), []);
  assert.deepEqual(space.occupantsAt({ x: 3, y: 3 }), [handle]);
});

test("一批里后面的失败：实体也要回滚", () => {
  const { store, space } = world();

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "npc_guard" });
  store.submit({ kind: "move", space: 1, handle: 999, to: { x: 0, y: 0 } });

  // 999 解码后是「槽位 0、第 999 代」，正好撞上刚出生的实体（第 0 代），
  // 所以报的是「过期」而不是「不存在」——两种都说明这个句柄不能用。
  assert.throws(() => store.step(), /不存在|过期/);
  assert.equal(store.entityCount, 0);
  assert.deepEqual(space.occupantsAt({ x: 1, y: 1 }), []);
  assert.equal(store.now(), 0);
});

test("端到端：JSON 效果 → 解析 → 提交 → 实体出现", () => {
  const { store, space } = world();

  const effects = collectEffects({
    effects: [{ kind: "spawn", space: 1, cell: { x: 2, y: 1 }, template: "item_lamp" }],
  });
  for (const effect of effects) store.submit(effect);
  const logs = store.step();

  const handle = logs[0].data.handle as number;
  assert.equal(store.entity(handle).template, "item_lamp");
  assert.deepEqual(space.occupantsAt({ x: 2, y: 1 }), [handle]);
});

test("解析：despawn 与 move 也能从 JSON 进来", () => {
  const effects = collectEffects({
    effects: [
      { kind: "move", space: 1, handle: 7, to: { x: 1, y: 2 } },
      { kind: "despawn", handle: 7 },
    ],
  });
  assert.deepEqual(effects[0], { kind: "move", space: 1, handle: 7, to: { x: 1, y: 2 } });
  assert.deepEqual(effects[1], { kind: "despawn", handle: 7 });
});
