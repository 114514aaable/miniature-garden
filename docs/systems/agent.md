# 体系：AI 接口（agent）

> 改这里如果：**你要让外部程序读世界、下指令、生成内容、或校验一个包**。

## 它是什么

一套给「非人类的客户端」用的接口。它和网页用的是同一个服务，**只是返回的东西更像是给程序看的**。

位置：`game/systems/agent/`（system 级，**不是世界包**——AI 不是内容，是入口）。

## 三件事

```
1. 能力清单   我现在能做什么
2. 执行       做一件事，拿到发生了什么
3. 反馈       失败了，为什么，怎么办
```

## 接口

```
GET  /api/ability            规则、效果、aim 形状、组件、成本键
GET  /api/state?full=1       完整状态（含组件）
POST /api/act {dir, actor?}  走一步
POST /api/skill {tag, …}     用技能
GET  /api/validate?pack=     校验一个世界包
POST /api/proposal/check     五级阶梯校验（见下）
```

## 统一返回形状

```json
{
  "ok": false,
  "error": { "code": "NO_TARGET", "message": "这里没有东西", "hint": "先 aim 看看这一格有什么" },
  "data": null
}
```

**`hint` 是这套接口的核心**。没有它，AI 只能瞎试；有了它，AI 能自我纠错。

## 三条铁律

1. **给感知视图，不是绝对视图**（见 [perception.md](perception.md)）——否则 AI 开透视。
2. **每次执行都返回「发生了什么」**（events），不只是结束状态。
3. **校验是纯的**：`/api/validate`、`/api/proposal/check` 不改任何状态。

## 五级阶梯（申请新机制时）

```
1 参数    成本、射程、伤害        ← AI 随便改
2 组合    效果列表                ← AI 随便加
3 触发    on + if + then          ← AI 可以加
4 形状    aim 的判定形状          ← 要代码
5 机制    新的结算算法            ← 要设计 + 代码 + 重启
```

`/api/proposal/check` 要回答一句话：**「1–3 级能不能做到？」**

- 能 → 拒绝，并告诉它用哪个（这是**闸一**，挡掉一大半）；
- 不能 → 通过，标记「需要代码」，进人的视野（**闸二**）。

**AI 不能给自己批代码。**

## 边界

- 不做鉴权（本地单机）；以后联机再加；
- 不让 AI 直接重启进程——重启是人的动作；
- 不把「生成内容」绑进运行时：生成 → 落盘 → 校验 → 加载，四步分开。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [perception.md](perception.md) | 你要决定 AI 能看到什么 |
| [../areas/host.md](../areas/host.md) | 你要加接口 |
| [../pack-guide.md](../pack-guide.md) | AI 要写包 |
| [../modules/README.md](../modules/README.md) | 查规则/组件的字段 |
