# `game/engine/core/src/worldgen/generators/tiles.ts`

## 内容

拼贴：把 7×7 的房间件按「门口」贴成一张图。
规则：
每个 meta 格需要开哪几条边 = 它在网格里的邻居
候选件里挑「门集合恰好相等」的（可旋转 0/90/180/270）
挑不到 → 程序化挖一个刚好这些开口的十字格（兜底）
门连接是自动的：相邻两格都开同一条边，门就在边界上对齐。

行数：289

## 接口

### 函数 `bestRotation`

```ts
function bestRotation( def: StructureDef, required: ReadonlySet<Side>, boundary: ReadonlySet<Side> = new Set(), ): { def: StructureDef; extras: Set<Side> } | null
```

### 函数 `findRotation`

```ts
function findRotation( def: StructureDef, required: ReadonlySet<Side>, boundary: ReadonlySet<Side> = new Set(), ): StructureDef | null
```

### 函数 `placeTiles`

```ts
function placeTiles( terrain: number[], width: number, height: number, defs: ReadonlyMap<string, StructureDef>, ids: readonly string[], seed: number, terrainIdByCode: ReadonlyMap<string, number>, ): { placements: TilePlacement[]; spawns: SpawnRequest[]; warnings: string[] }
```

### 函数 `portsOf`

```ts
function portsOf(def: StructureDef): Set<Side>
```

### 函数 `rotateStructure`

```ts
function rotateStructure(def: StructureDef): StructureDef
```

### 接口 `TilePlacement`

```ts
interface TilePlacement {
  readonly tile: string;
  readonly metaX: number;
  readonly metaY: number;
  readonly fallback: boolean;
}
```

## 依赖

- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)

## 被引用

- [`game/engine/core/src/worldgen/generators/layout.ts`](game/engine/core/src/worldgen/generators/layout.md)
- [`game/engine/core/src/worldgen/generators/sprawl.ts`](game/engine/core/src/worldgen/generators/sprawl.md)
- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
