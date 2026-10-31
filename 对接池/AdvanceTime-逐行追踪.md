# 一次 `KinkyDungeonAdvanceTime(1)` 里到底发生了什么

> 仓库：`C:\D\chaijie\KinkiestDungeon-5.5`（5.5 官方源码）
> 全部结论带 `文件:行号`。这是对上一份报告 §5 的**深化 + 两处纠正**。

---

## 0. 先纠正两个前提（会影响你们的模型设计）

### 纠正 1：`KDTickMaps` 不是当前地图的 tick

上一版报告把 `KDTickMaps(delta, ...)` 当成"世界 tick 入口"是错的。它只做**相邻楼层的后台模拟**：

```ts
// map/KDRegiments.ts:36-40
let KDMapTickTime = 50;
/** Only tick 2 floors behind or ahead */
let KDMapTickRange = 2;
function KDTickMaps(delta, minFloor, maxFloor, onlyMain, updateReg, updateChests): boolean
```

而且被节流到每 50 个 delta 才真跑一次（`KDRegiments.ts:56-57`：`if (KinkyDungeonFlags.get("KDMapTick")) return false;`）。

**当前地图的实体是这两个调用跑出来的**（`base/game/KinkyDungeonGame.ts:3639` 和 `:3650`）：

```ts
KinkyDungeonUpdateEnemies(delta, true);   // 3639  友方
...
KinkyDungeonUpdateEnemies(delta, false);  // 3650  敌对
```

### 纠正 2：`movePoints` / `attackPoints` 是「成本」，不是「预算」

同名两个字段，语义完全不同（这是 KD 里最容易抄错的地方）：

| 位置 | 名字 | 含义 |
|---|---|---|
| `enemy.Enemy.movePoints` | 类型定义（`KinkyDungeonEnemiesList.ts` 里的字面量） | **走一格要攒多少点**（成本） |
| `enemy.movePoints` | 运行时实体字段 | **已经攒了多少点**（累加器） |

所以 `movePoints: 2` **不是"一次能走两步"，而是"两 tick 才走一步"**。攻击同理：`attackPoints: 3` = 每 3 tick 攻击一次。

---

## 1. Q1：执行顺序固定吗 —— 固定，硬编码在函数体里

`KinkyDungeonAdvanceTime(delta)`（`KinkyDungeonGame.ts:3531-3767`）是一个 236 行的线性函数，阶段顺序写死，**没有任何数据驱动或可插拔的阶段表**。完整的阶段序列：

