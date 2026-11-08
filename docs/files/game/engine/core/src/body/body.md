# `game/engine/core/src/body/body.ts`

## 内容

部位：目录（可复用定义）+ 蓝图（一棵树）+ 运行时实例。
parts.json   每个部件的数值：hp / coverage / armor / grants / slots
plans.json   把部件组成一棵树：parent、repeat、extends、delete
这里只做「解析 + 展开 + 校验」，不碰渲染和伤害；
伤害路由、血条投影在 systems 层用这份数据。

行数：258

## 接口

### 接口 `BodyPartDef`

```ts
interface BodyPartDef {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly coverage: number;
  readonly armor: number;
  readonly vital: boolean;
  readonly tags: readonly string[];
  readonly grants: Readonly<Record<string, number>>;
  readonly slots: readonly string[];
}
```

### 接口 `BodyPlanDef`

```ts
interface BodyPlanDef {
  readonly id: string;
  readonly extends?: string;
  readonly vital: "marked" | "all";
  readonly parts: readonly BodyPlanPart[];
}
```

### 接口 `BodyPlanPart`

```ts
interface BodyPlanPart {
  readonly id: string;
  readonly part: string;
  readonly parent?: string;
  readonly hp?: number;
  readonly coverage?: number;
  readonly armor?: number;
  readonly vital?: boolean;
  readonly tags?: readonly string[];
  readonly grants?: Readonly<Record<string, number>>;
  readonly slots?: readonly string[];
  readonly repeat?: number;
  readonly delete?: boolean;
}
```

### 函数 `capabilityOf`

```ts
function capabilityOf(plan: ResolvedBodyPlan, ability: string): number
```

### 函数 `parseBodyPart`

```ts
function parseBodyPart(raw: unknown, idKey: string): BodyPartDef
```

### 函数 `parseBodyPlan`

```ts
function parseBodyPlan(raw: unknown, idKey: string): BodyPlanDef
```

### 函数 `resolveBodyPlans`

```ts
function resolveBodyPlans( plans: ReadonlyMap<string, BodyPlanDef>, parts: ReadonlyMap<string, BodyPartDef>, ): Map<string, ResolvedBodyPlan>
```

### 接口 `ResolvedBodyPlan`

```ts
interface ResolvedBodyPlan {
  readonly id: string;
  readonly vital: "marked" | "all";
  readonly parts: ReadonlyArray<{
  readonly id: string;
  readonly part: string;
  readonly name: string;
  readonly parent: string | null;
  readonly hp: number;
  readonly coverage: number;
  readonly armor: number;
  readonly vital: boolean;
  readonly tags: readonly string[];
  readonly grants: Readonly<Record<string, number>>;
  readonly slots: readonly string[];
  }>;
}
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
