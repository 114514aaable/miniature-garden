// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 存档的测试：导出 → 改乱 → 导入，必须回到原样。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "./space.ts";
import { Store } from "./store.ts";

function setup() {
  const space = new Space(1, 4, 4);
  const store = new Store([space]);

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "pc" });
  const player = store.step()[0].data.handle as number;

  store.submit({ kind: "spawn", space: 1, cell: { x: 2, y: 1 }, template: "npc_salt" });
  store.step(2);

  store.submit({ kind: "patch", handle: player, component: "core.health", data: { hp: 7 } });
  store.step();

  return { space, store, player };
}

test("导出再导入：位置、血量、tick 都回来", () => {
  const { space, store, player } = setup();
  const state = JSON.parse(JSON.stringify(store.exportState()));

  const before = {
    tick: store.now(),
    pos: store.entity(player).pos,
    hp: store.entity(player).overrides["core.health"],
    occupants: space.occupantsAt({ x: 2, y: 1 }),
  };

  store.submit({ kind: "patch", handle: player, component: "core.place", data: { space: 1, x: 3, y: 3 } });
  store.step(5);
  assert.equal(store.now(), before.tick + 5);

  store.importState(state);

  assert.equal(store.now(), before.tick);
  assert.deepEqual(store.entity(player).pos, before.pos);
  assert.deepEqual(store.entity(player).overrides["core.health"], before.hp);
  assert.deepEqual(space.occupantsAt({ x: 2, y: 1 }), before.occupants);
});

test("导入后空间索引与实体位置一致", () => {
  const { space, store } = setup();
  const state = JSON.parse(JSON.stringify(store.exportState()));

  space.clearOccupants();
  store.importState(state);

  const at = space.occupantsAt({ x: 1, y: 1 });
  assert.equal(at.length, 1);
  assert.deepEqual(store.entity(at[0]).pos, { x: 1, y: 1 });
});

test("导入的地形长度不对：报错", () => {
  const { store } = setup();
  const state = store.exportState();
  const broken = { ...state, spaces: [{ id: 1, terrain: [0, 0] }] };

  assert.throws(() => store.importState(broken), /地形长度不匹配/);
});

test("存档是值：改它不影响当前世界", () => {
  const { store, player } = setup();
  const state = store.exportState();

  const mutable = state as unknown as { entities: { slots: Array<{ entity: { pos: unknown } }> } };
  mutable.entities.slots[0].entity.pos = { x: 3, y: 3 };

  assert.deepEqual(store.entity(player).pos, { x: 1, y: 1 });
});