| # | 行 | 做什么 | 属于 |
|---|---|---|---|
| 1 | 3548 | 清理 Party 里已消失的成员 | 杂务 |
| 2 | 3557-3560 | `KDUpdateFog = true`；`KDLastTick = performance.now()`；清 warning tiles | 杂务 |
| 3 | 3594 | `KinkyDungeonUpdateAngel(delta)` | 环境 |
| 4 | 3596-3599 | 楼层特殊更新脚本 `altType.updatescript(delta)` | 环境 |
| 5 | 3601-3607 | 牵引绳 tether（玩家 + 敌人） | 环境 |
| 6 | 3609 | `KinkyDungeonResetEventVariablesTick(delta)` | 事件 |
| 7 | **3610** | **`SendEvent("tick")` ← mod 可挂在这里** | 事件 |
| 8 | 3614-3619 | 文本/动作消息计时器衰减 | UI |
| 9 | 3622 | `KinkyDungeonItemCheck(玩家.x, 玩家.y, ...)` | 玩家 |
| 10 | 3628-3631 | 敌人 tether（再跑一次） | 环境 |
| 11 | 3633-3637 | 收容所/常驻 NPC/游荡队列 | 环境 |
| 12 | 3638 | **`KinkyDungeonUpdateBuffs(delta)`** | 玩家+敌人 |
| 13 | **3639** | **`KinkyDungeonUpdateEnemies(delta, true)` —— 友方全体** | 敌人 |
| 14 | 3640 | `SendEvent("afterEnemyTick", {allied:true})` | 事件 |
| 15 | 3642-3647 | HP 检查 + 消失检查（会 `E -= 1` 边遍历边删） | 敌人 |
| 16 | **3648-3649** | **子弹更新 + 碰撞** | 环境 |
| 17 | **3650** | **`KinkyDungeonUpdateEnemies(delta, false)` —— 敌对全体** | 敌人 |
| 18 | 3651 | `SendEvent("afterEnemyTick", {allied:false})` | 事件 |
| 19 | 3654-3655 | 子弹更新 + 碰撞**再跑一遍**（注释：`"catchup" phase for explosions!`） | 环境 |
| 20 | 3657-3660 | 警告格 / 效果格 / 格子效果 | 环境 |
| 21 | 3661-3666 | HP + 消失检查（再来一轮） | 敌人 |
| 22 | 3668-3673 | tether 以 `delta=0` 结算（只做几何，不推进时间） | 环境 |
| 23 | 3674 | `KinkyDungeonUpdateJailKeys()` | 环境 |
| 24 | 3676 | **`KDCommanderUpdate(delta)`** | 敌人 |
| 25 | 3679 | 自定义失败判定 | 玩家 |
| 26 | 3688 | **`KinkyDungeonUpdateStats(delta)` —— 玩家属性 tick** | 玩家 |
| 27 | 3690-3691 | `KinkyDungeonHandleMoveToTile(玩家脚下格子)` —— 踩格效果 | 玩家 |
| 28 | **3696-3713** | **`DelayedActions` 扣减 + commit** | 逻辑 |
| 29 | 3715 | 联机同步 | 杂务 |
| 30 | 3718-3724 | 体力告警 | UI |
| 31 | 3729-3730 | `LastTurnAction / LastAction` 记账 | 杂务 |
| 32 | 3734 | 子弹视觉更新 | 渲染 |
| 33 | 3739-3747 | DangerFlag / Quickness flag | 逻辑 |
| 34 | **3755-3762** | **`KDTickMaps(...)` —— 只处理相邻楼层** | 环境（背景） |
| 35 | 3764 | `KinkyDungeonCurrentTick += delta` | 逻辑 |
| 36 | 3767 | `SendEvent("tickAfter")` | 事件 |
| 37 | 3769-3781 | Forgetful 天赋的雾衰减 | 玩家 |
| 38 | 3783-3791 | `UpdateStats(0)` / `KDTickNeeds` / 重新穿衣 | 玩家 |
| 39 | 3794 | 敌人缓存重建 | 杂务 |

**三个关键顺序事实**：

1. **玩家自己不在 `AdvanceTime` 里动** —— 玩家的位移发生在**调用方**（`KinkyDungeonMove` 里先 `KinkyDungeonMoveTo` 再 `AdvanceTime`）。所以"玩家 → 敌人"这个顺序不是在函数内实现的，而是**调用约定**。
2. **友方先于敌对**（3639 < 3650），而且中间插了一次子弹结算。
3. **玩家的属性 tick（3688）在所有敌人之后** —— 敌人这一 tick 看到的是玩家**本 tick 移动后、但属性未结算**的状态。

**没有按速度/先攻排序。** 全程 `for (let enemy of KDMapData.Entities)`，纯数组顺序。

---

## 2. Q2：敌人是「每 tick 攒」还是「每回合给预算」

**每 tick 攒（累加器模型），攒够成本才动一次。**

### 移动（`KinkyDungeonEnemyTryMove`，`KinkyDungeonEnemies.ts:8220`）

```ts
// 8236-8238  每 tick 累加
if (enemy.bind > 0) enemy.movePoints += speedMult * delta/10;
else if (enemy.slow > 0) enemy.movePoints += speedMult * delta/2;
else enemy.movePoints += KDGameData.SleepTurns > 0 ? 4*delta*speedMult : delta * speedMult;

// 8240  被束缚的额外成本
let moveMult = KDBoundEffects(enemy) * 0.5;

// 8247  成本 = 类型定义的值 + 束缚惩罚
let moveNeeded = enemy.Enemy.movePoints + moveMult;

// 8254-8255  够就动，动一次
if (enemy.movePoints >= moveNeeded) {
    enemy.movePoints = Math.max(0, enemy.movePoints - enemy.Enemy.movePoints + moveMult);
    ... // 移动一格
}
```

要点：
- `delta` 是这一 tick 的推进量（玩家普通行动 = 1）
- 加速靠 `speedMult`（`MoveSpeed` buff 的乘算反比）
- 被绑 `×0.1`、减速 `×0.5`、玩家睡觉时敌人 `×4`
- **一个 `if`，不是 `while`** → 一个敌人一 tick 最多走 **一格**
- 有个特例：被玩家"牵着"的敌人（`KinkyDungeonLeashingEnemy`）在玩家移动/等待后 `moveNeeded = 1 + moveMult`（8249-8252），避免点击疲劳

