# `game/engine/core/src/worldgen/generators/generate.ts`

## 内容

生成一片地形：种子 + 尺寸 + 场参数 + 群系 → 地形号数组。
纯函数、确定性：同样的输入永远同样的地图。
离线工具（tools/gen-world.mjs）和开局现场生成都用它。
尺寸上限 200×200——再大就不是「故事地图」而是沙盒了。

行数：106

## 接口

### 函数 `clampSize`

```ts
function clampSize(value: number): number
```

### 接口 `FieldConfig`

```ts
interface FieldConfig {
  readonly noise?: NoiseKind;
  readonly scale?: number;
  readonly octaves?: number;
  readonly seedOffset?: number;
}
```

### 接口 `GenerateOptions`

```ts
interface GenerateOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly fields: Readonly<Record<string, FieldConfig>>;
  readonly biomes: readonly Biome[];
  readonly terrainIdByCode: ReadonlyMap<string, number>;
  readonly levels?: { readonly water?: number; readonly hill?: number };
}
```

### 接口 `GenerateResult`

```ts
interface GenerateResult {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly number[];
  readonly stats: Readonly<Record<string, number>>;
}
```

### 函数 `generateTerrain`

```ts
function generateTerrain(options: GenerateOptions): GenerateResult
```

### 常量 `MAX_SIZE`

```ts
const MAX_SIZE
```

### 常量 `MIN_SIZE`

```ts
const MIN_SIZE
```

## 依赖

- [`game/engine/core/src/worldgen/generators/select.ts`](game/engine/core/src/worldgen/generators/select.md)
- [`game/engine/core/src/worldgen/noise.ts`](game/engine/core/src/worldgen/noise.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
- [`tools/serve.mjs`](tools/serve.md)
