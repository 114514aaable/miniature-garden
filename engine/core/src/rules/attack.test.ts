// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 攻击的测试：扣血、打不死、打死、够不着。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../entity/entity.ts";
import { TemplateRegistry } from "../entity/template.ts";
import { createWorldView } from "../event/view.ts";
import { Space } from "../space.ts";
import { attackHandler } from "./attack.ts";

function setup() {
  const space = new Space(1, 5, 5);
  const entities = new EntityTable();

  const templates = new TemplateRegistry();
  const health = {
    t: "object",
    fields: { max: { t: "int" }, hp: { t: "int" } },
    optional: ["hp"],
  } as const;
  templates.defineComponent("core.health", health);
  templates.defineComponent("core.stats", {
    t: "object",
    fields: { speed: { t: "int" }, attack: { t: "int" }, defense: { t: "int" } },
  });
  templates.defineTemplate({
    id: "pc",
    components: { "core.health": { max: 20, hp: 20 }, "core.stats": { speed: 5, attack: 3, defense: 1 } },
  });
  templates.defineTemplate({
    id: "npc_salt",
    components: { "core.health": { max: 10, hp: 10 }, "core.stats": { speed: 4, attack: 2, defense: 1 } },
  });

  const actor = entities.create("pc", 1, { x: 1, y: 1 });
  const target = entities.create("npc_salt", 1, { x: 2, y: 1 });
  space.addOccupant({ x: 1, y: 1 }, actor);
  space.addOccupant({ x: 2, y: 1 }, target);

  const view = createWorldView([space], {
    tick: 0,
    entities,
    templates,
    terrains: new Map([[0, { passable: true }]]),
  });

  return { space, entities, templates, view, actor, target };
}

function run(params: Record<string, number>, view: ReturnType<typeof setup>["view"]) {
  return attackHandler(params as never, { view, frame: null, children: [] } as never);
}

test("相邻攻击：扣 攻击−防御 的血", () => {
  const { view, actor, target } = setup();
  const result = run({ actor, target }, view) as {
    ok: boolean;
    damage: number;
    effects: Array<{ kind: string; data?: { hp: number } }>;
  };

  assert.equal(result.ok, true);
  assert.equal(result.damage, 2, "攻击 3 − 防御 1");
  assert.deepEqual(result.effects, [
    { kind: "patch", handle: target, component: "core.health", data: { hp: 8 } },
  ]);
});

test("血被打光：直接 despawn", () => {
  const { view, entities, actor, target } = setup();
  entities.setOverrides(target, { "core.health": { hp: 2 } });

  const result = run({ actor, target }, view) as { ok: boolean; effects: Array<{ kind: string }> };
  assert.deepEqual(result.effects, [{ kind: "despawn", handle: target }]);
});

test("够不着就不让打", () => {
  const { view, entities, actor } = setup();
  const far = entities.create("npc_salt", 1, { x: 4, y: 4 });

  const result = run({ actor, target: far }, view) as { ok: boolean; reason: string };
  assert.equal(result.ok, false);
  assert.match(result.reason, /够不着/);
});

test("没有生命值的东西打不动", () => {
  const { view, entities, actor } = setup();
  const crate = entities.create("crate", 1, { x: 1, y: 2 });

  const result = run({ actor, target: crate }, view) as { ok: boolean; reason: string };
  assert.equal(result.ok, false);
  assert.match(result.reason, /没有生命值/);
});
