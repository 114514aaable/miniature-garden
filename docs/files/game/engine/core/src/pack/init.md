# `game/engine/core/src/pack/init.ts`

## 内容

开局初始化：世界建好之后，按顺序执行世界包声明的 init。
为什么放在引擎而不是宿主：`play.mjs`、`serve.mjs`、以后的地图生成器
都应该看到同一个开局。放在宿主里，各宿主就会各自实现一遍，迟早不一致。
目前支持两种条目：
- 普通效果（spawn / patch / terrain / …），原样提交；
- stamp：按预制件把一组实体盖下去（host 之外唯一需要「认识 groups」的地方）。

行数：73

## 接口

### 函数 `applyInit`

```ts
function applyInit(store: Store, loaded: LoadedWorld): void
```

## 依赖

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
