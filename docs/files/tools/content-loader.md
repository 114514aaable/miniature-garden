# `tools/content-loader.mjs`

## 内容

内容树的宿主侧加载器：读文件、调用纯校验、返回可运行节点。
放在 tools/ 而不是 core：只有宿主知道磁盘路径。

行数：132

## 接口

### 函数 `loadPackContent`

```ts
function loadPackContent(packDir)
```

### 函数 `loadPacksContent`

```ts
function loadPacksContent(packDirs)
```

### 函数 `loadWorldsContent`

```ts
function loadWorldsContent(worldsDir = "game/worlds")
```

## 依赖

- [`game/systems/content/tree.ts`](game/systems/content/tree.md)

## 被引用

- [`tools/content-loader.test.mjs`](tools/content-loader.test.md)
- [`tools/serve.mjs`](tools/serve.md)
