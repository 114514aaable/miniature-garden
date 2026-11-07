// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 数据写规则（第一套）：核心血量的数值变化。
 *
 * 它只做三件事：
 *   1  只认 core.health
 *   2  把新血量夹在 0..max 之间
 *   3  保留属性组里的其它字段（比如 max）
 *
 * 死亡不在这里：规则层致死时直接发 despawn，不会写 hp<=0。
 * 以后「部位」只需要换掉这条规则，入口不变。
 */

import type { Effect } from "../../engine/core/src/store.ts";
import type { EntityWrite, WriteResult } from "./effects.ts";

interface HealthLike {
  readonly max?: number;
  readonly hp?: number;
  readonly [key: string]: unknown;
}

function asHealth(value: unknown): HealthLike | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as HealthLike;
}

/** 写 core.health：夹取范围，保留其它字段。 */
export function healthWrite(write: EntityWrite): WriteResult | null {
  if (write.component !== "core.health") return null;

  const before = asHealth(write.before);
  if (before === null) return null;

  const after = asHealth(write.after);
  if (after === null) return null;

  const max = typeof before.max === "number" ? before.max : Number.POSITIVE_INFINITY;
  const wanted = typeof after.hp === "number" ? after.hp : before.hp ?? max;
  const hp = Math.max(0, Math.min(max, wanted));

  const effects: Effect[] = [
    {
      kind: "patch",
      handle: write.handle as never,
      component: "core.health",
      data: { ...before, ...after, hp } as never,
    },
  ];

  return { consume: true, effects };
}
