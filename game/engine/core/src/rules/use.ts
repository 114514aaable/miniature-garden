// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 使用物品：把背包里的东西「用」出去。
 *
 * 效果写在物品上（组件的 `effects`），不写在规则里——
 * 加一种新药水不需要改代码，只需要给它一个 core.use 组件。
 *
 * 占位符只支持三个：
 *   $self  → 物品自己
 *   $actor → 用东西的人
 *   $cell  → 用东西的人所在格（{ space, x, y }）
 *
 * 现在只支持覆盖语义（patch 用 data 整体替换）。相对值（"+5"）以后再加。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const USE_COMPONENT = "core.use";

export const useSignature: Signature = {
  tag: "core.use",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, item: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "使用", cost: "take", target: { kind: "self", range: 0 } },
};

/** 物品上的用法声明。 */
export interface UseSpec {
  readonly effects: readonly JsonValue[];
  readonly consume: boolean;
}

export function useHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const actorHandle = Number(p.actor);
  const itemHandle = Number(p.item);

  const actor = context.view.entity(actorHandle);
  if (actor.pos === null || actor.space === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const bag = context.view.entity(actorHandle).components["core.container"];
  if (typeof bag !== "object" || bag === null || Array.isArray(bag)) {
    return { ok: false, reason: "它没有物品栏" };
  }
  const items = Array.isArray((bag as Record<string, JsonValue>).items)
    ? ((bag as Record<string, JsonValue>).items as number[])
    : [];
  if (!items.includes(itemHandle)) {
    return { ok: false, reason: "这件东西不在它身上" };
  }

  const spec = readUseSpec(context.view.entity(itemHandle).components[USE_COMPONENT]);
  if (spec === null) {
    return { ok: false, reason: "这件东西不能用" };
  }

  const cell = { space: actor.space, x: actor.pos.x, y: actor.pos.y };
  const effects = spec.effects.map((effect) => substitute(effect, actorHandle, itemHandle, cell));

  if (spec.consume) {
    effects.push({ kind: "patch", handle: actorHandle, component: "core.container", data: { items: items.filter((h) => h !== itemHandle) } });
    effects.push({ kind: "patch", handle: itemHandle, component: "core.place", data: null });
  }

  return { ok: true, effects };
}

function readUseSpec(value: JsonValue | undefined): UseSpec | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const spec = value as Record<string, JsonValue>;
  if (!Array.isArray(spec.effects)) return null;
  return { effects: spec.effects, consume: spec.consume === true };
}

/** 把占位符换成具体值（只处理对象与数组，不改字符串里的部分）。 */
function substitute(value: JsonValue, actor: number, item: number, cell: Record<string, JsonValue>): JsonValue {
  if (value === "$self") return item;
  if (value === "$actor") return actor;
  if (value === "$cell") return cell;

  if (Array.isArray(value)) {
    return value.map((entry) => substitute(entry, actor, item, cell));
  }

  if (typeof value === "object" && value !== null) {
    const out: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = substitute(entry, actor, item, cell);
    }
    return out;
  }

  return value;
}
