// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 实体：世界里「一个东西」的最小记录。
 *
 * 它只有四样：句柄、模板、位置、覆盖。
 * 没有行为、没有方法、没有引用——行为在 Event 管线的 handler 里，
 * 这样存档、哈希、diff 都只是数据操作。
 *
 * 句柄带「代数」（generation）：
 *   handle = index * 4096 + generation
 *
 * 槽位会被复用，但每次复用代数 +1，所以旧句柄永远不会碰巧指向新实体。
 * 拿着已销毁实体的句柄去查，会当场报错，而不是悄悄返回一个陌生人。
 */

import { type Cell } from "../space.ts";
import { type JsonValue } from "../time.ts";

export type Handle = number;

/** 每个槽位能复用的次数；超过就回绕（v0 接受，实际很难撞到）。 */
export const GENERATIONS = 4096;

export function makeHandle(index: number, generation: number): Handle {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`索引必须是非负整数，收到 ${index}`);
  }
  if (!Number.isInteger(generation) || generation < 0 || generation >= GENERATIONS) {
    throw new Error(`代数必须在 0..${GENERATIONS - 1}，收到 ${generation}`);
  }
  return index * GENERATIONS + generation;
}

export function handleIndex(handle: Handle): number {
  return Math.floor(handle / GENERATIONS);
}

export function handleGeneration(handle: Handle): number {
  return handle % GENERATIONS;
}

export interface Entity {
  readonly handle: Handle;
  readonly template: string;
  /** 不在空间里时是 null（比如躺在背包里）。 */
  readonly pos: Cell | null;
  /** 只存和模板不一样的部分；读取时用 merge 合并出完整数据。 */
  readonly overrides: Readonly<Record<string, JsonValue>>;
}

interface Slot {
  generation: number;
  entity: Entity | null;
}

/**
 * 实体表：分配句柄、存记录、销毁、移动。
 *
 * 它只管「实体记录」，不管空间占用——空间索引由 store 在提交时同步。
 * 这样它就不会变成第二个写入口。
 */
export class EntityTable {
  private readonly slots: Slot[] = [];
  private readonly free: number[] = [];

  /** 创建一个实体，返回它的句柄。 */
  create(template: string, pos: Cell | null = null, overrides: Readonly<Record<string, JsonValue>> = {}): Handle {
    const index = this.free.pop() ?? this.slots.length;
    const generation = this.slots[index]?.generation ?? 0;
    const handle = makeHandle(index, generation);

    this.slots[index] = {
      generation,
      entity: { handle, template, pos, overrides: structuredClone(overrides) },
    };
    return handle;
  }

  /** 查实体。句柄过期或已销毁都会报错，不会返回一个陌生的实体。 */
  get(handle: Handle): Entity {
    const slot = this.slots[handleIndex(handle)];
    if (slot === undefined || slot.entity === null) {
      throw new Error(`实体不存在或已销毁：${handle}`);
    }
    if (slot.generation !== handleGeneration(handle)) {
      throw new Error(`实体句柄已过期：${handle}（该槽位现在是第 ${slot.generation} 代）`);
    }
    return slot.entity;
  }

  has(handle: Handle): boolean {
    const slot = this.slots[handleIndex(handle)];
    return slot !== undefined && slot.entity !== null && slot.generation === handleGeneration(handle);
  }

  /** 销毁。槽位回收，代数 +1，旧句柄从此作废。 */
  destroy(handle: Handle): void {
    const index = handleIndex(handle);
    const slot = this.slots[index];
    if (slot === undefined || slot.entity === null || slot.generation !== handleGeneration(handle)) {
      throw new Error(`销毁失败，实体不存在或已销毁：${handle}`);
    }
    this.slots[index] = { generation: (slot.generation + 1) % GENERATIONS, entity: null };
    this.free.push(index);
  }

  /** 移动。返回更新后的实体。 */
  move(handle: Handle, pos: Cell | null): Entity {
    const current = this.get(handle);
    const next: Entity = { ...current, pos };
    this.slots[handleIndex(handle)] = {
      generation: handleGeneration(handle),
      entity: next,
    };
    return next;
  }

  /** 替换覆盖（合并由调用方决定，这里只存结果）。 */
  setOverrides(handle: Handle, overrides: Readonly<Record<string, JsonValue>>): Entity {
    const current = this.get(handle);
    const next: Entity = { ...current, overrides: structuredClone(overrides) };
    this.slots[handleIndex(handle)] = {
      generation: handleGeneration(handle),
      entity: next,
    };
    return next;
  }

  /** 当前存活的实体数量。 */
  get size(): number {
    return this.slots.filter((slot) => slot.entity !== null).length;
  }
}
