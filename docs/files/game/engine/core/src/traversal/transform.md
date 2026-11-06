# `game/engine/core/src/traversal/transform.ts`

## 内容

偏移 → 偏移：形状的组合就是靠这几个变换。
**只支持 90° 的整数倍旋转**——格子世界里 45° 会落到半格，
那需要另一套「分数偏移」的表示，我们不引入。

行数：41

## 接口

### 函数 `keep`

```ts
function keep(offsets: readonly Offset[], predicate: (offset: Offset) => boolean): Offset[]
```

### 函数 `mirror`

```ts
function mirror(offsets: readonly Offset[], axis: "x" | "y" | "both" = "x"): Offset[]
```

### 函数 `rotate90`

```ts
function rotate90(offsets: readonly Offset[], turns: number): Offset[]
```

### 函数 `translate`

```ts
function translate(offsets: readonly Offset[], dx: number, dy: number): Offset[]
```

## 依赖

- [`game/engine/core/src/traversal/offsets.ts`](game/engine/core/src/traversal/offsets.md)

## 被引用

- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
