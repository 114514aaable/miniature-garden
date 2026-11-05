// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 休息：一次演练（sequence）的样板技能。
 *
 * 按一下 → 时间按 4 个回合推进 → 期间不期待输入 → 客户端回放。
 * 恢复 2 点血（不超过上限）。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const restSignature: Signature = {
  tag: "base.rest",
  params: {
    t: "object",
    fields: { actor: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  time: { mode: "sequence", ticks: 4 },
  skill: { name: "休息", cost: "wait", target: { kind: "self", range: 0 } },
};

export function restHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const actor = (params as Record<string, number>).actor;
  const health = context.view.entity(actor).components["core.health"];

  if (health === undefined) {
    return { ok: false, reason: "它没有血可以恢复" };
  }

  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);
  if (hp >= max) {
    return { ok: true, effects: [], reason: "已经是满血" };
  }

  return {
    ok: true,
    effects: [
      {
        kind: "patch",
        handle: actor,
        component: "core.health",
        data: { hp: Math.min(max, hp + 2) },
      },
    ],
  };
}

function numberIn(component: JsonValue, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return fallback;
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}
