// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 时钟的测试。
 *
 * 注意这里测的多数是「不能做什么」：
 * 不能倒退、不能走半步、不能有两个现在。
 * 对时间来说，禁止比允许更重要。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Clock } from "./clock.ts";

test("默认从 0 开始", () => {
  assert.equal(new Clock().now(), 0);
});

test("可以从指定刻度恢复（读档）", () => {
  assert.equal(new Clock(42).now(), 42);
});

test("advance 前进一步并返回新值", () => {
  const clock = new Clock();
  assert.equal(clock.advance(), 1);
  assert.equal(clock.now(), 1);
});

test("advance 可以一次走多步（长动作）", () => {
  const clock = new Clock(10);
  assert.equal(clock.advance(5), 15);
  assert.equal(clock.now(), 15);
});

test("只能前进正整数", () => {
  const clock = new Clock(3);
  assert.throws(() => clock.advance(0), /正整数/);
  assert.throws(() => clock.advance(-1), /正整数/);
  assert.throws(() => clock.advance(1.5), /正整数/);
  assert.equal(clock.now(), 3, "报错之后刻度不能被改动");
});

test("起点不能是负数或小数", () => {
  assert.throws(() => new Clock(-1), /非负整数/);
  assert.throws(() => new Clock(1.5), /非负整数/);
});

test("两个时钟互不影响（没有全局现在）", () => {
  const a = new Clock();
  const b = new Clock();
  a.advance(10);
  assert.equal(a.now(), 10);
  assert.equal(b.now(), 0);
});

test("连续前进是可累加的，不会回头", () => {
  const clock = new Clock();
  const seen: number[] = [];
  for (let i = 0; i < 5; i++) {
    seen.push(clock.advance());
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] > seen[i - 1], "序列必须严格递增");
  }
});
