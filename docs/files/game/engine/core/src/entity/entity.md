# `game/engine/core/src/entity/entity.ts`

## 内容

实体：世界里「一个东西」的最小记录。
它只有五样：句柄、模板、所在空间、位置、覆盖。
没有行为、没有方法、没有引用——行为在 Event 管线的 handler 里，
这样存档、哈希、diff 都只是数据操作。
句柄带「代数」（generation）：
handle = index * 4096 + generation
槽位会被复用，但每次复用代数 +1，所以旧句柄永远不会碰巧指向新实体。
拿着已销毁实体的句柄去查，会当场报错，而不是悄悄返回一个陌生人。

行数：168

## 接口

### 接口 `Entity`

```ts
interface Entity {
  readonly handle: Handle;
  readonly template: string;
  readonly space: SpaceId | null;
  readonly pos: Cell | null;
  readonly overrides: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `EntitySlot`

```ts
interface EntitySlot {
  readonly generation: number;
  readonly entity: Entity | null;
}
```

### 接口 `EntityTableSnapshot`

```ts
interface EntityTableSnapshot {
  readonly slots: readonly EntitySlot[];
  readonly free: readonly number[];
}
```

### 常量 `GENERATIONS`

```ts
const GENERATIONS
```

### 类型 `Handle`

```ts
type Handle = number
```

### 函数 `handleGeneration`

```ts
function handleGeneration(handle: Handle): number
```

### 函数 `handleIndex`

```ts
function handleIndex(handle: Handle): number
```

### 函数 `makeHandle`

```ts
function makeHandle(index: number, generation: number): Handle
```

## 依赖

- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/entity/place.ts`](game/engine/core/src/entity/place.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
