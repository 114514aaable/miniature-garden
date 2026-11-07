// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 横扫：打「自己周围一圈」里所有活着的目标。
 *
 * 形状与过滤都来自 base（around1 / living）——
 * 规则里不出现半径、也不出现组件名。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const sweepSignature: Signature = {
  tag: "base.sweep",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, shape: { t: "str" }, filter: { t: "str" } },
    optional: ["shape", "filter"],
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "横扫", cost: "attack", target: { kind: "area", range: 0, shape: "around1" } },
};

export function sweepHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number | string>;
  const actor = Number(p.actor);
  const actorView = context.view.entity(actor);

  if (actorView.pos === null || actorView.space === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const shape = typeof p.shape === "string" ? p.shape : "around1";
  const filter = typeof p.filter === "string" ? p.filter : "living";
  const damage = 3;

  // 找「周围一圈」的格子：形状由宿主在 aim 时算过，这里按同样参数重算
  const offsets = context.tools?.offsets?.(shape);
  if (offsets === undefined) {
    return { ok: false, reason: "宿主管不了这个形状：" + shape };
  }

  const space = context.view.space(actorView.space);
  const cells = offsets
    .map((offset: { dx: number; dy: number }) => ({ x: actorView.pos!.x + offset.dx, y: actorView.pos!.y + offset.dy }))
    .filter((cell: { x: number; y: number }) => cell.x >= 0 && cell.y >= 0 && cell.x < space.width && cell.y < space.height);

  const targets = context.tools?.select?.(cells, filter, { exclude: actor }) ?? [];
  if (targets.length === 0) {
    return { ok: true, effects: [], reason: "周围没有人" };
  }

  const effects: JsonValue[] = [];
  for (const handle of targets) {
    const health = context.view.entity(handle).components["core.health"];
    const max = numberIn(health, "max", 0);
    const hp = numberIn(health, "hp", max);
    effects.push({ kind: "patch", handle, component: "core.health", data: { hp: hp - damage } });
  }

  return { ok: true, effects };
}

function numberIn(component: JsonValue | undefined, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return fallback;
  const value = (component as Record<string, JsonValue>)[key];
  return typeof value === "number" ? value : fallback;
}
