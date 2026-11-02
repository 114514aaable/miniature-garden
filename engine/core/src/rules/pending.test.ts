// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 挂起动作的测试：写入、拒绝重复、判活。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../entity/entity.ts";
import { TemplateRegistry } from "../entity/template.ts";
import { createWorldView } from "../event/view.ts";
import { Space } from "../space.ts";
import { castHandler, EMPTY_PENDING, isActive, PENDING } from "./pending.ts";

function setup() {
  const space = new Space(1, 4, 4);
  const templates = new TemplateRegistry();
  templates.defineComponent(PENDING, {
    t: "object",
    fields: { tag: { t: "str" }, params: { t: "any" }, resolveAt: { t: "int" } },
  });
  templates.defineTemplate({ id: "pc", components: { [PENDING]: EMPTY_PENDING } });

  const entities = new EntityTable();
  const actor = entities.create("pc", 1, { x: 1, y: 1 });

  const view = createWorldView([space], {
    tick: 10,
    entities,
    templates,
    terrains: new Map([[0, { passable: true }]]),
  });

  return { entities, view, actor, templates };
}

function cast(view: ReturnType<typeof setup>["view"], params: Record<string, unknown>) {
  return castHandler(params as never, { view, frame: null, children: [] } as never) as {
    ok: boolean;
    reason?: string;
    effects?: Array<{ kind: string; component?: string; data?: { resolveAt: number; tag: string } }>;
  };
}

test("写入挂起：记下信封与到期时刻", () => {
  const { view, actor } = setup();
  const result = cast(view, { actor, tag: "core.attack", x: 2, y: 1, ticks: 2 });

  assert.equal(result.ok, true);
  const effect = result.effects?.[0];
  assert.equal(effect?.kind, "patch");
  assert.equal(effect?.component, PENDING);
  assert.equal(effect?.data?.resolveAt, 12);
  assert.equal(effect?.data?.tag, "core.attack");
});

test("已经在蓄力：拒绝", () => {
  const { view, actor, entities } = setup();
  entities.setOverrides(actor, {
    [PENDING]: { tag: "core.attack", params: {}, resolveAt: 20 },
  });

  const result = cast(view, { actor, tag: "core.attack", x: 2, y: 1, ticks: 2 });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /已经在蓄力/);
});

test("至少一回合", () => {
  const { view, actor } = setup();
  assert.equal(cast(view, { actor, tag: "core.attack", x: 2, y: 1, ticks: 0 }).ok, false);
});

test("空 pending 视为没有挂起", () => {
  assert.equal(isActive(EMPTY_PENDING), false);
  assert.equal(isActive(undefined), false);
  assert.equal(isActive({ tag: "x", params: {}, resolveAt: 5 }), true);
});
