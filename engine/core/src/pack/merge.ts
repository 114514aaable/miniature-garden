// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 合并：把多个包的内容并进同一个池子。
 *
 * 三条规则：
 *   1. 默认拒绝重复——同一个 (kind, id) 出现两次就是错。
 *   2. 覆盖只能走显式补丁，并且要记账（谁改了谁）。
 *   3. 顺序 = 拓扑序（见 order.ts），所以结果与安装顺序无关。
 *
 * 这一层只管「池子」，不知道每种 kind 的数据长什么样——
 * 那是加载器逐类校验的事。这里只保证：不重、不丢、可追溯。
 */

import { type JsonValue, canonicalize, hashText } from "../time.ts";
import { type PackManifest } from "./manifest.ts";

/** 一条定义。kind 例如 "space" / "template" / "component"。 */
export interface Definition {
  readonly kind: string;
  readonly id: string;
  readonly data: JsonValue;
}

/** 一个包贡献的内容。 */
export interface PackContent {
  readonly pack: PackManifest;
  readonly definitions: readonly Definition[];
  readonly patches?: readonly Patch[];
}

export type Patch =
  | { readonly op: "replace"; readonly kind: string; readonly id: string; readonly data: JsonValue }
  | { readonly op: "remove"; readonly kind: string; readonly id: string };

export interface MergedDefinition extends Definition {
  /** 最初定义它的包。 */
  readonly origin: string;
  /** 依次改过它的包（按加载顺序）。 */
  readonly patchedBy: readonly string[];
}

export interface ProvenanceEntry {
  readonly action: "add" | "replace" | "remove";
  readonly kind: string;
  readonly id: string;
  readonly pack: string;
}

export interface MergeWarning {
  readonly kind: string;
  readonly id: string;
  readonly previousOrigin: string;
  readonly newOrigin: string;
}

export interface MergeOptions {
  /**
   * 冲突策略。默认 error——正式世界不该「后装的悄悄赢」。
   * warn：覆盖但记警告；override：覆盖不记（沙盒用）。
   */
  readonly onConflict?: "error" | "warn" | "override";
}

export interface MergedWorld {
  readonly definitions: ReadonlyMap<string, MergedDefinition>;
  readonly provenance: readonly ProvenanceEntry[];
  readonly warnings: readonly MergeWarning[];
  /** 合并结果的哈希：参与世界身份。 */
  readonly hash: string;
}

export function keyOf(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/**
 * 按给定顺序合并。调用方负责先跑 orderPacks——这里不再排序，
 * 因为「顺序」已经是一个决定，不该在合并阶段被悄悄改掉。
 */
export function mergePacks(
  contents: readonly PackContent[],
  options: MergeOptions = {},
): MergedWorld {
  const policy = options.onConflict ?? "error";
  const pool = new Map<string, MergedDefinition>();
  const provenance: ProvenanceEntry[] = [];
  const warnings: MergeWarning[] = [];

  for (const content of contents) {
    const packId = content.pack.id;

    for (const definition of content.definitions) {
      checkName(definition.kind, "kind");
      checkName(definition.id, "id");
      const key = keyOf(definition.kind, definition.id);

      const existing = pool.get(key);
      if (existing !== undefined) {
        if (policy === "error") {
          throw new Error(
            `定义重复：${definition.kind}/${definition.id}（${existing.origin} 与 ${packId}）。` +
              `要改它请用补丁，或把世界的 onConflict 调成 "warn" / "override"。`,
          );
        }
        // 覆盖，但保留最初的定义者，把这件事记进 patchedBy——覆盖也是「改」，要留痕。
        pool.set(key, {
          ...definition,
          data: structuredClone(definition.data),
          origin: existing.origin,
          patchedBy: [...existing.patchedBy, packId],
        });
        provenance.push({ action: "replace", kind: definition.kind, id: definition.id, pack: packId });
        if (policy === "warn") {
          warnings.push({
            kind: definition.kind,
            id: definition.id,
            previousOrigin: existing.origin,
            newOrigin: packId,
          });
        }
        continue;
      }

      pool.set(key, {
        ...definition,
        data: structuredClone(definition.data),
        origin: packId,
        patchedBy: [],
      });
      provenance.push({ action: "add", kind: definition.kind, id: definition.id, pack: packId });
    }

    for (const patch of content.patches ?? []) {
      const key = keyOf(patch.kind, patch.id);
      const existing = pool.get(key);

      if (patch.op === "replace") {
        if (existing === undefined) {
          throw new Error(`补丁找不到目标：${patch.kind}/${patch.id}（来自 ${packId}）`);
        }
        pool.set(key, {
          ...existing,
          data: structuredClone(patch.data),
          patchedBy: [...existing.patchedBy, packId],
        });
        provenance.push({ action: "replace", kind: patch.kind, id: patch.id, pack: packId });
        continue;
      }

      if (existing === undefined) {
        throw new Error(`补丁找不到目标：${patch.kind}/${patch.id}（来自 ${packId}）`);
      }
      pool.delete(key);
      provenance.push({ action: "remove", kind: patch.kind, id: patch.id, pack: packId });
    }
  }

  return {
    definitions: pool,
    provenance,
    warnings,
    hash: hashOf(pool),
  };
}

/** 合并结果的指纹：按 key 排序后算，和插入顺序无关。 */
function hashOf(pool: ReadonlyMap<string, MergedDefinition>): string {
  const entries = [...pool.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, definition]) => ({
      key,
      kind: definition.kind,
      id: definition.id,
      data: definition.data,
      origin: definition.origin,
      patchedBy: definition.patchedBy,
    }));
  return hashText(canonicalize(entries as unknown as JsonValue));
}

function checkName(value: string, what: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${what} 不能为空`);
  }
}
