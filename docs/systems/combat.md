# 体系：战斗

> 改这里如果：**你要动伤害、命中、敌人行为、或者「打出去」这件事本身**。
> 只是加个新敌人 → 读 [`worlds.md`](../areas/worlds.md)，不用看这篇。

## 它由哪几块组成

```
规则层
  core.attack          玩家劈砍：找目标 → 算伤害 → 扣血
  core.aim             能不能落在这一格（鼠标高亮 + AI 共用）
  core.enemy_turn      敌人决策：靠近 / 起手 / 不动
  core.enemy_windup    写下 core.intent（几回合后、打哪几格、多少伤害）
  core.enemy_strike    到点结算意图，清空 intent

组件层
  core.health  { max, hp }
  core.stats   { speed, attack, defense }
  core.intent  { kind, tiles, damage, resolveAt }

表现层
  systems/render        把 intent.tiles 画成警告格（以后）
  快捷栏 / 点格子        发 core.attack 或 core.aim
```

## 一条完整路径

**玩家劈砍**：

```
点击格子
  → POST /api/skill { tag: "core.attack", x, y }
  → serve.useSkill() 组参数 { actor, x, y }
  → attackHandler()
      扫描目标格的占用者，找第一个带 core.health 的
      damage = max(0, attack - defense)
      返回 effects: [patch core.health { hp }]
  → store.submit(effects) → step(0)
  → snapshot → 浏览器 render()
```

**敌人出手**（延迟两回合）：

```
enemy_turn → 离得远就 move，相邻就 enemy_windup
enemy_windup → patch core.intent { tiles: [{dx,dy}], damage, resolveAt: tick+2 }
（两回合内玩家走开 = 打空）
enemy_strike → 读 intent.tiles，看玩家在不在里面 → 在就扣血
```

## 扩展点

| 想加什么 | 改哪里 |
|---|---|
| 命中率 / 暴击 | `attack.ts` 里用 `roll(seed, tick, tag)`，**不要** `Math.random` |
| 伤害公式（破防、元素） | `attack.ts` 的伤害计算；公式参数放模板的 `core.stats` |
| 攻击范围 / 形状 | 用 `core.aim` 的 `range` 与 `kind`，别在 `attack.ts` 里另写一套 |
| 状态效果（中毒/眩晕） | 加组件 + 每 tick 的阶段（`systems/tick/phases.ts`） |
| 敌人智商 | `ai.ts` 的决策顺序；**它只选信封，不改世界** |
| 打空/闪避 | 目标不在格子里就是落空（`ok: true` + 空效果），不要 `ok: false` |

## 边界

- **战斗不负责显示**。它只改组件，红格/血条是渲染层的事。
- **战斗不负责死亡**。血量到 0 之后是否 despawn 由模板/规则决定；
  玩家实体消失由宿主判定 `dead`（以后会升级成 `core.death` 事件）。
- **战斗不管时间**。回合成本来自 `clock.costs`，见 [`turn.md`](turn.md)。

## 验证

```bash
node --test --test-isolation=none
node tools/play.mjs game/worlds/official.base game/worlds/official.normal
```
实机：跑起来 → 走到敌人旁边 → 点它，看血量变化与日志。
