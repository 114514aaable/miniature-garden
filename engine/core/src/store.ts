// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * Store：世界状态的唯一写入口。
 *
 * 它只做四件事：
 *   1. 持有空间与实体；
 *   2. 接收变更（submit），先排队，不动状态；
 *   3. 在 tick 边界一次性应用（step），要么全成，要么全不成；
 *   4. 每次应用都写进时间线——事件的时间由时间线盖，这里伪造不了。
 *
 * 它不知道「玩家按了什么键」，也不知道「这个技能该不该命中」。
 * 那些是规则层的事：规则层把结果翻译成 Effect，Store 只负责安全地落地。
 *
 * 实体与空间占用必须在一个事务里改：改了实体位置却没改占用，就会出现
 * 「人已经走了，索引里还留着他」的幽灵实体。
 */

import { type Cell, type SpaceId, Space } from "./space.ts";
import { type Handle, EntityTable, type Entity } from "./entity/entity.ts";
import { PLACE } from "./entity/place.ts";
import { mergeDeep } from "./entity/merge.ts";
import { type JsonValue, type LogEntry, type Tick, Timeline } from "./time.ts";

export type Effect =
  | { readonly kind: "terrain"; readonly space: SpaceId; readonly cell: Cell; readonly value: number }
  | { readonly kind: "place"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle }
  | { readonly kind: "remove"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle }
  | {
      readonly kind: "spawn";
      readonly space: SpaceId;
      readonly cell: Cell;
      readonly template: string;
      readonly overrides?: Readonly<Record<string, JsonValue>>;
    }
  | { readonly kind: "despawn"; readonly handle: Handle }
  | {
      /**
       * 改实体的组件数据：深合并到该组件的实例覆盖上。
       *
       * 唯一特殊的是 `core.place`：它是「东西在哪」，空间索引靠它维护，
       * 所以内核必须认识这个名字。写它不仅改数据，还改索引。
       */
      readonly kind: "patch";
      readonly handle: Handle;
      readonly component: string;
      readonly data: JsonValue;
    };

/** 位置是唯一被内核认识的组件（见 entity/place.ts）。 */
export { PLACE } from "./entity/place.ts";

