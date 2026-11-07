# `game/systems/host/frames.ts`

## 内容

帧：把「这一 tick 的投影实体」和「上一 tick」做 diff。
帧不是手挑字段的增量，而是**投影记录 diff**：
变了的实体整条发、消失的只发 handle。以后实体新增字段会自动进帧。

行数：77

## 接口

### 函数 `captureEntities`

```ts
function captureEntities( projector: Projector, source: ProjectionSource, tick: number, ): Map<number, unknown>
```

### 函数 `diffEntities`

```ts
function diffEntities( projector: Projector, source: ProjectionSource, prev: ReadonlyMap<number, unknown>, tick: number, events: readonly FrameEvent[], ): Frame
```

### 接口 `Frame`

```ts
interface Frame {
  readonly tick: number;
  readonly entities: readonly unknown[];
  readonly removed: readonly number[];
  readonly events: readonly string[];
}
```

### 接口 `FrameEvent`

```ts
interface FrameEvent {
  readonly id: number;
  readonly kind: string;
  readonly data: unknown;
}
```

### 接口 `ProjectionSource`

```ts
interface ProjectionSource {
  readonly spaces: RenderSource["spaces"];
  readonly templates: RenderSource["templates"];
  readonly entities: RenderSource["entities"];
}
```

## 依赖

- [`game/systems/render/project.ts`](game/systems/render/project.md)

## 被引用

- [`game/systems/host/advance.ts`](game/systems/host/advance.md)
- [`tools/serve.mjs`](tools/serve.md)
