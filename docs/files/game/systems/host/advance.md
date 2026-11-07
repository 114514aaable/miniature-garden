# `game/systems/host/advance.ts`

## 内容

推进：把世界推到目标 tick，同时产帧。
宿主只提供「这一 tick 干什么」（stepTick）和「怎么录帧」（capture / diff），
循环本身（上限、截断、尾帧）放在这里——这样它可测，也不用起服务器。

行数：89

## 接口

### 接口 `AdvanceHost`

```ts
interface AdvanceHost {
  now(): number;
  setReadyAt(tick: number): void;
  notice(message: string): void;
  devlog(message: string, data: unknown): void;
  readonly frames: Frame[];
  readonly lastEvents: readonly FrameEvent[];
  capture(): Map<number, unknown>;
  diff(prev: ReadonlyMap<number, unknown>, tick: number, events: readonly FrameEvent[]): Frame;
  stepTick(): void;
  applyPending(): void;
  readonly maxFrames?: number;
}
```

### 函数 `advanceTo`

```ts
function advanceTo(host: AdvanceHost, target: number): void
```

### 常量 `MAX_FRAMES`

```ts
const MAX_FRAMES
```

## 依赖

- [`game/systems/host/frames.ts`](game/systems/host/frames.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
