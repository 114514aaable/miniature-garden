# `game/engine/core/src/worldgen/caves.ts`

## 内容

元胞地牢：元胞自动机（cellular automata）挖洞穴。
和噪声不同，它是**迭代**出来的：
1. 按种子随机撒「墙」，玩家出生区域强制清空
2. 反复做「周围墙够多就是墙」的平滑
3. 只保留最大连通区，其余填死——保证地图走得通
确定性：初始撒点用 cellRandom(seed, x, y)，不用顺序随机。

行数：244

## 接口

### 接口 `CavesOptions`

```ts
interface CavesOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: number;
  readonly iterations?: number;
  readonly spawnClear?: number;
  readonly regions?: number;
  readonly chambers?: number;
}
```

### 接口 `CavesResult`

```ts
interface CavesResult {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly boolean[];
  readonly floorCount: number;
}
```

### 函数 `generateCaves`

```ts
function generateCaves(options: CavesOptions): CavesResult
```

## 依赖

- [`game/engine/core/src/worldgen/noise.ts`](game/engine/core/src/worldgen/noise.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
