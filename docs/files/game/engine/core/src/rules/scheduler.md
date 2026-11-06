# `game/engine/core/src/rules/scheduler.ts`

## 内容

调度器：谁该动了。
模型（比 Kinky Dungeon 的累加器多一个显式排序键）：
每个单位有一个 readyAt —— 「下次能行动的 tick」。
每 tick 取 readyAt 最小的那个，平局按 handle 排。
为什么不用数组顺序：KD 的行动顺序 = 刷怪顺序，
同一份种子换个刷怪顺序就复现不了。用 (readyAt, handle) 就没这个问题。
玩家不在调度器里：玩家由输入驱动，宿主用它当「世界推进到哪停」的闸门。

行数：122

## 接口

### 接口 `Due`

```ts
interface Due {
  readonly tick: number;
  readonly handle: number;
}
```

### 接口 `Scheduled`

```ts
interface Scheduled {
  readonly handle: number;
  readonly readyAt: number;
}
```

## 依赖

（无）

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
