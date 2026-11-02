// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 渲染契约与投影的测试。
 *
 * 不需要浏览器：契约校验、启动握手、快照投影全是纯函数。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityTable } from "../../engine/core/src/entity/entity.ts";
import { TemplateRegistry } from "../../engine/core/src/entity/template.ts";
import { Space } from "../../engine/core/src/space.ts";
import { type RenderContract, validateContract } from "./contract.ts";
import { createProjector, type RenderSource } from "./project.ts";

const HEALTH = {
  t: "object",
  fields: { max: { t: "int" }, hp: { t: "int" } },
  optional: ["hp"],
} as const;

function contract(overrides: Partial<RenderContract["needs"]> = {}): RenderContract {
  return {
    id: "render.test",
    version: "0.1.0",
    needs: {
      spaces: "current",
      camera: true,
      entityFields: ["pos", "template"],
      components: [{ name: "core.health", required: true }],
      ui: ["inventory"],
      ...overrides,
    },
  };
}

function world() {
  const space = new Space(1, 3, 3);
  space.setTerrain({ x: 1, y: 1 }, 2);

  const templates = new TemplateRegistry();
  templates.defineComponent("core.health", HEALTH);
  templates.defineTemplate({ id: "pc", components: { "core.health": { max: 20, hp: 20 } } });

  const entities = new EntityTable();
  const handle = entities.create("pc", 1, { x: 1, y: 1 }, { "core.health": { hp: 7 } });
  space.addOccupant({ x: 1, y: 1 }, handle);

  const source: RenderSource = { tick: 3, spaces: [space], templates, entities: entities.all() };
  return { space, templates, entities, source, handle };
}

test("契约必须声明 pos", () => {
  assert.throws(
    () => validateContract(contract({ entityFields: ["template"] })),
    /必须声明 entityFields 里的 "pos"/,
  );
});

test("契约的组件 / UI 数量有上限", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ name: `core.c${i}`, required: false }));
  assert.throws(() => validateContract(contract({ components: many })), /最多 8 个/);
});

test("必需组件缺失：启动就报错", () => {
  const { templates } = world();
  assert.throws(
    () => createProjector(contract({ components: [{ name: "core.mana", required: true }] }), templates),
    /需要组件 core\.mana/,
  );
});

test("可选组件缺失：只记警告", () => {
  const { templates } = world();
  const projector = createProjector(
    contract({ components: [{ name: "core.mana", required: false }] }),
    templates,
  );
  assert.equal(projector.warnings.length, 1);
  assert.match(projector.warnings[0], /core\.mana/);
});

test("快照只带契约点名的组件，并且是副本", () => {
  const { templates, source, space } = world();
  const projector = createProjector(contract(), templates);
  const snapshot = projector.snapshot(source);

  assert.equal(snapshot.entities.length, 1);
  assert.deepEqual(snapshot.entities[0].components["core.health"], { max: 20, hp: 7 });

  // 改快照不影响世界
  (snapshot.entities[0].components["core.health"] as { hp: number }).hp = 1;
  assert.equal(source.entities[0].overrides["core.health"]?.["hp" as never], 7);

  // 改世界也不影响已拍的照片
  space.setTerrain({ x: 0, y: 0 }, 9);
  assert.equal(snapshot.spaces[0].terrain[0], 0);
});

test("spaces: current 只拍第一张地图", () => {
  const { templates, source } = world();
  const second = new Space(2, 2, 2);
  const projector = createProjector(contract(), templates);

  const snapshot = projector.snapshot({ ...source, spaces: [source.spaces[0], second] });
  assert.equal(snapshot.spaces.length, 1);
  assert.equal(snapshot.spaces[0].id, 1);
});

test("实体字段按契约裁剪", () => {
  const { templates, source } = world();
  const projector = createProjector(
    contract({ entityFields: ["pos"], components: [] }),
    templates,
  );
  const snapshot = projector.snapshot(source);

  assert.equal(snapshot.entities[0].template, undefined);
  assert.deepEqual(snapshot.entities[0].components, {});
  assert.equal(snapshot.entities[0].x, 1);
});
