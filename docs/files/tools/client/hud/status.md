# `tools/client/hud/status.js`

## 内容

左下区域：状态（血量条 + 计数 + 可否行动）。
区域 = 常驻、只读 state、自己算自己的显示。

行数：32

## 接口

### 函数 `renderStatus`

```ts
function renderStatus(state)
```

## 依赖

- [`game/systems/ui/dom.ts`](game/systems/ui/dom.md)
- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
