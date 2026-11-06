# `tools/client/hud/quickbar.js`

## 内容

右下角区域：点击策略。
它是**区域**，不是窗口——常驻、不抢焦点、点外面就关。
只认两件事：当前 state（其实用不到）和外面给的 ctx。

行数：210

## 接口

### 函数 `actionLabel`

```ts
function actionLabel(ctx, action)
```

### 函数 `actionsFor`

```ts
function actionsFor(ctx, key)
```

### 常量 `BUILTIN_LABEL`

```ts
const BUILTIN_LABEL
```

### 常量 `CLICK_ROWS`

```ts
const CLICK_ROWS
```

### 函数 `closePolicy`

```ts
function closePolicy()
```

### 函数 `cycleAction`

```ts
function cycleAction(ctx, key)
```

### 函数 `renderQuickbar`

```ts
function renderQuickbar(ctx)
```

### 函数 `togglePolicy`

```ts
function togglePolicy(ctx)
```

## 依赖

- [`game/systems/ui/dom.ts`](game/systems/ui/dom.md)
- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
