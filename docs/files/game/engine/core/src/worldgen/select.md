# `game/engine/core/src/worldgen/select.ts`

## 内容

选：把「若干场」翻译成「群系」，再把群系翻译成「地形」。
两条规则：
1. 群系按声明顺序取第一个匹配（顺序有意义）；
2. 地形按高度分档：水 / 山 / 底 —— 阈值来自生成器配置。
这里不碰文件、不碰随机，纯数据进纯数据出。

行数：74

## 接口

### 接口 `Biome`

```ts
interface Biome {
  readonly id: string;
  readonly ranges: BiomeRange;
  readonly terrain: Readonly<Record<string, string>>;
  readonly structures?: readonly string[];
  readonly tags?: readonly string[];
  readonly color?: string;
}
```

### 接口 `BiomeRange`

```ts
interface BiomeRange {
  readonly [field: string]: readonly [number, number];
}
```

### 函数 `matchesRange`

```ts
function matchesRange(range: BiomeRange, sample: Sample): boolean
```

### 函数 `pickBiome`

```ts
function pickBiome(biomes: readonly Biome[], sample: Sample): Biome | null
```

### 类型 `Sample`

```ts
type Sample = Readonly<Record<string, number>>
```

### 函数 `terrainFor`

```ts
function terrainFor(biome: Biome, height: number, levels: TerrainLevels = {}): string | null
```

### 接口 `TerrainLevels`

```ts
interface TerrainLevels {
  readonly water?: number;
  readonly hill?: number;
}
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/worldgen/generate.ts`](game/engine/core/src/worldgen/generate.md)
- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
