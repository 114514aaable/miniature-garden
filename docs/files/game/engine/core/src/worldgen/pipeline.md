# `game/engine/core/src/worldgen/pipeline.ts`

## 内容

生成流水线：把生成算法拆成「一步一个算子」，串起来跑。
为什么不再用 generation.generator 二选一：
地下洞窟 = 地表（噪声+群系） + 洞穴遮罩 + 混合
需要「多层叠加」，而不是「换一个生成器」。
约定：
- 每个算子只改传入的 sandbox（地形数组 + 具名图层），不返回新世界；
- 算子之间只通过 sandbox 的图层名交流（"biome" / "cave" …）；
- 全部纯函数 + 确定性，同一份输入永远同一张图。

行数：460

## 接口

### 常量 `CAVE_LAYER`

```ts
const CAVE_LAYER
```

### 函数 `createSandbox`

```ts
function createSandbox(seed: number, width: number, height: number, fill: number): Sandbox
```

### 接口 `EntityPlacement`

```ts
interface EntityPlacement {
  readonly template: string;
  readonly tags: readonly string[];
  readonly source: string;
}
```

### 接口 `PipelineDeps`

```ts
interface PipelineDeps {
  readonly biomes: readonly Biome[];
  readonly terrainIdByCode: ReadonlyMap<string, number>;
  readonly structures?: ReadonlyMap<string, StructureDef>;
  readonly start?: { readonly x: number; readonly y: number };
}
```

### 函数 `runPipeline`

```ts
function runPipeline( sandbox: Sandbox, steps: readonly Step[], deps: PipelineDeps, ): Sandbox
```

### 接口 `Sandbox`

```ts
interface Sandbox {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  terrain: number[];
  readonly layers: Map<string, readonly number[]>;
  biome: number[];
  spawns: SpawnRequest[];
  readonly entities: Map<number, EntityPlacement[]>;
  readonly regions: { rooms: SpaceRoom[] };
  start: { x: number; y: number } | null;
}
```

### 接口 `SpaceRoom`

```ts
interface SpaceRoom {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tags: readonly string[];
  readonly structure: string;
}
```

### 类型 `Step`

```ts
type Step = | { readonly op: "overworld"; readonly fields?: Record<string, FieldConfig>; readonly levels?: { water?: number; hill?: number } } | { readonly op: "caves"; /** 墙 / 地板的地形代号（默认 wall / floor）。 */ readonly wall?: string; readonly floor?: string; readonly fill?: number; readonly iterations?: number; readonly spawnClear?: number; readonly regions?: number; readonly chambers?: number; /** 图层名，默认 "cave"。 */ readonly as?: string; } | { readonly op: "maze"; /** 墙 / 通道的地形代号（默认 wall / floor）。 */ readonly wall?: string; readonly floor?: string; /** 0..1：死胡同打通比例。 */ readonly braid?: number; readonly inset?: number; } | { readonly op: "populate"; /** 投放规则（按房间 / 走廊 / 死胡同）。 */ readonly rules: readonly import("./populate.ts").PopulateRule[]; } | { readonly op: "sprawl"; /** 候选房间件（role = room，尺寸随意）。 */ readonly rooms: readonly string[]; readonly count?: number; readonly tries?: number; readonly margin?: number; readonly corridor?: string; readonly widen?: number; } | { readonly op: "layout"; /** 走廊格可用的 7×7 件。 */ readonly tiles: readonly string[]; /** 大房间数量。 */ readonly rooms?: number; readonly roomMin?: readonly [number, number]; readonly roomMax?: readonly [number, number]; readonly loops?: number; } | { readonly op: "tiles"; /** 候选 7×7 件。 */ readonly tiles: readonly string[]; } | { readonly op: "rooms"; /** 候选房间结构（role = room）。 */ readonly structures: readonly string[]; readonly count?: number; readonly minSize?: readonly [number, number]; readonly maxSize?: readonly [number, number]; readonly corridor?: string; readonly connect?: "anchors" | "centers"; readonly inset?: number; readonly margin?: number; /** 额外环路比例（0..1）。 */ readonly loops?: number; } | { readonly op: "place"; readonly structures: readonly string[]; readonly count?: number; readonly spacing?: number; readonly on?: readonly string[]; readonly inset?: number; readonly tries?: number; } | { readonly op: "blend"; /** 用哪个洞穴图层。 */ readonly cave?: string; /** 洞穴里「地」用哪个地形代号。 */ readonly floor?: string; /** 洞穴里「墙」怎么处理：keep = 保留地表，solid = 变成墙。 */ readonly wall?: "keep" | "solid"; /** 洞穴只在一个矩形范围内生效（可选）。 */ readonly inset?: number; }
```

## 依赖

- [`game/engine/core/src/worldgen/generators/caves.ts`](game/engine/core/src/worldgen/generators/caves.md)
- [`game/engine/core/src/worldgen/generators/generate.ts`](game/engine/core/src/worldgen/generators/generate.md)
- [`game/engine/core/src/worldgen/generators/layout.ts`](game/engine/core/src/worldgen/generators/layout.md)
- [`game/engine/core/src/worldgen/generators/maze.ts`](game/engine/core/src/worldgen/generators/maze.md)
- [`game/engine/core/src/worldgen/generators/rooms.ts`](game/engine/core/src/worldgen/generators/rooms.md)
- [`game/engine/core/src/worldgen/generators/select.ts`](game/engine/core/src/worldgen/generators/select.md)
- [`game/engine/core/src/worldgen/generators/sprawl.ts`](game/engine/core/src/worldgen/generators/sprawl.md)
- [`game/engine/core/src/worldgen/generators/tiles.ts`](game/engine/core/src/worldgen/generators/tiles.md)
- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)

## 被引用

- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
- [`tools/serve.mjs`](tools/serve.md)
