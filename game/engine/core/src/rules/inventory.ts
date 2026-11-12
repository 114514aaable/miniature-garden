// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 物品栏规则：捡起、放下。
 *
 * 两条都只做一件事——改组件：
 *   捡起：物品的 core.place = null，玩家的 core.container.items 里加一个句柄
 *   放下：反过来
 *
 * 没有专门的「拾取效果」。物品栏能成立，靠的就是 core.place 支持 null。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

const PLAYER_PARAMS = { t: "object", fields: { actor: { t: "int" } } } as const;
const ANY = { t: "any" } as const;

export const takeSignature: Signature = {
  tag: "core.take",
  params: PLAYER_PARAMS,
  result: ANY,
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "捡起", cost: "take", target: { kind: "self", range: 0 } },
};

export const dropSignature: Signature = {
  tag: "core.drop",
  params: {
    t: "object",
    fields: { actor: { t: "int" }, x: { t: "int" }, y: { t: "int" } },
    optional: ["x", "y"],
  },
  result: ANY,
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "放下", cost: "drop", target: { kind: "self", range: 0 } },
};

function inventoryOf(view: EvaluateContext["view"], handle: number): { slots: number; items: number[] } | null {
  const container = view.entity(handle).components["core.container"];
  if (typeof container !== "object" || container === null || Array.isArray(container)) {
    return null;
  }
  const bag = container as Record<string, JsonValue>;
  const slots = typeof bag.slots === "number" ? bag.slots : 0;
  const items = Array.isArray(bag.items) ? (bag.items as number[]) : [];
  return { slots, items };
}

export function takeHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const actorHandle = (params as Record<string, number>).actor;
  const actor = context.view.entity(actorHandle);

  if (actor.pos === null || actor.space === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const bag = inventoryOf(context.view, actorHandle);
  if (bag === null) {
    return { ok: false, reason: "它没有物品栏" };
  }
  if (bag.items.length >= bag.slots) {
    return { ok: false, reason: "物品栏满了" };
  }

  const here = context.view.space(actor.space).occupantsAt(actor.pos);
  // 同格多件时取「最上面」= 最后放进格子的一件（LIFO）
  let item;
  for (let index = here.length - 1; index >= 0; index -= 1) {
    const handle = here[index];
    if (handle !== actorHandle && context.view.entity(handle).components["core.item"] !== undefined) {
      item = handle;
      break;
    }
  }
  if (item === undefined) {
    return { ok: false, reason: "这里没有可以捡的东西" };
  }

  return {
    ok: true,
    effects: [
      { kind: "patch", handle: item, component: "core.place", data: null },
      { kind: "patch", handle: actorHandle, component: "core.container", data: { items: [...bag.items, item] } },
    ],
  };
}

export function dropHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const actor = context.view.entity(p.actor);

  if (actor.pos === null || actor.space === null) {
    return { ok: false, reason: "它不在任何地方" };
  }

  const bag = inventoryOf(context.view, p.actor);
  if (bag === null || bag.items.length === 0) {
    return { ok: false, reason: "物品栏是空的" };
  }

  const target = {
    x: typeof p.x === "number" ? p.x : actor.pos.x,
    y: typeof p.y === "number" ? p.y : actor.pos.y,
  };
  if (!context.view.space(actor.space).passableAt(target)) {
    return { ok: false, reason: "那里放不下" };
  }

  const item = bag.items[0];
  return {
    ok: true,
    effects: [
      { kind: "patch", handle: item, component: "core.place", data: { space: actor.space, x: target.x, y: target.y } },
      { kind: "patch", handle: p.actor, component: "core.container", data: { items: bag.items.slice(1) } },
    ],
  };
}
