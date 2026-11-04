# 体系：世界生成器

> **设计稿。** 实现之前先定形状；空着的地方就是还没定的地方。

## 边界

```
生成器 = 离线工具（不是运行时）
输入：种子 + 世界声明（world.json 的 generation 块）
输出：普通包数据（spaces / entities / groups）
```

**运行时永远不跑生成器。** 生成物能被审查、手改、进版本库——
这也符合「AI 造数据」的路线：AI 产出的是文件，不是会跑的程序。

## 三类定义，三个目录，互不知道对方

```
game/worlds/<pack>/worldgen/
├─ generators.json    场：噪声怎么长、采哪些字段
├─ biomes.json        群系：什么气候 → 什么地形调色板 + 允许哪些结构
└─ structures.json    结构：建筑长什么样
```

引用方向**单向**，不成环：

```
generators → biomes → structures
                  ↘ terrain
```

- 生成器引用群系；
- 群系引用结构（允许清单）与地形；
- **结构不知道群系，地形也不知道群系。**

## 1. 场生成器（generators.json）

```json
[
  {
    "id": "overworld.temperate",
    "fields": {
      "height":   { "noise": "fbm",   "octaves": 4, "scale": 8,  "seed": 1 },
      "moisture": { "noise": "value", "octaves": 3, "scale": 12, "seed": 2 }
    },
    "biomes": ["temperate", "desert", "swamp"]
  },
  {
    "id": "dungeon.small",
    "fields": {},
    "rooms": { "count": 8, "minSize": 5, "corridor": "l" }
  }
]
```

- **噪声种类是代码**（`value` / `fbm` / `ridged`），**参数是数据**；
- 未登记的噪声 → 加载期报错，并列出可用的；
- 没有 `fields` 也能是生成器：地牢只用 `rooms`。

### 噪声种类（闭集，代码）

| kind | 说明 | 参数 |
|---|---|---|
| `value` | 值噪声，格点插值 | `octaves` `scale` `seed` |
| `fbm` | 多个八度叠加（`value` 的组合） | 同上 |
| `ridged` | fbm 取绝对值再折（山脊地形） | 同上 |

**三个共用一套底层**：先写 `value`，另两个是它的组合。

## 2. 群系（biomes.json）

```json
[
  {
    "id": "temperate",
    "ranges": { "height": [-0.2, 0.5], "moisture": [0.3, 1.0] },
    "terrain": { "base": "grass", "hill": "rock", "water": "water", "road": "dirt" },
    "structures": ["hut", "camp"],
    "tags": ["settled"],
    "color": "#4a7a3a"
  }
]
```

- `ranges`：气候区间，**按顺序取第一个匹配**（所以顺序有意义）；
- `terrain`：把「语义地形」映射成实际地形名（不写号）；
- `structures`：这个群系允许长什么；
- `color`：小地图/预览用。

**群系是语义层**：地形号引擎只认数字；群系是人/AI 认的概念。
以后「这个群系刷什么怪、掉什么」都放这里。

## 3. 结构（structures.json）

```json
[
  {
    "id": "hut",
    "size": [5, 4],
    "terrain": [
      "#####",
      "#...#",
      "#..D#",
      "#####"
    ],
    "legend": { "#": "wall", ".": "floor", "D": "door" },
    "entities": [{ "template": "prop_crate", "dx": 1, "dy": 1 }],
    "groups": [{ "group": "camp", "dx": 2, "dy": 2 }]
  }
]
```

- **字符画**而不是坐标数组：人读得懂，AI 好写，diff 看得到；
- `legend` 把字符映射到地形名；
- `entities` / `groups` 按偏移摆放（复用已有的模板与预制件）。

**结构不知道自己在哪个群系**——允许清单在群系那边。

## 阶段：一串 op

生成器执行时按固定顺序：

```
field → biome → select → place → fill
```

| op | 做什么 | 输入 | 输出 |
|---|---|---|---|
| `field` | 按噪声填一张场 | 尺寸 + 噪声参数 | 每格一个数值 |
| `rooms` | BSP 房间（地牢） | 数量/最小尺寸 | 房间矩形 |
| `caves` | 元胞自动机（洞穴） | 迭代次数 | 空格子集合 |
| `mask` | 手写/导入的掩码 | 字符画 | 直接给地形 |
| `biome` | 按气候区间挑群系 | 若干场 | 每格一个群系 |
| `select` | 群系地形映射 → 地形号 | 群系 + 调色板 | 地形数组 |
| `place` | 摆结构 | 结构 + 数量 + 间距 + 允许地形 | 摆放位置 |
| `fill` | 填结构内部 | 结构 + 战利品表 | 实体 |

**世界只写「用哪些 op + 参数」**，不写算法。

## 确定性

```
噪声 / select    每格独立：value(x,y) = roll(seed, stage, x, y)
rooms / caves    一次生成全部：结果由 seed 决定，但「不能按格子并行」
mask             无随机
```

**确定性不变，只是并行性不同**——这一点必须写清，否则以后会有人试图并行化 BSP。

## 两种世界的配置样例

**环境类**

```json
"generation": {
  "generator": "overworld.temperate",
  "size": [48, 32],
  "place": [{ "structure": "hut", "count": 4, "spacing": 6, "avoid": ["water"] }]
}
```

**纯地牢**

```json
"generation": {
  "generator": "dungeon.small",
  "size": [32, 24],
  "place": [{ "structure": "hut", "count": 1, "spacing": 10 }]
}
```

**后半段完全一样**——只有「场从哪来」不同。

## 校验

```
生成 → 落盘 → loadWorld() 校验 → 通过才算成功
```

和手写包**同一道关**。生成器不能产出「只有自己认识」的东西。

## MVP 顺序

```
1  select（阈值/映射）        两种世界都要，最好测
2  value 噪声 → 环境世界跑通
3  biomes 表（顺序匹配）
4  rooms（BSP）→ 地牢世界跑通
5  structures + place
6  fill（战利品）
```

**先做 select**：它把「场」变成「地形号」，是两个世界共同的地基。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [../areas/worlds.md](../areas/worlds.md) | 包格式与加载校验 |
| [../pack-guide.md](../pack-guide.md) | 手写包怎么写 |
| [runtime.md](runtime.md) | 冷加载与代码归属 |
| [../architecture.md](../architecture.md) | 整体分层 |