> ⚠️ 8255 那一行**疑似笔误**：`- enemy.Enemy.movePoints + moveMult` 应该是 `- moveNeeded`。当 `moveMult == 0`（没被束缚）时两者等价；有束缚时残余点数会算错一点。这是 KD 的真实小 bug，抄的时候别抄。

### 攻击（`KinkyDungeonEnemyTryAttack`，`KinkyDungeonEnemies.ts:8347`）

```ts
// 8407  每 tick 累加（注意 delta 由调用方传：first ? delta : 0）
enemy.attackPoints += delta * KinkyDungeonMultiplicativeStat(-...AttackSpeed);
if (enemy.attackBonus) { enemy.attackPoints += enemy.attackBonus * ...; enemy.attackBonus = 0; }

// 8415-8417  够就攻击一次
if (enemy.attackPoints >= points) {
    enemy.attackPoints = enemy.attackPoints - points;
    return true;
}
```

`points` 来自调用处（`KinkyDungeonEnemies.ts:6825`）：

```ts
let ap = (KDGameData.MovePoints < 0 && !KinkyDungeonHasWill(0.1) && KinkyDungeonLeashingEnemy()?.id == enemy.id)
    ? enemy.Enemy.movePoints + moveMult + 1
    : enemy.Enemy.attackPoints + attackMult;
```

注意 `:6826` 的 `first ? delta : 0`：**一 tick 内只有第一次攻击尝试会累加时间**，后续同 tick 的尝试传 0，防止重复累加。

---

## 3. Q3：`SlowLevel = 2` 要按几次方向键

### 机制：慢不是"多花时间"，是"欠点"

一次成功移动后，`KinkyDungeonMoveTo` 返回 `newDelta`（`KinkyDungeonGame.ts:3499`）：

```ts
return Math.max(1, KinkyDungeonSlowLevel);   // 普通情况
```

但调用方**并没有**用它去 `AdvanceTime(newDelta)`，而是**永远推进 1**，把差额变成 `MovePoints` 的负债：

```ts
// 3256   永远是 1（Quickness 才是 0）
KinkyDungeonAdvanceTime(quick ? 0 : 1);

// 3262-3270  差额变成负债（非 LazyWalk 时）
if (newDelta > 1 && newDelta < 10 && !quick) {
    if (KDToggles.LazyWalk && !KinkyDungeonInDanger()) {
        KDGameData.SlowMoveTurns = newDelta - 1;
        KDUpdateWaitTime(...);                      // 自动等待
    } else {
        KDGameData.MovePoints = Math.min(KDGameData.MovePoints, 1-newDelta);   // 负债
    }
}
```

### 逐次按键追踪（`SlowLevel = 2`，非 LazyWalk，初始 MP=0）

进 `KinkyDungeonMove` 第一步就是累加（3094）：`MP = min(ceil(Slow+1), MP+1)` = `min(3, MP+1)`。

| 按键 | MP 累加后 | 门槛 `MP>=1` | 行为 | 时间 |
|---|---|---|---|---|
| 1 | 0 → 1 | ✅ | 走一格，MP = min(1, 1-2) = **-1** | +1 tick |
| 2 | -1 → **0** | ❌ | 原地等待，MP = min(0+1,0) = 0 | **+1 tick** |
| 3 | 0 → 1 | ✅ | 走一格，MP = **-1** | +1 tick |
| 4 | -1 → 0 | ❌ | 等待 | +1 tick |

**答案：2 次按键走一格（1 次移动 + 1 次等待），代价是 2 个 tick。**

失败的那一次同样推进了世界 —— 走的是 `else` 分支（3282-3286）：

```ts
KDGameData.MovePoints = Math.min(KDGameData.MovePoints + 1, 0);
KinkyDungeonPlayerEntity.facing_x = 0;
KinkyDungeonPlayerEntity.facing_y = 0;
KinkyDungeonWaitMessage(false, 1);
KinkyDungeonAdvanceTime(1);   // ← 卡住也算一回合
```

### 「慢 = 世界相对你变快了」——是的，字面成立

`SlowLevel` 的语义就是**「走一格要几个 tick」**。`SlowLevel=1` → 1 tick/格；`=2` → 2 tick/格；`=3` → 3 tick/格。这期间敌人照常每 tick 累加自己的 `movePoints`，所以**玩家被减慢 = 敌人的相对速度变成 2 倍/3 倍**。

