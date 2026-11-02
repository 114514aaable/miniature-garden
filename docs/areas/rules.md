# 规则（rules）

> 改这里如果：**你想让世界里多一种动作**。
> 改内核机制（时间、存储）→ 读 [`engine-core.md`](engine-core.md)。

## 一条规则 = 签名 + 处理器

```ts
// game/engine/core/src/rules/xxx.ts
export const xxxSignature: Signature = {
  tag: "core.xxx",
  params: { t: "object", fields: { actor: { t: "int" } } },
  result: { t: "any" },
  returnsEffects: true,
  skill: { name: "名字", cost: "attack", target: { kind: "entity", range: 1 } },
};

export function xxxHandler(params, context) {
  return { ok: true, effects: [ ... ] };
}
```

**注册只有一处**：`game/systems/rules/index.ts` 的 `RULE_TABLE`。
注册完还要在 `world.json` 的 `rules` 里启用——**不写就不加载**。

## 可用效果（effects）

```
terrain / place / remove / spawn / despawn / patch
```

`patch` 只能整体替换组件值；`core.place` 的 `null` 表示从世界移除。

## 不变量

1. 处理器**纯**：不读时钟、不写世界、不 await，只返回效果。
2. 拒绝时返回 `{ ok: false, reason: "..." }`，原因要能给人看。
3. 成本由 `clock.costs` 决定，不要硬编码回合数。
4. 需要「过几回合再做」用 `core.pending`（见 `rules/pending.ts`），不要自己加计时状态。

## 加一条新规则的完整步骤

```
1. game/engine/core/src/rules/xxx.ts      写签名 + 处理器
2. game/engine/core/src/rules/xxx.test.ts 写测试（纯函数，好测）
3. game/systems/rules/index.ts            加进 RULE_TABLE
4. game/worlds/*/world.json               在 rules 里启用
5. game/locales/zh-CN.json                加 rule.core.xxx.name/.desc
6. node tools/gen-docs.mjs                重新生成模块文档
```

## 现有规则速查

| tag | 做什么 |
|---|---|
| `core.move` | 走一步，成本看速度 |
| `core.attack` | 相邻格劈砍，伤害 = 攻击 − 防御 |
| `core.take` / `core.drop` | 捡起 / 放下 |
| `core.use` | 用物品，效果写在物品的 `core.use` 上 |
| `core.cast` | 蓄力：写 `core.pending`，到期结算 |
| `core.aim` | 判断某技能能不能落在某格（鼠标与 AI 共用） |
| `core.enemy_turn` / `_windup` / `_strike` | 敌人决策 / 起手 / 出手 |

## 坑

- 技能的成本键必须在 `clock.costs` 里存在，否则会报「未知成本」。
- 返回的 `next` 信封由宿主派发（一次），别自己递归。
- 打空目标要返回 `ok: true` + 空效果（落空也是一种结果），不要 `ok: false`。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [engine-core.md](engine-core.md) | 你要确认效果怎么被应用、组件怎么写 |
| [worlds.md](worlds.md) | 你要在包里启用新规则 |
| [../systems/combat.md](../systems/combat.md) | 你加的是战斗类规则 |
| [../modules/README.md](../modules/README.md) | 你要看现有规则的签名 |
