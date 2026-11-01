# 任务书：三套布局/UI 模型的「可迁移知识」提取

> 目标不是抄代码，是抄**判断**。产出物是四份 markdown，能直接喂给一个 DOM + flexbox 的 UI 套件设计。
> 现有技术栈：TypeScript + DOM（布局由浏览器 flexbox 提供），游戏主体每帧重绘，HUD 未来可能上 Canvas。

## 0. 硬性边界（先看这条，违反就重做）

| 允许 | 禁止 |
| --- | --- |
| 枚举名、属性名、函数签名、行为语义表 | 大段源码、实现细节、算法伪代码 |
| 我们自己的话总结「什么场景用哪档」 | 复制注释、复制文档原文段落 |
| 结构示意（容器树用缩进列表画） | 复制任何 .ui / .tscn / .cpp 片段 |

**许可要求**：
- Qt 为 LGPL/GPL —— **只看文档**（doc.qt.io），输出里不得出现任何 Qt 源码片段，只允许枚举名与属性名。
- Godot 为 MIT —— 可以看结构，但仍需用自己的话重写。
- Dear ImGui 为 MIT —— 签名可以照抄（API 签名本身不受版权保护），实现不许抄。

每份文档末尾必须有 `## 来源与许可` 一节，列出参考的文档 URL 和对应许可。

---

## 1. `research/qt-sizepolicy.md` —— 拆「谁想变大」

不是要 Qt 的布局引擎，只要它那套**尺寸意图声明**。这一份的产出是**一张表**，表比字值钱。

必须包含：

### 1.1 策略总表（核心交付物）

七档全列，列固定为：

| policy | 想变大吗 | 能大于 sizeHint | 能小于 sizeHint | 等价 flexbox | 什么时候用 |
| --- | --- | --- | --- | --- | --- |
| Fixed | | | | | |
| Minimum | | | | | |
| Maximum | | | | | |
| Preferred | | | | | |
| Expanding | | | | | |
| MinimumExpanding | | | | | |
| Ignored | | | | | |

要求：
- `等价 flexbox` 一栏要给具体值，如 `flex: 0 0 auto` / `flex: 1 1 auto`，不许写「类似」。
- `什么时候用` 一栏要具体场景（如「按钮、图标」「对话框里的说明文字」「主编辑区」），不许写「一般情况」。
- 必须用一段话说清 **Minimum 和 MinimumExpanding 的差别**（这是全表最容易记混的一格）。
- 必须说清 **sizeHint 与 minimumSizeHint 的关系**，以及 QWidget 默认策略是什么。

### 1.2 两个正交维度

- 水平/垂直策略互相独立（对应我们 flex 主轴 vs 交叉轴），给一个两轴策略不同的例子，说明为什么需要分开设。
- `stretch` 因子：只在同布局的兄弟间分配剩余空间，`stretch=0` 的确切含义，和 flex-grow 的对应关系与**不一致之处**（Qt 的 stretch 是按比例切剩余空间，flex-grow 也是按比例切，但有 sum < 1 的边界差异，去确认）。

### 1.3 只要这三件事

明确回答：如果我们的模型只能保留三个概念，是不是 `sizeHint / 是否可伸缩 / 伸缩权重`？Qt 里还有哪些概念是**必须**补进来的（如 maximumSize），哪些是**可以砍掉**的（如 sizeConstraint、layout 嵌套）。给一个「我们只留 5 档」的收敛建议。

### 1.4 不要写

QSS、QStyle、主题、具体控件类、布局引擎的 measure/arrange 实现。

---

## 2. `research/godot-containers.md` —— 拆「容器职责单一 + 嵌套」

要的是**组合方式**，不是控件库。

必须包含：

### 2.1 容器清单（限定 8 个，多一个不要）

BoxContainer(H/V) / GridContainer / MarginContainer / PanelContainer / CenterContainer / ScrollContainer / SplitContainer / TabContainer。

每个一行：「只管一件事」是哪件事 + 对应我们的 DOM 是什么（一个 div + 一个 class？还是纯 CSS？）。**明确哪些容器在我们这儿根本不该存在**（比如 CenterContainer 就是 `margin:auto`，PanelContainer 就是带背景的 div）。

### 2.2 size_flags 组合表

horizontal/vertical 各自独立，取值：`FILL` / `EXPAND` / `EXPAND_FILL` / `SHRINK_BEGIN` / `SHRINK_CENTER` / `SHRINK_END`。

给表：flag 组合 → 行为 → CSS 等价（`align-self` / `justify-content` / `flex`）。必须解释：
- `EXPAND` 不加 `FILL` 会发生什么（这是 Godot 独有的坑，Qt 里没有对应）。
- `stretch_ratio` 和 Qt `stretch`、CSS `flex-grow` 三者的对应。

### 2.3 一条硬规则（重要）

**Control 作为 Container 的直接子节点时，anchors/position/size 由容器接管，自己设的会被覆盖。**
对应我们 DOM 的：flex 子项不要再用 `position:absolute`。把这条写成一句能贴进代码规范的话。

### 2.4 锚点只要 4 个预设

anchors+offsets 全讲没必要。只给 4 个 preset（左上角、铺满、居中、底部拉宽）→ CSS 的映射，并说明**锚点模式与容器模式是互斥的两套心智**，我们的套件要不要同时支持（建议：只支持容器模式，锚点用 CSS 逃生口）。

### 2.5 一个完整嵌套树（核心交付物 2）

画一个真实的**设置界面**，6~10 层，每层一行，行内注释职责：

