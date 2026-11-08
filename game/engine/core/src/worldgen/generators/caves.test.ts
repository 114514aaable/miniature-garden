// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 元胞地牢的测试：确定性、连通、出生点可用。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { generateCaves } from "./caves.ts";

test("同样的种子与尺寸：一模一样", () => {
  const a = generateCaves({ seed: 3, width: 30, height: 20 });
  const b = generateCaves({ seed: 3, width: 30, height: 20 });
  assert.deepEqual(a.walls, b.walls);
  assert.equal(a.floorCount, b.floorCount);
});

test("换种子会换地图", () => {
  const a = generateCaves({ seed: 3, width: 30, height: 20 });
  const b = generateCaves({ seed: 4, width: 30, height: 20 });
  assert.notEqual(a.walls.join(""), b.walls.join(""));
});

test("边界永远是墙", () => {
  const { walls, width, height } = generateCaves({ seed: 1, width: 20, height: 12 });
  for (let x = 0; x < width; x += 1) {
    assert.equal(walls[x], true, `上边 ${x}`);
    assert.equal(walls[(height - 1) * width + x], true, `下边 ${x}`);
  }
  for (let y = 0; y < height; y += 1) {
    assert.equal(walls[y * width], true, `左边 ${y}`);
    assert.equal(walls[y * width + width - 1], true, `右边 ${y}`);
  }
});

test("出生点周围是空的", () => {
  const { walls, width, height } = generateCaves({ seed: 7, width: 31, height: 21, spawnClear: 2 });
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let y = cy - 2; y <= cy + 2; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      assert.equal(walls[y * width + x], false, `(${x}, ${y}) 应该能站`);
    }
  }
});

test("连通：从出生点能走到的格子等于 floorCount", () => {
  const { walls, width, height, floorCount } = generateCaves({ seed: 11, width: 40, height: 26 });
  const start = Math.floor(height / 2) * width + Math.floor(width / 2);
  const seen = new Set<number>([start]);
  const stack = [start];

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (walls[next] || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }

  assert.equal(seen.size, floorCount, "不该有走不到的孤立区域");
});

test("可走面积占一定比例（不是全墙也不是全空）", () => {
  const { floorCount, width, height } = generateCaves({ seed: 5, width: 40, height: 26 });
  const ratio = floorCount / (width * height);
  assert.ok(ratio > 0.15, `太窄：${ratio}`);
  assert.ok(ratio < 0.85, `太空：${ratio}`);
});

test("小尺寸也能生成（不崩）", () => {
  const result = generateCaves({ seed: 2, width: 4, height: 4 });
  assert.equal(result.walls.length, 16);
});

test("洞厅：切分后面积变小，但每个洞厅都走得通", () => {
  const one = generateCaves({ seed: 7, width: 48, height: 24 });
  const four = generateCaves({ seed: 7, width: 48, height: 24, chambers: 4 });

  assert.ok(four.floorCount < one.floorCount, "切分后应该少一些可走格");

  // 从出生点洪水填充，应该覆盖全部可走格（门把洞厅连起来了）
  const start = Math.floor(four.height / 2) * four.width + Math.floor(four.width / 2);
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % four.width;
    const y = Math.floor(index / four.width);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= four.width || ny >= four.height) continue;
      const next = ny * four.width + nx;
      if (four.walls[next] || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }

  assert.equal(seen.size, four.floorCount, "洞厅之间应该有门");
});
