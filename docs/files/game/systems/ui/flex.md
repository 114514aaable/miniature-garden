# `game/systems/ui/flex.ts`

## 内容

尺寸策略：把「谁可以让步」压缩成 5 档，翻译成 flex。
为什么只有 5 档：Qt 的七档在纯 flexbox 下有两对不可区分
（Fixed≡Minimum、Maximum≡Preferred），保留更常用的名字即可。
这个文件是整套 UI 里唯一需要「判断」的地方，也是唯一必须能单测的地方：
布局出问题时，先用三行断言在这里复现；复现不了，说明 bug 不在布局层。

行数：57

## 接口

### 常量 `DEFAULT_POLICY`

```ts
const DEFAULT_POLICY: SizePolicy
```

### 函数 `flexStyle`

```ts
function flexStyle(policy: SizePolicy = DEFAULT_POLICY, weight = 1): string
```

### 函数 `grows`

```ts
function grows(policy: SizePolicy): boolean
```

### 函数 `shrinks`

```ts
function shrinks(policy: SizePolicy): boolean
```

### 类型 `SizePolicy`

```ts
type SizePolicy = "fixed" | "fit" | "fill" | "grow" | "ratio"
```

## 依赖

（无）

## 被引用

- [`game/systems/ui/spec.ts`](game/systems/ui/spec.md)
