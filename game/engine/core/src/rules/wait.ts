// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 等待：什么都不做，只让时间走。
 *
 * 为什么必须有它：敌人的前摇要 2 回合才结算。如果玩家没有「空过一回合」的手段，
 * 就只能靠移动或攻击顺便把时间推过去——那等于被迫行动，前摇也就不成立了。
 *
 * 它不产生任何效果，成本由 clock 决定（默认 4 回合）。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";

export const waitSignature: Signature = {
  tag: "core.wait",
  params: { t: "object", fields: { actor: { t: "int" } } },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "等待", cost: "wait", target: { kind: "self", range: 0 } },
};

export function waitHandler(_params: JsonValue): JsonValue {
  return { ok: true, effects: [] };
}
