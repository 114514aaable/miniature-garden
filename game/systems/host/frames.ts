// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 帧：把「这一 tick 的投影实体」和「上一 tick」做 diff。
 *
 * 帧不是手挑字段的增量，而是**投影记录 diff**：
 * 变了的实体整条发、消失的只发 handle。以后实体新增字段会自动进帧。
 */

import type { Projector, RenderSource } from "../render/project.ts";

/** 一帧：变了哪些实体、消失了谁、这一 tick 的事件。 */
export interface Frame {
  readonly tick: number;
  readonly entities: readonly unknown[];
  readonly removed: readonly number[];
  readonly events: readonly string[];
}

/** 一条事件（timeline 里的一条）。 */
export interface FrameEvent {
  readonly id: number;
  readonly kind: string;
  readonly data: unknown;
}

/** 投影需要的三样东西（不含 tick / entities，那两样每次现取）。 */
export interface ProjectionSource {
  readonly spaces: RenderSource["spaces"];
  readonly templates: RenderSource["templates"];
  readonly entities: RenderSource["entities"];
}

/** 这一 tick 的投影实体：handle → 完整记录。 */
export function captureEntities(
  projector: Projector,
  source: ProjectionSource,
  tick: number,
): Map<number, unknown> {
  const projected = projector.snapshot({ ...source, tick });
  const map = new Map<number, unknown>();
  for (const entity of projected.entities) map.set(entity.handle, entity);
  return map;
}

/** 对比前后两拍：变化的实体整条发，消失的只发 handle。 */
export function diffEntities(
  projector: Projector,
  source: ProjectionSource,
  prev: ReadonlyMap<number, unknown>,
  tick: number,
  events: readonly FrameEvent[],
): Frame {
  const now = captureEntities(projector, source, tick);
  const entities: unknown[] = [];
  const removed: number[] = [];

  for (const [handle, record] of now) {
    const before = prev.get(handle);
    if (before === undefined || JSON.stringify(before) !== JSON.stringify(record)) {
      entities.push(record);
    }
  }

  for (const handle of prev.keys()) {
    if (!now.has(handle)) removed.push(handle);
  }

  return {
    tick,
    entities,
    removed,
    events: events.map((entry) => `#${entry.id} ${entry.kind} ${JSON.stringify(entry.data)}`),
  };
}
