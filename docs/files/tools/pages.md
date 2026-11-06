# `tools/pages.mjs`

## 内容

两个页面：启动器和游戏。
为什么拆开：它们的状态完全无关——启动器只管「列出世界、看结构」，
游戏只管「画一局」。挤在一个页面里，任何一边出错都会白屏，
而且互相污染（切回启动器要清理游戏状态、游戏要忽略启动器面板）。
两个页面共享同一套 API，但谁也不 import 谁。

行数：333

## 接口

### 常量 `GAME_PAGE`

```ts
const GAME_PAGE
```

### 常量 `LAUNCHER_PAGE`

```ts
const LAUNCHER_PAGE
```

### 常量 `PAGES`

```ts
const PAGES
```

## 依赖

（无）

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
