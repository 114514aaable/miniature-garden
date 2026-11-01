# 收敛：三份资料 → 一套 DOM UI 套件

> 这一份不是复述，是**砍**。三份原料共 20 个概念，落到我们这儿只剩 5 个尺寸档 + 4 个容器元素 + 10 个 HUD 函数。
> 图例：**[决策]** = 我下的判断；**[推断]** = 依据但未实证。

## 1. 尺寸策略：7 → 5

### 1.1 先砍哪两刀

对照 `qt-sizepolicy.md` 的七档，在**纯 flexbox 环境**下有两对**不可区分**：

| 原档 | 等价于 | 为什么 |
|---|---|---|
| `Fixed` | `Minimum` | 都是"不能小于 hint、不主动抢"。Qt 的 GrowFlag 只在"布局实在需要"时生效，而 flexbox 里"没有兄弟要长"时谁都不会长——结果一样。[推断] |
| `Maximum` | `Preferred` | 都是"能被压、不主动长"。差异只在存在 `flex-grow>0` 的兄弟时才显现，而那时两者的表现都由别人的 grow 决定。[推断] |

**[决策]** 保留 `Fixed`、`Preferred` 这两个名字更常用的语义，各自吞掉一个。

### 1.2 最终五档

| 我们的名字 | 行为 | CSS | 来源 | 什么时候用 |
|---|---|---|---|---|
| `fixed` | 不伸不缩 | `flex: 0 0 auto` | Qt Fixed + Minimum | 按钮、图标、固定尺寸面板 |
| `fit` | 可压不可长 | `flex: 0 1 auto` | Qt Preferred + Maximum | 标签、说明文字、默认值 |
| `fill` | 占满剩余 | `flex: 1 1 auto` | Qt Expanding | 主区域、滑块、输入框 |
| `grow` | 只长不缩 | `flex: 1 0 auto` | Qt MinimumExpanding | "至少这么大，富余我也要"，但不许被压 |
| `ratio` | 忽略内容，纯比例 | `flex: 1 1 0` | Qt Ignored | 等分栏、骨架屏占位 |

```ts
export type SizePolicy = 'fixed' | 'fit' | 'fill' | 'grow' | 'ratio';

const FLEX: Record<SizePolicy, string> = {
  fixed: '0 0 auto',   // 不伸不缩
  fit:   '0 1 auto',   // 可压不可长
  fill:  '1 1 auto',   // 占满剩余
  grow:  '1 0 auto',   // 只长不缩
  ratio: '1 1 0',      // 忽略内容，纯比例
};

export function flexStyle(policy: SizePolicy, weight = 1): string {
  const [g, s, b] = FLEX[policy].split(' ');
  return `flex: ${policy === 'fill' || policy === 'grow' || policy === 'ratio'
    ? Number(g) * weight : g} ${s} ${b}`;
}
```

`weight` 就是 Qt 的 stretch / Godot 的 stretch_ratio / CSS 的 flex-grow 权重——**三家的第三件事是同一件事，直接复用**。[决策]

> 没有 `weight` 的档（`fixed` / `fit`）传了也无效。文档里要写明，否则会被当成"为什么不生效"。

## 2. 容器：3 个元素 + 2 个属性

从 `godot-containers.md` 的 8 个容器里，**只有 3 个值得变成元素**：

| 元素 | 承担 | 对应 |
|---|---|---|
| `<Row>` / `<Col>` | 排列方向 + 间距 | HBoxContainer / VBoxContainer（合并成一个 `dir` 参数） |
| `<Panel>` | 背景 + 边界（唯一有视觉的容器） | PanelContainer |
| `<Scroll>` | 滚动视口 | ScrollContainer |
| `<Grid>` | 等宽网格 | GridContainer（需要时再加） |

**降级成属性（不产生元素）**：
- `MarginContainer` → `padding`
- `CenterContainer` → `justify/align` 设 `center`
- 空 `Control` 撑开（Godot 的 Spacer）→ `margin-left: auto` 或 `<Row>` 的 `justify`
- `HSeparator` → `border-top`，不是元素

**[决策] 为什么这样砍**：如果我们把 `MarginContainer` 也做成组件，一个设置面板会产出 40 个 div，其中 30 个只承载一个属性。Godot 能接受这个代价是因为"节点"是可检查、可编辑的实体；在代码里它只是噪音。

### 2.1 容器树该长什么样（照搬真实场景）

```tsx
<Panel minWidth={520} padding={[20, 24]} radius={8}>
  <Col gap={14}>
    <Text size={24}>设置</Text>
    <Divider />
    <Row gap={12}>
      <Text width={150} align="center">主音量</Text>
      <Slider weight={1} />
    </Row>
    <Row gap={12}>
      <Text width={150} align="center">全屏模式</Text>
      <Spacer />            {/* 就是 margin-left:auto */}
      <Toggle align="center" />
    </Row>
    <Divider />
    <Row justify="end">
      <Button>取消</Button>
      <Button>应用</Button>
    </Row>
  </Col>
</Panel>
```

左边这段和 `settings_menu.tscn` 的节点树**逐层对应**，但 div 从 14 个降到 6 个左右。

