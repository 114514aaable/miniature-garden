# `game/systems/rules/index.ts`

## 内容

规则清单：一条规则 = 签名 + 处理器。
宿主用它注册；文档生成器用它列目录。
**只有这一处清单**——加规则只改这里，注册和文档自动跟上。

行数：38

## 接口

### 常量 `RULE_TABLE`

```ts
const RULE_TABLE: readonly RuleEntry[]
```

## 依赖

- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/enemy-actions.ts`](game/engine/core/src/rules/enemy-actions.md)
- [`game/engine/core/src/rules/inventory.ts`](game/engine/core/src/rules/inventory.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
- [`game/engine/core/src/rules/use.ts`](game/engine/core/src/rules/use.md)
- [`game/engine/core/src/rules/wait.ts`](game/engine/core/src/rules/wait.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)

## 被引用

- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/check-locale.mjs`](tools/check-locale.md)
- [`tools/gen-docs.mjs`](tools/gen-docs.md)
- [`tools/serve.mjs`](tools/serve.md)
