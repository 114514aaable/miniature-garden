// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 时间：一个单调递增的整数。
 *
 * 这里是整个项目里最「写死」的一块，因为可重放全靠它。
 *
 * 四条规则，一条都不能破：
 *   1. 只有整数。没有小数，没有浮点误差。
 *   2. 只能前进。没有 set，没有 rewind，没有「回到上一回合」。
 *   3. 全局只有一个现在。每个世界一个 Clock，但同一个世界只有一个。
 *   4. 不读真实时间。Date.now() / setTimeout 在模拟里是禁词。
 *
 * 不在这里的东西（故意的）：
 *   - 调度器：什么时候发生什么，属于规则层。
 *   - 日历：第几天、什么季节，属于世界层，是 tick 的投影。
 *   - 时间膨胀：一个空间时间过得慢——永远不做，它会毁掉重放。
 */

/** 逻辑时间。就是数字，但请把它当成「第几回合」而不是「随便一个数」。 */
export type Tick = number;

export class Clock {
  private current: Tick;

  constructor(start: Tick = 0) {
    if (!Number.isInteger(start) || start < 0) {
      throw new Error(`时钟起点必须是非负整数，收到 ${start}`);
    }
    this.current = start;
  }

  /** 现在几点。只读，拿不到内部引用。 */
  now(): Tick {
    return this.current;
  }

  /**
   * 前进 n 步，返回新的现在。
   *
   * 允许一次走多步，是为了「长动作」：赶路、睡觉、闭关十年。
   * 但只能往前走，n 必须是正整数。
   */
  advance(steps: number = 1): Tick {
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error(`时间只能前进正整数步，收到 ${steps}`);
    }
    this.current += steps;
    return this.current;
  }
}
