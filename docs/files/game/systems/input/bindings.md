# `game/systems/input/bindings.ts`

## 内容

按键映射：`event.code` → 命令字符串。
为什么用 code 而不是 key：key 受大小写、输入法、键盘布局影响
（「大写键无效」就是这么来的）；code 是物理按键位置，稳定。
命令是字符串，和游戏里的动作同构：
move:w / move:a / skill:core.attack / ui:settings
这样界面只需要「查表 → 分发」，不认识任何规则。

行数：79

## 接口

### 函数 `bind`

```ts
function bind(bindings: Bindings, code: string, command: string): Bindings
```

### 类型 `Bindings`

```ts
type Bindings = Readonly<Record<string, string>>
```

### 函数 `boundTo`

```ts
function boundTo(bindings: Bindings, command: string): string[]
```

### 函数 `commandFor`

```ts
function commandFor(bindings: Bindings, code: string): string | undefined
```

### 常量 `DEFAULT_BINDINGS`

```ts
const DEFAULT_BINDINGS: Bindings
```

### 函数 `parseCommand`

```ts
function parseCommand(command: string): ParsedCommand
```

### 接口 `ParsedCommand`

```ts
interface ParsedCommand {
  readonly kind: string;
  readonly value: string;
}
```

### 函数 `resolveBindings`

```ts
function resolveBindings(user: Bindings | null | undefined, defaults: Bindings = DEFAULT_BINDINGS): Bindings
```

### 函数 `unbind`

```ts
function unbind(bindings: Bindings, code: string): Bindings
```

## 依赖

（无）

## 被引用

- [`game/systems/config/config.ts`](game/systems/config/config.md)
- [`tools/client/game.js`](tools/client/game.md)
