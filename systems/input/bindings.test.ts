// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 按键映射的测试：查表、改键、冲突、合并。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { bind, boundTo, commandFor, DEFAULT_BINDINGS, parseCommand, resolveBindings, unbind } from "./bindings.ts";

test("默认键位：W 是向北", () => {
  assert.equal(commandFor(DEFAULT_BINDINGS, "KeyW"), "move:w");
  assert.equal(commandFor(DEFAULT_BINDINGS, "Space"), "skill:core.wait");
});

test("没绑定的键返回 undefined", () => {
  assert.equal(commandFor(DEFAULT_BINDINGS, "KeyZ"), undefined);
});

test("大写字母也走同一个 code（这正是之前那个 bug）", () => {
  // 物理键 KeyW 无论大小写都是 KeyW
  assert.equal(commandFor(DEFAULT_BINDINGS, "KeyW"), "move:w");
});

test("命令拆成 kind 与 value", () => {
  assert.deepEqual(parseCommand("move:w"), { kind: "move", value: "w" });
  assert.deepEqual(parseCommand("skill:core.attack"), { kind: "skill", value: "core.attack" });
  assert.deepEqual(parseCommand("ui:settings"), { kind: "ui", value: "settings" });
});

test("没有冒号的命令：kind 就是它本身", () => {
  assert.deepEqual(parseCommand("wait"), { kind: "wait", value: "" });
});

test("改键不改原表", () => {
  const next = bind(DEFAULT_BINDINGS, "KeyW", "move:s");
  assert.equal(commandFor(next, "KeyW"), "move:s");
  assert.equal(commandFor(DEFAULT_BINDINGS, "KeyW"), "move:w");
});

test("解绑", () => {
  const next = unbind(DEFAULT_BINDINGS, "KeyW");
  assert.equal(commandFor(next, "KeyW"), undefined);
  assert.equal(commandFor(DEFAULT_BINDINGS, "KeyW"), "move:w");
});

test("查同一个命令绑了哪些键", () => {
  const table = bind(DEFAULT_BINDINGS, "ArrowUp", "move:w");
  assert.deepEqual(boundTo(table, "move:w"), ["ArrowUp", "KeyW"]);
});

test("用户设置覆盖默认", () => {
  const merged = resolveBindings({ KeyW: "move:north" });
  assert.equal(merged.KeyW, "move:north");
  assert.equal(merged.KeyA, "move:a");
});

test("没有用户设置时就是默认", () => {
  assert.deepEqual(resolveBindings(null), DEFAULT_BINDINGS);
});
