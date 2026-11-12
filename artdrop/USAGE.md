# artdrop 使用说明（给外部绘图 AI / 操作者）

> 这份文档是自包含的。照着做就能把图变成游戏里的资产，不需要读引擎代码。
> 完整契约在 `docs/base/assets-protocol.md`；这里只讲「怎么用」。

---

## 0 一句话流程

```
把 SVG / PNG 按目录放好
  → 跑 --check 看计划
  → 跑 --apply 写入
  → 游戏里按路径调用
```

---

## 1 目录怎么放

所有图放在 `artdrop/tree/` 下面。**目录名就是调用名。**

```
artdrop/tree/
├─ terrain/
│  ├─ floor.svg
│  ├─ wall.svg
│  └─ water.png
├─ entity/
│  ├─ rat/
│  │  ├─ idle-1.svg
│  │  └─ idle-2.svg
│  └─ potion.png
└─ ui/
   └─ cursor.svg
```

对应的调用名：

```
terrain.floor
terrain.wall
terrain.water
entity.rat.idle-1
entity.rat.idle-2
entity.potion
ui.cursor
```

规则：

- 支持格式：**SVG / PNG**。
- 文件名去掉扩展名就是最后一段名字。
- 小写、数字、`-`、`_`；不要空格、中文、`#`。
- 同一个目录里的名字不能重复。
- 地形要用 `terrain.<terrains.json 里的 code>`（比如 `terrain.floor`、`terrain.wall`）。

---

## 2 图片要求

### SVG

- 根节点必须有 `width` / `height`，或者有 `viewBox`。
- 不要引用外部文件（`<image href="...">`）、不要 `<script>`。
- 同一个 group 里避免重复的 `id`（渐变、`<defs>`）——编码器暂不重命名。

### PNG

- 8 位、非隔行、RGB 或 RGBA。
- 调色板 / 灰度 / 16 位 / 隔行 PNG 会被拒绝（会写清楚原因）。
- 透明背景用 RGBA。

### 尺寸

- 单张不要超过 2048×2048。
- 编码器把同目录的图拼成页；一页装不下会自动拆页，调用名不变。

---

## 3 跑命令

在仓库根目录：

```bash
# 只看计划，不写任何文件
node tools/encode-assets.mjs artdrop/tree --check

# 真正写入 base 包
node tools/encode-assets.mjs artdrop/tree --pack base --apply
```

`--check` 输出示例：

```
编码计划：3 页
  page terrain-1  512×256
  page entity-r1  1024×512
  page ui-1       256×128
（--check 模式，没有写盘；加 --apply 生效）
```

`--apply` 会：

1. 把现有 `assets.tree.json` 和 `art/pages/` 备份到 `artdrop/backups/encode-<时间>/`。
2. 写新的页图、树文件。
3. 写失败自动恢复，并告诉你备份在哪。

---

## 4 生成物

```
game/worlds/base/
├─ assets.tree.json          树索引：路径 → 页 + 矩形
└─ art/
   └─ pages/
      ├─ terrain-1.svg       SVG 拼页
      ├─ entity-r1.png       PNG 拼页
      └─ ui-1.svg
```

**调用名不变**，页是内部实现。

---

## 5 常见错误

| 报错 | 原因 | 怎么修 |
|---|---|---|
| `读不到 width/height/viewBox` | SVG 根节点没尺寸 | 补 `width`/`height` 或 `viewBox` |
| `目前只支持 SVG / PNG` | 放了 JPG/WebP | 转成 PNG 或 SVG |
| `只支持 8 位 PNG` | 导出成了 16 位 | 重新导出 8 位 |
| `只支持 RGB(2) / RGBA(6)` | 调色板/灰度 PNG | 导出成 RGB 或 RGBA |
| `超出图集页` | 单图大于 2048 | 缩小图片 |
| `assets.tree.json 解析失败` | 手改坏了树 | 从 `artdrop/backups/` 恢复 |
| `目录是空的` | `artdrop/tree/` 没有图 | 先放图 |

---

## 6 回滚

```bash
# 最近一次编码前的备份
ls artdrop/backups/

# 手动恢复（示例）
cp artdrop/backups/encode-<时间>/assets.tree.json game/worlds/base/
cp -r artdrop/backups/encode-<时间>/pages/ game/worlds/base/art/pages/
```

或者用 git：

```bash
git checkout -- game/worlds/base/assets.tree.json game/worlds/base/art/pages
```

---

## 7 现在不做的事（别等）

- **不做元数据**：锚点、fps、调色板、许可证暂时不读；先只认目录和图片。
- **不做运行时动画接线**：`idle-1` / `idle-2` 会作为两个独立叶子；动画播放还没接。
- **不做增量编码**：每次全量重编；图多时慢，但不会错。
- **不做 JPG / WebP / GIF**。

这些都不影响现在的交付；以后加，目录结构不用改。

---

## 8 交付前检查清单

```
[ ] 图都在 artdrop/tree/ 下
[ ] 名字是小写 + -/_，没有空格
[ ] 地形用 terrain.<code>
[ ] --check 通过，页数与预期一致
[ ] --apply 后进游戏，调用名能看到对应图
[ ] 有问题先看 artdrop/backups/ 和 git status
```
