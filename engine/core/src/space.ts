// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 空间：一个网格容器。
 *
 * 它不知道「墙」是什么，也不知道「谁」在里面。
 * 它只知道两件事：
 *   1. 每个格子存一个地形编号（纯数字）；
 *   2. 每个格子可以挂若干个「占用者」句柄（也是纯数字）。
 *
 * 所以「能不能走过去」「这个人是不是敌人」这些判断，全部属于上层。
 * 内核只回答「哪里有什么」，不回答「那意味着什么」。
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

/** 邻接方式：十字还是米字。 */
export type NeighborMode = "orthogonal" | "diagonal";

/** 地形 0 = 空地。将来由世界包定义每个数字的含义。 */
export const EMPTY_TERRAIN = 0;

export class Space {
  readonly id: SpaceId;
  /** 父空间。v0 永远是 null——嵌套留着，实现先不做。 */
  readonly parent: SpaceId | null;
  readonly width: number;
  readonly height: number;
  /** 一格代表多少「世界单位」。纯元数据，内核从不读它。 */
  readonly cellSize: number;

  /**
   * 地形表：定长整数数组，下标 = y * width + x。
   * 用 Int32Array 而不是普通数组，因为它像 C 的数组：连续内存、定长、没有额外包装。
   */
  private readonly terrain: Int32Array;

  /**
   * 占用者：稀疏。大多数格子是空的，用 Map 只给有东西的格子分配内存。
   * 键是格子下标，值是句柄数组。
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
    this.terrain = new Int32Array(width * height).fill(EMPTY_TERRAIN);
  }

  /** 是否在范围内。所有「边界」判断都从这里出发。 */
  inBounds(cell: Cell): boolean {
    return cell.x >= 0 && cell.y >= 0 && cell.x < this.width && cell.y < this.height;
  }

  /**
   * 把二维坐标压成一维下标。
   * 越界直接抛错——这是「非法状态当场爆炸」，不要悄悄返回 -1，
   * 否则错误会带着一个假坐标在系统里跑很远。
   */
  index(cell: Cell): number {
    if (!this.inBounds(cell)) {
      throw new Error(`坐标越界：(${cell.x}, ${cell.y})，空间 ${this.width}x${this.height}`);
    }
    return cell.y * this.width + cell.x;
  }

  terrainAt(cell: Cell): number {
    return this.terrain[this.index(cell)];
  }

  setTerrain(cell: Cell, value: number): void {
    this.terrain[this.index(cell)] = value;
  }

  /**
   * 这个格子里有谁。
   * 返回副本而不是内部数组——类型上的 readonly 只是编译期的，运行时可被改。
   * 现在的格子最多几个人，拷贝很便宜；将来要省，再换成只读视图。
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
   * 相邻的格子。越界的方向直接不返回，所以角落只有 2 或 3 个邻居。
   * 返回新对象，调用方改它不会影响空间。
   */
  neighbors(cell: Cell, mode: NeighborMode = "orthogonal"): Cell[] {
    const offsets =
      mode === "orthogonal"
        ? [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ]
        : [
            [0, -1],
            [1, -1],
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
            [-1, 0],
            [-1, -1],
          ];

    const result: Cell[] = [];
    for (const [dx, dy] of offsets) {
      const next: Cell = { x: cell.x + dx, y: cell.y + dy };
      if (this.inBounds(next)) {
        result.push(next);
      }
    }
    return result;
  }
}
