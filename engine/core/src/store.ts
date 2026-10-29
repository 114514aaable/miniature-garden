// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * Store：世界状态的唯一写入口。
 *
 * 它只做四件事：
 *   1. 持有空间；
 *   2. 接收变更（submit），先排队，不动状态；
 *   3. 在 tick 边界一次性应用（step），要么全成，要么全不成；
 *   4. 每次应用都写进时间线——事件的时间由时间线盖，这里伪造不了。
 *
 * 它不知道「玩家按了什么键」，也不知道「这个技能该不该命中」。
 * 那些是规则层的事：规则层把结果翻译成 Effect，Store 只负责安全地落地。
 *
 * v0 只有三种变更，因为空间现在只有两种可变的东西（地形、占用者）。
 * 将来加了实体、物品、知识，Effect 会变多，但这个类不该变胖——
 * 它只是「把变更应用到空间上」的那只唯一的手。
 */

import { type Cell, type SpaceId, Space } from "./space.ts";
import { type LogEntry, type Handle, type Tick, Timeline } from "./time.ts";

export type Effect =
  | { readonly kind: "terrain"; readonly space: SpaceId; readonly cell: Cell; readonly value: number }
  | { readonly kind: "place"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle }
  | { readonly kind: "remove"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle };

export class Store {
  private readonly spaces = new Map<SpaceId, Space>();
  private readonly timeline: Timeline;
  private pending: Effect[] = [];

  constructor(spaces: readonly Space[], start: Tick = 0) {
    for (const space of spaces) {
      if (this.spaces.has(space.id)) {
        throw new Error(`空间 id 重复：${space.id}`);
      }
      this.spaces.set(space.id, space);
    }
    this.timeline = new Timeline(start);
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

  /**
   * 提交一个变更意图。只是排队——状态一个字节都不会动，直到下一次 step。
   * 故意不在此时校验：真正该校验的是「应用那一刻的状态」。
   */
  submit(effect: Effect): void {
    this.pending.push(effect);
  }

  /**
   * 推进一步：时间 +1，然后按顺序应用上一 tick 积累的所有变更。
   *
   * 原子性做法是「先改、记下反操作、失败就倒着撤」。
   * 这样中途任何一个失败，状态回到进入 step 前的样子，日志也不会留下半截记录。
   */
  step(): readonly LogEntry[] {
    const batch = this.pending;
    this.pending = [];

    // 第一阶段：只改状态，记下反操作。任何一步失败，倒着撤销。
    // 注意：时钟还没动——失败时连时间都不该前进。
    const undos: Effect[] = [];
    try {
      for (const effect of batch) {
        undos.push(this.applyOne(effect));
      }
    } catch (error) {
      for (let i = undos.length - 1; i >= 0; i--) {
        this.applyRaw(undos[i]);
      }
      throw error;
    }

    // 第二阶段：状态全部落地之后，时间才前进，然后记账。
    this.timeline.advance();
    return batch.map((effect) => this.record(effect));
  }

  /**
   * 越过 tick 的写入：编辑器、调试、迁移用。
   * 它照样记账，但 kind 会写明是注入的——这样回放时一眼能看出「这段不在时间线里」。
   */
  inject(effect: Effect): LogEntry {
    const undo = this.applyOne(effect);
    try {
      return this.record(effect, "inject");
    } catch (error) {
      this.applyRaw(undo);
      throw error;
    }
  }

  /** 应用一个变更，返回它的反操作。校验失败直接抛。 */
  private applyOne(effect: Effect): Effect {
    const space = this.space(effect.space);

    switch (effect.kind) {
      case "terrain": {
        const before = space.terrainAt(effect.cell);
        space.setTerrain(effect.cell, effect.value);
        return { kind: "terrain", space: effect.space, cell: effect.cell, value: before };
      }
      case "place": {
        space.addOccupant(effect.cell, effect.handle);
        return { kind: "remove", space: effect.space, cell: effect.cell, handle: effect.handle };
      }
      case "remove": {
        if (!space.removeOccupant(effect.cell, effect.handle)) {
          throw new Error(`${effect.handle} 不在格子 (${effect.cell.x}, ${effect.cell.y}) 里`);
        }
        return { kind: "place", space: effect.space, cell: effect.cell, handle: effect.handle };
      }
    }
  }

  /** 只应用，不校验、不记账。给回滚用。 */
  private applyRaw(effect: Effect): void {
    const space = this.space(effect.space);
    switch (effect.kind) {
      case "terrain":
        space.setTerrain(effect.cell, effect.value);
        return;
      case "place":
        space.addOccupant(effect.cell, effect.handle);
        return;
      case "remove":
        space.removeOccupant(effect.cell, effect.handle);
        return;
    }
  }

  private record(effect: Effect, kind = effect.kind): LogEntry {
    const at = { space: effect.space, x: effect.cell.x, y: effect.cell.y };
    const data = effect.kind === "terrain" ? { ...at, value: effect.value } : { ...at, handle: effect.handle };
    return this.timeline.append({
      kind,
      targets: effect.kind === "terrain" ? [] : [effect.handle],
      data,
    });
  }
}
