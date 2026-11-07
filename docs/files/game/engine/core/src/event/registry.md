# `game/engine/core/src/event/registry.ts`

## 内容

注册表：标签 → 签名，以及加载期的「链接」。
这一层只做三件事：
1. 登记签名（同一个标签登记两次就报错）；
2. 链接：按标签字典序分配整数编号（sym），产出不可变的链接表；
3. 算哈希：让「这份链接」成为世界身份的一部分。
为什么编号要按字典序：
同样一组标签，不管你在代码里先 define 谁，链接结果必须一样。
否则同一个世界包在两台机器上会得到不同的 sym，存档和回放全废。

行数：194

## 接口

### 类型 `ChannelCost`

```ts
type ChannelCost = Readonly<Record<string, number>>
```

### 常量 `CHANNELS`

```ts
const CHANNELS
```

### 接口 `LinkTable`

```ts
interface LinkTable {
  readonly tags: ReadonlyMap<string, number>;
  readonly signatures: readonly Signature[];
  readonly hash: string;
}
```

### 常量 `MAX_SEQUENCE_TICKS`

```ts
const MAX_SEQUENCE_TICKS
```

### 接口 `Signature`

```ts
interface Signature {
  readonly tag: string;
  readonly params: Schema;
  readonly result: Schema;
  readonly returnsEffects: boolean;
  readonly needsTimestamp: boolean;
  readonly uses?: ChannelCost;
  readonly time?: SkillTime;
  readonly skill?: SkillMeta;
}
```

### 接口 `SkillMeta`

```ts
interface SkillMeta {
  readonly name: string;
  readonly cost: string;
  readonly target: {
  readonly kind: "cell" | "entity" | "self" | "area";
  readonly range: number;
  readonly component?: string;
  readonly filter?: string;
  readonly shape?: string;
  readonly anchor?: "self" | "cell";
  };
}
```

### 接口 `SkillTime`

```ts
interface SkillTime {
  readonly mode: TimeMode;
  readonly ticks?: number;
  readonly cancelable?: boolean;
}
```

### 类型 `TimeMode`

```ts
type TimeMode = "instant" | "staged" | "sequence"
```

## 依赖

- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/death.ts`](game/engine/core/src/rules/death.md)
- [`game/engine/core/src/rules/enemy-actions.ts`](game/engine/core/src/rules/enemy-actions.md)
- [`game/engine/core/src/rules/inventory.ts`](game/engine/core/src/rules/inventory.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
- [`game/engine/core/src/rules/talk.ts`](game/engine/core/src/rules/talk.md)
- [`game/engine/core/src/rules/use.ts`](game/engine/core/src/rules/use.md)
- [`game/engine/core/src/rules/wait.ts`](game/engine/core/src/rules/wait.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`tools/serve.mjs`](tools/serve.md)
