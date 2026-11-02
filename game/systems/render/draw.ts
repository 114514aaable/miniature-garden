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
import { type Atlas, frameOf } from "./atlas.ts";

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
      readonly w: number;
      readonly h: number;
      readonly image: string;
      readonly sx: number;
      readonly sy: number;
      readonly sw: number;
      readonly sh: number;
      /** 图片还没加载出来时画的字符。 */
      readonly fallback: { readonly text: string; readonly color: string; readonly size: number };
    };

export interface TerrainStyle {
  readonly fill: string;
  /** 没有贴图时用字符兜底。 */
  readonly glyph?: string;
}

export interface EntityStyle {
  readonly glyph: string;
  readonly color: string;
  /** 图层：小的先画。物品 0、角色 1，这样角色不会被道具盖住。 */
  readonly layer?: number;
  /** 画多大（相对格子）。省略 = 0.7。 */
  readonly scale?: number;
  /** 缩到右下角，避免和角色抢中心。 */
  readonly corner?: boolean;
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
  /** 渲染时刻（毫秒）。动画帧按它取，和逻辑 tick 无关。 */
  readonly now?: number;
  /** 可选图集；没有就全用字符。 */
  readonly atlas?: Atlas;
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
    pc: { glyph: "@", color: "#8ab4f8", layer: 1 },
    npc_salt: { glyph: "N", color: "#e06c75", layer: 1 },
    prop_crate: { glyph: "o", color: "#c9a227", layer: 1 },
    item_lamp: { glyph: "i", color: "#98c379", layer: 0, scale: 0.45, corner: true },
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
      // 按「取整后的左右边」算宽高：相邻格共用一条边，
      // 相机是浮点的时候也不会出现 1px 缝或重叠。
      const left = round(originX + x * spec.tile);
      const top = round(originY + y * spec.tile);
      const right = round(originX + (x + 1) * spec.tile);
      const bottom = round(originY + (y + 1) * spec.tile);
      const screenX = left;
      const screenY = top;
      if (!visible(screenX, screenY, spec.tile, spec.viewport)) {
        continue;
      }

      const terrain = space.terrain[y * space.width + x];
      const style = spec.style.terrain[terrain] ?? spec.style.terrain[0];
      commands.push({
        kind: "rect",
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
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
    .sort((a, b) => {
      const layerA = spec.style.templates[a.template ?? ""]?.layer ?? 0;
      const layerB = spec.style.templates[b.template ?? ""]?.layer ?? 0;
      return (
        layerA - layerB ||
        (a.y as number) - (b.y as number) ||
        (a.x as number) - (b.x as number)
      );
    });

  for (const entity of visibleEntities) {
    const screenX = originX + (entity.x as number) * spec.tile;
    const screenY = originY + (entity.y as number) * spec.tile;
    if (!visible(screenX, screenY, spec.tile, spec.viewport)) {
      continue;
    }

    const style = spec.style.templates[entity.template ?? ""] ?? spec.style.fallback;
    const size = Math.round(spec.tile * (style.scale ?? 0.7));
    const centerX = round(screenX + (style.corner === true ? spec.tile * 0.72 : spec.tile / 2));
    const centerY = round(screenY + (style.corner === true ? spec.tile * 0.72 : spec.tile / 2));

    // 有图集、组件里也点了名 → 画贴图；否则退回字符。
    const sprite = entity.sprite as { frame?: unknown; frames?: unknown; fps?: unknown } | undefined;
    const frameName = frameNameOf(sprite, spec.now ?? 0);
    if (spec.atlas !== undefined && frameName !== undefined) {
      const frame = frameOf(spec.atlas, frameName);
      if (frame !== undefined) {
        commands.push({
          kind: "sprite",
          x: round(screenX),
          y: round(screenY),
          w: spec.tile,
          h: spec.tile,
          image: spec.atlas.image,
          sx: frame.x,
          sy: frame.y,
          sw: frame.w,
          sh: frame.h,
          fallback: { text: style.glyph, color: style.color, size },
        });
        continue;
      }
    }

    commands.push({
      kind: "text",
      x: centerX,
      y: centerY,
      text: style.glyph,
      color: style.color,
      size,
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

/** 该画哪一帧：有 frames 就按时间取，否则用静态 frame。 */
export function frameNameOf(
  sprite: { frame?: unknown; frames?: unknown; fps?: unknown } | undefined,
  nowMs: number,
): string | undefined {
  if (sprite === undefined) return undefined;

  const frames = Array.isArray(sprite.frames) ? sprite.frames.filter((f): f is string => typeof f === "string") : [];
  if (frames.length > 0) {
    const fps = typeof sprite.fps === "number" && sprite.fps > 0 ? sprite.fps : 4;
    const index = Math.floor((nowMs / 1000) * fps) % frames.length;
    return frames[index];
  }

  return typeof sprite.frame === "string" ? sprite.frame : undefined;
}
