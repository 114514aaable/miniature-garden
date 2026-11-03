// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 偏移 → 格子：落点、去重、裁剪。
 *
 * 形状只负责「数学」，越界与去重在这里处理——
 * 这样形状不用知道地图多大。
 */

import { dedupe, type Offset } from "./offsets.ts";

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly width: number;
  readonly height: number;
}

/** 把偏移落到以 origin 为中心的格子上（默认裁掉越界、去重）。 */
export function cellsOf(
  origin: Cell,
  offsets: readonly Offset[],
  bounds?: Bounds,
): Cell[] {
  const cells = dedupe(offsets).map((offset) => ({ x: origin.x + offset.dx, y: origin.y + offset.dy }));

  if (bounds === undefined) return cells;
  return cells.filter(
    (cell) => cell.x >= 0 && cell.y >= 0 && cell.x < bounds.width && cell.y < bounds.height,
  );
}

/** 点到点的距离（切比雪夫：和 circle 形状一致）。 */
export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** 曼哈顿距离（和 diamond 形状一致）。 */
export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
