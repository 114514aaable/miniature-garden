// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第一条真规则：走一格。
 *
 * 它做的事：检查目标格能不能走，然后产出一个 move 效果。
 * 它不做的事：不判输赢、不花 AP、不碰世界——那些以后再说。
 *
 * 拒绝（墙、有人、斜走）不走异常，而是返回 { ok: false, reason }。
 * 「规则说不行」和「规则崩了」是两回事，不能混。
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";
import { blockersAt } from "./collision.ts";

/** 地形能不能走由世界声明；规则不认数字，只问视图。 */

export const moveSignature: Signature = {
  tag: "core.move",
  params: {
    t: "object",
    fields: {
      handle: { t: "int" },
      space: { t: "int" },
      x: { t: "int" },
      y: { t: "int" },
    },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
  skill: { name: "走一步", cost: "move", target: { kind: "cell", range: 1 } },
};

export function moveHandler(params: JsonValue, context: EvaluateContext): JsonValue {
  const p = params as Record<string, JsonValue>;
  const handle = p.handle as number;
  const spaceId = p.space as number;
  const target = { x: p.x as number, y: p.y as number };

  const entity = context.view.entity(handle);
  const space = context.view.space(spaceId);

  if (entity.space !== spaceId || entity.pos === null) {
    return { ok: false, reason: "它不在这个空间里" };
  }

  const distance = Math.abs(target.x - entity.pos.x) + Math.abs(target.y - entity.pos.y);
  if (distance !== 1) {
    return { ok: false, reason: "一次只能走一格，而且不能斜着走" };
  }

  // 能过不能过由「物种 × 地形」的对接表决定（宿主提供）；没有就退回地形自己的 passable
  const allowed = context.tools?.canEnter?.(handle, spaceId, target) ?? space.passableAt(target);
  if (!allowed) {
    return { ok: false, reason: "那里过不去" };
  }

  const blocking = blockersAt(context.view, spaceId, target);
  if (blocking.length > 0) {
    return { ok: false, reason: "那里已经有东西了" };
  }

  // 移动就是改 core.place——统一成数据之后，没有专门的 move 效果了。
  const effects = [
    { kind: "patch", handle, component: "core.place", data: { space: spaceId, x: target.x, y: target.y } },
  ];
  return { ok: true, effects };
}
