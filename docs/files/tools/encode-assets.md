# `tools/encode-assets.mjs`

## 内容

编码器：把 artdrop 里的「树形文件夹」编译成 assets.tree.json + 页图。
输入：
artdrop/tree/<group>/<...>/name.svg
artdrop/tree/<group>/<...>/name.png
输出：
game/worlds/<pack>/assets.tree.json
game/worlds/<pack>/art/pages/<page>.svg     （SVG 矢量拼接，不栅格化）
game/worlds/<pack>/art/assets/<name>.png    （PNG 原样复制，先当 file 叶子）
安全：
- 默认 --check，只报告不写盘。
- --apply 前先备份现有 tree + pages 到 artdrop/backups/encode-<时间>/。
- 写失败从备份恢复。

行数：353

## 接口

### 函数 `applyEncoded`

```ts
function applyEncoded(encoded, packDir, options = {})
```

### 函数 `encodeTree`

```ts
function encodeTree(inputDir, options = {})
```

## 依赖

- [`game/systems/render/tree.ts`](game/systems/render/tree.md)

## 被引用

- [`tools/encode-assets.test.mjs`](tools/encode-assets.test.md)
