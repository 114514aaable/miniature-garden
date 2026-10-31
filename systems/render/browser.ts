// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 浏览器侧的渲染器：拿快照、自己跑 60fps、自己插值。
 *
 * 为什么渲染逻辑跑在浏览器：
 *   动画需要每帧推进，而服务端只在「一回合」时给一次数据。
 *   把 visual.ts / draw.ts 编成 JS 送到浏览器，服务端和客户端共用同一份源码
 *   ——所以这里没有任何「镜像实现」。
 */

import { type Atlas, parseAtlas } from "./atlas.ts";
import {
  buildFrame,
  type DrawCommand,
  DEFAULT_STYLE,
  type RenderStyle,
} from "./draw.ts";
import { type FrameSnapshot } from "./project.ts";
import { clampDelta, DEFAULT_VISUAL, stepVisual, type Vec2, type VisualConfig } from "./visual.ts";

/** 服务端发来的东西。 */
export interface ClientState {
  readonly snapshot: FrameSnapshot;
  readonly style?: RenderStyle;
  /** 原始图集 JSON（可选）。 */
  readonly atlas?: unknown;
}

export interface ClientOptions {
  readonly tile: number;
  readonly visual?: VisualConfig;
}

export interface Renderer {
  setState(state: ClientState): void;
  stop(): void;
}

/** 挂到 canvas 上，开始每帧重画。 */
export function attach(canvas: HTMLCanvasElement, options: ClientOptions): Renderer {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("这个 canvas 拿不到 2d 上下文");
  }

  const config = options.visual ?? DEFAULT_VISUAL;
  const visuals = new Map<number, Vec2>();
  const images = new Map<string, HTMLImageElement>();

  let state: ClientState | null = null;
  let atlas: Atlas | null = null;
  let last = 0;
  let previous = 0;
  let running = true;

  function setState(next: ClientState): void {
    state = next;
    if (next.atlas !== undefined && next.atlas !== null) {
      atlas = parseAtlas(next.atlas);
    }

    const space = next.snapshot.spaces[0];
    if (space !== undefined) {
      canvas.width = space.width * options.tile;
      canvas.height = space.height * options.tile;
    }
  }

  function imageOf(src: string): HTMLImageElement {
    let image = images.get(src);
    if (image === undefined) {
      image = new Image();
      image.src = src;
      images.set(src, image);
    }
    return image;
  }

  function frame(now: number): void {
    if (!running) return;

    const delta = clampDelta(now, last, previous);
    previous = last;
    last = now;

    if (state !== null) {
      // 视觉位置每帧从逻辑位置重算——没有「播放中」的对象。
      const entities = state.snapshot.entities.map((entity) => {
        const target = { x: entity.x ?? 0, y: entity.y ?? 0 };
        const visual = stepVisual(visuals.get(entity.handle) ?? null, target, delta, config);
        visuals.set(entity.handle, visual);
        return { ...entity, x: visual.x, y: visual.y };
      });

      const commands = buildFrame(
        { ...state.snapshot, entities },
        {
          tile: options.tile,
          viewport: { width: canvas.width, height: canvas.height },
          camera: { x: 0, y: 0 },
          style: state.style ?? DEFAULT_STYLE,
          ...(atlas === null ? {} : { atlas }),
        },
      );

      draw(context as CanvasRenderingContext2D, commands, imageOf);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame((now) => {
    last = now;
    previous = now - 16;
    requestAnimationFrame(frame);
  });

  return {
    setState,
    stop() {
      running = false;
    },
  };
}

function draw(
  context: CanvasRenderingContext2D,
  commands: readonly DrawCommand[],
  imageOf: (src: string) => HTMLImageElement,
): void {
  for (const command of commands) {
    if (command.kind === "rect") {
      context.fillStyle = command.color;
      context.fillRect(command.x, command.y, command.w, command.h);
      continue;
    }

    if (command.kind === "text") {
      text(context, command.x, command.y, command.text, command.color, command.size);
      continue;
    }

    // sprite：图还没到就先画兜底字符
    const image = imageOf(command.image);
    if (image.complete && image.naturalWidth > 0) {
      context.drawImage(
        image,
        command.sx,
        command.sy,
        command.sw,
        command.sh,
        command.x,
        command.y,
        command.w,
        command.h,
      );
    } else {
      text(
        context,
        command.x + command.w / 2,
        command.y + command.h / 2,
        command.fallback.text,
        command.fallback.color,
        command.fallback.size,
      );
    }
  }
}

function text(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: string,
  color: string,
  size: number,
): void {
  context.fillStyle = color;
  context.font = `${size}px ui-monospace, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(value, x, y);
}
