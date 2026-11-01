# Godot：容器组合（Container composition）

> 只拆「职责单一 + 嵌套」，不拆控件库。
> 本文的骨架不是编的，来自实际保存的 `settings_menu.tscn`（156 行，7 层）。
> 图例：**[实证]** = 该 `.tscn` 里真实出现；**[确认]** = Godot 文档语义；**[推断]** = 推论。

## 1. 结论先说

Godot 的 UI 不是"控件自带布局属性"，而是**把布局职责从控件里抽出来，交给专门的空容器节点**。

一个 `Button` 不知道自己该放哪儿。把它塞进 `HBoxContainer`，位置就由容器决定；再往外套一层 `MarginContainer`，边距就由那层决定。**每个节点只回答一个问题。**

对比 Qt：Qt 是"控件 + 布局对象（QLayout）挂在控件上"。Godot 是"布局本身就是节点，和控件平级"。后者更啰嗦，但**组合起来没有隐式行为**——这正是我们要的那部分。

## 2. 容器清单（限定 8 个）

| 容器 | 只做哪一件事 | 我们这儿该是什么 |
|---|---|---|
| `HBoxContainer` | 横着排 + 间距 | 一个 div，`display:flex` [实证] |
| `VBoxContainer` | 竖着排 + 间距 | 一个 div，`display:flex; flex-direction:column` [实证] |
| `GridContainer` | 等宽网格，列数固定 | 一个 div + `display:grid` |
| `MarginContainer` | 只给内边距 | **纯 CSS `padding`，不该有元素** [实证] |
| `PanelContainer` | 只给背景（+把子节点撑满） | 一个 div + `background` [实证] |
| `CenterContainer` | 只做居中 | **`display:grid; place-items:center`，不该有元素** [实证] |
| `ScrollContainer` | 只做滚动视口 | 一个 div + `overflow:auto` |
| `SplitContainer` | 可拖拽分栏 | 一个 div + 拖拽逻辑（不是布局） |

**判断标准**：如果它对应的 CSS 只有一个属性、不产生新元素，就不要在我们的套件里造组件。`MarginContainer` 和 `CenterContainer` 属于这一类——它们是"节点版的 CSS 属性"。

## 3. size_flags：一个子项在两轴上分别表态

`Control` 有 `size_flags_horizontal` 和 `size_flags_vertical` 两个独立属性 [确认]。取值是位标志：

| 常量 | 值 | 含义 |
|---|---|---|
| `SIZE_SHRINK_BEGIN` | 0 | 贴起始边 [推断] |
| `SIZE_FILL` | 1 | 填满分配到的格 [推断] |
| `SIZE_EXPAND` | 2 | 主张分配剩余空间 [推断] |
| `SIZE_EXPAND_FILL` | 3 | 既主张又填满（2\|1）| **[实证]** |
| `SIZE_SHRINK_CENTER` | 4 | 在格子里居中，不填满 | **[实证]** |
| `SIZE_SHRINK_END` | 8 | 贴结束边 [推断] |

**实证依据**：真实场景里 `HSlider` 用 `size_flags_horizontal = 3`（要占满整行剩余宽度），`CheckButton` 用 `size_flags_vertical = 4`（在行内垂直居中，但不拉伸）。这两个值与视觉预期完全吻合，可以当基准。

### 那个坑：EXPAND 但不 FILL

这是 Godot 独有的表达，**Qt 里没有对应**。

- `EXPAND` 负责"**分到**多少空间"
- `FILL` 负责"**占满**分到的空间"

只给 `EXPAND`（=2）不给 `FILL`：控件会**主张**一块地盘，但自己缩在那一块里不动。视觉上就是"右边留了一截空白"。

**[推断]** 对应 CSS：`EXPAND` ≈ `flex-grow: 1`，而 `FILL` ≈ `align-self: stretch`（交叉轴）或 `width: 100%`（主轴）。flexbox 把这两件事**分开在两根轴上**，Godot 把它压成一个 flag——所以 Godot 更容易踩这个坑，flexbox 反而不容易。

### stretch_ratio

`stretch_ratio` 默认 1.0，只在同容器兄弟间按比例分 [确认]。语义等价于 Qt `stretch` 和 CSS `flex-grow`，区别是它**是浮点数且默认 1**（Qt 默认 0），所以"什么都不设"时 Godot 是平均分，"什么都不设"时 Qt/CSS 是按内容分。