```
MarginContainer (padding: 16)          // 只负责边距
└─ VBoxContainer (separation: 8)       // 只负责竖排 + 间距
   ├─ Label "Audio"                    // 分组标题
   ├─ HBoxContainer                    // 一行：标签 + 控件
   │  ├─ Label "Volume"  (size_flags_h: FILL)
   │  │  └─ ... 
   │  └─ HSlider        (size_flags_h: EXPAND_FILL, stretch_ratio: 1)
   ├─ HSeparator
   └─ HBoxContainer (对齐: 右)         // 按钮行
      ├─ Button "Cancel"
      └─ Button "Apply"
```

要求：**每一层都只做一件事**，并标注这一层「如果换成 DOM 是什么」。最后用 5 行话总结这套嵌套相对「一个 div 塞满 flex 属性」好在哪。

### 2.6 不要写

Theme、StyleBox、主题继承、控件属性大全、Godot 3 与 4 的差异考古。

---

## 3. `research/imgui-immediate.md` —— 拆「立刻模式」

你说这个最有用，那这份就最该克制：**只要签名 + 语义 + 一条适配分析**。

### 3.1 函数签名表（限定 ~18 个，按三组）

| 组 | 函数 | 签名 | 一句话语义 | 进我们 HUD API 吗 |
| --- | --- | --- | --- | --- |

三组：
1. **帧与作用域**：`Begin/End`、`BeginChild/EndChild`、`PushID/PopID`、`PushStyleVar/PopStyleVar`
2. **布局**：`SameLine`、`SetNextItemWidth`、`PushItemWidth/PopItemWidth`、`BeginGroup/EndGroup`、`Dummy`、`Indent/Unindent`
3. **命中与矩形**：`GetItemRectMin/Max`、`IsItemHovered`、`IsItemActive`、`InvisibleButton`、`SetCursorScreenPos`

要求：
- 签名照抄官方头文件（只到参数列表，不要实现）。
- `SameLine` 单独展开 3 行：为什么立刻模式里需要它（因为布局游标是唯一的），对应 CSS 是什么。
- **`PushID` 必须解释清楚**：为什么同名控件会冲突，ID 栈怎么解决，这决定我们 HUD 的元素 key 生成策略。
- 明确「不需要进 API」的函数也要列 2~3 个并说明理由（如 DrawList 那套）。

### 3.2 立刻模式的本质（200 字以内）

用画的：一帧内 `声明 → 布局游标推进 → 记录矩形 → 命中测试`，没有控件对象、没有状态树、没有 diff。配上「为什么这对每帧重绘的游戏 HUD 是降维」。

### 3.3 关键分析：立刻模式落到 DOM 上（这份文档最重要的一段）

我们的现状是 DOM，而 DOM 天生是保留模式。**必须回答：立刻模式声明怎么映射到 DOM 而不每帧重建节点？** 至少给出三条路线并打分：

| 路线 | 做法 | 每帧成本 | 风险 |
| --- | --- | --- | --- |
| A 全量重建 | innerHTML/节点全造 | DOM churn + 重排 | 闪烁、GC 压力、丢焦点 |
| B keyed 元素池 | 按 ID 复用节点，只改 style/transform | 无重排（composited） | 就是简易 diff，复杂度回升 |
| C HUD 独立 canvas | HUD 画在自己的 canvas 层 | 纯绘制 | 文本渲染、无障碍、字体 |

给推荐结论 + 触发条件（什么规模下 A 够用、什么时候必须 B 或 C）。**这段允许下判断，不要中立。**

### 3.4 不要写

ImGui 的 widget 实现、style/theme 系统、.ini 持久化、docking 分支、DrawList 细节、字体 atlas。

---

## 4. `research/mapping-to-dom.md` —— 三份合起来的结论

不是复述，是**收敛**。必须包含：

1. **我们的 SizePolicy 枚举**：从 Qt 七档砍到几档？每档 → 一行 CSS。给出 TypeScript 类型定义（`type SizePolicy = ...` 和它编译出的 flex 字符串），这是唯一允许出现的、我们自己的代码。
2. **我们的容器集**：从 Godot 八容器砍到几个？每个 → 一个 class 或纯 CSS，并说明为什么不加别的。
3. **HUD 通道**：ImGui 那套 API 在我们这儿留几个函数？给出最终签名（我们自己的，不是 ImGui 的）。
4. **不写的清单**：明确写下「现在不写布局引擎」的边界，以及**触发条件**——什么情况下才需要自己的 measure/arrange 两趟（建议写死：全 Canvas HUD / 需要跨容器 baseline 对齐 / 需要 20k 节点级虚拟滚动）。触发条件要可判定，不许写「以后再说」。
5. **风险登记**：至少 3 条，如「Qt 语义在 flexbox 上有一格对不上（是哪一格）」「Godot 的 EXPAND 无对应」「立刻模式 + DOM 的焦点管理」。

---

## 5. 交付要求

- 落盘：`research/` 下四个文件 + 一个 `README.md` 索引（含来源、许可、阅读顺序）。
- 每份 **≤ 150 行**，表格优先于散文。
- 每条结论标 **[文档确认]** 或 **[推断]**，不许混。
- 版本钉死：Qt 6 文档、Godot 4.x 文档、Dear ImGui master 分支头文件。
- 文末链接用可点击 URL，不写「参见官方文档」。

**验收标准（三条，缺一不合格）**：
1. 拿 `qt-sizepolicy.md` 的表，能不问人就写出一行 `flex` 值，且七档都能。
2. 拿 `godot-containers.md` 的树，能照着敲出一个设置界面。
3. 拿 `imgui-immediate.md` 的 3.3 节，能说出 HUD 第一版走哪条路线，以及什么时候必须换。
