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

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [host.md](host.md) | 你要改页面怎么被服务出来 |
| [../systems/combat.md](../systems/combat.md) | 你要把界面和战斗数据连起来 |
| [../modules/README.md](../modules/README.md) | 你要查规则/组件的字段 |
