// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 每 tick 的阶段表。
 *
 * 原来宿主里躺着三段 if：推进 store、结算挂起、敌人行动。
 * 每加一个「每 tick 该做的事」就要再插一段——顺序会慢慢变成口口相传的知识。
 *
 * 这里把它变成一张**有序的表**：表就是清单，顺序就是语义。
 */

export interface Phase {
  readonly name: string;
  /** 这一阶段在这个 tick 做的事。 */
  readonly run: (tick: number) => void;
}

/**
 * 跑一个 tick 的所有阶段。
 *
 * 某个阶段抛错时**不吞掉**：让宿主决定怎么办（现在是整局报错）。
 * 吞掉会让世界停在「一半执行」的状态，比崩更难查。
 */
export function runPhases(phases: readonly Phase[], tick: number): void {
  for (const phase of phases) {
    phase.run(tick);
  }
}

/** 阶段的显示名，调试用。 */
export function phaseNames(phases: readonly Phase[]): string[] {
  return phases.map((phase) => phase.name);
}
