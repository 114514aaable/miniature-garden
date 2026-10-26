// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 网格：整个世界的最底层。
 *
 * 这一版只做两件事：
 *   1. 判断一个点是否落在格子范围内；
 *   2. 从 A 点走一步到 B 点（走不出去就原地不动）。
 *
 * 以后所有的规则都长在它上面，所以它必须简单、可测试、且不依赖任何画面代码。
 */

/** 一个格子坐标。readonly 表示「创建之后不能再改」，避免被别处偷偷改掉。 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** 网格本身：只管尺寸与边界，不管里面有什么。 */
export class Grid {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error(`网格尺寸必须是正数，收到 ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
  }

  /** 这个点是否在网格内？ */
  inBounds(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  /**
   * 从 from 沿 (dx, dy) 走一格。
   *
   * 越界时返回原来的 from，而不是报错——这样调用方（比如「玩家按了一下上」）
   * 不需要每次都先检查边界，规则会简单很多。
   */
  step(from: Point, dx: number, dy: number): Point {
    const to: Point = { x: from.x + dx, y: from.y + dy };
    return this.inBounds(to) ? to : from;
  }
}
