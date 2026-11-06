# `game/engine/core/src/worldgen/rooms.ts`

## 内容

房间布局：BSP 摆房间 → 门当顶点 → 修走廊把门连起来。
图模型：
顶点  门（坐标 + 朝向）
边    走廊（从一扇门出去，到另一扇门进来；只用来画线，通行仍是双向）
团    同一个房间的所有门两两可达（房间内部，不画线）
流程：
1  BSP 切矩形，每个矩形放一个 room 结构（门在外墙上）
2  房间之间按「最近的门对」做最小生成树，再补少量额外边做环路
3  每条边用 A* 修一条走廊（绕开房间内部）
4  图上验收 + 地形洪水填充验收
大房间不是「占 2×2 格」，而是「一个带 N 扇门的节点」。

行数：414

## 接口

### 函数 `partition`

```ts
function partition( width: number, height: number, minSize: readonly [number, number], seed: number, inset = 1, ): Rect[]
```

### 函数 `placeRooms`

```ts
function placeRooms( terrain: number[], width: number, height: number, defs: ReadonlyMap<string, StructureDef>, spec: RoomSpec, seed: number, terrainIdByCode: ReadonlyMap<string, number>, codeOfTerrain: (terrainId: number) => string | undefined, ): { placements: RoomPlacement[]; spawns: SpawnRequest[]; warnings: string[] }
```

### 接口 `Rect`

```ts
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
```

### 接口 `RoomDoor`

```ts
interface RoomDoor {
  readonly x: number;
  readonly y: number;
  readonly facing: string;
}
```

### 接口 `RoomPlacement`

```ts
interface RoomPlacement {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rect: Rect;
  readonly doors: ReadonlyArray<RoomDoor>;
  readonly tags: readonly string[];
}
```

### 接口 `RoomSpec`

```ts
interface RoomSpec {
  readonly structures: readonly string[];
  readonly count?: number;
  readonly minSize?: readonly [number, number];
  readonly maxSize?: readonly [number, number];
  readonly corridor?: string;
  readonly connect?: "anchors" | "centers";
  readonly inset?: number;
  readonly margin?: number;
  readonly loops?: number;
}
```

## 依赖

- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