### 2.2 一条代码规范

> **flex 子项不许写 `position: absolute`。** 要绝对定位，先换一个 `position: relative` 的父级，脱离 flex 上下文。

（来源：Godot 里 `layout_mode` 从 1 变 2 后 anchors 彻底失效，是同一个道理的镜像。）

## 3. HUD：10 个函数

从 `imgui-immediate.md` 的三组签名里，我们只保留这些。**外形学 ImGui，内核是 B 路线（keyed 池）。**

```ts
interface Hud {
  begin(id: string, fn: (h: Hud) => void): void;   // 对应 Begin/End
  child(id: string, size: {w?: number; h?: number}, fn: (h: Hud) => void): void;
  pushId(id: string): void;                         // 路径哈希
  popId(): void;

  sameLine(gap?: number): void;                     // 不换行
  width(w: number): void;                           // 只影响下一个
  spacer(w: number, h?: number): void;              // 对应 Dummy

  rect(): { x: number; y: number; w: number; h: number };  // 上一个 item
  hovered(): boolean;                               // 对应 IsItemHovered
  active(): boolean;                                // 对应 IsItemActive
}
```

**砍掉的**：`PushStyleVar/PopStyleVar`（用 CSS 类）、`Indent/Unindent`（用 margin）、`BeginGroup/EndGroup`（用包一层 `<Row>`）、`PushItemWidth/PopItemWidth`（有 `width()` 够用）、`SetCursorScreenPos`（DOM 不该手摆位置）。

## 4. 边界：现在不写布局引擎

**[决策] 现在不写 measure/arrange 两趟。** 理由：浏览器已经在做，而且是 C++ 写的。

允许写的：
- flex 属性生成（本文第 1 节）
- 容器组件（本文第 2 节）
- HUD 的 keyed 池（本文第 3 节）——**这是 reconciler，不是布局引擎**

不允许写的：
- 自己算元素尺寸、自己排位置、自己处理换行

**换挡的触发条件（可判定，不许写"以后再说"）**：

| 编号 | 触发条件 | 需要的动作 |
|---|---|---|
| T1 | HUD 必须画进 canvas（理由：与游戏帧同步的像素级效果 / 需要半透明混排） | 此时才实现 measure + arrange 两趟 |
| T2 | 必须跨容器基线对齐（中日韩文 + 图标混排），且 CSS `align-items: baseline` 解决不了 | 实现文本测量，但**只测文本**，不测布局 |
| T3 | 单屏 HUD 每帧变化节点 > 300 | 切 C 路线（canvas） |
| T4 | 需要 20k+ 节点的虚拟滚动 | 自研回收 + 位置计算 |

任一条成立才动。**T1 和 T3 是同一件事的两面**——上 canvas 就必然要自己排。

## 5. 风险登记

| # | 风险 | 严重度 | 处置 |
|---|---|---|---|
| R1 | **Qt 的"必要时才长"语义丢失**。`Minimum` 被并进 `fixed` 后，无法表达"空间富余时别浪费"。 | 中 | 用 `fit` + 显式 `min-width`；真需要时用 `grow`。可接受，因为这种需求罕见 |
| R2 | **Godot 的 `EXPAND` 不带 `FILL` 无对应**。我们不提供这个组合。 | 低 | 故意不提供——它本身就是坑，不复制坑 |
| R3 | **keyed 池 + 输入框会打断 IME**。每帧写 `value` 会让中文输入法的组合态被打断。 | **高** | 元素处于 focused 时**禁止回写 `value`**；只写"外部变更" |
| R4 | **字体加载时序导致首帧尺寸跳动**。`max-content` 在 WebFont 就绪前偏小。 | 中 | 字体 `font-display: block` + 预加载，或首帧 `visibility:hidden` |
| R5 | **"立刻模式"外壳下的 diff 与"不写引擎"的边界模糊**。 | 中 | 界已划在本文第 4 节：允许 reconciler，不允许 measure/arrange |
| R6 | Qt 的 `sizeHint` 与 CSS 的 `flex-basis:auto` 不等价（后者取 max-content，前者可被重写）。 | 中 | 需要精确宽度时永远显式给 `width`，不依赖内容推断 |

## 6. 三份原料 → 三句带走的话

1. **Qt**：尺寸问题只有两个布尔 + 一个权重，七档是预设不是本质。
2. **Godot**：职责单一比属性齐全重要；能在 CSS 里用一个属性表达的东西，不要造成元素。
3. **ImGui**：声明顺序即布局；但落到 DOM 上，唯一真正赚的是"无状态树"，不是"每帧重建"。

## 来源与许可

- 依赖：`research/qt-sizepolicy.md`、`research/godot-containers.md`、`research/imgui-immediate.md`
- 本文件中的 TypeScript 为本项目原创。
- Qt 语义来自 <https://doc.qt.io/qt-6/qsizepolicy.html>（GNU FDL 1.3）；Godot 语义来自 <https://docs.godotengine.org/>（CC BY 3.0）与真实 `.tscn`；ImGui 签名来自 MIT 授权的 `imgui.h`。
- **未引入任何三方的实现代码**。
