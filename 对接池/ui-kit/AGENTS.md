# AGENTS.md — 给下一个 AI 的交接说明

> 你正在接手一个 **UI 套件项目**。本文件是唯一的入口，读完它再动任何代码。
> 现状：**只有研究与决策，零实现代码**。`research/` 是证据，本文件是结论。

---

## 0. 三十秒版本

1. 我们在做的是 **一套把布局意图翻译成 flexbox 的有限语法**，不是 UI 框架，更不是布局引擎。
2. 尺寸只有 **5 档**（`fixed/fit/fill/grow/ratio`），容器只有 **4 个元素**（`Row`/`Col`、`Panel`、`Scroll`、`Grid`，其中 `Grid` 待用）。**不在表里的需求，答案永远是 CSS 逃生口，不是加档。**
3. 浏览器负责求解，我们只负责表达。**任何自己算宽高的代码都是违规。**
4. HUD 是另一套 API（立刻模式外形 + keyed 元素池内核），与普通 UI 共用尺寸模型，不共用生命周期。
5. 本文件第 4 节列了 **4 个"故意缺失"**。它们看起来像缺陷，**补了会坏**。

---

## 1. 这是什么

一个 UI 套件。输入是声明（组件/函数调用），输出是带 flex 样式的 DOM。

它解决的不是"界面长什么样"，而是 **"谁可以让步"**：

> 空间不够时，先压谁？空间富余时，给谁？

这个问题的答案被压缩成 5 个枚举值。

### 它不是什么

| 不是 | 因为 |
|---|---|
| 布局引擎 | 不 measure、不 arrange、不算换行。浏览器在做，用 C++ 写的 |
| 组件库 | 不做 Button 的 8 种状态。那是 Qt 用几千个类走完的路，我们没有那个预算 |
| 主题系统 | 不做 token / 变量 / 皮肤。一个 CSS 类能解决的事不做成 API |
| 框架 | 没有运行时、没有生命周期、没有虚拟 DOM 的通用 diff |

---

## 2. 四条公理（违反即返工）

**A1 · 求解归浏览器，表达归我们。**
出现"测量元素尺寸""计算剩余空间""手动摆放位置"的代码，就是越界。唯一的例外见第 7 节的触发条件。

**A2 · 表达必须可枚举。**
`SizePolicy` 是封闭联合类型，容器是封闭集合。需求落在表外时，正确做法是让调用方写 CSS，**不是往枚举里加一项**。（这一条是为了让"不可表达"成为特性而不是缺陷——不可表达的界面会逼你用原生 CSS，而不是逼套件长胖。）

**A3 · 分层存在于源码，不存在于产物。**
`padding` 是一个属性，不是 `<MarginContainer>` 元素。层级感靠代码组织（嵌套的组件调用）获得，产物里该合并的合并。
判断标准：**如果一个概念对应的 CSS 只有一个属性、且不产生新的布局语义，它就不该是元素。**

**A4 · 两套 API，一套模型。**
普通 UI 用保留模式（元素长期存在）；HUD 用立刻模式外形（每帧声明）。二者共享 `SizePolicy`，**绝不共享节点**。HUD 的节点是池子里的，用完即释放，不许被业务代码持有。

---

## 3. 结构

```
调用方声明
   │  <Col gap={14}><Text width={150}>主音量</Text><Slider weight={1}/></Col>
   ▼
意图模型            { policy: 'fill', weight: 1 }     ← 唯一需要人做判断的地方
   │
   ▼  flexStyle(policy, weight)
样式字符串          "flex: 1 1 auto"                  ← 纯函数，可单测，无 DOM
   │
   ▼
DOM                <div style="display:flex;...">     ← 浏览器在此求解
   ▲
   │  HUD 通道：id → 池中元素 → 只改 style/transform
```

三层职责，**不许交叉**：

| 层 | 只做 | 不知道什么 |
|---|---|---|
| 意图 | 把场景映射成 5 档 | 不知道 DOM，不知道单位 |
| 生成 | 档位 → CSS 字符串 | 不知道组件，不知道状态 |
| 渲染 | 挂节点 / 复用池 | 不知道"为什么是这个档" |

**关键性质**：中间那层是纯函数。任何布局 bug 都应该能在这一层用三行断言复现，如果复现不了，说明 bug 在别处。

---

## 4. 四个"故意缺失"—— 别补

**这一节是本文档最重要的部分。** 每一项都是研究者明确丢弃的，看起来像疏漏，实为取舍。补之前，先读理由。

