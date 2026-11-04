# 世界格式（world.json）

> 这是**世界自身的声明**。包怎么组织见 [pack-guide.md](pack-guide.md)；
> 模块契约见 [modules/](modules/README.md)。

## 完整字段

```json
{
  "start": { "space": "field", "x": 1, "y": 1 },
  "rules": ["core.move", "base.attack", "base.talk"],
  "init": [{ "kind": "stamp", "group": "camp", "space": "field", "x": 4, "y": 4 }],
  "persistence": { "activeRadius": 25, "sweepEvery": 50 },
  "onConflict": "error"
}
```

| 字段 | 必填 | 作用 |
|---|---|---|
| `start` | 是 | 出生点（空间名 + 坐标） |
| `rules` | 否 | 这个世界的玩法由哪些规则构成 |
| `init` | 否 | 开局一次性执行的效果（含 `stamp` 预制件） |
| `persistence` | 否 | 远处实体的处理策略 |
| `onConflict` | 否 | 同名定义冲突时：`error` / `warn` / `override` |

## rules：玩法清单

- **不写就不加载**。关掉一条规则 = 从这张表里去掉。
- tag 前缀是**归属**，不是命名游戏：

```
core.*    内核语义（目前只有 core.place 真正保留）
base.*    base 包提供的基础玩法（劈砍、蓄力、交谈）
<world>.* 世界专属
```

- 改 tag 会打断存档里的 `disabled` 列表与浏览器里的快捷栏——**必须同时加别名**（见 `game/systems/rules/aliases.ts`）。

## init：开局做什么

按顺序执行的效果数组。两种：

```json
{ "kind": "patch", "handle": 0, "component": "core.health", "data": { "hp": 10 } }
{ "kind": "stamp", "group": "camp", "space": "field", "x": 4, "y": 4 }
```

`stamp` 会把预制件按偏移铺开（见 `groups/`）。

**读档不重跑 init**——否则开局物品会发两次。

## persistence：远处怎么办

```json
"persistence": { "activeRadius": 25, "sweepEvery": 50 }
```

配合实体上的 `core.persistence`：

| level | 远处的行为 |
|---|---|
| `anchored` | 留着、不模拟（有名字的 NPC、地标） |
| `normal` | 留着、不模拟（默认） |
| `ephemeral` | 超时/出范围可消失（尚未实现清理） |

**现在的实现**：不在当前空间的实体不会被调度器给回合（它们会被推到 50 tick 后重查）。
半径与扫描间隔已经**声明并校验**，但清理逻辑还没接——那是下一版。

## 为什么不用「卸载」

> 数据留着，只是不模拟。

内存卸载会打断句柄引用（容器、挂起动作、调度器、存档）。我们选择**模拟分级**：
看得见的地方全速、远的地方暂停、数据始终在。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [pack-guide.md](pack-guide.md) | 从零写一个包 |
| [systems/runtime.md](systems/runtime.md) | 规则怎么组装进运行时 |
| [areas/worlds.md](areas/worlds.md) | 加东西时的判断（数据还是机制） |
| [systems/perception.md](systems/perception.md) | 「看得见」本身的规则 |
