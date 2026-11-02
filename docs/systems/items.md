# 体系：物品

> 改这里如果：**你要加一种道具、改背包、或者让东西能用**。
> 只是摆一件物品到地图上 → 改 `entities/*.json` 就行，不用看这篇。

## 它由哪几块组成

```
组件
  core.item        { stack, weight }        这东西是物品
  core.container   { slots, items: [句柄] } 谁身上有东西
  core.use         { effects, consume }     怎么用
  core.place       位置（null = 不在世界上）

规则
  core.take   地上 → 背包
  core.drop   背包 → 地上
  core.use    用掉：读 core.use，产出效果，可选消耗

界面
  /api/inventory            列出背包（名字/描述由服务端查语言包）
  快捷栏 24 格 + 右下 3×4     绑定 = { kind: "item", ref: 句柄 }
  点击自己脚下                 = core.take
```

## 一条完整路径

**捡起**：

```
点自己脚下的格子
  → core.take
  → 效果1: patch core.place = null      （从世界移除，空间索引同步清掉）
  → 效果2: patch core.container.items += 句柄
```

**用掉**：

```
快捷栏点物品格
  → core.use { actor, item }
  → 读物品的 core.use.effects
  → 替换 $self / $actor
  → consume: true → 从 items 移除 + core.place = null
```

## 扩展点

| 想加什么 | 改哪里 |
|---|---|
| 新道具（能捡、能看） | 模板 + `entities/` 摆一个 + 语言包加名字 |
| 新道具（能用） | 模板里加 `core.use`，**不用改代码** |
| 数量堆叠 | `core.item.stack` + `core.use` 里的数量逻辑（还没做） |
| 相对数值（回 5 血） | `core.use` 的 `effects` 目前是覆盖语义；要相对值得给 `patch` 加语法 |
| 装备栏 | 左栏 6 个空位已留；需要 `core.equip` 组件 + 一条规则 |
| 容量 / 重量限制 | `core.container.slots` 已存在，`take` 会检查 |

## 加一件可用道具（完整清单）

```
1. game/worlds/<包>/templates/*.json
   { "id": "item_potion",
     "components": {
       "core.item": { "stack": 1, "weight": 1 },
       "core.use": { "consume": true,
                     "effects": [{ "kind": "patch", "handle": "$actor",
                                   "component": "core.health", "data": { "hp": 20 } }] }
     } }
2. game/worlds/<包>/entities/*.json   摆一个（或放进 groups/）
3. game/locales/zh-CN.json            template.item_potion.name / .desc
4. node tools/gen-docs.mjs            更新模块文档
```

## 边界

- **物品不负责界面**。背包/快捷栏只是「句柄 + 名字」的展示。
- **物品不负责持久化**。存档存的是组件值，句柄会被原样带回来。
- **`core.use` 不在引擎里写死**：效果是数据，规则只负责替换占位符和消耗。

## 验证

```bash
# 捡起 → 用掉，全程看日志
node tools/serve.mjs
# 浏览器：点脚下捡起 → I 打开背包 → 拖到快捷栏 → 点它
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [../areas/worlds.md](../areas/worlds.md) | 你要加新道具的数据 |
| [combat.md](combat.md) | 道具要造成伤害 / 施加状态 |
| [../modules/rule-core.use.md](../modules/rule-core.use.md) | 你要看 core.use 的确切参数 |
| [../modules/component-core.container.md](../modules/component-core.container.md) | 你要改背包结构 |
