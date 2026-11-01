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
import { cameraFor, screenToWorld, type Vec } from "../camera/camera.ts";
import { clampDelta, DEFAULT_VISUAL, stepVisual, type Vec2, type VisualConfig } from "./visual.ts";

/** 服务端发来的东西。 */
export interface ClientState {
  /** 玩家句柄：相机跟着他走。 */
  readonly playerHandle?: number;
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
  /** 屏幕坐标（相对 canvas）→ 格子。 */
  cellAt(x: number, y: number): Vec;
  /** 指针高亮：[[x, y], ...] */
  setAim(cells: ReadonlyArray<readonly [number, number]>): void;
  /** 改视觉速度（格/秒），设置界面用。 */
  setVisualSpeed(speed: number): void;
  stop(): void;
}

/** 挂到 canvas 上，开始每帧重画。 */
export function attach(canvas: HTMLCanvasElement, options: ClientOptions): Renderer {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("这个 canvas 拿不到 2d 上下文");
  }

  let config = options.visual ?? DEFAULT_VISUAL;
  const visuals = new Map<number, Vec2>();
  const images = new Map<string, HTMLImageElement>();

  let state: ClientState | null = null;
  let atlas: Atlas | null = null;
  let last = 0;
  let previous = 0;
  let running = true;
  let aimCells: ReadonlyArray<readonly [number, number]> = [];
  let camera: Vec = { x: 0, y: 0 };

  function setState(next: ClientState): void {
    state = next;
    if (next.atlas !== undefined && next.atlas !== null) {
      atlas = parseAtlas(next.atlas);
    }

    resize();
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  window.addEventListener("resize", resize);

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

      const space = state.snapshot.spaces[0];
      if (space !== undefined) {
        // 相机跟「视觉位置」走，不跟逻辑位置——否则补间时画面会抖。
        const playerHandle = state.playerHandle;
        const player =
          playerHandle === undefined
            ? null
            : entities.find((entity) => entity.handle === playerHandle) ?? null;
        const focus = player === null ? { x: space.width / 2, y: space.height / 2 } : { x: player.x, y: player.y };
        camera = cameraFor(focus, { width: canvas.width, height: canvas.height }, space, options.tile);
      }

      const commands = buildFrame(
        { ...state.snapshot, entities },
        {
          tile: options.tile,
          viewport: { width: canvas.width, height: canvas.height },
          camera,
          style: state.style ?? DEFAULT_STYLE,
          ...(atlas === null ? {} : { atlas }),
        },
      );

      draw(context as CanvasRenderingContext2D, commands, imageOf);
      drawAim(context as CanvasRenderingContext2D, aimCells, options.tile, camera);
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
    cellAt(x, y) {
      return screenToWorld({ x, y }, camera, options.tile);
    },
    setAim(cells) {
      aimCells = cells;
    },
    setVisualSpeed(speed) {
      config = { ...config, speed };
    },
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
  };
}

/** 指针高亮：画在成品之上，不参与指令生成。 */
function drawAim(
  context: CanvasRenderingContext2D,
  cells: ReadonlyArray<readonly [number, number]>,
  tile: number,
  camera: Vec,
): void {
  for (const [x, y] of cells) {
    const sx = (x - camera.x) * tile;
    const sy = (y - camera.y) * tile;
    context.fillStyle = "rgba(138,180,248,0.22)";
    context.fillRect(sx, sy, tile, tile);
    context.strokeStyle = "rgba(138,180,248,0.9)";
    context.lineWidth = 2;
    context.strokeRect(sx + 1, sy + 1, tile - 2, tile - 2);
  }
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