还有一点：**如果开了 LazyWalk**（3263-3267），游戏不要求你按那几次"空键"，而是设 `SlowMoveTurns = newDelta-1`，然后由 `KDUpdateWaitTime` 用真实时间自动补那些 tick。这就是"自动前进"模式。

---

## 4. Q4：完整逐行追踪（玩家 SlowLevel=1，敌 A `movePoints:2`，敌 B `attackPoints:3`）

### 假设
- 玩家 `KBoundEffects = 0` → `moveNeeded_玩家 = 1`（`SlowLevel=1`）
- 敌 A：类型 `movePoints: 2`，不被束缚（`KDBoundEffects(A)=0` → `moveNeeded_A = 2`），已攒 `movePoints = 1`
- 敌 B：类型 `attackPoints: 3` → 攻击成本 3，已攒 `attackPoints = 2`，与玩家相邻、可攻击
- 敌 A/B 都 `aware`，AI 决定"朝玩家走/攻击"
- 玩家按一次「前进」，落在敌 B 的相邻格

### 阶段 0：按键 → 输入
```
Main.ts:159  KeyDown(event)              // event.repeat 直接丢弃
  → CommonKeyDown → 键位表 → KDSendInput("move", {dir, delta:1, ...})
KinkyDungeonInput.ts:11  KDInputTypes["move"]
  → KinkyDungeonMove(dir, 1, ...)
```
（若输入队列非空，先进队列；每帧最多消费 3 条，`KinkyDungeonInput.ts:1705-1716`）

### 阶段 1：玩家移动（**在 AdvanceTime 之前**）
```
Game.ts:3093  MP = min(ceil(1+1), 0+1) = 1
Game.ts:3130  MP >= 1 ✅ 进入移动
Game.ts:3136  newDelta = max(newDelta, KinkyDungeonMoveTo(...)) = 1
   ├ 3408  KinkyDungeonMoveTo
   │  ├ 3423  KinkyDungeonUpdateTether(...) → KDMovePlayer(x, y)   ← 玩家 x/y 立刻变成新格
   │  ├ 3426  HandleStepOffTraps（旧格）
   │  ├ 3493  没被取消
   │  └ 3498-3499  MP = 0; return max(1, SlowLevel) = 1
Game.ts:3256  KinkyDungeonAdvanceTime(1)      ← 从这里开始世界 tick
Game.ts:3262  newDelta(1) > 1 ❌ → 不进负债分支
```

### 阶段 2：`AdvanceTime(1)` 内部（按 §1 的表逐段）
```
3531  入口
3609  ResetEventVariablesTick(1)
3610  SendEvent("tick")
3622  ItemCheck(玩家新格)
3638  UpdateBuffs(1)            ← 玩家和敌人身上的 buff 先结算
3639  UpdateEnemies(1, true)    ← 【友方】没有友方，空转
3648  UpdateBullets(1)
3649  UpdateBulletsCollisions(1)
3650  UpdateEnemies(1, false)   ← 【敌对】A 和 B 在这里行动（详见阶段 3）
3654  UpdateBullets(1)          ← 再跑一遍
3655  UpdateBulletsCollisions(1, true)   "catchup for explosions"
3657  ParseExtraWarningTiles(1)
3659  UpdateEffectTiles(1) / UpdateTileEffects(1)
3668  UpdateTether(0, ...)      ← delta=0，只对齐几何
3676  KDCommanderUpdate(1)
3688  UpdateStats(1)            ← 玩家体力/意志/魔力在这里结算
3690  HandleMoveToTile(玩家脚下格子)   ← 踩到的格子效果（陷阱/传送/楼梯）
3696-3713  DelayedActions 扣减 + commit
3755  KDTickMaps(1, ...)        ← 每 50 tick 才真跑，处理相邻楼层
3764  KinkyDungeonCurrentTick += 1
3767  SendEvent("tickAfter")
```

