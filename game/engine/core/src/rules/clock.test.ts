// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 游戏时钟的测试：换算、成本、速度减免、零帧。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampCost,
  costOf,
  DEFAULT_CLOCK,
  isFree,
  MAX_ACTION_COST,
  roundOf,
  TICKS_PER_ROUND,
  ticksFor,
} from "./clock.ts";

test("tick 与回合互转（v0 是 1:1）", () => {
  assert.equal(TICKS_PER_ROUND, 1);
  assert.equal(roundOf(7), 7);
  assert.equal(ticksFor(7), 7);
});

test("回合数必须是非负整数", () => {
  assert.throws(() => ticksFor(-1), /非负整数/);
  assert.throws(() => ticksFor(1.5), /非负整数/);
});

test("成本：移动 2、攻击 3、观察 0", () => {
  assert.equal(costOf(DEFAULT_CLOCK, "move", 5), 2);
  assert.equal(costOf(DEFAULT_CLOCK, "attack", 5), 3);
  assert.equal(costOf(DEFAULT_CLOCK, "look", 5), 0);
});

test("速度越高，成本越低", () => {
  assert.equal(costOf(DEFAULT_CLOCK, "move", 4), 2, "低于第一档，不减");
  assert.equal(costOf(DEFAULT_CLOCK, "move", 8), 1);
  assert.equal(costOf(DEFAULT_CLOCK, "move", 10), 0);
});

test("成本不会被减成负数", () => {
  assert.equal(costOf(DEFAULT_CLOCK, "look", 10), 0);
  assert.equal(costOf(DEFAULT_CLOCK, "move", 99), 0);
});

test("零帧动作可以判定", () => {
  assert.equal(isFree(DEFAULT_CLOCK, "look", 5), true);
  assert.equal(isFree(DEFAULT_CLOCK, "move", 5), false);
  assert.equal(isFree(DEFAULT_CLOCK, "move", 10), true, "速度够快，移动也不再花时间");
});

test("未知动作直接报错", () => {
  assert.throws(() => costOf(DEFAULT_CLOCK, "teleport", 5), /未知的动作类型/);
});

test("成本上限：超过就夹到 MAX_ACTION_COST", () => {
  assert.equal(clampCost(999), MAX_ACTION_COST);
  assert.equal(clampCost(-5), 0);
  assert.equal(clampCost(Number.NaN), 0);
  assert.equal(clampCost(Infinity), 0);
  assert.equal(clampCost(3.6), 4);
});

test("成本上限：正常值原样返回", () => {
  assert.equal(clampCost(2), 2);
  assert.equal(clampCost(0), 0);
});
