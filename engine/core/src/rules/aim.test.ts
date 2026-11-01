// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 指向规则的测试：射程、目标类型、阻挡。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../entity/entity.ts";
import { TemplateRegistry } from "../entity/template.ts";
import { createWorldView } from "../event/view.ts";
import { Space } from "../space.ts";
import { aimHandler } from "./aim.ts";

function setup() {
  const space = new Space(1, 5, 5);
  const templates = new TemplateRegistry();
  templates.defineComponent("core.solid", { t: "object", fields: {} });
  templates.defineComponent("core.health", { t: "object", fields: { max: { t: "int" } } });
  templates.defineTemplate({ id: "pc", components: { "core.solid": {}, "core.health": { max: 10 } } });
  templates.defineTemplate({ id: "rock", components: { "core.solid": {} } });

  const entities = new EntityTable();
  const actor = entities.create("pc", 1, { x: 1, y: 1 });
  space.addOccupant({ x: 1, y: 1 }, actor);

  const view = createWorldView([space], {
    tick: 0,
    entities,
    templates,
    terrains: new Map([[0, { passable: true }]]),
  });

  return { space, entities, view, actor };
}

function aim(view: ReturnType<typeof setup>["view"], params: Record<string, unknown>) {
  return aimHandler(params as never, { view, frame: null, children: [] } as never) as {
    ok: boolean;
    cells: number[][];
    reason: string | null;
  };
}

test("空地：射程内可用", () => {
  const { view, actor } = setup();
  const result = aim(view, { actor, kind: "cell", range: 1, x: 2, y: 1 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cells, [[2, 1]]);
});

test("超出射程：拒绝", () => {
  const { view, actor } = setup();
  const result = aim(view, { actor, kind: "cell", range: 1, x: 4, y: 4 });

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /够不着/);
});

test("要目标却没有目标：拒绝", () => {
  const { view, actor } = setup();
  const result = aim(view, { actor, kind: "entity", range: 1, x: 2, y: 1 });

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /没有可以作用的目标/);
});

test("有目标：返回目标句柄", () => {
  const { view, actor, entities, space } = setup();
  const rock = entities.create("rock", 1, { x: 2, y: 1 });
  space.addOccupant({ x: 2, y: 1 }, rock);
  // rock 没有 core.health，所以要用带血的模板：这里复用 pc
  const victim = entities.create("pc", 1, { x: 3, y: 1 });
  space.addOccupant({ x: 3, y: 1 }, victim);

  const result = aim(view, { actor, kind: "entity", range: 2, x: 3, y: 1 }) as { ok: boolean; target?: number };
  assert.equal(result.ok, true);
  assert.equal(result.target, victim);
});

test("被实心物挡住：cell 类型拒绝", () => {
  const { view, actor, entities, space } = setup();
  const rock = entities.create("rock", 1, { x: 2, y: 1 });
  space.addOccupant({ x: 2, y: 1 }, rock);

  const result = aim(view, { actor, kind: "cell", range: 1, x: 2, y: 1 });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /挡着/);
});

test("越界：拒绝而不是崩", () => {
  const { view, actor } = setup();
  const result = aim(view, { actor, kind: "cell", range: 9, x: 9, y: 9 });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /没有格子/);
});
