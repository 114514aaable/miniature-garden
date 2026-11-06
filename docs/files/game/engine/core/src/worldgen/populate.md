# `game/engine/core/src/worldgen/populate.ts`

## 内容

实体投放：按「房间 / 走廊 / 死胡同」的规则往实体图里放东西。
room      落在带指定标签的房间里
corridor  落在房间之外的地板上
deadend   四周只有一个出口的地板（放宝箱/神龛最合适）
floor     任意地板
规则：
- 不压墙（只选地板）
- avoid: start 会在出生点周围留一圈空地
- once：同一间房最多放一个
- 不限制一格几个（先不控制，靠规则自己错开）

行数：132

## 接口

### 函数 `populate`

```ts
function populate( sandbox: Sandbox, spec: PopulateSpec, seed: number, floorId: number, ): { placed: number; warnings: string[] }
```

### 接口 `PopulateRule`

```ts
interface PopulateRule {
  readonly where: "room" | "corridor" | "deadend" | "floor";
  readonly tags?: readonly string[];
  readonly templates: Readonly<Record<string, number>>;
  readonly density?: number;
  readonly once?: boolean;
  readonly avoid?: readonly "start"[];
  readonly startClear?: number;
}
```

### 接口 `PopulateSpec`

```ts
interface PopulateSpec {
  readonly rules: readonly PopulateRule[];
}
```

## 依赖

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
