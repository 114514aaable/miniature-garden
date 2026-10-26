// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 回合队列的测试。运行：
 *   node --test engine/core/src/turn.test.ts
 *
 * 测试是「规则是权威」这句话的兑现方式：规则改了，测试会先叫。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { AP_PER_TURN, REACTIONS_PER_ROUND, TurnOrder, makeUnit } from "./turn.ts";

function three(): TurnOrder {
  return new TurnOrder([
    makeUnit("b", "乙", 4, "B", { x: 0, y: 0 }),
    makeUnit("a", "甲", 6, "A", { x: 0, y: 0 }),
    makeUnit("c", "丙", 4, "C", { x: 0, y: 0 }),
  ]);
}

test("按速度降序，同速按 id 升序", () => {
  const order = three();
  assert.deepEqual(
    order.order.map((u) => u.id),
    ["a", "b", "c"],
  );
});

test("每个单位开始回合时拿满 AP", () => {
  const order = three();
  const first = order.start();
  assert.equal(first.ap, AP_PER_TURN);

  first.ap = 0;
  const second = order.next();
  assert.equal(second.ap, AP_PER_TURN);
  assert.equal(first.ap, 0, "别人的回合不该把上一个人的 AP 补回来");
});

test("走完一轮后重置所有人的反应点", () => {
  const order = three();
  order.start();
  for (const unit of order.order) {
    unit.reactions = 0;
  }
  order.next();
  order.next();
  order.next(); // 回到第一个人，第 2 轮开始

  assert.equal(order.roundNumber, 2);
  for (const unit of order.order) {
    assert.equal(unit.reactions, REACTIONS_PER_ROUND);
  }
});

test("空队列直接报错，而不是悄悄返回 undefined", () => {
  assert.throws(() => new TurnOrder([]), /不能为空/);
});
