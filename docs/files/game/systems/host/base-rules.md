# `game/systems/host/base-rules.ts`

## 内容

基础数据写规则：核心血量的 hp 夹在 0..max，写到 0 视为致死。
这只是一份「数据」——部位模式会用它自己的一套规则替换，
拦截入口和致死广播都不变。

行数：23

## 接口

### 常量 `baseWriteRules`

```ts
const baseWriteRules: readonly WriteRule[]
```

## 依赖

- [`game/systems/host/writes.ts`](game/systems/host/writes.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
