// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 调度器：谁该动了。
 *
 * 模型（比 Kinky Dungeon 的累加器多一个显式排序键）：
 *   每个单位有一个 readyAt —— 「下次能行动的 tick」。
 *   每 tick 取 readyAt 最小的那个，平局按 handle 排。
 *
 * 为什么不用数组顺序：KD 的行动顺序 = 刷怪顺序，
 * 同一份种子换个刷怪顺序就复现不了。用 (readyAt, handle) 就没这个问题。
 *
 * 玩家不在调度器里：玩家由输入驱动，宿主用它当「世界推进到哪停」的闸门。
 */

export interface Scheduled {
  readonly handle: number;
  readonly readyAt: number;
}

export interface Due {
  /** 该行动的 tick。 */
  readonly tick: number;
  readonly handle: number;
}

export class Scheduler {
  private tick: number;
  private readonly readyAt = new Map<number, number>();

  constructor(actors: readonly Scheduled[] = [], startTick = 0) {
    this.tick = startTick;
    for (const actor of actors) {
      this.readyAt.set(actor.handle, actor.readyAt);
    }
  }

  now(): number {
    return this.tick;
  }

  /** 把时钟拨到某个 tick（宿主推进世界时用）。不允许倒退。 */
  setNow(tick: number): void {
    if (tick < this.tick) {
      throw new Error(`调度器不能倒退：现在是 ${this.tick}，收到 ${tick}`);
    }
    this.tick = tick;
  }

  add(handle: number, readyAt = this.tick): void {
    this.readyAt.set(handle, readyAt);
  }

  remove(handle: number): void {
    this.readyAt.delete(handle);
  }

  readyAtOf(handle: number): number | undefined {
    return this.readyAt.get(handle);
  }

  /** 下一个该行动的：tick 最小的；平局按 handle。 */
  peek(): Due | null {
    let best: Due | null = null;

    for (const [handle, at] of this.readyAt) {
      const tick = Math.max(at, this.tick);
      if (
        best === null ||
        tick < best.tick ||
        (tick === best.tick && handle < best.handle)
      ) {
        best = { tick, handle };
      }
    }

    return best;
  }

  /**
   * 推进到下一个该行动的 tick，并把它取出来。
   *
   * 取出时先把它挪到下一 tick（占位），避免「忘了调 done」导致
   * 同一个单位被反复取出。done(cost) 会用真实成本覆盖这个占位。
   */
  take(): Due | null {
    const due = this.peek();
    if (due === null) {
      return null;
    }
    this.tick = due.tick;
    this.readyAt.set(due.handle, due.tick + 1);
    return due;
  }

  /**
   * 登记一次行动。
   *
   * NPC 的零成本动作也至少占 1 tick——否则一个速度够快的敌人
   * 会在同一 tick 里无限行动。玩家不受这条限制（玩家按输入走）。
   */
  done(handle: number, cost: number): void {
    if (!this.readyAt.has(handle)) {
      throw new Error(`调度器里没有这个单位：${handle}`);
    }
    const wait = Math.max(1, cost);
    this.readyAt.set(handle, this.tick + wait);
  }
}
