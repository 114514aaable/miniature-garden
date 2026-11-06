# `game/engine/core/src/worldgen/noise.ts`

## 内容

噪声：把「种子 + 坐标」变成 0..1 的值。
三条约束：
1. **确定性**——同样的输入永远同样的输出，不存任何状态；
2. **每格独立**——可以按任意顺序算、可以并行；
3. 不用 Math.random，全用位运算（跨平台一致）。
值噪声是最底层；fbm / ridged 都是它的组合。

行数：112

## 接口

### 函数 `cellRandom`

```ts
function cellRandom(seed: number, x: number, y: number): number
```

### 函数 `fbm`

```ts
function fbm(seed: number, x: number, y: number, options: FbmOptions): number
```

### 接口 `FbmOptions`

```ts
interface FbmOptions {
  readonly scale: number;
  readonly octaves?: number;
  readonly persistence?: number;
}
```

### 常量 `NOISE_KINDS`

```ts
const NOISE_KINDS: readonly NoiseKind[]
```

### 类型 `NoiseKind`

```ts
type NoiseKind = "value" | "fbm" | "ridged"
```

### 函数 `noiseOf`

```ts
function noiseOf(kind: NoiseKind, seed: number, x: number, y: number, scale: number, octaves = 4): number
```

### 函数 `ridged`

```ts
function ridged(seed: number, x: number, y: number, options: FbmOptions): number
```

### 函数 `valueNoise`

```ts
function valueNoise(seed: number, x: number, y: number, scale: number): number
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/worldgen/caves.ts`](game/engine/core/src/worldgen/caves.md)
- [`game/engine/core/src/worldgen/generate.ts`](game/engine/core/src/worldgen/generate.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
