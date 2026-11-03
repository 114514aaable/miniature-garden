// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 随机数的测试：确定性、区分度、区间、概率。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { chance, hashTag, roll, rollInt } from "./rng.ts";

test("同样的输入永远同样的结果", () => {
  const a = roll(42, 7, "base.attack", 0);
  const b = roll(42, 7, "base.attack", 0);
  assert.equal(a, b);
});

test("换 tick / tag / index 都会变", () => {
  const base = roll(42, 7, "base.attack", 0);
  assert.notEqual(base, roll(42, 8, "base.attack", 0));
  assert.notEqual(base, roll(42, 7, "core.loot", 0));
  assert.notEqual(base, roll(42, 7, "base.attack", 1));
});

test("换种子也会变", () => {
  assert.notEqual(roll(1, 0, "x", 0), roll(2, 0, "x", 0));
});

test("结果落在 [0, 1)", () => {
  for (let tick = 0; tick < 200; tick += 1) {
    const value = roll(12345, tick, "core.loot", tick % 3);
    assert.ok(value >= 0 && value < 1, `越界：${value}`);
  }
});

test("大致均匀：1000 次里各区间都有", () => {
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 1000; i += 1) {
    buckets[Math.floor(roll(7, i, "test.uniform", 0) * 10)] += 1;
  }
  for (const count of buckets) {
    assert.ok(count > 50, `某个区间太少：${count}`);
  }
});

test("rollInt 含两端，且不越界", () => {
  const seen = new Set<number>();
  for (let i = 0; i < 500; i += 1) {
    const value = rollInt(9, i, "test.int", 0, 1, 6);
    assert.ok(value >= 1 && value <= 6, `越界：${value}`);
    seen.add(value);
  }
  assert.equal(seen.size, 6, "1..6 每个数都该出现过");
});

test("rollInt 区间反了会报错", () => {
  assert.throws(() => rollInt(1, 0, "x", 0, 5, 1), /区间反了/);
});

test("chance 的边界", () => {
  assert.equal(chance(1, 0, "x", 0, 0), false);
  assert.equal(chance(1, 0, "x", 0, 1), true);
});

test("chance(0.5) 大约一半", () => {
  let hits = 0;
  for (let i = 0; i < 1000; i += 1) {
    if (chance(3, i, "test.chance", 0, 0.5)) hits += 1;
  }
  assert.ok(hits > 400 && hits < 600, `命中 ${hits}，偏离太多`);
});

test("tag 哈希稳定且区分", () => {
  assert.equal(hashTag("base.attack"), hashTag("base.attack"));
  assert.notEqual(hashTag("base.attack"), hashTag("core.loot"));
});
