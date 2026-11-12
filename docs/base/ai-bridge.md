# AI 交接协议（ai-bridge v1 草案）

> 定位：**离线、文件化、可观察**地让外部 AI 接活。
> 引擎运行时绝不调用模型；所有「需求 → 产物」都通过文件夹与清单完成。
> 适用范围：贴图、文本、NPC、任务、整个世界片段（现在先服务贴图）。

---

## 1 为什么用文件而不是 HTTP

```
文件队列
  ✅ 断电/重启不丢
  ✅ 人可以直接看、直接改
  ✅ 外部 AI 用什么语言/模型都无所谓
  ✅ 不需要给 AI 开端口、配 token
  ✅ git 可以追踪需求与回执

HTTP 推送
  ❌ 运行时联网
  ❌ 要鉴权、要重试、要防重复
  ❌ AI 不在线就卡住
```

**结论：需求与交付都落在磁盘上，双方只认目录状态。**

---

## 2 目录

```
artdrop/
├─ queue/                     AI 任务队列
│  ├─ pending/<request-id>.json
│  ├─ claimed/<request-id>.json
│  ├─ done/<request-id>.json
│  └─ failed/<request-id>.json
├─ inbox/<batch-id>/          产物批次（已有）
├─ refs/                      风格参考（已有）
├─ processed/                 导入成功（已有）
└─ rejected/                  导入失败（已有）
```

- `pending/`：需求方写，外部 AI 读。
- **认领 = 把文件改名从 `pending/` 移到 `claimed/`**（同一磁盘 rename 是原子的）。
- `done/`：外部 AI 写回执，指向产物批次。
- `failed/`：外部 AI 或导入器写失败原因。

---

## 3 需求（pending/&lt;request-id&gt;.json）

