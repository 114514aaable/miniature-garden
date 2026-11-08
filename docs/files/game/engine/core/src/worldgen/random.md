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

- [`game/engine/core/src/worldgen/generators/layout.ts`](game/engine/core/src/worldgen/generators/layout.md)
- [`game/engine/core/src/worldgen/generators/rooms.ts`](game/engine/core/src/worldgen/generators/rooms.md)
- [`game/engine/core/src/worldgen/generators/sprawl.ts`](game/engine/core/src/worldgen/generators/sprawl.md)
- [`game/engine/core/src/worldgen/generators/tiles.ts`](game/engine/core/src/worldgen/generators/tiles.md)
- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
