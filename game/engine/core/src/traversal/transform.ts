// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 偏移 → 偏移：形状的组合就是靠这几个变换。
 *
 * **只支持 90° 的整数倍旋转**——格子世界里 45° 会落到半格，
 * 那需要另一套「分数偏移」的表示，我们不引入。
 */

import { type Offset } from "./offsets.ts";

/** 旋转 90° 的整数倍（顺时针）。 */
export function rotate90(offsets: readonly Offset[], turns: number): Offset[] {
  const n = ((Math.round(turns) % 4) + 4) % 4;
  let out = offsets;
  for (let i = 0; i < n; i += 1) {
    // (x, y) → (y, -x)
    out = out.map((offset) => ({ dx: offset.dy, dy: -offset.dx }));
  }
  return [...out];
}

/** 镜像。 */
export function mirror(offsets: readonly Offset[], axis: "x" | "y" | "both" = "x"): Offset[] {
  return offsets.map((offset) => ({
    dx: axis === "y" ? offset.dx : -offset.dx,
    dy: axis === "x" ? offset.dy : -offset.dy,
  }));
}

/** 平移整组偏移。 */
export function translate(offsets: readonly Offset[], dx: number, dy: number): Offset[] {
  return offsets.map((offset) => ({ dx: offset.dx + dx, dy: offset.dy + dy }));
}

/** 只保留某些偏移（比如只要前方半圆）。 */
export function keep(offsets: readonly Offset[], predicate: (offset: Offset) => boolean): Offset[] {
  return offsets.filter(predicate);
}
