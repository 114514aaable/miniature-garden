// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 伤害计算：一处定义，所有技能共用。
 *
 *   power   攻击力（来自属性组，或技能显式给的值）
 *   armor   防御力（来自目标属性组）
 *   damage  max(1, power - armor)
 *
 * 为什么要统一：之前 attack 用属性算、sweep 写死 3、敌人打击不算防御，
 * 同一个游戏三套伤害。以后做部位/护盾，只需要在这一个地方加。
 */

import { type JsonValue } from "../time.ts";

/** 从属性组里读一个数字。 */
export function numberIn(component: JsonValue | undefined, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) {
    return fallback;
  }
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}

/** 攻击力：读 core.stats.attack，没有就当 1。 */
export function powerOf(stats: JsonValue | undefined): number {
  return numberIn(stats, "attack", 1);
}

/** 防御力：读 core.stats.defense，没有就当 0。 */
export function armorOf(stats: JsonValue | undefined): number {
  return numberIn(stats, "defense", 0);
}

/** 最终伤害：至少 1。 */
export function damageOf(power: number, armor: number): number {
  return Math.max(1, power - armor);
}

/** 一次攻击的完整结算（不含命中判定）。 */
export function resolveDamage(
  attackerStats: JsonValue | undefined,
  targetStats: JsonValue | undefined,
): { power: number; armor: number; damage: number } {
  const power = powerOf(attackerStats);
  const armor = armorOf(targetStats);
  return { power, armor, damage: damageOf(power, armor) };
}
