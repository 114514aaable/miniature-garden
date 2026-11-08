# `game/engine/core/src/worldgen/variants.ts`

## 内容

开局选生成器：世界包提供一组「生成方案」，玩家在开始菜单里挑。
generation.pipeline            默认方案
generation.variants            可选方案（名字 → 一串算子）
选不到就退回默认；连默认都没有就报错，不静默生成空图。

行数：52

## 接口

### 接口 `GenerationConfig`

```ts
interface GenerationConfig {
  readonly pipeline?: readonly Step[];
  readonly variants?: Readonly<Record<string, readonly Step[]>>;
}
```

### 接口 `PickedPipeline`

```ts
interface PickedPipeline {
  readonly name: string;
  readonly steps: readonly Step[];
}
```

### 函数 `pickPipeline`

```ts
function pickPipeline( generation: GenerationConfig, generator: string | undefined, ): PickedPipeline
```

## 依赖

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
