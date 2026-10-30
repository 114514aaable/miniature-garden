// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 只读视图：规则看世界的唯一通道。
 *
 * 为什么不直接把 Space / EntityTable 交出去：它们有写方法，
 * 规则拿到就能绕过 store 直接改世界，账本就废了。
 *
 * 视图还负责两件「语义」的事：
 *   1. 某个格子能不能走（地形含义在世界里，不在代码里）；
 *   2. 实体的**合并后组件**（模板默认值 + 实例覆盖）。
 *      规则要查 core.solid / core.body，必须看到合并后的数据。
 */

import { type Entity, type Handle } from "../entity/entity.ts";
import { PLACE, placeOf } from "../entity/place.ts";
import { type TemplateRegistry } from "../entity/template.ts";
import { mergeDeep } from "../entity/merge.ts";
import { type Cell, type Offset, Space, type SpaceId } from "../space.ts";
import { type JsonValue } from "../time.ts";

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

/** 实体的只读视图：加上「模板 + 覆盖」合并后的组件。 */
export interface EntityView extends Entity {
  readonly components: Readonly<Record<string, JsonValue>>;
}

/** 只要能按 handle 取实体就够了，不把实体表整个拖进来。 */
export interface EntitySource {
  get(handle: Handle): Entity;
}

export interface WorldView {
  readonly tick: number;
  space(id: SpaceId): SpaceView;
  entity(handle: Handle): EntityView;
}

export interface ViewOptions {
  readonly tick: number;
  readonly entities?: EntitySource;
  readonly terrains?: ReadonlyMap<number, TerrainRule>;
  /** 没有模板表就看不到模板里的组件，只能看到覆盖。 */
  readonly templates?: TemplateRegistry;
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
  private readonly templates: TemplateRegistry | null;

  constructor(spaces: Iterable<Space>, options: ViewOptions) {
    this.tick = options.tick;
    this.entities = options.entities ?? null;
    this.templates = options.templates ?? null;
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

  entity(handle: Handle): EntityView {
    if (this.entities === null) {
      throw new Error("这个视图没有实体来源，无法查询实体");
    }

    const entity = this.entities.get(handle);
    const defaults = this.templates?.has(entity.template) === true
      ? this.templates.get(entity.template).components
      : {};

    const components = mergeDeep(
      defaults as Record<string, JsonValue>,
      entity.overrides,
    ) as Record<string, JsonValue>;

    // 位置是虚拟组件：对外是一份普通数据，对内还是实体的 space/pos。
    const place = placeOf(entity);
    if (place !== null) {
      components[PLACE] = { space: place.space, x: place.x, y: place.y };
    }

    return { ...structuredClone(entity), components };
  }
}

/** 构造只读视图。tick 是快照的时刻；实体、地形表、模板表可选。 */
export function createWorldView(spaces: Iterable<Space>, options: ViewOptions): WorldView {
  return new WorldViewImpl(spaces, options);
}
