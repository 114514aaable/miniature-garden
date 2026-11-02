// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载顺序：依赖图 + 拓扑排序。
 *
 * 三条原则：
 *   1. 顺序必须是数据的函数，不是磁盘的函数——同层按 id 字典序。
 *   2. 缺依赖、版本不符、成环，都在加载期报错，不猜。
 *   3. provides 只是别名：依赖可以指向别名，但最终解析到真正提供它的包。
 *
 * 版本范围只支持单个比较符（`*` / 精确 / `^` / `~` / `>=` / `<`）。
 * 复合范围（`>=1.0.0 <2.0.0`）留到真有人需要时再加——**语法要窄**。
 */

import { type PackManifest } from "./manifest.ts";

export interface PackOrderError extends Error {
  readonly packId?: string;
}

export function orderPacks(packs: readonly PackManifest[]): readonly PackManifest[] {
  const byId = new Map<string, PackManifest>();
  for (const pack of packs) {
    if (byId.has(pack.id)) {
      throw new Error(`包 id 重复：${pack.id}`);
    }
    byId.set(pack.id, pack);
  }

  const aliases = resolveAliases(packs, byId);

  // deps[X] = 必须排在 X 前面的包
  const deps = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const pack of packs) {
    deps.set(pack.id, new Set());
    dependents.set(pack.id, new Set());
  }

  const addEdge = (before: string, after: string, why: string): void => {
    if (before === after) {
      throw new Error(`包 ${after} 不能依赖自己（${why}）`);
    }
    deps.get(after)?.add(before);
    dependents.get(before)?.add(after);
  };

  for (const pack of packs) {
    for (const [name, range] of Object.entries(pack.requires ?? {})) {
      const target = resolve(name, byId, aliases);
      if (target === undefined) {
        throw new Error(`包 ${pack.id} 依赖了不存在的包：${name}`);
      }
      if (!satisfies(byId.get(target)?.version ?? "0.0.0", range)) {
        throw new Error(
          `包 ${pack.id} 要求 ${name} ${range}，但实际是 ${byId.get(target)?.version}`,
        );
      }
      addEdge(target, pack.id, `requires ${name}`);
    }

    for (const name of pack.loadAfter ?? []) {
      const target = resolve(name, byId, aliases);
      if (target === undefined) {
        throw new Error(`包 ${pack.id} 的 loadAfter 指向不存在的包：${name}`);
      }
      addEdge(target, pack.id, `loadAfter ${name}`);
    }

    for (const name of pack.loadBefore ?? []) {
      const target = resolve(name, byId, aliases);
      if (target === undefined) {
        throw new Error(`包 ${pack.id} 的 loadBefore 指向不存在的包：${name}`);
      }
      addEdge(pack.id, target, `loadBefore ${name}`);
    }
  }

  // Kahn：每次从「没有前置」的集合里取字典序最小的那个，保证确定性。
  const remaining = new Map<string, Set<string>>();
  for (const [id, set] of deps) {
    remaining.set(id, new Set(set));
  }

  const order: PackManifest[] = [];
  const ready = [...remaining.entries()].filter(([, set]) => set.size === 0).map(([id]) => id);

  while (ready.length > 0) {
    ready.sort();
    const id = ready.shift() as string;
    const pack = byId.get(id);
    if (pack === undefined) continue;
    order.push(pack);
    remaining.delete(id);

    for (const next of dependents.get(id) ?? []) {
      const set = remaining.get(next);
      if (set === undefined) continue;
      set.delete(id);
      if (set.size === 0) ready.push(next);
    }
  }

  if (order.length !== packs.length) {
    const stuck = [...remaining.keys()].sort()[0];
    const cycle = findCycle(stuck, remaining);
    throw new Error(`依赖成环：${cycle.join(" → ")}`);
  }

  return order;
}

function resolveAliases(
  packs: readonly PackManifest[],
  byId: ReadonlyMap<string, PackManifest>,
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const pack of packs) {
    for (const name of pack.provides ?? []) {
      if (byId.has(name)) {
        throw new Error(`包 ${pack.id} 想把别名 ${name} 占为己有，但它已经是一个真实的包`);
      }
      const owner = aliases.get(name);
      if (owner !== undefined && owner !== pack.id) {
        throw new Error(`别名 ${name} 被两个包同时提供：${owner} 和 ${pack.id}`);
      }
      aliases.set(name, pack.id);
    }
  }
  return aliases;
}

function resolve(
  name: string,
  byId: ReadonlyMap<string, PackManifest>,
  aliases: ReadonlyMap<string, string>,
): string | undefined {
  if (byId.has(name)) return name;
  return aliases.get(name);
}

/** 版本范围：只支持单个比较符，够用且不易歧义。 */
export function satisfies(version: string, range: string): boolean {
  const trimmed = range.trim();
  if (trimmed === "*") return true;

  const match = /^(\^|~|>=|<=|>|<)?\s*(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
  if (match === null) {
    throw new Error(`不支持的版本范围 "${range}"（v0 只支持单个比较符或 *）`);
  }

  const [, op, major, minor, patch] = match;
  const want = [Number(major), Number(minor), Number(patch)] as const;
  const have = parseVersion(version);
  const cmp = compare(have, want);

  switch (op) {
    case undefined:
      return cmp === 0;
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case "^":
      // 主版本相同且不低于目标（0.x 的特殊语义留到真有人用 0.x 再说）
      return have[0] === want[0] && cmp >= 0;
    case "~":
      return have[0] === want[0] && have[1] === want[1] && cmp >= 0;
    default:
      return false;
  }
}

function parseVersion(version: string): readonly [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    throw new Error(`版本号非法：${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** 在剩下的节点里找一条环，用于报错。 */
function findCycle(start: string, remaining: ReadonlyMap<string, Set<string>>): readonly string[] {
  const path: string[] = [];
  const seen = new Map<string, number>();
  let current = start;

  while (!seen.has(current)) {
    seen.set(current, path.length);
    path.push(current);
    const next = [...(remaining.get(current) ?? [])].sort()[0];
    if (next === undefined) return path;
    current = next;
  }

  return [...path.slice(seen.get(current) ?? 0), current];
}
