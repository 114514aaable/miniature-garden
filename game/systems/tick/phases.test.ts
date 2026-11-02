// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 阶段表的测试：顺序、tick 传递、错误不吞。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type Phase, phaseNames, runPhases } from "./phases.ts";

test("按顺序执行", () => {
  const order: string[] = [];
  const phases: Phase[] = [
    { name: "a", run: () => order.push("a") },
    { name: "b", run: () => order.push("b") },
    { name: "c", run: () => order.push("c") },
  ];

  runPhases(phases, 7);
  assert.deepEqual(order, ["a", "b", "c"]);
});

test("每个阶段都收到当前 tick", () => {
  const seen: number[] = [];
  runPhases(
    [
      { name: "a", run: (tick) => seen.push(tick) },
      { name: "b", run: (tick) => seen.push(tick) },
    ],
    12,
  );
  assert.deepEqual(seen, [12, 12]);
});

test("空表不报错", () => {
  runPhases([], 0);
});

test("阶段抛错不吞掉：后面的阶段不执行", () => {
  const order: string[] = [];
  const phases: Phase[] = [
    { name: "a", run: () => order.push("a") },
    {
      name: "b",
      run: () => {
        throw new Error("炸了");
      },
    },
    { name: "c", run: () => order.push("c") },
  ];

  assert.throws(() => runPhases(phases, 1), /炸了/);
  assert.deepEqual(order, ["a"]);
});

test("phaseNames 用于调试", () => {
  assert.deepEqual(
    phaseNames([
      { name: "step", run: () => {} },
      { name: "pending", run: () => {} },
    ]),
    ["step", "pending"],
  );
});
