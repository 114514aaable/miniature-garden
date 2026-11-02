# 体系：存档与读档

> 改这里如果：**你要存档槽、自动存档、或者读档后状态不对**。

## 存了什么

```json
{
  "version": 1,
  "world": "official.normal",
  "savedAt": "2026-11-02T13:04:00.000Z",
  "packs": ["official.base@0.1.0", "official.normal@0.1.0"],
  "disabled": [],
  "seed": 42,
  "engine": { "tick": 12, "entities": [...], "spaces": [...] },
  "playerHandle": 0,
  "playerReadyAt": 4,
  "scheduler": [[0, 4], [4096, 5]]
}
```

**存档 = 世界的完整快照 + 它自己的配置**（包清单、规则集、种子）。

## 一条完整路径

**存**：

```
POST /api/save {slot:"quick"}
  → 收集 store.exportState() + 会话元信息
  → saves/<slot>.json
```

**读**：

```
POST /api/load {slot}
  → 读文件
  → 校验：world 存在吗？包清单一致吗？（不一致就拒绝，列出缺/多）
  → buildSession(..., runInit=false)     ← 关键：不重跑 init
  → store.importState(engine)
  → 恢复 playerHandle / readyAt / scheduler / seed / dead=false
```

## 三条不能忘的规则

1. **读档不跑 init**：开局物品/开局事件只在「新开局」执行，否则每次读档发一次。
2. **包清单不一致就拒绝**：否则读出来一堆悬空句柄。错误里要写明缺什么、多什么。
3. **规则集随存档走**：读档按存档的 `disabled` 重建会话，不按当前选择。

## 槽位

```
saves/<slot>.json     槽位名 = 文件名
                      只允许字母/数字/_/-（防路径穿越）
```

默认槽 `quick`。列表接口 `GET /api/saves` 会返回世界、种子、tick、时间；坏档标记 `broken` 而不是让整个列表挂掉。

## 扩展点

| 想加什么 | 改哪里 |
|---|---|
| 自动存档 | 在 `advanceTo` 之后按条件调用 `saveGame("auto")` |
| 多存档页 | 已经可以：`slot` 随便传 |
| 存档版本迁移 | `version` 字段 + 读的时候分派 |
| 云同步 | 换存储层，接口不变 |

## 边界

- **存档不管显示**。界面只拿到「存了/读失败 + 原因」。
- **存档不管地图生成**。种子存进去了，生成要靠生成器按种子重算。

## 验证

```bash
# 存 → 改 → 读，看 tick 和种子回来没有
curl -X POST localhost:8788/api/save -d '{"slot":"t1"}'
curl -X POST localhost:8788/api/load -d '{"slot":"t1"}'
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [../areas/host.md](../areas/host.md) | 你要加存档相关接口 |
| [../areas/engine-core.md](../areas/engine-core.md) | 你要改 `exportState`/`importState` |
| [../areas/worlds.md](../areas/worlds.md) | 你要改包清单/版本 |
