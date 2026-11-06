# `tools/client/hud/aim.js`

## 内容

瞄准高亮：记住「鼠标在哪、当前选了什么技能」，随时可以重算。
为什么单独一个模块：
以前这段逻辑写在 mousemove 里——鼠标不动就永远不更新，
于是「切技能」「状态变了」都要靠人手动补一次请求。
现在只有两个状态：hover 格 + 技能 tag。
任何地方想知道「现在该亮哪些格」都调 refresh()。

行数：62

## 接口

### 函数 `createAimTracker`

```ts
function createAimTracker({ request, apply, fallbackTag = 'base.attack' })
```

## 依赖

（无）

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
