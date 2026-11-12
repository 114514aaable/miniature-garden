# 资产协议（artdrop v1）

> 状态：草案，接口先行。
> 目标：**绘图由外部 AI 完成，引擎只负责消费**。本文定义双方交换的文件夹、清单格式、校验规则和导入流程。
> 引擎侧已经接通的消费端：`game/worlds/<pack>/assets.json` → `snapshot.style / atlases` → `draw.ts`。

---

## 1. 角色

| 角色 | 做什么 | 不做什么 |
|---|---|---|
| 引擎 | 读 `assets.json`、下发图集、画 tile / sprite | 生成图、调模型、联网 |
| 导演 / 作者 | 写请求：要什么资产、什么风格、什么调色板 | 画图 |
| 外部绘图 AI | 读请求，产出图集 + 清单 + 报告 | 改引擎代码、直接写游戏目录 |
| 导入器 | 校验批次、复制文件、合并清单 | 生成图 |

**一条硬规则：运行时永远不调用绘图模型。** 绘图只发生在离线，产物以文件形式进来。

---

## 2. 文件夹

```
artdrop/                        外部 AI 可以整个接管的目录
├─ README.md                    给 AI 的说明书（就是本文的摘要）
├─ requests/                    引擎/作者写：要什么
│  └─ <request-id>.json
├─ refs/                        风格参考图（可选，二进制）
├─ inbox/                       外部 AI 写：交付批次
│  └─ <batch-id>/
│     ├─ assets.json            批次清单（必需）
│     ├─ atlas.png | atlas.svg  图集（必需）
│     ├─ atlas.json             帧表，TexturePacker JSON hash（必需）
│     ├─ preview.png            预览（可选）
│     └─ report.json            评测/来源报告（可选）
├─ processed/                   导入成功的批次归档
└─ rejected/                    校验失败的批次（附 reason.json）
```

- `artdrop/` 默认在仓库根目录，**不进版本控制**（只保留 README 与骨架）。
- 外部 AI 只写 `inbox/<batch-id>/`；导入成功才由导入器搬到 `processed/`。
- 一个批次是**原子**的：要么整批导入，要么整批拒绝，不做半批。

---

## 3. 请求（requests/）

