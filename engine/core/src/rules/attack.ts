// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 攻击：相邻 → 扣血 → 血尽则倒。
 *
 * v0 故意简单：不掷骰、不打部位、不算护甲穿透。
 * 伤害 = 攻击 − 防御，最少 1。
 *
 * 它只产出两种效果：patch 改血，或者 despawn 收尸。
 * 「打不中」以后走命中判定，仍然是规则层的事。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const attackSignature: Signature = {
  tag: "core.attack",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, target: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "劈砍", cost: "attack", target: { kind: "entity", range: 1 } },
};

function numberIn(component: JsonValue | undefined, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) {
    return fallback;
  }
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}

export function attackHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const actor = context.view.entity(p.actor);
  const target = context.view.entity(p.target);

  if (actor.space === null || actor.pos === null || target.pos === null || target.space !== actor.space) {
    return { ok: false, reason: "它不在同一个空间" };
  }

  const distance = Math.abs(target.pos.x - actor.pos.x) + Math.abs(target.pos.y - actor.pos.y);
  if (distance !== 1) {
    return { ok: false, reason: "够不着" };
  }

  const health = target.components["core.health"];
  if (health === undefined) {
    return { ok: false, reason: "它没有生命值，打不动" };
  }

  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);
  const power = numberIn(actor.components["core.stats"], "attack", 1);
  const armor = numberIn(target.components["core.stats"], "defense", 0);
  const damage = Math.max(1, power - armor);
  const next = hp - damage;

  if (next <= 0) {
    return { ok: true, damage, effects: [{ kind: "despawn", handle: p.target }] };
  }

  return {
    ok: true,
    damage,
    effects: [{ kind: "patch", handle: p.target, component: "core.health", data: { hp: next } }],
  };
}
