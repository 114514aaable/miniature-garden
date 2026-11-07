# `game/systems/host/writes.ts`

## 内容

数据写规则：按「参数名 + 变化方式」描述，而不是写死某个血量。
component   属性组（core.health / core.body / …）
field       参数名（hp / rage / *）
mode        set（原样）/ clamp（夹范围）
min/max     范围（max 也可以从同组另一个字段读：maxField）
deathAtOrBelow  写完落到这个值以下 → 这是「致死」，由宿主广播 core.death
一条规则只负责一个字段；多个规则可以同时挂在同一组上。

行数：100

## 接口

### 函数 `applyWriteRules`

```ts
function applyWriteRules( rules: readonly WriteRule[], write: EntityWrite, ): WriteOutcome | null
```

### 类型 `WriteMode`

```ts
type WriteMode = "set" | "clamp"
```

### 接口 `WriteOutcome`

```ts
interface WriteOutcome {
  readonly consume: boolean;
  readonly effects: readonly Effect[];
  readonly lethal: boolean;
}
```

### 接口 `WriteRule`

```ts
interface WriteRule {
  readonly component: string;
  readonly field: string;
  readonly mode: WriteMode;
  readonly min?: number;
  readonly max?: number;
  readonly maxField?: string;
  readonly deathAtOrBelow?: number;
}
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/systems/host/effects.ts`](game/systems/host/effects.md)

## 被引用

- [`game/systems/host/base-rules.ts`](game/systems/host/base-rules.md)
- [`tools/serve.mjs`](tools/serve.md)
