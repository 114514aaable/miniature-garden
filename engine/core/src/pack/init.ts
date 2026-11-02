// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 开局初始化：世界建好之后，按顺序执行世界包声明的 init。
 *
 * 为什么放在引擎而不是宿主：`play.mjs`、`serve.mjs`、以后的地图生成器
 * 都应该看到同一个开局。放在宿主里，各宿主就会各自实现一遍，迟早不一致。
 *
 * 目前支持两种条目：
 *   - 普通效果（spawn / patch / terrain / …），原样提交；
 *   - stamp：按预制件把一组实体盖下去（host 之外唯一需要「认识 groups」的地方）。
 */

import { type Store } from "../store.ts";
import { type JsonValue } from "../time.ts";
import { type LoadedWorld } from "./load.ts";

export function applyInit(store: Store, loaded: LoadedWorld): void {
  if (loaded.init.length === 0) {
    return;
  }

  for (const entry of loaded.init) {
    if (isStamp(entry)) {
      stampGroup(store, loaded, entry);
      continue;
    }
    store.submit(entry as never);
  }

  store.step(0);
}

interface StampEntry {
  readonly kind: "stamp";
  readonly group: string;
  readonly space: string;
  readonly x: number;
  readonly y: number;
}

function isStamp(entry: JsonValue): entry is JsonValue & StampEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    (entry as Record<string, JsonValue>).kind === "stamp"
  );
}

function stampGroup(store: Store, loaded: LoadedWorld, entry: StampEntry): void {
  const group = loaded.groups.get(entry.group);
  if (group === undefined) {
    throw new Error(`init 里的 stamp 找不到预制件：${entry.group}`);
  }

  const spaceId = loaded.spaceIds.get(entry.space);
  if (spaceId === undefined) {
    throw new Error(`init 里的 stamp 指向不存在的空间：${entry.space}`);
  }

  for (const part of group.entities) {
    store.submit({
      kind: "spawn",
      space: spaceId,
      cell: { x: entry.x + part.dx, y: entry.y + part.dy },
      template: part.template,
      ...(part.overrides === undefined ? {} : { overrides: part.overrides }),
    });
  }
}
