// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 别名的测试：映射、未知原样、批量。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { LEGACY_TAGS, resolveTag, resolveTags } from "./aliases.ts";

test("旧 tag 映射到新 tag", () => {
  assert.equal(resolveTag("core.attack"), "base.attack");
  assert.equal(resolveTag("core.cast"), "base.cast");
});

test("新 tag 原样返回", () => {
  assert.equal(resolveTag("base.attack"), "base.attack");
  assert.equal(resolveTag("core.move"), "core.move");
});

test("完全不认识的原样返回（不猜）", () => {
  assert.equal(resolveTag("whatever.thing"), "whatever.thing");
});

test("批量映射保持顺序", () => {
  assert.deepEqual(resolveTags(["core.cast", "core.move", "core.attack"]), [
    "base.cast",
    "core.move",
    "base.attack",
  ]);
});

test("别名表里每个键都真的有变化（防止写错成恒等）", () => {
  for (const [from, to] of Object.entries(LEGACY_TAGS)) {
    assert.notEqual(from, to);
  }
});
