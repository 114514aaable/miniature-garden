# 体系：通行（物种 × 地形）

> 「能不能过」不是地形的属性，是**谁和什么地形**的关系。
> 人过不去的水，鱼能过。

## 两边各自编码

```json
地形  water  { "code": "water", "surface": "liquid", "passable": false }
物种  人     { "core.locomotion": { "surfaces": ["ground"] } }
物种  鱼     { "core.locomotion": { "surfaces": ["liquid"] } }
物种  两栖   { "core.locomotion": { "surfaces": ["ground", "liquid"] } }
```

**加鱼只改鱼的文件，不用碰水的定义。**
**加岩浆只改地形，不用告诉人和鱼「你不能过岩浆」。**

## 对接在加载期算一次

```
收集地形 surface     → ground / liquid / solid / air
收集模板 surfaces    → ground、liquid…
求交                 → 人×水 = ✗，鱼×水 = ✓
```

结果是**一张表**，运行时 `move` 只查表（`context.tools.canEnter`）。

**好处**：移动判定和出生点检查用同一张表，不会出现「出生点说能站、走一步说不能」。

## 词表是闭集，扩词是加值

```
ground / liquid / solid / air      现在
climb / web / rail                 以后
```

**加词只是多一个值**——老物种没列它，就不受影响。

## 退回规则（老数据不改也能跑）

```
地形没有 surface     → 用它自己的 passable
模板没有 locomotion  → 只看地形 passable
模板不存在           → 不能进（防拼写错误）
```

## 加载期会报的三类错

```
未知的 surface "liqiud"（可用：ground / liquid / solid / air）   ← 拼错
模板 fish 的 surfaces 接不上任何地形                              ← 白写了
地形 7 的 surface 没有任何模板能接                                ← 地形没人用
```

**错误在加载期出现，不是等玩家走到河边。**

## 代码在哪

| 文件 | 作用 |
|---|---|
| `game/engine/core/src/bind.ts` | 通用「对接」：两边声明 → 连接表 + 诊断 |
| `game/systems/rules/passage.ts` | 通行这套对接的具体用法（surface 词表） |
| `game/engine/core/src/rules/move.ts` | 只问 `context.tools.canEnter(...)` |
| `tools/serve.mjs` | 建会话时编译表，作为工具交给规则 |

`bind.ts` 是**可复用的**：以后「伤害类型 × 护甲」「语言 × 听话的人」都是同一套。

## 动作占用（通道）

通行决定「能不能进那一格」；通道决定「同一时间能做几件事」。

```
hand   手：容量 = core.body.hands（缺省 2）
move   移动：容量固定 1
```

动作在签名里声明占用：`"uses": { "hand": 1 }`（蓄力劈砍占一只手）。
宿主派发前查容量，不够就拒绝。

于是：

```
蓄力（占手） + 移动（占 move） → 可以边跑边蓄
蓄力 + 第二个蓄力               → 手不够，拒绝
四只手（core.body.hands=4）     → 手够，能多拿
```

**移动单列**：它的限制来自速度（`core.stats.speed`），不是部位。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [../areas/engine-core.md](../areas/engine-core.md) | 规则上下文与工具 |
| [../world-format.md](../world-format.md) | 地形与模板字段 |
| [../architecture.md](../architecture.md) | 整体分层 |
