// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话场景：解析、选项身份、走节点、效果、存档、异步/取消。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createDialogScene, parseDialogScript } from "./dialog.ts";
import { type DialogueActor, type DialogueActorResult } from "./dialogue/actor.ts";

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

function scene(actor?: DialogueActor) {
  return createDialogScene(parseDialogScript(SCRIPT as never), actor);
}

function context(params: Record<string, unknown> = {}) {
  return { now: 1, params: params as never };
}

class DeferredActor implements DialogueActor {
  resolve: ((result: DialogueActorResult) => void) | null = null;

  respond(): Promise<DialogueActorResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
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

test("按 choiceId 走节点，视图跟着变", async () => {
  const dialog = scene();
  assert.deepEqual(await dialog.handle("choice:c1", context()), { effects: [] });
  const shown = view(dialog);
  assert.equal(shown.text, "拿好。");
  assert.equal(shown.turnId, 2);
});

test("旧命令 choice1..9 仍可用（按显示顺序）", async () => {
  const dialog = scene();
  await dialog.handle("choice1", context());
  assert.equal(view(dialog).text, "拿好。");
});

test("结束选项弹出场景", async () => {
  assert.deepEqual(await scene().handle("choice:c2", context()), {
    effects: [],
    next: { op: "pop" },
  });
});

test("未知 choiceId：什么也不做，不崩", async () => {
  const dialog = scene();
  assert.deepEqual(await dialog.handle("choice:nope", context()), { effects: [] });
  assert.equal(view(dialog).text, "要买盐吗？");
});

test("close 直接弹出", async () => {
  assert.deepEqual(await scene().handle("close", context()), { next: { op: "pop" } });
});

test("存档：节点、turnId、transcript 都能恢复", async () => {
  const dialog = scene();
  await dialog.handle("choice:c1", context());
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

test("指向不存在的节点会抛错（不静默）", async () => {
  const broken = createDialogScene(
    parseDialogScript({
      id: "x",
      start: "a",
      nodes: { a: { text: "", choices: [{ text: "去", next: "nope" }] } },
    } as never),
  );
  let error: unknown = null;
  try {
    await broken.handle("choice:c1", context());
  } catch (caught) {
    error = caught;
  }
  assert.match(String(error), /不存在的节点/);
});

test("选项效果：$speaker 在运行期替换成句柄", async () => {
  const dialog = createDialogScene(
    parseDialogScript({
      id: "fx",
      start: "a",
      nodes: {
        a: {
          text: "",
          choices: [
            {
              id: "pay",
              text: "付钱",
              end: true,
              effects: [
                { kind: "patch", handle: "$speaker", component: "core.health", data: { hp: 99 } },
              ],
            },
          ],
        },
      },
    } as never),
  );

  const result = await dialog.handle("choice:pay", context({ speaker: 4096, actor: 0 }));
  assert.ok(result.effects && result.effects.length === 1);
  assert.equal((result.effects[0] as { handle: number }).handle, 4096);
  assert.deepEqual(result.next, { op: "pop" });
});

test("选项效果：非法效果在加载期报错", () => {
  assert.throws(
    () =>
      parseDialogScript({
        id: "bad",
        start: "a",
        nodes: {
          a: { text: "", choices: [{ id: "x", text: "", end: true, effects: [{ kind: "explode" }] }] },
        },
      } as never),
    /不是合法效果/,
  );
});

test("requires 尚未支持：显式报错，不静默忽略", () => {
  assert.throws(
    () =>
      parseDialogScript({
        id: "req",
        start: "a",
        nodes: {
          a: { text: "", choices: [{ id: "x", text: "", end: true, requires: { item: "salt" } }] },
        },
      } as never),
    /requires 尚未支持/,
  );
});

test("异步演员：等待期间 busy，第二次输入被拒", async () => {
  const actor = new DeferredActor();
  const dialog = scene(actor);

  const first = dialog.handle("choice:c1", context());
  assert.equal(dialog.busy?.(), true);

  assert.deepEqual(await dialog.handle("choice:c1", context()), { effects: [] });
  assert.equal(view(dialog).text, "要买盐吗？");

  actor.resolve?.({ choiceId: "c1" });
  assert.deepEqual(await first, { effects: [] });
  assert.equal(view(dialog).text, "拿好。");
  assert.equal(dialog.busy?.(), false);
});

test("取消：旧响应回来也不落地", async () => {
  const actor = new DeferredActor();
  const dialog = scene(actor);

  const first = dialog.handle("choice:c1", context());
  dialog.cancel?.();
  actor.resolve?.({ choiceId: "c1" });

  assert.deepEqual(await first, { effects: [] });
  assert.equal(view(dialog).text, "要买盐吗？");
  assert.equal(dialog.busy?.(), false);
});
