# 模块目录（自动生成）

> 由 `node tools/gen-docs.mjs` 生成。**不要手改**——改语言包或代码。

规则 13 条 · 组件 14 个 · 模板 5 个

| 类型 | 名字 | id | 说明 |
|---|---|---|---|
| 规则 | [走一步](rule-core.move.md) | `core.move` | 朝一个方向移动一格，成本由速度决定。 |
| 规则 | [捡起](rule-core.take.md) | `core.take` | 把脚下的物品放进背包。 |
| 规则 | [放下](rule-core.drop.md) | `core.drop` | 把背包里的第一件物品放到脚下。 |
| 规则 | [等待](rule-core.wait.md) | `core.wait` | 什么都不做，只让时间前进一回合。 |
| 规则 | [指向](rule-core.aim.md) | `core.aim` | 判断某个技能能不能落在指定的格子上，供鼠标与 AI 共用。 |
| 规则 | [使用](rule-core.use.md) | `core.use` | 把背包里的东西用出去，效果由物品自己声明。 |
| 规则 | [敌人思考](rule-core.enemy_turn.md) | `core.enemy_turn` | 敌人每回合选一个动作：靠近、起手、或原地不动。 |
| 规则 | [敌人起手](rule-core.enemy_windup.md) | `core.enemy_windup` | 敌人写下攻击意图，两回合后才结算，期间可以被躲开。 |
| 规则 | [敌人出手](rule-core.enemy_strike.md) | `core.enemy_strike` | 按意图里的格子结算伤害；玩家不在格子里就落空。 |
| 规则 | [劈砍](rule-base.attack.md) | `base.attack` | 攻击相邻格里的一个目标，伤害 = 攻击 − 防御。 |
| 规则 | [蓄力劈砍](rule-base.cast.md) | `base.cast` | 先挂起，过几回合再结算；期间可以被打断。 |
| 规则 | [交谈](rule-base.talk.md) | `base.talk` | 和旁边的角色说话；对话不花时间。 |
| 规则 | [横扫](rule-base.sweep.md) | `base.sweep` | 打自己周围一圈里所有活着的目标。 |
| 组件 | [生命](component-core.health.md) | `core.health` | 血量：最大生命与当前生命。 |
| 组件 | [属性](component-core.stats.md) | `core.stats` | 速度、攻击、防御。速度决定动作成本。 |
| 组件 | [部位](component-core.body.md) | `core.body` | 分部位的血量与状态，供以后的部位战斗使用。 |
| 组件 | [物品](component-core.item.md) | `core.item` | 可拾取、可堆叠、可使用的标记。 |
| 组件 | [物品栏](component-core.container.md) | `core.container` | 格位与其中的物品句柄。 |
| 组件 | [智能](component-core.ai.md) | `core.ai` | 有它就会被调度器接管，每回合自行行动。 |
| 组件 | [实心](component-core.solid.md) | `core.solid` | 占住格子，别人走不过来。 |
| 组件 | [贴图](component-core.sprite.md) | `core.sprite` | 指向图集里的一帧；没有就退回字符。 |
| 组件 | [意图](component-core.intent.md) | `core.intent` | 敌人下回合要打的格子与结算时刻，绘制和判定共用。 |
| 组件 | [挂起](component-core.pending.md) | `core.pending` | 过几回合才结算的动作（蓄力、延迟陷阱）。 |
| 组件 | [用法](component-core.use.md) | `core.use` | 这东西怎么用：效果列表 + 是否消耗。 |
| 组件 | [对话](component-core.dialog.md) | `core.dialog` | 这个角色能说什么（脚本 id）。 |
| 组件 | [阵营](component-core.disposition.md) | `core.disposition` | 敌对 / 中立 / 友好，决定点击默认行为。 |
| 组件 | [存在感](component-core.persistence.md) | `core.persistence` | 锚定 / 普通 / 短暂：决定离得远时要不要继续留在世界里。 |
| 预制件 | camp | `camp` | 3 个实体 |
| 模板 | [你](template-pc.md) | `pc` | 玩家角色。 |
| 模板 | [木箱](template-prop_crate.md) | `prop_crate` | 实心障碍，挡路。 |
| 模板 | [油灯](template-item_lamp.md) | `item_lamp` | 一盏可以捡起来的灯。 |
| 模板 | [盐商](template-npc_salt.md) | `npc_salt` | 会靠近并起手打人的敌人。 |
| 模板 | [药水](template-item_potion.md) | `item_potion` | 喝一口，回满血。 |
