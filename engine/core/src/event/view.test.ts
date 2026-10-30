// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 只读视图的测试：能读到、读得对、能判断能不能走、拿不到写的方法。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "../space.ts";
import { ORTHOGONAL } from "../stencils.ts";
import { createWorldView } from "./view.ts";

const TERRAINS = new Map<number, { passable: boolean }>([
  [0, { passable: true }],
  [1, { passable: false }],
]);

test("能按 id 拿到空间视图", () => {
  const view = createWorldView([new Space(1, 4, 3)], { tick: 7 });
  assert.equal(view.tick, 7);
  assert.equal(view.space(1).width, 4);
  assert.equal(view.space(1).height, 3);
});

test("读到的地形和底层空间一致", () => {
  const space = new Space(1, 4, 3);
  space.setTerrain({ x: 1, y: 1 }, 9);

  const view = createWorldView([space], { tick: 0 });
  assert.equal(view.space(1).terrainAt({ x: 1, y: 1 }), 9);
});

test("读到的占用者是真的", () => {
  const space = new Space(1, 4, 3);
  space.addOccupant({ x: 2, y: 2 }, 42);

  const view = createWorldView([space], { tick: 0 });
  assert.deepEqual(view.space(1).occupantsAt({ x: 2, y: 2 }), [42]);
});

test("能按地形语义判断能不能走", () => {
  const space = new Space(1, 4, 3);
  space.setTerrain({ x: 1, y: 1 }, 1);

  const view = createWorldView([space], { tick: 0, terrains: TERRAINS });
  assert.equal(view.space(1).passableAt({ x: 0, y: 0 }), true);
  assert.equal(view.space(1).passableAt({ x: 1, y: 1 }), false);
});

test("地形没声明过：报错，不猜", () => {
  const space = new Space(1, 4, 3);
  space.setTerrain({ x: 1, y: 1 }, 9);

  const view = createWorldView([space], { tick: 0, terrains: TERRAINS });
  assert.throws(() => view.space(1).passableAt({ x: 1, y: 1 }), /没有声明地形 9/);
});

test("视图没有地形表时，问能不能走会报错", () => {
  const view = createWorldView([new Space(1, 4, 3)], { tick: 0 });
  assert.throws(() => view.space(1).passableAt({ x: 0, y: 0 }), /没有地形表/);
});

test("视图也能按偏移遍历", () => {
  const view = createWorldView([new Space(1, 4, 3)], { tick: 0 });
  const seen: string[] = [];
  view.space(1).each({ x: 1, y: 1 }, ORTHOGONAL, (cell) => {
    seen.push(`${cell.x},${cell.y}`);
  });
  assert.equal(seen.length, 4);
});

test("访问不存在的空间直接报错", () => {
  const view = createWorldView([], { tick: 0 });
  assert.throws(() => view.space(99), /空间不存在/);
});

test("没有实体来源时，查实体会报错", () => {
  const view = createWorldView([new Space(1, 4, 3)], { tick: 0 });
  assert.throws(() => view.entity(1), /没有实体来源/);
});
