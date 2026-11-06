# `game/engine/core/src/worldgen/random.ts`

## 内容

生成器共用的小随机：只依赖种子，不读时钟。

行数：22

## 接口

### 函数 `makeRandom`

```ts
function makeRandom(seed: number): () => number
```

### 函数 `randomInt`

```ts
function randomInt(rand: () => number, min: number, max: number): number
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/worldgen/layout.ts`](game/engine/core/src/worldgen/layout.md)
- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
- [`game/engine/core/src/worldgen/rooms.ts`](game/engine/core/src/worldgen/rooms.md)
- [`game/engine/core/src/worldgen/sprawl.ts`](game/engine/core/src/worldgen/sprawl.md)
- [`game/engine/core/src/worldgen/tiles.ts`](game/engine/core/src/worldgen/tiles.md)
