# Qt：尺寸策略（QSizePolicy）

> 只拆「谁想变大、谁只能不变、内容撑多少」这一件事。
> 图例：**[确认]** = 官方文档原文语义；**[推断]** = 我的推论或与 flexbox 的类比。

拆解结论先说：Qt 的七档不是一个枚举，而是 **4 个布尔位 + 1 个数值权重** 的组合。看懂这个，七档就不用背了。

```
GrowFlag  =1   可以超过 sizeHint（"必要时能长"）
ExpandFlag=2   应该拿尽可能多的空间（"主动抢"）
ShrinkFlag=4   可以小于 sizeHint（"可以被压"）
IgnoreFlag=8   sizeHint 作废
```

七档就是这个位组合出来的产品 [确认]：

| Policy | 位 | 值 |
|---|---|---|
| Fixed | 无 | 0 |
| Minimum | Grow | 1 |
| Maximum | Shrink | 4 |
| Preferred | Grow \| Shrink | 5 |
| Expanding | Grow \| Shrink \| Expand | 7 |
| MinimumExpanding | Grow \| Expand | 3 |
| Ignored | Grow \| Shrink \| Ignore | 13 |

## 1. 七档行为表（核心）

| Policy | 能超过 hint | 能小于 hint | 主动抢剩余空间 | 典型场景 | CSS 近似 |
|---|---|---|---|---|---|
| **Fixed** | 否 | 否 | 否 | 按钮的垂直方向、图标、固定尺寸面板 | `flex: 0 0 auto` |
| **Minimum** | 是 | **否** | 否 | 按钮的水平方向、不想被压扁的标签 | `flex: 0 0 auto` |
| **Maximum** | 否 | 是 | 否 | 分隔线、可被挤压的说明文字 | `flex: 0 1 auto` |
| **Preferred** | 是 | 是 | 否 | QWidget 默认；绝大多数普通控件 | `flex: 0 1 auto` |
| **Expanding** | 是 | 是 | **是** | 主编辑区、滑块水平方向、表格主体 | `flex: 1 1 auto` |
| **MinimumExpanding** | 是 | **否** | **是** | "至少这么大、富余我也要" | `flex: 1 0 auto` |
| **Ignored** | 是 | 是 | 是（且内容尺寸作废） | 纯按比例分栏、撑满的占位 | `flex: 1 1 0` |

读法：**先看「能不能小于 hint」，再看「抢不抢」。** 这两列决定了九成的实际行为。

## 2. 最容易记混的一格：Minimum vs MinimumExpanding

**两者都不能小于 sizeHint**（都没有 ShrinkFlag）。

差别只在 ExpandFlag：
- **Minimum**：`GrowFlag` 一个位。它"可以"超过 hint——但只在布局实在需要时才会被迫变大，它自己**不主张**。文档原话是 "there is no advantage to it being larger" [确认]。
- **MinimumExpanding**：多一个 `ExpandFlag`。它**主张**把富余空间拿走 [确认]。

一句话：**Minimum 是被动能长大，MinimumExpanding 是主动要长大；两者都不许被压小。**

> **[推断] 对应到 flexbox：这个区别在 CSS 里不存在。** flex-grow 只有"权重"一个概念，没有"必要时才长大"和"主动要"的分野。这是我们与 Qt 的第一个语义缺口，详见 `mapping-to-dom.md`。

## 3. sizeHint 与 minimumSizeHint

- `sizeHint` = 控件**自己认为**合适的尺寸，是建议值，不是硬约束 [确认]。
- `minimumSizeHint` = 控件**能接受的最小**尺寸；布局不会把它压到比这更小 [推断，文档未逐字给出与 Policy 的交互]。
- `minimumSize` / `maximumSize`（QWidget 上的显式属性）= 硬边界，**优先于** sizeHint。
- 关键：**Policy 决定"能不能动"，sizeHint 决定"从哪儿开始动"。** 两者是正交的。

## 4. 两个默认值陷阱

- `QSizePolicy()` 默认构造出的是 **Fixed** [确认]。
- 但 `QWidget::sizePolicy` 的默认值是 **Preferred** [确认]（文档在 Preferred 条目里写明 "the default QWidget policy"）。

所以「新建一个 QSizePolicy 再套上去」和「用控件自带的」行为**不一样**。写 UI 套件时，默认值别抄错。

## 5. 两个正交维度

QSizePolicy 持有**两套独立的水平/垂直策略 + 两个独立 stretch** [确认]。

为什么必须分开：一个水平滑块，水平方向要 `Expanding`（要占满），垂直方向要 `Fixed`（不能变高）。一个策略管两轴就废了。
→ 对应 flexbox 的**主轴 / 交叉轴**，天然分开，这块我们免费拿到。

## 6. stretch（伸缩权重）

- 范围 **[0, 255]** 的整数 [确认]。
- 语义：**只在兄弟之间按比例切分剩余空间**。左侧设 2、右侧设 1，则左永远是右的两倍 [确认]。
- `stretch = 0` = 不参与这个比例分配。
- **不改变 sizeHint**，只影响分配阶段 [推断]。

与 `flex-grow` 的差异：
| | Qt stretch | CSS flex-grow |
|---|---|---|
| 取值 | 整数 0–255 | 浮点 ≥0 |
| 归一化 | 兄弟间按比例 | 兄弟间按比例 |
| 溢出时 | 各自的 Policy 决定能否被压 | `flex-shrink` 决定 |

**[推断]** 在「所有兄弟都可压（都有 ShrinkFlag）」的前提下两者等价；差异出现在"有的兄弟不能压"时——这时 Qt 的行为由 Policy 兜底，flexbox 由 `flex-shrink` 兜底，通常能对上。

## 7. 只要三件事？

是的，但**不是原文那三件**。七档真正编码的是：

1. **hint** —— 内容想要多大（起步值）
2. **能不能被压** —— 空间不足时的行为
3. **抢不抢富余** —— 空间富余时的行为

原来的「Fixed/Minimum/…」只是这三件事的七个预设组合。我们自己要存的不是七个枚举，是**两个布尔 + 一个权重**。

## 来源与许可

- Qt 6.12 官方文档：<https://doc.qt.io/qt-6/qsizepolicy.html>
- 许可：Qt 文档采用 GNU FDL 1.3；Qt 本体为 LGPL/GPL/商业三授权。
- **本文未引用任何 Qt 源码**，只出现枚举名、属性名与文档中的行为描述（已用自己的话重述）[确认 项除外，其为文档语义直译]。
