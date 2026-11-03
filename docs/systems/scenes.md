# 体系：场景（scenes）

> **这是设计稿，不是实现说明。** 空着的地方就是还没定的地方。
> 填完再动手——UI 那次就是没填就写，返工了两轮。

## 它解决什么

「世界现在处于哪种玩法状态」：

```
战斗     指令菜单、暂停地图
对话     立绘、选项、世界基本不动
商店     列表、钱
换地图   旧场景退出、新场景进入
睡觉     时间跳跃
```

**场景 ≠ 窗口**：背包、设置是窗口（浮在世界之上）；战斗、对话是场景（换掉玩法）。

## 待定问题（先填这张表）

### 1. 第一版有哪几个场景？

```
□ explore（现有的地图探索）
□ dialog
□ battle
□ shop
□ sleep
```

建议：**第一版只做 explore + dialog**。第二个场景才能验证契约，第一个验证不了。

### 2. 场景由什么决定？

```
□ core.scene 组件（id + params）
□ 宿主内存里的状态
□ 两者结合
```

建议组件：**存档自动带上**，读档能回到正确场景。

### 3. 谁发起切换？

```
□ 规则返回效果（和 spawn/patch 一类）
□ 场景自己返回「下一个场景」
□ 两者都要
```

### 4. 切场景时，世界怎么办？

```
□ 暂停（只有当前场景在跑）
□ 继续（世界照常推进）
□ 搬到另一个 space（战斗）
```

### 5. 能嵌套吗？

```
□ 不能（一次一个）
□ 能压栈（商店压在对话上）
```

建议**一开始就做成栈**，哪怕只有一层——以后加「对话里开店」不用改结构。

### 6. 输入怎么分？

```
□ 场景声明命令表（input: ["choice1", "close"]）
□ 全局命令表 + 场景过滤
```

建议前者：这样 AI 接口问「现在能做什么」直接拿到答案。

### 7. 渲染怎么换？

```
□ 场景返回 UI 描述（套件节点），宿主 mount
□ 场景自己碰 DOM
```

**必须选前者**（和 UI 约定一致：只有 dom.ts 碰 DOM）。

### 8. 读档要恢复到哪一步？

```
□ 只存场景 id + params
□ 连对话第几句、选中第几项都存
```

建议第一版只存 id + params；细粒度状态等真需要再说。

## 契约草图（待讨论，不是定稿）

```ts
interface Scene {
  readonly id: string;
  readonly input: readonly string[];          // 这个场景认哪些命令

  onEnter?(ctx: SceneContext): readonly Effect[];   // 进入时的效果
  onExit?(ctx: SceneContext): readonly Effect[];

  /** 输入进来：返回「要做什么」，不直接改世界 */
  handle(command: string, ctx: SceneContext): SceneResult;

  /** 返回 UI 描述，不碰 DOM */
  render(facts: SceneFacts, ctx: SceneContext): UiNode;
}

interface SceneResult {
  readonly effects?: readonly Effect[];
  readonly next?: { readonly op: "push" | "replace" | "pop"; readonly id?: string; readonly params?: JsonValue };
}
```

**核心原则：场景返回「意图」，宿主负责执行。** 和规则返回效果是同一个模式——
可测、可回放、不产生隐式状态。

## 和另外两块的关系

```
感知   场景拿的是「感知事实」，不是绝对状态（见 perception.md）
AI 接口 问「现在能做什么」= 栈顶场景的 input 表（见 agent.md）
```

三块在这里合上：**场景决定能做什么，感知决定能看见什么，接口把两者暴露出去。**

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [perception.md](perception.md) | 场景要按「看得见什么」渲染 |
| [agent.md](agent.md) | 要把当前场景的能力暴露给 AI |
| [../areas/ui.md](../areas/ui.md) | 场景要返回 UI 描述 |
| [combat.md](combat.md) | 战斗场景要搬空间 |
