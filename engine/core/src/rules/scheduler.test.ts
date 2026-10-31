// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 调度器的测试：顺序、平局、速度、推进。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Scheduler } from "./scheduler.ts";

test("按 readyAt 从小到大取", () => {
  const s = new Scheduler([
    { handle: 7, readyAt: 5 },
    { handle: 3, readyAt: 2 },
  ]);

  assert.deepEqual(s.peek(), { tick: 2, handle: 3 });
  assert.deepEqual(s.take(), { tick: 2, handle: 3 });

  s.done(3, 5); // 下次在 7
  assert.deepEqual(s.take(), { tick: 5, handle: 7 });
});

test("同一 tick：按 handle 排队（不看插入顺序）", () => {
  const s = new Scheduler([
    { handle: 9, readyAt: 0 },
    { handle: 2, readyAt: 0 },
  ]);

  assert.deepEqual(s.take(), { tick: 0, handle: 2 });
  assert.deepEqual(s.take(), { tick: 0, handle: 9 });
});

test("行动后按成本排到后面", () => {
  const s = new Scheduler([
    { handle: 1, readyAt: 0 },
    { handle: 2, readyAt: 0 },
  ]);

  s.take();
  s.done(1, 3);
  assert.equal(s.readyAtOf(1), 3);

  assert.deepEqual(s.take(), { tick: 0, handle: 2 });
});

test("快的单位动得更频繁", () => {
  const s = new Scheduler([
    { handle: 1, readyAt: 0 }, // 每 1 tick
    { handle: 2, readyAt: 0 }, // 每 3 tick
  ]);

  const order: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const due = s.take();
    assert.ok(due !== null);
    order.push(due.handle);
    s.done(due.handle, due.handle === 1 ? 1 : 3);
  }

  assert.deepEqual(order, [1, 2, 1, 1, 1, 2]);
});

test("零成本也至少占一 tick（防止同一 tick 无限行动）", () => {
  const s = new Scheduler([{ handle: 1, readyAt: 0 }]);

  s.take();
  s.done(1, 0);
  assert.equal(s.readyAtOf(1), 1);

  assert.deepEqual(s.take(), { tick: 1, handle: 1 });
});

test("取完会推进时钟", () => {
  const s = new Scheduler([{ handle: 1, readyAt: 10 }], 0);
  assert.equal(s.now(), 0);
  s.take();
  assert.equal(s.now(), 10);
});

test("时钟不能倒退", () => {
  const s = new Scheduler([], 5);
  assert.throws(() => s.setNow(4), /不能倒退/);
});

test("移除的单位不再出现", () => {
  const s = new Scheduler([
    { handle: 1, readyAt: 0 },
    { handle: 2, readyAt: 1 },
  ]);
  s.remove(1);

  assert.deepEqual(s.take(), { tick: 1, handle: 2 });
  s.done(2, 5);
  assert.deepEqual(s.take(), { tick: 6, handle: 2 }, "被移除的 1 不再出现");

  s.remove(2);
  assert.equal(s.take(), null);
});

test("空调度器返回 null", () => {
  assert.equal(new Scheduler().take(), null);
});

test("upcoming 只读：列出接下来几个，不改变状态", () => {
  const s = new Scheduler([
    { handle: 9, readyAt: 3 },
    { handle: 2, readyAt: 1 },
    { handle: 5, readyAt: 1 },
  ]);

  assert.deepEqual(s.upcoming(3), [
    { tick: 1, handle: 2 },
    { tick: 1, handle: 5 },
    { tick: 3, handle: 9 },
  ]);

  // 读完之后 peek 还是同一个
  assert.deepEqual(s.peek(), { tick: 1, handle: 2 });
  assert.equal(s.now(), 0, "读不改时钟");
});