### 阶段 3：`UpdateEnemies(1, false)` 内部
```
Enemies.ts:4434  for (let enemy of KDMapData.Entities)      ← 数组顺序，无排序
  → 只有 !KDAllied(enemy) 的才进（:4436）
  → :4809  HandleTilesEnemy(enemy, 1)
  → :4811  HandleTraps（若触发）
  → :4829  若 disabled/helpless/channel/teleporting → 跳过 AI
  → :4848  KinkyDungeonEnemyLoop(enemy, player, 1, visionMod, items)
        ├ 6551/6560  KinkyDungeonEnemyTryMove(...)
        │    ├ 8236  A.movePoints += 1 → 2
        │    ├ 8254  2 >= 2 ✅
        │    └ 8255  扣点并移动一格 → A 向玩家靠近 1 格
        └ 6826  KinkyDungeonEnemyTryAttack(..., first?1:0, ..., ap=3)
             ├ 8407  B.attackPoints += 1 → 3
             └ 8415  3 >= 3 ✅ → 攻击，B.attackPoints = 0
```
**这一 tick 的结果**：A 走了一格（耗光 2 点，回到 0），B 攻击了一次（耗光 3 点，回到 0）。

### 阶段 4：渲染（下一个动画帧，与逻辑无关）
```
Main.ts:79-92   PIXI.Ticker → DrawProcess
  → KinkyDungeonRun()
  → Draw.ts:1154  KinkyDungeonUpdateVisualPosition(玩家, DrawDelta)
  → Enemies.ts:813  KinkyDungeonUpdateVisualPosition(A, DrawDelta)
                    KinkyDungeonUpdateVisualPosition(B, DrawDelta)
```
A 的 `visual_x/y` 从旧格向新格插值（默认 100ms/格），玩家同理。**逻辑已经结算完了，视觉还在走**——这就是"逻辑先到达"。

### 下一步（第二 tick）
玩家再按一次前进：MP = 0+1 = 1 ✅ → 再走一格，`AdvanceTime(1)` → A 的 `movePoints` = 0+1 = 1 `< 2` ❌ 不动；B 的 `attackPoints` = 0+1 = 1 `< 3` ❌ 不攻击。

**净效果**：`movePoints:2` 的敌人**每 2 个玩家行动走 1 格**；`attackPoints:3` 的敌人**每 3 个玩家行动攻击 1 次**。

---

## 5. Q5：同 tick 两个敌人，顺序由什么决定

**数组下标 `KDMapData.Entities` 的顺序**（`Enemies.ts:4434`），而这个数组的顺序 = **生成顺序**（`KinkyDungeonEnemies.push(...)` / 刷怪顺序）。

- 没有排序、没有 tie-break、没有按 id
- 遍历时还会**边遍历边删**（`Game.ts:3642-3647` 的 `E -= 1; continue;`，`Enemies.ts` 里同类写法），所以一旦有敌人死亡，后续敌人的下标会变
- 两轮分组：**友方全体先跑完（3639），敌对全体后跑（3650）**，中间夹子弹结算

**后果**：同级同速的两个敌人，"谁先动"取决于它俩谁先被 spawn —— 对玩家可感知（先动的可能抢到位置）。这是 KD 的确定性弱点，**你们要做 readyAt 的话正好顺手修掉**（用稳定 key：`(readyAt, id)`）。

---

## 6. Q6：有没有先攻/敏捷排序

**没有。** 全仓没有按速度排序行动队列的逻辑。

唯一的"优先级"是**分轮次**，不是分个体：

1. `UpdateEnemies(delta, true)` —— 友方
2. 子弹 + 碰撞
3. `UpdateEnemies(delta, false)` —— 敌对
4. 子弹（catchup）
5. `KDCommanderUpdate(delta)` —— 指挥官/军团层（`enemy/KDCommander.ts`），在所有个体之后

所以准确的说法是：**顺序按"阵营/类型"分三轮，轮内按数组顺序**，没有个体级先攻。

---

## 7. Q7：`DelayedActions.time` 的单位

**单位是 `delta`，不是毫秒。** 玩家普通行动 = 1，所以约等于"回合"，但不恒为 1（施法可以传别的 delta，`KinkyDungeonInput.ts:111` 用 `res.data.delta`）。

**在哪扣减、commit 在哪一段**（`KinkyDungeonGame.ts:3696-3713`）：

```ts
if (!KDGameData.DelayedActions) KDGameData.DelayedActions = [];
let runActions: KDDelayedAction[] = Object.assign([], KDGameData.DelayedActions);
KDGameData.DelayedActions = KDGameData.DelayedActions.filter((a) => a.time - delta > 0);
for (let action of runActions) {
    action.time -= delta;
    if (action.time <= 0) { KDDelayedActionCommit[action.commit](action); }
    else if (action.update) { KDDelayedActionUpdate[action.update](action); }
}
```

