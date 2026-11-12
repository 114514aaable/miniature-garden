# 部位体系（body parts）

> 定位：**可选 mod**，不是核心。
> 核心只提供通用能力：组件、效果、写拦截、死亡广播。
> 部位、投影、伤害路由、立绘绑定全部属于这个 mod。
> 当前原型代码在 `game/engine/core/src/body/body.ts`，目标是从 core 抽到 mod 层（见 §10）。

---

## 0 为什么是 mod

```
不用部位的玩法     一封口 = 一个完整实体，core.health 就是全部
用部位的玩法       身体是一棵树，血量、能力、装备、立绘都从树派生
```

核心不应该知道「手」「眼」「头」这些词。核心只需要：

```
1  一个实体可以有 core.body 组件（树形数据）
2  写 core.health 时，允许 mod 接管
3  判定死亡时，mod 可以广播 base.death
```

---

## 1 目标 / 非目标

**目标**

- 部位可任意组合：人形、触手、史莱姆、机械、多手多眼。
- 部位决定能力：视觉、听觉、操作、移动、说话。
- 部位决定血量投影：血条 = 关键部位之和。
- 部位承接伤害、溢出、致残。
- 装备可以挂到具体部位/槽位。
- 立绘由部位驱动（可暂停，不影响数值）。
- 一切都是数据；AI 可以生成。

**非目标**

- 不做真实解剖模拟（不需要器官、血液循环）。
- 不做逐帧物理。
- 不把部位写进核心效果词汇（Effect 仍是六种）。

---

## 2 数据模型

三层：

```
部件目录   bodyparts/parts.json      可复用定义
身体蓝图   bodyplans/plans.json      把部件组成树
运行时实例 core.body                 只存变化
```

### 2.1 部件目录

```json
[
  { "id": "human.torso", "name": "躯干", "hp": 40, "coverage": 30,
    "armor": 1, "vital": true, "tags": ["core"],
    "grants": {}, "slots": ["armor"] },

  { "id": "human.head", "name": "头", "hp": 20, "coverage": 10,
    "vital": true, "slots": ["head"] },

  { "id": "human.hand", "name": "手", "hp": 8, "coverage": 6,
    "grants": { "manipulator": 1 }, "slots": ["hand"] }
]
```

| 字段 | 含义 | 约束 |
|---|---|---|
| `id` | 全局唯一 | `[a-z][a-z0-9_.-]*` |
| `name` | 显示名 | 可本地化，缺省用 id |
| `hp` | 结构值 | 整数 ≥ 1 |
| `coverage` | 被命中的相对权重 | 整数 ≥ 1，不必凑 100 |
| `armor` | 该部位护甲 | 整数 ≥ 0 |
| `vital` | 是否关键 | bool，缺省 false |
| `tags` | 分类 | 字符串数组，不参与计算 |
| `grants` | 能力点数 | `{ sight:1, manipulator:1, ... }` |
| `slots` | 装备槽 | 字符串数组 |

**能力用点数，不用有无。** 两只眼各 1 点，瞎一只视觉减半。

### 2.2 身体蓝图

```json
[
  {
    "id": "humanoid",
    "vital": "marked",
    "parts": [
      { "id": "torso", "part": "human.torso" },
      { "id": "neck", "part": "human.neck", "parent": "torso" },
      { "id": "head", "part": "human.head", "parent": "neck" },
      { "id": "eye", "part": "human.eye", "parent": "head", "repeat": 2 },
      { "id": "ear", "part": "human.ear", "parent": "head", "repeat": 2 },
      { "id": "mouth", "part": "human.mouth", "parent": "head" },
      { "id": "upper_arm_l", "part": "human.upper_arm", "parent": "torso" },
      { "id": "upper_arm_r", "part": "human.upper_arm", "parent": "torso" },
      { "id": "hand_l", "part": "human.hand", "parent": "upper_arm_l" },
      { "id": "hand_r", "part": "human.hand", "parent": "upper_arm_r" },
      { "id": "thigh_l", "part": "human.thigh", "parent": "torso" },
      { "id": "thigh_r", "part": "human.thigh", "parent": "torso" },
      { "id": "shin_l", "part": "human.shin", "parent": "thigh_l" },
      { "id": "shin_r", "part": "human.shin", "parent": "thigh_r" },
      { "id": "foot_l", "part": "human.foot", "parent": "shin_l" },
      { "id": "foot_r", "part": "human.foot", "parent": "shin_r" }
    ]
  }
]
```

规则：

```
id         蓝图内唯一；repeat 时变成 id_1 / id_2
part       指向部件目录
parent     父部件；不写就是根
repeat     n 份，id 加 _1.._n
extends    继承另一张蓝图
delete     extends 时删掉继承来的同名部件
覆盖       hp / coverage / armor / vital / tags / grants / slots 可覆盖
```

