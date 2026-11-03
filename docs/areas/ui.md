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

### 8. 窗口与焦点（主窗口 / 遮罩窗口）

借 Windows 的模型：**同一时刻只有一个主窗口持有焦点**。

```ts
type Window = {
  id: string;              // 树形 id：screen.game / screen.battle
  kind: "main" | "overlay";
  parent?: string;         // 遮罩挂靠谁
  stealsFocus: boolean;    // 遮罩永远 false
  pauseOthers: boolean;    // 主窗口 true，遮罩 false
};
```

三条规则：

1. 同一时刻只有一个 `main` 有焦点；
2. 非焦点的 `main` 进入 **suspended**：不渲染、不处理输入，**状态保留**；
3. `overlay` 的生死跟随 `parent`（关背包 = 关它里面的子面板）。

**注意**：`overlay` 不抢焦点 ≠ 不能点。靠 `pointer-events` 分层，不靠隐藏。

### 9. 玩家日志（物品栏上方）

和开发日志是两个东西：

| | 玩家日志 | 开发日志 |
|---|---|---|
| 内容 | 实际发生的事（挨打、捡起、规则被关） | tick、调度、求值、错误 |
| 位置 | 物品栏上方 | 右下折叠面板 |
| 默认 | 开 | 关 |

行为：只留最近 N 条（默认 6），新的从下进、旧的上出；可关、可半透明、**不挡点击**。

### 10. 反馈层：两级遮罩

```
强遮罩  屏幕级：闪白、暗角、受伤红边   → DOM 层（pointer-events: none）
弱遮罩  世界级：粒子、飘字、挥空特效   → canvas 层（跟随相机）
```

**为什么分开**：强遮罩是屏幕坐标（整个屏幕红一下），弱遮罩是世界坐标（火星在你打的那一格）。

层级接在遮罩表后面：

```
mask.global      100   强遮罩
modal             90
mask.region.*     50
effects           30   弱遮罩（canvas：实体之后、情报之前）
region.*          10
```

**粒子必须在实体之后、情报叠加之前**——否则血条会被火星盖住。

### 11. 客户端目录（三层）

```
tools/client/
├─ game.js        启动、网络、输入路由、场景分发（只做调度）
├─ shared.js      错误条 + api
├─ launcher.js    启动器脚本
├─ hud/           区域：常驻、不抢焦点、点外面不关
│   ├─ status.js
│   ├─ minimap.js
│   └─ quickbar.js
└─ （windows/ 与 scenes/ 尚未拆）
```

**区域（region）**：一直在、只读 state、通过 `mount` 画进固定容器。
**窗口（window）**：抢焦点、有 open/close 生命周期（背包、设置）。
**场景（scene）**：换掉玩法（对话、战斗）。

判断标准：**它在不在、抢不抢键盘、换不换玩法**。

区域模块**不直接碰 config 与网络**——宿主传一个 `ctx`：
```
{ clickPolicy（getter）, setClickPolicy, skills（getter）, useSkill, beginSelection, needsTarget }
```

**会变的数据传 getter，不传值**——否则会出现「改了但显示没变」。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [host.md](host.md) | 你要改页面怎么被服务出来 |
| [../systems/combat.md](../systems/combat.md) | 你要把界面和战斗数据连起来 |
| [../modules/README.md](../modules/README.md) | 你要查规则/组件的字段 |
