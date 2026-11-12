# artdrop —— 外部绘图 AI 的交接目录

这个目录是**外部 AI 的地盘**：它只在这里写文件，引擎和游戏目录不归它管。

完整协议：[`docs/base/assets-protocol.md`](../docs/base/assets-protocol.md)

## 一条最短路径

```bash
# 1. 外部 AI 把批次写进 inbox/<batch-id>/
#    必需：assets.json、atlas.png（或 .svg）、atlas.json

# 2. 只校验，不动仓库
node tools/import-assets.mjs artdrop/inbox/<batch-id> --check

# 3. 校验通过后导入 base 包
node tools/import-assets.mjs artdrop/inbox/<batch-id> --pack base --apply
```

## 目录

```
requests/     引擎/作者写的资产请求（要什么）
inbox/        外部 AI 的交付批次
refs/         风格参考图
processed/    导入成功的归档
rejected/     校验失败的批次（附 reason.json）
```

## 禁止

- 直接写 `game/`。
- 生成脚本在引擎运行时联网。
- 没有 `source.license` 的批次。
- 旋转帧（`rotated: true`）。
