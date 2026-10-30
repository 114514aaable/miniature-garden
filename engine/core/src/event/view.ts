// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 只读视图：规则看世界的唯一通道。
 *
 * 为什么不直接把 Space / EntityTable 交出去：它们有写方法，
 * 规则拿到就能绕过 store 直接改世界，账本就废了。
 *
 * 视图还负责一件「语义」的事：某个格子能不能走。
 * 地形号只是数字，含义在世界里；规则不该自己判断「1 是不是墙」。
 */

import { type Entity, type Handle } from "../entity/entity.ts";
import { type Cell, type Offset, Space, type SpaceId } from "../space.ts";

export interface TerrainRule {
  readonly passable: boolean;
}

export interface SpaceView {
  readonly id: SpaceId;
  readonly width: number;
  readonly height: number;
  terrainAt(cell: Cell): number;
  occupantsAt(cell: Cell): readonly number[];
  /** 这个格子能不能走。地形没声明过就报错，不猜。 */
  passableAt(cell: Cell): boolean;
  each(origin: Cell, offsets: readonly Offset[], visit: (cell: Cell) => void): void;
}

/** 只要能按 handle 取实体就够了，不把实体表整个拖进来。 */
export interface EntitySource {
  get(handle: Handle): Entity;
}

export interface WorldView {
  readonly tick: number;
  space(id: SpaceId): SpaceView;
  entity(handle: Handle): Entity;
}

export interface ViewOptions {
  readonly tick: number;
  readonly entities?: EntitySource;
  readonly terrains?: ReadonlyMap<number, TerrainRule>;
}

class SpaceViewImpl implements SpaceView {
  readonly id: SpaceId;
  readonly width: number;
  readonly height: number;
  private readonly space: Space;
  private readonly terrains: ReadonlyMap<number, TerrainRule> | null;

  constructor(space: Space, terrains: ReadonlyMap<number, TerrainRule> | null) {
    this.space = space;
    this.terrains = terrains;
    this.id = space.id;
    this.width = space.width;
    this.height = space.height;
  }

  terrainAt(cell: Cell): number {
    return this.space.terrainAt(cell);
  }

  occupantsAt(cell: Cell): readonly number[] {
    return this.space.occupantsAt(cell);
  }

  passableAt(cell: Cell): boolean {
    const terrain = this.space.terrainAt(cell);
    if (this.terrains === null) {
      throw new Error("这个视图没有地形表，无法判断能不能走");
    }
    const rule = this.terrains.get(terrain);
    if (rule === undefined) {
      throw new Error(`世界没有声明地形 ${terrain} 的含义`);
    }
    return rule.passable;
  }

  each(origin: Cell, offsets: readonly Offset[], visit: (cell: Cell) => void): void {
    this.space.each(origin, offsets, (cell) => {
      visit(cell);
    });
  }
}

class WorldViewImpl implements WorldView {
  readonly tick: number;
  private readonly spaces: Map<SpaceId, SpaceView>;
  private readonly entities: EntitySource | null;

  constructor(spaces: Iterable<Space>, options: ViewOptions) {
    this.tick = options.tick;
    this.entities = options.entities ?? null;
    this.spaces = new Map();
    const terrains = options.terrains ?? null;
    for (const space of spaces) {
      this.spaces.set(space.id, new SpaceViewImpl(space, terrains));
    }
  }

  space(id: SpaceId): SpaceView {
    const view = this.spaces.get(id);
    if (view === undefined) {
      throw new Error(`空间不存在：${id}`);
    }
    return view;
  }

  /** 返回副本：规则改不到实体表内部。 */
  entity(handle: Handle): Entity {
    if (this.entities === null) {
      throw new Error("这个视图没有实体来源，无法查询实体");
    }
    return structuredClone(this.entities.get(handle));
  }
}

/** 构造只读视图。tick 是快照的时刻；实体与地形表可选。 */
export function createWorldView(spaces: Iterable<Space>, options: ViewOptions): WorldView {
  return new WorldViewImpl(spaces, options);
}
