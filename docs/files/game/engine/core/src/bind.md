# `game/engine/core/src/bind.ts`

## 内容

「对接」：两边各自声明自己能接什么，再算谁和谁接得上。
为什么单独一个模块：这种结构不止「通行」会用——
通行   物种 surfaces  ×  地形 surface
武器   伤害类型     ×  护甲吸收
语言   说的语种     ×  听得懂的语种
两边**各自编码、互不引用**：加一个物种不用改地形，
加一个地形也不用改物种。对接在初始化时算一次。

行数：81

## 接口

### 函数 `connectDeclarations`

```ts
function connectDeclarations( left: readonly Declaration[], right: readonly Declaration[], vocabulary?: readonly string[], ): Connection
```

### 接口 `Connection`

```ts
interface Connection {
  isConnected(leftId: string, rightId: string): boolean;
  readonly unknown: readonly string[];
  readonly unusedLeft: readonly string[];
  readonly unusedRight: readonly string[];
}
```

### 接口 `Declaration`

```ts
interface Declaration {
  readonly id: string;
  readonly codes: readonly string[];
}
```

## 依赖

（无）

## 被引用

- [`game/systems/rules/passage.ts`](game/systems/rules/passage.md)
