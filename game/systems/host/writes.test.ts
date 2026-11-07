// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 数据写规则：参数名 + 变化方式（夹范围 / 致死判定 / 不认领）。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyWriteRules, type WriteOutcome, type WriteRule } from "./writes.ts";
import { baseWriteRules } from "./base-rules.ts";
import type { EntityWrite } from "./effects.ts";

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

function hpOf(outcome: WriteOutcome): number {
  return (outcome.effects[0] as unknown as { data: { hp: number } }).data.hp;
}

test("基础规则：hp 夹在 0..max，保留其它字段", () => {
  const outcome = applyWriteRules(baseWriteRules, write({}));
  assert.ok(outcome);
  assert.equal(outcome.consume, true);
  assert.equal(outcome.lethal, false);
  assert.deepEqual(outcome.effects[0], {
    kind: "patch",
    handle: 1,
    component: "core.health",
    data: { max: 20, hp: 17 },
  });
});

test("基础规则：超过 max 夹回 max", () => {
  const outcome = applyWriteRules(baseWriteRules, write({ after: { hp: 99 } }));
  assert.ok(outcome);
  assert.equal(hpOf(outcome), 20);
});

test("基础规则：写到 0 判致死", () => {
  const outcome = applyWriteRules(baseWriteRules, write({ before: { max: 20, hp: 3 }, after: { hp: -4 } }));
  assert.ok(outcome);
  assert.equal(hpOf(outcome), 0);
  assert.equal(outcome.lethal, true);
});

test("规则不认领的组返回 null", () => {
  assert.equal(applyWriteRules(baseWriteRules, write({ component: "core.body" })), null);
});

test("自定义规则：set 模式不夹", () => {
  const rules: WriteRule[] = [{ component: "mymod.rage", field: "value", mode: "set" }];
  const outcome = applyWriteRules(
    rules,
    write({ component: "mymod.rage", before: { value: 1 }, after: { value: 99 } }),
  );
  assert.ok(outcome);
  assert.deepEqual((outcome.effects[0] as { data: unknown }).data, { value: 99 });
});

test("自定义规则：通配所有数值字段", () => {
  const rules: WriteRule[] = [{ component: "mymod.stats", field: "*", mode: "clamp", min: 0, max: 10 }];
  const outcome = applyWriteRules(
    rules,
    write({ component: "mymod.stats", before: { a: 1, b: 2 }, after: { a: 50, b: 5 } }),
  );
  assert.ok(outcome);
  assert.deepEqual((outcome.effects[0] as { data: unknown }).data, { a: 10, b: 5 });
});

test("规则不匹配字段时返回 null", () => {
  const rules: WriteRule[] = [{ component: "core.health", field: "mana", mode: "set" }];
  assert.equal(applyWriteRules(rules, write({})), null);
});
