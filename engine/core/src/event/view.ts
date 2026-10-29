// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 只读视图：规则看世界的唯一通道。
 *
 * 为什么不直接把 Space / EntityTable 交出去：它们有写方法，
 * 规则拿到就能绕过 store 直接改世界，账本就废了。
 *
 * 这里只做包装，不暴露写接口——求值发生在 store.step() 之外，
 * 那段时间世界是静止的，所以直读是安全的（见契约 §8）。
 */

import { type Entity, type Handle } from "../entity/entity.ts";
import { type Cell, type Offset, Space, type SpaceId } from "../space.ts";

export interface SpaceView {
  readonly id: SpaceId;
  readonly width: number;
  readonly height: number;
  terrainAt(cell: Cell): number;
  occupantsAt(cell: Cell): readonly number[];
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

class SpaceViewImpl implements SpaceView {
  readonly id: SpaceId;
  readonly width: number;
  readonly height: number;
  private readonly space: Space;

  constructor(space: Space) {
    this.space = space;
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

  constructor(spaces: Iterable<Space>, tick: number, entities: EntitySource | null) {
    this.tick = tick;
    this.spaces = new Map();
    this.entities = entities;
    for (const space of spaces) {
      this.spaces.set(space.id, new SpaceViewImpl(space));
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

/** 构造只读视图。tick 是快照的时刻；entities 可选，不给就查不了实体。 */
export function createWorldView(
  spaces: Iterable<Space>,
  tick: number,
  entities: EntitySource | null = null,
): WorldView {
  return new WorldViewImpl(spaces, tick, entities);
}
