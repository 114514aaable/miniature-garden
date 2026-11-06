# `tools/client/shared.js`

## 内容

页面共用：错误提示 + API 调用。
以前这段是模板里插进去的（`${ERRORS}`），拆成独立文件后必须真的存在。

行数：35

## 接口

### 函数 `api`

```ts
async function api(path, body)
```

## 依赖

（无）

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
- [`tools/client/launcher.js`](tools/client/launcher.md)
