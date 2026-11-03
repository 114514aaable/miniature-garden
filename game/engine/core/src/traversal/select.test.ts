// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 选定核心的测试：顺序、排除、上限、条件。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { selectTargets } from "./select.ts";

function makeView(cells: Record<string, number[]>, components: Record<number, Record<string, unknown>>) {
  return {
    occupantsAt: (cell: { x: number; y: number }) => cells[`${cell.x},${cell.y}`] ?? [],
    componentsOf: (handle: number) => (components[handle] ?? {}) as never,
  };
}

const LIVING = { all: [{ component: "core.health" }] } as const;

test("按格子顺序挑出符合条件的", () => {
  const view = makeView(
    { "0,0": [1], "1,0": [2, 3] },
    { 1: { "core.health": { hp: 5 } }, 2: {}, 3: { "core.health": { hp: 1 } } },
  );

  assert.deepEqual(selectTargets(view, [{ x: 0, y: 0 }, { x: 1, y: 0 }], LIVING), [1, 3]);
});

test("排除发起者自己", () => {
  const view = makeView({ "0,0": [7] }, { 7: { "core.health": {} } });
  assert.deepEqual(selectTargets(view, [{ x: 0, y: 0 }], LIVING, { exclude: 7 }), []);
});

test("limit 截断，且不多扫", () => {
  const view = makeView({ "0,0": [1, 2, 3] }, {
    1: { "core.health": {} },
    2: { "core.health": {} },
    3: { "core.health": {} },
  });
  assert.deepEqual(selectTargets(view, [{ x: 0, y: 0 }], LIVING, { limit: 2 }), [1, 2]);
});

test("同一实体在多格重复出现只算一次", () => {
  const view = makeView({ "0,0": [5], "1,0": [5] }, { 5: { "core.health": {} } });
  assert.deepEqual(selectTargets(view, [{ x: 0, y: 0 }, { x: 1, y: 0 }], LIVING), [5]);
});

test("空条件（有组件即可）与字段条件都支持", () => {
  const view = makeView({ "0,0": [1, 2] }, {
    1: { "core.disposition": { value: "hostile" } },
    2: { "core.disposition": { value: "neutral" } },
  });
  const hostile = { all: [{ component: "core.disposition", field: "value", eq: "hostile" }] } as const;
  assert.deepEqual(selectTargets(view, [{ x: 0, y: 0 }], hostile), [1]);
});
