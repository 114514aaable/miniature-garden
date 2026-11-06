# `game/engine/core/src/stencils.ts`

## 内容

偏移集（stencil）：规则层的第一个文件。
「什么算相邻」是语义，不是几何，所以它不在空间里，在这里。
空间只负责按偏移取格子；选哪一组偏移，是这个世界自己的事。
想加六边形？在这里写一组偏移，空间一行都不用改。

行数：87

## 接口

### 常量 `DIAGONAL`

```ts
const DIAGONAL: readonly Offset[]
```

### 函数 `line`

```ts
function line(dx: number, dy: number, length: number): Offset[]
```

### 常量 `ORTHOGONAL`

```ts
const ORTHOGONAL: readonly Offset[]
```

### 函数 `rect`

```ts
function rect(width: number, height: number): Offset[]
```

### 函数 `ring`

```ts
function ring(radius: number): Offset[]
```

## 依赖

- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)

## 被引用

（没有别的文件引用它）
