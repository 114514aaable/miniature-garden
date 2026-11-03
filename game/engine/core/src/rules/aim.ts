// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 指向：鼠标/键盘选一个格子，问「这个技能能不能落在这里」。
 *
 * 刻意做成通用的：它不认识具体技能，只认三件事：
 *   kind   要「有东西」还是「空地」
 *   range  最远几格
 *   cell   目标格
 *
 * 技能那边声明自己的 target（kind/range），客户端把它填进来。
 * 这样别的世界包换一套技能，指针逻辑不用改。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";
import { blockersAt } from "./collision.ts";
import { matches, type Condition } from "../traversal/filter.ts";

export const aimSignature: Signature = {
  tag: "core.aim",
  params: {
    t: "object",
    fields: {
      actor: { t: "int" },
      kind: { t: "enum", values: ["cell", "entity"] },
      range: { t: "int" },
      x: { t: "int" },
      y: { t: "int" },
      /** 只接受带这个组件的目标（可选，旧写法）。 */
      component: { t: "str" },
      /** 条件（来自 base 的 filters，可选，新写法）。 */
      condition: { t: "any" },
    },
    optional: ["component", "condition"],
  },
  result: { t: "any" },
  returnsEffects: false,
  needsTimestamp: false,
};

export function aimHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number | string>;
  const actor = context.view.entity(p.actor as number);

  if (actor.pos === null || actor.space === null) {
    return { ok: false, cells: [], reason: "它不在任何地方" };
  }

  const cell = { x: p.x as number, y: p.y as number };
  const space = context.view.space(actor.space);

  // 越界先挡掉：space.index 会抛，这里自己判
  if (cell.x < 0 || cell.y < 0 || cell.x >= space.width || cell.y >= space.height) {
    return { ok: false, cells: [], reason: "那里没有格子" };
  }

  const distance = Math.abs(cell.x - actor.pos.x) + Math.abs(cell.y - actor.pos.y);
  if (distance > (p.range as number)) {
    return { ok: false, cells: [], reason: "够不着" };
  }

  const occupants = space.occupantsAt(cell).filter((handle) => handle !== (p.actor as number));

  if (p.kind === "entity") {
    const condition = typeof p.condition === "object" && p.condition !== null ? (p.condition as Condition) : undefined;
    const wanted = typeof p.component === "string" ? p.component : undefined;

    const target = occupants.find((handle) => {
      const components = context.view.entity(handle).components;
      if (condition !== undefined) return matches(condition, components);
      if (wanted !== undefined) return components[wanted] !== undefined;
      return true;
    });
    if (target === undefined) {
      return { ok: false, cells: [], reason: "那里没有可以作用的目标" };
    }
    return { ok: true, cells: [[cell.x, cell.y]], target, reason: null };
  }

  if (!space.passableAt(cell)) {
    return { ok: false, cells: [], reason: "那里过不去" };
  }
  if (blockersAt(context.view, actor.space, cell).length > 0) {
    return { ok: false, cells: [], reason: "那里有东西挡着" };
  }
  return { ok: true, cells: [[cell.x, cell.y]], reason: null };
}
