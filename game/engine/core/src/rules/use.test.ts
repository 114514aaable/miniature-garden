// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * core.use 的测试：占位符替换、消耗、拒绝。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { useHandler } from "./use.ts";

const ACTOR = 7;
const ITEM = 9;

function view(components: { actor?: Record<string, unknown>; item?: Record<string, unknown> }) {
  return {
    tick: 1,
    entity: (handle: number) => ({
      handle,
      template: "x",
      space: 1,
      pos: { x: 2, y: 3 },
      components:
        handle === ACTOR
          ? { "core.container": { slots: 8, items: [ITEM] }, ...(components.actor ?? {}) }
          : { ...(components.item ?? {}) },
    }),
  } as never;
}

function run(components: Parameters<typeof view>[0], params: Record<string, number> = { actor: ACTOR, item: ITEM }) {
  return useHandler(params as never, { view: view(components), frame: null, children: [] } as never) as {
    ok: boolean;
    reason?: string;
    effects?: Array<{ kind: string; handle?: number; component?: string; data?: unknown }>;
  };
}

test("把物品上的 effects 原样变成效果", () => {
  const result = run({
    item: { "core.use": { effects: [{ kind: "patch", handle: "$actor", component: "core.health", data: { hp: 20 } }], consume: false } },
  });

  assert.equal(result.ok, true);
  assert.equal(result.effects?.length, 1);
  assert.equal(result.effects?.[0].handle, ACTOR);
});

test("消耗品：用完从背包移除并离开世界", () => {
  const result = run({
    item: { "core.use": { effects: [], consume: true } },
  });

  const patches = result.effects ?? [];
  const container = patches.find((effect) => effect.component === "core.container");
  assert.deepEqual((container?.data as { items: number[] }).items, []);
  const place = patches.find((effect) => effect.component === "core.place");
  assert.equal(place?.data, null);
});

test("不在身上：拒绝", () => {
  const result = run({ item: { "core.use": { effects: [], consume: false } } }, { actor: ACTOR, item: 12345 });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /不在它身上/);
});

test("没有 core.use 组件：拒绝", () => {
  const result = run({});
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /不能用/);
});

test("嵌套里的占位符也会替换（$self）", () => {
  const result = run({
    item: {
      "core.use": {
        effects: [{ kind: "patch", handle: "$self", component: "core.lamp", data: { lit: true, owner: "$actor" } }],
        consume: false,
      },
    },
  });
  const effect = result.effects?.[0];
  assert.equal(effect?.handle, ITEM);
  assert.deepEqual(effect?.data, { lit: true, owner: ACTOR });
});
