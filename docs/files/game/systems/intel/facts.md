# `game/systems/intel/facts.ts`

## 内容

情报：关于一个实体或一个格子，我们「知道什么」。
这里只有事实，没有像素、没有坐标、没有颜色。
两种呈现消费它：
overlay.ts  常驻：预警格、脚底血条、蓄力条（世界坐标）
probe.ts    按需：悬停信息槽（屏幕坐标）
统一在这里的好处：**文字和图形说的永远是同一件事**。

行数：156

## 接口

### 接口 `CellFacts`

```ts
interface CellFacts {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainFacts;
  readonly entities: readonly EntityFacts[];
}
```

### 函数 `entityFacts`

```ts
function entityFacts(input: EntityInput, context: FactsContext): EntityFacts
```

### 接口 `EntityFacts`

```ts
interface EntityFacts {
  readonly handle: number;
  readonly template: string;
  readonly name: string;
  readonly description: string;
  readonly health?: HealthFacts;
  readonly intent?: IntentFacts;
  readonly pending?: PendingFacts;
}
```

### 接口 `EntityInput`

```ts
interface EntityInput {
  readonly handle: number;
  readonly template: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `FactsContext`

```ts
interface FactsContext {
  readonly now: number;
  readonly label: (kind: "template" | "terrain", id: string | number) => string;
  readonly describe: (template: string) => string;
}
```

### 函数 `healthFacts`

```ts
function healthFacts(raw: JsonValue | undefined): HealthFacts | undefined
```

### 接口 `HealthFacts`

```ts
interface HealthFacts {
  readonly cur: number;
  readonly max: number;
  readonly ratio: number;
  readonly hurt: boolean;
  readonly critical: boolean;
}
```

### 函数 `intentFacts`

```ts
function intentFacts(raw: JsonValue | undefined, now: number): IntentFacts | undefined
```

### 接口 `IntentFacts`

```ts
interface IntentFacts {
  readonly tiles: ReadonlyArray<{ readonly dx: number; readonly dy: number }>;
  readonly damage: number;
  readonly inTicks: number;
  readonly totalTicks: number;
}
```

### 函数 `pendingFacts`

```ts
function pendingFacts(raw: JsonValue | undefined, now: number): PendingFacts | undefined
```

### 接口 `PendingFacts`

```ts
interface PendingFacts {
  readonly done: number;
  readonly total: number;
  readonly ratio: number;
}
```

### 接口 `TerrainFacts`

```ts
interface TerrainFacts {
  readonly id: number;
  readonly name: string;
}
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/intel/overlay.ts`](game/systems/intel/overlay.md)
- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
