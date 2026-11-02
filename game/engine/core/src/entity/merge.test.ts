// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 合并规则的测试。
 *
 * 这条规则是「默认值不存」的地基：
 * 实例只写 hp，读的时候必须能合并出 max。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type JsonValue } from "../time.ts";
import { mergeDeep, resolveComponents } from "./merge.ts";

test("对象深合并：只改提到的键", () => {
  const base = { health: { max: 20, hp: 20 }, ai: { mode: "patrol" } };
  const override = { health: { hp: 7 } };

  assert.deepEqual(mergeDeep(base, override), {
    health: { max: 20, hp: 7 },
    ai: { mode: "patrol" },
  });
});

test("数组整体替换，不做逐项合并", () => {
  assert.deepEqual(mergeDeep({ tags: ["a", "b"] }, { tags: ["c"] }), { tags: ["c"] });
});

test("原始值直接替换", () => {
  assert.equal(mergeDeep(1, 2), 2);
  assert.equal(mergeDeep("a", "b"), "b");
  assert.equal(mergeDeep(true, false), false);
});

test("新键会被加进来", () => {
  assert.deepEqual(mergeDeep({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
});

test("是纯函数：不改入参", () => {
  const base = { health: { max: 20 } };
  const override = { health: { hp: 7 } };

  mergeDeep(base, override);

  assert.deepEqual(base, { health: { max: 20 } });
  assert.deepEqual(override, { health: { hp: 7 } });
});

test("结果和入参不共享引用", () => {
  const base = { tags: ["a"] };
  const override = {};
  const merged = mergeDeep(base, override) as { tags: string[] };

  merged.tags.push("b");
  assert.deepEqual(base.tags, ["a"]);
});

test("resolveComponents：模板默认值 + 实例覆盖", () => {
  const defaults: Record<string, JsonValue> = {
    "core.health": { max: 20, hp: 20 },
    "core.ai": { mode: "patrol" },
  };
  const overrides: Record<string, JsonValue> = {
    "core.health": { hp: 7 },
  };

  assert.deepEqual(resolveComponents(defaults, overrides), {
    "core.health": { max: 20, hp: 7 },
    "core.ai": { mode: "patrol" },
  });
});
