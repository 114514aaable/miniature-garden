# `game/engine/core/src/rules/damage.ts`

## 内容

伤害计算：一处定义，所有技能共用。
power   攻击力（来自属性组，或技能显式给的值）
armor   防御力（来自目标属性组）
damage  max(1, power - armor)
为什么要统一：之前 attack 用属性算、sweep 写死 3、敌人打击不算防御，
同一个游戏三套伤害。以后做部位/护盾，只需要在这一个地方加。

行数：50

## 接口

### 函数 `armorOf`

```ts
function armorOf(stats: JsonValue | undefined): number
```

### 函数 `damageOf`

```ts
function damageOf(power: number, armor: number): number
```

### 函数 `numberIn`

```ts
function numberIn(component: JsonValue | undefined, key: string, fallback: number): number
```

### 函数 `powerOf`

```ts
function powerOf(stats: JsonValue | undefined): number
```

### 函数 `resolveDamage`

```ts
function resolveDamage( attackerStats: JsonValue | undefined, targetStats: JsonValue | undefined, ): { power: number; armor: number; damage: number }
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
