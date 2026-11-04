// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 元胞地牢：元胞自动机（cellular automata）挖洞穴。
 *
 * 和噪声不同，它是**迭代**出来的：
 *   1. 按种子随机撒「墙」，玩家出生区域强制清空
 *   2. 反复做「周围墙够多就是墙」的平滑
 *   3. 只保留最大连通区，其余填死——保证地图走得通
 *
 * 确定性：初始撒点用 cellRandom(seed, x, y)，不用顺序随机。
 */

import { cellRandom } from "./noise.ts";

export interface CavesOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** 初始墙的比例（0..1）。 */
  readonly fill?: number;
  /** 平滑迭代次数。 */
  readonly iterations?: number;
  /** 出生点周围强制清空的半径（保证能出生）。 */
  readonly spawnClear?: number;
}

export interface CavesResult {
  readonly width: number;
  readonly height: number;
  /** true = 墙，false = 可走。 */
  readonly walls: readonly boolean[];
  /** 最大连通区域的大小（可走格数）。 */
  readonly floorCount: number;
}

export function generateCaves(options: CavesOptions): CavesResult {
  const width = Math.max(4, Math.floor(options.width));
  const height = Math.max(4, Math.floor(options.height));
  const fill = options.fill ?? 0.46;
  const iterations = options.iterations ?? 5;
  const spawnClear = options.spawnClear ?? 2;

  let grid = new Array<boolean>(width * height).fill(false);

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? true : grid[y * width + x]);

  // 1. 撒墙：边界永远是墙
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      grid[y * width + x] = border || cellRandom(options.seed, x, y) < fill;
    }
  }

  // 2. 平滑：周围 8 格墙 ≥ 5 就是墙
  for (let step = 0; step < iterations; step += 1) {
    const next = grid.slice();
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            if (at(x + dx, y + dy)) walls += 1;
          }
        }
        next[y * width + x] = walls >= 5;
      }
    }
    grid = next;
  }

  // 3. 出生点周围清空
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let y = cy - spawnClear; y <= cy + spawnClear; y += 1) {
    for (let x = cx - spawnClear; x <= cx + spawnClear; x += 1) {
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) continue;
      grid[y * width + x] = false;
    }
  }

  // 4. 只留最大连通区
  const floorCount = keepLargestRegion(grid, width, height);

  return { width, height, walls: grid, floorCount };
}

/** 洪水填充最大的可走区域，其余填成墙；返回保留下来的可走格数。 */
function keepLargestRegion(grid: boolean[], width: number, height: number): number {
  const seen = new Uint8Array(width * height);
  let best: number[] = [];

  for (let start = 0; start < grid.length; start += 1) {
    if (grid[start] || seen[start] === 1) continue;

    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      region.push(index);
      const x = index % width;
      const y = Math.floor(index / width);

      const neighbours = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (grid[next] || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }

    if (region.length > best.length) best = region;
  }

  const keep = new Set(best);
  for (let index = 0; index < grid.length; index += 1) {
    if (!grid[index] && !keep.has(index)) grid[index] = true;
  }

  return best.length;
}
