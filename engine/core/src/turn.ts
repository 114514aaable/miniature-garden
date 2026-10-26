// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 单位与回合队列。
 *
 * 回合模型（已定）：
 *   - 顺序回合，按速度排序，速度相同时按 id 排（保证可重放）。
 *   - 每个单位每回合 3 点行动点（AP）。
 *   - 每轮 1 点反应点（reaction），可在别人回合用：格挡 / 借机攻击 / 挣脱。
 *
 * 这一版只做「轮流」和「补充资源」，不做「花掉资源」——那是下一步。
 */

import type { Point } from "./grid.ts";

export const AP_PER_TURN = 3;
export const REACTIONS_PER_ROUND = 1;

export interface Unit {
  readonly id: string;
  readonly name: string;
  /** 先攻值：越大越先动。 */
  readonly speed: number;
  /** 画图用的单个字符（终端里中文是双宽，会把格子撑歪）。 */
  readonly glyph: string;
  /** 位置可变：单位会移动。 */
  pos: Point;
  /** 本回合剩余行动点。 */
  ap: number;
  /** 本轮剩余反应点。 */
  reactions: number;
}

export function makeUnit(
  id: string,
  name: string,
  speed: number,
  glyph: string,
  at: Point,
): Unit {
  return { id, name, speed, glyph, pos: at, ap: 0, reactions: REACTIONS_PER_ROUND };
}

/** 先攻比较：速度降序；同速按 id 升序，保证同样的输入永远得到同样的顺序。 */
function compareInitiative(a: Unit, b: Unit): number {
  return b.speed - a.speed || a.id.localeCompare(b.id);
}

export class TurnOrder {
  private readonly units: Unit[];
  private index = 0;
  private round = 0;

  constructor(units: readonly Unit[]) {
    if (units.length === 0) {
      throw new Error("回合队列不能为空");
    }
    // 复制一份再排序：sort() 会原地修改数组，别把调用方的数组打乱。
    this.units = [...units].sort(compareInitiative);
  }

  /** 排好的顺序，只读。 */
  get order(): readonly Unit[] {
    return this.units;
  }

  /** 当前是第几轮（从 1 开始）。 */
  get roundNumber(): number {
    return this.round + 1;
  }

  /** 开始第一回合。 */
  start(): Unit {
    this.index = 0;
    this.round = 0;
    this.beginTurn(this.units[0]);
    return this.units[0];
  }

  /** 轮到下一个；一轮走完时重置所有人的反应点。 */
  next(): Unit {
    this.index += 1;
    if (this.index >= this.units.length) {
      this.index = 0;
      this.round += 1;
      for (const unit of this.units) {
        unit.reactions = REACTIONS_PER_ROUND;
      }
    }
    const unit = this.units[this.index];
    this.beginTurn(unit);
    return unit;
  }

  private beginTurn(unit: Unit): void {
    unit.ap = AP_PER_TURN;
  }
}
