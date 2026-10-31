// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 敌人的三个动作：起手、命中、走位。
 *
 * 关键设计：**意图是数据**（core.intent 组件），不是画出来的。
 * 命中判定读它，渲染也读它——所以「画的和打的」永远不会错位。
 * 玩家在 resolveAt 之前走开，就真的躲掉。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

const INTENT = "core.intent";

/** 起手：写意图，等 ticks 回合后结算。 */
export const windupSignature: Signature = {
  tag: "core.enemy_windup",
  params: {
    t: "object",
    fields: {
      enemy: { t: "int" },
      dx: { t: "int" },
      dy: { t: "int" },
      damage: { t: "int" },
      ticks: { t: "int" },
    },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
};

export function windupHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const enemy = context.view.entity(p.enemy);
  if (enemy.pos === null) {
    return { ok: true, effects: [] };
  }

  return {
    ok: true,
    effects: [
      {
        kind: "patch",
        handle: p.enemy,
        component: INTENT,
        data: {
          kind: "melee",
          tiles: [{ dx: p.dx, dy: p.dy }],
          damage: p.damage,
          resolveAt: context.view.tick + p.ticks,
        },
      },
    ],
  };
}

/** 命中：按意图里的格子结算，然后清空意图。 */
export const strikeSignature: Signature = {
  tag: "core.enemy_strike",
  params: {
    t: "object",
    fields: { enemy: { t: "int" }, target: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
};

const EMPTY_INTENT = { kind: "melee", tiles: [], damage: 0, resolveAt: 0 };

export function strikeHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const enemy = context.view.entity(p.enemy);
  const target = context.view.entity(p.target);

  const effects: JsonValue[] = [
    { kind: "patch", handle: p.enemy, component: INTENT, data: EMPTY_INTENT },
  ];

  const intent = enemy.components[INTENT];
  if (enemy.pos === null || target.pos === null || enemy.space !== target.space) {
    return { ok: true, effects };
  }
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    return { ok: true, effects };
  }

  const data = intent as Record<string, JsonValue>;
  const tiles = Array.isArray(data.tiles) ? data.tiles : [];
  const damage = typeof data.damage === "number" ? data.damage : 0;

  const hit = tiles.some((tile) => {
    if (typeof tile !== "object" || tile === null) return false;
    const t = tile as Record<string, number>;
    return enemy.pos!.x + t.dx === target.pos!.x && enemy.pos!.y + t.dy === target.pos!.y;
  });

  if (!hit || damage <= 0) {
    return { ok: true, effects, missed: true };
  }

  const health = target.components["core.health"];
  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);
  if (hp - damage <= 0) {
    effects.push({ kind: "despawn", handle: p.target });
  } else {
    effects.push({ kind: "patch", handle: p.target, component: "core.health", data: { hp: hp - damage } });
  }

  return { ok: true, effects, missed: false };
}

function numberIn(component: JsonValue | undefined, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) {
    return fallback;
  }
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}
