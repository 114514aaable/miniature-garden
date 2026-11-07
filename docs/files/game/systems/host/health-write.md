# `game/systems/host/health-write.ts`

## 内容

数据写规则（第一套）：核心血量的数值变化。
它只做三件事：
1  只认 core.health
2  把新血量夹在 0..max 之间
3  保留属性组里的其它字段（比如 max）
死亡不在这里：规则层致死时直接发 despawn，不会写 hp<=0。
以后「部位」只需要换掉这条规则，入口不变。

行数：55

## 接口

### 函数 `healthWrite`

```ts
function healthWrite(write: EntityWrite): WriteResult | null
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/systems/host/effects.ts`](game/systems/host/effects.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
