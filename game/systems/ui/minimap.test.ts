// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 小地图的测试：尺寸与绘制的调用次数。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_TERRAIN_COLORS, drawMinimap, minimapSize } from "./minimap.ts";

test("尺寸 = 格数 × 每格像素", () => {
  assert.deepEqual(minimapSize({ width: 8, height: 6, terrain: [] }, 4), { width: 32, height: 24 });
  assert.deepEqual(minimapSize({ width: 8, height: 6, terrain: [] }, 2), { width: 16, height: 12 });
});

function fakeContext() {
  const calls: Array<{ color: string; x: number; y: number }> = [];
  const context = {
    fillStyle: "",
    clearRect: () => {},
    fillRect(x: number, y: number) {
      calls.push({ color: this.fillStyle, x, y });
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

test("每一格画一次，最终标记再画一次", () => {
  const space = { width: 2, height: 2, terrain: [1, 1, 3, 3] };
  const { context, calls } = fakeContext();

  drawMinimap(context, { space, cell: 4, marks: [{ x: 1, y: 1, color: "#fff" }] });

  assert.equal(calls.length, 5);
  assert.equal(calls[0].color, DEFAULT_TERRAIN_COLORS[1]);
  assert.equal(calls[2].color, DEFAULT_TERRAIN_COLORS[3]);
  assert.deepEqual(calls[4], { color: "#fff", x: 4, y: 4 });
});

test("没声明颜色的地形号用兜底色，不抛错", () => {
  const { context, calls } = fakeContext();
  drawMinimap(context, { space: { width: 1, height: 1, terrain: [99] }, cell: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].color, "#1a1f27");
});
