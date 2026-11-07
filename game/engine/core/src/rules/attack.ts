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
import { resolveDamage } from "./damage.ts";

export const attackSignature: Signature = {
  tag: "base.attack",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, x: { t: "int" }, y: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "劈砍", cost: "attack", target: { kind: "entity", range: 1, filter: "living" } },
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

  if (actor.space === null || actor.pos === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const cell = { x: p.x, y: p.y };
  const distance = Math.abs(cell.x - actor.pos.x) + Math.abs(cell.y - actor.pos.y);
  if (distance !== 1) {
    return { ok: false, reason: "够不着" };
  }

  // 技能按格子作用：打谁由规则查，不由调用方指定。
  const space = context.view.space(actor.space);
  const target = space
    .occupantsAt(cell)
    .find((handle) => handle !== p.actor && context.view.entity(handle).components["core.health"] !== undefined);

  if (target === undefined) {
    return { ok: false, reason: "那里没有可以打的东西" };
  }

  const targetEntity = context.view.entity(target);
  const health = targetEntity.components["core.health"];
  if (health === undefined) {
    return { ok: false, reason: "它没有生命值，打不动" };
  }

  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);
  const { damage } = resolveDamage(actor.components["core.stats"], targetEntity.components["core.stats"]);
  const next = hp - damage;

  // 只写结果；到 0 由数据写规则判「致死」，再广播 base.death
  return {
    ok: true,
    damage,
    effects: [{ kind: "patch", handle: target, component: "core.health", data: { hp: next } }],
  };
}
