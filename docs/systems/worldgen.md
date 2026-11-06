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

结构是「带图例的字符画」。**图例放在结构自己身上**——符号只在这栋建筑里有意义。

### 图例可以指向两种东西

```json
[
  {
    "id": "hut",
    "legend": {
      "#": { "terrain": "wall" },
      ".": { "terrain": "floor" },
      "D": { "terrain": "door" }
    },
    "map": [
      "#####",
      "#...#",
      "#..D#",
      "#####"
    ],
    "entities": [{ "template": "prop_crate", "dx": 1, "dy": 1 }]
  },
  {
    "id": "village",
    "legend": {
      "#": { "terrain": "wall" },
      ".": { "terrain": "floor" },
      "h": { "structure": "hut", "align": "center" },
      "w": { "structure": "well", "align": "center" }
    },
    "map": [
      "#####",
      "#h.h#",
      "#.w.#",
      "#####"
    ]
  }
]
```

```
terrain 条目     → 这一格铺这个地形
structure 条目   → 把另一个结构盖在这里（默认左上对齐，可写 align: center）
```

**这就是组合**：村庄由小屋拼成，小屋由地形拼成。和模板的 `extends` 同一个味道。

### 四条规则

1. **符号是局部的**——每个结构自己的图例，互不干扰；
2. **后盖的覆盖先盖的**——地图从左到右、从上到下；子结构整个盖上去；
3. **对齐**——`align: "top-left"`（默认）或 `"center"`；
4. **递归保护**——结构引用图不能有环，加载期检查（和模板继承一样）。

### 四种写法，可以混用

| 写法 | 适合 | 说明 |
|---|---|---|
| `pattern` + `palette` | 少量地形 | 最短，字符画 |
| `rows` | 多种地形 | 地形名直写，空格分隔，支持 `name*n` |
| `legend` + `map` | 有子结构 | 符号 → 地形 或 子结构 |
| `cells` | 个别格子 | 覆盖组件/朝向，或 `skip: true` 保留原地形 |

**加载时归一成同一份「地形名矩阵 + 实体列表 + 子结构列表」**，运行时只认这一种。

### 其它字段

```json
"anchors": [{ "kind": "door", "x": 2, "y": 3, "facing": "south" }],
"allow": { "rotate": true, "mirror": true }
```

- `anchors`：连接点（学 Minecraft 的 jigsaw）——**先只定义格式，不实现**；
- `allow`：允许摆放时旋转/镜像——同样先留字段。

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
  "pipeline": [
    { "op": "overworld",
      "fields": { "height": { "noise": "fbm", "scale": 7, "octaves": 4 } },
      "levels": { "water": 0.4, "hill": 0.65 } },
    { "op": "place", "structures": ["hut"], "count": 4,
      "spacing": 6, "on": ["floor"] }
  ]
}
```

**纯地牢**

```json
"generation": {
  "pipeline": [
    { "op": "caves", "fill": 0.5, "iterations": 5, "chambers": 4 },
    { "op": "place", "structures": ["hut"], "count": 1, "spacing": 10 }
  ]
}
```

**只有流水线一种写法**——`generation.fields` 和 `generation.generator`
两条旧路径已经删掉，缺 pipeline 会直接报错（不会静默生成一张空图）。
## 自定义尺寸（运行时）

开局现场生成：`/api/start` 带 `{ width, height }`（4..200），
宿主用世界自己的 `generation.pipeline` 生成地形，再走 `loadWorld` 校验。

- 尺寸**至少**要放得下现有内容（实体坐标、预制件尺寸），太小会自动放大；
- 存档记录 `seed` 与尺寸，读档按同样参数复现；
- 离线工具 `gen-world` 与开局生成共用一份算法。

## 流水线：多层叠加

`generation.pipeline` 是一串算子，**每一步只改同一个 sandbox**（地形数组 + 具名图层）：

```json
"pipeline": [
  { "op": "overworld", "levels": { "water": 0.4, "hill": 0.65 } },
  { "op": "caves", "fill": 0.56, "iterations": 4, "chambers": 3 },
  { "op": "blend", "floor": "cave_floor", "wall": "keep" }
]
```

| op | 做什么 |
|---|---|
| `overworld` | 噪声 + 群系 → 地表地形 |
| `caves` | 元胞 → 写一层 `cave`（1 = 洞） |
| `blend` | 洞穴层的「地」换成 `floor`；`wall` 选 `keep`（保留地表）或 `solid`（填墙） |

**顺序有意义，后写的覆盖先写的。** 示例世界 `official.cavern` 就是三层叠加。

### 结构 v2：组合、实体、门

```json
{ "id": "camp",
  "role": "room",
  "legend": { "#": { "terrain": "wall" }, ".": { "terrain": "floor" },
              "h": { "structure": "hut", "align": "center" } },
  "map": ["#########", "#.......#", "#...h...#", "#########"],
  "entities": [{ "template": "prop_crate", "dx": 1, "dy": 1 }],
  "anchors": [{ "kind": "door", "x": 4, "y": 3, "facing": "south" }] }
```

```
图例条目   terrain → 铺地形
           structure → 在那一格盖子结构（align: top-left / center）
entities   结构里的实体（偏移写死，不带随机）
anchors    门：坐标 + 朝向
```

**加载期展开**：子结构被展开成「地形矩阵 + 实体 + 门」，引用成环直接报错。

**出生请求**：生成器只产出 `spawns`（模板 + 坐标 + 来源），
宿主建会话时在「换地形之后、跑 init 之前」统一放；落在墙上的实体跳过并警告。

### 散落地牢（sprawl）

```json
{ "op": "sprawl", "rooms": ["cell", "hall", "vault", "chamber"],
  "count": 40, "margin": 1, "widen": 0.35 }