function asInteger(value: JsonValue | undefined, at: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${at} 必须是整数，收到 ${JSON.stringify(value)}`);
  }
  return value;
}

/** 只要能用 has 判断模板在不在，就够了——不把模板注册表整个拖进来。 */
export interface TemplateSource {
  has(id: string): boolean;
  /** 可选：模板声明了哪些组件。给了就校验，没给就放过。 */
  componentNames?(templateId: string): readonly string[];
}

export interface StoreOptions {
  readonly start?: Tick;
  readonly templates?: TemplateSource;
}

/** applyOne 的返回值：撤销用的空间效果，以及（spawn 时）新实体的句柄。 */
interface Applied {
  readonly undo: readonly Effect[];
  readonly handle?: Handle;
}

export class Store {
  private readonly spaces = new Map<SpaceId, Space>();
  private readonly entities = new EntityTable();
  private readonly timeline: Timeline;
  private readonly templates: TemplateSource | null;
  private pending: Effect[] = [];

  constructor(spaces: readonly Space[], options: StoreOptions = {}) {
    for (const space of spaces) {
      if (this.spaces.has(space.id)) {
        throw new Error(`空间 id 重复：${space.id}`);
      }
      this.spaces.set(space.id, space);
    }
    this.timeline = new Timeline(options.start ?? 0);
    this.templates = options.templates ?? null;
  }

  /** 现在第几步。 */
  now(): Tick {
    return this.timeline.now();
  }

  /** 链头哈希，用来比对两份世界是否同源。 */
  get headHash(): string {
    return this.timeline.headHash;
  }

  /** 只读地拿一个空间。v0 的妥协：Space 本身仍是可变对象，见 README 的待办。 */
  space(id: SpaceId): Space {
    const space = this.spaces.get(id);
    if (space === undefined) {
      throw new Error(`空间不存在：${id}`);
    }
    return space;
  }

  /** 查实体；句柄过期会报错。 */
  entity(handle: Handle): Entity {
    return this.entities.get(handle);
  }

  get entityCount(): number {
    return this.entities.size;
  }

  /** 所有活着的实体（只读）。渲染投影用。 */
  allEntities(): readonly Entity[] {
    return this.entities.all();
  }

  /** 句柄还活着吗。 */
  hasEntity(handle: Handle): boolean {
    return this.entities.has(handle);
  }

  /**
   * 提交一个变更意图。只是排队——状态一个字节都不会动，直到下一次 step。
   * 故意不在此时校验：真正该校验的是「应用那一刻的状态」。
   */
  submit(effect: Effect): void {
    this.pending.push(effect);
  }

  /**
   * 推进一步：应用积累的变更，成功之后时间才前进。
   *
   * cost 是这一步花掉多少 tick（由规则层按「回合」换算后传进来）：
   *   cost = 0  零帧动作：应用变更、不推进时钟，事件记在当前 tick 的下一个 seq
   *   cost > 0  正常动作：应用之后时钟前进 cost
   *
   * 原子性做法是「先改、记下反操作、失败就整体回滚」：
   * 实体表用快照回滚（连代数一起），空间用反操作回滚。
   */
  step(cost: number = 1): readonly LogEntry[] {
    if (!Number.isInteger(cost) || cost < 0) {
      throw new Error(`step 的成本必须是非负整数，收到 ${cost}`);
    }

    const batch = this.pending;
    this.pending = [];

    const entitySnapshot = this.entities.snapshot();
    const undos: Effect[] = [];
    const handles: Array<Handle | undefined> = [];

    try {
      for (const effect of batch) {
        const applied = this.applyOne(effect);
        undos.push(...applied.undo);
        handles.push(applied.handle);
      }
    } catch (error) {
      for (let i = undos.length - 1; i >= 0; i--) {
        this.applyRaw(undos[i]);
      }
      this.entities.restore(entitySnapshot);
      throw error;
    }

    if (cost > 0) {
      this.timeline.advance(cost);
    }
    return batch.map((effect, i) => this.record(effect, handles[i]));
  }

  /**
   * 越过 tick 的写入：编辑器、调试、迁移用。
   * 它照样记账，但 kind 会写明是注入的——回放时一眼能看出「这段不在时间线里」。
   */
  inject(effect: Effect): LogEntry {
    const entitySnapshot = this.entities.snapshot();
    let applied: Applied;
    try {
      applied = this.applyOne(effect);
    } catch (error) {
      this.entities.restore(entitySnapshot);
      throw error;
    }
    try {
      return this.record(effect, applied.handle, "inject");
    } catch (error) {
      for (let i = applied.undo.length - 1; i >= 0; i--) {
        this.applyRaw(applied.undo[i]);
      }
      this.entities.restore(entitySnapshot);
      throw error;
    }
  }

  /** 应用一个变更，返回撤销方法与新句柄。校验失败直接抛。 */
  private applyOne(effect: Effect): Applied {
    switch (effect.kind) {
      case "terrain": {
        const space = this.space(effect.space);
        const before = space.terrainAt(effect.cell);
        space.setTerrain(effect.cell, effect.value);
        return {
          undo: [{ kind: "terrain", space: effect.space, cell: effect.cell, value: before }],
        };
      }

      case "place": {
        const space = this.space(effect.space);
        space.addOccupant(effect.cell, effect.handle);
        return {
          undo: [{ kind: "remove", space: effect.space, cell: effect.cell, handle: effect.handle }],
        };
      }

      case "remove": {
        const space = this.space(effect.space);
        if (!space.removeOccupant(effect.cell, effect.handle)) {
          throw new Error(`${effect.handle} 不在格子 (${effect.cell.x}, ${effect.cell.y}) 里`);
        }
        return {
          undo: [{ kind: "place", space: effect.space, cell: effect.cell, handle: effect.handle }],
        };
      }

      case "spawn": {
        const space = this.space(effect.space);
        if (this.templates !== null && !this.templates.has(effect.template)) {
          throw new Error(`模板不存在：${effect.template}`);
        }
        space.index(effect.cell); // 越界先抛，别留下孤儿实体
        const handle = this.entities.create(effect.template, effect.space, effect.cell, effect.overrides ?? {});
        space.addOccupant(effect.cell, handle);
        return {
          undo: [{ kind: "remove", space: effect.space, cell: effect.cell, handle }],
          handle,
        };
      }

      case "despawn": {
        const entity = this.entities.get(effect.handle);
        this.entities.destroy(effect.handle);
        if (entity.space !== null && entity.pos !== null) {
          if (!this.space(entity.space).removeOccupant(entity.pos, effect.handle)) {
            throw new Error(`索引不一致：${effect.handle} 不在 (${entity.pos.x}, ${entity.pos.y})`);
          }
          return {
            undo: [{ kind: "place", space: entity.space, cell: entity.pos, handle: effect.handle }],
          };
        }
        return { undo: [] };
      }

      case "patch": {
        const entity = this.entities.get(effect.handle);

        // 位置是唯一被内核认识的组件：写它要同步空间索引。
        if (effect.component === PLACE) {
          return this.applyPlace(entity, effect.data);
        }

        // 组件必须由模板声明。运行时凭空造组件是后门，不开。
        const declared = this.templates?.componentNames?.(entity.template);
        if (declared !== undefined && !declared.includes(effect.component)) {
          throw new Error(`实体 ${effect.handle} 的模板 ${entity.template} 没有组件 ${effect.component}`);
        }

        const current = entity.overrides[effect.component];
        const base = typeof current === "object" && current !== null && !Array.isArray(current) ? current : {};
        const merged = mergeDeep(base as JsonValue, effect.data);

        this.entities.setOverrides(effect.handle, {
          ...entity.overrides,
          [effect.component]: merged,
        });
        // 不用反操作：实体表有快照，失败时整表回滚。
        return { undo: [] };
      }
    }
  }

  /**
   * 写 core.place：改实体位置 + 同步空间索引，一步都不能少。
   *
   * 它是虚拟组件——对外是 `components["core.place"]`，对内还是实体的 space/pos。
   * 这样规则看到的是统一的数据，存储也不用搬一次家。
   */
  private applyPlace(entity: Entity, data: JsonValue): Applied {
    const from =
      entity.space !== null && entity.pos !== null ? { space: entity.space, cell: entity.pos } : null;

    // null = 从世界里拿掉（进背包、被拾取）。索引也要清。
    if (data === null) {
      if (from !== null && !this.space(from.space).removeOccupant(from.cell, entity.handle)) {
        throw new Error(`索引不一致：${entity.handle} 不在 (${from.cell.x}, ${from.cell.y})`);
      }
      this.entities.move(entity.handle, null, null);
      return {
        undo: from === null ? [] : [{ kind: "place", space: from.space, cell: from.cell, handle: entity.handle }],
      };
    }

    if (typeof data !== "object" || Array.isArray(data)) {
      throw new Error("core.place 的数据必须是 { space, x, y } 或 null");
    }
    const place = data as Record<string, JsonValue>;
    const spaceId = asInteger(place.space, "core.place.space");
    const x = asInteger(place.x, "core.place.x");
    const y = asInteger(place.y, "core.place.y");

    const target = this.space(spaceId);
    target.index({ x, y }); // 越界先抛，别改了实体才发现

    this.entities.move(entity.handle, spaceId, { x, y });
    if (from !== null && !this.space(from.space).removeOccupant(from.cell, entity.handle)) {
      throw new Error(`索引不一致：${entity.handle} 不在 (${from.cell.x}, ${from.cell.y})`);
    }
    target.addOccupant({ x, y }, entity.handle);

    const undo: Effect[] = [{ kind: "remove", space: spaceId, cell: { x, y }, handle: entity.handle }];
    if (from !== null) {
      undo.push({ kind: "place", space: from.space, cell: from.cell, handle: entity.handle });
    }
    return { undo };
  }

  /** 只应用空间效果，不校验、不记账。给回滚用。实体由快照恢复。 */
  private applyRaw(effect: Effect): void {
    switch (effect.kind) {
      case "terrain":
        this.space(effect.space).setTerrain(effect.cell, effect.value);
        return;
      case "place":
        this.space(effect.space).addOccupant(effect.cell, effect.handle);
        return;
      case "remove":
        this.space(effect.space).removeOccupant(effect.cell, effect.handle);
        return;
      case "spawn":
      case "despawn":
        throw new Error(`内部错误：实体效果不该进回滚列表（${effect.kind}）`);
    }
  }

  private record(effect: Effect, handle?: Handle, kind: string = effect.kind): LogEntry {
    switch (effect.kind) {
      case "terrain":
        return this.timeline.append({
          kind,
          data: { space: effect.space, x: effect.cell.x, y: effect.cell.y, value: effect.value },
        });

      case "place":
      case "remove":
        return this.timeline.append({
          kind,
          targets: [effect.handle],
          data: { space: effect.space, x: effect.cell.x, y: effect.cell.y, handle: effect.handle },
        });

      case "spawn":
        return this.timeline.append({
          kind,
          targets: handle === undefined ? [] : [handle],
          data: {
            space: effect.space,
            x: effect.cell.x,
            y: effect.cell.y,
            template: effect.template,
            handle: handle ?? -1,
          },
        });

      case "despawn":
        return this.timeline.append({
          kind,
          targets: [effect.handle],
          data: { handle: effect.handle },
        });

      case "patch":
        return this.timeline.append({
          kind,
          targets: [effect.handle],
          data: { handle: effect.handle, component: effect.component, value: effect.data },
        });
    }
  }
}
