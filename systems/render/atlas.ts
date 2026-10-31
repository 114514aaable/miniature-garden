// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 图集：读 TexturePacker 的 JSON hash 格式。
 *
 * 为什么用这个格式而不是自造：它已经是事实标准，TexturePacker / Aseprite /
 * 各种打包脚本都能直接产出。我们只需要会读。
 *
 * 帧名 = 源文件路径（"Enemies/Skeleton.png"），不是自造 id。
 * 动画靠文件名编号聚合（"Arms1.png" / "Arms2.png" → "Arms"）。
 */

export interface AtlasFrame {
  /** 在图集里的像素矩形。 */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 原始画布尺寸（裁掉透明边之前）。 */
  readonly sourceW: number;
  readonly sourceH: number;
  /** 裁掉的透明边：绘制时按这个偏移对齐。 */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly trimmed: boolean;
}

export interface Atlas {
  /** 图集图片的路径（相对包根）。 */
  readonly image: string;
  readonly frames: ReadonlyMap<string, AtlasFrame>;
  /** 动画名 → 帧名数组。 */
  readonly animations: ReadonlyMap<string, readonly string[]>;
}

interface RawFrame {
  readonly frame?: { x?: number; y?: number; w?: number; h?: number };
  readonly rotated?: boolean;
  readonly trimmed?: boolean;
  readonly spriteSourceSize?: { x?: number; y?: number; w?: number; h?: number };
  readonly sourceSize?: { w?: number; h?: number };
}

/**
 * 解析图集 JSON。
 *
 * rotated 的帧我们暂时不支持——直接报错，免得画出来是歪的还不知道。
 */
export function parseAtlas(raw: unknown, path = "$atlas"): Atlas {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path}：需要对象`);
  }

  const object = raw as {
    frames?: Record<string, RawFrame>;
    animations?: Record<string, string[]>;
    meta?: { image?: string };
  };

  if (object.frames === undefined) {
    throw new Error(`${path}：缺少 frames`);
  }
  const image = object.meta?.image;
  if (typeof image !== "string" || image.length === 0) {
    throw new Error(`${path}.meta.image：缺少图集图片路径`);
  }

  const frames = new Map<string, AtlasFrame>();
  for (const [name, frame] of Object.entries(object.frames)) {
    if (frame.rotated === true) {
      throw new Error(`${path}.frames["${name}"]：不支持旋转帧`);
    }

    const rect = frame.frame;
    if (rect === undefined) {
      throw new Error(`${path}.frames["${name}"]：缺少 frame`);
    }
    const x = int(rect.x, `${path}.frames["${name}"].frame.x`);
    const y = int(rect.y, `${path}.frames["${name}"].frame.y`);
    const w = int(rect.w, `${path}.frames["${name}"].frame.w`);
    const h = int(rect.h, `${path}.frames["${name}"].frame.h`);

    const source = frame.spriteSourceSize;
    const sourceSize = frame.sourceSize;

    frames.set(name, {
      x,
      y,
      w,
      h,
      sourceW: int(sourceSize?.w ?? w, `${path}.frames["${name}"].sourceSize.w`),
      sourceH: int(sourceSize?.h ?? h, `${path}.frames["${name}"].sourceSize.h`),
      offsetX: int(source?.x ?? 0, `${path}.frames["${name}"].spriteSourceSize.x`),
      offsetY: int(source?.y ?? 0, `${path}.frames["${name}"].spriteSourceSize.y`),
      trimmed: frame.trimmed === true,
    });
  }

  const animations = new Map<string, readonly string[]>();
  for (const [name, list] of Object.entries(object.animations ?? {})) {
    if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
      throw new Error(`${path}.animations["${name}"]：需要字符串数组`);
    }
    animations.set(name, list);
  }

  return { image, frames, animations };
}

/** 查一帧；查不到返回 undefined，由调用方决定兜底。 */
export function frameOf(atlas: Atlas, name: string): AtlasFrame | undefined {
  return atlas.frames.get(name);
}

function int(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${at}：需要整数`);
  }
  return value;
}
