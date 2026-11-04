// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 通行：物种 × 地形 的对接结果。
 *
 * 两边各自编码：
 *   地形   surface: "ground" | "liquid" | "solid" | "air"
 *   物种   core.locomotion { surfaces: ["ground"] }
 *
 * 「谁和谁能接」用 bind 那个通用模块算一次，运行时只查表。
 *
 * 退回规则（老数据不改也能跑）：
 *   地形没有 surface     → 用它自己的 passable
 *   物种没有 locomotion  → 只看地形的 passable
 */

import { connectDeclarations, type Declaration } from "../../engine/core/src/bind.ts";

export interface PassageTerrain {
  readonly id: number;
  readonly code?: string;
  readonly surface?: string;
  readonly passable: boolean;
}

export interface PassageTemplate {
  readonly id: string;
  readonly components: Readonly<Record<string, unknown>>;
}

export interface Passage {
  /** 这个模板能不能站到这种地形上。 */
  canEnter(templateId: string, terrainId: number): boolean;
  /** 语言无关的说明（加载期报给作者看）。 */
  readonly diagnostics: readonly string[];
}

/** 标准词表：以后加 climb / web 之类就加在这里。 */
export const SURFACES = ["ground", "liquid", "solid", "air"] as const;

function surfacesOf(template: PassageTemplate): readonly string[] | null {
  const locomotion = template.components["core.locomotion"];
  if (typeof locomotion !== "object" || locomotion === null) return null;
  const list = (locomotion as { surfaces?: unknown }).surfaces;
  if (!Array.isArray(list)) return null;
  return list.filter((item): item is string => typeof item === "string");
}

function surfaceOf(terrain: PassageTerrain): string | null {
  return terrain.surface ?? null;
}

export function buildPassage(terrains: readonly PassageTerrain[], templates: readonly PassageTemplate[]): Passage {
  const diagnostics: string[] = [];

  // 左 = 物种（按模板 id），右 = 地形（按地形号）
  const left: Declaration[] = [];
  for (const template of templates) {
    const surfaces = surfacesOf(template);
    if (surfaces === null) continue;
    if (surfaces.length === 0) diagnostics.push(`模板 ${template.id} 的 core.locomotion.surfaces 是空的`);
    left.push({ id: template.id, codes: surfaces });
  }

  const right: Declaration[] = [];
  for (const terrain of terrains) {
    const surface = surfaceOf(terrain);
    // 没有 surface 的地形不参与对接（走 passable 兜底）
    if (surface === null) continue;
    right.push({ id: String(terrain.id), codes: [surface] });
  }

  const connection = connectDeclarations(left, right, SURFACES);

  for (const code of connection.unknown) {
    diagnostics.push(`未知的 surface "${code}"（可用：${SURFACES.join(" / ")}）`);
  }
  for (const id of connection.unusedLeft) {
    diagnostics.push(`模板 ${id} 的 surfaces 接不上任何地形`);
  }
  for (const id of connection.unusedRight) {
    diagnostics.push(`地形 ${id} 的 surface 没有任何模板能接`);
  }

  const terrainById = new Map(terrains.map((terrain) => [terrain.id, terrain]));
  /** 认识的模板（有 locomotion 的进 left；没声明的也记下，走 passable 兜底） */
  const knownTemplates = new Set(templates.map((template) => template.id));

  return {
    canEnter(templateId, terrainId) {
      const terrain = terrainById.get(terrainId);
      if (terrain === undefined) return false;
      if (!knownTemplates.has(templateId)) return false;

      const surfaces = left.find((item) => item.id === templateId)?.codes;
      if (surfaces === undefined || terrain.surface === undefined) {
        return terrain.passable;
      }

      return terrain.surface !== undefined && surfaces.includes(terrain.surface);
    },
    diagnostics,
  };
}
