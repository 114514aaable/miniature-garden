// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 开发日志的测试：格式、截断、环形缓冲。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { compact, DevLog, formatLine } from "./devlog.ts";
import { Timeline } from "../../engine/core/src/time.ts";

test("记录意图：带上标签和参数", () => {
  const log = new DevLog();
  log.action(3, "core.move", { handle: 0, x: 2, y: 1 });

  const [line] = log.lines();
  assert.equal(line.tick, 3);
  assert.equal(line.phase, "action");
  assert.match(line.text, /core\.move/);
  assert.match(line.text, /"x":2/);
});

test("记录落地事件：tick 和 seq 来自事件本身", () => {
  const timeline = new Timeline(0);
  const entry = timeline.append({
    kind: "patch",
    targets: [7],
    data: { handle: 7, component: "core.health", value: { hp: 3 } },
  });

  const log = new DevLog();
  log.effect(entry);

  const [line] = log.lines();
  assert.equal(line.tick, entry.lTick);
  assert.equal(line.seq, entry.seq);
  assert.match(line.text, /core\.health/);
});

test("环形缓冲：超限只留最近的", () => {
  const log = new DevLog({ limit: 3 });
  for (let i = 0; i < 10; i += 1) {
    log.action(i, "core.wait", { i });
  }

  assert.equal(log.lines().length, 3);
  assert.equal(log.lines()[0].tick, 7);
  assert.equal(log.lines()[2].tick, 9);
});

test("tail 取最近几条", () => {
  const log = new DevLog();
  log.action(1, "a.b", {});
  log.action(2, "a.b", {});
  log.action(3, "a.b", {});

  assert.deepEqual(log.tail(2).map((line) => line.tick), [2, 3]);
});

test("compact 截断长数据", () => {
  const long = { text: "x".repeat(500) };
  const out = compact(long, 40);
  assert.ok(out.length <= 41);
  assert.ok(out.endsWith("…"));
});

test("formatLine 对齐 tick 与 seq", () => {
  const text = formatLine({ tick: 7, seq: 2, phase: "effect", text: "patch {}" });
  assert.equal(text, "[   7.  2] patch {}");
});