`vital`：

```
"marked"  至少一个部件标 vital，否则加载报错
"all"     整棵树都是关键（史莱姆/单部件生物）
```

### 2.3 运行时实例

模板挂蓝图：

```json
{ "id": "pc", "components": {
  "core.body": { "plan": "humanoid" }
} }
```

受伤后只存变化：

```json
"core.body": {
  "plan": "humanoid",
  "parts": [
    { "id": "hand_l", "hp": 2, "state": "hurt" },
    { "id": "leg_r", "hp": 0, "state": "disabled" }
  ]
}
```

```
没列出的部件 = 满血、ok
```

### 2.4 组件 schema

```json
{
  "plan": "str",
  "parts": [
    { "id": "str", "hp": "int?", "state": "ok|hurt|disabled?" }
  ]
}
```

---

## 3 能力（grants）

计算：

```
能力值(ability) = 所有 state != disabled 且 hp > 0 的部件的 grants[ability] 之和
```

约定：

| ability | 来源 | 效果（由使用方决定） |
|---|---|---|
| `sight` | 眼 | 视野半径/感知 |
| `hearing` | 耳 | 听觉半径 |
| `manipulator` | 手/触手 | 可操作物品的通道数 |
| `mover` | 腿 | 移动速度/能否移动 |
| `speech` | 嘴 | 能否对话/施法吟唱 |

**mod 只提供数值，不决定具体规则。** 感知系统读 `sight`，移动规则读 `mover`。

缺省：没有 `core.body` 的实体视为能力齐全（向后兼容）。

---

## 4 血量投影

```
max = sum(vital 部件的 hp 上限)
hp  = sum(vital 部件的当前 hp)
```

```
没有 core.body      core.health 原样，投影 = 恒等
有 core.body        不存 core.health；读的时候从树投影
```

**为什么只算 vital：**

```
断手  血条不掉     手不是命
头毁  血条归零     头是命
```

**镜像还是派生：**

```
目标    派生（读时投影），不存 core.health
过渡    允许先镜像回写，兼容旧规则；镜像只写不读
```

读取点：

```
视图合并组件时投影 core.health
渲染 HUD 时读投影
规则读 core.health 时读投影
```

**治疗**：

```
按缺失比例补到 vital 部件
或优先补最重的伤（未定，见 §12）
```

---

## 5 伤害路由

### 5.1 选部位

普通攻击：

```
候选 = 所有 hp > 0 的部件
权重 = coverage
用确定性随机（seed = tick + actor + target）选一个
```

指定部位（瞄准/技能）：

```
直接命中该部位
```

### 5.2 溢出

```
damage = max(1, 攻击力 - 该部位护甲)
剩余 = damage
从命中部位开始：
  扣 剩余
  如果该部位 hp 归零：state = disabled
  剩余 = 剩余 - 该部位原 hp
  如果剩余 > 0 且 parent 存在：继续打到 parent
  否则停止
```

**手挡刀** 就是这样自然产生的。

### 5.3 状态

```
hp == max      ok
0 < hp < max   hurt（只影响显示，暂不惩罚）
hp == 0        disabled（能力失效）
```

**关键部位 disabled = 死亡候选。**

### 5.4 与写规则的接口

现有宿主：

```
applyEffects → resolveWrite → applyWriteRules → core.write 事件
```

部位 mod 需要：

```
取代 baseWriteRules 对 core.health 的处理
  before = 投影后的 { hp, max }
  after  = 新 hp
  差值   = 伤害/治疗
  路由到部位
  返回 consume + 部位 patch 效果
```

**接口形状（目标）：**

```ts
interface BodyWriteResolver {
  (write: EntityWrite): WriteResult | null;
}
```

宿主支持「写规则链」：base 规则 → mod 规则 → 默认写。

### 5.5 瞄准（后续）

```
攻击参数带 aim = { x1,y1,x2,y2,width }（归一化整数）
部位立绘带 hitbox 多边形
线段与多边形求交 → 每个部位一个权重
伤害按权重分配
```

**不在第一版；第一版用 coverage 随机。**

---

## 6 死亡

```
所有 vital 部件 disabled
  或 投影 hp <= 0
→ 广播 base.death { handle, cause }
```

```
默认 base.death 处理器 = despawn
mod 可以替换：倒地、复活、掉落、剧情
```

死亡不写进写规则；它是拦截器对「致死」的判定 + 广播。

---

## 7 装备槽

部件声明 `slots`：

```json
{ "id": "human.head", "slots": ["head"] },
{ "id": "human.hand", "slots": ["hand"] }
```