## 4. 一条硬规则（可以直接贴进代码规范）

> **节点一旦是 Container 的子节点，它的 anchors / position / size 全部由容器接管，自己设的会被覆盖。**

证据在文件的每一行里 [实证]：

```diff
  [node name="SettingsMenu" type="Control"]     ← 根节点
- layout_mode = 1          (锚点模式)
- anchors_preset = 15      (铺满父级)

  [node name="Padding" type="MarginContainer" parent="Center/Panel"]
- layout_mode = 2          (容器模式 —— 不再是 1)
+ (此后再没有任何 anchor_* 行)
```

`layout_mode` 从 1 变 2，意味着这条分支之后**锚点彻底退出**。整棵树里，锚点只出现在容器树之上的"外壳"三层。

**移植到我们这边**：flex 子项一律不许再写 `position: absolute`。要绝对定位，先脱离 flex 上下文（换一个 `position: relative` 的父级）。

## 5. 锚点只要 4 个预设

锚点模式与容器模式是**两套互斥的心智**。我们的套件**只支持容器模式**，锚点降级成 CSS 逃生口：

| preset | 用途 | CSS |
|---|---|---|
| `PRESET_FULL_RECT` (15) | 铺满父级 | `inset: 0` [实证] |
| `PRESET_TOP_LEFT` (0) | 钉左上 | 无（默认流）|
| `PRESET_CENTER` (8) | 居中 | 父级 `place-items:center` |
| `PRESET_BOTTOM_WIDE` (12) | 底部拉宽 | `position:absolute; bottom:0; left:0; right:0` |

## 6. 真实嵌套树（来自 settings_menu.tscn）

```
Control "SettingsMenu"                      ← 外壳，锚点模式
├─ ColorRect "Backdrop"      (inset:0)      ← 遮罩，纯视觉
└─ CenterContainer "Center"  (inset:0)      ← 只做居中
   └─ PanelContainer "Panel" (min-width 520)   ← 只做背景 + 撑开
      └─ MarginContainer "Padding"  (24/20)    ← 只做边距
         └─ VBoxContainer "Column"  (sep 14)   ← 只做竖排
            ├─ Label "Title"                   ← 标题
            ├─ HSeparator "TitleRule"          ← 分隔线
            ├─ HBoxContainer "MasterVolume" (sep 12)   ← 一行
            │  ├─ Label "Caption"     (min-width 150, 垂直居中)
            │  └─ HSlider "Slider"    (h:EXPAND_FILL, v:CENTER)
            ├─ HBoxContainer "Fullscreen"      ← 一行
            │  ├─ Label "Caption"     (min-width 150)
            │  ├─ Control "Spacer"    (h:EXPAND_FILL)  ← ★ 空节点撑开
            │  └─ CheckButton "Toggle"(v:CENTER)
            ├─ HSeparator "FooterRule"
            └─ HBoxContainer "Footer" (alignment: END)
               ├─ Button "Cancel"
               └─ Button "Apply"
```

三个值得抄的细节：

1. **`Spacer` 是一个空 `Control`**，只负责把右侧控件顶到边。不需要 margin，不需要负空间——用一个"主张空间但不画东西"的节点。
2. **每个 HBox 里有四个兄弟时不要用空格对齐**，用 `Spacer` 或 `alignment`。
3. **`custom_minimum_size` 挂在 Panel 上（520）而不是被压到具体控件**——下限声明在"块"这一层，不在"内容"这一层。

## 7. 这套好在哪里

相对"一个 div 塞满 flex 属性"：

1. **可读**：每层一个职责，看节点名就知道这层干什么。
2. **可换**：想给整个设置面板加个滚动，外面套一层 `ScrollContainer` 即可，里面一行不改。
3. **可复用**：`MarginContainer + VBox` 是"表单"这个模式的通用壳子，换内容不用换骨架。
4. **没错**：职责单一意味着"这层的属性该不该有"是可判定的，不是审美问题。

代价：节点数多一倍。所以我们的 DOM 套件应该在**代码层面**保持这个分层，但**产出时合并**——`MarginContainer` 不要真的渲染成 div（见第 2 节）。

## 来源与许可

- 实际场景文件：`settings_menu.tscn`（Godot 4，format=3），用户自建。
- Godot 官方文档：<https://docs.godotengine.org/en/stable/>（Control / Container 类）。
- 许可：Godot 引擎 MIT；文档 CC BY 3.0。本项目未引入 Godot 代码。
