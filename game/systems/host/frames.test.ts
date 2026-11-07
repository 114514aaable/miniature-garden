// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 帧：投影抓取 + 前后 diff。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { captureEntities, diffEntities, type ProjectionSource } from "./frames.ts";
import type { Projector } from "../render/project.ts";

/** 用一组可控实体冒充投影器。 */
function fakeProjector(entities: Array<{ handle: number; x: number }>): Projector {
  return {
    snapshot: () => ({
      tick: 0,
      spaces: [],
      entities: entities.map((entity) => ({ ...entity })),
      player: null,
    }),
  } as unknown as Projector;
}

const SOURCE = { spaces: [], templates: {}, entities: [] } as unknown as ProjectionSource;

test("抓投影：按 handle 建表", () => {
  const projector = fakeProjector([{ handle: 1, x: 2 }, { handle: 5, x: 3 }]);
  const map = captureEntities(projector, SOURCE, 0);
  assert.equal(map.size, 2);
  assert.deepEqual(map.get(1), { handle: 1, x: 2 });
});

test("diff：变了的整条发，没变的不发", () => {
  const before = new Map<number, unknown>([[1, { handle: 1, x: 2 }], [2, { handle: 2, x: 9 }]]);
  const projector = fakeProjector([{ handle: 1, x: 3 }, { handle: 2, x: 9 }]);

  const frame = diffEntities(projector, SOURCE, before, 4, []);
  assert.equal(frame.tick, 4);
  assert.deepEqual(frame.entities, [{ handle: 1, x: 3 }]);
  assert.deepEqual(frame.removed, []);
});

test("diff：消失的只发 handle", () => {
  const before = new Map<number, unknown>([[1, { handle: 1, x: 2 }]]);
  const projector = fakeProjector([]);
  const frame = diffEntities(projector, SOURCE, before, 1, []);
  assert.deepEqual(frame.removed, [1]);
});

test("diff：事件压成一行", () => {
  const projector = fakeProjector([]);
  const frame = diffEntities(projector, SOURCE, new Map(), 2, [{ id: 9, kind: "patch", data: { a: 1 } }]);
  assert.deepEqual(frame.events, ['#9 patch {"a":1}']);
});
