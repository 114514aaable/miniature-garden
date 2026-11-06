# `game/engine/core/src/rules/rng.ts`

## 内容

随机数：无状态派发。
不用 Math.random，也不用「一个全局流」——而是：
roll(seed, tick, tag, index) = 纯函数
这样：
- 存档不用存随机状态，读回来还是同一串数；
- 同一 tick 里多次取值靠 index 区分；
- tag 让「命中」和「掉落」用不同的流，互不干扰；
- 回放天然成立。
算法：先把 tag 哈希成整数，再把 (seed, tick, hash, index) 用 splitmix32 搅匀。
不是密码学随机，但对游戏足够，而且跨平台完全一致（只做位运算）。

行数：75

## 接口

### 函数 `chance`

```ts
function chance(seed: number, tick: number, tag: string, index: number, probability: number): boolean
```

### 函数 `hashTag`

```ts
function hashTag(tag: string): number
```

### 函数 `roll`

```ts
function roll(seed: number, tick: number, tag: string, index = 0): number
```

### 函数 `rollInt`

```ts
function rollInt(seed: number, tick: number, tag: string, index: number, min: number, max: number): number
```

## 依赖

（无）

## 被引用

（没有别的文件引用它）
