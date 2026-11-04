# 文档索引

> 给人和 AI 看的都在这。**先读哪份**取决于你要做什么。

| 想做什么 | 读这份 |
|---|---|
| 写一个世界包（第一次） | [pack-guide.md](pack-guide.md) |
| 查 world.json 的字段 | [world-format.md](world-format.md) |
| 查某个规则/组件/模板的契约 | [modules/README.md](modules/README.md)（机器可读：[modules/index.json](modules/index.json)） |
| 现在做到哪了、下一步做什么 | [status.md](status.md) |
| 理解整体设计 | [architecture.md](architecture.md) |
| 看要做什么、不做什么 | [requirements.md](requirements.md) |
| 事件与效果的契约细节 | [packet-contract.md](packet-contract.md) |
| 文件之间谁引用谁 | [dependency-tree.md](dependency-tree.md)（自动生成） |
| 世界包之间谁引用谁 | [pack-graph.md](pack-graph.md)（自动生成，Mermaid） |
| 某个文件是干什么的 | [files/README.md](files/README.md)（每文件一篇，自动生成） |

## 按任务找文档

| 我要… | 读 |
|---|---|
| 给世界加个物品 / 敌人 | [areas/worlds.md](areas/worlds.md) |
| 加一条新规则 | [areas/rules.md](areas/rules.md) |
| 动伤害 / 敌人行为 | [systems/combat.md](systems/combat.md) |
| 让道具能用 / 改背包 | [systems/items.md](systems/items.md) |
| 改回合、先手、延迟动作 | [systems/turn.md](systems/turn.md) |
| 改内核（时间/存储/实体） | [areas/engine-core.md](areas/engine-core.md) |
| 查某个规则/组件的参数 | [modules/README.md](modules/README.md) |
| 改存档 / 读档 / 槽位 | [systems/save.md](systems/save.md) |
| 改界面与套件 | [areas/ui.md](areas/ui.md) |
| 改渲染管线 / 贴图 | [areas/render.md](areas/render.md) |
| 加接口 / 改启动流程 | [areas/host.md](areas/host.md) |
| 做视野 / 迷雾 / 潜行 | [systems/perception.md](systems/perception.md) |
| 让 AI 读写世界 | [systems/agent.md](systems/agent.md) |
| 做战斗/对话/商店等玩法状态 | [systems/scenes.md](systems/scenes.md) |
| 做地图/建筑/群系生成 | [systems/worldgen.md](systems/worldgen.md) |
| 管「谁能过什么地形」 | [systems/movement.md](systems/movement.md) |

## 阅读约定

- 每篇**只在开头告诉你「什么时候该读它」**，读到一半不会跳走；
- 每篇**末尾有「相关（先别读，用到再看）」**——知道边界在哪，但不用现在点；
- 篇幅跟复杂度走：能一句话说清的给[卡片](modules/README.md)，跨层的给[体系](systems/combat.md)。

## 自动生成，别手改

- `docs/modules/` 全部由 `node tools/gen-docs.mjs` 生成；
- 名字与介绍来自 `game/locales/zh-CN.json`；
- 参数来自规则签名，schema 来自包定义。

改文档 = 改语言包或改代码，然后重新生成。

## 给 AI 的最短路径

```
1. docs/modules/index.json        筛出要用的模块
2. docs/modules/<那几篇>.md       读契约
3. docs/pack-guide.md             照着写包
4. node tools/play.mjs 验证
```
