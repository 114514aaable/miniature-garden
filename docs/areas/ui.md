# 模块：界面（ui）

> 改这里如果：**你要加一个界面元素、改布局、加设置项**。
> 世界里的血条/预警格 → 那是情报层（`game/systems/intel/`）的事，不是 UI。

## 三块

```
game/systems/ui/spec.ts   描述层：row / col / text / button / input / field / grid / bar / modal / canvas
game/systems/ui/dom.ts    渲染层：把描述变成 DOM（唯一碰 document 的地方）
tools/pages.mjs           页面骨架 + 具体页面（启动器、游戏页）+ CSS
game/systems/config/      所有可调项（格子大小、按键、速度、开发者模式）
```

**规则：先想「用哪个描述」，不要直接 `document.createElement`。**

## 现有部件

| 部件 | 用法 |
|---|---|
| `row` / `col` | 一维排列（`gap`、`justify`、`align`） |
| `text(label, {policy})` | 文本；`policy` 决定伸缩方式 |
| `button(label, onClick)` | 按钮 |
| `input(value, onInput, {type})` | 输入框 |
| `field(label, control)` | 「标签 + 控件」一行 |
| `grid({columns, cell}, ...cells)` | 等宽网格（背包、快捷栏） |
| `bar(value, max, {label, showValue, color})` | 任何「有上限的当前值」 |
| `modal(content, {title})` | 浮层卡片（自带遮罩） |
| `canvasNode(w, h, draw)` | 自绘部件（小地图） |
| `withEvents(node, handlers, attrs)` | 给描述挂 DOM 事件 |

## 不变量

1. **描述是纯数据**：`button()` 返回对象，不是 DOM。要挂事件用 `withEvents`。
2. `style` 是只读的 `Record<string,string>`；要改就先 `{...node.style, ...}` 再造新节点。
3. 浮层用 `modal`，不要自己拼遮罩。
4. 所有可调的尺寸/开关进 `config.ts`，页面里不留魔法数字。

## 常见坑（都踩过）

- **模板字符串里的 `\n`**：`pages.mjs` 是模板字符串，写 `join('\n')` 会变成真换行，**整个模块脚本语法错误**。要写 `join('\\n')`，或者干脆避免换行。
- **重复绑定**：同一个按钮 `addEventListener` 两次 → 开一次关一次，看起来「点了没反应」。
- **`hidden` 被 `display:flex` 覆盖**：自定义 `display` 的容器要加 `[hidden] { display: none }`。
- **拖拽失焦**：跨元素拖拽容易丢事件，能在同一个浮层里完成就别跨。
- **改完必须重启服务**：页面 HTML 在 `serve.mjs` 进程内存里（见 [`host.md`](host.md)）。

## 改完怎么验

```bash
node --check tools/pages.mjs
node tools/build-web.mjs
# 起服务后，把服务端返回的 <script type="module"> 抠出来再 node --check
```

**第二步不能省**：`pages.mjs` 语法正确，不代表生成的页面脚本正确。

## 设计约定（改界面之前先读这节）

### 1. 分层

```
Screen   页面（启动器 / 游戏）
Region   区域（左栏 / 舞台 / 底栏 / 右下）
Widget   套件部件（row / col / grid / bar / …）
Data     只读快照 + config
```

**只有 `dom.ts` 和页面骨架能碰 `document`。** 其余一律产描述。

### 2. UI 不持有游戏状态

只读快照。**不缓存血量、不推算状态**——缓存过的数据一定会过期，
然后界面就显示「存档里的旧值」。

### 3. 降级：三种状态，别混

| 状态 | 含义 | 表现 |
|---|---|---|
| `absent` | 没有对应槽位/数据 | **不挂载**，看不见，开发模式记一条日志 |
| `disabled` | 有，但当前不可用 | 灰掉，点了给提示 |
| `hidden` | 有，只是暂时看不见 | 占位保留，布局不塌 |

**「保存但无效」是最坏的状态**：它让人以为部件在工作。所以宁可 `absent`。

规则被关掉 → 快捷栏那一格变 `disabled` 占位（不是 `absent`），点它提示「不可用」。

### 4. 树形 id

```
screen.game.region.left.portrait
screen.game.region.left.status
screen.game.region.left.equip.0
screen.game.region.bottom.hotbar.3
```

- id **由结构推导**，不手写——手写的 id 一定会腐化；
- 只有 `region` 和「需要被外部引用」的部件才有稳定 id；其余用序号；
- **id 是接口，不是装饰**：AI 要能说「关掉热键栏」。

### 5. 遮罩

每个 region 可以带一个遮罩（变暗 / 模糊 / 裁剪），另有全局遮罩。

**层级只写在一张表里**，组件里禁止出现 `z-index`：

```
mask.global    100
modal           90
mask.region.*   50
region.*        10
```

（违反这条的代价：过两周就回到「谁盖谁」的调 z-index 泥潭。）

### 6. 布局

- `flex` 负责排布；**绝对定位只用于浮层**（modal / 提示 / 小地图）；
- 不做测量、不做二次布局；
- 所有尺寸与开关进 `config.ts`。

### 7. 验证

```
spec 纯函数测试        描述对不对
抠出页面脚本 --check   生成的 JS 语法对不对
人工看一眼             视觉与手感（只有这条能验）
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [host.md](host.md) | 你要改页面怎么被服务出来 |
| [../systems/combat.md](../systems/combat.md) | 你要把界面和战斗数据连起来 |
| [../modules/README.md](../modules/README.md) | 你要查规则/组件的字段 |
