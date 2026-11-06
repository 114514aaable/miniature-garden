# 体系：存档与读档

> 改这里如果：**你要存档、自动存档、阶段快照、或者读档后状态不对**。

## 一个存档 = 一个世界 + 若干阶段快照

```
saves/<id>/
├─ world.json              这张图是什么：包 / 种子 / 尺寸 / 名字 / 生成器版本
└─ snapshots/
   ├─ 存档 1.json          tick 12 · 13:02
   ├─ 存档 2.json          tick 40 · 13:20
   └─ 下洞前.json          tick 88 · 14:05
```

**世界包只是内容**；**存档目录是那张图**；**快照是这张图的某一段进度**。

- **每点一次「保存新进度」就多一份快照**（自动叫「存档 N」）。
- **同名再存 = 覆盖那一份**（不会出现两个「存档 1」）。
- **进入世界默认读最新的一份**；也可以在「进度」页里挑任意一份。

## 快照里有什么

```json
{
  "version": 3,
  "name": "存档 2",
  "savedAt": "2026-11-06T05:22:00.000Z",
  "engine": { "tick": 12, "entities": [...], "spaces": [...] },
  "playerHandle": 0,
  "playerReadyAt": 4,
  "scheduler": [[0, 4], [4096, 5]],
  "disabled": [],
  "scene": [{ "id": "dialog", "params": {...}, "state": { "node": "buy" } }]
}
```

**配方在 `world.json`，进度在快照里**——配方可复现，快照可叠加。

## 一条完整路径

**存**：

```
POST /api/save {name?}
  → 不给名字：自动「存档 N」（N = 现有数量 + 1）
  → 给名字：同名覆盖
  → 写 saves/<当前世界>/snapshots/<名字>.json
```

**读**：

```
POST /api/load {id?, name?}
  → 不给 id：当前世界；不给 name：最新一份
  → buildSession(..., runInit=false)     ← 关键：不重跑 init
  → store.importState(engine)
  → 恢复 playerHandle / readyAt / scheduler / 场景栈
```

## 三条不能忘的规则

1. **读档不跑 init**：开局物品/开局事件只在「新开局」执行，否则每次读档发一次。
2. **包找不到就拒绝**：配方里的包当前不可用时明确报错，不用别的包凑。
3. **规则集随快照走**：读档按快照的 `disabled` 重建会话，不按当前选择。

## 生成器版本

```
world.json 的 generator 字段
读档时 != 当前 GENERATOR_VERSION → 明确提示「地形可能和当年不同」
```

**不悄悄换地形**，也不拒绝读档（玩家可能只想拿回进度）。

## 接口

```
GET  /api/saves                 世界列表（带 saves 数量、latestAt）
GET  /api/snapshots?id=<世界>   某个世界的快照列表
POST /api/save {name?}          存一份（自动编号 / 同名覆盖）
POST /api/load {id?, name?}     读某个世界的某份快照
POST /api/snapshot/rename       快照改名
POST /api/snapshot/delete       删一份快照
POST /api/world/rename          世界改名
POST /api/world/delete          删整个世界
```

## 界面

```
启动器「存档」  世界列表：名字 / 包 / 种子 / 尺寸 / N 份进度 / 时间 · 继续 / 改名 / 删除
                继续 = 进入世界并自动读最新一份快照
设置「进度」    当前世界信息 + [保存新进度] + 快照列表（读取 / 改名 / 删除）
死亡浮层        读当前世界最新一份
```

## 扩展点

- **命名**：快照名字就是文件名（去掉非法字符，最多 40 字）。
- **分享世界**：把 `terrain.json` 落盘即可（现在靠配方重新生成）。
- **自动存档**：定时 POST `/api/save` 即可，自动编号会一直加。

## 边界

- 快照**不含包内容**：包没了就读不出来（有意为之，避免悬空引用）。
- 地图是**重新生成**的，不是存的：生成器升级会提示，不自动迁移。
- 快照按时间排序；同名覆盖后 `savedAt` 会更新。

## 验证

```bash
node --test --test-isolation=none
# 实机：开局 → 走两步 → 保存新进度 → 再走 → 再存 → 进度页里来回读
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [worldgen.md](worldgen.md) | 配方里的生成参数 |
| [../areas/host.md](../areas/host.md) | 接口与会话 |
| [../areas/worlds.md](../areas/worlds.md) | 包与加载校验 |
