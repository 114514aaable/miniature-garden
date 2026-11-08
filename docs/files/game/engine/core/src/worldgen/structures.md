# `game/engine/core/src/worldgen/structures.ts`

## 内容

结构：带图例的字符画，摆进生成出来的地图里。
图例  { "#": { terrain: "wall" }, ".": { terrain: "floor" } }
地图  ["###", "#.#", "###"]
图例可以指向两种东西：
地形       {"#": { "terrain": "wall" }}
子结构     {"h": { "structure": "hut", "align": "center" }}
子结构在加载期展开成一份「地形矩阵 + 实体列表 + 门」——运行时只认展开后的样子。
引用不能成环（和模板 extends 同一道关）。
摆放（place / rooms）只输出：
地形改了哪些格、实体出生在哪、哪些格子被跳过（撞墙）

行数：496

## 接口

### 函数 `parseStructure`

```ts
function parseStructure(raw: unknown, idKey: string): RawStructure
```

### 接口 `Placement`

```ts
interface Placement {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
}
```

### 接口 `PlaceSpec`

```ts
interface PlaceSpec {
  readonly structures: readonly string[];
  readonly count?: number;
  readonly spacing?: number;
  readonly on?: readonly string[];
  readonly inset?: number;
  readonly tries?: number;
}
```

### 函数 `placeStructures`

```ts
function placeStructures( terrain: number[], width: number, height: number, defs: ReadonlyMap<string, StructureDef>, spec: PlaceSpec, seed: number, terrainIdByCode: ReadonlyMap<string, number>, codeOfTerrain: (terrainId: number) => string | undefined, warnings?: string[], ): { placements: Placement[]; spawns: SpawnRequest[] }
```

### 接口 `RawStructure`

```ts
interface RawStructure {
  readonly id: string;
  readonly role: "prop" | "room";
  readonly width: number;
  readonly height: number;
  readonly terrain: ReadonlyArray<string | null>;
  readonly subs: ReadonlyArray<{ readonly x: number; readonly y: number; readonly id: string; readonly align: "top-left" | "center" }>;
  readonly entities: ReadonlyArray<StructureEntity>;
  readonly anchors: ReadonlyArray<StructureAnchor>;
  readonly weight: number;
  readonly tags: readonly string[];
}
```

### 函数 `resolveStructures`

```ts
function resolveStructures(raws: ReadonlyMap<string, RawStructure>): Map<string, StructureDef>
```

### 接口 `SpawnRequest`

```ts
interface SpawnRequest {
  readonly template: string;
  readonly x: number;
  readonly y: number;
  readonly source: string;
}
```

### 函数 `stampStructure`

```ts
function stampStructure( terrain: number[], mapWidth: number, mapHeight: number, structure: StructureDef, originX: number, originY: number, terrainIdByCode: ReadonlyMap<string, number>, warnings?: string[], ): SpawnRequest[]
```

### 接口 `StructureAnchor`

```ts
interface StructureAnchor {
  readonly x: number;
  readonly y: number;
  readonly facing: string;
}
```

### 接口 `StructureDef`

```ts
interface StructureDef {
  readonly id: string;
  readonly role: "prop" | "room";
  readonly width: number;
  readonly height: number;
  readonly cells: ReadonlyArray<string | null>;
  readonly entities: ReadonlyArray<StructureEntity>;
  readonly anchors: ReadonlyArray<StructureAnchor>;
  readonly weight: number;
  readonly tags: readonly string[];
}
```

### 接口 `StructureEntity`

```ts
interface StructureEntity {
  readonly template: string;
  readonly x: number;
  readonly y: number;
}
```

## 依赖

- [`game/engine/core/src/worldgen/noise.ts`](game/engine/core/src/worldgen/noise.md)

## 被引用

- [`game/engine/core/src/worldgen/generators/layout.ts`](game/engine/core/src/worldgen/generators/layout.md)
- [`game/engine/core/src/worldgen/generators/rooms.ts`](game/engine/core/src/worldgen/generators/rooms.md)
- [`game/engine/core/src/worldgen/generators/sprawl.ts`](game/engine/core/src/worldgen/generators/sprawl.md)
- [`game/engine/core/src/worldgen/generators/tiles.ts`](game/engine/core/src/worldgen/generators/tiles.md)
- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
- [`tools/worldgen-structures.mjs`](tools/worldgen-structures.md)
