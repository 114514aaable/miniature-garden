// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 空间的测试。
 *
 * 这里有一条测试值得单独看：**「骑士步」那条**。
 * 空间完全不认识「骑士步」，但上层可以用一组自定义偏移遍历它——
 * 这就是「不写死遍历」的证据。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EMPTY_TERRAIN, type Cell, Space } from "./space.ts";
import { DIAGONAL, ORTHOGONAL, line, rect, ring } from "./stencils.ts";

function room(): Space {
  return new Space(1, 4, 3, 1);
}

/** 收集一次遍历访问到的格子。 */
function collect(space: Space, origin: Cell, offsets: readonly { dx: number; dy: number }[]): Cell[] {
  const seen: Cell[] = [];
  space.each(origin, offsets, (cell) => {
    seen.push(cell);
  });
  return seen;
}

test("新空间全是空地", () => {
  const s = room();
  assert.equal(s.terrainAt({ x: 0, y: 0 }), EMPTY_TERRAIN);
  assert.deepEqual(s.occupantsAt({ x: 3, y: 2 }), []);
});

test("下标换算：x * strideX + y * strideY", () => {
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
  assert.equal(collect(s, { x: 1, y: 1 }, ORTHOGONAL).length, 4);
  assert.equal(collect(s, { x: 0, y: 0 }, ORTHOGONAL).length, 2);
});

test("八邻接：中心 8 个，角落 3 个", () => {
  const s = room();
  assert.equal(collect(s, { x: 1, y: 1 }, DIAGONAL).length, 8);
  assert.equal(collect(s, { x: 0, y: 0 }, DIAGONAL).length, 3);
});

test("越界的偏移直接跳过，不报错", () => {
  const s = room();
  for (const cell of collect(s, { x: 0, y: 0 }, DIAGONAL)) {
    assert.equal(s.inBounds(cell), true);
  }
});

test("遍历顺序严格按偏移顺序（可复现）", () => {
  const s = room();
  const offsets = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];
  assert.deepEqual(collect(s, { x: 2, y: 1 }, offsets), [
    { x: 3, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 1 },
  ]);
});

test("回调返回 false 可以提前结束", () => {
  const s = room();
  let visited = 0;
  s.each({ x: 1, y: 1 }, DIAGONAL, () => {
    visited += 1;
    return false;
  });
  assert.equal(visited, 1);
});

test("空间不认识骑士步，但上层可以用它遍历", () => {
  const s = new Space(1, 8, 8, 1);
  const knight = [
    { dx: 1, dy: 2 },
    { dx: 2, dy: 1 },
    { dx: 2, dy: -1 },
    { dx: 1, dy: -2 },
    { dx: -1, dy: -2 },
    { dx: -2, dy: -1 },
    { dx: -2, dy: 1 },
    { dx: -1, dy: 2 },
  ];

  assert.equal(collect(s, { x: 4, y: 4 }, knight).length, 8);
  assert.equal(collect(s, { x: 0, y: 0 }, knight).length, 2);
});

test("矩形范围以原点为中心", () => {
  const s = new Space(1, 9, 9, 1);
  const cells = collect(s, { x: 4, y: 4 }, rect(3, 3));
  assert.equal(cells.length, 9);
  assert.deepEqual(cells[4], { x: 4, y: 4 });
});

test("射线：从原点出发，按长度走", () => {
  const s = new Space(1, 9, 9, 1);
  assert.deepEqual(collect(s, { x: 2, y: 2 }, line(1, 0, 3)), [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 5, y: 2 },
  ]);
});

test("环：半径 1 是八个，半径 2 是十六个", () => {
  const s = new Space(1, 9, 9, 1);
  assert.equal(collect(s, { x: 4, y: 4 }, ring(1)).length, 8);
  assert.equal(collect(s, { x: 4, y: 4 }, ring(2)).length, 16);
});

test("非法的偏移集参数直接报错", () => {
  assert.throws(() => rect(0, 3), /正数/);
  assert.throws(() => ring(0), /正整数/);
  assert.throws(() => line(0, 0, 3), /非法/);
});

test("cellSize 只是元数据，不参与任何计算", () => {
  const small = new Space(1, 4, 3, 1);
  const big = new Space(2, 4, 3, 1000);

  assert.equal(collect(small, { x: 1, y: 1 }, DIAGONAL).length, collect(big, { x: 1, y: 1 }, DIAGONAL).length);
  assert.equal(small.index({ x: 3, y: 2 }), big.index({ x: 3, y: 2 }));
});

test("尺寸非法直接报错", () => {
  assert.throws(() => new Space(1, 0, 3), /正整数/);
  assert.throws(() => new Space(1, 2.5, 3), /正整数/);
});
