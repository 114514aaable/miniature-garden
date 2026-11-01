# Dear ImGui：立刻模式

> 只拆「每帧重新声明 + 用矩形做命中」，不拆绘图、主题、控件实现。
> 签名取自 `vendor/imgui.h`（v1.93.1 WIP），逐字照抄，未改动。
> 图例：**[源码]** = 签名或注释直接来自该头文件；**[推断]** = 我的推论。

## 1. 三组签名

### 1.1 帧与作用域

| 签名 | 一句语义 | 进我们的 HUD API 吗 |
|---|---|---|
| `bool Begin(const char* name, bool* p_open = NULL, ImGuiWindowFlags flags = 0);` | 开一个窗口，游标复位到窗口内容左上 [源码] | 是（HUD 根） |
| `void End();` | 关窗口，提交本帧布局 | 是 |
| `bool BeginChild(const char* str_id, const ImVec2& size = ImVec2(0,0), ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);` | 开一个子区域，有自己的游标/裁剪/滚动 [源码] | 是（分栏/面板） |
| `void EndChild();` | 关子区域 | 是 |
| `void PushID(const char* str_id);` (另有 `const void*` / `int` 重载) | 往 ID 栈压一层，影响此后所有控件 ID [源码] | **必须** |
| `void PopID();` | 弹出 | **必须** |
| `void PushStyleVar(ImGuiStyleVar idx, float val);` (另有 `ImVec2` 重载) | 临时改一个样式量，帧内有效 [源码] | 可选 |
| `void PopStyleVar(int count = 1);` | 还原 | 可选 |

### 1.2 布局（游标操作）

| 签名 | 一句语义 | 进 API 吗 |
|---|---|---|
| `void SameLine(float offset_from_start_x=0.0f, float spacing=-1.0f);` | 撤销换行：把下一个控件摆到同一行 [源码] | 是 |
| `void SetNextItemWidth(float item_width);` | 只设**下一个**控件的宽度；负值 = 从右侧减 [源码] | 是 |
| `void PushItemWidth(float item_width);` / `void PopItemWidth();` | 设一段区间的宽度 | 可选 |
| `void BeginGroup();` / `void EndGroup();` | 锁住起点，把一堆控件打包成一个"item"（于是能被 SameLine 和命中测试当成整体）[源码] | 可选 |
| `void Dummy(const ImVec2& size);` | 占位，不接收点击 [源码] | 是（对应 Godot 的 Spacer） |
| `void Indent(float indent_w = 0.0f);` / `void Unindent(float indent_w = 0.0f);` | 左右缩进游标 | 可选 |
| `void AlignTextToFramePadding();` | 让文本基线与带框控件对齐 [源码] | 是（真需要） |
| `ImVec2 GetContentRegionAvail();` | 当前位置到可区末尾还剩多少 [源码] | 是 |

### 1.3 命中与矩形

| 签名 | 一句语义 | 进 API 吗 |
|---|---|---|
| `ImVec2 GetItemRectMin();` / `ImVec2 GetItemRectMax();` | **上一个** item 的包围盒（屏幕坐标）[源码] | 是 |
| `bool IsItemHovered(ImGuiHoveredFlags flags = 0);` | 上一个 item 是否被悬停 [源码] | 是 |
| `bool IsItemActive();` | 上一个 item 是否按住中（拖拽要它）[源码] | 是 |
| `bool InvisibleButton(const char* str_id, const ImVec2& size, ImGuiButtonFlags flags = 0);` | 有命中、无外观的按钮——自定义交互的挂点 [源码] | 是 |
| `void SetCursorScreenPos(const ImVec2& pos);` | 绝对定位下一个控件（游标直接跳）[源码] | 是 |

**明确不要的**：`DrawList` 那一套（`GetWindowDrawList`、`AddRect`…）、`SetNextWindowSize` 系列、`ImGuiStyle` 的配色与字体 atlas、`.ini` 持久化。这些是"画"和"存"的事，不是"布局"的事。

## 2. `SameLine` 为什么必须存在

因为**游标是唯一的**。

保留模式里，"两个控件并排"是容器的属性（`flex-direction: row`）。立刻模式没有容器——只有一根不断往下走的游标。默认每个控件独占一行（游标下移）；`SameLine()` 的作用是**这一次不换行**。

**[推断] 对应 CSS**：`SameLine` ≈ 把父级临时当 `display:flex` 且子项 `flex: 0 0 auto`。区别是 CSS 里这个决定写在**父级**，ImGui 写在**子项的调用顺序**里。这是两者的根本气质差异：**声明顺序本身就是布局**。

## 3. `PushID` 为什么是刚需

