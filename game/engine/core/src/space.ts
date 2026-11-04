// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 空间：一个网格容器，属于数据层。
 *
 * 它只负责三件事：
 *   1. 存：地形（稠密）与占用者（稀疏）；
 *   2. 取：按坐标拿下标、拿内容；
 *   3. 遍历接口：给一组「偏移」，按偏移访问格子。
 *
 * 它**不存遍历规则** —— 四邻接、八邻接、骑士步、锥形视野，全部是上层给的偏移集。
 * 空间负责「能不能找到」，规则负责「算不算邻居」。
 *
 * ── 已知限制 ────────────────────────────────────────────
 * 当前只有二维。要加第三维，需要改三处：
 *   1. `strides` 追加一项 width * height；
 *   2. `index()` 改成按坐标点乘 strides；
 *   3. 遍历用的偏移集换成六邻接或二十六邻接。
 * 但寻路与视野是**另一个故事**：它们不是通用的，三维要重写。
 * ────────────────────────────────────────────────────────
 */

/** 空间句柄。v0 直接是数字，将来由解析器分配。 */
export type SpaceId = number;

/** 实体句柄。同上。 */
export type EntityHandle = number;

/** 局部坐标。只在所属空间内有意义，跨空间不换算。 */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** 相对偏移。规则层用它描述「什么算相邻」。 */
export interface Offset {
  readonly dx: number;
  readonly dy: number;
}

/** 遍历回调。返回 false 表示提前结束（射线、视线会用）。 */
export type Visitor = (cell: Cell, index: number) => void | boolean;

/**
 * 空气：一个正经注册的地形，编号 0。
 *
 * 它不是「没有地形」的哨兵值，而是地形表里的第一项。
 * 所以代码里不要写 `if (terrain === 0)` 这种特判——语义交给注册表，代码只认数字。
 * 另外注意：越界 ≠ 空气。空间外是「不存在」，会抛错。
 */
export const AIR = 0;

export class Space {
  readonly id: SpaceId;
  /** 父空间。v0 永远是 null——嵌套留着，实现先不做。 */
  readonly parent: SpaceId | null;
  readonly width: number;
  readonly height: number;
  /** 一格代表多少「世界单位」。纯元数据，内核从不读它。 */
  readonly cellSize: number;

  /**
   * 索引步长。v0 是 [1, width]；加第三维就追加一项 width * height。
   * 把维度信息放在数据里，而不是写在公式里。
   */
  private readonly strides: readonly number[];

  /**
   * 地形表：定长整数数组，下标 = x * strides[0] + y * strides[1]。
   * Int32Array 像 C 的数组：连续内存、定长、没有额外包装。
   */
  private readonly terrain: Int32Array;

  /**
   * 占用者：稀疏。大多数格子是空的，用 Map 只给有东西的格子分配内存。
   */
  private readonly occupants = new Map<number, EntityHandle[]>();

  constructor(
    id: SpaceId,
    width: number,
    height: number,
    cellSize: number = 1,
    parent: SpaceId | null = null,
  ) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error(`空间尺寸必须是正整数，收到 ${width}x${height}`);
    }
    this.id = id;
    this.parent = parent;
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.strides = [1, width];
    this.terrain = new Int32Array(width * height).fill(AIR);
  }

  /** 是否在范围内。所有「边界」判断都从这里出发。 */
  inBounds(cell: Cell): boolean {
    return cell.x >= 0 && cell.y >= 0 && cell.x < this.width && cell.y < this.height;
  }

  /**
   * 把二维坐标压成一维下标。
   * 越界直接抛错——「非法状态当场爆炸」，不要悄悄返回 -1。
   */
  index(cell: Cell): number {
    if (!this.inBounds(cell)) {
      throw new Error(`坐标越界：(${cell.x}, ${cell.y})，空间 ${this.width}x${this.height}`);
    }
    return this.indexAt(cell.x, cell.y);
  }

  terrainAt(cell: Cell): number {
    return this.terrain[this.index(cell)];
  }

  setTerrain(cell: Cell, value: number): void {
    this.terrain[this.index(cell)] = value;
  }

  /** 导出地形（存档用）。 */
  exportTerrain(): number[] {
    return Array.from(this.terrain);
  }

  /** 导回地形。长度不对直接报错，不猜。 */
  restoreTerrain(values: readonly number[]): void {
    if (values.length !== this.terrain.length) {
      throw new Error(`地形长度不匹配：需要 ${this.terrain.length}，收到 ${values.length}`);
    }
    this.terrain.set(values);
  }

  /** 清空占用索引（读档时按实体位置重建）。 */
  clearOccupants(): void {
    this.occupants.clear();
  }

  /**
   * 这个格子里有谁。
   * 返回副本而不是内部数组——类型上的 readonly 只是编译期的。
   */
  occupantsAt(cell: Cell): readonly EntityHandle[] {
    const list = this.occupants.get(this.index(cell));
    return list === undefined ? [] : [...list];
  }

  /** 放一个东西进去。同一个句柄不会重复加入。 */
  addOccupant(cell: Cell, handle: EntityHandle): void {
    const at = this.index(cell);
    const list = this.occupants.get(at);
    if (list === undefined) {
      this.occupants.set(at, [handle]);
      return;
    }
    if (!list.includes(handle)) {
      list.push(handle);
    }
  }

  /** 拿走一个东西。返回它本来在不在。 */
  removeOccupant(cell: Cell, handle: EntityHandle): boolean {
    const at = this.index(cell);
    const list = this.occupants.get(at);
    if (list === undefined) {
      return false;
    }
    const before = list.length;
    const next = list.filter((h) => h !== handle);
    if (next.length === 0) {
      this.occupants.delete(at);
    } else {
      this.occupants.set(at, next);
    }
    return next.length !== before;
  }

  /**
   * 遍历接口：以 origin 为中心，按 offsets 依次访问。
   *
   * 偏移由调用方给——所以「什么算相邻」是规则层的事，空间不认识它。
   * 越界的偏移直接跳过，不报错：范围法术扫到墙外是正常的。
   * 顺序严格按 offsets 的顺序，保证可复现。
   */
  each(origin: Cell, offsets: readonly Offset[], visit: Visitor): void {
    const ox = origin.x;
    const oy = origin.y;
    for (const { dx, dy } of offsets) {
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
        continue;
      }
      if (visit({ x, y }, this.indexAt(x, y)) === false) {
        return;
      }
    }
  }

  private indexAt(x: number, y: number): number {
    return x * this.strides[0] + y * this.strides[1];
  }
}

/**
 * 从 from 开始 BFS，找最近一个满足 ok 的格子（同距离按「上右下左」）。
 *
 * 确定性：顺序固定，不依赖随机或对象遍历顺序。
 * 找不到返回 null（说明整片都站不了，调用方决定怎么办）。
 */
export function nearestWhere(
  space: Space,
  from: Cell,
  ok: (cell: Cell) => boolean,
): Cell | null {
  // 起点可能越界（比如地图缩了）：先夹到范围内，否则 BFS 永远走不进去
  const start = {
    x: Math.min(Math.max(from.x, 0), space.width - 1),
    y: Math.min(Math.max(from.y, 0), space.height - 1),
  };

  if (ok(start)) return start;

  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: Cell[] = [start];
  const steps = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  while (queue.length > 0) {
    const cell = queue.shift() as Cell;
    for (const step of steps) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      const key = `${next.x},${next.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!space.inBounds(next)) continue;
      if (ok(next)) return next;
      queue.push(next);
    }
  }

  return null;
}
