# `game/engine/core/src/store.ts`

## 内容

Store：世界状态的唯一写入口。
它只做四件事：
1. 持有空间与实体；
2. 接收变更（submit），先排队，不动状态；
3. 在 tick 边界一次性应用（step），要么全成，要么全不成；
4. 每次应用都写进时间线——事件的时间由时间线盖，这里伪造不了。
它不知道「玩家按了什么键」，也不知道「这个技能该不该命中」。
那些是规则层的事：规则层把结果翻译成 Effect，Store 只负责安全地落地。
实体与空间占用必须在一个事务里改：改了实体位置却没改占用，就会出现
「人已经走了，索引里还留着他」的幽灵实体。

行数：465

## 接口

### 类型 `Effect`

```ts
type Effect = | { readonly kind: "terrain"; readonly space: SpaceId; readonly cell: Cell; readonly value: number } | { readonly kind: "place"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle } | { readonly kind: "remove"; readonly space: SpaceId; readonly cell: Cell; readonly handle: Handle } | { readonly kind: "spawn"; readonly space: SpaceId; readonly cell: Cell; readonly template: string; readonly overrides?: Readonly<Record<string, JsonValue>>; } | { readonly kind: "despawn"; readonly handle: Handle } | { /** * 改实体的组件数据：深合并到该组件的实例覆盖上。 * * 唯一特殊的是 `core.place`：它是「东西在哪」，空间索引靠它维护， * 所以内核必须认识这个名字。写它不仅改数据，还改索引。 */ readonly kind: "patch"; readonly handle: Handle; readonly component: string; readonly data: JsonValue; }
```

### 接口 `StoreOptions`

```ts
interface StoreOptions {
  readonly start?: Tick;
  readonly templates?: TemplateSource;
}
```

### 接口 `TemplateSource`

```ts
interface TemplateSource {
  has(id: string): boolean;
  componentNames?(templateId: string): readonly string[];
}
```

### 接口 `WorldState`

```ts
interface WorldState {
  readonly tick: number;
  readonly entities: EntityTableSnapshot;
  readonly spaces: ReadonlyArray<{ readonly id: SpaceId; readonly terrain: readonly number[] }>;
}
```

## 依赖

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/entity/place.ts`](game/engine/core/src/entity/place.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/event/effects.ts`](game/engine/core/src/event/effects.md)
- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`game/engine/core/src/rules/sum.ts`](game/engine/core/src/rules/sum.md)
- [`game/systems/host/effects.ts`](game/systems/host/effects.md)
- [`game/systems/host/writes.ts`](game/systems/host/writes.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
