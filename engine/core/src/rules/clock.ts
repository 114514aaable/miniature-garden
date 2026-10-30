// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 游戏时钟：引擎的 tick 和游戏里的「回合」之间的唯一换算处。
 *
 * 为什么现在就要这一层（哪怕两者完全一致）：
 *   规则不该直接读 `lTick`。否则哪天「1 回合 = 10 tick」，
 *   所有规则、所有事件、所有存档都要跟着改。
 *   现在只有这一个文件知道换算关系，改的时候只改这里。
 *
 * 约定：
 *   - 引擎：tick，单调递增的整数，由 store.step() 推进。
 *   - 游戏：round，规则看到的「第几回合」。
 *   - 动作成本也用 round 表示；0 表示零帧（不推进时钟）。
 */

/** 游戏里的回合数。 */
export type Round = number;

/**
 * 一个回合等于几个 tick。
 *
 * v0 是 1：两者完全一致，只是换了个名字。
 * 将来要做「一回合十个逻辑帧」，就把它改成 10——只有这个文件要动。
 */
export const TICKS_PER_ROUND = 1;

export function roundOf(tick: number): Round {
  return Math.floor(tick / TICKS_PER_ROUND);
}

export function ticksFor(rounds: number): number {
  if (!Number.isInteger(rounds) || rounds < 0) {
    throw new Error(`回合数必须是非负整数，收到 ${rounds}`);
  }
  return rounds * TICKS_PER_ROUND;
}

/** 速度加成：达到某个速度，就减几回合成本。 */
export interface SpeedBonus {
  readonly atSpeed: number;
  readonly bonus: number;
}

export interface ClockConfig {
  /** 动作 → 基础成本（回合）。0 表示零帧动作。 */
  readonly costs: Readonly<Record<string, number>>;
  /** 按速度给的减免，从低到高排列。 */
  readonly speedBonus: readonly SpeedBonus[];
}

export const DEFAULT_CLOCK: ClockConfig = {
  costs: { move: 2, attack: 3, heavy: 7, cast: 4, look: 0, wait: 4 },
  speedBonus: [
    { atSpeed: 5, bonus: 0 },
    { atSpeed: 8, bonus: 1 },
    { atSpeed: 10, bonus: 2 },
  ],
};

/**
 * 算一次动作要花几回合。
 *
 * 速度越高成本越低；减到 0 就是零帧动作，一回合内可以做多次
 * （次数由调用方限制，通常是 8）。
 */
export function costOf(config: ClockConfig, verb: string, speed: number): number {
  const base = config.costs[verb];
  if (base === undefined) {
    throw new Error(`未知的动作类型："${verb}"（世界的 clock.costs 里没有它）`);
  }

  let bonus = 0;
  for (const entry of config.speedBonus) {
    if (speed >= entry.atSpeed) {
      bonus = entry.bonus;
    }
  }

  return Math.max(0, base - bonus);
}

/** 这个动作是不是零帧的。 */
export function isFree(config: ClockConfig, verb: string, speed: number): boolean {
  return costOf(config, verb, speed) === 0;
}
