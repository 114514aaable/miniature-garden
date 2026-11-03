// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 命名形状与命名条件：把 base 的 traversal.json 变成可用的东西。
 *
 * 分工：
 *   算子（circle/rotate…）    代码，在 offsets.ts / transform.ts
 *   形状（touch/around1…）    数据，在 base 的 traversal.json
 *   条件（living/talkable…）  数据，同上
 *
 * 所以「加一种形状」= 改 json，不用改代码。
 */

import { type JsonValue } from "../time.ts";
import { componentsOf, matches, type Condition } from "./filter.ts";
import { baseOffsets, dedupe, type BaseShape, type Offset } from "./offsets.ts";
import { keep, mirror, rotate90, translate } from "./transform.ts";

/** 形状声明：基础算子 + 一串变换。 */
export interface ShapeSpec {
  readonly base: BaseShape;
  readonly range?: number;
  readonly height?: number;
  /** 只要前方半圆的偏移（dy < 0 之类），用 keep 表达。 */
  readonly keep?: "front" | "back" | "left" | "right";
  readonly then?: ReadonlyArray<
    | { readonly op: "rotate90"; readonly turns: number }
    | { readonly op: "mirror"; readonly axis: "x" | "y" | "both" }
    | { readonly op: "translate"; readonly dx: number; readonly dy: number }
  >;
}

export interface TraversalSpec {
  readonly shapes: Readonly<Record<string, ShapeSpec>>;
  readonly filters: Readonly<Record<string, Condition>>;
}

const BASE_SHAPES = new Set(["circle", "diamond", "cross", "rect"]);

/** 解析并校验 traversal.json。 */
export function parseTraversal(raw: JsonValue, path = "$traversal"): TraversalSpec {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path} 必须是对象`);
  }
  const data = raw as Record<string, JsonValue>;

  const shapes: Record<string, ShapeSpec> = {};
  const rawShapes = data.shapes;
  if (rawShapes !== undefined) {
    if (typeof rawShapes !== "object" || rawShapes === null || Array.isArray(rawShapes)) {
      throw new Error(`${path}.shapes 必须是对象`);
    }
    for (const [name, spec] of Object.entries(rawShapes as Record<string, JsonValue>)) {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        throw new Error(`${path}.shapes.${name} 必须是对象`);
      }
      const shape = spec as Record<string, JsonValue>;
      const base = shape.base;
      if (typeof base !== "string" || !BASE_SHAPES.has(base)) {
        throw new Error(`${path}.shapes.${name}.base 不认识：${String(base)}`);
      }
      shapes[name] = {
        base: base as BaseShape,
        ...(typeof shape.range === "number" ? { range: shape.range } : {}),
        ...(typeof shape.height === "number" ? { height: shape.height } : {}),
        ...(shape.keep === "front" || shape.keep === "back" || shape.keep === "left" || shape.keep === "right"
          ? { keep: shape.keep }
          : {}),
        ...(Array.isArray(shape.then) ? { then: shape.then as never } : {}),
      };
    }
  }

  const filters: Record<string, Condition> = {};
  const rawFilters = data.filters;
  if (rawFilters !== undefined) {
    if (typeof rawFilters !== "object" || rawFilters === null || Array.isArray(rawFilters)) {
      throw new Error(`${path}.filters 必须是对象`);
    }
    for (const [name, condition] of Object.entries(rawFilters as Record<string, JsonValue>)) {
      filters[name] = condition as Condition;
    }
  }

  return { shapes, filters };
}

/** 形状名 → 偏移。未知形状直接报错，不静默返回空。 */
export function offsetsOf(spec: TraversalSpec, name: string): Offset[] {
  const shape = spec.shapes[name];
  if (shape === undefined) {
    throw new Error(`没有这个形状：${name}`);
  }

  const range = shape.range ?? 1;
  let offsets = baseOffsets(shape.base, range, shape.height ?? range);

  if (shape.keep !== undefined) {
    const predicate = {
      front: (o: Offset) => o.dy < 0,
      back: (o: Offset) => o.dy > 0,
      left: (o: Offset) => o.dx < 0,
      right: (o: Offset) => o.dx > 0,
    }[shape.keep];
    offsets = keep(offsets, predicate);
  }

  for (const step of shape.then ?? []) {
    if (step.op === "rotate90") offsets = rotate90(offsets, step.turns);
    else if (step.op === "mirror") offsets = mirror(offsets, step.axis);
    else if (step.op === "translate") offsets = translate(offsets, step.dx, step.dy);
  }

  return dedupe(offsets);
}

/** 条件名 → 条件。未知条件直接报错。 */
export function conditionOf(spec: TraversalSpec, name: string): Condition {
  const condition = spec.filters[name];
  if (condition === undefined) {
    throw new Error(`没有这个条件：${name}`);
  }
  return condition;
}

/** 加载期校验：条件里引用的组件必须真的存在。 */
export function unknownComponents(spec: TraversalSpec, known: ReadonlySet<string>): string[] {
  const missing = new Set<string>();
  for (const condition of Object.values(spec.filters)) {
    for (const component of componentsOf(condition)) {
      if (!known.has(component)) missing.add(component);
    }
  }
  return [...missing].sort();
}

/** 一个实体是否满足命名条件。 */
export function matchesNamed(
  spec: TraversalSpec,
  name: string,
  components: Readonly<Record<string, JsonValue>>,
): boolean {
  return matches(conditionOf(spec, name), components);
}
