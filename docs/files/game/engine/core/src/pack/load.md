# `game/engine/core/src/pack/load.ts`

## 内容

加载器：把合并后的内容池变成运行时对象。
它做五件事：
1. 按 kind 分派（space / template / entity / terrain / world），未知 kind 直接拒绝；
2. 字符串 id → 数字句柄（空间号、地形号），这就是「重定位」；
3. 建 Space、TemplateRegistry、实体列表、地形表；
4. 整体校验：引用闭合、坐标合法、地形都已声明、出生点能站；
5. 收集世界启用的规则标签——包负责选，宿主负责实现。

行数：348

## 接口

### 接口 `ComponentSpec`

```ts
interface ComponentSpec {
  readonly name: string;
  readonly schema: Schema;
}
```

### 接口 `LoadedEntity`

```ts
interface LoadedEntity {
  readonly template: string;
  readonly space: SpaceId;
  readonly pos: Cell;
  readonly overrides: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `LoadedWorld`

```ts
interface LoadedWorld {
  readonly spaces: readonly Space[];
  readonly templates: TemplateRegistry;
  readonly entities: readonly LoadedEntity[];
  readonly terrains: ReadonlyMap<number, TerrainDef>;
  readonly start: { readonly space: SpaceId; readonly pos: Cell };
  readonly startWarning?: string;
  readonly spaceIds: ReadonlyMap<string, SpaceId>;
  readonly rules: readonly string[];
  readonly rulesExplicit: boolean;
  readonly init: readonly JsonValue[];
  readonly persistence: { readonly activeRadius: number; readonly sweepEvery: number };
  readonly traversal: TraversalSpec;
  readonly biomes: readonly BiomeDef[];
  readonly groups: ReadonlyMap<string, GroupDef>;
  readonly bodyParts: ReadonlyMap<string, BodyPartDef>;
  readonly bodyPlans: ReadonlyMap<string, ResolvedBodyPlan>;
}
```

### 函数 `loadWorld`

```ts
function loadWorld( merged: MergedWorld, components: readonly ComponentSpec[] = [], ): LoadedWorld
```

## 依赖

- [`game/engine/core/src/body/body.ts`](game/engine/core/src/body/body.md)
- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/pack/definitions.ts`](game/engine/core/src/pack/definitions.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)

## 被引用

- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
