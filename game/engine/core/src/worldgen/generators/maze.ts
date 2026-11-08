// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 迷宫生成（迭代回溯 + 可选编织）。
 *
 * 思路和「房间」相反：房间是挖出一块块空地，迷宫是**在实心墙里挖一条条通道**。
 *
 *   格子   (1,1) (3,1) (5,1) …
 *   通道   格子和相邻格子之间挖开一格
 *   边界   最外一圈永远是墙
 *
 * 编织（braid）：挖完以后，把死胡同按概率打通到旁边——迷宫不再只有一条路，
 * 走起来没那么折磨，也更像天然洞穴。
 *
 * 全部确定性：随机数只来自 (seed, 计数器)，不读时钟、不依赖调用顺序。
 */

/** 简单、够用的确定性伪随机（mulberry32）。 */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MazeConfig {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** 墙的地形号。 */
  readonly wall: number;
  /** 通道的地形号。 */
  readonly floor: number;
  /** 0..1：死胡同被打通的比例（默认 0）。 */
  readonly braid?: number;
  /** 最外圈留几格墙（默认 1）。 */
  readonly inset?: number;
  /** 随机种子偏移：同一张图里想生成第二座迷宫时用。 */
  readonly seedOffset?: number;
}

/** 生成一张迷宫地形（width × height 的数组）。 */
export function generateMaze(config: MazeConfig): number[] {
  const { width, height, wall, floor } = config;
  const inset = Math.max(1, Math.floor(config.inset ?? 1));
  const braid = Math.min(1, Math.max(0, config.braid ?? 0));
  const terrain = new Array<number>(width * height).fill(wall);

  // 可用区域：扣掉外圈
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  if (innerWidth < 3 || innerHeight < 3) return terrain;

  // 格子间距 2：格子本身 + 中间一格通道
  const cols = Math.floor((innerWidth - 1) / 2);
  const rows = Math.floor((innerHeight - 1) / 2);
  if (cols < 1 || rows < 1) return terrain;

  const rand = random((config.seed + (config.seedOffset ?? 0) * 7919) >>> 0);

  const cellX = (cx: number): number => inset + cx * 2;
  const cellY = (cy: number): number => inset + cy * 2;
  const at = (x: number, y: number): number => y * width + x;

  const visited = new Array<boolean>(cols * rows).fill(false);

  // 迭代回溯：栈里放「当前格子」
  const stack: Array<{ cx: number; cy: number }> = [{ cx: 0, cy: 0 }];
  visited[0] = true;
  terrain[at(cellX(0), cellY(0))] = floor;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    // 没访问过的邻居
    const options: Array<{ cx: number; cy: number }> = [];
    if (current.cx > 0 && !visited[(current.cy) * cols + current.cx - 1]) options.push({ cx: current.cx - 1, cy: current.cy });
    if (current.cx < cols - 1 && !visited[current.cy * cols + current.cx + 1]) options.push({ cx: current.cx + 1, cy: current.cy });
    if (current.cy > 0 && !visited[(current.cy - 1) * cols + current.cx]) options.push({ cx: current.cx, cy: current.cy - 1 });
    if (current.cy < rows - 1 && !visited[(current.cy + 1) * cols + current.cx]) options.push({ cx: current.cx, cy: current.cy + 1 });

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const next = options[Math.floor(rand() * options.length)];
    visited[next.cy * cols + next.cx] = true;

    // 挖通道：两个格子中间那格
    const midX = (cellX(current.cx) + cellX(next.cx)) / 2;
    const midY = (cellY(current.cy) + cellY(next.cy)) / 2;
    terrain[at(cellX(next.cx), cellY(next.cy))] = floor;
    terrain[at(midX, midY)] = floor;

    stack.push(next);
  }

  // 编织：把死胡同按 braid 概率打通
  if (braid > 0) {
    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        const x = cellX(cx);
        const y = cellY(cy);

        // 数一数这个格子通了几条
        let open = 0;
        if (cx > 0 && terrain[at(x - 1, y)] === floor) open += 1;
        if (cx < cols - 1 && terrain[at(x + 1, y)] === floor) open += 1;
        if (cy > 0 && terrain[at(x, y - 1)] === floor) open += 1;
        if (cy < rows - 1 && terrain[at(x, y + 1)] === floor) open += 1;

        if (open !== 1) continue;
        if (rand() > braid) continue;

        // 找一个能打通的方向（优先打向还没连通的方向）
        const dirs: Array<{ dx: number; dy: number }> = [];
        if (cx > 0) dirs.push({ dx: -1, dy: 0 });
        if (cx < cols - 1) dirs.push({ dx: 1, dy: 0 });
        if (cy > 0) dirs.push({ dx: 0, dy: -1 });
        if (cy < rows - 1) dirs.push({ dx: 0, dy: 1 });

        const dir = dirs[Math.floor(rand() * dirs.length)];
        terrain[at(x + dir.dx, y + dir.dy)] = floor;
      }
    }
  }

  return terrain;
}
