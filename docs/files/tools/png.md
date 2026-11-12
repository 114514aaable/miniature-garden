# `tools/png.mjs`

## 内容

最小 PNG 编解码（只给离线编码器用，不进运行时）。
支持：8 位、非隔行、RGBA(6) / RGB(2)。
不支持：调色板、灰度、16 位、隔行——遇到直接报错，不猜。
为什么手写：项目不引入图片库；编码器只需要「解成 RGBA → 拼大图 → 写回 PNG」。

行数：179

## 接口

### 函数 `blit`

```ts
function blit(dst, dstWidth, src, srcWidth, srcHeight, x, y)
```

### 函数 `decodePng`

```ts
function decodePng(buffer, where = "png")
```

### 函数 `encodePng`

```ts
function encodePng(width, height, rgba)
```

## 依赖

（无）

## 被引用

- [`tools/encode-assets.mjs`](tools/encode-assets.md)
