// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * i18n 的测试：取词、插值、缺词、合并覆盖。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createTranslator, mergeMessages } from "./i18n.ts";

const zh = createTranslator("zh-CN", {
  "game.hp": "生命",
  "game.recover": "恢复中 还要 {n} 回合",
  "game.save": "存档",
});

test("取词", () => {
  assert.equal(zh.t("game.hp"), "生命");
  assert.equal(zh.locale, "zh-CN");
});

test("插值", () => {
  assert.equal(zh.t("game.recover", { n: 3 }), "恢复中 还要 3 回合");
});

test("缺词显示 key 本身，不显示空白", () => {
  assert.equal(zh.t("game.missing"), "game.missing");
  assert.equal(zh.has("game.missing"), false);
});

test("缺参数时保留占位符", () => {
  assert.equal(zh.t("game.recover"), "恢复中 还要 {n} 回合");
  assert.equal(zh.t("game.recover", { other: 1 }), "恢复中 还要 {n} 回合");
});

test("参数是数字也能插", () => {
  assert.equal(zh.t("game.recover", { n: 0 }), "恢复中 还要 0 回合");
});

test("合并：后面的覆盖前面的", () => {
  const merged = mergeMessages({ a: "1", b: "2" }, { b: "改", c: "3" });
  assert.deepEqual(merged, { a: "1", b: "改", c: "3" });
  assert.equal(createTranslator("x", merged).t("b"), "改");
});

test("合并不会改到原来的对象", () => {
  const base = { a: "1" };
  mergeMessages(base, { a: "2" });
  assert.equal(base.a, "1");
});
