// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 极小类型语言：校验数据包里的参数和返回值。
 *
 * 为什么不用 JSON Schema：
 *   - 规范本身太大，实现一遍要好几天；
 *   - 我们只需要「够校验」，不需要 $ref / 组合器 / 注解那一套。
 *
 * 设计原则：
 *   1. 未知字段默认拒绝（防止打错字悄悄失效）；
 *   2. 私有扩展必须放在 "x-" 开头的字段里；
 *   3. 错误信息必须带路径（`$.targets[0]`），否则调试等于盲猜。
 *
 * 这个文件不认识世界、不认识时间，只认识「值」和「形状」。
 */

export type Schema =
  | { readonly t: "int" }
  | { readonly t: "num" }
  | { readonly t: "str" }
  | { readonly t: "bool" }
  | { readonly t: "null" }
  | { readonly t: "enum"; readonly values: readonly (string | number)[] }
  | { readonly t: "array"; readonly of: Schema; readonly max?: number }
  | {
      readonly t: "object";
      readonly fields: Readonly<Record<string, Schema>>;
      readonly optional?: readonly string[];
    }
  /** 键名不固定的映射，比如「依赖包 id → 版本范围」。 */
  | { readonly t: "record"; readonly of: Schema; readonly max?: number }
  | { readonly t: "any" };

/** 嵌套深度上限。超过就当它不是数据，是炸弹。 */
export const MAX_DEPTH = 16;

/** 数组默认上限。 */
export const MAX_ARRAY = 256;

/** 校验失败。带上路径，让人知道是哪一个字段。 */
export class SchemaError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}：${message}`);
    this.name = "SchemaError";
    this.path = path;
  }
}

/** 校验一个值。通过就返回，不通过就抛 SchemaError。 */
export function validate(value: unknown, schema: Schema, path = "$"): void {
  walk(value, schema, path, 0);
}

function walk(value: unknown, schema: Schema, path: string, depth: number): void {
  if (depth > MAX_DEPTH) {
    throw new SchemaError(path, `嵌套超过 ${MAX_DEPTH} 层`);
  }

  switch (schema.t) {
    case "any":
      assertJsonValue(value, path, depth);
      return;

    case "int":
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw new SchemaError(path, `需要安全整数，收到 ${show(value)}`);
      }
      return;

    case "num":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new SchemaError(path, `需要有限数字，收到 ${show(value)}`);
      }
      return;

    case "str":
      if (typeof value !== "string") {
        throw new SchemaError(path, `需要字符串，收到 ${show(value)}`);
      }
      return;

    case "bool":
      if (typeof value !== "boolean") {
        throw new SchemaError(path, `需要布尔值，收到 ${show(value)}`);
      }
      return;

    case "null":
      if (value !== null) {
        throw new SchemaError(path, `需要 null，收到 ${show(value)}`);
      }
      return;

    case "enum":
      if (!schema.values.includes(value as string | number)) {
        throw new SchemaError(
          path,
          `需要 ${schema.values.map((v) => JSON.stringify(v)).join(" | ")}，收到 ${show(value)}`,
        );
      }
      return;

    case "array": {
      if (!Array.isArray(value)) {
        throw new SchemaError(path, `需要数组，收到 ${show(value)}`);
      }
      const max = schema.max ?? MAX_ARRAY;
      if (value.length > max) {
        throw new SchemaError(path, `数组最多 ${max} 项，收到 ${value.length}`);
      }
      value.forEach((item, i) => walk(item, schema.of, `${path}[${i}]`, depth + 1));
      return;
    }

    case "record": {
      if (!isPlainObject(value)) {
        throw new SchemaError(path, `需要对象，收到 ${show(value)}`);
      }
      const entries = Object.entries(value);
      const max = schema.max ?? MAX_ARRAY;
      if (entries.length > max) {
        throw new SchemaError(path, `最多 ${max} 个键，收到 ${entries.length}`);
      }
      for (const [key, item] of entries) {
        walk(item, schema.of, `${path}.${key}`, depth + 1);
      }
      return;
    }

    case "object": {
      if (!isPlainObject(value)) {
        throw new SchemaError(path, `需要对象，收到 ${show(value)}`);
      }
      const optional = new Set(schema.optional ?? []);
      for (const [key, fieldSchema] of Object.entries(schema.fields)) {
        if (!(key in value)) {
          if (!optional.has(key)) {
            throw new SchemaError(path, `缺少字段 "${key}"`);
          }
          continue;
        }
        walk(value[key], fieldSchema, `${path}.${key}`, depth + 1);
      }
      for (const key of Object.keys(value)) {
        if (key in schema.fields || key.startsWith("x-")) {
          continue;
        }
        throw new SchemaError(path, `未知字段 "${key}"（私有字段请用 x- 前缀）`);
      }
      return;
    }
  }
}

/** 递归确认它是 JSON 能表达的东西：没有函数、没有 undefined、没有 NaN。 */
function assertJsonValue(value: unknown, path: string, depth: number): void {
  if (depth > MAX_DEPTH) {
    throw new SchemaError(path, `嵌套超过 ${MAX_DEPTH} 层`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SchemaError(path, `不是有限数字：${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      throw new SchemaError(path, `数组最多 ${MAX_ARRAY} 项，收到 ${value.length}`);
    }
    value.forEach((item, i) => assertJsonValue(item, `${path}[${i}]`, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new SchemaError(path, `不是 JSON 值：${show(value)}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把值压成一句人话，用于报错。 */
function show(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `数组(${value.length})`;
  }
  if (value === undefined) {
    return "undefined";
  }
  return typeof value === "object" ? "对象" : typeof value;
}
