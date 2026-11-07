// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 推进：每 tick 一帧、尾帧、截断保护、非法目标。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { advanceTo, MAX_FRAMES, type AdvanceHost } from "./advance.ts";
import type { Frame } from "./frames.ts";

function fakeHost(options: { step?: () => void } = {}) {
  const host: AdvanceHost & { tick: number; readyAt: number; note: string; logs: string[] } = {
    tick: 0,
    readyAt: 0,
    note: "",
    logs: [],
    frames: [] as Frame[],
    lastEvents: [],
    now() {
      return host.tick;
    },
    setReadyAt(tick) {
      host.readyAt = tick;
    },
    notice(message) {
      host.note = message;
    },
    devlog(message) {
      host.logs.push(message);
    },
    capture() {
      return new Map();
    },
    diff(_prev, tick, events) {
      return { tick, entities: [], removed: [], events: events.map((e) => String(e.id)) };
    },
    stepTick() {
      if (options.step !== undefined) {
        options.step();
        return;
      }
      host.tick += 1;
    },
    applyPending() {},
    maxFrames: MAX_FRAMES,
  };

  return host;
}

test("推进：每 tick 一帧", () => {
  const host = fakeHost();
  advanceTo(host, 3);
  assert.equal(host.tick, 3);
  assert.equal(host.frames.length, 3);
  assert.deepEqual(host.frames.map((f) => f.tick), [1, 2, 3]);
});

test("推进：目标就是当前时刻时，补一帧尾帧", () => {
  const host = fakeHost();
  advanceTo(host, 0);
  assert.equal(host.frames.length, 1, "没有帧时至少要有一帧");
});

test("推进：尾帧会带上挂起结算的事件", () => {
  const host = fakeHost();
  let posed = false;
  host.applyPending = () => {
    if (posed) return;
    posed = true;
    (host.lastEvents as unknown[]).push({ id: 7, kind: "patch", data: {} });
  };

  advanceTo(host, 0);
  assert.equal(host.frames.length, 1);
  assert.deepEqual(host.frames[0].events, ["7"]);
});

test("推进：stepTick 不前进会截断，并把 readyAt 拉回来", () => {
  const host = fakeHost({ step: () => {} });
  advanceTo(host, 5);
  assert.ok(host.note.includes("截断"), "应该有截断提示");
  assert.equal(host.readyAt, 0);
  assert.ok(host.logs.includes("调度器"));
});

test("推进：目标不是数字只记日志", () => {
  const host = fakeHost();
  advanceTo(host, Number.NaN);
  assert.equal(host.tick, 0);
  assert.ok(host.logs.includes("调度器"));
});
