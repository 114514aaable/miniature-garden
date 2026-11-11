// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 回滚一致性：实体表恢复了，空间索引也必须恢复。
 *
 * 以前 applyPlace 对「写回原格」生成 remove/place 两个 undo，
 * 倒序执行互相抵消，留下「实体存在但索引里找不到」的幽灵状态。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "./space.ts";
import { Store } from "./store.ts";

function world(): { store: Store; space: Space } {
  const space = new Space(1, 3, 3);
  return { store: new Store([space]), space };
}

test("同格移动后同批失败：回滚后索引里还有这个实体", () => {
  const { store, space } = world();

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "ghost" });
  const [spawned] = store.step();
  const handle = Number(spawned.data.handle);

  // 写回原格（等价于原地移动）
  store.submit({ kind: "patch", handle, component: "core.place", data: { space: 1, x: 1, y: 1 } });
  // 后续 effect 必然失败，触发整体回滚
  store.submit({ kind: "remove", space: 1, cell: { x: 0, y: 0 }, handle: 99 });

  assert.throws(() => store.step(), /不在格子/);

  const entity = store.entity(handle);
  assert.deepEqual(entity.pos, { x: 1, y: 1 });
  assert.ok(space.occupantsAt({ x: 1, y: 1 }).includes(handle), "索引里应该还有它");
});

test("普通移动：旧格清掉、新格加上", () => {
  const { store, space } = world();

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "ghost" });
  const [spawned] = store.step();
  const handle = Number(spawned.data.handle);

  store.submit({ kind: "patch", handle, component: "core.place", data: { space: 1, x: 2, y: 2 } });
  store.step();

  assert.deepEqual(store.entity(handle).pos, { x: 2, y: 2 });
  assert.ok(space.occupantsAt({ x: 2, y: 2 }).includes(handle));
  assert.ok(!space.occupantsAt({ x: 1, y: 1 }).includes(handle));
});