立刻模式每帧重新声明，所以要靠 **ID** 来认出"这还是上一帧那个东西"（保持焦点、保持拖拽中的状态、保持动画进度）。

但界面是嵌套循环生成的：两个 `TreeNode` 里的滑块都叫 `"##slider"`，标签一样 → 哈希出的 ID 一样 → **互相污染**。

`PushID-PopID` 提供一个栈：ID 是"栈内容 + 控件标签"的哈希，所以路径不同就不会撞。

**[推断] 对我们的直接结论**：HUD 里任何由循环/嵌套生成的元素，`key` 必须是**路径**而不是名字。React 的 key 只在兄弟间唯一即可，ImGui 的 ID 是全局一条链——我们的实现应该走后者（路径哈希），因为 HUD 元素经常跨层移动而需要保持状态。

## 4. 立刻模式的本质

```
一帧内：
  声明 UI（函数调用即布局）
      ↓ 每一步推进游标、立即算出矩形
  记录矩形（GetItemRectMin/Max）
      ↓
  用矩形做命中测试（IsItemHovered / IsItemActive）
      ↓
  画（DrawList）
  丢弃全部状态 → 下一帧重新来过
```

没有控件对象、没有状态树、没有 diff、没有"创建/销毁"。**唯一的持久状态是 ID→（滚动、展开、焦点、动画）**。

这就是它对"每帧重绘的游戏 HUD"是降维的原因：游戏已经是帧驱动的，UI 跟着帧走，不引入第二套生命周期。

## 5. 但它落到 DOM 上会遇到麻烦（本文最重要的一节）

DOM 是**保留模式**：节点在、样式在、焦点在、事件监听在。所以"每帧重新声明"直接翻译成 DOM 就会变成"每帧重建节点"——这比保留模式**更贵**，不是更省。

三条路线：

| 路线 | 做法 | 每帧成本 | 风险 |
|---|---|---|---|
| **A 全量重建** | 每帧清空容器、重新创建节点 | 节点分配 + 样式重算 + 重排 + 重绘 | 眨眼、GC 抖动、丢焦点、丢输入法状态 |
| **B keyed 元素池** | 维护 `Map<id, Element>`；每帧产出声明，按 id 复用，只改变化了的 `style/transform/text` | 只改变化的属性；`transform` 走合成层，不触发重排 | 你其实写了一个简易 diff —— 复杂度回来了，但只在"池"这一层 |
| **C HUD 独立 canvas** | HUD 画在自己的 canvas 层 | 纯绘制 | 文本渲染质量、无障碍、富内容（输入框、tooltip）全丢；**且需要自己 measure/arrange** |

**推荐：现在走 B。**

理由：
- B 保留了 DOM 的全部免费能力（文本排版、滚动、输入、无障碍），这些恰恰是 A 和 C 丢掉的。
- B 的复杂度可控——不是通用 diff，是"按 id 查池子、缺就建、多就删、其余更新"。
- B 的 ID 需求正好和 `PushID` 那套对上，不是额外发明。

**什么时候必须换**（触发条件，硬指标）：

| 条件 | 换到 |
|---|---|
| HUD 每帧变化节点数 > 300 | C（canvas） |
| 需要与游戏画面**像素级同步**（血条抖动、屏幕空间特效、半透明叠加） | C |
| 需要跨容器基线对齐 / 混排中日韩文 + 图标 | 先看 B 能否用 CSS 解决，不行才考虑自带测量 |

**[推断] 必须点明的一句**：B 路线其实**不是纯粹立刻模式**——它是"立刻模式的 API 外形 + 保留模式的实现内核"。这不丢人，反而是正确的工程取舍：拿到 ImGui 的**易用性**（声明式、无状态树），又不付 DOM 重建的代价。

## 6. 真正该带走的三样东西

不是"每帧重绘"，而是：

1. **声明即布局**：界面是一串按顺序的调用，不是一棵先建后挂的树。
2. **游标 + 矩形**：定位靠"上一个 item 的矩形 + 剩余空间"，而不是父级的布局属性。
3. **ID 栈**：状态挂在路径哈希上，跟节点生命周期解耦。

第 3 条在 DOM 上反而更自然（元素本来就有 key），第 2 条在 flexbox 上会退化（浏览器替你算），第 1 条是唯一稳赚不赔的。

## 来源与许可

- 本地 `vendor/imgui.h`，Dear ImGui v1.93.1 WIP（`IMGUI_VERSION_NUM 19302`）。
- 上游：<https://github.com/ocornut/imgui>
- 许可：MIT。本文签名照抄（API 签名不受版权保护），注释均以我方语言重述，未复制实现。
