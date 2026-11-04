// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 世界内容的定义格式：空间、模板、实体、地形、世界。
 *
 * 这几种东西都是数据，写在包的 JSON 文件里。加载器只认这些 kind，
 * 它们长什么样由这里说了算——别处不许「顺手加个字段」。
 *
 * 地形为什么是独立定义而不是 world 的一部分：
 *   预设包（official.base）要提供标准地形，世界只能在此基础上加。
 *   放在 world 里，预设包就没法贡献任何地形了。
 */

import { type JsonValue } from "../time.ts";
import { SchemaError, type Schema, validate } from "../event/schema.ts";

const ID = /^[a-z][a-z0-9_-]{1,47}$/;
const COMPONENT_ID = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

export type ConflictPolicy = "error" | "warn" | "override";

/** 地形：一个数字 + 它的含义。数据集里的 id 就是地形号（字符串形式）。 */
export interface TerrainDef {
  readonly id: number;
  readonly name: string;
  /** 能不能走上去。规则查这个，不查数字。 */
  readonly passable: boolean;
  /** 稳定的英文代号：给生成器/脚本用，不受语言影响。 */
  readonly code?: string;
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
  /** 这个世界启用哪些规则（标签）。包负责选，引擎负责实现。 */
  readonly rules?: readonly string[];
  /**
   * 开局一次性执行的效果（同 store 的 Effect 形状）。
   *
   * 这是「开局初始化」的空壳：以后放开局物品、初始状态、一次性事件。
   * 语义就是「在世界创建后，立刻按顺序调一遍」。
   */
  readonly init?: readonly JsonValue[];
  /**
   * 存在感策略：离得远的实体怎么处理。
   * 现在只用到「别的空间不模拟」；半径与扫描间隔是给下一版留的。
   */
  /** 生成参数（离线工具读，运行时不用）。 */
  readonly generation?: JsonValue;
  /** 开始游戏时要问的选项（由包声明，界面负责画）。 */
  readonly startMenu?: JsonValue;
  readonly persistence?: {
    readonly activeRadius?: number;
    readonly sweepEvery?: number;
  };
  /** 冲突策略，默认 error。 */
  readonly onConflict?: ConflictPolicy;
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
  fields: { id: STR, components: { t: "record", of: { t: "any" } } },
};

const ENTITY_SCHEMA: Schema = {
  t: "object",
  fields: { template: STR, space: STR, x: INT, y: INT, overrides: { t: "record", of: { t: "any" } } },
  optional: ["overrides"],
};

const TERRAIN_SCHEMA: Schema = {
  t: "object",
  fields: { name: STR, passable: { t: "bool" }, code: STR },
  optional: ["code"],
};

/** 预制件：一组实体 + 相对偏移。 */
export interface GroupDef {
  readonly id: string;
  readonly entities: ReadonlyArray<{
    readonly template: string;
    readonly dx: number;
    readonly dy: number;
    readonly overrides?: Readonly<Record<string, JsonValue>>;
  }>;
}

const GROUP_SCHEMA: Schema = {
  t: "object",
  fields: {
    entities: {
      t: "array",
      of: {
        t: "object",
        fields: {
          template: STR,
          dx: INT,
          dy: INT,
          overrides: { t: "record", of: { t: "any" } },
        },
        optional: ["overrides"],
      },
      max: 64,
    },
  },
};

/** 群系：气候区间 → 地形调色板 + 允许的结构。 */
export interface BiomeDef {
  readonly id: string;
  readonly ranges: Readonly<Record<string, readonly [number, number]>>;
  readonly terrain: Readonly<Record<string, string>>;
  readonly structures?: readonly string[];
  readonly tags?: readonly string[];
  readonly color?: string;
}

const BIOME_SCHEMA: Schema = {
  t: "object",
  fields: {
    ranges: { t: "record", of: { t: "any" } },
    terrain: { t: "record", of: { t: "str" } },
    structures: { t: "array", of: { t: "str" }, max: 64 },
    tags: { t: "array", of: { t: "str" }, max: 32 },
    color: { t: "str" },
  },
  optional: ["structures", "tags", "color"],
};

const WORLD_SCHEMA: Schema = {
  t: "object",
  fields: {
    start: { t: "object", fields: { space: STR, x: INT, y: INT } },
    rules: { t: "array", of: STR, max: 64 },
    init: { t: "array", of: { t: "any" }, max: 64 },
    generation: { t: "any" },
    startMenu: { t: "any" },
    persistence: {
      t: "object",
      fields: { activeRadius: INT, sweepEvery: INT },
      optional: ["activeRadius", "sweepEvery"],
    },
    onConflict: { t: "enum", values: ["error", "warn", "override"] },
  },
  optional: ["rules", "init", "generation", "startMenu", "persistence", "onConflict"],
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

/** 地形的数字号来自定义键（"0" / "1"），数据里只写含义。 */
export function parseTerrainDef(raw: unknown, idKey: string, path = "$terrain"): TerrainDef {
  validate(raw, TERRAIN_SCHEMA, path);

  if (!/^\d+$/.test(idKey)) {
    throw new SchemaError(`${path}.id`, `地形号必须是非负整数，收到 "${idKey}"`);
  }
  const id = Number(idKey);
  if (!Number.isSafeInteger(id)) {
    throw new SchemaError(`${path}.id`, `地形号太大：${idKey}`);
  }
  if (String(id) !== idKey) {
    throw new SchemaError(`${path}.id`, `地形号不能有前导零："${idKey}"`);
  }

  const def = raw as { name: string; passable: boolean; code?: string };
  return { id, name: def.name, passable: def.passable, ...(def.code === undefined ? {} : { code: def.code }) };
}

export function parseGroupDef(raw: unknown, idKey: string, path = "$group"): GroupDef {
  if (!ID.test(idKey)) {
    throw new SchemaError(`${path}.id`, `预制件 id 非法：${idKey}`);
  }
  validate(raw, GROUP_SCHEMA, path);
  const def = raw as { entities: GroupDef["entities"] };
  return { id: idKey, entities: def.entities };
}

export function parseBiomeDef(raw: unknown, idKey: string, path = "$biome"): BiomeDef {
  if (!ID.test(idKey)) {
    throw new SchemaError(`${path}.id`, `群系 id 非法：${idKey}`);
  }
  validate(raw, BIOME_SCHEMA, path);

  const data = raw as { ranges: Record<string, unknown>; terrain: Record<string, string>; structures?: string[]; tags?: string[]; color?: string };
  const ranges: Record<string, [number, number]> = {};
  for (const [field, value] of Object.entries(data.ranges ?? {})) {
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number" || typeof value[1] !== "number") {
      throw new SchemaError(`${path}.ranges.${field}`, "区间必须是 [min, max] 两个数字");
    }
    if (value[0] > value[1]) {
      throw new SchemaError(`${path}.ranges.${field}`, `区间反了：${value[0]} > ${value[1]}`);
    }
    ranges[field] = [value[0], value[1]];
  }

  return {
    id: idKey,
    ranges,
    terrain: data.terrain ?? {},
    ...(data.structures === undefined ? {} : { structures: data.structures }),
    ...(data.tags === undefined ? {} : { tags: data.tags }),
    ...(data.color === undefined ? {} : { color: data.color }),
  };
}

