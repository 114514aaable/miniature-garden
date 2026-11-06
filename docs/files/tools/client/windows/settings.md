# `tools/client/windows/settings.js`

## 内容

设置窗口（窗口层）。
窗口 = 抢焦点、有 open/close 生命周期。宿主只负责：
- 告诉我 config 现在是什么（getConfig / setConfig）
- 给我能用的小工具（api / renderState / refreshSizes …）
其余（页面结构、按键捕获、存档按钮）都在这里。

行数：283

## 接口

### 函数 `createSettingsWindow`

```ts
function createSettingsWindow(ctx)
```

## 依赖

- [`game/systems/config/config.ts`](game/systems/config/config.md)
- [`game/systems/ui/dom.ts`](game/systems/ui/dom.md)
- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
