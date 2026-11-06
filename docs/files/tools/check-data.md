# `tools/check-data.mjs`

## 内容

数据体检：数据化之后，规则要的字段，包里到底有没有。
起因：敌人伤害数据化后，AI 改成必须有 core.melee，
但模板没跟上——规则每回合静默返回「不知道打多重」，
表现出来就是「敌人不动手」，查了很久。
这里只做「组合看起来不对」的检查，不代替人工判断。
用法：node tools/check-data.mjs [世界 id]

行数：147

## 接口

（没有导出）
## 依赖

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`game/engine/core/src/rules/clock.ts`](game/engine/core/src/rules/clock.md)
- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)

## 被引用

（没有别的文件引用它）
