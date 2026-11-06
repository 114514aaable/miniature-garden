# `game/engine/core/src/worldgen/rooms.ts`

房间布局：BSP 分区 → 每个矩形里放一个 room 结构 → 走廊连起来。

## 导出

- `Rect`
- `RoomPlacement`
- `RoomSpec`
- `partition`
- `placeRooms`

## 依赖

- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
