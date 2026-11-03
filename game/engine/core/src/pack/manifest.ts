// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 包清单（pack.json）：一个内容包的自述。
 *
 * 三种包，各有各的规矩：
 *   base    定义世界。不能依赖别人，也不能被谁"扩展"。
 *   overlay 给某个世界加内容。必须声明 extends（它扩展谁）。
 *   bridge  把两个以上的世界接起来。requires 至少两个。
 *
 * id 是身份，永远不改。合并时合并的是「内容池」，不是名字。
 *
 * 这个文件只做「解析 + 校验」，不读磁盘——core 不认识文件系统。
 */

import { type JsonValue } from "../time.ts";
import { SchemaError, type Schema, validate } from "../event/schema.ts";

export const PACK_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type PackKind = "base" | "overlay" | "bridge";
export type PackScope = "local" | "shared";

export interface PackFiles {
  readonly spaces?: readonly string[];
  readonly templates?: readonly string[];
  readonly entities?: readonly string[];
  readonly terrains?: readonly string[];
  /** 组件定义：名字 + schema。RPG 的组件在 official.base，别的玩法可以在自己包里定义。 */
  readonly components?: readonly string[];
  /** 预制件：一组实体 + 相对偏移。 */
  readonly groups?: readonly string[];
  /** 命名形状与条件（traversal.json）。 */
  readonly traversal?: readonly string[];
  /** 世界的出生点与规则清单。base 包可以没有。 */
  readonly world?: readonly string[];
  readonly patches?: readonly string[];
}

export interface PackManifest {
  readonly id: string;
  readonly kind: PackKind;
  readonly version: string;
  readonly name?: string;
  readonly description?: string;
  readonly license?: string;
  readonly engine?: string;
  readonly requires?: Readonly<Record<string, string>>;
  readonly provides?: readonly string[];
  /** 排在谁后面 / 前面。只影响顺序，不表示依赖。 */
  readonly loadAfter?: readonly string[];
  readonly loadBefore?: readonly string[];
  readonly extends?: string;
  readonly parent?: string;
  readonly scope?: PackScope;
  readonly tags?: readonly string[];
  readonly files?: PackFiles;
  readonly generator?: { readonly model?: string; readonly seed?: number };
}

const FILE_LIST: Schema = { t: "array", of: { t: "str" }, max: 256 };
const ID_LIST: Schema = { t: "array", of: { t: "str" }, max: 256 };

const MANIFEST_SCHEMA: Schema = {
  t: "object",
  fields: {
    id: { t: "str" },
    kind: { t: "enum", values: ["base", "overlay", "bridge"] },
    version: { t: "str" },
    name: { t: "str" },
    description: { t: "str" },
    license: { t: "str" },
    engine: { t: "str" },
    requires: { t: "record", of: { t: "str" } },
    provides: ID_LIST,
    loadAfter: ID_LIST,
    loadBefore: ID_LIST,
    extends: { t: "str" },
    parent: { t: "str" },
    scope: { t: "enum", values: ["local", "shared"] },
    tags: ID_LIST,
    files: {
      t: "object",
      fields: {
        spaces: FILE_LIST,
        templates: FILE_LIST,
        entities: FILE_LIST,
        terrains: FILE_LIST,
        components: FILE_LIST,
        groups: FILE_LIST,
        traversal: FILE_LIST,
        world: FILE_LIST,
        patches: FILE_LIST,
      },
      optional: ["spaces", "templates", "entities", "terrains", "components", "groups", "traversal", "world", "patches"],
    },
    generator: {
      t: "object",
      fields: { model: { t: "str" }, seed: { t: "int" } },
    },
  },
  optional: [
    "name",
    "description",
    "license",
    "engine",
    "requires",
    "provides",
    "loadAfter",
    "loadBefore",
    "extends",
    "parent",
    "scope",
    "tags",
    "files",
    "generator",
  ],
};

/** 解析并校验一份 pack.json。错误带路径，且是给人看的。 */
export function parseManifest(raw: unknown): PackManifest {
  validate(raw, MANIFEST_SCHEMA, "$pack");
  const manifest = raw as PackManifest;

  if (!PACK_ID_PATTERN.test(manifest.id)) {
    throw new SchemaError("$.id", `包 id 非法："${manifest.id}"，应形如 "official.grey-harbor"`);
  }
  if (!VERSION_PATTERN.test(manifest.version)) {
    throw new SchemaError("$.version", `版本必须是 x.y.z，收到 "${manifest.version}"`);
  }

  for (const [depId, range] of Object.entries(manifest.requires ?? {})) {
    if (!PACK_ID_PATTERN.test(depId)) {
      throw new SchemaError(`$.requires.${depId}`, "依赖的包 id 非法");
    }
    if (range.trim().length === 0) {
      throw new SchemaError(`$.requires.${depId}`, "版本范围不能为空");
    }
  }

  for (const provided of manifest.provides ?? []) {
    if (!PACK_ID_PATTERN.test(provided)) {
      throw new SchemaError("$.provides", `别名 id 非法："${provided}"`);
    }
  }

  for (const [group, paths] of Object.entries(manifest.files ?? {})) {
    for (const path of paths ?? []) {
      checkRelativePath(path, `$.files.${group}`);
    }
  }

  checkKindRules(manifest);
  return manifest;
}

/** 三种包各自的硬规则。违反就拒绝加载，不做「尽量兼容」。 */
function checkKindRules(manifest: PackManifest): void {
  if (manifest.kind === "base") {
    if (manifest.extends !== undefined) {
      throw new SchemaError("$.extends", "base 包不能扩展别人");
    }
    if (manifest.requires !== undefined && Object.keys(manifest.requires).length > 0) {
      throw new SchemaError("$.requires", "base 包不能依赖别的包");
    }
  }

  if (manifest.kind === "overlay") {
    if (manifest.extends === undefined) {
      throw new SchemaError("$.extends", "overlay 必须声明它扩展哪个世界");
    }
  }

  if (manifest.kind === "bridge") {
    const count = Object.keys(manifest.requires ?? {}).length;
    if (count < 2) {
      throw new SchemaError("$.requires", `bridge 至少要连接两个包，收到 ${count} 个`);
    }
  }
}

/** 包内路径必须是相对的，且不能跳出包的根目录。 */
function checkRelativePath(path: string, at: string): void {
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    throw new SchemaError(at, `必须是相对路径："${path}"`);
  }
  if (path.split(/[\\/]/).includes("..")) {
    throw new SchemaError(at, `路径不能跳出包目录："${path}"`);
  }
}

/** 给外部用的类型守卫：这份 JSON 是不是一个合法的包清单。 */
export function isManifest(raw: JsonValue): boolean {
  try {
    parseManifest(raw);
    return true;
  } catch {
    return false;
  }
}
