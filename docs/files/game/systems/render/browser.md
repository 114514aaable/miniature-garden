# `game/systems/render/browser.ts`

## 内容

浏览器侧的渲染器：拿快照、自己跑 60fps、自己插值。
为什么渲染逻辑跑在浏览器：
动画需要每帧推进，而服务端只在「一回合」时给一次数据。
把 visual.ts / draw.ts 编成 JS 送到浏览器，服务端和客户端共用同一份源码
——所以这里没有任何「镜像实现」。

行数：315

## 接口

### 函数 `attach`

```ts
function attach(canvas: HTMLCanvasElement, options: ClientOptions): Renderer
```

### 接口 `ClientOptions`

```ts
interface ClientOptions {
  readonly tile: number;
  readonly visual?: VisualConfig;
}
```

### 接口 `ClientState`

```ts
interface ClientState {
  readonly playerHandle?: number;
  readonly snapshot: FrameSnapshot;
  readonly style?: RenderStyle;
  readonly atlas?: unknown;
}
```

### 接口 `Renderer`

```ts
interface Renderer {
  setState(state: ClientState): void;
  cellAt(x: number, y: number): Vec;
  setCursor(cell: { x: number; y: number } | null): void;
  setAim(cells: ReadonlyArray<readonly [number, number]>): void;
  setVisualSpeed(speed: number): void;
  stop(): void;
}
```

## 依赖

- [`game/systems/camera/camera.ts`](game/systems/camera/camera.md)
- [`game/systems/intel/facts.ts`](game/systems/intel/facts.md)
- [`game/systems/intel/overlay.ts`](game/systems/intel/overlay.md)
- [`game/systems/render/atlas.ts`](game/systems/render/atlas.md)
- [`game/systems/render/draw.ts`](game/systems/render/draw.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
- [`game/systems/render/visual.ts`](game/systems/render/visual.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