```json
{
  "protocol": 1,
  "id": "req.terrain.swamp",
  "kind": "tile",
  "prompt": "俯视 2D 沼泽地表，暗绿，低饱和，边缘可平铺",
  "count": 1,
  "size": [64, 64],
  "tileable": true,
  "palette": {
    "tokens": { "ground": "#3b4a2f", "accent": "#6b7d3a" }
  },
  "styleRef": ["refs/swamp-style.png"],
  "seed": 12345,
  "license": "CC-BY-SA-4.0",
  "notes": "不要写实，不要光影渐变"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `protocol` | 是 | 当前固定 `1` |
| `id` | 是 | `req.<domain>.<name>` |
| `kind` | 是 | `tile` / `sprite` / `icon` / `portrait` |
| `prompt` | 是 | 给绘图 AI 的自然语言描述 |
| `count` | 否 | 一个语义 id 需要几帧/几个变体，默认 1 |
| `size` | 是 | 单帧像素尺寸 `[w, h]` |
| `tileable` | 否 | tile 是否要求四边无缝 |
| `palette` | 否 | 调色板 token → 颜色；AI 可以微调但需在 report 里说明 |
| `styleRef` | 否 | 参考图路径（相对 `artdrop/`） |
| `seed` | 否 | 可复现种子 |
| `license` | 是 | 产物许可证；导入器强制检查 |
| `notes` | 否 | 额外约束 |

---

## 4. 交付批次（inbox/&lt;batch-id&gt;/assets.json）

```json
{
  "protocol": 1,
  "batch": "2026-11-13-swamp",
  "atlases": [
    {
      "id": "swamp",
      "image": "atlas.png",
      "data": "atlas.json",
      "size": [256, 256]
    }
  ],
  "assets": [
    {
      "id": "terrain.swamp",
      "kind": "tile",
      "sheet": "swamp",
      "frame": "Terrain/Swamp.png",
      "size": [64, 64],
      "tileable": true,
      "palette": { "ground": "#3b4a2f", "accent": "#6b7d3a" }
    },
    {
      "id": "entity.leech",
      "kind": "sprite",
      "sheet": "swamp",
      "frame": "Entities/Leech.png",
      "size": [64, 64],
      "anchor": [0.5, 0.8],
      "animation": {
        "frames": ["Entities/Leech1.png", "Entities/Leech2.png"],
        "fps": 4
      }
    }
  ],
  "source": {
    "provider": "external-art-ai",
    "model": "<模型名>",
    "promptHash": "<sha256>",
    "seed": 12345,
    "license": "CC-BY-SA-4.0",
    "createdAt": "2026-11-13T12:00:00Z"
  }
}
```

### 4.1 图集

- 帧表必须是 **TexturePacker JSON hash**：`{ "frames": {...}, "meta": { "image": "..." } }`。
- 不支持 `rotated: true`；导入器会拒绝。
- 图集图片 ≤ 4096×4096；单帧尺寸必须与 `assets[].size` 一致（tile 强制）。
- 一个批次可以有多张图集，`sheet` 对应图集 `id`。

### 4.2 语义 id

| kind | 规则 | 例子 |
|---|---|---|
| `tile` | **必须** `terrain.<terrains.json 里的 code>` | `terrain.floor` |
| `sprite` | `entity.<template id>` 或 `item.<name>` | `entity.rat` |
| `icon` | `icon.<name>` | `icon.potion` |
| `portrait` | `portrait.<plan>` | `portrait.humanoid` |

- 其余 id 导入器会警告但不阻止；**引擎只会消费 `terrain.<code>` 和实体 `core.sprite` 引用的帧**。
- id 全局唯一；与包内已有 id 冲突时整批拒绝。

### 4.3 帧命名

```
Terrain/<Name>.png
Entities/<Name>.png
Items/<Name>.png
UI/<Name>.png
```

动画用编号后缀：`Entities/Rat1.png`、`Entities/Rat2.png`，`animation.frames` 显式列出。

### 4.4 调色板

- `palette` 是 token → 十六进制颜色；token 名由请求方定义，跨批次保持一致。
- 现在是**烘焙进图片**：引擎不做染色，只记录在清单里。
- 以后要做「换色皮肤」时，再增加 `paletteMap` + 运行时 tint；协议向后兼容。

### 4.5 来源与许可

`source` 必填：`provider` / `model` / `seed` / `license` / `createdAt`。
`source.license` 缺失或为空 → 整批拒绝。

### 4.6 资产树（目标形态，已支持读取）

> `game/worlds/<pack>/assets.tree.json`。它是「大图集 + 树索引」：树只记录每个贴图在哪一页的哪个矩形，不再需要单文件。

```json
{
  "version": 1,
  "pages": [
    { "id": "base-main", "image": "/art/base/pages/base-main.svg",
      "width": 128, "height": 128 }
  ],
  "tree": {
    "type": "branch",
    "children": {
      "terrain": {
        "type": "page", "page": "base-main",
        "children": {
          "floor": { "type": "leaf", "x": 0, "y": 0, "w": 64, "h": 64 },
          "wall":  { "type": "leaf", "x": 64, "y": 0, "w": 64, "h": 64 }
        }
      },
      "entity": {
        "type": "page", "page": "base-main",
        "children": {
          "item_potion": { "type": "leaf", "x": 64, "y": 64, "w": 64, "h": 64 }
        }
      }
    }
  }
}
```

节点语义：

| 节点 | 含义 |
|---|---|
| `branch` | 纯逻辑分组；子节点可以跨页 |
| `page` | 对应一张图集页；`children` 只能是页内叶子 |
| `leaf` | `{x,y,w,h}`：已编码的页内矩形 |
| `leaf` | `{file,w,h}`：热生成的单文件，尚未进图集 |

规则：

- **调用名 = 路径**：`terrain.floor`、`entity.item_potion`。
- 一个目录是「图集文件夹」还是「分支文件夹」由编码器决定：装得下就 `page`，装不下就 `branch` + 子页。
- 多页：`pages[]` 可以有多张；叶子通过所在 `page` 节点确定页。
- `file` 叶子允许存在（热生成）：引擎按单文件 URL 读，编码后再改写为页内叶子。
- 校验：page 引用存在、页内矩形不越界、路径唯一、`w/h` 为正整数。
- 地形 id 仍然是 `terrain.<code>`；实体贴图走 `entity.<template id>`。

### 4.7 编码器（已实现）

源码目录（外部 AI 只写这里）：

```
artdrop/tree/
├─ terrain/floor.svg
├─ entity/rat/idle-1.svg
├─ entity/rat/idle-2.svg
└─ ui/potion.png
```

```bash
# 只报告，不写盘
node tools/encode-assets.mjs artdrop/tree --check

