// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 数据写规则：默认数值版（夹范围、保留其它字段）。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { healthWrite } from "./health-write.ts";
import type { EntityWrite } from "./effects.ts";
import type { Effect } from "../../engine/core/src/store.ts";

/** 从 patch 效果里取 hp（测试用）。 */
function hpOf(effect: Effect): number {
  return (effect as unknown as { data: { hp: number } }).data.hp;
}

function write(partial: Partial<EntityWrite>): EntityWrite {
  return {
    handle: 1 as never,
    component: "core.health",
    before: { max: 20, hp: 20 },
    after: { hp: 17 },
    meta: { source: "skill" },
    ...partial,
  } as EntityWrite;
}

test("血量写：普通扣血原样通过（保留 max）", () => {
  const result = healthWrite(write({}));
  assert.ok(result);
  assert.equal(result.consume, true);
  assert.deepEqual(result.effects[0], {
    kind: "patch",
    handle: 1,
    component: "core.health",
    data: { max: 20, hp: 17 },
  });
});

test("血量写：超过上限夹到 max", () => {
  const result = healthWrite(write({ after: { hp: 99 } }));
  assert.ok(result);
  assert.equal(hpOf(result.effects[0]), 20);
});

test("血量写：低于 0 夹到 0（死亡不在这里）", () => {
  const result = healthWrite(write({ after: { hp: -5 } }));
  assert.ok(result);
  assert.equal(hpOf(result.effects[0]), 0);
});

test("血量写：不是 core.health 就不管", () => {
  assert.equal(healthWrite(write({ component: "core.body" })), null);
});

test("血量写：旧值不是对象就不管", () => {
  assert.equal(healthWrite(write({ before: null })), null);
});
