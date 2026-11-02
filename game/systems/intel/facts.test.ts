// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 情报事实的测试：百分比、受伤判定、意图剩余、蓄力进度。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { entityFacts, healthFacts, intentFacts, pendingFacts } from "./facts.ts";

test("满血不算受伤", () => {
  const facts = healthFacts({ hp: 20, max: 20 });
  assert.deepEqual(facts, { cur: 20, max: 20, ratio: 1, hurt: false, critical: false });
});

test("低于三分之一算濒死", () => {
  const facts = healthFacts({ hp: 5, max: 20 });
  assert.equal(facts?.hurt, true);
  assert.equal(facts?.critical, true);
  assert.equal(facts?.ratio, 0.25);
});

test("没有血量组件就没有事实", () => {
  assert.equal(healthFacts(undefined), undefined);
  assert.equal(healthFacts({ max: 0 }), undefined);
});

test("意图：算出还剩几回合，过期就不算", () => {
  const raw = { tiles: [{ dx: 1, dy: 0 }], damage: 3, resolveAt: 10 };
  assert.equal(intentFacts(raw, 8)?.inTicks, 2);
  assert.equal(intentFacts(raw, 10), undefined);
});

test("意图：没有格子 = 没有威胁", () => {
  assert.equal(intentFacts({ tiles: [], damage: 3, resolveAt: 9 }, 5), undefined);
});

test("蓄力进度按 startedAt 算", () => {
  const facts = pendingFacts({ resolveAt: 12, startedAt: 10 }, 11);
  assert.deepEqual(facts, { done: 1, total: 2, ratio: 0.5 });
});

test("实体事实：名字走语言包，组件缺了就当没有", () => {
  const facts = entityFacts(
    { handle: 7, template: "npc_salt", components: { "core.health": { hp: 3, max: 10 } } },
    { now: 1, label: (kind, id) => `${kind}:${id}`, describe: () => "描述" },
  );

  assert.equal(facts.name, "template:npc_salt");
  assert.equal(facts.description, "描述");
  assert.equal(facts.health?.hurt, true);
  assert.equal(facts.intent, undefined);
});
