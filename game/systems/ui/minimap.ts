// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 小地图：把一整个空间压成一张缩略图。
 *
 * 它只做「画」——数据从快照来，不读世界。
 * 和套件里其它部件一样，属于表现层：世界怎么变它不知道，给它什么就画什么。
 */

export interface MinimapSpace {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly number[];
}

export interface MinimapMark {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

export interface MinimapOptions {
  readonly space: MinimapSpace;
  /** 每格几像素。 */
  readonly cell?: number;
  /** 地形号 → 颜色。没声明的用兜底色。 */
  readonly colors?: Readonly<Record<number, string>>;
  readonly marks?: readonly MinimapMark[];
}

export const DEFAULT_TERRAIN_COLORS: Readonly<Record<number, string>> = {
  0: "#1a1f27",
  1: "#3a4150",
  2: "#2f4a6b",
  3: "#232833",
};

/**
 * 画到给定上下文。坐标系是「小地图自己的像素」，左上角对齐。
 */
export function drawMinimap(context: CanvasRenderingContext2D, options: MinimapOptions): void {
  const cell = options.cell ?? 4;
  const colors = options.colors ?? DEFAULT_TERRAIN_COLORS;
  const { width, height, terrain } = options.space;

  context.clearRect(0, 0, width * cell, height * cell);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = terrain[y * width + x] ?? 0;
      context.fillStyle = colors[id] ?? "#1a1f27";
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  for (const mark of options.marks ?? []) {
    context.fillStyle = mark.color;
    context.fillRect(mark.x * cell, mark.y * cell, cell, cell);
  }
}

/** 小地图的像素尺寸。 */
export function minimapSize(space: MinimapSpace, cell = 4): { width: number; height: number } {
  return { width: space.width * cell, height: space.height * cell };
}