- 位置：**阶段 28**，即**在敌人行动之后、`KDTickMaps` 之前、`tickAfter` 之前**
- 所以在同一 tick 里，敌人先动，然后延时动作才 commit
- 顺序：按数组顺序（push 顺序），**没有按 `time` 排序**

---

## 8. Q8：有没有单位一 tick 行动多次

**敌人：没有。** 移动和攻击各是一个 `if`（8254 / 8415），不是 `while`。一 tick 最多 1 次移动 + 1 次攻击。

**玩家：三种"零成本/超额"机制，但都不是"多 tick"**

| 机制 | 实现 | 效果 |
|---|---|---|
| **Quickness**（天赋/buff） | `MovePoints = SlowLevel + 1`（3121）+ `AdvanceTime(quick ? 0 : 1)`（3256） | 这一格**不推进时间**，等于白送一步 |
| **Sprint** | `KDMovePlayer(x*2, y*2)`（3485）后 `return 1`（3490） | 一次移动跨 **2 格**，仍只算 **1 tick** |
| **LazyWalk 自动前进** | `SlowMoveTurns = newDelta-1` + `KDUpdateWaitTime`（3263-3267） | 用真实时间自动补 tick，不需要按键 |

**结论**：没有"同一 tick 内多次 AdvanceTime"。要么 `delta=0`（免费），要么 `delta=1` 但一次动两格（冲刺）。**零成本动作的上限就是"一次移动"**，不能叠。

---

## 9. Q9：一 tick 走两格，视觉怎么补

**一次连续插值，它根本不知道走了几步。**

`KinkyDungeonUpdateVisualPosition`（`Draw.ts:3071`）只读两样东西：当前 `visual_x/y` 和逻辑 `x/y`，然后按 `value = amount/speed` 直线逼近。中间经过几格、有没有拐弯，它一概不知——**斜穿也会走直线**。

```ts
let dist = Math.sqrt((visual_x - tx)**2 + (visual_y - ty)**2);
if (dist > 5) value = 1;      // 一次跳 6 格
```

所以：
- 冲刺（2 格）= **一个 200ms 的直线插值**（默认 100ms/格），不是两个 100ms
- 被 snap 的 6 格 = **一帧内瞬移**
- 它确实不需要记录"上一格"——因为**没有插值状态需要延续**。代价是"路径信息"永远丢失（斜着穿墙看起来也自然）

**对你们的启示**：如果你们的视觉投影需要表现"拐弯"（比如走 L 型路线），就必须自己记录 path；KD 用"直线优先"换掉了这个问题。

---

## 10. Q10：玩家没输入时，时间还在走吗

**在走，但只在两种情况下走，而且都是真的 `AdvanceTime(1)`。**

### (a) 自动等待 `KinkyDungeonAutoWait`

每帧检查，到点就**伪造一次"原地移动"输入**（`KinkyDungeon.ts:3246-3267`）：

```ts
} else if (KinkyDungeonAutoWait || (KDAutoWaitDelayed && KDGameData.DelayedActions?.length > 0)) {
    if (CommonTime() > KinkyDungeonSleepTime) {
        ...
        KDSendInput("move", {dir: {x:0, y:0, delta: 0}, delta: 1, ...}, false, true);   // 3263
        KDUpdateWaitTime(wt);                                                           // 3266
    }
}
```

方向 `{0,0}` → 走 `KinkyDungeonMove` 的 `else`（3282-3286）→ `AdvanceTime(1)`。

节流靠 `KinkyDungeonSleepTime` + `KDUpdateWaitTime`（`Game.ts:4760-4777`），后者有个"短延迟可以覆盖长延迟"的阈值 `KDOverrideWaitTimeThreshold = 950`。

等待间隔可选 25/50/75/200ms（`KinkyDungeonDraw.ts:1059-1062`）。

### (b) 被束缚自动挣扎 / 延时动作自动等待

- `KinkyDungeonAutoWaitStruggle`（3268+）→ 调 `KDHandleAutoStruggle`
- `KDAutoWaitDelayed`（`Game.ts:174`）→ 只要还有 `DelayedActions` 没跑完，就自动继续等，跑完自动停（`3713`）

### (c) 睡眠 —— 不是循环，是改闸门

