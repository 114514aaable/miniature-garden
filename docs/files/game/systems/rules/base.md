# `game/systems/rules/base.ts`

## 内容

base 包的规则：劈砍、蓄力劈砍。
**归属约定**（见 docs/systems/runtime.md）：
core.*   内核语义（目前只有 core.place）
base.*   base 包提供的基础玩法
<world>.* 世界专属
代码暂时还放在 engine/core/src/rules 里（我们只有这一个仓库）；
「冷加载」指的是：世界激活时才组装进运行时，而不是热更新。
以后 base 有自己的代码目录，这里就改成 import 那个目录。

行数：43

## 接口

### 常量 `BASE_RULES`

```ts
const BASE_RULES: readonly RuleEntry[]
```

### 接口 `RuleEntry`

```ts
interface RuleEntry {
  readonly signature: Signature;
  readonly handler: (params: JsonValue, context: EvaluateContext) => JsonValue;
}
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/death.ts`](game/engine/core/src/rules/death.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
- [`game/engine/core/src/rules/talk.ts`](game/engine/core/src/rules/talk.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
