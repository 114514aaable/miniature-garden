// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 数据写规则：按「参数名 + 变化方式」描述，而不是写死某个血量。
 *
 *   component   属性组（core.health / core.body / …）
 *   field       参数名（hp / rage / *）
 *   mode        set（原样）/ clamp（夹范围）
 *   min/max     范围（max 也可以从同组另一个字段读：maxField）
 *   deathAtOrBelow  写完落到这个值以下 → 这是「致死」，由宿主广播 core.death
 *
 * 一条规则只负责一个字段；多个规则可以同时挂在同一组上。
 */

import type { Effect } from "../../engine/core/src/store.ts";
import type { EntityWrite } from "./effects.ts";

export type WriteMode = "set" | "clamp";

export interface WriteRule {
  readonly component: string;
  /** 参数名；"*" = 该组所有数值字段。 */
  readonly field: string;
  readonly mode: WriteMode;
  readonly min?: number;
  readonly max?: number;
  /** 上限从同组的哪个字段读（比如 core.health.max）。 */
  readonly maxField?: string;
  /** 写完后 <= 这个值就算致死（只对数值字段生效）。 */
  readonly deathAtOrBelow?: number;
}

export interface WriteOutcome {
  readonly consume: boolean;
  readonly effects: readonly Effect[];
  /** 这次写是否触发致死（由宿主广播 core.death）。 */
  readonly lethal: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 按规则算新值；返回 null 表示没有规则认领这次写。 */
export function applyWriteRules(
  rules: readonly WriteRule[],
  write: EntityWrite,
): WriteOutcome | null {
  if (!isRecord(write.before) || !isRecord(write.after)) return null;

  const before = write.before;
  const after = write.after;
  const merged: Record<string, unknown> = { ...before, ...after };
  let claimed = false;
  let lethal = false;

  for (const rule of rules) {
    if (rule.component !== write.component) continue;

    const fields =
      rule.field === "*"
        ? Object.keys(merged).filter((key) => typeof merged[key] === "number")
        : [rule.field];

    for (const field of fields) {
      const incoming = typeof after[field] === "number" ? (after[field] as number) : undefined;
      if (incoming === undefined) continue;
      claimed = true;

      const upper =
        rule.maxField !== undefined
          ? typeof merged[rule.maxField] === "number"
            ? (merged[rule.maxField] as number)
            : Number.POSITIVE_INFINITY
          : rule.max ?? Number.POSITIVE_INFINITY;
      const lower = rule.min ?? Number.NEGATIVE_INFINITY;

      const value =
        rule.mode === "clamp" ? Math.max(lower, Math.min(upper, incoming)) : incoming;
      merged[field] = value;

      if (rule.deathAtOrBelow !== undefined && value <= rule.deathAtOrBelow) lethal = true;
    }
  }

  if (!claimed) return null;

  const effects: Effect[] = [
    {
      kind: "patch",
      handle: write.handle as never,
      component: write.component,
      data: merged as never,
    },
  ];

  return { consume: true, effects, lethal };
}
