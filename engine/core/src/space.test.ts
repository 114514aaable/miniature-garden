// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 空间模块的测试。
 *
 * 测试在这里不是「证明代码对」，是「把规则钉死」：
 * 以后有人改了 neighbors 的实现，只要行为变了，这里就会响。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EMPTY_TERRAIN, Space } from "./space.ts";

function room(): Space {
  return new Space(1, 4, 3, 1);
}

test("新空间全是空地", () => {
  const s = room();
  assert.equal(s.terrainAt({ x: 0, y: 0 }), EMPTY_TERRAIN);
  assert.deepEqual(s.occupantsAt({ x: 3, y: 2 }), []);
});

test("下标换算：y * width + x", () => {
  const s = room();
  assert.equal(s.index({ x: 0, y: 0 }), 0);
  assert.equal(s.index({ x: 3, y: 0 }), 3);
  assert.equal(s.index({ x: 0, y: 1 }), 4);
  assert.equal(s.index({ x: 3, y: 2 }), 11);
});

test("越界时抛错，而不是返回 -1", () => {
  const s = room();
  assert.throws(() => s.index({ x: 4, y: 0 }), /越界/);
  assert.throws(() => s.index({ x: -1, y: 0 }), /越界/);
  assert.equal(s.inBounds({ x: 3, y: 2 }), true);
  assert.equal(s.inBounds({ x: 4, y: 2 }), false);
});

test("地形可读可写", () => {
  const s = room();
  s.setTerrain({ x: 1, y: 1 }, 7);
  assert.equal(s.terrainAt({ x: 1, y: 1 }), 7);
  assert.equal(s.terrainAt({ x: 2, y: 1 }), EMPTY_TERRAIN);
});

test("同一个句柄不会重复占用同一格", () => {
  const s = room();
  const at = { x: 2, y: 1 };
  s.addOccupant(at, 100);
  s.addOccupant(at, 100);
  assert.deepEqual(s.occupantsAt(at), [100]);
});

test("移除占用者：返回是否本来存在", () => {
  const s = room();
  const at = { x: 2, y: 1 };
  s.addOccupant(at, 100);
  s.addOccupant(at, 101);

  assert.equal(s.removeOccupant(at, 999), false);
  assert.equal(s.removeOccupant(at, 100), true);
  assert.deepEqual(s.occupantsAt(at), [101]);
});

test("占满后移除最后一个，格子回到空中", () => {
  const s = room();
  const at = { x: 0, y: 0 };
  s.addOccupant(at, 1);
  assert.equal(s.removeOccupant(at, 1), true);
  assert.deepEqual(s.occupantsAt(at), []);
});

test("占用者返回的是副本，改它不影响空间", () => {
  const s = room();
  const at = { x: 1, y: 0 };
  s.addOccupant(at, 5);

  const copy = s.occupantsAt(at) as number[];
  copy.push(6);

  assert.deepEqual(s.occupantsAt(at), [5]);
});

test("四邻接：中心 4 个，角落 2 个", () => {
  const s = room();
  assert.equal(s.neighbors({ x: 1, y: 1 }).length, 4);
  assert.equal(s.neighbors({ x: 0, y: 0 }).length, 2);
  assert.equal(s.neighbors({ x: 3, y: 2 }).length, 2);
});

test("八邻接：中心 8 个，角落 3 个", () => {
  const s = room();
  assert.equal(s.neighbors({ x: 1, y: 1 }, "diagonal").length, 8);
  assert.equal(s.neighbors({ x: 0, y: 0 }, "diagonal").length, 3);
});

test("邻居不会越界", () => {
  const s = room();
  for (const cell of s.neighbors({ x: 0, y: 0 }, "diagonal")) {
    assert.equal(s.inBounds(cell), true);
  }
});

test("cellSize 只是元数据，不参与任何计算", () => {
  const small = new Space(1, 4, 3, 1);
  const big = new Space(2, 4, 3, 1000);

  assert.equal(small.neighbors({ x: 1, y: 1 }).length, big.neighbors({ x: 1, y: 1 }).length);
  assert.equal(small.index({ x: 3, y: 2 }), big.index({ x: 3, y: 2 }));
});

test("尺寸非法直接报错", () => {
  assert.throws(() => new Space(1, 0, 3), /正整数/);
  assert.throws(() => new Space(1, 2.5, 3), /正整数/);
});
