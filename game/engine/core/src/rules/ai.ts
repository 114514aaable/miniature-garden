// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 敌人 AI：只做「选择」，不做「判定」。
 *
 * 它产出的是**信封**，不是效果——真正的判定还是 core.move / base.attack 做的。
 * 这样敌人和玩家走的是同一条路：同一套规则、同一份日志、同样的回放。
 *
 * v0 的决策很简单：
 *   相邻 → 打
 *   否则 → 朝玩家走一格（贪心，撞墙就试横向，再不行就等）
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";
import { blockersAt } from "./collision.ts";

export const enemyTurnSignature: Signature = {
  tag: "core.enemy_turn",
  params: {
    t: "object",
    fields: { enemy: { t: "int" }, target: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: false,
  needsTimestamp: false,
};

/** 返回 { next: { tag, params } } 或 { next: null }（原地不动）。 */
export function enemyTurnHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, number>;
  const enemy = context.view.entity(p.enemy);
  const target = context.view.entity(p.target);

  if (enemy.pos === null || enemy.space === null || target.pos === null || target.space !== enemy.space) {
    return { ok: true, next: null, reason: "不在同一空间" };
  }

  const intent = enemy.components[INTENT];
  const active = intentTiles(intent).length > 0;

  // 已经起手：到点就打，没到就等。
  if (active) {
    const resolveAt = numberIn(intent, "resolveAt", 0);
    if (context.view.tick >= resolveAt) {
      return { ok: true, next: { tag: "core.enemy_strike", params: { enemy: p.enemy, target: p.target } } };
    }
    return { ok: true, next: null, reason: "起手中" };
  }

  const dx = target.pos.x - enemy.pos.x;
  const dy = target.pos.y - enemy.pos.y;
  const distance = Math.abs(dx) + Math.abs(dy);

  // 够得着：先起手，下回合再打（给玩家躲的机会）。
  if (distance === 1) {
    // 伤害与起手时长来自数据（core.melee），不是规则里写死
    const melee = enemy.components["core.melee"];
    if (melee === undefined) {
      return { ok: false, reason: "它没有 core.melee，不知道打多重" };
    }

    return {
      ok: true,
      next: {
        tag: "core.enemy_windup",
        params: {
          enemy: p.enemy,
          dx,
          dy,
          damage: numberIn(melee, "damage", 0),
          ticks: numberIn(melee, "windup", 3),
        },
      },
    };
  }

  const space = context.view.space(enemy.space);
  const candidates: Array<{ x: number; y: number }> = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) candidates.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
    if (dy !== 0) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
  } else {
    if (dy !== 0) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
    if (dx !== 0) candidates.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
  }

  for (const cell of candidates) {
    if (!space.passableAt(cell)) continue;
    if (blockersAt(context.view, enemy.space, cell).length > 0) continue;
    return {
      ok: true,
      next: { tag: "core.move", params: { handle: p.enemy, space: enemy.space, x: cell.x, y: cell.y } },
    };
  }

  return { ok: true, next: null, reason: "被挡住了" };
}

const INTENT = "core.intent";

function intentTiles(intent: unknown): unknown[] {
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) return [];
  const tiles = (intent as Record<string, unknown>).tiles;
  return Array.isArray(tiles) ? tiles : [];
}

function numberIn(component: unknown, key: string, fallback: number): number {
  if (typeof component !== "object" || component === null) return fallback;
  const value = (component as Record<string, unknown>)[key];
  return typeof value === "number" ? value : fallback;
}
