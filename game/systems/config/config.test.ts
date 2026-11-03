// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 配置的测试：合并、夹取、改键、坏数据回退。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { clampCell, DEFAULT_CONFIG, loadConfig, normalizeAction, saveConfig, withBinding, withConfig } from "./config.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

test("没有存档时返回默认", () => {
  assert.deepEqual(loadConfig(fakeStorage()), DEFAULT_CONFIG);
});

test("存了再读能拿回来", () => {
  const storage = fakeStorage();
  saveConfig(withConfig(DEFAULT_CONFIG, { hotbarCell: 52 }), storage);
  assert.equal(loadConfig(storage).hotbarCell, 52);
});

test("只存了部分字段：其余走默认", () => {
  const storage = fakeStorage({ "nw.config": JSON.stringify({ speed: 20 }) });
  const config = loadConfig(storage);
  assert.equal(config.speed, 20);
  assert.equal(config.inventoryCell, DEFAULT_CONFIG.inventoryCell);
});

test("按键：用户改的覆盖默认，没改的保留", () => {
  const storage = fakeStorage({ "nw.config": JSON.stringify({ bindings: { KeyW: "move:north" } }) });
  const config = loadConfig(storage);
  assert.equal(config.bindings.KeyW, "move:north");
  assert.equal(config.bindings.KeyA, "move:a");
});

test("坏数据退回默认", () => {
  assert.deepEqual(loadConfig(fakeStorage({ "nw.config": "{oops" })), DEFAULT_CONFIG);
});

test("改键与解绑", () => {
  const rebound = withBinding(DEFAULT_CONFIG, "KeyQ", "skill:core.cast");
  assert.equal(rebound.bindings.KeyQ, "skill:core.cast");
  assert.equal(rebound.bindings.KeyW, "move:w");

  const cleared = withBinding(rebound, "KeyQ", null);
  assert.equal(cleared.bindings.KeyQ, undefined);
});

test("格子大小被夹在 24..96", () => {
  assert.equal(clampCell(10), 24);
  assert.equal(clampCell(200), 96);
  assert.equal(clampCell(48.4), 48);
  assert.equal(clampCell(Number.NaN), 38);
});

test("默认点击策略：敌对攻击、中立/友好交谈、物品拾取", () => {
  const config = loadConfig(fakeStorage());
  assert.deepEqual(config.clickPolicy, {
    hostile: { kind: "skill", ref: "base.attack" },
    neutral: { kind: "skill", ref: "base.talk" },
    friendly: { kind: "skill", ref: "base.talk" },
    item: { kind: "builtin", ref: "take" },
  });
});

test("动作：老字符串迁移成新结构", () => {
  assert.deepEqual(normalizeAction("attack", DEFAULT_CONFIG.clickPolicy.hostile), {
    kind: "skill",
    ref: "base.attack",
  });
  assert.deepEqual(normalizeAction("take", DEFAULT_CONFIG.clickPolicy.item), { kind: "builtin", ref: "take" });
});

test("动作：不认识的字符串回默认", () => {
  assert.deepEqual(normalizeAction("nope", DEFAULT_CONFIG.clickPolicy.neutral), DEFAULT_CONFIG.clickPolicy.neutral);
});

test("动作：结构正确就原样保留", () => {
  const value = { kind: "skill", ref: "base.cast" } as const;
  assert.deepEqual(normalizeAction(value, DEFAULT_CONFIG.clickPolicy.hostile), value);
});