### D1 · 不提供"必要时才长大"

Qt 有 `Minimum`（不被压，但只有在布局实在需要时才变大）。**我们没有。**

有人会想加第 6 档 `flexible`。**不要加。**
理由：flexbox 不存在"必要时"这个概念——`flex-grow` 一给，富余空间就按比例分掉了，没有中间态。要模拟只能靠 JS 二次计算剩余空间，**直接违反 A1**。
想要的效果用 `fit` + 显式 `min-width` 表达；真需要吃掉富余就用 `grow`。

### D2 · 不支持"分配但不填满"

Godot 的 `EXPAND` 不带 `FILL` 会让控件"主张一块地却缩在里面不动"。**我们不提供这个组合。**

有人会想加一个 `expandOnly`。**不要加。**
理由：这是 Godot 实现里的泄漏（它把"分配"和"占满"压成一个 flag）。CSS 天然把这两件事分在两根轴上（`flex-grow` / `align-self`）。想留白就用 `Spacer` 或 `margin-left: auto` —— 显式，可读，不靠隐式行为。

### D3 · 不在 DOM 上做"每帧全量重建"

立刻模式的经典实现是每帧重新声明并重画。**DOM 上这么做更贵，不是更省**：节点分配 + 样式重算 + 重排 + 丢焦点 + 丢 IME 组合态。
我们只取它的**外形**（`begin/sameLine/width/rect/hovered`），内核是 keyed 元素池。
所以别问"为什么 HUD 不每帧重建"——问的人没算过成本。

### D4 · 不做控件库、不做主题

一旦开始实现 `Button` 的 hover/active/disabled/focus-visible，就会长成 Qt。**停止在容器这一层。** 控件交给调用方（原生元素 + CSS）。

---

## 5. 决策记录

| # | 决策 | 放弃了什么 | 理由 | 代价 |
|---|---|---|---|---|
| 1 | 尺寸 7 档砍成 5 | `Minimum`/`Maximum` 的独立身份 | 在纯 flexbox 下 `Fixed≡Minimum`、`Maximum≡Preferred`，输出完全一致 | 无法表达"被动长大"（→D1）|
| 2 | 容器 8 砍成 4 元素 | `MarginContainer`/`CenterContainer`/`Separator` 的元素身份 | 代价是每个面板多 30 个只承载一个属性的 div | 代码里的"层"和 DOM 里的"层"不再一一对应，调试时要换算 |
| 3 | HUD 走 keyed 池 | 真正的无状态重建 | DOM 是保留模式，重建比重建贵 | 需要稳定 ID，等于自己写一个小 reconciler |
| 4 | 只读三方文档/头文件，不读实现 | 所有"实现细节" | Qt 是 LGPL，读得越深抄的风险越大；且引擎实现正是我们说好不拆的部分 | 少数行为只能标 `[推断]`（见 `research/*.md`）|
| 5 | 默认档位 = `fit` | 「不设就是 `fixed`」的直觉 | 与 Qt `Preferred`、CSS `0 1 auto` 一致；`fixed` 作为默认会导致界面在窄屏被撑破 | 需要"别压我"时必须显式写 `fixed` |

---

## 6. 风险登记（症状 → 会被误诊成什么 → 真因 → 处置）

| # | 症状 | 容易误诊为 | 真因 | 处置 | 级别 |
|---|---|---|---|---|---|
| R1 | 中文打字打一半没了 | 没监听 input / 组件重渲染太快 / 防抖写错 | keyed 池每帧把 `value` 回写，覆盖了 IME 的组合态 | **元素 focused 时禁止回写 `value`**，只写外部变更 | **高** |
| R2 | 首屏尺寸跳一下 | 布局算错了 | WebFont 未就绪时 `max-content` 偏小，字体到了再重排 | `font-display: block` + 预加载，或首帧 `visibility:hidden` | 中 |
| R3 | 改着改着开始自己算尺寸 | —— | 边界漂移：reconciler 一点点长成布局引擎 | 每当出现 `offsetWidth` 读取，停下来问"这属于求解吗" | **高** |
| R4 | 枚举里出现第 6、第 7 档 | "需求确实需要" | 档位膨胀，走回 Qt 的老路 | 回归 A2：能表达就表达，不能就写 CSS | 中 |
| R5 | div 数量翻倍 | "分层更清晰" | `MarginContainer` 类概念复活 | 回归 A3：一个属性 → 一个属性 | 中 |
| R6 | 内容宽度和预期差几个像素 | 浏览器 bug | Qt 的 `sizeHint` 与 `flex-basis:auto` 不等价（后者取 `max-content`） | 精确宽度永远显式给 `width` | 中 |

