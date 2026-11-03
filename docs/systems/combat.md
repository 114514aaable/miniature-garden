# 体系：战斗

> 改这里如果：**你要动伤害、命中、敌人行为、或者「打出去」这件事本身**。
> 只是加个新敌人 → 读 [`worlds.md`](../areas/worlds.md)，不用看这篇。

## 它由哪几块组成

```
规则层
  base.attack          玩家劈砍：找目标 → 算伤害 → 扣血
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
  快捷栏 / 点格子        发 base.attack 或 core.aim
```

## 一条完整路径

**玩家劈砍**：

```
点击格子
  → POST /api/skill { tag: "base.attack", x, y }
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

## 意图的三种模式（`core.intent.mode`）

| mode | 行为 | 用来做什么 |
|---|---|---|
| `fixed`（默认） | 起手时把格子写死，玩家走出去就落空 | **推荐**：躲得掉，惩罚站桩 |
| `track` | 到点时转身追打，只要还在相邻格就命中 | 想做「难躲」的怪 |
| `require` | 不在格子里就收手（连动作都不发生） | 粪怪选项，默认别用 |

起手时写一次 `mode`，其余不变：

```json
{ "kind": "melee", "tiles": [{"dx":1,"dy":0}], "damage": 3, "mode": "track", "resolveAt": 9 }
```

**落空会被记进日志**（`core.enemy_strike 落空`）——玩家要能分清「他打偏了」和「他没出手」。

## 未来扩展：回合制战斗模块（RPG Maker 风格）

**不实现，只记录方向。** 因为时间本来就是离散的，回合制战斗是这套架构的「原生模式」。

映射关系：

| RPG Maker | 我们已有的 |
|---|---|
| 战斗场景 | 一个 space（换空间 = 换场景） |
| 站位 | 格子坐标（哪怕是假的 4×2） |
| 行动顺序 | `Scheduler`（readyAt = 敏捷的倒数） |
| 指令菜单 | UI 套件（按钮 / 浮层 / bar） |
| 每回合结算 | 阶段表 + 规则 |

需要新增的只有两样：

1. **`core.scene` 组件**：告诉宿主「现在该画哪个界面」（地图 / 战斗 / 对话）。
   没有它，界面是写死的。
2. **战斗包**：`core.battle` 组件 + `battle_start/command/resolve` 规则 + 战斗界面。

进场/退场就是 `core.place` 搬家：记录原空间与坐标 → 搬进 battle space → 打完搬回。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [turn.md](turn.md) | 你要改动作成本、蓄力、先手 |
| [items.md](items.md) | 你要做掉落、或让道具参与战斗 |
| [../areas/rules.md](../areas/rules.md) | 你要新写一条战斗规则 |
| [../modules/rule-base.attack.md](../modules/rule-base.attack.md) | 你要看劈砍的确切参数 |
