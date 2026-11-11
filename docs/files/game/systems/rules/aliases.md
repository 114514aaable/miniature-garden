# `game/systems/rules/aliases.ts`

## 内容

旧 tag 的别名表。
改 tag 是必要的（core.* → base.*），但会打断三类引用：
1. 世界包 world.json 的 rules 列表
2. 存档里的 disabled 列表
3. 浏览器里存的快捷栏绑定
所以启动时统一过一遍别名表——**一处映射，三处引用都不用改**。

行数：29

## 接口

### 常量 `LEGACY_TAGS`

```ts
const LEGACY_TAGS: Readonly<Record<string, string>>
```

### 函数 `resolveTag`

```ts
function resolveTag(tag: string): string
```

### 函数 `resolveTags`

```ts
function resolveTags(tags: readonly string[]): string[]
```

## 依赖

（无）

## 被引用

- [`game/systems/config/config.ts`](game/systems/config/config.md)
- [`game/systems/host/rules.ts`](game/systems/host/rules.md)
- [`tools/serve.mjs`](tools/serve.md)