R3 和 R1 是唯二会让你加班的。其余是品味问题。

---

## 7. 边界：什么时候可以破例

现在**不写 measure/arrange**。破例需要命中下表任一条，且必须先在文档里登记：

| 编号 | 触发条件（可判定） | 允许做什么 |
|---|---|---|
| T1 | HUD 必须画进 canvas（像素级帧同步、半透明混排） | 实现 measure + arrange 两趟 |
| T2 | 必须跨容器基线对齐（CJK + 图标混排），CSS `baseline` 无解 | 只实现文本测量，不碰布局 |
| T3 | 单屏 HUD 每帧变化节点 > 300 | 切 canvas 路线 |
| T4 | 虚拟滚动 20k+ 节点 | 自研回收 + 位置计算 |

**T1 与 T3 是同一件事的两面**：上 canvas 就必然要自己排。
"以后可能需要"**不算**触发。判定不了就是没触发。

---

## 8. 术语对照

| 我们 | Qt | Godot | ImGui |
|---|---|---|---|
| `fixed` | Fixed / Minimum | `SIZE_SHRINK_*` | — |
| `fit` | Preferred / Maximum | 默认 | 默认（宽度由内容定）|
| `fill` | Expanding | `EXPAND_FILL` (3) | `SetNextItemWidth(-FLT_MIN)` |
| `grow` | MinimumExpanding | `EXPAND` + 自身不缩 | — |
| `ratio` | Ignored | `EXPAND_FILL` + `stretch_ratio` | — |
| `weight` | `stretch` (0–255) | `stretch_ratio` (float, 1.0) | — |
| `<Row>/<Col>` | QHBoxLayout | HBox/VBoxContainer | `SameLine()` |
| `<Panel>` | QFrame | PanelContainer | `BeginChild()` |
| `<Scroll>` | QScrollArea | ScrollContainer | `BeginChild()` + 滚动 |
| `Spacer` | `addStretch()` | 空 `Control` + EXPAND | `Dummy()` |
| `padding` | QLayout margins | MarginContainer | `PushStyleVar(ItemSpacing)` |
| `sameLine()` | — | — | `SameLine()` |
| `rect()` | `geometry()` | `get_global_rect()` | `GetItemRectMin/Max()` |

---

## 9. 自检清单（提交前）

1. **新代码有没有读取 `offsetWidth` / `getBoundingClientRect`？** 有 → 你越界了（除非命中 T1–T4）。
2. **有没有新增 `SizePolicy` 成员？** 有 → 回到 A2，说明为什么现有 5 档不行。
3. **有没有新增容器元素？** 有 → 回到 A3，先证明它承载一个 css 属性之外的东西。
4. **布局 bug 能否用 `flexStyle()` 的三行断言复现？** 不能 → bug 不在布局层，别在这层修。
5. **HUD 里有没有把池中的元素存到业务变量里？** 有 → 违反 A4，它下一帧就被回收了。

---

## 10. 文档地图

| 文件 | 用途 | 可信度 |
|---|---|---|
| `research/qt-sizepolicy.md` | 七档表、位标志、默认值陷阱 | 官方文档，`[确认]` |
| `research/godot-containers.md` | 容器职责、size_flags、锚点失效规则 | 真实 `.tscn` 实证 + 文档 |
| `research/imgui-immediate.md` | 18 个签名、立刻模式、DOM 落地三路线 | 本地 `imgui.h` 源码 |
| `research/mapping-to-dom.md` | 5 档 + 4 容器 + 10 函数的具体定义 | 推导结论 |
| `vendor/imgui.h` | 签名出处，v1.93.1 WIP | MIT |

标注约定：`[确认]/[源码]/[实证]` 有出处可复核；`[推断]` 我推的，用前先验；`[决策]` 我下的判断，可以反驳。

**已知缺口**：Godot `SizeFlags` 的数值 0/1/2/8 是推断（只有 3、4 被真实场景实证）。要坐实就翻官方 `Control.SizeFlags` 枚举页。

---

## 11. 一句话记住这个项目

> **我们不是在造一个能画一切的 UI 框架，是在造一套"谁让步"的有限语法。**
> 语法之外的需求，交给 CSS —— 这不是妥协，是设计。
