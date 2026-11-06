# `game/engine/core/src/time.ts`

## 内容

时间线：一个单调的时钟 + 它自己的记录。
为什么把「时钟」和「事件日志」合在一起？
因为分开时，`append(input, lTick, seq)` 允许调用方自己填时间——
于是「时钟说到第 5 步、事件说自己来自第 2 步」这种状态可以构造出来。
合并后，事件的 lTick 只能来自 now()，歧义在类型层面就消失了。
四条铁律：
1. 时间只有整数，只能前进。
2. 事件一旦写入不可修改；改了一定能被 verify 发现。
3. 事件的时间戳由时间线自己盖，调用方给不了。
4. 不读真实时间（Date.now / setTimeout 在模拟层是禁词）。
不在这里的东西（故意的）：
- 调度器：什么时候该调用 append，属于规则层。
- 世界时间（第几天、什么季节）：属于世界层，是 tick 的投影，能算就不存。

行数：183

## 接口

### 函数 `canonicalize`

```ts
function canonicalize(value: JsonValue): string
```

### 类型 `Handle`

```ts
type Handle = number
```

### 函数 `hashText`

```ts
function hashText(text: string): string
```

### 类型 `JsonValue`

```ts
type JsonValue = | string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue }
```

### 接口 `LogEntry`

```ts
interface LogEntry {
  readonly id: number;
  readonly lTick: Tick;
  readonly seq: number;
  readonly kind: string;
  readonly actor: Handle | null;
  readonly targets: readonly Handle[];
  readonly data: Readonly<Record<string, JsonValue>>;
  readonly prevHash: string;
  readonly hash: string;
}
```

### 接口 `LogEntryInput`

```ts
interface LogEntryInput {
  readonly kind: string;
  readonly actor?: Handle | null;
  readonly targets?: readonly Handle[];
  readonly data?: Readonly<Record<string, JsonValue>>;
}
```

### 类型 `Tick`

```ts
type Tick = number
```

### 函数 `verifyChain`

```ts
function verifyChain(events: readonly LogEntry[]): number
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/event/effects.ts`](game/engine/core/src/event/effects.md)
- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/pack/definitions.ts`](game/engine/core/src/pack/definitions.md)
- [`game/engine/core/src/pack/graph.ts`](game/engine/core/src/pack/graph.md)
- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/enemy-actions.ts`](game/engine/core/src/rules/enemy-actions.md)
- [`game/engine/core/src/rules/inventory.ts`](game/engine/core/src/rules/inventory.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
- [`game/engine/core/src/rules/talk.ts`](game/engine/core/src/rules/talk.md)
- [`game/engine/core/src/rules/use.ts`](game/engine/core/src/rules/use.md)
- [`game/engine/core/src/rules/wait.ts`](game/engine/core/src/rules/wait.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/traversal/filter.ts`](game/engine/core/src/traversal/filter.md)
- [`game/engine/core/src/traversal/select.ts`](game/engine/core/src/traversal/select.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
- [`game/systems/intel/facts.ts`](game/systems/intel/facts.md)
- [`game/systems/log/devlog.ts`](game/systems/log/devlog.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)
