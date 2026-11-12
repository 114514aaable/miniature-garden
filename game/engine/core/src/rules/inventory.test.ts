// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 同格多件物品：拾取取最上面（最后放进去）的那件。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { takeHandler } from "./inventory.ts";
import type { EvaluateContext } from "../event/evaluate.ts";

function context(occupants: number[], templates: Record<number, string>): EvaluateContext {
  const entities = new Map<number, unknown>();
  entities.set(1, {
    handle: 1,
    space: 1,
    pos: { x: 0, y: 0 },
    components: { "core.container": { slots: 4, items: [] } },
  });
  for (const handle of occupants) {
    if (handle === 1) continue;
    entities.set(handle, {
      handle,
      space: 1,
      pos: { x: 0, y: 0 },
      components: { "core.item": { stack: 1, weight: 1 } },
    });
  }
  // 未在 occupants 里的模板只用于占位
  void templates;

  return {
    view: {
      entity: (handle: number) => {
        const entity = entities.get(handle);
        if (entity === undefined) throw new Error("没有这个实体：" + handle);
        return entity;
      },
      space: () => ({ occupantsAt: () => occupants, passableAt: () => true }),
    },
  } as unknown as EvaluateContext;
}

test("同格三件：拾取最后放进来的那件", () => {
  const result = takeHandler({ actor: 1 }, context([1, 10, 11, 12], {})) as {
    ok: boolean;
    effects: Array<{ handle: number }>;
  };
  assert.equal(result.ok, true);
  assert.equal(result.effects[0].handle, 12);
});

test("只有一件：照常拾取", () => {
  const result = takeHandler({ actor: 1 }, context([1, 10], {})) as {
    ok: boolean;
    effects: Array<{ handle: number }>;
  };
  assert.equal(result.ok, true);
  assert.equal(result.effects[0].handle, 10);
});
