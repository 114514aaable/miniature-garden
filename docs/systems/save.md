# 体系：存档与读档

> 改这里如果：**你要存档槽、自动存档、或者读档后状态不对**。

## 一个存档 = 一个世界

```
saves/<id>/
├─ world.json    这张图是什么：包、种子、尺寸、名字、生成器版本、时间
└─ state.json    玩到哪了：tick、实体、调度、场景栈、关掉的规则
```

**世界包（整合包）只是内容**，随时可以拿来做新存档；
**存档是那张图本身**——复制一个目录就是备份，删掉就是删世界。

## state.json 里有什么

```json
{
  "version": 2,
  "savedAt": "2026-11-06T04:12:00.000Z",
  "engine": { "tick": 12, "entities": [...], "spaces": [...] },
  "playerHandle": 0,
  "playerReadyAt": 4,
  "scheduler": [[0, 4], [4096, 5]],
  "disabled": [],
  "scene": [{ "id": "dialog", "params": {...}, "state": { "node": "buy" } }]
}
```

**配方在 `world.json`，进度在 `state.json`**——两者分开，配方可复现、进度可覆盖。

## 一条完整路径

**存**：

```
POST /api/save
  → store.exportState() + 会话元信息
  → saves/<当前世界 id>/state.json
  → 顺手更新 world.json 的 updatedAt
```

**读**：

```
POST /api/load {id}        ← 不给 id 就当前世界
  → 读 world.json（配方）+ state.json（进度）
  → buildSession(..., runInit=false)     ← 关键：不重跑 init
  → store.importState(engine)
  → 恢复 playerHandle / readyAt / scheduler / 场景栈
```

## 三条不能忘的规则

1. **读档不跑 init**：开局物品/开局事件只在「新开局」执行，否则每次读档发一次。
2. **包找不到就拒绝**：配方里的包当前不可用时，明确报错，不要用别的包凑。
3. **规则集随存档走**：读档按存档的 `disabled` 重建会话，不按当前选择。

## 生成器版本

```
world.json 的 generator 字段
读档时 != 当前 GENERATOR_VERSION → 明确提示「地形可能和当年不同」
```

**不悄悄换地形**，也不拒绝读档（玩家可能只想拿回进度）。

## 接口

```
GET  /api/saves          存档列表（= 世界列表，带 saved 标记与时间）
POST /api/save           写当前世界的进度
POST /api/load {id}      读某个存档
POST /api/world/delete   删一个存档目录
GET  /api/instances      同 /api/saves（旧名字，保留）
```

## 界面入口

```
启动器「存档」   列出 saves/*（名字 / 包 / 种子 / 尺寸 / 时间），继续或删除
设置「进度」     当前世界的保存进度 / 读取进度
死亡浮层「读档」 读当前世界的进度
```

**旧设计里的「读档面板」已经删掉**：现在「存档列表」就是「世界列表」，
一个入口，不重复。

## 扩展点

- **多份备份**：`state.json` 复制成 `state-<date>.json` 就是快照，读档时选。
- **分享世界**：把 `terrain.json` 落盘即可（现在靠重新生成，配方一致就一样）。
- **改名**：`world.json` 的 `name` 字段已经留好。

## 边界

- 存档**不含**包内容：包没了就读不出来（这是有意的，避免悬空引用）。
- 地图是**重新生成**的，不是存的：生成器升级会提示，但不会自动迁移。
- 时间、随机、调度都在 `state.json` 里；**不要**把只有进程才有的东西写进去。

## 验证

```bash
node --test --test-isolation=none
# 实机：开局 → 走两步 → 存档 → 回启动器 → 最近的世界 → 继续（tick 应恢复）
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [worldgen.md](worldgen.md) | 配方里的生成参数 |
| [../areas/host.md](../areas/host.md) | 接口与会话 |
| [../areas/worlds.md](../areas/worlds.md) | 包与加载校验 |
