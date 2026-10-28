// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 偏移集（stencil）：规则层的第一个文件。
 *
 * 「什么算相邻」是语义，不是几何，所以它不在空间里，在这里。
 * 空间只负责按偏移取格子；选哪一组偏移，是这个世界自己的事。
 *
 * 想加六边形？在这里写一组偏移，空间一行都不用改。
 */

import type { Offset } from "./space.ts";

/** 十字：上下左右。 */
export const ORTHOGONAL: readonly Offset[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

/** 米字：含四条对角线。 */
export const DIAGONAL: readonly Offset[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
];

/**
 * 矩形范围，以原点为中心。
 * 3×3 就是范围技的正常形状；4×4 会向左上偏一格（奇数边长才是严格居中）。
 */
export function rect(width: number, height: number): Offset[] {
  if (width <= 0 || height <= 0) {
    throw new Error(`矩形范围必须是正数，收到 ${width}x${height}`);
  }
  const x0 = -Math.floor(width / 2);
  const y0 = -Math.floor(height / 2);
  const offsets: Offset[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      offsets.push({ dx: x0 + x, dy: y0 + y });
    }
  }
  return offsets;
}

/**
 * 方环：切比雪夫距离恰好等于半径的一圈。
 * 半径 1 就是米字的八个格子；半径 2 是外面再一圈。
 */
export function ring(radius: number): Offset[] {
  if (!Number.isInteger(radius) || radius < 1) {
    throw new Error(`环半径必须是正整数，收到 ${radius}`);
  }
  const offsets: Offset[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}

/**
 * 一条射线：从原点出发，沿 (dx, dy) 走 length 步。
 * 用于视线、冲刺、贯穿攻击。
 */
export function line(dx: number, dy: number, length: number): Offset[] {
  if ((dx === 0 && dy === 0) || length < 1) {
    throw new Error(`射线参数非法：(${dx}, ${dy}) x ${length}`);
  }
  const offsets: Offset[] = [];
  for (let step = 1; step <= length; step++) {
    offsets.push({ dx: dx * step, dy: dy * step });
  }
  return offsets;
}
