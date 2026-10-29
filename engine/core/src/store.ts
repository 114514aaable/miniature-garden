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
  | { readonly kind: "move"; readonly space: SpaceId; readonly handle: Handle; readonly to: Cell };

/** 只要能用 has 判断模板在不在，就够了——不把模板注册表整个拖进来。 */
export interface TemplateSource {
  has(id: string): boolean;
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

  /**
   * 提交一个变更意图。只是排队——状态一个字节都不会动，直到下一次 step。
   * 故意不在此时校验：真正该校验的是「应用那一刻的状态」。
   */
  submit(effect: Effect): void {
    this.pending.push(effect);
  }

  /**
   * 推进一步：应用上一 tick 积累的变更，成功之后时间才前进。
   *
   * 原子性做法是「先改、记下反操作、失败就整体回滚」：
   * 实体表用快照回滚（连代数一起），空间用反操作回滚。
   */
  step(): readonly LogEntry[] {
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

    this.timeline.advance();
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

      case "move": {
        const entity = this.entities.get(effect.handle);
        const from = entity.space !== null && entity.pos !== null ? { space: entity.space, cell: entity.pos } : null;

        this.space(effect.space).index(effect.to); // 目标越界先抛
        this.entities.move(effect.handle, effect.space, effect.to);
        if (from !== null && !this.space(from.space).removeOccupant(from.cell, effect.handle)) {
          throw new Error(`索引不一致：${effect.handle} 不在 (${from.cell.x}, ${from.cell.y})`);
        }
        this.space(effect.space).addOccupant(effect.to, effect.handle);

        const undo: Effect[] = [
          { kind: "remove", space: effect.space, cell: effect.to, handle: effect.handle },
        ];
        if (from !== null) {
          undo.push({ kind: "place", space: from.space, cell: from.cell, handle: effect.handle });
        }
        return { undo };
      }
    }
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
      case "move":
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

      case "move":
        return this.timeline.append({
          kind,
          targets: [effect.handle],
          data: { space: effect.space, x: effect.to.x, y: effect.to.y, handle: effect.handle },
        });
    }
  }
}
