# `tools/import-assets.mjs`

## 内容

资产导入器：把 artdrop 里的一批交付校验并合并进世界包。
用法：
node tools/import-assets.mjs artdrop/inbox/<batch> --check
node tools/import-assets.mjs artdrop/inbox/<batch> --pack base --apply
它不生成图、不改图、不猜缺失帧；失败就整批拒绝。

行数：397

## 接口

### 函数 `applyBatch`

```ts
function applyBatch(result, packDir, packId)
```

### 函数 `archiveBatch`

```ts
function archiveBatch(batchDir, outcome, reason)
```

### 函数 `validateBatch`

```ts
function validateBatch(batchDir, options = {})
```

## 依赖

（无）

## 被引用

- [`tools/import-assets.test.mjs`](tools/import-assets.test.md)