装备声明占用的槽：

```json
{ "id": "item_helmet", "components": {
  "core.equip": { "slot": "head", "armor": 2 }
} }
```

装配：

```
检查角色是否有「有该槽且未 disabled」的部件
有 → 装备绑定到该部件实例
部件 disabled → 装备失效/掉落
```

**多手多眼时槽位自然变多，不用改编排。**

---

## 8 立绘（暂停）

```
rig 图层按 part id 绑定
states: ok / hurt / disabled 换图或滤镜
hitbox 与立绘画在同一份数据里
```

当前已有原型：`game/worlds/base/rigs/humanoid.json` + `art/parts/*.svg`。
**数值接通前不继续扩展立绘。**

---

## 9 mod 打包

目标形态：

```
mods/body-parts/
├─ pack.json              id: "body.parts"
├─ bodyparts/parts.json
├─ bodyplans/plans.json
└─ rules/                 写规则/死亡处理（未来规则插件）
```

启用：

```
世界包 requires body.parts
或开始菜单勾选
```

**不带 body.parts 的世界**：

```
没有 core.body 的实体 → 行为完全不变
即使模板误写了 core.body → 忽略/警告
```

---

## 10 代码接口（现状与目标）

### 现状（原型在 core）

```ts
// game/engine/core/src/body/body.ts
parseBodyPart(raw, id): BodyPartDef
parseBodyPlan(raw, id): BodyPlanDef
resolveBodyPlans(plans, parts): Map<string, ResolvedBodyPlan>
capabilityOf(plan, ability): number
```

```ts
// 组件
core.body { plan, parts[] }
core.health { max, hp }
```

**已接**：数据加载、校验、18 部件人形、触手/史莱姆蓝图、pc 挂載、立绘渲染。
**未接**：投影、伤害路由、死亡、能力消费、装备。

### 目标（抽到 mod）

```
core 只保留：
  - Effect / WriteResolver / base.death 契约
  - 组件合并与视图

body-parts mod 提供：
  - bodyparts / bodyplans 数据
  - 投影函数
  - BodyWriteResolver
  - 死亡判定
  - 能力查询
```

---

## 11 校验清单

加载期：

```
[ ] 部件 id 唯一，字段合法
[ ] 蓝图 parent 存在、不成环
[ ] repeat 展开后 id 不冲突
[ ] extends 目标存在且不成环
[ ] 至少一个 vital（或 vital: "all"）
[ ] coverage >= 1，hp >= 1
[ ] 实例引用的部件都在蓝图里
[ ] 实例 hp 不超过上限（或允许并 clamp）
```

运行期：

```
[ ] vital 总和归零 → 只广播一次死亡
[ ] 溢出不会打到 disabled 的子部件
[ ] 治疗不超过上限
[ ] 没有 core.body 的实体行为逐字节不变
```

---

## 12 未决问题

```
Q1 伤害分摊：只打 vital，还是所有部件按 coverage？
     我倾向所有部件；血条只显示 vital
Q2 护甲：只减命中部位，还是每层溢出都减？
     我倾向只在命中部位减一次
Q3 治疗：按缺失比例，还是优先补关键部位？
Q4 部位上限：一张蓝图最多多少部件？（建议 200）
Q5 能力惩罚：hurt 状态要不要减 grants？
     我倾向 disabled 才失效，hurt 只影响显示
Q6 死亡原因：base.death 带 cause 字符串，谁定义？
```

---

## 13 实施顺序

```
1  投影（只读 core.health）          不改任何现有行为
2  写规则接管（伤害/治疗路由到部位）  旧实体不变
3  死亡广播接入
4  能力查询（先给感知/移动用）
5  装备槽
6  瞄准 / hitbox
7  从 core 抽到 mod 包
```

**每一步都要有「无 body 实体行为不变」的回归测试。**

---

## 14 示例

### 人形（18 部件）

```
torso(vital)
├─ neck → head(vital)
│         ├─ eye_1, eye_2（sight 1）
│         ├─ ear_1, ear_2（hearing 1）
│         └─ mouth（speech 1）
├─ upper_arm_l → hand_l（manipulator 1）
├─ upper_arm_r → hand_r（manipulator 1）
├─ thigh_l → shin_l → foot_l
└─ thigh_r → shin_r → foot_r
```

```
血条 = torso + head
sight = 2，hearing = 2
```

### 史莱姆

```json
{ "id": "slime", "vital": "all",
  "parts": [{ "id": "core", "part": "slime.core" }] }
```

```
血条 = core
没有四肢，移动靠整体
```

### 触手怪（22 部件）

```
humanoid − 双臂 + 8 条触手（manipulator 8）
```

**同一套系统，数据不同。**
