// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 效果：结果里的「我要改世界」的描述（契约 §9）。
 *
 * 效果是数据，不是函数调用——所以它可以被校验、被记录、被丢弃、被父节点合并。
 * 这里负责最后一段：把求值结果里的 effects 解析成 store 认识的 Effect。
 *
 * 规则：
 *   1. 没有 effects 字段 = 这次求值不改世界；
 *   2. effects 必须是数组，最多 256 条；
 *   3. 每条都要形状正确，未知 kind、未知字段一律拒绝。
 *
 * 解析完不提交——提交是调用方的事。求值器不碰 store。
 */

import { type Cell, type SpaceId } from "../space.ts";
import { type Effect, type Store } from "../store.ts";
import { type JsonValue } from "../time.ts";

export const MAX_EFFECTS = 256;

/** 从结果里取出效果；没有就返回空数组。 */
export function collectEffects(value: JsonValue): Effect[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("求值结果必须是对象（才能携带 effects 字段）");
  }

  const raw = (value as Record<string, JsonValue>).effects;
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("effects 必须是数组");
  }
  if (raw.length > MAX_EFFECTS) {
    throw new Error(`effects 最多 ${MAX_EFFECTS} 条，收到 ${raw.length}`);
  }

  return raw.map((item, i) => parseEffect(item, `effects[${i}]`));
}

/** 把效果交给 store。只提交，不推进时间——什么时候 step 由游戏循环决定。 */
export function submitEffects(store: Store, effects: readonly Effect[]): void {
  for (const effect of effects) {
    store.submit(effect);
  }
}

function parseEffect(raw: JsonValue, path: string): Effect {
  const object = asObject(raw, path);
  const kind = object.kind;

  if (kind === "terrain") {
    allowKeys(object, ["kind", "space", "cell", "value"], path);
    return {
      kind: "terrain",
      space: asInt(object.space, `${path}.space`) as SpaceId,
      cell: asCell(object.cell, `${path}.cell`),
      value: asInt(object.value, `${path}.value`),
    };
  }

  if (kind === "place" || kind === "remove") {
    allowKeys(object, ["kind", "space", "cell", "handle"], path);
    return {
      kind,
      space: asInt(object.space, `${path}.space`) as SpaceId,
      cell: asCell(object.cell, `${path}.cell`),
      handle: asInt(object.handle, `${path}.handle`),
    };
  }

  if (kind === "spawn") {
    allowKeys(object, ["kind", "space", "cell", "template", "overrides"], path);
    return {
      kind: "spawn",
      space: asInt(object.space, `${path}.space`) as SpaceId,
      cell: asCell(object.cell, `${path}.cell`),
      template: asStr(object.template, `${path}.template`),
      overrides:
        object.overrides === undefined
          ? undefined
          : asObject(object.overrides, `${path}.overrides`),
    };
  }

  if (kind === "despawn") {
    allowKeys(object, ["kind", "handle"], path);
    return { kind: "despawn", handle: asInt(object.handle, `${path}.handle`) };
  }

  if (kind === "move") {
    allowKeys(object, ["kind", "space", "handle", "to"], path);
    return {
      kind: "move",
      space: asInt(object.space, `${path}.space`) as SpaceId,
      handle: asInt(object.handle, `${path}.handle`),
      to: asCell(object.to, `${path}.to`),
    };
  }

  if (kind === "patch") {
    allowKeys(object, ["kind", "handle", "component", "data"], path);
    if (object.data === undefined) {
      throw new Error(`${path}.data：patch 必须带数据`);
    }
    return {
      kind: "patch",
      handle: asInt(object.handle, `${path}.handle`),
      component: asStr(object.component, `${path}.component`),
      data: object.data,
    };
  }

  throw new Error(`${path}.kind：未知的效果类型 ${JSON.stringify(kind)}`);
}

function asObject(value: JsonValue, path: string): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}：需要对象`);
  }
  return value as Record<string, JsonValue>;
}

function asInt(value: JsonValue | undefined, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${path}：需要整数`);
  }
  return value;
}

function asCell(value: JsonValue | undefined, path: string): Cell {
  const object = asObject(value as JsonValue, path);
  return { x: asInt(object.x, `${path}.x`), y: asInt(object.y, `${path}.y`) };
}

function asStr(value: JsonValue | undefined, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path}：需要非空字符串`);
  }
  return value;
}

function allowKeys(object: Record<string, JsonValue>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key) && !key.startsWith("x-")) {
      throw new Error(`${path}：未知字段 "${key}"`);
    }
  }
}
