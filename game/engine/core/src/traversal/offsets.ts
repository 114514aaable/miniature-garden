// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 偏移算子：形状 → 一组相对偏移。
 *
 * **算子只有这几种，形状可以无限多**——因为形状是「算子 + 变换」组合出来的
 * （见 transform.ts，组合写在 base 的 traversal.json 里）。
 *
 * 约定：range = 0 时只返回中心点。
 */

/** 相对偏移（格）。 */
export interface Offset {
  readonly dx: number;
  readonly dy: number;
}

/** 基础算子。 */
export type BaseShape = "circle" | "diamond" | "cross" | "rect";

function* ring(max: number, accept: (dx: number, dy: number) => boolean): Generator<Offset> {
  for (let dy = -max; dy <= max; dy += 1) {
    for (let dx = -max; dx <= max; dx += 1) {
      if (accept(dx, dy)) yield { dx, dy };
    }
  }
}

/**
 * 生成基础形状。
 *
 * - `circle`  切比雪夫距离（方形视野，格子游戏里最常用）
 * - `diamond` 曼哈顿距离（菱形，飞行/斜向移动用）
 * - `cross`   只看四条轴（不含中心）
 * - `rect`    宽高由 range 与 height 决定，以中心为原点
 */
export function baseOffsets(shape: BaseShape, range: number, height = range): Offset[] {
  const r = Math.max(0, Math.floor(range));
  if (r === 0) return [{ dx: 0, dy: 0 }];

  switch (shape) {
    case "circle":
      return [...ring(r, (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)) <= r)];
    case "diamond":
      return [...ring(r, (dx, dy) => Math.abs(dx) + Math.abs(dy) <= r)];
    case "cross":
      return [...ring(r, (dx, dy) => (dx === 0 || dy === 0) && !(dx === 0 && dy === 0))];
    case "rect": {
      const h = Math.max(0, Math.floor(height));
      const out: Offset[] = [];
      for (let dy = -h; dy <= h; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) out.push({ dx, dy });
      }
      return out;
    }
  }
}

/** 去掉重复偏移（组合算子之后可能重叠）。 */
export function dedupe(offsets: readonly Offset[]): Offset[] {
  const seen = new Set<string>();
  const out: Offset[] = [];
  for (const offset of offsets) {
    const key = `${offset.dx},${offset.dy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offset);
  }
  return out;
}
