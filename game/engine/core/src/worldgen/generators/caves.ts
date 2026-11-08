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

import { cellRandom } from "../noise.ts";

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
  /** 保留几个洞穴体（1 = 现在这样，一整片）。 */
  readonly regions?: number;
  /** 把空间切成几个洞厅（1 = 不切）。切完用门连起来。 */
  readonly chambers?: number;
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

  // 4. 保留洞穴体：默认 1 个（最大那片），regions=N 时保留 N 个并用隧道连起来
  const regions = Math.max(1, Math.floor(options.regions ?? 1));
  let floorCount = keepRegions(grid, width, height, regions, { x: cx, y: cy });

  // 4.5 切成多个洞厅：加墙分隔，再在每条分隔上开一扇门
  const chambers = Math.max(1, Math.floor(options.chambers ?? 1));
  if (chambers > 1) {
    floorCount = partitionIntoChambers(grid, width, height, chambers, options.seed);

    // 分隔线可能正好压在出生点上：再清一次（否则玩家出生在墙里）
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) continue;
        grid[y * width + x] = false;
      }
    }

    floorCount = 0;
    for (let index = 0; index < grid.length; index += 1) if (!grid[index]) floorCount += 1;
  }

  return { width, height, walls: grid, floorCount };
}

/**
 * 保留最多 `limit` 个洞穴体：
 *   - 出生点所在那片一定保留（否则玩家出生在墙里）；
 *   - 其余按面积从大到小挑；
 *   - 每个保留下来的洞穴，从出生区挖一条 L 形隧道过去，保证走得通；
 *   - 没保留下来的小洞填成墙。
 *
 * 返回挖完之后的可走格数。
 */
function keepRegions(
  grid: boolean[],
  width: number,
  height: number,
  limit: number,
  spawn: { x: number; y: number },
): number {
  // 找出所有连通区
  const seen = new Uint8Array(width * height);
  const regions: number[][] = [];

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
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (grid[next] || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }

    regions.push(region);
  }

  if (regions.length === 0) return 0;

  const spawnIndex = spawn.y * width + spawn.x;
  const spawnRegion = regions.find((region) => region.includes(spawnIndex)) ?? regions[0];

  // 出生区优先，其余按面积倒序
  const others = regions
    .filter((region) => region !== spawnRegion)
    .sort((a, b) => b.length - a.length);

  const keep = [spawnRegion, ...others.slice(0, limit - 1)];
  const keepSet = new Set(keep.flat());

  // 没保留的填成墙
  for (let index = 0; index < grid.length; index += 1) {
    if (!grid[index] && !keepSet.has(index)) grid[index] = true;
  }

  // 从出生区向其它洞穴挖隧道（L 形，先横后竖）
  const centerOf = (region: number[]) => {
    const cell = region[Math.floor(region.length / 2)];
    return { x: cell % width, y: Math.floor(cell / width) };
  };
  const from = centerOf(spawnRegion);

  for (const region of keep.slice(1)) {
    const to = centerOf(region);
    let x = from.x;
    let y = from.y;
    const stepX = Math.sign(to.x - x);
    while (x !== to.x) {
      carve(grid, width, height, x, y);
      x += stepX;
    }
    const stepY = Math.sign(to.y - y);
    while (y !== to.y) {
      carve(grid, width, height, x, y);
      y += stepY;
    }
    carve(grid, width, height, x, y);
  }

  let count = 0;
  for (let index = 0; index < grid.length; index += 1) if (!grid[index]) count += 1;
  return count;
}

/**
 * 把洞穴切成若干洞厅：
 *   - 按网格切分（2 个 = 左右，4 个 = 田字）；
 *   - 分隔处整列/整行填墙；
 *   - 每条分隔开一扇门，位置由种子决定——保证洞厅之间走得通。
 */
function partitionIntoChambers(
  grid: boolean[],
  width: number,
  height: number,
  chambers: number,
  seed: number,
): number {
  const cols = Math.max(1, Math.ceil(Math.sqrt(chambers)));
  const rows = Math.max(1, Math.ceil(chambers / cols));

  for (let c = 1; c < cols; c += 1) {
    const x = Math.round((width * c) / cols);
    for (let y = 1; y < height - 1; y += 1) grid[y * width + x] = true;
    const at = 2 + Math.floor(cellRandom(seed, c, 1) * (height - 5));
    if (at > 1 && at < height - 2) grid[at * width + x] = false;
  }

  for (let r = 1; r < rows; r += 1) {
    const y = Math.round((height * r) / rows);
    for (let x = 1; x < width - 1; x += 1) grid[y * width + x] = true;
    const at = 2 + Math.floor(cellRandom(seed, r, 2) * (width - 5));
    if (at > 1 && at < width - 2) grid[y * width + at] = false;
  }

  let count = 0;
  for (let index = 0; index < grid.length; index += 1) if (!grid[index]) count += 1;
  return count;
}

/** 挖开一格（边界不挖）。 */
function carve(grid: boolean[], width: number, height: number, x: number, y: number): void {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return;
  grid[y * width + x] = false;
}
