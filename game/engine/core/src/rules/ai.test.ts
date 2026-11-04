// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 敌人 AI 的测试：相邻就打、否则靠近、被挡就等。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../entity/entity.ts";
import { TemplateRegistry } from "../entity/template.ts";
import { createWorldView } from "../event/view.ts";
import { Space } from "../space.ts";
import { enemyTurnHandler } from "./ai.ts";

function setup(enemyAt: { x: number; y: number }, walls: Array<{ x: number; y: number }> = []) {
  const space = new Space(1, 5, 5);

  const templates = new TemplateRegistry();
  templates.defineComponent("core.solid", { t: "object", fields: {} });
  templates.defineComponent("core.melee", {
    t: "object",
    fields: { damage: { t: "int" }, windup: { t: "int" } },
    optional: ["windup"],
  });
  templates.defineComponent("core.intent", {
    t: "object",
    fields: {
      kind: { t: "str" },
      tiles: { t: "array", of: { t: "object", fields: { dx: { t: "int" }, dy: { t: "int" } } } },
      damage: { t: "int" },
      resolveAt: { t: "int" },
    },
  });
  templates.defineTemplate({
    id: "npc_salt",
    components: {
      "core.solid": {},
      "core.melee": { damage: 2 },
      "core.intent": { kind: "melee", tiles: [], damage: 0, resolveAt: 0 },
    },
  });
  templates.defineTemplate({ id: "pc", components: { "core.solid": {} } });

  const entities = new EntityTable();
  const player = entities.create("pc", 1, { x: 2, y: 2 });
  const enemy = entities.create("npc_salt", 1, enemyAt);
  space.addOccupant({ x: 2, y: 2 }, player);
  space.addOccupant(enemyAt, enemy);

  const view = createWorldView([space], {
    tick: 0,
    entities,
    templates,
    terrains: new Map([[0, { passable: true }]]),
  });

  // 墙用「不可走地形」表达
  for (const wall of walls) {
    space.setTerrain(wall, 1);
  }
  const viewWithWalls = createWorldView([space], {
    tick: 0,
    entities,
    templates,
    terrains: new Map([
      [0, { passable: true }],
      [1, { passable: false }],
    ]),
  });

  return { space, entities, view: viewWithWalls ?? view, player, enemy };
}

function run(params: Record<string, number>, view: ReturnType<typeof setup>["view"]) {
  return enemyTurnHandler(params as never, { view, frame: null, children: [] } as never) as {
    ok: boolean;
    next: { tag: string; params: Record<string, number> } | null;
    reason?: string;
  };
}

test("相邻：先起手（不是立刻打）", () => {
  const { view, player, enemy } = setup({ x: 3, y: 2 });
  const result = run({ enemy, target: player }, view);

  assert.equal(result.next?.tag, "core.enemy_windup");
  assert.deepEqual(result.next?.params, { enemy, dx: -1, dy: 0, damage: 2, ticks: 3 });
});

test("起手中：还没到点就等", () => {
  const { entities, view, player, enemy } = setup({ x: 3, y: 2 });
  entities.setOverrides(enemy, {
    "core.intent": { kind: "melee", tiles: [{ dx: -1, dy: 0 }], damage: 2, resolveAt: 5 },
  });

  const result = run({ enemy, target: player }, view);
  assert.equal(result.next, null);
  assert.match(result.reason ?? "", /起手/);
});

test("不相邻：产出移动信封，朝玩家走一格", () => {
  const { view, player, enemy } = setup({ x: 1, y: 1 });
  const result = run({ enemy, target: player }, view);

  assert.equal(result.next?.tag, "core.move");
  const params = result.next?.params ?? {};
  const distance = Math.abs((params.x as number) - 2) + Math.abs((params.y as number) - 2);
  assert.ok(distance < 2, "这一步应该更靠近玩家");
});

test("被墙挡住：原地不动", () => {
  // 玩家在 (2,2)，敌人在 (0,2)，中间 (1,2) 是墙
  const { view, player, enemy } = setup({ x: 0, y: 2 }, [{ x: 1, y: 2 }]);
  const result = run({ enemy, target: player }, view);

  assert.equal(result.next, null);
  assert.match(result.reason ?? "", /挡住/);
});
