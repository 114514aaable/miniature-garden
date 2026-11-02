// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 相机的测试：居中、跟随、夹边界、坐标互转。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { cameraFor, cellsInView, screenToWorld, worldToScreen } from "./camera.ts";

const tile = 32;
const viewport = { width: 640, height: 480 }; // 20 × 15 格

test("视口格子数：按窗口尺寸算", () => {
  assert.deepEqual(cellsInView(viewport, tile), { width: 20, height: 15 });
});

test("默认跟玩家：地图再小也把玩家放正中", () => {
  const camera = cameraFor({ x: 3, y: 2 }, viewport, { width: 8, height: 6 }, tile);
  assert.equal(camera.x, 3 + 0.5 - 10); // -6.5
  assert.equal(camera.y, 2 + 0.5 - 7.5); // -5
});

test("map 模式：地图装得下时居中地图（老行为）", () => {
  const camera = cameraFor({ x: 3, y: 2 }, viewport, { width: 8, height: 6 }, tile, "map");
  assert.equal(camera.x, (8 - 20) / 2); // -6
  assert.equal(camera.y, (6 - 15) / 2); // -4.5
});

test("地图比视口大：目标居中", () => {
  const camera = cameraFor({ x: 50, y: 40 }, viewport, { width: 100, height: 100 }, tile);
  assert.equal(camera.x, 50 + 0.5 - 10); // 40.5
  assert.equal(camera.y, 40 + 0.5 - 7.5); // 33
});

test("贴左上角：相机夹在 0", () => {
  const camera = cameraFor({ x: 0, y: 0 }, viewport, { width: 100, height: 100 }, tile);
  assert.equal(camera.x, 0);
  assert.equal(camera.y, 0);
});

test("贴右下角：相机夹在地图末尾", () => {
  const camera = cameraFor({ x: 99, y: 99 }, viewport, { width: 100, height: 100 }, tile);
  assert.equal(camera.x, 100 - 20);
  assert.equal(camera.y, 100 - 15);
});

test("格子 ↔ 屏幕 互转", () => {
  const camera = { x: 2.5, y: 1 };
  const screen = worldToScreen({ x: 5, y: 3 }, camera, tile);
  assert.deepEqual(screen, { x: 80, y: 64 });

  const back = screenToWorld({ x: 81, y: 65 }, camera, tile);
  assert.deepEqual(back, { x: 5, y: 3 });
});

test("屏幕负坐标也能正确落到格子上", () => {
  const camera = { x: -2, y: -1 };
  assert.deepEqual(screenToWorld({ x: 0, y: 0 }, camera, tile), { x: -2, y: -1 });
});
