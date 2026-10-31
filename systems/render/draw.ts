// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 绘制指令：把快照翻译成「画什么」。
 *
 * 这一层不碰 DOM、不碰 Canvas——它只产出命令数组。
 * 好处是能单测：同样的快照 + 同样的样式，必须得到同样的指令。
 *
 * Canvas / SVG / 终端 只是这些命令的执行器。
 */

import { type FrameSnapshot } from "./project.ts";

export type DrawCommand =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: string }
  | {
      readonly kind: "text";
      readonly x: number;
      readonly y: number;
      readonly text: string;
      readonly color: string;
      readonly size: number;
    }
  | {
      readonly kind: "sprite";
      readonly x: number;
      readonly y: number;
      readonly size: number;
      readonly sheet: string;
      readonly index: number;
    };

export interface TerrainStyle {
  readonly fill: string;
  /** 没有贴图时用字符兜底。 */
  readonly glyph?: string;
}

export interface EntityStyle {
  readonly glyph: string;
  readonly color: string;
  /** 有贴图就用贴图，否则用 glyph。 */
  readonly sprite?: { readonly sheet: string; readonly index: number };
}

export interface RenderStyle {
  readonly background: string;
  readonly grid: string;
  readonly terrain: Readonly<Record<number, TerrainStyle>>;
  readonly templates: Readonly<Record<string, EntityStyle>>;
  readonly fallback: EntityStyle;
}

export interface FrameSpec {
  /** 一格多少像素。 */
  readonly tile: number;
  readonly viewport: { readonly width: number; readonly height: number };
  /** 镜头左上角在格子坐标系里的浮点位置（用于插值）。 */
  readonly camera: { readonly x: number; readonly y: number };
  readonly style: RenderStyle;
}

export const DEFAULT_STYLE: RenderStyle = {
  background: "#0d0f13",
  grid: "#1c2029",
  terrain: {
    0: { fill: "#0d0f13" },
    1: { fill: "#2a2f3a" },
    2: { fill: "#1b2f45" },
    3: { fill: "#171a21" },
  },
  templates: {
    pc: { glyph: "@", color: "#8ab4f8" },
    npc_salt: { glyph: "N", color: "#e06c75" },
    prop_crate: { glyph: "o", color: "#c9a227" },
    item_lamp: { glyph: "i", color: "#98c379" },
  },
  fallback: { glyph: "?", color: "#d7dae0" },
};

/**
 * 生成一帧的绘制指令。
 *
 * 顺序就是绘制顺序：背景 → 地形 → 实体（按 y 再按 x，远的先画）。
 * 视野外的格子与实体直接跳过——这是最省事也最有效的裁剪。
 */
export function buildFrame(snapshot: FrameSnapshot, spec: FrameSpec): readonly DrawCommand[] {
  const commands: DrawCommand[] = [
    { kind: "rect", x: 0, y: 0, w: spec.viewport.width, h: spec.viewport.height, color: spec.style.background },
  ];

  const space = snapshot.spaces[0];
  if (space === undefined) {
    return commands;
  }

  const originX = -spec.camera.x * spec.tile;
  const originY = -spec.camera.y * spec.tile;

  for (let y = 0; y < space.height; y++) {
    for (let x = 0; x < space.width; x++) {
      const screenX = originX + x * spec.tile;
      const screenY = originY + y * spec.tile;
      if (!visible(screenX, screenY, spec.tile, spec.viewport)) {
        continue;
      }

      const terrain = space.terrain[y * space.width + x];
      const style = spec.style.terrain[terrain] ?? spec.style.terrain[0];
      commands.push({
        kind: "rect",
        x: round(screenX),
        y: round(screenY),
        w: spec.tile,
        h: spec.tile,
        color: style?.fill ?? spec.style.background,
      });

      if (style?.glyph !== undefined) {
        commands.push({
          kind: "text",
          x: round(screenX + spec.tile / 2),
          y: round(screenY + spec.tile / 2),
          text: style.glyph,
          color: "#4b5563",
          size: Math.round(spec.tile * 0.6),
        });
      }
    }
  }

  const visibleEntities = snapshot.entities
    .filter((entity) => entity.x !== undefined && entity.y !== undefined)
    .sort((a, b) => (a.y as number) - (b.y as number) || (a.x as number) - (b.x as number));

  for (const entity of visibleEntities) {
    const screenX = originX + (entity.x as number) * spec.tile;
    const screenY = originY + (entity.y as number) * spec.tile;
    if (!visible(screenX, screenY, spec.tile, spec.viewport)) {
      continue;
    }

    const style = spec.style.templates[entity.template ?? ""] ?? spec.style.fallback;
    commands.push({
      kind: "text",
      x: round(screenX + spec.tile / 2),
      y: round(screenY + spec.tile / 2),
      text: style.glyph,
      color: style.color,
      size: Math.round(spec.tile * 0.7),
    });
  }

  return commands;
}

function visible(x: number, y: number, tile: number, viewport: { width: number; height: number }): boolean {
  return x + tile > 0 && y + tile > 0 && x < viewport.width && y < viewport.height;
}

function round(value: number): number {
  return Math.round(value);
}
