// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 世界内容的定义格式：空间、模板、实体、世界。
 *
 * 这四种东西都是数据，写在包的 JSON 文件里。加载器只认这四种 kind，
 * 但它们长什么样由这里说了算——别处不许「顺手加个字段」。
 *
 * 特别说一句「地形」：
 *   以前规则里写死 WALL = 1，那是把语义钉在数字上。
 *   现在由世界自己声明每种地形的含义（能不能走、叫什么），规则查表。
 *   这样加一种新地形不需要改代码，也不会出现「2 号地形到底能不能过」的争论。
 */

import { type JsonValue } from "../time.ts";
import { SchemaError, type Schema, validate } from "../event/schema.ts";

const ID = /^[a-z][a-z0-9_-]{1,47}$/;
const COMPONENT_ID = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

/** 地形：一个数字 + 它的含义。 */
export interface TerrainDef {
  readonly id: number;
  readonly name: string;
  /** 能不能走上去。规则查这个，不查数字。 */
  readonly passable: boolean;
}

export interface SpaceDef {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** 一格代表多少世界单位；纯元数据。 */
  readonly cellSize: number;
  /** 地形表，长度必须等于 width * height，下标 = y * width + x。 */
  readonly terrain: readonly number[];
}

export interface TemplateDef {
  readonly id: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}

export interface EntityDef {
  readonly template: string;
  readonly space: string;
  readonly x: number;
  readonly y: number;
  readonly overrides?: Readonly<Record<string, JsonValue>>;
}

export interface WorldDef {
  readonly start: { readonly space: string; readonly x: number; readonly y: number };
  readonly terrains: readonly TerrainDef[];
}

const INT: Schema = { t: "int" };
const STR: Schema = { t: "str" };

const SPACE_SCHEMA: Schema = {
  t: "object",
  fields: {
    id: STR,
    width: INT,
    height: INT,
    cellSize: { t: "num" },
    terrain: { t: "array", of: INT, max: 262144 },
  },
  optional: ["cellSize"],
};

const TEMPLATE_SCHEMA: Schema = {
  t: "object",
  fields: {
    id: STR,
    components: { t: "record", of: { t: "any" } },
  },
};

const ENTITY_SCHEMA: Schema = {
  t: "object",
  fields: { template: STR, space: STR, x: INT, y: INT, overrides: { t: "record", of: { t: "any" } } },
  optional: ["overrides"],
};

const WORLD_SCHEMA: Schema = {
  t: "object",
  fields: {
    start: { t: "object", fields: { space: STR, x: INT, y: INT } },
    terrains: {
      t: "array",
      of: {
        t: "object",
        fields: { id: INT, name: STR, passable: { t: "bool" } },
      },
      max: 256,
    },
  },
};

export function parseSpaceDef(raw: unknown, path = "$space"): SpaceDef {
  validate(raw, SPACE_SCHEMA, path);
  const def = raw as SpaceDef;

  if (!ID.test(def.id)) {
    throw new SchemaError(`${path}.id`, `空间 id 非法："${def.id}"`);
  }
  if (def.width < 1 || def.height < 1 || def.width > 1024 || def.height > 1024) {
    throw new SchemaError(`${path}`, `空间尺寸必须在 1..1024，收到 ${def.width}x${def.height}`);
  }
  if (def.terrain.length !== def.width * def.height) {
    throw new SchemaError(
      `${path}.terrain`,
      `地形数量必须等于 ${def.width}×${def.height}=${def.width * def.height}，收到 ${def.terrain.length}`,
    );
  }
  return { ...def, cellSize: def.cellSize ?? 1 };
}

export function parseTemplateDef(raw: unknown, path = "$template"): TemplateDef {
  validate(raw, TEMPLATE_SCHEMA, path);
  const def = raw as TemplateDef;

  if (!ID.test(def.id)) {
    throw new SchemaError(`${path}.id`, `模板 id 非法："${def.id}"`);
  }
  for (const component of Object.keys(def.components)) {
    if (!COMPONENT_ID.test(component)) {
      throw new SchemaError(`${path}.components.${component}`, "组件名非法，应形如 core.health");
    }
  }
  return def;
}

export function parseEntityDef(raw: unknown, path = "$entity"): EntityDef {
  validate(raw, ENTITY_SCHEMA, path);
  return raw as EntityDef;
}

export function parseWorldDef(raw: unknown, path = "$world"): WorldDef {
  validate(raw, WORLD_SCHEMA, path);
  const def = raw as WorldDef;

  const seen = new Set<number>();
  for (const terrain of def.terrains) {
    if (terrain.id < 0) {
      throw new SchemaError(`${path}.terrains`, `地形 id 必须非负，收到 ${terrain.id}`);
    }
    if (seen.has(terrain.id)) {
      throw new SchemaError(`${path}.terrains`, `地形 id 重复：${terrain.id}`);
    }
    seen.add(terrain.id);
  }
  return def;
}

/** 地形是否可走。规则层用这个，不直接比数字。 */
export function isPassable(world: WorldDef, terrain: number): boolean {
  const def = world.terrains.find((item) => item.id === terrain);
  if (def === undefined) {
    throw new Error(`世界没有声明地形 ${terrain} 的含义`);
  }
  return def.passable;
}
