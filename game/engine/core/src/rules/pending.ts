// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 挂起动作：现在不做，过几回合再做。
 *
 * 语义只有一条：往 `core.pending` 里写一个信封 + 一个到期时刻，
 * 宿主每 tick 检查一次，到点就求值那个信封。
 *
 * 这样「蓄力」「吟唱」「延迟陷阱」都是同一个机制，不用各写一套。
 * 被打断 = 把 pending 清空（patch 成空），效果自然就不发生了。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const PENDING = "core.pending";

/** 空 pending：到期字段为 0、没有信封，宿主视为「没有挂起」。 */
export const EMPTY_PENDING = { tag: "", params: {}, resolveAt: 0 };

export const castSignature: Signature = {
  tag: "base.cast",
  params: {
    t: "object",
    fields: {
      actor: { t: "int" },
      /** 到期要执行的信封标签。 */
      tag: { t: "str" },
      /** 目标格（现在只支持按格子作用的动作）。 */
      x: { t: "int" },
      y: { t: "int" },
      /** 几回合之后结算。 */
      ticks: { t: "int" },
    },
    optional: ["tag", "ticks"],
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  uses: { hand: 1 },
  skill: { name: "蓄力劈砍", cost: "wait", target: { kind: "entity", range: 1 } },
};

export function castHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number | string>;
  const actor = Number(p.actor);
  // 默认起手 10 回合（想看手感可以改这里；以后会挪到技能数据里）
  const ticks = p.ticks === undefined ? 10 : Number(p.ticks);
  const payloadTag = p.tag === undefined ? "base.attack" : String(p.tag);

  if (!Number.isInteger(ticks) || ticks < 1) {
    return { ok: false, reason: "蓄力至少要一回合" };
  }

  const entity = context.view.entity(actor);
  if (entity.pos === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const pending = entity.components[PENDING];
  if (isActive(pending)) {
    return { ok: false, reason: "已经在蓄力了" };
  }

  return {
    ok: true,
    effects: [
      {
        kind: "patch",
        handle: actor,
        component: PENDING,
        data: {
          tag: payloadTag,
          params: { actor, x: Number(p.x), y: Number(p.y) },
          resolveAt: context.view.tick + ticks,
        },
      },
    ],
  };
}

/** 这个 pending 是不是「真的挂着东西」。 */
export function isActive(pending: JsonValue | undefined): boolean {
  if (typeof pending !== "object" || pending === null || Array.isArray(pending)) {
    return false;
  }
  const value = pending as Record<string, JsonValue>;
  return typeof value.tag === "string" && value.tag.length > 0 && typeof value.resolveAt === "number" && value.resolveAt > 0;
}
