// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 休息：和蓄力同一套机制——点一下挂 pending，到点结算。
 *
 *   激活    0 回合，挂一个 4 回合后的「回血」
 *   中间    玩家自己点等待（客户端会按节奏自动点）
 *   到点    base.rest_finish 结算，回 2 点血
 *
 * 以前它用 time.mode "sequence"，一次跳 4 回合；现在拆成看得见的 4 步。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";
import { isActive, PENDING } from "./pending.ts";

/** 休息几个回合。 */
const REST_TICKS = 4;
/** 每次休息回多少血。 */
const REST_HEAL = 2;

export const restSignature: Signature = {
  tag: "base.rest",
  params: {
    t: "object",
    fields: { actor: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "休息", cost: "wait", target: { kind: "self", range: 0 } },
};

export function restHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const actor = (params as Record<string, number>).actor;
  const view = context.view;

  const health = view.entity(actor).components["core.health"];
  if (health === undefined) {
    return { ok: false, reason: "它没有血可以恢复" };
  }

  if (isActive(view.entity(actor).components[PENDING])) {
    return { ok: false, reason: "已经在休息了" };
  }

  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);
  if (hp >= max) {
    return { ok: false, reason: "已经是满血" };
  }

  return {
    ok: true,
    effects: [
      {
        kind: "patch",
        handle: actor,
        component: PENDING,
        data: {
          tag: "base.rest_finish",
          params: { actor },
          resolveAt: view.tick + REST_TICKS,
          startedAt: view.tick,
          totalTicks: REST_TICKS,
        },
      },
    ],
  };
}

/** 到点：真正回血。 */
export const restFinishSignature: Signature = {
  tag: "base.rest_finish",
  params: {
    t: "object",
    fields: { actor: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
};

export function restFinishHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const actor = (params as Record<string, number>).actor;
  const health = context.view.entity(actor).components["core.health"];

  if (health === undefined) {
    return { ok: true, effects: [] };
  }

  const max = numberIn(health, "max", 0);
  const hp = numberIn(health, "hp", max);

  return {
    ok: true,
    effects: [
      {
        kind: "patch",
        handle: actor,
        component: "core.health",
        data: { hp: Math.min(max, hp + REST_HEAL) },
      },
    ],
  };
}

function numberIn(component: JsonValue, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return fallback;
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}
