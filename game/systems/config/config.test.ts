// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 配置的测试：合并、夹取、改键、坏数据回退。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { clampCell, CONFIG_VERSION, DEFAULT_CONFIG, loadConfig, saveConfig, withBinding, withConfig } from "./config.ts";

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

test("老版本配置：行为项回默认，按键保留", () => {
  const storage = fakeStorage({
    "nw.config": JSON.stringify({
      clickPolicy: { hostile: "attack", neutral: "attack", friendly: "attack" },
      bindings: { KeyQ: "skill:core.cast" },
    }),
  });

  const config = loadConfig(storage);
  assert.deepEqual(config.clickPolicy, DEFAULT_CONFIG.clickPolicy);
  assert.equal(config.bindings.KeyQ, "skill:core.cast");
  assert.equal(config.version, CONFIG_VERSION);
});

test("新版本配置：行为项按存的来", () => {
  const storage = fakeStorage({
    "nw.config": JSON.stringify({
      version: CONFIG_VERSION,
      clickPolicy: { hostile: "attack", neutral: "attack", friendly: "inspect" },
    }),
  });

  const config = loadConfig(storage);
  assert.equal(config.clickPolicy.neutral, "attack");
  assert.equal(config.clickPolicy.friendly, "inspect");
});
