# 内核（engine/core）

> 改这里之前先确认：你改的是**规则怎么跑**，不是**某个规则做什么**。
> 某个规则做什么 → 读 [`rules.md`](rules.md)。

## 它是什么

唯一的世界状态持有者。规则只产出效果，效果只有它能应用。

## 关键文件

| 文件 | 职责 |
|---|---|
| `game/engine/core/src/store.ts` | 唯一写入口：`submit(effect)` + `step(dt)`，事件链与撤销 |
| `game/engine/core/src/space.ts` | 格子、地形、占用索引 |
| `game/engine/core/src/entity/` | 实体表、模板（`extends` 深合并）、组件 schema |
| `game/engine/core/src/event/` | 信封、签名、求值、视图（`view.entity()` 等） |
| `game/engine/core/src/pack/` | 读包、合并、依赖排序、加载、`applyInit` |
| `game/engine/core/src/rules/` | 规则实现（见 rules.md） |

## 不变量（改坏了会全盘崩）

1. **只有 `Store` 能改世界**。规则返回 `{ ok, effects }`，不直接写实体。
2. **`core.place` 是虚拟组件**：读是 `components["core.place"]`，写走 `patch`，内部同步实体位置 + 空间索引，`null` 表示不在世界。
3. **同一个 tick 内的效果按提交顺序应用**，事件链每步带 `undo`。
4. **实体句柄只增不减**；死掉的实体留在表里，只是没有位置。
5. **时间只由 `step` 推进**，规则不能自己改 tick。

## 常见坑

- 新加组件必须同时改 `components.json`（包）和 `KNOWN` 校验路径，否则加载期报「未登记」。
- `patch` 是**整体替换**，不是深合并；要部分改就把完整对象写回。
- 序列化：`Int32Array` 会变成奇怪对象，快照里必须转普通数组。

## 测试

```bash
node --test --test-isolation=none
```
内核测试在 `game/engine/core/src/**/*.test.ts`，任何改动都应有测试。

## 下一步读

- 规则怎么写 → [`rules.md`](rules.md)
- 包格式 → [`worlds.md`](worlds.md)
