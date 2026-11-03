// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 命名形状 / 命名条件的测试。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { conditionOf, matchesNamed, offsetsOf, parseTraversal, unknownComponents } from "./shapes.ts";

const SPEC = parseTraversal({
  shapes: {
    touch: { base: "cross", range: 1 },
    around1: { base: "circle", range: 1 },
    front: { base: "circle", range: 1, keep: "front" },
    doubled: { base: "cross", range: 1, then: [{ op: "rotate90", turns: 1 }] },
  },
  filters: {
    living: { all: [{ component: "core.health" }] },
  },
});

test("形状名 → 偏移", () => {
  assert.equal(offsetsOf(SPEC, "touch").length, 4);
  assert.equal(offsetsOf(SPEC, "around1").length, 9);
});

test("keep：只要前方", () => {
  const front = offsetsOf(SPEC, "front");
  assert.equal(front.length, 3);
  assert.ok(front.every((offset) => offset.dy < 0));
});

test("then：旋转后仍然合法", () => {
  assert.equal(offsetsOf(SPEC, "doubled").length, 4);
});

test("未知形状直接报错", () => {
  assert.throws(() => offsetsOf(SPEC, "nope"), /没有这个形状/);
});

test("未知条件直接报错", () => {
  assert.throws(() => conditionOf(SPEC, "nope"), /没有这个条件/);
});

test("条件判活", () => {
  assert.equal(matchesNamed(SPEC, "living", { "core.health": { hp: 3 } }), true);
  assert.equal(matchesNamed(SPEC, "living", {}), false);
});

test("加载期能查出未登记的组件", () => {
  const missing = unknownComponents(SPEC, new Set(["core.health"]));
  assert.deepEqual(missing, []);
  assert.deepEqual(unknownComponents(SPEC, new Set()), ["core.health"]);
});

test("解析失败会报清楚", () => {
  assert.throws(() => parseTraversal({ shapes: { bad: { base: "nope" } } }), /base 不认识/);
  assert.throws(() => parseTraversal(42 as never), /必须是对象/);
});