# 写入 base 包
node tools/encode-assets.mjs artdrop/tree --pack base --apply
```

编码器做这些事：

1. 扫描目录，`<group>/…/name` 变成路径 `<group>.<name>`。
2. SVG：读 `width/height/viewBox`，按货架算法分页，**矢量拼接**成页 SVG（不栅格化）。
3. 一个 group 装得下一页 → 该目录是 `page`；装不下 → `branch` + `part-1…N` 子页。
4. PNG：**原样复制**到 `art/assets/`，先作为 `file` 叶子（不栅格化、不重新编码）。
5. 自检：生成的树必须通过 `parseAssetTree`（越界、引用、路径）。
6. `--apply` 前备份现有 `assets.tree.json` + `art/pages/` 到 `artdrop/backups/encode-<时间>/`；
   写盘失败自动恢复；成功后写 `report.json`。

当前边界：

- SVG 里的 `id`（渐变、defs）跨文件可能重名，编码器暂不重命名——同一个 group 里避免重复 id。
- 页大小上限 2048；超过会拆页。
- PNG 只做透传，不拼页（以后可以加栅格化/拼接）。

---

## 5. 导入流程

```bash
# 1 只校验，不动仓库
node tools/import-assets.mjs artdrop/inbox/2026-11-13-swamp --check

# 2 校验 + 导入到 base 包
node tools/import-assets.mjs artdrop/inbox/2026-11-13-swamp --pack base --apply
```

导入器做这些事：

1. 读 `assets.json`，校验 protocol / batch / atlases / assets / source。
2. 读每个 `atlas.json`，确认 `frames` 存在、没有旋转帧。
3. 确认图片文件存在、帧矩形在图片范围内、关键帧名都能在帧表里找到。
4. 检查 id 不与包内已有资产冲突（`--apply` 时）。
5. `terrain.<code>` 的 code 必须存在于该包的 `terrains.json`。
6. `--apply`：
   - 复制图集与帧表到 `game/worlds/<pack>/art/<batch>/`；
   - 把 atlas 条目写进 `assets.json`，`image` 改成浏览器 URL `/art/<pack>/art/<batch>/atlas.png`；
   - 合并 `assets`；
   - 打印「新增 N 个资产 / 覆盖 0 个」。
7. 成功：把批次目录移到 `artdrop/processed/`；失败：移到 `artdrop/rejected/` 并写 `reason.json`。

**导入器不生成图、不改图、不猜缺失帧。**

---

## 6. 引擎消费端（已实现）

```
game/worlds/<pack>/assets.json
  atlases: [{ id, image, data }]
  assets:  [{ id, kind, sheet, frame }]

buildSession → snapshot.style + snapshot.atlases
draw.ts      → 地形 terrain.<code>、实体 core.sprite
```

缺失行为：

```
缺图集   → 该 sheet 的实体回退字符
缺帧     → 回退字符
坏 JSON  → 控制台警告，游戏继续
```

---

## 7. 安全边界

- 外部 AI 只写 `artdrop/`，不能写 `game/`。
- 导入器把文件当**不可信输入**：路径不许含 `..`，文件大小上限 32MB，批次最多 256 个资产。
- 图片只作为浏览器资源加载，不在 Node 里解码。
- 运行时绝不联网、绝不 import 模型。

---

## 8. 版本

```
protocol: 1
```

- 增加字段：小版本，向后兼容。
- 改字段含义 / 删除字段：升到 2，导入器拒绝未知版本。
- `docs/base/assets-protocol.md` 是唯一契约来源；`artdrop/README.md` 只做摘要。
