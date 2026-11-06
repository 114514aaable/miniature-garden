# `game/engine/core/src/event/view.ts`

## 内容

只读视图：规则看世界的唯一通道。
为什么不直接把 Space / EntityTable 交出去：它们有写方法，
规则拿到就能绕过 store 直接改世界，账本就废了。
视图还负责两件「语义」的事：
1. 某个格子能不能走（地形含义在世界里，不在代码里）；
2. 实体的**合并后组件**（模板默认值 + 实例覆盖）。
规则要查 core.solid / core.body，必须看到合并后的数据。

行数：158

## 接口

### 函数 `createWorldView`

```ts
function createWorldView(spaces: Iterable<Space>, options: ViewOptions): WorldView
```

### 接口 `EntitySource`

```ts
interface EntitySource {
  get(handle: Handle): Entity;
}
```

### 接口 `SpaceView`

```ts
interface SpaceView {
  readonly id: SpaceId;
  readonly width: number;
  readonly height: number;
  terrainAt(cell: Cell): number;
  occupantsAt(cell: Cell): readonly number[];
  passableAt(cell: Cell): boolean;
  each(origin: Cell, offsets: readonly Offset[], visit: (cell: Cell) => void): void;
}
```

### 接口 `TerrainRule`

```ts
interface TerrainRule {
  readonly passable: boolean;
}
```

### 接口 `ViewOptions`

```ts
interface ViewOptions {
  readonly tick: number;
  readonly entities?: EntitySource;
  readonly terrains?: ReadonlyMap<number, TerrainRule>;
  readonly templates?: TemplateRegistry;
}
```

### 接口 `WorldView`

```ts
interface WorldView {
  readonly tick: number;
  space(id: SpaceId): SpaceView;
  entity(handle: Handle): EntityView;
}
```

## 依赖

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/entity/place.ts`](game/engine/core/src/entity/place.md)
- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/rules/collision.ts`](game/engine/core/src/rules/collision.md)
- [`tools/serve.mjs`](tools/serve.md)
