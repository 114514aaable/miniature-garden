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

import { healthFacts, intentFacts, pendingFacts } from "../intel/facts.ts";
import { drawOverlay } from "../intel/overlay.ts";
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
  /** 多图集：sheet id → 原始 JSON。 */
  readonly atlases?: Readonly<Record<string, unknown>>;
}

export interface ClientOptions {
  readonly tile: number;
  readonly visual?: VisualConfig;
}

export interface Renderer {
  setState(state: ClientState): void;
  /** 屏幕坐标（相对 canvas）→ 格子。 */
  cellAt(x: number, y: number): Vec;
  /** 鼠标下的格子：画一个选中框。 */
  setCursor(cell: { x: number; y: number } | null): void;
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
  let atlases = new Map<string, Atlas>();
  let last = 0;
  let previous = 0;
  let running = true;
  let aimCells: ReadonlyArray<readonly [number, number]> = [];
  let camera: Vec = { x: 0, y: 0 };
  let cursor: { x: number; y: number } | null = null;

  function setState(next: ClientState): void {
    state = next;

    // 长时间 spawn/despawn 后，已经不在快照里的视觉缓存要清掉
    const alive = new Set((next.snapshot.entities || []).map((entity) => entity.handle));
    for (const handle of visuals.keys()) {
      if (!alive.has(handle)) visuals.delete(handle);
    }
    if (next.atlas !== undefined && next.atlas !== null) {
      atlas = parseAtlas(next.atlas);
    }
    if (next.atlases !== undefined && next.atlases !== null) {
      atlases = new Map();
      for (const [id, raw] of Object.entries(next.atlases)) {
        try {
          atlases.set(id, parseAtlas(raw));
        } catch {
          // 坏图集跳过，对应实体回退字符
        }
      }
    }

    resize();
  }

  // 逻辑坐标一律用 CSS 像素；物理画布乘 devicePixelRatio，
  // 这样浏览器缩放 / 高分屏下不会糊，指针换算也不用改。
  let dpr = 1;
  let viewport = { width: 1, height: 1 };
  let zoom = 1;
  const tileSize = (): number => options.tile * zoom;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));

    dpr = Math.max(1, window.devicePixelRatio || 1);
    viewport = { width: cssWidth, height: cssHeight };

    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
  }

  // 容器尺寸变化（窗口缩放、侧栏展开、手机旋转）都要重算画布
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resize());
  canvas.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoom = Math.min(3, Math.max(0.5, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
  }, { passive: false });

  observer?.observe(canvas);
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
        camera = cameraFor(focus, viewport, space, tileSize());
      }

      // 缩放变了（浏览器 Ctrl+滚轮 / 系统 DPI 变化）就重建画布
      if (Math.abs((window.devicePixelRatio || 1) - dpr) > 0.01) {
        resize();
      }

      const ctx2d = context as CanvasRenderingContext2D;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snapshot = state.snapshot;
      const commands = buildFrame(
        { ...snapshot, entities },
        {
          tile: tileSize(),
          viewport,
          camera,
          style: state.style ?? DEFAULT_STYLE,
          now,
          ...(atlas === null ? {} : { atlas }),
          ...(atlases.size === 0 ? {} : { atlases }),
        },
      );

      draw(context as CanvasRenderingContext2D, commands, imageOf);
      drawOverlay(context as CanvasRenderingContext2D, {
        tile: tileSize(),
        camera,
        entities: entities.map((entity) => ({
          x: entity.x,
          y: entity.y,
          health: healthFacts(entity.components?.["core.health"]),
          intent: intentFacts(entity.components?.["core.intent"], snapshot.tick),
          pending: pendingFacts(entity.components?.["core.pending"], snapshot.tick),
        })),
      });
      drawCursor(context as CanvasRenderingContext2D, cursor, tileSize(), camera);
      drawAim(context as CanvasRenderingContext2D, aimCells, tileSize(), camera);
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
      return screenToWorld({ x, y }, camera, tileSize());
    },
    setAim(cells) {
      aimCells = cells;
    },
    setCursor(cell) {
      cursor = cell;
    },
    setVisualSpeed(speed) {
      config = { ...config, speed };
    },
    stop() {
      running = false;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    },
  };
}


/** 选中框：只表示「鼠标在这」，不表示能不能打。 */
function drawCursor(
  context: CanvasRenderingContext2D,
  cursor: { x: number; y: number } | null,
  tile: number,
  camera: Vec,
): void {
  if (cursor === null) return;
  const sx = (cursor.x - camera.x) * tile;
  const sy = (cursor.y - camera.y) * tile;
  context.strokeStyle = "rgba(230,235,245,0.85)";
  context.lineWidth = 2;
  context.strokeRect(sx + 1, sy + 1, tile - 2, tile - 2);
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