export function parseWorldDef(raw: unknown, path = "$world"): WorldDef {
  validate(raw, WORLD_SCHEMA, path);
  return raw as WorldDef;
}

/**
 * 组件定义：名字 + 它的 schema。
 *
 * 组件是「包定义的数据」，不是引擎原语——所以 RPG 的血条、
 * 赛博的义体、修真的丹田，各在各的包里，内核一个都不认识。
 *
 * 代价：规则只能按组件 id 读写，不能 import 组件类型。
 */
export interface ComponentDef {
  readonly name: string;
  readonly schema: Schema;
}

export function parseComponentDef(raw: unknown, idKey: string, path = "$component"): ComponentDef {
  if (!COMPONENT_ID.test(idKey)) {
    throw new SchemaError(`${path}.id`, `组件名非法："${idKey}"，应形如 "core.health"`);
  }
  const object = raw as { schema?: unknown };
  if (typeof object !== "object" || object === null || Array.isArray(object)) {
    throw new SchemaError(path, "需要对象");
  }
  return { name: idKey, schema: parseSchemaValue(object.schema, `${path}.schema`) };
}

/**
 * 校验一个 schema 是不是合法的 Schema。
 *
 * 注意：这不能用我们自己的 schema 语言写——Schema 是递归类型，
 * 而我们的类型语言没有递归。所以手写一遍，反而最直接。
 */
export function parseSchemaValue(raw: unknown, path = "$schema"): Schema {
  return parseSchemaAt(raw, path, 0);
}

function parseSchemaAt(raw: unknown, path: string, depth: number): Schema {
  if (depth > 8) {
    throw new SchemaError(path, "schema 嵌套太深（上限 8 层）");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SchemaError(path, "schema 必须是对象");
  }

  const node = raw as Record<string, unknown>;
  const t = node.t;
  switch (t) {
    case "int":
    case "num":
    case "str":
    case "bool":
    case "null":
    case "any":
      return { t };
    case "enum": {
      if (!Array.isArray(node.values) || node.values.length === 0) {
        throw new SchemaError(`${path}.values`, "enum 需要非空的 values");
      }
      for (const value of node.values) {
        if (typeof value !== "string" && typeof value !== "number") {
          throw new SchemaError(`${path}.values`, "enum 的取值只能是字符串或数字");
        }
      }
      return { t: "enum", values: node.values as (string | number)[] };
    }
    case "array": {
      const max = optionalInt(node.max, `${path}.max`);
      return { t: "array", of: parseSchemaAt(node.of, `${path}.of`, depth + 1), ...(max === undefined ? {} : { max }) };
    }
    case "record": {
      const max = optionalInt(node.max, `${path}.max`);
      return { t: "record", of: parseSchemaAt(node.of, `${path}.of`, depth + 1), ...(max === undefined ? {} : { max }) };
    }
    case "object": {
      if (typeof node.fields !== "object" || node.fields === null || Array.isArray(node.fields)) {
        throw new SchemaError(`${path}.fields`, "object 需要 fields 对象");
      }
      const fields: Record<string, Schema> = {};
      for (const [key, value] of Object.entries(node.fields as Record<string, unknown>)) {
        fields[key] = parseSchemaAt(value, `${path}.fields.${key}`, depth + 1);
      }
      if (node.optional !== undefined) {
        if (!Array.isArray(node.optional) || node.optional.some((item) => typeof item !== "string")) {
          throw new SchemaError(`${path}.optional`, "optional 必须是字符串数组");
        }
        return { t: "object", fields, optional: node.optional as string[] };
      }
      return { t: "object", fields };
    }
    default:
      throw new SchemaError(`${path}.t`, `未知的 schema 类型：${JSON.stringify(t)}`);
  }
}

function optionalInt(raw: unknown, path: string): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 1) {
    throw new SchemaError(path, "需要正整数");
  }
  return raw;
}

/** 地形是否可走。规则层用这个，不直接比数字。 */
export function isPassable(terrains: ReadonlyMap<number, TerrainDef>, terrain: number): boolean {
  const def = terrains.get(terrain);
  if (def === undefined) {
    throw new Error(`世界没有声明地形 ${terrain} 的含义`);
  }
  return def.passable;
}
