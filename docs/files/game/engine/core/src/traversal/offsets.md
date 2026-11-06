# `game/engine/core/src/traversal/offsets.ts`

## 内容

偏移算子：形状 → 一组相对偏移。
**算子只有这几种，形状可以无限多**——因为形状是「算子 + 变换」组合出来的
（见 transform.ts，组合写在 base 的 traversal.json 里）。
约定：range = 0 时只返回中心点。

行数：72

## 接口

### 函数 `baseOffsets`

```ts
function baseOffsets(shape: BaseShape, range: number, height = range): Offset[]
```

### 类型 `BaseShape`

```ts
type BaseShape = "circle" | "diamond" | "cross" | "rect"
```

### 函数 `dedupe`

```ts
function dedupe(offsets: readonly Offset[]): Offset[]
```

### 接口 `Offset`

```ts
interface Offset {
  readonly dx: number;
  readonly dy: number;
}
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/traversal/resolve.ts`](game/engine/core/src/traversal/resolve.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
- [`game/engine/core/src/traversal/transform.ts`](game/engine/core/src/traversal/transform.md)
