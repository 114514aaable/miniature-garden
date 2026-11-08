// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 开局选生成器：挑方案、退回默认、名字不存在要报错。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { pickPipeline } from "./variants.ts";

const CAVES = [{ op: "caves" as const }];
const MAZE = [{ op: "maze" as const }];

const CONFIG = {
  pipeline: [{ op: "overworld" as const }],
  variants: { 洞穴: CAVES, 迷宫: MAZE },
};

test("指定方案：用那一条", () => {
  const picked = pickPipeline(CONFIG, "迷宫");
  assert.equal(picked.name, "迷宫");
  assert.deepEqual(picked.steps, MAZE);
});

test("没指定：用默认 pipeline", () => {
  const picked = pickPipeline(CONFIG, undefined);
  assert.equal(picked.name, "default");
  assert.deepEqual(picked.steps, CONFIG.pipeline);
});

test("空字符串也当没指定", () => {
  assert.equal(pickPipeline(CONFIG, "").name, "default");
});

test("只有 variants：用第一个", () => {
  const picked = pickPipeline({ variants: { 洞穴: CAVES } }, undefined);
  assert.equal(picked.name, "洞穴");
});

test("名字不存在：报错并列出可选", () => {
  assert.throws(() => pickPipeline(CONFIG, "地牢"), /没有这个生成方案.*洞穴/);
});

test("什么都没有：报错", () => {
  assert.throws(() => pickPipeline({}, undefined), /既没有 pipeline/);
});
