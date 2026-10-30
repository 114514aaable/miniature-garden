// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 碰撞规则的测试：实心才挡路，非实心可以踩过去。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../entity/entity.ts";
import { TemplateRegistry } from "../entity/template.ts";
import { createWorldView } from "../event/view.ts";
import { Space } from "../space.ts";
import { blockersAt, isSolid } from "./collision.ts";

function setup() {
  const space = new Space(1, 4, 4);
  const entities = new EntityTable();

  const templates = new TemplateRegistry();
  templates.defineComponent("core.solid", { t: "object", fields: {} });
  templates.defineTemplate({ id: "wall", components: { "core.solid": {} } });
  templates.defineTemplate({ id: "rug", components: {} });

  const view = () =>
    createWorldView([space], {
      tick: 0,
      entities,
      templates,
      terrains: new Map([[0, { passable: true }]]),
    });

  return { space, entities, templates, view };
}

test("有 core.solid 的实体挡路", () => {
  const { entities, view } = setup();
  const handle = entities.create("wall", 1, { x: 1, y: 1 });
  assert.equal(isSolid(view(), handle), true);
});

test("没有 core.solid 的实体不挡路", () => {
  const { entities, view } = setup();
  const handle = entities.create("rug", 1, { x: 1, y: 1 });
  assert.equal(isSolid(view(), handle), false);
});

test("覆盖可以给实体加上 core.solid", () => {
  const { entities, view } = setup();
  const handle = entities.create("rug", 1, { x: 1, y: 1 }, { "core.solid": {} });
  assert.equal(isSolid(view(), handle), true);
});

test("blockersAt 只返回挡路的那些", () => {
  const { space, entities, view } = setup();
  const wall = entities.create("wall", 1, { x: 1, y: 1 });
  const rug = entities.create("rug", 1, { x: 1, y: 1 });

  space.addOccupant({ x: 1, y: 1 }, wall);
  space.addOccupant({ x: 1, y: 1 }, rug);

  assert.deepEqual(view().space(1).occupantsAt({ x: 1, y: 1 }), [wall, rug]);
  assert.deepEqual(blockersAt(view(), 1, { x: 1, y: 1 }), [wall]);
});

test("视图返回的组件是模板与覆盖合并后的结果", () => {
  const { entities, view } = setup();

  const templates = view().space(1);
  assert.ok(templates);

  const handle = entities.create("wall", 1, { x: 0, y: 0 });

  const merged = view().entity(handle);
  assert.deepEqual(merged.components["core.solid"], {});
  assert.equal(merged.space, 1);
  assert.deepEqual(merged.pos, { x: 0, y: 0 });
});
