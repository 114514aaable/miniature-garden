# `game/systems/ui/dom.ts`

## 内容

把 spec 变成真实 DOM。这一层不判断任何布局，只做搬运。
唯一允许「测量/摆放」的地方在 CanvasSlot（画布要跟着容器变大小），
见各处的注释。

行数：67

## 接口

### 函数 `mount`

```ts
function mount(container: HTMLElement, node: UiNode): void
```

### 函数 `render`

```ts
function render(node: UiNode): HTMLElement
```

## 依赖

- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
- [`tools/client/hud/minimap.js`](tools/client/hud/minimap.md)
- [`tools/client/hud/quickbar.js`](tools/client/hud/quickbar.md)
- [`tools/client/hud/status.js`](tools/client/hud/status.md)
- [`tools/client/launcher.js`](tools/client/launcher.md)
- [`tools/client/windows/inventory.js`](tools/client/windows/inventory.md)
- [`tools/client/windows/settings.js`](tools/client/windows/settings.md)
