// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 场景栈的测试：注册、压栈、替换、弹出、命令分发。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type Scene, SceneStack, sceneFromComponent } from "./scene.ts";

function makeScene(id: string, input: string[], onHandle?: (command: string) => unknown): Scene {
  return {
    id,
    input,
    handle: (command) => (onHandle === undefined ? {} : (onHandle(command) as never)),
  };
}

function registry(...scenes: Scene[]): Map<string, Scene> {
  return new Map(scenes.map((scene) => [scene.id, scene]));
}

test("初始只有 explore 一层", () => {
  const stack = new SceneStack(registry(makeScene("explore", ["move"])), { id: "explore", params: {} });
  assert.equal(stack.depth(), 1);
  assert.equal(stack.top().id, "explore");
});

test("压栈后，命令表变成栈顶的", () => {
  const stack = new SceneStack(
    registry(makeScene("explore", ["move"]), makeScene("dialog", ["choice1", "close"])),
    { id: "explore", params: {} },
  );

  stack.push("dialog", { npc: 4096 });
  assert.deepEqual(stack.input(), ["choice1", "close"]);
  assert.deepEqual(stack.topLayer().params, { npc: 4096 });
});

test("弹出回到上一层，且不会把 explore 弹掉", () => {
  const stack = new SceneStack(registry(makeScene("explore", ["move"]), makeScene("dialog", ["close"])), {
    id: "explore",
    params: {},
  });

  stack.push("dialog");
  stack.pop();
  assert.equal(stack.top().id, "explore");

  stack.pop();
  assert.equal(stack.depth(), 1, "explore 不能被弹掉");
});

test("替换栈顶", () => {
  const stack = new SceneStack(registry(makeScene("explore", ["move"]), makeScene("battle", ["attack"])), {
    id: "explore",
    params: {},
  });

  stack.replace("battle", { round: 1 });
  assert.equal(stack.top().id, "battle");
  assert.equal(stack.depth(), 1);
});

test("未知场景直接报错", () => {
  const stack = new SceneStack(registry(makeScene("explore", ["move"])), { id: "explore", params: {} });
  assert.throws(() => stack.push("nope"), /没有这个场景/);
});

test("不认识命令直接报错（不静默吞掉）", () => {
  const stack = new SceneStack(registry(makeScene("explore", ["move"])), { id: "explore", params: {} });
  assert.throws(() => stack.handle("attack", 1), /不认识命令/);
});

test("handle 把意图原样返回", () => {
  const scene = makeScene("dialog", ["close"], () => ({ next: { op: "pop" } }));
  const stack = new SceneStack(registry(scene), { id: "dialog", params: {} });
  assert.deepEqual(stack.handle("close", 3), { next: { op: "pop" } });
});

test("没有 core.scene 时默认 explore", () => {
  assert.deepEqual(sceneFromComponent(undefined), { id: "explore", params: {} });
  assert.deepEqual(sceneFromComponent({ id: "dialog", params: { npc: 1 } }), {
    id: "dialog",
    params: { npc: 1 },
  });
});
