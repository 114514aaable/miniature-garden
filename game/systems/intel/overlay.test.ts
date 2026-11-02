// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 情报叠加的测试：预警格位置、透明度、血条只在受伤时画。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { drawOverlay, intentAlpha, intentCells } from "./overlay.ts";

test("预警格 = 实体格 + 偏移", () => {
  const cells = intentCells({
    x: 3,
    y: 4,
    intent: { tiles: [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }], damage: 2, inTicks: 2, totalTicks: 2 },
  });
  assert.deepEqual(cells, [{ x: 2, y: 4 }, { x: 3, y: 5 }]);
});

test("没有意图就没有预警格", () => {
  assert.deepEqual(intentCells({ x: 1, y: 1 }), []);
});

test("越接近结算越不透明", () => {
  assert.ok(intentAlpha(0, 2) > intentAlpha(2, 2));
  assert.equal(intentAlpha(2, 2), 0.15);
  assert.equal(intentAlpha(0, 2), 0.4);
});

function fakeContext() {
  const rects: Array<{ color: string; x: number; y: number; w: number; h: number }> = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ color: this.fillStyle, x, y, w, h });
    },
    strokeRect: () => {},
  };
  return { context: context as unknown as CanvasRenderingContext2D, rects };
}

test("满血实体不画血条", () => {
  const { context, rects } = fakeContext();
  drawOverlay(context, {
    tile: 32,
    camera: { x: 0, y: 0 },
    entities: [{ x: 1, y: 1, health: { cur: 10, max: 10, ratio: 1, hurt: false, critical: false } }],
  });
  assert.equal(rects.length, 0);
});

test("受伤实体画轨道 + 填充两笔", () => {
  const { context, rects } = fakeContext();
  drawOverlay(context, {
    tile: 32,
    camera: { x: 0, y: 0 },
    entities: [{ x: 1, y: 1, health: { cur: 5, max: 10, ratio: 0.5, hurt: true, critical: false } }],
  });
  assert.equal(rects.length, 2);
  assert.equal(rects[1].w, Math.round(rects[0].w * 0.5));
});
