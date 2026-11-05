# 体系：回合与调度

> 改这里如果：**你要动「谁先手」「一回合多长」「延迟动作」**。
> 只是加个动作的成本 → 改 `world.json` 的 `clock.costs`，不用看这篇。

## 它由哪几块组成

```
时间        1 tick = 1 回合；动作有整数成本
调度器      Scheduler：每个角色一个 readyAt，谁小谁先动
阶段表      每 tick 做什么，写在一张有序表里
挂起动作    core.pending：现在不做，过几回合再做
```

## 一条完整路径

```
玩家按 W
  → POST /api/act { dir: "w" }
  → core.move → 返回效果 + 成本 2（clock.costs.move）
  → scheduler.done(handle, 2) → 这个角色的 readyAt += 2
  → 宿主 advanceTo(readyAt)
       while 现在 < 目标：
         runPhases([
            step     推进 store，应用效果，记账
            prune    把死掉的从调度器清掉
            pending  结算到点的挂起动作
            enemies  让该行动的敌人行动
         ])
  → 快照发给浏览器
```

**关键**：玩家不做「等待」，**时间由成本自然推进**。成本 0 的动作不推进时间（零帧动作）。

## 调度器语义

```
peek()      看下一个该动的（不取）
take()      取下一个，并把它临时排到 tick+1
done(cost)  用真实成本覆盖（NPC 最少 1 tick）
upcoming(n) 只读预览（调试面板用）
prune(alive) 清掉已死角色
```

排序是 `(readyAt, handle)`——**同 tick 内按句柄定序，保证可复现**。

## 挂起动作（core.pending）

```
base.cast → 写 { tag, params, resolveAt }
每 tick 的 pending 阶段：到期就求值那个信封、应用效果、清空
被打断 = 把 pending patch 成空
```

敌人的 `core.intent` 是同一类东西的**特化版本**（固定两回合、按格子判定）。
以后可以统一到 pending，现在分开是为了让敌人行为好读。

## 时间模式（技能的 time 字段）

```json
{ "time": { "mode": "sequence", "ticks": 4 } }
```

| mode | 语义 | 玩家在做什么 |
|---|---|---|
| `instant`（缺省） | 按一下，占 N 回合，立刻能再动 | 操作 |
| `staged` | 分阶段，`cancelable` 决定能否中途改主意 | 观察 + 可能决策 |
| `sequence` | 一次性结算 N 回合，期间不期待输入 | 看演出 |

`sequence` 的回合上限是 `MAX_SEQUENCE_TICKS`（200）。宿主仍然逐 tick 结算，
只是把每回合事件一起返回，客户端按固定节奏播完再允许输入——
**本质是事件回放，不是真的慢动作**。

样板技能：`base.rest`（休息 4 回合，恢复 2 点血）。

## 扩展点

| 想加什么 | 改哪里 |
|---|---|
| 新动作成本 | `world.json` 的 `clock.costs` |
| 速度影响成本 | `clock.costsOf(verb, speed)`，当前是 max(0, base − speedBonus) |
| 先手 / 敏捷 | 调度器排序键——但会破坏可复现性，改之前想清楚 |
| 新的每-tick 行为 | `systems/tick/phases.ts` 的表里插一行，**不要**在循环里加 if |
| 实时制 | 不改调度器，改宿主怎么调用 `advanceTo`（这是设计上的分界线） |

## 边界

- **调度器不执行规则**。它只说「现在轮到谁」，执行是宿主的事。
- **阶段表不持有状态**。每个阶段自己从会话里取。
- **tick 只能前进**。回退靠读档，不靠倒放。

## 验证

```bash
node --test --test-isolation=none         # 调度器有独立测试
# 实机看调试面板：tick 与下次可行动时刻
```

## 已知的坑

- 敌人动作成本最少 1 tick，否则一回合内会连续行动。
- 死亡的角色必须 `prune`，否则句柄留在队列里会抛错。
- 零成本动作（`look`）不推进时间，**别在循环里对它 `while` 等待**。
- **动作成本有上限**（`MAX_ACTION_COST = 32`）。没有上限时，
  一个写错成本的动作会把世界推进几百回合：玩家被冻住、敌人在动，
  看起来像时间穿越。成本键写错（不在 `clock.costs` 里）会得到
  一句明确提示，而不是 500。

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [../areas/engine-core.md](../areas/engine-core.md) | 你要动 store 的推进或事件链 |
| [combat.md](combat.md) | 你要改敌人意图的时机 |
| [../areas/rules.md](../areas/rules.md) | 你要个新动作，但还没定成本 |
