// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 意图模式的测试：fixed 可躲、track 追打、默认 fixed。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { strikeHandler } from "./enemy-actions.ts";

const ENEMY = 1;
const TARGET = 2;

function makeView(
  enemyPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  intent: Record<string, unknown>,
) {
  return {
    tick: 5,
    entity: (handle: number) => ({
      handle,
      template: "x",
      space: 1,
      pos: handle === ENEMY ? enemyPos : targetPos,
      components:
        handle === ENEMY ? { "core.intent": intent } : { "core.health": { max: 10, hp: 10 } },
    }),
  } as never;
}

function strike(contextView: unknown) {
  return strikeHandler(
    { enemy: ENEMY, target: TARGET } as never,
    { view: contextView, frame: null, children: [] } as never,
  ) as { ok: boolean; missed?: boolean; effects: Array<{ kind: string }> };
}

const intent = (mode: string) => ({
  kind: "melee",
  tiles: [{ dx: 1, dy: 0 }],
  damage: 3,
  mode,
  resolveAt: 9,
});

test("fixed：玩家走出格子就落空", () => {
  const result = strike(makeView({ x: 1, y: 1 }, { x: 5, y: 5 }, intent("fixed")));
  assert.equal(result.missed, true);
});

test("fixed：还在格子里就命中", () => {
  const result = strike(makeView({ x: 1, y: 1 }, { x: 2, y: 1 }, intent("fixed")));
  assert.equal(result.missed, false);
});

test("track：走到相邻格也照样打到", () => {
  const result = strike(makeView({ x: 1, y: 1 }, { x: 1, y: 2 }, intent("track")));
  assert.equal(result.missed, false);
});

test("track：跑远了还是落空", () => {
  const result = strike(makeView({ x: 1, y: 1 }, { x: 5, y: 5 }, intent("track")));
  assert.equal(result.missed, true);
});

test("没有 mode 字段时按 fixed 处理", () => {
  const legacy = { kind: "melee", tiles: [{ dx: 1, dy: 0 }], damage: 3, resolveAt: 9 };
  const result = strike(makeView({ x: 1, y: 1 }, { x: 5, y: 5 }, legacy));
  assert.equal(result.missed, true);
});