`KDSleepTick()`（`Input.ts:95-97`）在 `tick` 输入里调用；睡眠本身不改 `AdvanceTime` 的频率，而是让敌人 `movePoints` 涨 4 倍（`8238`）并影响其他判定。

**所以"谁驱动时钟"的答案是**：
- **平时：玩家输入驱动**（一次行动一次 `AdvanceTime(1)`）
- **自动模式：渲染循环 + 真实时间阈值驱动**（`CommonTime() > KinkyDungeonSleepTime` 时补一次 `AdvanceTime(1)`）
- 世界**从不自主流逝**——没有 `setInterval` 的 tick 循环

---

## 11. 对你们的 `readyAt` 设计意味着什么

### 数学上：KD 就是 `readyAt` 的累加器写法

| | KD 的实现 | `readyAt` 的写法 |
|---|---|---|
| 状态 | `enemy.movePoints`（已攒） | `nextTick`（该动的 tick） |
| 每 tick | `points += speed * delta` | 不变（或者 `nextTick -= speed`） |
| 行动条件 | `points >= cost` | `tick >= nextTick` |
| 行动后 | `points -= cost` | `nextTick += cost / speed` |

**两者等价**，但性质不同：

- **累加器**：不需要排序，一次遍历就行；缺点是"谁先动"取决于遍历顺序（KD 的弱点）
- **readyAt**：需要每 tick 取最小值（或排序），**但天然给出确定性顺序**（`(nextTick, id)` 字典序），而且能一眼看出"下一个动的是谁"——这对 UI（行动顺序条）和回放都有用

### 你们的那个二选一，KD 的答案

> `readyAt` 是「每 tick 加一次速度」，还是「行动后重置为 tick + 成本」

**KD 是前者（连续蓄积）**，而且这个选择带来一个实际好处：**速度变化时不丢进度**。

如果你们用"行动后重置 `nextTick = tick + cost`"，那么在**行动中途被减速/加速**时，只有下一次行动才体现，之前投入的进度作废；而累加器可以把"已经攒了 0.7 格"带进新速度。

**建议**：用 `readyAt` 做**排序键**（确定性 + 可展示），底层仍用累加器（`progress / cost`）表达"攒了多少"。即：

```
progress += speed * dt                       // 每 tick 一次
if (progress >= cost) { act(); progress -= cost; }
readyAt = tick + (cost - progress) / speed   // 仅用于排序/展示，不用于判定
```

两者都要，各干各的活。这样既拿到确定性顺序，又保住"减速不丢进度"。

### 三个可以直接抄的细节

1. **成本分两段**：类型成本（`Enemy.movePoints`）+ 状态成本（`KDBoundEffects * 0.5`），行动时一起扣。这样"被绑住变慢"不需要改速度，只加成本。
2. **`first ? delta : 0`**（`Enemies.ts:6826`）：一 tick 内允许多次尝试攻击，但**只有第一次累加时间**。这是"试错不花钱、真出手才花钱"的写法。
3. **`moveNeeded` 的牵引特例**（8249-8252）：跟随型单位把成本压到 1，纯为了操作手感。**这是玩法参数，不是系统参数**——你们如果做跟随单位，早留这个口子。

### 一个必须避免的点

KD 的行动顺序 = 数组顺序 = spawn 顺序，而且遍历时会因死亡而改变下标（`E -= 1`）。这使得"同一 seed 是否可复现"依赖刷怪顺序的实现细节。**你们既然要 readyAt，就把 tie-break 定成 `(readyAt, entityId)`，不要依赖数组顺序。**

---

## 12. 未验证 / 存疑

- `KinkyDungeonEnemyTryMove` 8255 的 `- enemy.Enemy.movePoints + moveMult` 我判断是笔误（应为 `- moveNeeded`），但没有上游 issue 佐证，属**代码推断**
- 敌人 AI 内部（`KinkyDungeonEnemyLoop`，约 1600 行）只追到"调用移动/攻击"这一层，`AIData` 的决策细节未展开
- `KDCommanderUpdate`（指挥官批处理）只确认了它在所有个体之后运行，内部批处理策略未读
- 联机（`KinkyDungeonMultiplayerUpdate`，`3715`）的输入队列时序未展开
- `delta` 在施法/物品等路径下的实际取值只抽样确认（`Input.ts:111` 用 `res.data.delta`），未穷举所有动作的成本
