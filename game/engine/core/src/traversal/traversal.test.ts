// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 遍历的测试：形状、变换、落点、条件。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { componentsOf, matches } from "./filter.ts";
import { baseOffsets, dedupe } from "./offsets.ts";
import { cellsOf, chebyshev } from "./resolve.ts";
import { keep, mirror, rotate90, translate } from "./transform.ts";

test("circle(1) 是九宫格", () => {
  assert.equal(baseOffsets("circle", 1).length, 9);
});

test("diamond(1) 是十字 + 中心（5 格）", () => {
  assert.equal(baseOffsets("diamond", 1).length, 5);
});

test("cross(2) 不含中心，也不含斜角", () => {
  const offsets = baseOffsets("cross", 2);
  assert.equal(offsets.length, 8);
  assert.ok(!offsets.some((offset) => offset.dx === 0 && offset.dy === 0));
});

test("rect(1,2) 是 3×5", () => {
  assert.equal(baseOffsets("rect", 1, 2).length, 15);
});

test("range 0 只有中心", () => {
  assert.deepEqual(baseOffsets("circle", 0), [{ dx: 0, dy: 0 }]);
});

test("旋转 90° 四次回到原样", () => {
  const before = baseOffsets("cross", 1);
  const after = rotate90(rotate90(rotate90(rotate90(before, 1), 1), 1), 1);
  assert.deepEqual(new Set(after.map((o) => `${o.dx},${o.dy}`)), new Set(before.map((o) => `${o.dx},${o.dy}`)));
});

test("旋转把 (1,0) 变成 (0,-1)", () => {
  assert.deepEqual(rotate90([{ dx: 1, dy: 0 }], 1), [{ dx: 0, dy: -1 }]);
});

test("镜像 x 轴：dx 变号", () => {
  assert.deepEqual(mirror([{ dx: 2, dy: 3 }], "x"), [{ dx: -2, dy: 3 }]);
});

test("平移", () => {
  assert.deepEqual(translate([{ dx: 0, dy: 0 }], 3, -1), [{ dx: 3, dy: -1 }]);
});

test("keep 只留下想要的", () => {
  const front = keep(baseOffsets("circle", 1), (offset) => offset.dy < 0);
  assert.equal(front.length, 3);
});

test("去重", () => {
  assert.equal(dedupe([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]).length, 1);
});

test("落点 + 裁剪", () => {
  const cells = cellsOf({ x: 0, y: 0 }, baseOffsets("circle", 1), { width: 2, height: 2 });
  assert.deepEqual(cells, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
});

test("条件：有组件", () => {
  const components = { "core.health": { hp: 5 } };
  assert.equal(matches({ component: "core.health" }, components), true);
  assert.equal(matches({ component: "core.dialog" }, components), false);
});

test("条件：字段比较", () => {
  const components = { "core.health": { hp: 5 } };
  assert.equal(matches({ component: "core.health", field: "hp", lt: 10 }, components), true);
  assert.equal(matches({ component: "core.health", field: "hp", gt: 10 }, components), false);
});

test("条件：all / any / not", () => {
  const components = { "core.health": { hp: 5 }, "core.item": {} };
  assert.equal(matches({ all: [{ component: "core.health" }, { component: "core.item" }] }, components), true);
  assert.equal(matches({ any: [{ component: "core.nope" }, { component: "core.item" }] }, components), true);
  assert.equal(matches({ not: { component: "core.nope" } }, components), true);
});

test("componentsOf 收集引用到的组件", () => {
  const set = componentsOf({ all: [{ component: "a" }, { not: { component: "b" } }] });
  assert.deepEqual([...set].sort(), ["a", "b"]);
});

test("chebyshev 与 circle 一致", () => {
  assert.equal(chebyshev({ x: 0, y: 0 }, { x: 2, y: -2 }), 2);
});
