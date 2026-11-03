// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 交谈：和「劈砍」一样是一条技能——有目标、有射程、能进快捷栏。
 *
 * 它不产生效果，而是返回一个**场景意图**：
 *
 *   { ok: true, scene: { op: "push", id: "dialog", params: { script, speaker } } }
 *
 * 宿主拿到 `scene` 才真正压场景——规则不碰场景栈，和「规则不碰 store」一致。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const talkSignature: Signature = {
  tag: "base.talk",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, target: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  /** 说话不花时间：对话里世界本来就不该往前走。 */
  skill: { name: "交谈", cost: "talk", target: { kind: "entity", range: 1, component: "core.dialog" } },
};

export function talkHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const actor = context.view.entity(Number(p.actor));
  const target = context.view.entity(Number(p.target));

  if (actor.pos === null || target.pos === null || actor.space !== target.space) {
    return { ok: false, reason: "它不在旁边" };
  }

  const distance = Math.max(
    Math.abs(actor.pos.x - target.pos.x),
    Math.abs(actor.pos.y - target.pos.y),
  );
  if (distance > 1) {
    return { ok: false, reason: "太远了，走近一点" };
  }

  const dialog = target.components["core.dialog"];
  if (typeof dialog !== "object" || dialog === null || Array.isArray(dialog)) {
    return { ok: false, reason: "它没什么想说的" };
  }

  const script = (dialog as Record<string, JsonValue>).script;
  if (typeof script !== "string" || script.length === 0) {
    return { ok: false, reason: "它没什么想说的" };
  }

  return {
    ok: true,
    effects: [],
    scene: { op: "push", id: "dialog", params: { script, speaker: Number(p.target) } },
  };
}
