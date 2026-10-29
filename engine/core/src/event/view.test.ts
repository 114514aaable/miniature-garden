// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 只读视图的测试：能读到、读得对、拿不到写的方法。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "../space.ts";
import { ORTHOGONAL } from "../stencils.ts";
import { createWorldView } from "./view.ts";

test("能按 id 拿到空间视图", () => {
  const view = createWorldView([new Space(1, 4, 3)], 7);
  assert.equal(view.tick, 7);
  assert.equal(view.space(1).width, 4);
  assert.equal(view.space(1).height, 3);
});

test("读到的地形和底层空间一致", () => {
  const space = new Space(1, 4, 3);
  space.setTerrain({ x: 1, y: 1 }, 9);

  const view = createWorldView([space], 0);
  assert.equal(view.space(1).terrainAt({ x: 1, y: 1 }), 9);
});

test("读到的占用者是真的", () => {
  const space = new Space(1, 4, 3);
  space.addOccupant({ x: 2, y: 2 }, 42);

  const view = createWorldView([space], 0);
  assert.deepEqual(view.space(1).occupantsAt({ x: 2, y: 2 }), [42]);
});

test("视图也能按偏移遍历", () => {
  const view = createWorldView([new Space(1, 4, 3)], 0);
  const seen: string[] = [];
  view.space(1).each({ x: 1, y: 1 }, ORTHOGONAL, (cell) => {
    seen.push(`${cell.x},${cell.y}`);
  });
  assert.equal(seen.length, 4);
});

test("访问不存在的空间直接报错", () => {
  const view = createWorldView([], 0);
  assert.throws(() => view.space(99), /空间不存在/);
});
