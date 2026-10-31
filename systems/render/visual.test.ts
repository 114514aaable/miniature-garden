// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 视觉投影的测试：追赶、瞬移、钳制。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { clampDelta, DEFAULT_VISUAL, distance, stepVisual } from "./visual.ts";

test("第一次见到实体：直接对齐，不做动画", () => {
  assert.deepEqual(stepVisual(null, { x: 3, y: 2 }, 16), { x: 3, y: 2 });
});

test("已经在目标上：不动", () => {
  const at = { x: 1, y: 1 };
  assert.equal(stepVisual(at, { x: 1, y: 1 }, 16), at);
});

test("按速度追：100ms 走一格", () => {
  // 默认 10 格/秒 → 一格 100ms；这里给 50ms，应该走半格
  const next = stepVisual({ x: 0, y: 0 }, { x: 1, y: 0 }, 50);
  assert.equal(next.x, 0.5);
  assert.equal(next.y, 0);
});

test("一帧走完就对齐，不会冲过头", () => {
  const next = stepVisual({ x: 0, y: 0 }, { x: 1, y: 0 }, 1000);
  assert.deepEqual(next, { x: 1, y: 0 });
});

test("落后超过预算：直接瞬移", () => {
  const next = stepVisual({ x: 0, y: 0 }, { x: 9, y: 0 }, 16);
  assert.deepEqual(next, { x: 9, y: 0 });
});

test("预算边界之内的落后仍然追赶", () => {
  const next = stepVisual({ x: 0, y: 0 }, { x: 4, y: 0 }, 16);
  assert.ok(next.x > 0 && next.x < 4);
  assert.equal(DEFAULT_VISUAL.snapDistance, 5);
});

test("切 tab 回来：delta 被上一帧钳住", () => {
  // 上一帧正常 16ms，这一帧隔了 10 秒
  assert.equal(clampDelta(10_016, 10_000, 9_984), 16);
});

test("正常帧：delta 就是真实间隔", () => {
  assert.equal(clampDelta(1_016, 1_000, 984), 16);
});

test("时间倒退或没有历史：不跳", () => {
  assert.equal(clampDelta(1_000, 1_000, 984), 0);
  assert.equal(clampDelta(1_000, 1_000, 0), 0);
});

test("距离用切比雪夫：斜着走算一格", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 1, y: 1 }), 1);
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 1 }), 3);
});