```json
{
  "protocol": 1,
  "id": "req.art.terrain.swamp.0001",
  "kind": "asset",
  "createdAt": "2026-11-13T12:00:00Z",
  "createdBy": "editor",
  "priority": "normal",
  "brief": "俯视 2D 沼泽地表，暗绿，低饱和，四边可平铺",
  "context": {
    "world": "normal",
    "tone": "阴冷、潮湿",
    "references": ["artdrop/refs/swamp-style.png"],
    "constraints": {
      "format": "svg",
      "size": [64, 64],
      "tileable": true,
      "palette": { "ground": "#3b4a2f", "accent": "#6b7d3a" },
      "license": "CC-BY-SA-4.0"
    }
  },
  "delivery": {
    "batchHint": "2026-11-13-swamp",
    "inbox": "artdrop/inbox"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `protocol` | 是 | 固定 1 |
| `id` | 是 | 全局唯一；也用于回执 |
| `kind` | 是 | `asset` / `lore` / `npc` / `quest` / `world` |
| `brief` | 是 | 给 AI 的自然语言需求 |
| `context` | 否 | 世界、语气、参考图、约束 |
| `context.constraints` | 否 | 尺寸/格式/调色板/许可证 |
| `delivery` | 否 | 默认写 `artdrop/inbox` |

**需求是纯文本 + 约束，不含运行时状态。** 外部 AI 不需要连游戏。

---

## 4 认领（外部 AI 的动作）

```
1  扫描 queue/pending/*.json
2  选一个自己能做的
3  rename 到 queue/claimed/<id>.json
4  在 claimed 文件里追加 claimedAt / worker / leaseUntil
5  开始生成
```

认领后的文件：

```json
{
  "...": "原需求字段",
  "claim": {
    "worker": "art-ai-01",
    "claimedAt": "2026-11-13T12:05:00Z",
    "leaseUntil": "2026-11-13T12:35:00Z"
  }
}
```

**租约（lease）**：

```
租约到期还没 done/failed
→ 任何人都可以把 claimed 文件移回 pending
→ 防止 AI 崩了任务永远卡住
```

---

## 5 交付（外部 AI 的动作）

```
1  生成产物到 artdrop/inbox/<batch-id>/
2  写 queue/done/<request-id>.json
```

回执：

```json
{
  "protocol": 1,
  "id": "req.art.terrain.swamp.0001",
  "batch": "2026-11-13-swamp",
  "assets": ["terrain.swamp", "terrain.swamp-edge"],
  "source": {
    "provider": "external-art-ai",
    "model": "…",
    "seed": 12345,
    "license": "CC-BY-SA-4.0"
  },
  "notes": "边缘做了 2px 出血；调色板微调见 report.json"
}
```

失败回执：

```json
{
  "protocol": 1,
  "id": "req.art.terrain.swamp.0001",
  "error": "无法满足 tileable 约束",
  "retryable": true
}
```

---

## 6 引擎侧动作

```
导入器（tools/import-assets.mjs）
  1 校验 inbox 批次
  2 成功 → 资产进树，写 done 回执（如果需求方没写）
  3 失败 → 写 failed，原批次进 rejected
```

**引擎不主动推送需求。** 需求由编辑器/作者/导演写入 `pending/`。

---

## 7 谁写需求

```
现在    人/脚本写 JSON
下一步  tools/request-asset.mjs
  node tools/request-asset.mjs \
    --kind asset --id terrain.swamp \
    --brief "沼泽地表…" --size 64x64 --tileable
以后    启动器/编辑器里「要一张图」按钮，写同一个文件
```

**所有入口写同一种 request，外部 AI 只认这一种。**

---

## 8 多个外部 AI

```
rename 到 claimed/ 是原子锁
  → 两个 AI 抢同一个任务，只有一个成功
租约到期 → 允许重新认领
```

任务可以带能力标签：

```json
"requires": { "capability": "svg" }
```

AI 只认领自己能力范围内的任务。

---

## 9 安全与授权

```
需求文件是纯文本，不放密钥
交付必须带 source.license
导入器拒绝没有 license 的批次
路径只允许在 artdrop/ 内（导入器已有校验）
单文件 ≤ 32MB，单批 ≤ 256 个资产
```

---

## 10 扩展到文本/世界

同一条队列，换 `kind`：

| kind | 需求 | 交付 |
|---|---|---|
| `asset` | 图 | 图集批次（已有） |
| `lore` | 设定/传闻 | `inbox/<batch>/lore.json` |
| `npc` | 角色 | `inbox/<batch>/npc.json`（模板 + 对话） |
| `quest` | 任务 | `inbox/<batch>/quest.json` |
| `world` | 地图片段 | `inbox/<batch>/world.json` |

**队列、认领、回执、租约完全复用。**

---

## 11 状态机

```
pending ──认领──> claimed ──交付──> done
   │                  │
   │                  └─失败──> failed
   │
   └─租约过期──────────────> pending
```

- `failed` 可由人改回 `pending`（重试）。
- `done` 后由导入器决定资产是否真的进包；导入失败写 `failed`，批次进 `rejected/`。

---

## 12 未决问题

```
Q1 queue 放在 artdrop/ 还是独立 bridge/？
     现在贴图为主，倾向 artdrop/queue；以后文本多了再抽 bridge/
Q2 谁负责把 claimed 的租约过期任务移回 pending？
     外部 AI 轮询时顺手做，还是引擎工具做？
Q3 回执由谁写：外部 AI 还是导入器？
     建议外部 AI 写 done（交付），导入器只写 failed（校验失败）
Q4 一个需求允许多个批次吗？
     建议 1:1；要拆就拆成多个 request
Q5 人审：done 后要不要等作者点「导入」？
     建议导入器默认只校验，人确认后 --apply
```

---

## 13 最小落地顺序

```
1  目录骨架 + request.schema 文档（本文件）
2  tools/request-asset.mjs（写 pending）
3  外部 AI 侧轮询脚本示例（不属于本仓库）
4  导入器读取 done 回执，校验 batch 与 request 对应
5  租约清理工具
```
