// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * UI 描述的测试：方向、间距、内边距、尺寸策略、结构。
 *
 * 布局出问题时先在这里加一条断言，比开浏览器快。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { boxStyle, button, col, panel, row, text } from "./spec.ts";

test("row / col 的区别只有方向", () => {
  assert.equal(boxStyle({}, "row")["flex-direction"], "row");
  assert.equal(boxStyle({}, "column")["flex-direction"], "column");
});

test("默认档位是 fit", () => {
  assert.equal(boxStyle()["flex"], "flex: 0 1 auto");
});

test("尺寸策略进 flex", () => {
  assert.equal(boxStyle({ policy: "fill", weight: 2 }).flex, "flex: 2 1 auto");
  assert.equal(boxStyle({ policy: "fixed" }).flex, "flex: 0 0 auto");
  assert.equal(boxStyle({ policy: "ratio" }).flex, "flex: 1 1 0");
});

test("间距与内边距", () => {
  assert.equal(boxStyle({ gap: 8 }).gap, "8px");
  assert.equal(boxStyle({ padding: 12 }).padding, "12px");
  assert.equal(boxStyle({ padding: [1, 2, 3, 4] }).padding, "1px 2px 3px 4px");
});

test("宽高是像素", () => {
  const style = boxStyle({ width: 280, height: 40 });
  assert.equal(style.width, "280px");
  assert.equal(style.height, "40px");
});

test("对齐映射到 flex 关键词", () => {
  assert.equal(boxStyle({ align: "center" })["align-items"], "center");
  assert.equal(boxStyle({ justify: "between" })["justify-content"], "space-between");
});

test("子节点按顺序保留", () => {
  const node = row({ gap: 4 }, text("甲"), text("乙"));
  assert.equal(node.children.length, 2);
  assert.equal(node.children[0].text, "甲");
  assert.equal(node.children[1].text, "乙");
});

test("panel 有背景和边框", () => {
  const style = panel().style;
  assert.ok(style.background.includes("rgba"));
  assert.equal(style["border-radius"], "8px");
});

test("button 固定尺寸、带点击", () => {
  let clicked = 0;
  const b = button("劈砍 3", () => {
    clicked += 1;
  });

  assert.equal(b.tag, "button");
  assert.equal(b.text, "劈砍 3");
  assert.equal(b.style.flex, "flex: 0 0 auto");
  b.onClick?.();
  assert.equal(clicked, 1);
});

test("col 里的子节点保持列方向", () => {
  const list = col({ gap: 6 }, text("a"), text("b"), text("c"));
  assert.equal(list.style["flex-direction"], "column");
  assert.equal(list.style.gap, "6px");
  assert.equal(list.children.length, 3);
});
