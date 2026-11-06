# `tools/client/windows/inventory.js`

## 内容

背包窗口。
结构：左边详情、中间格子、下边分页、再下边是快捷栏映射（拖进去绑定）。
窗口只认 ctx：数据从外面拿，绑定/落盘也交回宿主。

行数：168

## 接口

### 函数 `createInventoryWindow`

```ts
function createInventoryWindow(ctx)
```

## 依赖

- [`game/systems/ui/dom.ts`](game/systems/ui/dom.md)
- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
