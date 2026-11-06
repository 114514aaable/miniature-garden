# `game/engine/core/src/traversal/resolve.ts`

## 内容

偏移 → 格子：落点、去重、裁剪。
形状只负责「数学」，越界与去重在这里处理——
这样形状不用知道地图多大。

行数：46

## 接口

### 接口 `Bounds`

```ts
interface Bounds {
  readonly width: number;
  readonly height: number;
}
```

### 接口 `Cell`

```ts
interface Cell {
  readonly x: number;
  readonly y: number;
}
```

### 函数 `cellsOf`

```ts
function cellsOf( origin: Cell, offsets: readonly Offset[], bounds?: Bounds, ): Cell[]
```

### 函数 `chebyshev`

```ts
function chebyshev(a: Cell, b: Cell): number
```

### 函数 `manhattan`

```ts
function manhattan(a: Cell, b: Cell): number
```

## 依赖

- [`game/engine/core/src/traversal/offsets.ts`](game/engine/core/src/traversal/offsets.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
