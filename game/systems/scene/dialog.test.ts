// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话场景：解析、选项身份、走节点、存档恢复。
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

type View = {
  conversationId: string;
  turnId: number;
  text: string;
  choices: Array<{ id: string; label: string }>;
  state: string;
};

function view(scene: ReturnType<typeof createDialogScene>): View {
  return scene.describe?.() as unknown as View;
}

function scene() {
  return createDialogScene(parseDialogScript(SCRIPT as never));
}

test("解析：没有显式 id 时生成 c1/c2", () => {
  const parsed = parseDialogScript(SCRIPT as never);
  assert.deepEqual(parsed.nodes.hi.choices.map((choice) => choice.id), ["c1", "c2"]);
});

test("解析：显式 id 保留，重复报错", () => {
  const parsed = parseDialogScript({
    id: "x",
    start: "a",
    nodes: {
      a: {
        text: "",
        choices: [
          { id: "buy", text: "买", end: true },
          { id: "leave", text: "走", end: true },
        ],
      },
    },
  } as never);
  assert.deepEqual(parsed.nodes.a.choices.map((choice) => choice.id), ["buy", "leave"]);

  assert.throws(
    () =>
      parseDialogScript({
        id: "dup",
        start: "a",
        nodes: {
          a: {
            text: "",
            choices: [
              { id: "x", text: "1", end: true },
              { id: "x", text: "2", end: true },
            ],
          },
        },
      } as never),
    /选项 id 重复/,
  );
});

test("开局视图带 conversationId / turnId / choices.id", () => {
  const shown = view(scene());
  assert.equal(shown.text, "要买盐吗？");
  assert.equal(shown.turnId, 1);
  assert.equal(shown.conversationId, "conv.salt_01");
  assert.deepEqual(shown.choices, [
    { id: "c1", label: "要" },
    { id: "c2", label: "不要" },
  ]);
});

test("按 choiceId 走节点，视图跟着变", () => {
  const dialog = scene();
  assert.deepEqual(dialog.handle("choice:c1", { now: 1, params: {} }), { effects: [] });
  const shown = view(dialog);
  assert.equal(shown.text, "拿好。");
  assert.equal(shown.turnId, 2);
});

test("旧命令 choice1..9 仍可用（按显示顺序）", () => {
  const dialog = scene();
  dialog.handle("choice1", { now: 1, params: {} });
  assert.equal(view(dialog).text, "拿好。");
});

test("结束选项弹出场景", () => {
  assert.deepEqual(scene().handle("choice:c2", { now: 1, params: {} }), { next: { op: "pop" } });
});

test("未知 choiceId：什么也不做，不崩", () => {
  const dialog = scene();
  assert.deepEqual(dialog.handle("choice:nope", { now: 1, params: {} }), { effects: [] });
  assert.equal(view(dialog).text, "要买盐吗？");
});

test("close 直接弹出", () => {
  assert.deepEqual(scene().handle("close", { now: 1, params: {} }), { next: { op: "pop" } });
});

test("存档：节点、turnId、transcript 都能恢复", () => {
  const dialog = scene();
  dialog.handle("choice:c1", { now: 1, params: {} });
  const saved = dialog.snapshot?.();

  const restored = scene();
  restored.restore?.(saved as never);
  assert.equal(view(restored).text, "拿好。");
  assert.equal(view(restored).turnId, 2);

  const state = saved as unknown as { transcript: Array<{ speaker: string; text: string }> };
  assert.ok(state.transcript.some((entry) => entry.text === "要买盐吗？"));
  assert.ok(state.transcript.some((entry) => entry.text === "要"));
});

test("旧存档 { node } 也能恢复", () => {
  const dialog = scene();
  dialog.restore?.({ node: "buy" } as never);
  assert.equal(view(dialog).text, "拿好。");
});

test("指向不存在的节点会抛错（不静默）", () => {
  const broken = createDialogScene(
    parseDialogScript({
      id: "x",
      start: "a",
      nodes: { a: { text: "", choices: [{ text: "去", next: "nope" }] } },
    } as never),
  );
  assert.throws(() => broken.handle("choice:c1", { now: 1, params: {} }), /不存在的节点/);
});
