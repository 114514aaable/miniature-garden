# 世界包写法

> 从一个空文件夹到一个能跑的世界。所有例子都能直接跑。
> 模块的详细契约见 [`modules/README.md`](modules/README.md)（自动生成，含 `index.json`）。

## 0. 先理解三个词

| 词 | 意思 |
|---|---|
| **包（pack）** | 一个文件夹 + `pack.json`。可以是 `base`（提供底层内容）、`overlay`（依赖别的包）或 `system`（纯代码） |
| **世界（world）** | 一个 `world` 定义：从哪开始、用哪些规则、开局做什么 |
| **内容池** | 所有包合并后的定义集合。同名（kind + id）会冲突，默认报错 |

**一个能玩的组合 = 一个 base 包 + 一个 overlay 包。**

## 1. 最小可玩包

```
myworld/
├─ pack.json
├─ terrains.json
├─ components.json
├─ spaces/room.json
├─ templates/people.json
├─ entities/room.json
└─ world.json
```

### pack.json

```json
{
  "id": "my.world",
  "kind": "overlay",
  "version": "0.1.0",
  "name": "我的世界",
  "description": "示例：一间房、一个人、一堵墙。",
  "license": "CC-BY-SA-4.0",
  "engine": ">=0.1.0",
  "requires": { "official.base": "^0.1.0" },
  "files": {
    "terrains": ["terrains.json"],
    "components": ["components.json"],
    "spaces": ["spaces/room.json"],
    "templates": ["templates/people.json"],
    "entities": ["entities/room.json"],
    "world": ["world.json"]
  }
}
```

- `requires` 是「id → 版本范围」，加载器会做拓扑排序；
- `files` 里的每一类都是**文件路径数组**；不写就是没有。

### terrains.json —— 地形号 → 含义

```json
[
  { "id": "0", "name": "空气", "passable": true },
  { "id": "1", "name": "墙",   "passable": false },
  { "id": "3", "name": "地板", "passable": true }
]
```

**地形号是数字，含义是数据。** 引擎不硬编码「1 是墙」，只问 `passable`。

### components.json —— 组件与它们的 schema

```json
[
  {
    "id": "core.health",
    "schema": {
      "t": "object",
      "fields": { "max": { "t": "int" }, "hp": { "t": "int" } },
      "optional": ["hp"]
    }
  }
]
```

基础组件在 `official.base` 里已经定义好了——**overlay 包通常不需要写这一节**，直接用 `core.health` 等即可。

### spaces/room.json —— 地图

```json
{
  "id": "room",
  "width": 5,
  "height": 4,
  "terrain": [
    1, 1, 1, 1, 1,
    1, 3, 3, 3, 1,
    1, 3, 3, 3, 1,
    1, 1, 1, 1, 1
  ]
}
```

`terrain` 是**行优先**的扁平数组，长度必须等于 `width * height`。

### templates/people.json —— 模板

```json
[
  {
    "id": "pc",
    "components": {
      "core.health": { "max": 20, "hp": 20 },
      "core.stats": { "speed": 5, "attack": 3, "defense": 1 },
      "core.solid": {}
    }
  }
]
```

模板可以继承：

```json
{ "id": "npc_guard", "extends": "pc", "components": { "core.stats": { "attack": 5 } } }
```

**只写差异**，合并后再校验。

### entities/room.json —— 摆放

```json
[
  { "id": "player", "template": "pc", "space": "room", "x": 1, "y": 1 }
]
```

### world.json —— 从这里开始

```json
{
  "start": { "space": "room", "x": 1, "y": 1 },
  "rules": ["core.move", "core.attack", "core.wait"],
  "init": [],
  "onConflict": "error"
}
```

- `start`：出生点（必须落在可走的地形上）；
- `rules`：这个世界启用哪些规则。**不写就不会加载**；
- `init`：开局一次性执行的效果数组（见 §4）；
- `onConflict`：`error`（默认，冲突即失败）/ `warn` / `override`。

## 2. 怎么验证

```bash
# 加载并打印世界（最快）
node tools/play.mjs game/worlds/official.base worlds/myworld

# 起调试台，浏览器里玩
node tools/serve.mjs
```

加载期会挡住：未知组件、schema 不符、模板继承成环、地形没声明、出生点不可走。

## 3. 加内容的三个例子

### 加一个新敌人

```json
{
  "id": "npc_rat",
  "extends": "npc_salt",
  "components": {
    "core.health": { "max": 6 },
    "core.stats": { "speed": 6, "attack": 2 }
  }
}
```

放进 `templates/`，再在 `entities/` 里摆一只。

### 加一件物品

```json
{ "id": "item_rope", "extends": "item_base", "components": { "core.item": { "weight": 2 } } }
```

`item_base` 已经带了 `core.item` 的 stack/weight，这里只改重量。

### 加一个技能

技能 = 已注册的规则 + 在 `world.json` 的 `rules` 里启用。**写新技能要写代码**（见 `game/systems/rules/index.ts`），
但组合已有规则不需要。

## 4. 开局初始化 `init`

世界建好、实体生成之后，按顺序执行一遍：

```json
"init": [
  { "kind": "stamp", "group": "camp", "space": "harbor", "x": 4, "y": 4 }
]
```

### 预制件 stamp

`groups/` 目录里放预制件：一组实体 + 相对偏移。

```json
[
  {
    "id": "camp",
    "entities": [
      { "template": "item_lamp", "dx": 0, "dy": 0 },
      { "template": "prop_crate", "dx": 1, "dy": 0 },
      { "template": "prop_crate", "dx": 2, "dy": 0 }
    ]
  }
]
```

在 `pack.json` 里登记 `"groups": ["groups/camp.json"]`，然后就能用 `stamp` 盖上去了。

**它怎么实现的**：`stamp` 由引擎的 `applyInit` 展开成若干 `spawn`——所以
`play.mjs`、`serve.mjs`、以后的地图生成器看到的开局完全一致。

### 其它效果

普通效果原样提交，比如：

```json
{ "kind": "patch", "handle": 0, "component": "core.health", "data": { "hp": 10 } }
```

**注意**：`handle` 是运行时句柄，写死在数据里不靠谱。位置类的东西用 `stamp`，
按模板生成的用以后的效果词表。

## 5. 补丁（patches）

想改别的包的内容，不要复制一份，写补丁：

```json
{ "op": "replace", "kind": "template", "id": "pc", "data": { "components": { ... } } }
```

放在 `patches/` 目录，在 `files.patches` 里登记。**补丁会记进溯源（谁改的）。**

## 6. 常见错误对照

| 报错 | 原因 |
|---|---|
| `模板 "x" 用了未登记的组件` | `components.json` 里没定义，或者忘了写 `files.components` |
| `未知字段 "y"` | schema 不允许这个字段（私有字段请用 `x-` 前缀） |
| `地形 2 没有声明含义` | `terrains.json` 缺了那个号 |
| `出生点不可走` | `start` 落在墙/水上，或地形没声明 `passable` |
| `包 x 的版本不满足` | `requires` 的版本范围和实际不符 |

## 7. 目录速查

```
game/worlds/official.base/     基础：地形、组件、通用模板
game/worlds/official.normal/   示例世界：港口 8×6、一个 NPC、一盏灯
docs/modules/             模块契约（自动生成）
```
