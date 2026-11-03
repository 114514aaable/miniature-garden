// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话场景的测试：解析、走节点、结束、越界。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createDialogScene, parseDialogScript } from "./dialog.ts";

const SCRIPT = {
  id: "salt_01",
  start: "hi",
  nodes: {
    hi: {
      text: "要买盐吗？",
      choices: [
        { text: "要", next: "buy" },
        { text: "不要", end: true },
      ],
    },
    buy: { text: "拿好。", choices: [{ text: "再见", end: true }] },
  },
};

function scene() {
  return createDialogScene(parseDialogScript(SCRIPT as never));
}

test("解析：节点与选项都在", () => {
  const parsed = parseDialogScript(SCRIPT as never);
  assert.equal(parsed.start, "hi");
  assert.equal(parsed.nodes.hi.text, "要买盐吗？");
  assert.equal(parsed.nodes.hi.choices.length, 2);
});

test("开局视图是起始节点", () => {
  assert.deepEqual(scene().describe?.(), { text: "要买盐吗？", choices: ["要", "不要"] });
});

test("选项 1 走到下一个节点，视图跟着变", () => {
  const dialog = scene();
  assert.deepEqual(dialog.handle("choice1", { now: 1, params: {} }), { effects: [] });
  assert.deepEqual(dialog.describe?.(), { text: "拿好。", choices: ["再见"] });
});

test("结束选项弹出场景", () => {
  const dialog = scene();
  assert.deepEqual(dialog.handle("choice2", { now: 1, params: {} }), { next: { op: "pop" } });
});

test("越界的选项什么也不做（不崩）", () => {
  const dialog = scene();
  assert.deepEqual(dialog.handle("choice9", { now: 1, params: {} }), { effects: [] });
  assert.deepEqual(dialog.describe?.(), { text: "要买盐吗？", choices: ["要", "不要"] });
});

test("close 直接弹出", () => {
  assert.deepEqual(scene().handle("close", { now: 1, params: {} }), { next: { op: "pop" } });
});

test("指向不存在的节点会抛错（不静默）", () => {
  const broken = createDialogScene(
    parseDialogScript({
      id: "x",
      start: "a",
      nodes: { a: { text: "", choices: [{ text: "去", next: "nope" }] } },
    } as never),
  );
  assert.throws(() => broken.handle("choice1", { now: 1, params: {} }), /不存在的节点/);
});