```

**不贴网格**：房间随机中心、随机旋转，互相不重叠。

```
1  自由摆放：随机中心 + 随机旋转 + 1 格边距，摆不下就换位置
2  房间图：Gabriel 图（没有第三间房落在两点直径圆里就连边）
   —— 天然带环、不偏向最近邻；不连通就按中心距离补生成树边
3  连边：最近门对，但路用「带噪声代价的 A*」走，会自然绕
4  走廊：沿路径随机加宽 1 格（widen），房间当障碍、留 1 格保护
5  验收：地板连通、每扇门是地板、房间四角墙不被啃
```

和 rooms/layout 的区别：那两个贴网格，这个完全不贴。

### 混合布局（layout）

```json
{ "op": "layout", "tiles": ["tile_cross", "tile_hall"],
  "rooms": 2, "roomMin": [2, 2], "roomMax": [3, 2], "loops": 0.2 }
```

把 meta 网格当图：

```
节点   一个 7×7 格；成片的格子可以是一间大房间
边     相邻格要不要通（随机生成树 + loops 环路）
房间   程序化：内部地板 + 一圈墙 + 按边开门（可占 2×2、3×2 格）
走廊   单格，用 7×7 件按门口拼（旋转、加权、多开就砌墙、兜底）
```

**房间可以贴在一起**：共用墙两侧各开一扇门，就是直连。

### 拼贴（tiles）

```json
{ "op": "tiles", "tiles": ["tile_cross", "tile_hall", "tile_diagonal"] }
```

**7×7 的件 + 门口 + 网格拼贴。**

```
每个 meta 格要开哪几条边 = 它在网格里的邻居
候选件里挑「门集合满足需求」的，可旋转 0/90/180/270
多余的门只允许开在地图边界上（否则会开向邻格的墙）
挑不到 → 程序化十字兜底（记警告）
```

门不需要额外对齐：两格都开同一条边，门就在边界上重合。

**测试件**：`game/worlds/official.base/worldgen/tiles.json`，由
`tools/gen-tiles.mjs` 生成 7 张（十字 / 单间 / 北厅 / 对角 / 三间 / 大厅 / 带柱大厅），
每张四边带门，内部用 3×3 象限做出不同形状。

### 房间（rooms）

**房间不是数据结构，是结构的角色。**

```json
{ "id": "hall", "role": "room",
  "legend": { "#": { "terrain": "wall" }, ".": { "terrain": "floor" } },
  "map": ["#######", "#.....#", "#.....#", "###.###"],
  "anchors": [{ "kind": "door", "x": 3, "y": 3, "facing": "south" }] }
```

```json
{ "op": "rooms", "structures": ["cell", "hall", "vault"],
  "minSize": [7, 6], "corridor": "floor", "connect": "anchors" }
```

**门图模型**：门是顶点、走廊是边、房间内部是同房间门两两可达的团。

```
1  BSP 切矩形，每块挑一个放得下的 room 结构（门在外墙上）
2  房间两两按「最近的门对」做最小生成树，再补 loops 比例额外边
3  每条边用 A* 修一条走廊：从门朝外一格出发，绕开房间内部
4  双验收：图上每个房间有门可达 + 地形洪水填充每扇门连通
```

四步：

```
1  BSP 把地图切成矩形（每块 ≥ minSize，切法由种子决定）
2  每块挑一个放得下的 room 结构，居中盖上
3  相邻房间按中心距离做最小生成树，挖 L 形走廊
4  有门（anchors）就走门，没有就中心对中心
```

- 整张图先填墙，再由房间和走廊挖出来；
- 连通性有测试（洪水填充必须走到每个房间）；
- 实现：`worldgen/rooms.ts`，流水线 `rooms` 阶段。

### 迷宫（maze）

```json
{ "op": "maze", "wall": "wall", "floor": "floor", "braid": 0.15, "inset": 1 }
```

- 在实心墙里挖通道：格子间距 2，最外圈留墙；
- `braid`：死胡同被打通的比例（0 = 完美迷宫，1 = 处处环路）；
- 保证连通：任何一格都能走到任何一格（有测试，洪水填充验证）；
- 确定性：随机只来自 `(seed, 偏移)`；
- 实现：`worldgen/maze.ts`，流水线 `maze` 阶段；
- 迷宫通道窄，`place` 的结构（5×5）几乎放不下——要放结构得先有房间。

### 结构已经可以摆了（第一批）

```json
{ "op": "place", "structures": ["ruin", "hut"], "count": 4, "spacing": 6,
  "on": ["floor", "cave_floor"], "inset": 2 }
```

- 结构定义在包的 `worldgen/structures.json`（图例 + 字符画）；
- 摆放只改**地形**，实体/子结构/锚点还没做；
- 规则：只落在 `on` 列举的地形上、彼此至少隔 `spacing` 格、不出边界、确定性；
- 实现：`worldgen/structures.ts`（解析 / 盖章 / 摆放），
  流水线 `place` 阶段，宿主从包目录读 `worldgen/structures.json`。

### caves 的两种模式

```json
{ "op": "caves", "fill": 0.5 }              // 直接写地形（纯洞穴世界）
{ "op": "caves", "as": "cave", "fill": 0.56 } // 只写图层，留给 blend 叠加
```

**没有 `as` 就是「洞穴即地形」**；有 `as` 就只存一张洞穴掩码。
以前 caves 只写图层，纯洞穴世界会得到一张空白图——现在会在生成后
做「只有一种地形」的体检并明确报错。

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
