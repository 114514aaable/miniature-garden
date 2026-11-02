// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 尺寸策略的测试：五档、权重、非法输入。
 *
 * 这些断言就是「布局 bug 的第一道复现工具」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_POLICY, flexStyle, grows, shrinks } from "./flex.ts";

test("五档各自的样子", () => {
  assert.equal(flexStyle("fixed"), "flex: 0 0 auto");
  assert.equal(flexStyle("fit"), "flex: 0 1 auto");
  assert.equal(flexStyle("fill"), "flex: 1 1 auto");
  assert.equal(flexStyle("grow"), "flex: 1 0 auto");
  assert.equal(flexStyle("ratio"), "flex: 1 1 0");
});

test("默认是 fit（可压不可长）", () => {
  assert.equal(DEFAULT_POLICY, "fit");
  assert.equal(flexStyle(), "flex: 0 1 auto");
});

test("weight 只作用在会长的档上", () => {
  assert.equal(flexStyle("fill", 2), "flex: 2 1 auto");
  assert.equal(flexStyle("grow", 3), "flex: 3 0 auto");
  assert.equal(flexStyle("ratio", 0.5), "flex: 0.5 1 0");
});

test("fixed / fit 传 weight 也不变（它们没有 grow）", () => {
  assert.equal(flexStyle("fixed", 5), "flex: 0 0 auto");
  assert.equal(flexStyle("fit", 5), "flex: 0 1 auto");
});

test("weight 非法直接报错", () => {
  assert.throws(() => flexStyle("fill", 0), /必须是正数/);
  assert.throws(() => flexStyle("fill", -1), /必须是正数/);
  assert.throws(() => flexStyle("fill", Number.NaN), /必须是正数/);
});

test("未知档位报错", () => {
  assert.throws(() => flexStyle("flexible" as never), /未知的尺寸策略/);
});

test("grows / shrinks 与档位一致", () => {
  assert.deepEqual(
    ["fixed", "fit", "fill", "grow", "ratio"].map((p) => [p, grows(p as never), shrinks(p as never)]),
    [
      ["fixed", false, false],
      ["fit", false, true],
      ["fill", true, true],
      ["grow", true, false],
      ["ratio", true, true],
    ],
  );
});
