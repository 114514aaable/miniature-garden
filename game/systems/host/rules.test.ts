// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 世界规则裁剪：显式列表 / 缺省全部 / 未知 tag 报错。 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { selectActiveRules, type RuleLike } from "./rules.ts";

const TABLE: RuleLike[] = [
  { signature: { tag: "core.move" } },
  { signature: { tag: "base.attack" } },
  { signature: { tag: "core.wait" } },
];

const NOTHING = new Set<string>();

test("没写 rules：全部规则", () => {
  const active = selectActiveRules(TABLE, [], false, NOTHING);
  assert.equal(active.length, 3);
});

test("显式空列表：一条都不启用", () => {
  assert.deepEqual(selectActiveRules(TABLE, [], true, NOTHING), []);
});

test("显式列表：只启用列出的", () => {
  const active = selectActiveRules(TABLE, ["core.move"], true, NOTHING);
  assert.deepEqual(active.map((rule) => rule.signature.tag), ["core.move"]);
});

test("未知 tag：加载期报错", () => {
  assert.throws(
    () => selectActiveRules(TABLE, ["no.such"], true, NOTHING),
    /未知规则：no\.such/,
  );
});

test("别名先解析，再匹配", () => {
  const active = selectActiveRules(TABLE, ["core.attack"], true, NOTHING);
  assert.deepEqual(active.map((rule) => rule.signature.tag), ["base.attack"]);
});

test("用户关掉的规则仍然不启用", () => {
  const active = selectActiveRules(TABLE, ["core.move", "base.attack"], true, new Set(["base.attack"]));
  assert.deepEqual(active.map((rule) => rule.signature.tag), ["core.move"]);
});
